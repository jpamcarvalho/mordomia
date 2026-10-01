"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
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
import { avatarInitial } from "@/lib/profile/avatar";
import { kindEmoji } from "@/lib/map/restaurants";
import { badgeText, countNew, markFeedSeen, readFeedSeen, subscribeNothing } from "@/lib/social/seen";
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
  username: string | null;
  avatarUrl: string | null;
};

// "Mordomia Social" (/social): a bottom bar with Procurar (find friends, answer requests), Grupos (my groups and
// invites), Feed (friends' latest additions to their lists) and the avatar (account page).
export function SocialView({ userId, initialFriends, initialGroups, feed, username, avatarUrl }: Props) {
  // The tab lives in the address (?tab=…), so a refresh, reload or coming back (e.g. from Perfil) stays on it.
  const tab = parseTab(useSearchParams().get("tab"));
  function setTab(next: SocialTab) {
    window.history.replaceState(null, "", next === "feed" ? "/social" : `/social?tab=${next}`);
  }
  const [friends, setFriends] = useState<Friends>(initialFriends);
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const invites = groups.filter((group) => group.myStatus === "invited").length;
  const count = friends.friends.length;
  // When the Feed was last seen on this device (read on every render, so it updates after leaving the Feed).
  const seen = useSyncExternalStore(subscribeNothing, readFeedSeen, () => null);
  const newFeed = countNew(
    feed.map((item) => item.at),
    seen,
  );

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
      <header className="sticky top-0 z-10 bg-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            aria-label="Voltar ao mapa"
            className="-ml-1 flex size-10 items-center justify-center rounded-full text-foreground hover:bg-neutral-100"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Mordomia Social</h1>
            <p className="text-sm text-neutral-500">{count === 1 ? "1 amigo" : `${count} amigos`}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        {tab === "procurar" && <FriendsTab friends={friends} onFriends={setFriends} />}
        {tab === "feed" && (
          <FeedTab items={feed} seen={seen} hasFriends={count > 0} onFindFriends={() => setTab("procurar")} />
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

      <BottomBar
        tab={tab}
        onTab={setTab}
        requests={friends.received.length}
        invites={invites}
        newFeed={newFeed}
        username={username}
        avatarUrl={avatarUrl}
      />
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
      <div className="mb-4 flex h-11 items-center gap-2 rounded-full bg-neutral-100 px-4 focus-within:ring-2 focus-within:ring-accent/40">
        <MagnifierIcon className="size-5 shrink-0 text-neutral-500" />
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
            className="-mr-1 flex size-7 items-center justify-center rounded-full leading-none text-neutral-500 hover:bg-neutral-200"
          >
            ✕
          </button>
        )}
      </div>

      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {q && tooShort ? (
        <p className="text-sm text-neutral-500">Escreve pelo menos 2 letras.</p>
      ) : q ? (
        results === null || searching ? (
          <p className="text-sm text-neutral-500">A procurar…</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-neutral-600">Ninguém encontrado com “{q}”.</p>
        ) : (
          <PeopleList>
            {results.map((person) => (
              <PersonRow key={person.id} person={person}>
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
      <h2 className="mb-2 px-1 text-sm font-semibold text-neutral-500">{title}</h2>
      <PeopleList>{children}</PeopleList>
    </section>
  );
}

function PeopleList({ children }: { children: React.ReactNode }) {
  return <ul className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">{children}</ul>;
}

function PersonRow({ person, children }: { person: Person; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 last:border-0">
      <span className="mt-5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-white">
        {person.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
          <img src={person.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          avatarInitial(person.username)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{person.displayName}</span>
        <span className="block truncate text-sm text-neutral-500">@{person.username}</span>
      </span>
      {children}
    </li>
  );
}

type ActionsProps = {
  person: Person;
  relation: Relation;
  busy: boolean;
  onAct: (person: Person, action: "add" | "accept" | "remove") => void;
};

function RelationActions({ person, relation, busy, onAct }: ActionsProps) {
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
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm(`Remover ${person.displayName} dos teus amigos?`)) onAct(person, "remove");
        }}
        className={secondary}
      >
        Amigos ✓
      </button>
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
type FeedProps = { items: FeedItem[]; seen: string | null; hasFriends: boolean; onFindFriends: () => void };

function FeedTab({ items, seen, hasFriends, onFindFriends }: FeedProps) {
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
    <ul className="flex flex-col gap-4">
      {runs.map((run) => (
        <li key={run[0].id} className="flex items-start gap-2.5">
          <Avatar person={run[0].person} />
          <div className="min-w-0 flex-1">
            <p className="mb-1 ml-1 text-xs font-semibold text-neutral-500">{run[0].person.displayName}</p>
            <ul className="flex flex-col gap-1.5">
              {run.map((item, position) => {
                const isNew = countNew([item.at], seen) > 0;
                const delay = Math.min(index++, 8) * 50;
                return (
                  <li
                    key={item.id}
                    style={{ animationDelay: `${delay}ms` }}
                    className={`relative rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 motion-safe:animate-[fork-pop_260ms_ease-out_both] ${
                      position === 0 ? "rounded-tl-md" : ""
                    } ${isNew ? "ring-2 ring-accent/50" : "ring-black/5"}`}
                  >
                    <p className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                        <span aria-hidden="true">{kindEmoji(item.place.kind)} </span>
                        {item.place.name}
                      </span>
                      {isNew && (
                        <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white motion-safe:animate-[badge-pop_350ms_ease-out_both]">
                          Novo
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-neutral-500">
                      <span className={item.status === "saved" ? "font-semibold text-accent" : "font-semibold text-violet-600"}>
                        {item.status === "saved" ? "⭐ Já foi" : "🤤 Quer ir"}
                      </span>
                      {item.status === "saved" && item.rating !== null && <span className="font-semibold text-foreground">{item.rating}/10</span>}
                      <span aria-hidden="true">·</span>
                      <time dateTime={item.at}>{timeAgo(item.at)}</time>
                    </p>
                    {item.notes && (
                      <p className="mt-1.5 line-clamp-3 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-[13px] whitespace-pre-line text-neutral-700">
                        {item.notes}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Avatar({ person }: { person: Person }) {
  return (
    <span className="mt-5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-sm font-semibold text-white">
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
        <img src={person.avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        avatarInitial(person.username)
      )}
    </span>
  );
}

type BarProps = {
  tab: SocialTab;
  onTab: (tab: SocialTab) => void;
  requests: number;
  // Group invites not answered yet.
  invites: number;
  // Feed items not seen on this device yet.
  newFeed: number;
  username: string | null;
  avatarUrl: string | null;
};

// Bottom bar: Procurar, Grupos, Feed, and the avatar (account page).
function BottomBar({ tab, onTab, requests, invites, newFeed, username, avatarUrl }: BarProps) {
  const item = "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold";
  const tabs: { id: SocialTab; label: string; icon: React.ReactNode }[] = [
    { id: "procurar", label: "Procurar", icon: <MagnifierIcon className="size-6" /> },
    { id: "grupos", label: "Grupos", icon: <GroupIcon /> },
    { id: "feed", label: "Feed", icon: <FeedIcon /> },
  ];
  const badges: Record<SocialTab, number> = {
    procurar: requests,
    grupos: invites,
    feed: tab === "feed" ? 0 : newFeed,
  };
  return (
    <nav
      aria-label="Mordomia Social"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-md">
        {tabs.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? "page" : undefined}
            onClick={() => onTab(id)}
            className={`${item} ${tab === id ? "text-accent" : "text-neutral-500"}`}
          >
            {icon}
            {label}
            {/* No feed badge while on the Feed: it is being read. */}
            {badges[id] > 0 && (
              <span className="absolute top-1 left-1/2 ml-2 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ring-2 ring-white motion-safe:animate-[badge-pop_350ms_ease-out_both]">
                {badgeText(badges[id])}
              </span>
            )}
          </button>
        ))}
        <Link href="/account" className={`${item} text-neutral-500`}>
          <span className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-accent text-xs font-semibold text-white">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              avatarInitial(username)
            )}
          </span>
          Perfil
        </Link>
      </div>
    </nav>
  );
}

function GroupIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <circle cx="12" cy="8" r="3" />
      <path d="M6.5 20a5.5 5.5 0 0 1 11 0" />
      <circle cx="5" cy="10" r="2.2" />
      <path d="M1.5 18a3.5 3.5 0 0 1 4.2-3.4" />
      <circle cx="19" cy="10" r="2.2" />
      <path d="M22.5 18a3.5 3.5 0 0 0-4.2-3.4" />
    </svg>
  );
}

function FeedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h5" />
    </svg>
  );
}
