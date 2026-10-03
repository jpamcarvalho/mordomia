"use server";

import { RESTAURANT_PLACE_COLUMNS, restaurantIdFor, restaurantToPlace, type RestaurantPlaceRow } from "@/lib/list/restaurant-id";
import { isFoodClass, type SelectedPlace } from "@/lib/map/restaurants";
import { isOwnAvatarPath } from "@/lib/profile/account";
import { connoisseur } from "@/lib/social/connoisseur";
import { EVENT_TITLE_MAX, GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX, GROUP_PHOTO_BUCKET } from "@/lib/social/groups";
import {
  PROFILE_COLUMNS,
  friendIds,
  isId,
  signedIn,
  signedUrls,
  toPeople,
  type Person,
  type ProfileRow,
} from "@/lib/social/people";

// Mordomia Social groups. RLS decides who sees what: a group and its member list are visible only to its members
// and the people invited to it; only the owner edits or deletes it; members invite their own friends.

export type GroupMember = Person & { status: "member" | "invited" };
export type Group = {
  id: string;
  name: string;
  description: string | null;
  photoUrl: string | null;
  ownerId: string;
  isOwner: boolean;
  // Mine: a member, or invited and not answered yet.
  myStatus: "member" | "invited";
  // Who invited me (only while invited).
  invitedBy: Person | null;
  // The owner first, then members by name, then pending invites.
  members: GroupMember[];
  // The member who has been mordomo the most times (members only: invitees see no events).
  connoisseur: { person: Person; count: number } | null;
  createdAt: string;
};

type Done = { ok: boolean; error?: string };

const SAVE_FAILED = "Não foi possível guardar. Tenta outra vez.";

type GroupRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  photo_path: string | null;
  created_at: string;
};
type MemberRow = { group_id: string; user_id: string; status: "member" | "invited"; invited_by: string | null };

// Every group I am in or invited to: invites first, then the newest.
export async function loadGroups(): Promise<Group[]> {
  const session = await signedIn();
  if (!session) return [];
  const { supabase, me } = session;
  const { data: groupRows } = await supabase
    .from("groups")
    .select("id, owner_id, name, description, photo_path, created_at")
    .order("created_at", { ascending: false });
  const groups = (groupRows ?? []) as GroupRow[];
  if (groups.length === 0) return [];

  const groupIds = groups.map((group) => group.id);
  const [{ data: memberRows }, { data: mordomoRows }] = await Promise.all([
    supabase.from("group_members").select("group_id, user_id, status, invited_by").in("group_id", groupIds),
    supabase.from("group_events").select("group_id, mordomo_id, created_at").in("group_id", groupIds).not("mordomo_id", "is", null),
  ]);
  const members = (memberRows ?? []) as MemberRow[];
  const mordomos = (mordomoRows ?? []) as { group_id: string; mordomo_id: string; created_at: string }[];
  const personIds = new Set(members.flatMap((row) => [row.user_id, row.invited_by ?? row.user_id]));
  const [{ data: profiles }, photos] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).in("id", [...personIds]),
    signedUrls(
      supabase,
      GROUP_PHOTO_BUCKET,
      groups.map((group) => group.photo_path).filter((path): path is string => !!path),
    ),
  ]);
  const people = new Map((await toPeople(supabase, (profiles ?? []) as ProfileRow[])).map((person) => [person.id, person]));

  return groups
    .flatMap((group): Group[] => {
      const rows = members.filter((row) => row.group_id === group.id);
      const mine = rows.find((row) => row.user_id === me);
      if (!mine) return [];
      const list = rows
        .flatMap((row) => {
          const person = people.get(row.user_id);
          return person ? [{ ...person, status: row.status }] : [];
        })
        .sort(
          (a, b) =>
            Number(b.id === group.owner_id) - Number(a.id === group.owner_id) ||
            Number(a.status === "invited") - Number(b.status === "invited") ||
            a.displayName.localeCompare(b.displayName, "pt"),
        );
      return [
        {
          id: group.id,
          name: group.name,
          description: group.description,
          photoUrl: group.photo_path ? (photos.get(group.photo_path) ?? null) : null,
          ownerId: group.owner_id,
          isOwner: group.owner_id === me,
          myStatus: mine.status,
          invitedBy: mine.status === "invited" && mine.invited_by ? (people.get(mine.invited_by) ?? null) : null,
          members: list,
          connoisseur: (() => {
            const top = connoisseur(
              mordomos.filter((row) => row.group_id === group.id).map((row) => ({ mordomoId: row.mordomo_id, createdAt: row.created_at })),
              rows.filter((row) => row.status === "member").map((row) => row.user_id),
            );
            const person = top && people.get(top.id);
            return top && person ? { person, count: top.count } : null;
          })(),
          createdAt: group.created_at,
        },
      ];
    })
    .sort((a, b) => Number(b.myStatus === "invited") - Number(a.myStatus === "invited"));
}

