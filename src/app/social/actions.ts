"use server";

import { LIST_STATUSES, isListStatus, type ListStatus } from "@/lib/list/types";
import { customPlaceId, isFoodClass, parseKinds, type SelectedPlace } from "@/lib/map/restaurants";
import { PROFILE_COLUMNS, isId, signedIn, toPeople, type Person, type ProfileRow, type Supabase } from "@/lib/social/people";

// Mordomia Social: search people by username or name, send / accept / remove friend requests, friends feed.
// Privacy is in RLS: any signed-in user can read profiles; a user only sees friendships they are part of.

export type { Person };
export type Relation = "none" | "friends" | "sent" | "received";
export type FoundPerson = Person & { relation: Relation };
export type Friends = { friends: Person[]; received: Person[]; sent: Person[] };

const SEARCH_LIMIT = 20;
const QUERY_MAX = 40;

// My friendships, as the other person's id → relation.
async function relations(supabase: Supabase, me: string): Promise<Map<string, Relation>> {
  const { data } = await supabase.from("friendships").select("requester_id, addressee_id, status");
  const map = new Map<string, Relation>();
  for (const row of data ?? []) {
    const other = row.requester_id === me ? row.addressee_id : row.requester_id;
    map.set(other, row.status === "accepted" ? "friends" : row.requester_id === me ? "sent" : "received");
  }
  return map;
}

export async function loadFriends(): Promise<Friends> {
  const session = await signedIn();
  if (!session) return { friends: [], received: [], sent: [] };
  const { supabase, me } = session;
  const map = await relations(supabase, me);
  if (map.size === 0) return { friends: [], received: [], sent: [] };
  const { data } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .in("id", [...map.keys()])
    .order("display_name");
  const people = await toPeople(supabase, (data ?? []) as ProfileRow[]);
  return {
    friends: people.filter((person) => map.get(person.id) === "friends"),
    received: people.filter((person) => map.get(person.id) === "received"),
    sent: people.filter((person) => map.get(person.id) === "sent"),
  };
}

// Escapes LIKE wildcards so the query is matched literally.
function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

// People whose username or name contains the query (case-insensitive), except me.
export async function searchPeople(query: string): Promise<FoundPerson[]> {
  const session = await signedIn();
  const q = typeof query === "string" ? query.trim().replace(/^@/, "").slice(0, QUERY_MAX) : "";
  if (!session || q.length < 2) return [];
  const { supabase, me } = session;
  const pattern = likePattern(q);
    const [byUsername, byName, map] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).ilike("username", pattern).neq("id", me).limit(SEARCH_LIMIT),
    supabase.from("profiles").select(PROFILE_COLUMNS).ilike("display_name", pattern).neq("id", me).limit(SEARCH_LIMIT),
    relations(supabase, me),
  ]);
  const rows = new Map<string, ProfileRow>();
  for (const row of [...(byUsername.data ?? []), ...(byName.data ?? [])] as ProfileRow[]) rows.set(row.id, row);
  // Usernames that start with the query first, then the rest by name.
  const lower = q.toLowerCase();
  const sorted = [...rows.values()]
    .sort(
      (a, b) =>
        Number(!a.username.startsWith(lower)) - Number(!b.username.startsWith(lower)) ||
        a.display_name.localeCompare(b.display_name, "pt"),
    )
    .slice(0, SEARCH_LIMIT);
  const people = await toPeople(supabase, sorted);
  return people.map((person) => ({ ...person, relation: map.get(person.id) ?? "none" }));
}

type Done = { ok: boolean };

// Sends a friend request; if they already asked me, accepts theirs instead.
export async function sendFriendRequest(personId: string): Promise<Done & { relation?: Relation }> {
  const session = await signedIn();
  if (!session || !isId(personId) || personId === session.me) return { ok: false };
  const { supabase, me } = session;
  const current = (await relations(supabase, me)).get(personId);
  if (current === "received") return { ...(await acceptFriendRequest(personId)), relation: "friends" };
  if (current) return { ok: true, relation: current };
  const { error } = await supabase.from("friendships").insert({ addressee_id: personId });
  return { ok: !error, relation: "sent" };
}

export async function acceptFriendRequest(personId: string): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(personId)) return { ok: false };
  const { supabase, me } = session;
  const { data, error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("requester_id", personId)
    .eq("addressee_id", me)
    .eq("status", "pending")
    .select("requester_id");
  return { ok: !error && (data?.length ?? 0) > 0 };
}

