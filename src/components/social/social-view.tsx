"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  acceptFriendRequest,
  loadFriends,
  removeFriendship,
  searchPeople,
  sendFriendRequest,
  type FeedItem,
  type FoundPerson,
  type Friends,
  type Person,
  type Relation,
} from "@/app/social/actions";
import { refreshNav } from "@/components/app-nav";
import { FeedSave } from "./feed-save";
import { ProfileLink } from "./profile-link";
import { RemoveFriendSheet } from "./remove-friend-sheet";
import { avatarInitial } from "@/lib/profile/avatar";
import { kindEmoji } from "@/lib/map/restaurants";
import { ratingColor } from "@/lib/list/rating-color";
import type { ListStatus } from "@/lib/list/types";
import { countNew, markFeedSeen, readFeedSeen, subscribeNothing } from "@/lib/social/seen";
import { MagnifierIcon } from "@/components/home/search-modal";
import { GroupsTab } from "@/components/social/groups-tab";
import type { Group } from "@/app/social/groups";

const DEBOUNCE_MS = 300;

export type SocialTab = "procurar" | "grupos" | "feed";
const TABS: SocialTab[] = ["procurar", "grupos", "feed"];

// ?tab=… → tab; the Feed when missing or unknown.
export function parseTab(value: string | null | undefined): SocialTab {
  return TABS.includes(value as SocialTab) ? (value as SocialTab) : "feed";
}

type Props = {
  userId: string;
  initialFriends: Friends;
  initialGroups: Group[];
  feed: FeedItem[];
  // Which of my lists each place is on (by place id).
  myLists: Record<string, ListStatus>;
};

// "Mordomia Social" (/social): Procurar (find friends, answer requests), Grupos (my groups and invites) and Feed
// (friends' latest additions to their lists). The tabs are in the app's bottom bar (AppNav).
export function SocialView({ userId, initialFriends, initialGroups, feed, myLists: initialMyLists }: Props) {
  // The tab lives in the address (?tab=…), so a refresh, reload or coming back (e.g. from Perfil) stays on it.
  const tab = parseTab(useSearchParams().get("tab"));
  function setTab(next: SocialTab) {
    window.history.replaceState(null, "", next === "feed" ? "/social" : `/social?tab=${next}`);
  }
  const [friends, setFriends] = useState<Friends>(initialFriends);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [myLists, setMyLists] = useState(initialMyLists);
  const count = friends.friends.length;
  // When the Feed was last seen on this device (read on every render, so it updates after leaving the Feed).
  const seen = useSyncExternalStore(subscribeNothing, readFeedSeen, () => null);

  // Requests answered or invites accepted here change the bottom bar's badges.
  const changed = useRef(false);
  useEffect(() => {
    if (changed.current) refreshNav();
    changed.current = true;
  }, [friends, groups]);

  // The Feed counts as seen once the user leaves it (other tab, back to the map, app closed), so its "Novo"
  // tags stay visible while reading.
  useEffect(() => {
    const newest = feed[0]?.at;
    if (tab !== "feed" || !newest) return;
    const mark = () => markFeedSeen(newest);
    window.addEventListener("pagehide", mark);
    return () => {
      window.removeEventListener("pagehide", mark);
      mark();
    };
  }, [tab, feed]);

  return (
    <main className="flex min-h-dvh flex-col bg-neutral-50">
      {/* Warm like the login and the splash; frosted while the list scrolls under it. */}
      <header className="sticky top-0 z-10 border-b border-orange-100/80 bg-gradient-to-b from-orange-100/95 to-orange-50/90 px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Voltar ao mapa"
            className="-ml-1 flex size-10 items-center justify-center rounded-full text-foreground hover:bg-white/60"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight">Mordomia Social</h1>
            <p className="mt-0.5 w-fit rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-orange-800 ring-1 ring-orange-200/70">
              👥 {count === 1 ? "1 amigo" : `${count} amigos`}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        {tab === "procurar" && <FriendsTab friends={friends} onFriends={setFriends} />}
        {tab === "feed" && (
          <FeedTab
            items={feed}
            seen={seen}
            hasFriends={count > 0}
            onFindFriends={() => setTab("procurar")}
            myLists={myLists}
            onSaved={(placeId, status) => setMyLists((lists) => ({ ...lists, [placeId]: status }))}
          />
        )}
        {tab === "grupos" && (
          <GroupsTab
            userId={userId}
            groups={groups}
            onGroups={setGroups}
            friends={friends.friends}
            onFindFriends={() => setTab("procurar")}
          />
        )}
      </div>

    </main>
  );
}