type GroupInput = { name: unknown; description: unknown; photoPath?: unknown };

// Trims and checks the name / description; the photo must be one I uploaded to my own folder. A missing photo
// (undefined) means "keep the current one" when editing.
function parseGroup(
  me: string,
  input: GroupInput,
): { name: string; description: string | null; photoPath: string | null | undefined } | string {
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  if (!name) return "Dá um nome ao grupo.";
  if (name.length > GROUP_NAME_MAX) return "O nome é demasiado longo.";
  if (input.description !== null && typeof input.description !== "string") return SAVE_FAILED;
  const description = input.description?.trim() || null;
  if (description && description.length > GROUP_DESCRIPTION_MAX) return "A descrição é demasiado longa.";
  const photo = input.photoPath;
  if (photo === undefined || photo === null) return { name, description, photoPath: photo };
  if (!isOwnAvatarPath(me, photo)) return "Foto inválida.";
  return { name, description, photoPath: photo };
}

// Invites those of `ids` who are my friends and not in the group yet (RLS refuses anyone else).
async function invite(groupId: string, ids: unknown): Promise<boolean> {
  const session = await signedIn();
  if (!session || !Array.isArray(ids)) return false;
  const { supabase, me } = session;
  const friends = new Set(await friendIds(supabase, me));
  const { data: existing } = await supabase.from("group_members").select("user_id").eq("group_id", groupId);
  const already = new Set((existing ?? []).map((row) => row.user_id as string));
  const rows = [...new Set(ids)]
    .filter((id): id is string => isId(id) && friends.has(id) && !already.has(id))
    .map((user_id) => ({ group_id: groupId, user_id }));
  if (rows.length === 0) return true;
  const { error } = await supabase.from("group_members").insert(rows);
  return !error;
}

// Creates a group (I become its owner and first member) and invites the chosen friends.
export async function createGroup(input: GroupInput & { invite: unknown }): Promise<Done & { id?: string }> {
  const session = await signedIn();
  if (!session) return { ok: false, error: "Sessão não iniciada." };
  const { supabase, me } = session;
  const parsed = parseGroup(me, input);
  if (typeof parsed === "string") return { ok: false, error: parsed };
  // The id is chosen here: the new row is only readable once the owner's membership exists (after the insert).
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("groups")
    .insert({ id, name: parsed.name, description: parsed.description, photo_path: parsed.photoPath ?? null });
  if (error) return { ok: false, error: SAVE_FAILED };
  const invited = await invite(id, input.invite);
  return invited ? { ok: true, id } : { ok: true, id, error: "O grupo foi criado, mas alguns convites falharam." };
}

// Owner only (RLS): new name, description and photo; the previous photo is removed.
export async function updateGroup(groupId: string, input: GroupInput): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(groupId)) return { ok: false, error: SAVE_FAILED };
  const { supabase, me } = session;
  const parsed = parseGroup(me, input);
  if (typeof parsed === "string") return { ok: false, error: parsed };
  const { data: before } = await supabase.from("groups").select("photo_path").eq("id", groupId).eq("owner_id", me).maybeSingle();
  if (!before) return { ok: false, error: SAVE_FAILED };
  const { error } = await supabase
    .from("groups")
    .update({
      name: parsed.name,
      description: parsed.description,
      ...(parsed.photoPath !== undefined && { photo_path: parsed.photoPath }),
    })
    .eq("id", groupId);
  if (error) return { ok: false, error: SAVE_FAILED };
  const old = before.photo_path as string | null;
  if (old && parsed.photoPath !== undefined && old !== parsed.photoPath) await supabase.storage.from(GROUP_PHOTO_BUCKET).remove([old]);
  return { ok: true };
}

