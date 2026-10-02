"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { levelFor } from "@/lib/profile/account";
import type { Person } from "@/lib/social/people";
import { PersonAvatar } from "./groups-tab";
import { profileHref } from "./profile-link";

type Props = { friends: { person: Person; went: number }[] };

// "Os meus amigos": one card per friend (photo, name, level); a card opens their profile.
export function FriendsPage({ friends }: Props) {
  const router = useRouter();

  return (
    <main className="min-h-dvh bg-gradient-to-b from-orange-100 via-orange-50/40 to-white pb-[calc(env(safe-area-inset-bottom)+6rem)]">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/account"))}
          className="flex w-fit items-center gap-1 rounded-full bg-white/80 px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm backdrop-blur active:scale-95"
        >
          <span aria-hidden="true">←</span> Voltar
        </button>

        <header className="text-center motion-safe:animate-[sheet-up_450ms_ease-out_both]">
          <span aria-hidden="true" className="text-4xl">
            👥
          </span>
          <h1 className="mt-1 text-2xl font-bold">Os meus amigos</h1>
          <p className="text-sm text-neutral-500">
            {friends.length === 1 ? "1 amigo" : `${friends.length} amigos`} à mesa contigo
          </p>
        </header>

        {friends.length === 0 ? (
          <section className="flex flex-col items-center gap-2 rounded-3xl bg-white p-8 text-center shadow-sm motion-safe:animate-[sheet-up_450ms_ease-out_both] [animation-delay:80ms]">
            <span aria-hidden="true" className="text-5xl">
              🍽️
            </span>
            <h2 className="font-semibold">Ainda comes sozinho?</h2>
            <p className="text-sm text-neutral-500">Procura os teus amigos pelo nome ou pelo @utilizador.</p>
            <Link
              href="/social?tab=procurar"
              className="mt-2 flex h-11 items-center rounded-full bg-accent px-6 font-semibold text-white shadow transition active:scale-95"
            >
              Procurar amigos
            </Link>
          </section>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {friends.map(({ person, went }, index) => {
              const level = levelFor(went);
              return (
                <li
                  key={person.id}
                  style={{ animationDelay: `${80 + Math.min(index, 10) * 50}ms` }}
                  className="motion-safe:animate-[sheet-up_400ms_ease-out_both]"
                >
                  <Link
                    href={profileHref(person.username)}
                    className="flex items-center gap-3 rounded-3xl bg-white p-3 pr-4 shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
                  >
                    <PersonAvatar person={person} className="size-14 text-xl ring-2 ring-orange-100" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{person.displayName}</span>
                      <span className="block truncate text-sm text-neutral-500">@{person.username}</span>
                    </span>
                    <span
                      title={`${went} ${went === 1 ? "restaurante" : "restaurantes"} onde já foi`}
                      className="flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 py-0.5 pr-2.5 pl-0.5 ring-1 ring-amber-200/80"
                    >
                      <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-white text-sm shadow-sm">
                        {level.emoji}
                      </span>
                      <span className="text-xs font-bold text-amber-900">{level.name}</span>
                    </span>
                    <span aria-hidden="true" className="text-lg text-neutral-300">
                      ›
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {friends.length > 0 && (
          <Link href="/social?tab=procurar" className="mx-auto text-sm font-semibold text-accent">
            ＋ Procurar mais amigos
          </Link>
        )}
      </div>
    </main>
  );
}
