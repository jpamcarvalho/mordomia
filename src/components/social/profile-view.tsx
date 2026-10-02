"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptFriendRequest, removeFriendship, sendFriendRequest, type Relation } from "@/app/social/actions";
import { ENTER, delay } from "@/components/account/account-view";
import { ratingColor } from "@/lib/list/rating-color";
import type { ListItem, ListStatus } from "@/lib/list/types";
import { mapHref } from "@/lib/map/place-link";
import { kindEmoji, kindsLabel, placeKinds } from "@/lib/map/restaurants";
import { levelFor } from "@/lib/profile/account";
import { avatarInitial } from "@/lib/profile/avatar";
import type { Person } from "@/lib/social/people";
import { PersonAvatar, Sheet, SheetHeader } from "./groups-tab";
import { ProfileLink } from "./profile-link";
import { RemoveFriendSheet } from "./remove-friend-sheet";

type Props = {
  person: Person;
  bio: string | null;
  memberSince: string | null;
  friendCount: number | null;
  relation: Relation;
  // Only for friends: RLS hides the lists from everyone else.
  list: ListItem[] | null;
  friendList: Person[] | null;
  // The signed-in user, marked "(tu)" in the friends list.
  me: string;
};

// Someone else's profile: photo, name, friends count and my friendship with them, their bio and (friends only)
// their restaurants.
export function ProfileView({ person, bio, memberSince, friendCount, relation, list, friendList, me }: Props) {
  const router = useRouter();
  const [showFriends, setShowFriends] = useState(false);
  const firstName = person.displayName.split(" ")[0];
  const since = memberSince
    ? new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(new Date(memberSince))
    : null;

  return (
    <main className="min-h-dvh bg-gradient-to-b from-orange-100 via-orange-50/40 to-white pb-[calc(env(safe-area-inset-bottom)+6rem)]">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/social"))}
          className="flex w-fit items-center gap-1 rounded-full bg-white/80 px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm backdrop-blur active:scale-95"
        >
          <span aria-hidden="true">←</span> Voltar
        </button>

        <section style={delay(0)} className={`flex flex-col items-center text-center ${ENTER}`}>
          <span className="flex size-32 items-center justify-center overflow-hidden rounded-full bg-accent text-5xl font-bold text-white shadow-lg ring-4 ring-white">
            {person.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
              <img src={person.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              avatarInitial(person.username)
            )}
          </span>
          <h1 className="mt-4 text-2xl font-bold">{person.displayName}</h1>
          <p className="text-neutral-500">@{person.username}</p>
          {list && <LevelBadge went={list.filter((item) => item.status === "saved").length} />}
          {since && <p className="mt-1 text-xs text-neutral-400">No Mordomia desde {since}</p>}
          {friendCount !== null &&
            (friendList ? (
              <button
                type="button"
                onClick={() => setShowFriends(true)}
                className="mt-3 rounded-full bg-white/80 px-4 py-1.5 text-sm shadow-sm transition hover:bg-white active:scale-95"
              >
                <FriendCount count={friendCount} />
                <span aria-hidden="true" className="ml-1 text-neutral-400">
                  ›
                </span>
              </button>
            ) : (
              <p className="mt-3 rounded-full bg-white/80 px-4 py-1.5 text-sm shadow-sm">
                <FriendCount count={friendCount} />
              </p>
            ))}
          <FriendButton person={person} relation={relation} />
        </section>

        <section style={delay(80)} className={`rounded-3xl bg-white p-5 shadow-sm ${ENTER}`}>
          <h2 className="font-semibold">💬 Sobre {firstName}</h2>
          {bio ? (
            <p className="mt-2 whitespace-pre-line text-neutral-700">{bio}</p>
          ) : (
            <p className="mt-2 text-sm text-neutral-400">Ainda não escreveu nada sobre si.</p>
          )}
        </section>

        {list ? (
          <ProfileLists items={list} firstName={firstName} style={delay(160)} />
        ) : (
          <section style={delay(160)} className={`flex flex-col items-center gap-1 rounded-3xl bg-white p-6 text-center shadow-sm ${ENTER}`}>
            <span aria-hidden="true" className="text-4xl">
              🔒
            </span>
            <h2 className="font-semibold">Só para amigos</h2>
            <p className="text-sm text-neutral-500">
              Quando forem amigos, vês os restaurantes e os amigos de {firstName}.
            </p>
          </section>
        )}
      </div>

      {showFriends && friendList && (
        <Sheet label={`Amigos de ${firstName}`} onClose={() => setShowFriends(false)}>
          <SheetHeader title={`Amigos de ${firstName}`} onClose={() => setShowFriends(false)} />
          {friendList.length === 0 ? (
            <p className="text-sm text-neutral-500">{firstName} ainda não tem amigos aqui.</p>
          ) : (
            <ul className="overflow-hidden rounded-2xl ring-1 ring-neutral-200">
              {friendList.map((friend) => (
                <li key={friend.id} className="border-b border-neutral-100 last:border-0">
                  <ProfileLink person={friend} className="flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50">
                    <PersonAvatar person={friend} className="size-10 text-sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {friend.displayName}
                        {friend.id === me && <span className="font-normal text-neutral-400"> (tu)</span>}
                      </span>
                      <span className="block truncate text-xs text-neutral-500">@{friend.username}</span>
                    </span>
                    <span aria-hidden="true" className="text-neutral-300">
                      ›
                    </span>
                  </ProfileLink>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      )}
    </main>
  );
}

// The friend's level (by places they have been to) as one small pill under their name.
function LevelBadge({ went }: { went: number }) {
  const level = levelFor(went);
  return (
    <p
      title={`${went} ${went === 1 ? "restaurante" : "restaurantes"} onde já foi`}
      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 py-1 pr-3.5 pl-1 ring-1 ring-amber-200/80 motion-safe:animate-[badge-pop_400ms_ease-out_both] [animation-delay:200ms]"
    >
      <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-white text-base shadow-sm">
        {level.emoji}
      </span>
      <span className="text-sm font-bold text-amber-900">{level.name}</span>
    </p>
  );
}

function FriendCount({ count }: { count: number }) {
  return (
    <>
      <span aria-hidden="true">👥 </span>
      <span className="font-bold tabular-nums">{count}</span>{" "}
      <span className="text-neutral-500">{count === 1 ? "amigo" : "amigos"}</span>
    </>
  );
}

const LIST_TABS: { status: ListStatus; label: string; empty: (name: string) => string }[] = [
  { status: "saved", label: "⭐ Já foi", empty: (name) => `${name} ainda não adicionou sítios onde foi.` },
  { status: "want", label: "🤤 Quer ir", empty: (name) => `${name} ainda não tem sítios onde quer ir.` },
];

// A friend's two lists: tabs "Já foi" / "Quer ir"; each restaurant opens on the map.
function ProfileLists({ items, firstName, style }: { items: ListItem[]; firstName: string; style: React.CSSProperties }) {
  const [tab, onTab] = useState<ListStatus>("saved");
  const shown = items.filter((item) => item.status === tab);
  const current = LIST_TABS.find((entry) => entry.status === tab)!;

  return (
    <section style={style} className={`rounded-3xl bg-white p-5 shadow-sm ${ENTER}`}>
      <h2 className="font-semibold">📍 Os restaurantes de {firstName}</h2>
      <div role="tablist" className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-neutral-100 p-1">
        {LIST_TABS.map(({ status, label }) => {
          const active = tab === status;
          return (
            <button
              key={status}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onTab(status)}
              className={`flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${
                active ? "bg-accent text-white shadow" : "text-neutral-600"
              }`}
            >
              {label}
              <span className={`min-w-5 rounded-full px-1.5 text-xs ${active ? "bg-white/25 text-white" : "bg-neutral-200 text-neutral-600"}`}>
                {items.filter((item) => item.status === status).length}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">{current.empty(firstName)}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {shown.map((item) => (
            <li key={item.entryId}>
              <Link
                href={mapHref({ id: item.placeId, name: item.name, kind: item.kind ?? "restaurant", lat: item.lat, lng: item.lng })}
                className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3 transition hover:bg-orange-50 active:scale-[0.98]"
              >
                <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-2xl">
                  {kindEmoji(item.kind)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{item.name}</span>
                    {item.rating !== null && (
                      <span style={{ backgroundColor: ratingColor(item.rating) }} className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white">
                        {item.rating}/10
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-sm text-neutral-500">
                    {item.kind ? kindsLabel(placeKinds(item)) : "Restaurante"}
                    <span aria-hidden="true">·</span>
                    <span className="text-accent">Ver no mapa</span>
                  </span>
                  {item.notes && <span className="mt-1 line-clamp-2 text-sm whitespace-pre-line text-neutral-600">{item.notes}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FriendButton({ person, relation }: { person: Person; relation: Relation }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function run(action: () => Promise<{ ok: boolean }>) {
    setError(null);
    startBusy(async () => {
      const { ok } = await action();
      if (ok) router.refresh();
      else setError("Não foi possível. Tenta outra vez.");
    });
  }

  const primary = "h-11 rounded-full bg-accent px-6 font-semibold text-white shadow transition active:scale-95 disabled:opacity-50";
  const secondary = "h-11 rounded-full bg-white px-5 font-semibold text-neutral-700 shadow-sm ring-1 ring-black/5 transition active:scale-95 disabled:opacity-50";

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <div className="flex gap-2">
        {relation === "received" ? (
          <>
            <button type="button" disabled={busy} onClick={() => run(() => removeFriendship(person.id))} className={secondary}>
              Recusar
            </button>
            <button type="button" disabled={busy} onClick={() => run(() => acceptFriendRequest(person.id))} className={primary}>
              Aceitar pedido
            </button>
          </>
        ) : relation === "sent" ? (
          <button type="button" disabled={busy} onClick={() => run(() => removeFriendship(person.id))} className={secondary}>
            Pedido enviado · Cancelar
          </button>
        ) : relation === "friends" ? (
          <button type="button" onClick={() => setConfirming(true)} className={secondary}>
            Amigos ✓
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => run(() => sendFriendRequest(person.id))} className={primary}>
            {busy ? "…" : "＋ Adicionar amigo"}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {confirming && (
        <RemoveFriendSheet
          person={person}
          onConfirm={async () => {
            setError(null);
            const { ok } = await removeFriendship(person.id);
            if (ok) router.refresh();
            else setError("Não foi possível. Tenta outra vez.");
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