// Owner only (RLS): removes the group, its members and its photo.
export async function deleteGroup(groupId: string): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(groupId)) return { ok: false };
  const { supabase, me } = session;
  const { data, error } = await supabase
    .from("groups")
    .delete()
    .eq("id", groupId)
    .eq("owner_id", me)
    .select("photo_path");
  if (error || !data?.length) return { ok: false };
  const photo = data[0].photo_path as string | null;
  if (photo) await supabase.storage.from(GROUP_PHOTO_BUCKET).remove([photo]);
  return { ok: true };
}

export async function inviteToGroup(groupId: string, ids: unknown): Promise<Done> {
  if (!isId(groupId)) return { ok: false };
  return { ok: await invite(groupId, ids) };
}

export async function acceptGroupInvite(groupId: string): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(groupId)) return { ok: false };
  const { supabase, me } = session;
  const { data, error } = await supabase
    .from("group_members")
    .update({ status: "member" })
    .eq("group_id", groupId)
    .eq("user_id", me)
    .eq("status", "invited")
    .select("group_id");
  return { ok: !error && (data?.length ?? 0) > 0 };
}

// Declines an invite or leaves a group (me), removes a member (owner) or cancels an invite I sent.
export async function removeGroupMember(groupId: string, userId: string): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(groupId) || !isId(userId)) return { ok: false };
  const { data, error } = await session.supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .select("user_id");
  return { ok: !error && (data?.length ?? 0) > 0 };
}

// One group I am in or invited to, or null.
export async function loadGroup(groupId: string): Promise<Group | null> {
  if (!isId(groupId)) return null;
  return (await loadGroups()).find((group) => group.id === groupId) ?? null;
}

export type GroupEvent = {
  id: string;
  // Short code for shared links (/e/<code>).
  shareCode: string;
  groupId: string;
  title: string;
  createdAt: string;
  createdBy: Person | null;
  // The event's admin; null until someone takes it.
  mordomo: Person | null;
  // Once the event has a date: who is going (locked in, or said "Vou").
  going: Person[];
  // Members who did not vote for the chosen day and have not answered yet.
  undecided: Person[];
  // Of those going, who voted for the chosen day (or is the mordomo): they cannot leave.
  lockedIds: string[];
  // Who said "Não vou", and whether they are asking the mordomo to come back.
  left: { person: Person; rejoinRequested: boolean }[];
  // My place once there is a date: locked in (voted for the day / mordomo), still to answer, "Vou", "Não vou",
  // or "Não vou" and asking to come back.
  me: "locked" | "undecided" | "going" | "left" | "requested" | null;
  // The event's creator or the group owner.
  canDelete: boolean;
  // No mordomo yet and I am the event's creator or the group owner: I name one.
  canChooseMordomo: boolean;
  // No mordomo yet and I created the event: only then can I roll the dice.
  canRollMordomo: boolean;
  // I am the mordomo: I open and close the date poll.
  isMordomo: boolean;
  // The event's day (YYYY-MM-DD), once the mordomo closed the poll ("Habemus data").
  date: string | null;
  // When it starts ("HH:MM"), set by the mordomo once the restaurant is chosen (optional; can change until closed).
  startTime: string | null;
  // The days of the date poll, in order; empty when there is no poll yet.
  dateOptions: DateOption[];
  // Where: a restaurant, chosen by the mordomo (optional; can change).
  location: SelectedPlace | null;
  // While there is no location: restaurants suggested by who is going.
  suggestions: LocationSuggestion[];
  // I am going and there is no location yet.
  canSuggest: boolean;
  // "Preço certo": guesses of the price per person, then the bill revealed by the mordomo.
  price: PriceGame;
  // When the mordomo closed ("encerrou") the event; a closed event no longer changes.
  closedAt: string | null;
};