// Procurar: search people, requests received / sent, my friends.
function FriendsTab({ friends, onFriends }: { friends: Friends; onFriends: (next: Friends) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoundPerson[] | null>(null);
  const [searching, setSearching] = useState(false);
  // The person whose button is busy.
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    onFriends(await loadFriends());
  }

  const q = query.trim();
  useEffect(() => {
    if (q.replace(/^@/, "").length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const found = await searchPeople(q).catch(() => null);
      if (cancelled) return;
      setSearching(false);
      setResults(found);
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  async function act(person: Person, action: "add" | "accept" | "remove") {
    setBusy(person.id);
    setError(null);
    let ok: boolean;
    let relation: Relation;
    if (action === "add") {
      const result = await sendFriendRequest(person.id);
      ok = result.ok;
      relation = result.relation ?? "sent";
    } else {
      ok = (action === "accept" ? await acceptFriendRequest(person.id) : await removeFriendship(person.id)).ok;
      relation = action === "accept" ? "friends" : "none";
    }
    setBusy(null);
    if (!ok) {
      setError("Não foi possível. Tenta outra vez.");
      return;
    }
    setResults((current) => current?.map((other) => (other.id === person.id ? { ...other, relation } : other)) ?? null);
    await refresh();
  }

  const tooShort = q.replace(/^@/, "").length < 2;

  return (
    <>
      <div className="group mb-5 flex h-12 items-center gap-2.5 rounded-2xl bg-white px-4 shadow-sm ring-1 ring-black/5 transition focus-within:shadow-md focus-within:ring-2 focus-within:ring-accent/50">
        <MagnifierIcon className="size-5 shrink-0 text-neutral-400 transition group-focus-within:text-accent" />
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="none"
          aria-label="Procurar pessoas"
          placeholder="Procurar por nome ou @utilizador"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setResults(null);
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        {query && (
          <button
            type="button"
            aria-label="Limpar pesquisa"
            onClick={() => {
              setQuery("");
              setResults(null);
            }}
            className="-mr-1 flex size-7 items-center justify-center rounded-full bg-neutral-100 text-xs leading-none text-neutral-500 hover:bg-neutral-200"
          >
            ✕
          </button>
        )}
      </div>

      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {q && tooShort ? (
        <p className="px-1 text-sm text-neutral-500">Escreve pelo menos 2 letras.</p>
      ) : q ? (
        results === null || searching ? (
          <SearchSkeleton />
        ) : results.length === 0 ? (
          <Empty emoji="🔎" title={`Ninguém encontrado com “${q}”`}>
            Confirma o nome ou experimenta o @utilizador.
          </Empty>
        ) : (
          <PeopleList>
            {results.map((person) => (
              <PersonRow key={person.id} person={person} query={q}>
                <RelationActions person={person} relation={person.relation} busy={busy === person.id} onAct={act} />
              </PersonRow>
            ))}
          </PeopleList>
        )
      ) : (
        <div className="flex flex-col gap-6">
          {friends.received.length > 0 && (
            <Section title="Pedidos recebidos">
              {friends.received.map((person) => (
                <PersonRow key={person.id} person={person}>
                  <RelationActions person={person} relation="received" busy={busy === person.id} onAct={act} />
                </PersonRow>
              ))}
            </Section>
          )}
          <Section title="Os meus amigos">
            {friends.friends.length === 0 ? (
              <p className="px-4 py-4 text-sm text-neutral-500">
                Ainda não tens amigos aqui. Procura-os pelo nome ou pelo @utilizador.
              </p>
            ) : (
              friends.friends.map((person) => (
                <PersonRow key={person.id} person={person}>
                  <RelationActions person={person} relation="friends" busy={busy === person.id} onAct={act} />
                </PersonRow>
              ))
            )}
          </Section>
          {friends.sent.length > 0 && (
            <Section title="Pedidos enviados">
              {friends.sent.map((person) => (
                <PersonRow key={person.id} person={person}>
                  <RelationActions person={person} relation="sent" busy={busy === person.id} onAct={act} />
                </PersonRow>
              ))}
            </Section>
          )}
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-bold tracking-wide text-neutral-400 uppercase">{title}</h2>
      <PeopleList>{children}</PeopleList>
    </section>
  );
}

function PeopleList({ children }: { children: React.ReactNode }) {
  return <ul className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">{children}</ul>;
}

function PersonRow({ person, query, children }: { person: Person; query?: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 transition last:border-0 hover:bg-orange-50/40 motion-safe:animate-[fade-in_200ms_ease-out]">
      <ProfileLink person={person} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar person={person} className="size-11 text-base shadow-sm ring-2 ring-white" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            <Highlight text={person.displayName} query={query} />
          </span>
          <span className="block truncate text-sm text-neutral-500">
            @<Highlight text={person.username} query={query?.replace(/^@/, "")} />
          </span>
        </span>
      </ProfileLink>
      {children}
    </li>
  );
}

// The part of the text that matches the search, in bold accent (ignoring case and accents, like the search).
function Highlight({ text, query }: { text: string; query?: string }) {
  const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const needle = query ? fold(query) : "";
  // Fold char by char so positions in the folded text match the original.
  const folded = [...text].map((char) => fold(char) || char).join("");
  const at = needle && folded.length === text.length ? folded.indexOf(needle) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-bold text-accent">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

// While the search runs: placeholder rows shaped like the results.
function SearchSkeleton() {
  return (
    <ul aria-label="A procurar…" className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      {[0, 1, 2].map((row) => (
        <li key={row} className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-0">
          <span className="size-11 shrink-0 animate-pulse rounded-full bg-neutral-200" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3.5 w-2/5 animate-pulse rounded-full bg-neutral-200" />
            <span className="h-3 w-1/4 animate-pulse rounded-full bg-neutral-100" />
          </span>
          <span className="h-9 w-24 animate-pulse rounded-full bg-neutral-100" />
        </li>
      ))}
    </ul>
  );
}

type ActionsProps = {
  person: Person;
  relation: Relation;
  busy: boolean;
  onAct: (person: Person, action: "add" | "accept" | "remove") => Promise<void>;
};

function RelationActions({ person, relation, busy, onAct }: ActionsProps) {
  const [confirming, setConfirming] = useState(false);
  const primary = "h-9 rounded-full bg-accent px-4 text-sm font-semibold text-white shadow disabled:opacity-50";
  const secondary = "h-9 rounded-full bg-neutral-100 px-3 text-sm font-semibold text-neutral-700 disabled:opacity-50";
  if (relation === "received") {
    return (
      <span className="flex shrink-0 gap-2">
        <button type="button" disabled={busy} onClick={() => onAct(person, "remove")} className={secondary}>
          Recusar
        </button>
        <button type="button" disabled={busy} onClick={() => onAct(person, "accept")} className={primary}>
          Aceitar
        </button>
      </span>
    );
  }
  if (relation === "sent") {
    return (
      <button type="button" disabled={busy} onClick={() => onAct(person, "remove")} className={secondary}>
        Cancelar pedido
      </button>
    );
  }
  if (relation === "friends") {
    return (
      <>
        <button type="button" disabled={busy} onClick={() => setConfirming(true)} className={secondary}>
          Amigos ✓
        </button>
        {confirming && (
          <RemoveFriendSheet person={person} onConfirm={() => onAct(person, "remove")} onClose={() => setConfirming(false)} />
        )}
      </>
    );
  }
  return (
    <button type="button" disabled={busy} onClick={() => onAct(person, "add")} className={primary}>
      {busy ? "…" : "Adicionar"}
    </button>
  );
}

function Empty({ emoji, title, children }: { emoji: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-2 px-6 text-center">
      <span aria-hidden="true" className="text-5xl">
        {emoji}
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-neutral-500">{children}</p>
    </div>
  );
}

const TIME = new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" });

// "há 5 minutos", "ontem", "há 3 semanas"…
function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) if (Math.abs(seconds) >= size) return TIME.format(Math.round(seconds / size), unit);
  return "agora mesmo";
}

// Feed: friends' latest additions to their lists, newest first.
type FeedProps = {
  items: FeedItem[];
  seen: string | null;
  hasFriends: boolean;
  onFindFriends: () => void;
  myLists: Record<string, ListStatus>;
  onSaved: (placeId: string, status: ListStatus) => void;
};

function FeedTab({ items, seen, hasFriends, onFindFriends, myLists, onSaved }: FeedProps) {
  if (items.length === 0) {
    return (
      <Empty emoji={hasFriends ? "🍽️" : "👋"} title={hasFriends ? "Ainda nada por aqui" : "Junta os teus amigos"}>
        {hasFriends ? (
          "Quando os teus amigos adicionarem restaurantes às listas deles, aparecem aqui."
        ) : (
          <>
            Adiciona amigos para veres onde eles comem.{" "}
            <button type="button" onClick={onFindFriends} className="font-semibold text-accent">
              Procurar amigos
            </button>
          </>
        )}
      </Empty>
    );
  }
  // Consecutive items from the same person are shown together, like messages in a conversation: one avatar
  // and name, then a bubble per restaurant.
  const runs: FeedItem[][] = [];
  for (const item of items) {
    const last = runs.at(-1);
    if (last && last[0].person.id === item.person.id) last.push(item);
    else runs.push([item]);
  }
  let index = 0;
  return (
    <ul className="flex flex-col gap-6">
      {runs.map((run) => (
        <li key={run[0].id}>
          <ProfileLink person={run[0].person} className="group mb-2.5 flex w-fit items-center gap-2.5">
            <Avatar person={run[0].person} className="size-10 shadow-sm ring-2 ring-white" />
            <span className="truncate text-[15px] font-bold group-hover:text-accent">{run[0].person.displayName}</span>
          </ProfileLink>
          <ul className="flex flex-col gap-2">
            {run.map((item) => {
              const isNew = countNew([item.at], seen) > 0;
              const went = item.status === "saved";
              const delay = Math.min(index++, 8) * 50;
              return (
                <li
                  key={item.id}
                  style={{ animationDelay: `${delay}ms` }}
                  className={`flex gap-3 rounded-2xl bg-white p-3 shadow-[0_1px_3px_rgb(0_0_0/0.06),0_6px_16px_-8px_rgb(124_45_18/0.12)] ring-1 motion-safe:animate-[fork-pop_260ms_ease-out_both] ${
                    isNew ? "ring-2 ring-accent/50" : "ring-black/5"
                  }`}
                >
                  {/* The kind of place on a tile tinted by the list it is on. */}
                  <span
                    aria-hidden="true"
                    className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl ${
                      went ? "bg-gradient-to-br from-orange-100 to-amber-50" : "bg-gradient-to-br from-violet-100 to-fuchsia-50"
                    }`}
                  >
                    {kindEmoji(item.place.kind)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-base leading-tight font-bold">{item.place.name}</span>
                      {isNew && (
                        <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white motion-safe:animate-[badge-pop_350ms_ease-out_both]">
                          Novo
                        </span>
                      )}
                      <FeedSave place={item.place} mine={myLists[item.place.id]} onSaved={(status) => onSaved(item.place.id, status)} />
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                      <span
                        className={`rounded-full px-2 py-0.5 font-semibold ${went ? "bg-orange-50 text-accent" : "bg-violet-50 text-violet-700"}`}
                      >
                        {went ? "⭐ Já foi" : "🤤 Quer ir"}
                      </span>
                      {went && item.rating !== null && (
                        <span
                          style={{ backgroundColor: ratingColor(item.rating) }}
                          className="rounded-full px-2 py-0.5 text-xs font-extrabold text-white tabular-nums shadow-sm"
                        >
                          {item.rating}/10
                        </span>
                      )}
                      <time dateTime={item.at} className="ml-0.5">
                        {timeAgo(item.at)}
                      </time>
                    </p>
                    {item.notes && (
                      <p
                        className={`mt-2 line-clamp-3 border-l-2 pl-2.5 text-[13px] leading-snug whitespace-pre-line text-neutral-700 ${
                          went ? "border-orange-300" : "border-violet-300"
                        }`}
                      >
                        {item.notes}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}


function Avatar({ person, className = "size-9" }: { person: Person; className?: string }) {
  return (
    <span className={`flex ${className} shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-white`}>
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
        <img src={person.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        avatarInitial(person.username)
      )}
    </span>
  );
}
