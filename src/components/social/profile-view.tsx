"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptFriendRequest, removeFriendship, sendFriendRequest, type Relation } from "@/app/social/actions";
import { ENTER, delay } from "@/components/enter";
import { ProfileLists } from "@/components/profile-lists";
import type { ListItem } from "@/lib/list/types";
import { levelFor } from "@/lib/profile/account";
import { avatarInitial } from "@/lib/profile/avatar";
import type { Person } from "@/lib/social/people";
import { PersonAvatar, Sheet, SheetHeader } from "./groups-tab";
import { ProfileLink } from "./profile-link";
import { RemoveFriendSheet } from "./remove-friend-sheet";

type Props = {
  person: Person;
  bio: string | null;
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
export function ProfileView({ person, bio, friendCount, relation, list, friendList, me }: Props) {
  const router = useRouter();
  const [showFriends, setShowFriends] = useState(false);
  const firstName = person.displayName.split(" ")[0];

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
          <div className="relative">
            <span className="flex size-32 items-center justify-center overflow-hidden rounded-full bg-accent text-5xl font-bold text-white shadow-lg ring-4 ring-white">
              {person.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
                <img src={person.avatarUrl} alt="" className="size-full object-cover" />
              ) : (
                avatarInitial(person.username)
              )}
            </span>
            <FriendButton person={person} relation={relation} />
          </div>
          <h1 className="mt-4 text-2xl font-bold">{person.displayName}</h1>
          <p className="text-sm text-neutral-500">@{person.username}</p>
          {relation === "sent" && <p className="mt-1 text-xs text-neutral-400">Pedido de amizade enviado</p>}
          {relation === "received" && <p className="mt-1 text-xs font-medium text-accent">Quer ser teu amigo</p>}
          {/* Level and friends side by side. */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {list && <LevelBadge went={list.filter((item) => item.status === "saved").length} />}
            {friendCount !== null &&
              (friendList ? (
                <button
                  type="button"
                  onClick={() => setShowFriends(true)}
                  aria-label={`${friendCount} ${friendCount === 1 ? "amigo" : "amigos"}`}
                  className="flex h-9 items-center gap-1 rounded-full bg-white/80 px-3 text-sm shadow-sm ring-1 ring-black/5 transition hover:bg-white active:scale-95"
                >
                  <FriendCount count={friendCount} />
                </button>
              ) : (
                <p
                  aria-label={`${friendCount} ${friendCount === 1 ? "amigo" : "amigos"}`}
                  className="flex h-9 items-center gap-1 rounded-full bg-white/80 px-3 text-sm shadow-sm ring-1 ring-black/5"
                >
                  <FriendCount count={friendCount} />
                </p>
              ))}
          </div>
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
          <ProfileLists
            items={list}
            title={`📍 Os restaurantes de ${firstName}`}
            tabs={{
              saved: { label: "⭐ Já foi", empty: `${firstName} ainda não adicionou sítios onde foi.` },
              want: { label: "🤤 Quer ir", empty: `${firstName} ainda não tem sítios onde quer ir.` },
            }}
            style={delay(160)}
          />
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
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 py-1 pr-3.5 pl-1 ring-1 ring-amber-200/80 motion-safe:animate-[badge-pop_400ms_ease-out_both] [animation-delay:200ms]"
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
      <span aria-hidden="true">👥</span>
      <span className="font-bold tabular-nums">{count}</span>
    </>
  );
}

// A small round button on the photo: "+" adds (or accepts) the friend, "−" removes them (after confirming) or
// cancels a sent request.
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

  const add = relation === "none" || relation === "received";
  const label =
    relation === "none"
      ? "Adicionar amigo"
      : relation === "received"
        ? "Aceitar pedido de amizade"
        : relation === "sent"
          ? "Cancelar pedido de amizade"
          : "Remover amigo";

  return (
    <>
      <button
        type="button"
        disabled={busy}
        aria-label={label}
        title={label}
        onClick={() => {
          if (relation === "friends") setConfirming(true);
          else if (relation === "none") run(() => sendFriendRequest(person.id));
          else if (relation === "received") run(() => acceptFriendRequest(person.id));
          else run(() => removeFriendship(person.id));
        }}
        className={`absolute right-0 bottom-0 flex size-10 items-center justify-center rounded-full text-2xl leading-none font-bold shadow-md ring-4 ring-white transition active:scale-90 disabled:opacity-60 ${
          add ? "bg-emerald-500 text-white" : "bg-red-50 text-red-600"
        }`}
      >
        {busy ? "…" : add ? "+" : "−"}
      </button>
      {error && (
        <p role="alert" className="absolute top-full left-1/2 mt-2 w-max -translate-x-1/2 text-sm text-red-600">
          {error}
        </p>
      )}

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
    </>
  );
}