export type PriceGame = {
  // Not opened yet by the mordomo, taking guesses, guesses closed (the mordomo types the bill), or revealed.
  status: "off" | "open" | "closed" | "revealed";
  // Set once the mordomo reveals it (final).
  bill: { total: number; people: number; revealedAt: string } | null;
  // Who guessed, earliest first (amounts stay secret until the reveal).
  guessers: Person[];
  myGuess: number | null;
  // Everyone's guesses, once the bill is revealed.
  guesses: { person: Person; amount: number; at: string }[];
  // I am going and the guesses are open.
  canGuess: boolean;
};

export type LocationSuggestion = { id: string; place: SelectedPlace; by: Person | null; mine: boolean };

export type DateOption = { id: string; day: string; voters: Person[]; mine: boolean };

type EventRow = {
  id: string;
  title: string;
  created_at: string;
  created_by: string | null;
  mordomo_id: string | null;
  event_date: string | null;
  start_time: string | null;
  price_opened_at: string | null;
  price_closed_at: string | null;
  closed_at: string | null;
  share_code: string;
  location: RestaurantPlaceRow | null;
};
type SuggestionRow = { id: string; event_id: string; suggested_by: string | null; restaurants: RestaurantPlaceRow | null };
type AttendanceRow = { event_id: string; user_id: string; going: boolean; rejoin_requested_at: string | null };
type GuessRow = { event_id: string; user_id: string; amount: number | string; created_at: string };
type GuesserRow = { event_id: string; user_id: string; created_at: string };
type BillRow = { event_id: string; total: number | string; people: number; revealed_at: string };
type OptionRow = { id: string; event_id: string; day: string; group_event_date_votes: { user_id: string }[] };