// Declines a request I received, cancels one I sent, or removes a friend.
export async function removeFriendship(personId: string): Promise<Done> {
  const session = await signedIn();
  if (!session || !isId(personId)) return { ok: false };
  const { supabase, me } = session;
  const { error } = await supabase
    .from("friendships")
    .delete()
    .or(`and(requester_id.eq.${me},addressee_id.eq.${personId}),and(requester_id.eq.${personId},addressee_id.eq.${me})`);
  return { ok: !error };
}

export type FeedItem = {
  id: string;
  person: Person;
  status: ListStatus;
  rating: number | null;
  notes: string | null;
  // When it was added or last changed (moving from Quero ir! to Minha lista counts as new).
  at: string;
  place: SelectedPlace;
};

const FEED_LIMIT = 50;

type FeedRow = {
  id: string;
  user_id: string;
  status: string;
  rating: number | null;
  notes: string | null;
  updated_at: string;
  restaurants: {
    id: string;
    osm_id: string | null;
    user_added: boolean;
    name: string;
    kind: string | null;
    kinds: string[] | null;
    lat: number | null;
    lng: number | null;
  } | null;
};

// Friends' latest additions to their two lists, newest first. RLS only lets friends read these entries.
export async function loadFeed(): Promise<FeedItem[]> {
  const session = await signedIn();
  if (!session) return [];
  const { supabase, me } = session;
  const map = await relations(supabase, me);
  const friendIds = [...map].filter(([, relation]) => relation === "friends").map(([id]) => id);
  if (friendIds.length === 0) return [];

  const [{ data: entries }, { data: profiles }] = await Promise.all([
    supabase
      .from("entries")
      .select("id, user_id, status, rating, notes, updated_at, restaurants(id, osm_id, user_added, name, kind, kinds, lat, lng)")
      .in("user_id", friendIds)
      .in("status", [...LIST_STATUSES])
      .order("updated_at", { ascending: false })
      .limit(FEED_LIMIT),
    supabase.from("profiles").select(PROFILE_COLUMNS).in("id", friendIds),
  ]);
  const people = new Map((await toPeople(supabase, (profiles ?? []) as ProfileRow[])).map((person) => [person.id, person]));

  return ((entries ?? []) as unknown as FeedRow[]).flatMap((row) => {
    const r = row.restaurants;
    const person = people.get(row.user_id);
    const placeId = r?.osm_id ?? (r?.user_added ? customPlaceId(r.id) : null);
    if (!r || !person || !placeId || r.lat == null || r.lng == null || !isListStatus(row.status)) return [];
    return [
      {
        id: row.id,
        person,
        status: row.status,
        rating: row.rating,
        notes: row.notes,
        at: row.updated_at,
        place: {
          id: placeId,
          name: r.name,
          kind: isFoodClass(r.kind) ? r.kind : "restaurant",
          kinds: parseKinds(r.kinds) ?? undefined,
          lat: r.lat,
          lng: r.lng,
        },
      },
    ];
  });
}

export type SocialPulse = { requests: number; invites: number; feedTimes: string[] };

// For the map's social button: friend requests and group invites received, and when friends last added to their
// lists (newest first). The client compares those times with when the Feed was last seen on this device.
export async function loadSocialPulse(): Promise<SocialPulse> {
  const session = await signedIn();
  if (!session) return { requests: 0, invites: 0, feedTimes: [] };
  const { supabase, me } = session;
  const [map, { count }] = await Promise.all([
    relations(supabase, me),
    supabase
      .from("group_members")
      .select("group_id", { count: "exact", head: true })
      .eq("user_id", me)
      .eq("status", "invited"),
  ]);
  const requests = [...map.values()].filter((relation) => relation === "received").length;
  const invites = count ?? 0;
  const friendIds = [...map].filter(([, relation]) => relation === "friends").map(([id]) => id);
  if (friendIds.length === 0) return { requests, invites, feedTimes: [] };
  const { data } = await supabase
    .from("entries")
    .select("updated_at")
    .in("user_id", friendIds)
    .in("status", [...LIST_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(FEED_LIMIT);
  return { requests, invites, feedTimes: (data ?? []).map((row) => row.updated_at as string) };
}
