"use client";

import Link from "next/link";
import type { GroupEvent } from "@/app/social/groups";
import { formatDay } from "@/lib/social/dates";
import { mapHref } from "@/lib/map/place-link";
import { kindEmoji } from "@/lib/map/restaurants";
import { formatEuros, pricePerPerson, rankGuesses } from "@/lib/social/price-guess";
import { PersonAvatar } from "./groups-tab";
import { ProfileLink } from "./profile-link";

// The Preço certo winner of a revealed game, or null.
export function priceWinner(event: GroupEvent) {
  const { bill, guesses } = event.price;
  return bill ? rankGuesses(guesses, bill.total, bill.people).winner : null;
}

// A closed event, kept simple: when, the mordomo, where, the Preço certo winner and who was there.
export function PastEvent({ event }: { event: GroupEvent }) {
  const { bill } = event.price;
  const winner = priceWinner(event);

  return (
    <>
      <header className="motion-safe:animate-[sheet-up_400ms_ease-out_both]">
        <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">🏁 Evento passado</p>
        <h1 className="text-3xl leading-tight font-bold">{event.title}</h1>
        {event.date && <p className="mt-1 text-sm font-medium text-neutral-500 first-letter:uppercase">{formatDay(event.date)}</p>}
      </header>

      <ul className="flex flex-col gap-3">
        <Row emoji="🎩" label="Mordomo" delay={0}>
          {event.mordomo ? (
            <ProfileLink person={event.mordomo} className="flex items-center gap-2">
              <PersonAvatar person={event.mordomo} className="size-8 text-xs" />
              <span className="truncate font-semibold">{event.mordomo.displayName}</span>
            </ProfileLink>
          ) : (
            <span className="text-neutral-400">—</span>
          )}
        </Row>

        <Row emoji="📍" label="Onde" delay={60}>
          {event.location ? (
            <span className="flex items-center gap-2">
              <span aria-hidden="true">{kindEmoji(event.location.kind)}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{event.location.name}</span>
              <Link href={mapHref(event.location)} className="shrink-0 text-xs font-semibold text-sky-700 underline">
                Ver no mapa
              </Link>
            </span>
          ) : (
            <span className="text-neutral-400">Sem local registado</span>
          )}
        </Row>

        <Row emoji="👑" label="Preço certo" delay={120}>
          {!bill ? (
            <span className="text-neutral-400">Não se jogou</span>
          ) : winner ? (
            <ProfileLink person={winner.person} className="flex items-center gap-2">
              <PersonAvatar person={winner.person} className="size-8 text-xs ring-2 ring-amber-300" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{winner.person.displayName}</span>
                <span className="block text-xs text-neutral-500">
                  Apostou {formatEuros(winner.amount)} · preço certo {formatEuros(pricePerPerson(bill.total, bill.people))}
                </span>
              </span>
            </ProfileLink>
          ) : (
            <span className="text-neutral-500">
              Ninguém ganhou · preço certo {formatEuros(pricePerPerson(bill.total, bill.people))}
            </span>
          )}
        </Row>

        <Row emoji="👥" label={`Quem foi · ${event.going.length}`} delay={180}>
          {event.going.length === 0 ? (
            <span className="text-neutral-400">Ninguém</span>
          ) : (
            <span className="mt-1 grid grid-cols-5 gap-2">
              {event.going.map((person) => (
                <ProfileLink key={person.id} person={person} className="flex min-w-0 flex-col items-center gap-1">
                  <PersonAvatar person={person} className="size-10 text-sm" />
                  <span className="w-full truncate text-center text-[11px] text-neutral-600">{person.displayName.split(" ")[0]}</span>
                </ProfileLink>
              ))}
            </span>
          )}
        </Row>
      </ul>
    </>
  );
}

function Row({ emoji, label, delay, children }: { emoji: string; label: string; delay: number; children: React.ReactNode }) {
  return (
    <li
      style={{ animationDelay: `${delay}ms` }}
      className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 motion-safe:animate-[sheet-up_350ms_ease-out_both]"
    >
      <span aria-hidden="true" className="text-2xl">
        {emoji}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">{label}</span>
        {children}
      </span>
    </li>
  );
}