// The group's events, newest first, with the date poll and who is going. RLS returns nothing unless I am a member.
export async function loadGroupEvents(groupId: string): Promise<GroupEvent[]> {
  const session = await signedIn();
  if (!session || !isId(groupId)) return [];
  const { supabase, me } = session;
  const [{ data: eventRows }, { data: group }] = await Promise.all([
    supabase
      .from("group_events")
      .select(`id, title, created_at, created_by, mordomo_id, event_date, start_time, price_opened_at, price_closed_at, closed_at, share_code, location:restaurants(${RESTAURANT_PLACE_COLUMNS})`)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false }),
    supabase.from("groups").select("owner_id").eq("id", groupId).maybeSingle(),
  ]);
  const events = (eventRows ?? []) as unknown as EventRow[];
  if (events.length === 0) return [];
  const eventIds = events.map((event) => event.id);
  const [
    { data: attendanceRows },
    { data: memberRows },
    { data: optionRows },
    { data: suggestionRows },
    { data: guessRows },
    { data: guesserRows },
    { data: billRows },
  ] = await Promise.all([
    supabase.from("group_event_attendance").select("event_id, user_id, going, rejoin_requested_at").in("event_id", eventIds),
    supabase.from("group_members").select("user_id").eq("group_id", groupId).eq("status", "member"),
    supabase
      .from("group_event_date_options")
      .select("id, event_id, day, group_event_date_votes(user_id)")
      .in("event_id", eventIds)
      .order("day"),
    supabase
      .from("group_event_location_suggestions")
      .select(`id, event_id, suggested_by, restaurants(${RESTAURANT_PLACE_COLUMNS})`)
      .in("event_id", eventIds)
      .order("created_at"),
    // Mine, plus everyone's once revealed (RLS).
    supabase.from("group_event_price_guesses").select("event_id, user_id, amount, created_at").in("event_id", eventIds),
    supabase.rpc("event_price_guessers", { eids: eventIds }),
    supabase.from("group_event_bills").select("event_id, total, people, revealed_at").in("event_id", eventIds),
  ]);
  const guesses = (guessRows ?? []) as GuessRow[];
  const guessers = ((guesserRows ?? []) as GuesserRow[]).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const bills = new Map(((billRows ?? []) as BillRow[]).map((row) => [row.event_id, row]));
  const suggestions = (suggestionRows ?? []) as unknown as SuggestionRow[];
  const attendance = (attendanceRows ?? []) as AttendanceRow[];
  const memberIds = (memberRows ?? []).map((row) => row.user_id as string);
  const options = (optionRows ?? []) as OptionRow[];
  const ids = new Set<string>([...memberIds, ...attendance.map((row) => row.user_id)]);
  for (const row of suggestions) if (row.suggested_by) ids.add(row.suggested_by);
  for (const row of guessers) ids.add(row.user_id);
  for (const option of options) for (const vote of option.group_event_date_votes) ids.add(vote.user_id);
  for (const event of events) for (const id of [event.created_by, event.mordomo_id]) if (id) ids.add(id);
  const { data: profiles } = await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", [...ids]);
  const people = new Map((await toPeople(supabase, (profiles ?? []) as ProfileRow[])).map((person) => [person.id, person]));
  const isOwner = group?.owner_id === me;

  return events.map((event) => {
    const answers = new Map(attendance.filter((row) => row.event_id === event.id).map((row) => [row.user_id, row]));
    const chosen = options.find((option) => option.event_id === event.id && option.day === event.event_date);
    const lockedIn = new Set([...(chosen?.group_event_date_votes.map((vote) => vote.user_id) ?? []), event.mordomo_id]);
    const mine = lockedIn.has(me) ? undefined : answers.get(me);
    // Locked in, else my answer; voting for the day wins over an earlier answer.
    const state = (id: string) => (lockedIn.has(id) ? "going" : answers.has(id) ? (answers.get(id)!.going ? "going" : "left") : "undecided");
    const inGroup = memberIds.filter((id) => people.has(id));
    return {
      id: event.id,
      groupId,
      title: event.title,
      createdAt: event.created_at,
      createdBy: event.created_by ? (people.get(event.created_by) ?? null) : null,
      mordomo: event.mordomo_id ? (people.get(event.mordomo_id) ?? null) : null,
      going: event.event_date
        ? inGroup
            .filter((id) => state(id) === "going")
            .map((id) => people.get(id)!)
            // Locked-in first (voted for the day / mordomo), then by name.
            .sort(
              (a, b) =>
                Number(lockedIn.has(b.id)) - Number(lockedIn.has(a.id)) || a.displayName.localeCompare(b.displayName, "pt"),
            )
        : [],
      lockedIds: event.event_date ? [...lockedIn].filter((id): id is string => !!id) : [],
      undecided: event.event_date ? inGroup.filter((id) => state(id) === "undecided").map((id) => people.get(id)!) : [],
      left: event.event_date
        ? inGroup
            .filter((id) => state(id) === "left")
            .map((id) => ({ person: people.get(id)!, rejoinRequested: !!answers.get(id)!.rejoin_requested_at }))
        : [],
      me: !event.event_date
        ? null
        : lockedIn.has(me)
          ? "locked"
          : !mine
            ? "undecided"
            : mine.going
              ? "going"
              : mine.rejoin_requested_at
                ? "requested"
                : "left",
      canDelete: isOwner || event.created_by === me,
      canChooseMordomo: !event.mordomo_id && (isOwner || event.created_by === me),
      canRollMordomo: !event.mordomo_id && event.created_by === me,
      isMordomo: event.mordomo_id === me,
      date: event.event_date,
      // Postgres sends "20:30:00".
      startTime: event.start_time ? event.start_time.slice(0, 5) : null,
      dateOptions: options
        .filter((option) => option.event_id === event.id)
        .map((option) => ({
          id: option.id,
          day: option.day,
          voters: option.group_event_date_votes.flatMap((vote) => (people.has(vote.user_id) ? [people.get(vote.user_id)!] : [])),
          mine: option.group_event_date_votes.some((vote) => vote.user_id === me),
        })),
      location: event.location ? restaurantToPlace(event.location) : null,
      suggestions: event.location
        ? []
        : suggestions.flatMap((row) => {
            const place = row.event_id === event.id && row.restaurants ? restaurantToPlace(row.restaurants) : null;
            return place
              ? [{ id: row.id, place, by: row.suggested_by ? (people.get(row.suggested_by) ?? null) : null, mine: row.suggested_by === me }]
              : [];
          }),
      canSuggest: !!event.event_date && !event.closed_at && !event.location && state(me) === "going",
      price: priceGame(event, me, state(me) === "going", bills.get(event.id), guesses, guessers, people),
      closedAt: event.closed_at,
      shareCode: event.share_code,
    };
  });
}

function priceGame(
  event: EventRow,
  me: string,
  going: boolean,
  bill: BillRow | undefined,
  guesses: GuessRow[],
  guessers: GuesserRow[],
  people: Map<string, Person>,
): PriceGame {
  const mine = guesses.find((row) => row.event_id === event.id && row.user_id === me);
  const status = bill ? "revealed" : event.price_closed_at ? "closed" : event.price_opened_at ? "open" : "off";
  return {
    status,
    bill: bill ? { total: Number(bill.total), people: bill.people, revealedAt: bill.revealed_at } : null,
    guessers: guessers.flatMap((row) => (row.event_id === event.id && people.has(row.user_id) ? [people.get(row.user_id)!] : [])),
    myGuess: mine ? Number(mine.amount) : null,
    guesses: bill
      ? guesses.flatMap((row) =>
          row.event_id === event.id && people.has(row.user_id)
            ? [{ person: people.get(row.user_id)!, amount: Number(row.amount), at: row.created_at }]
            : [],
        )
      : [],
    canGuess: !!event.event_date && going && status === "open",
  };
}

// A member creates an event; with `mordomo`, they are its mordomo.
export async function createGroupEvent(
  groupId: string,
  input: { title: unknown; mordomo: unknown },
): Promise<Done & { id?: string }> {
  const session = await signedIn();
  if (!session || !isId(groupId)) return { ok: false, error: SAVE_FAILED };
  const title = typeof input.title === "string" ? input.title.trim().replace(/\s+/g, " ") : "";
  if (!title) return { ok: false, error: "Dá um nome ao evento." };
  if (title.length > EVENT_TITLE_MAX) return { ok: false, error: "O nome é demasiado longo." };
  const id = crypto.randomUUID();
  const { error } = await session.supabase
    .from("group_events")
    .insert({ id, group_id: groupId, title, created_by: session.me, mordomo_id: input.mordomo === true ? session.me : null });
  return error ? { ok: false, error: SAVE_FAILED } : { ok: true, id };
}

// "Vou" / "Não vou" for who did not vote for the chosen day ("Não vou" is final unless the mordomo lets them back).
export async function answerGroupEvent(eventId: string, going: boolean): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(eventId) || typeof going !== "boolean") return { ok: false };
  const { error } = await session.supabase.rpc("answer_group_event", { eid: eventId, going });
  return { ok: !error };
}

// After "Não vou": ask the mordomo to come back.
export async function requestGroupEventRejoin(eventId: string): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(eventId)) return { ok: false };
  const { error } = await session.supabase.rpc("request_group_event_rejoin", { eid: eventId });
  return { ok: !error };
}

// The mordomo lets someone back in, or not.
export async function answerGroupEventRejoin(eventId: string, userId: string, accept: boolean): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(eventId) || !isId(userId) || typeof accept !== "boolean") return { ok: false };
  const { error } = await session.supabase.rpc("answer_group_event_rejoin", { eid: eventId, uid: userId, accept });
  return { ok: !error };
}

export async function deleteGroupEvent(eventId: string): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(eventId)) return { ok: false };
  const { data, error } = await session.supabase.from("group_events").delete().eq("id", eventId).select("id");
  return { ok: !error && (data?.length ?? 0) > 0 };
}

// One event of a group, or null when it does not exist or I am not a member.
export async function loadGroupEvent(groupId: string, eventId: string): Promise<GroupEvent | null> {
  if (!isId(eventId)) return null;
  return (await loadGroupEvents(groupId)).find((event) => event.id === eventId) ?? null;
}

// Where a shared link (/e/<code>) points: the event's page, or null when there is no such event or I am not a
// member of its group (RLS).
export async function findSharedEvent(code: string): Promise<{ groupId: string; eventId: string } | null> {
  const session = await signedIn();
  if (!session || !/^[A-Za-z0-9]{6}$/.test(code)) return null;
  const { data } = await session.supabase.from("group_events").select("id, group_id").eq("share_code", code).maybeSingle();
  return data ? { groupId: data.group_id, eventId: data.id } : null;
}

// The event's creator (or the group owner) names a member as mordomo; the database checks both.
export async function chooseEventMordomo(eventId: string, userId: string): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(eventId) || !isId(userId)) return { ok: false };
  const { error } = await session.supabase.rpc("set_event_mordomo", { eid: eventId, uid: userId });
  return { ok: !error };
}

// The dice (event creator only): the database picks a random member (so nobody can cheat) and returns who.
export async function rollEventMordomo(eventId: string): Promise<Done & { mordomoId?: string }> {
  const session = await signedIn();
  if (!session || !isId(eventId)) return { ok: false };
  const { data, error } = await session.supabase.rpc("roll_event_mordomo", { eid: eventId });
  return error || typeof data !== "string" ? { ok: false } : { ok: true, mordomoId: data };
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const POLL_DAYS_MAX = 31;

// The mordomo opens the date poll with the days picked on the calendar (the database checks who and when).
export async function createDatePoll(eventId: string, days: unknown): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(eventId) || !Array.isArray(days)) return { ok: false };
  const picked = [...new Set(days)].filter((day): day is string => typeof day === "string" && DAY_RE.test(day));
  if (picked.length === 0 || picked.length > POLL_DAYS_MAX || picked.length !== days.length) return { ok: false };
  const { error } = await session.supabase.rpc("create_event_date_poll", { eid: eventId, days: picked });
  return { ok: !error };
}

// Submits the days that work for me (replacing my previous ones), while the poll is open.
export async function submitDateVotes(eventId: string, optionIds: unknown): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(eventId) || !Array.isArray(optionIds) || !optionIds.every(isId)) return { ok: false };
  const { supabase, me } = session;
  const { data: options, error: readError } = await supabase.from("group_event_date_options").select("id").eq("event_id", eventId);
  if (readError || !options?.length) return { ok: false };
  const all = options.map((option) => option.id as string);
  const chosen = [...new Set(optionIds)].filter((id) => all.includes(id));
  const unchosen = all.filter((id) => !chosen.includes(id));
  const votes = () => supabase.from("group_event_date_votes");
  if (unchosen.length) {
    const { error } = await votes().delete().eq("user_id", me).in("option_id", unchosen);
    if (error) return { ok: false };
  }
  if (chosen.length) {
    const { error } = await votes().upsert(
      chosen.map((option_id) => ({ option_id, user_id: me })),
      { ignoreDuplicates: true },
    );
    if (error) return { ok: false };
  }
  return { ok: true };
}

// The mordomo closes the poll: the chosen poll day becomes the event's date; optionally the location too.
export async function closeDatePoll(eventId: string, day: string, place?: unknown): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(eventId) || typeof day !== "string" || !DAY_RE.test(day)) return { ok: false };
  const { error } = await session.supabase.rpc("close_event_date_poll", { eid: eventId, chosen: day });
  if (error) return { ok: false };
  if (place == null) return { ok: true };
  const located = await setEventLocation(eventId, place);
  return located.ok ? { ok: true } : { ok: true, error: "A data ficou marcada, mas não foi possível guardar o local." };
}

// A place sent by the client (from the restaurant search), checked before it is stored.
function parsePlace(input: unknown): SelectedPlace | null {
  if (!input || typeof input !== "object") return null;
  const place = input as Record<string, unknown>;
  const { id, name, kind, lat, lng } = place;
  if (typeof id !== "string" || !id || id.length > 64) return null;
  if (typeof name !== "string" || !name.trim() || name.length > 120) return null;
  if (!isFoodClass(kind) || typeof lat !== "number" || typeof lng !== "number") return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { id, name: name.trim(), kind, lat, lng };
}

// The mordomo closes ("encerra") a dated event; the database checks who, and that a Preço certo was revealed.
export async function closeGroupEvent(eventId: string): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(eventId)) return { ok: false };
  const { error } = await session.supabase.rpc("close_group_event", { eid: eventId });
  return { ok: !error };
}

// "Preço certo": the mordomo opens (or reopens) the guesses, or closes them. The database checks who and when.
export async function setEventPriceGame(eventId: string, open: boolean): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(eventId) || typeof open !== "boolean") return { ok: false };
  const { error } = await session.supabase.rpc("set_event_price_game", { eid: eventId, open });
  return { ok: !error };
}

// "Preço certo": I guess the price per person (or change my guess) before the reveal. The database checks I am going.
export async function guessEventPrice(eventId: string, amount: unknown): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(eventId) || typeof amount !== "number" || !(amount > 0 && amount <= 10000)) return { ok: false };
  const { error } = await session.supabase.rpc("guess_event_price", { eid: eventId, guess: Math.round(amount * 100) / 100 });
  return { ok: !error };
}

// The mordomo reveals the bill (once, after closing the guesses): the total and how many people split it.
export async function revealEventBill(eventId: string, total: unknown, people: unknown): Promise<Done> {
  const session = await signedIn();
  if (
    !session ||
    !isId(eventId) ||
    typeof total !== "number" ||
    !(total > 0 && total <= 1000000) ||
    typeof people !== "number" ||
    !Number.isInteger(people) ||
    people < 1 ||
    people > 500
  )
    return { ok: false };
  const { error } = await session.supabase.rpc("reveal_event_bill", {
    eid: eventId,
    bill_total: Math.round(total * 100) / 100,
    bill_people: people,
  });
  return { ok: !error };
}

// The mordomo sets or changes the location (any restaurant; null clears it). The database checks who.
export async function setEventLocation(eventId: string, place: unknown): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(eventId)) return { ok: false };
  let restaurantId: string | null = null;
  if (place !== null) {
    const parsed = parsePlace(place);
    if (!parsed) return { ok: false };
    restaurantId = await restaurantIdFor(session.supabase, parsed);
    if (!restaurantId) return { ok: false };
  }
  const { error } = await session.supabase.rpc("set_event_location", { eid: eventId, rid: restaurantId });
  return { ok: !error };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// The mordomo sets, changes or clears (null) the start time ("HH:MM"). The database checks who, and that the
// event has a restaurant and is not closed.
export async function setEventStartTime(eventId: string, time: unknown): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(eventId)) return { ok: false };
  if (time !== null && (typeof time !== "string" || !TIME_RE.test(time))) return { ok: false };
  const { error } = await session.supabase.rpc("set_event_start_time", { eid: eventId, t: time });
  return { ok: !error };
}

// Someone going suggests a restaurant while there is no location (RLS checks it). Suggesting one already
// suggested is fine.
export async function suggestEventLocation(eventId: string, place: unknown): Promise<Done> {
  const session = await signedIn();
  const parsed = parsePlace(place);
  if (!session || !isId(eventId) || !parsed) return { ok: false };
  const restaurantId = await restaurantIdFor(session.supabase, parsed);
  if (!restaurantId) return { ok: false };
  const { error } = await session.supabase
    .from("group_event_location_suggestions")
    .insert({ event_id: eventId, restaurant_id: restaurantId, suggested_by: session.me });
  return { ok: !error || error.code === "23505" };
}

export async function withdrawLocationSuggestion(suggestionId: string): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(suggestionId)) return { ok: false };
  const { data, error } = await session.supabase
    .from("group_event_location_suggestions")
    .delete()
    .eq("id", suggestionId)
    .select("id");
  return { ok: !error && (data?.length ?? 0) > 0 };
}
