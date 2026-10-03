"use client";

import { ProfileLink } from "./profile-link";
import { useState } from "react";
import { answerGroupEvent, answerGroupEventRejoin, requestGroupEventRejoin, type GroupEvent } from "@/app/social/groups";
import { formatDay, formatDayTime } from "@/lib/social/dates";
import { PersonAvatar, primary, secondary } from "./groups-tab";

// Confetti pieces: emoji, left position (%), delay (ms), spin.
const CONFETTI: [string, number, number, string][] = [
  ["🎉", 6, 0, "300deg"],
  ["🥂", 18, 250, "-200deg"],
  ["✨", 30, 120, "420deg"],
  ["🎊", 44, 380, "-320deg"],
  ["🍾", 58, 60, "260deg"],
  ["✨", 70, 300, "-420deg"],
  ["🎉", 82, 180, "360deg"],
  ["🥳", 92, 440, "-260deg"],
];

// "Habemus data!": white smoke, falling confetti (once, on arrival) and the chosen day (and time, once set).
export function HabemusBanner({ day, time }: { day: string; time: string | null }) {
  const date = new Date(`${day}T12:00:00`);
  return (
    <section
      aria-label={`Habemus data: ${formatDayTime(day, time)}`}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-300 via-orange-300 to-rose-300 px-5 pt-6 pb-5 text-center shadow-lg motion-safe:animate-[badge-pop_500ms_ease-out_both]"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {CONFETTI.map(([emoji, left, delay, spin], index) => (
          <span
            key={index}
            className="absolute -top-6 text-2xl opacity-0 motion-safe:animate-[confetti-fall_2200ms_ease-in_both]"
            style={{ left: `${left}%`, animationDelay: `${delay}ms`, ["--spin" as string]: spin }}
          >
            {emoji}
          </span>
        ))}
      </div>

      <p aria-hidden="true" className="relative flex justify-center gap-1 text-2xl">
        {["💨", "💨", "💨"].map((puff, index) => (
          <span key={index} className="motion-safe:animate-[smoke-rise_1800ms_ease-out_infinite]" style={{ animationDelay: `${index * 450}ms` }}>
            {puff}
          </span>
        ))}
      </p>
      <p className="relative text-xs font-bold tracking-[0.2em] text-orange-900/70 uppercase">Fumo branco</p>
      <h2 className="relative mt-1 font-serif text-4xl font-black text-white italic drop-shadow-[0_2px_0_rgba(154,52,18,0.45)]">
        Habemus data!
      </h2>

      <div className="relative mt-4 flex items-center justify-center gap-4">
        <span aria-hidden="true" className="flex w-20 shrink-0 flex-col overflow-hidden rounded-2xl text-center shadow-xl ring-4 ring-white/70 motion-safe:animate-[badge-pop_600ms_300ms_ease-out_both]">
          <span className="bg-rose-600 py-1 text-xs font-bold text-white uppercase">
            {new Intl.DateTimeFormat("pt-PT", { month: "short" }).format(date).replace(".", "")}
          </span>
          <span className="bg-white py-1.5 text-3xl font-black">{date.getDate()}</span>
        </span>
        <span className="text-left text-lg leading-tight font-bold text-orange-950">
          <span className="block first-letter:uppercase">{formatDay(day)}</span>
          {time && <span className="mt-1 block text-base text-orange-900/80">🕗 às {time}</span>}
        </span>
      </div>
    </section>
  );
}

type Props = { event: GroupEvent; onChanged: () => Promise<void> };

// Who is going once there is a date. Who voted for the chosen day (and the mordomo) is going; everyone else answers
// "Vou" or "Não vou". "Não vou" takes them out of the event (they stay in the group); to come back they ask the
// mordomo, who accepts or declines.
export function Attendance({ event, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = new Set(event.lockedIds);
  const requests = event.left.filter((item) => item.rejoinRequested);
  const mordomoName = event.mordomo?.displayName ?? "o mordomo";
  const notGoing = () => {
    if (window.confirm("Não vais? Ficas fora deste evento (mas continuas no grupo). Para voltar, tens de pedir ao mordomo."))
      void run(() => answerGroupEvent(event.id, false));
  };

  async function run(action: () => Promise<{ ok: boolean }>) {
    setBusy(true);
    setError(null);
    const { ok } = await action();
    if (ok) await onChanged();
    else setError("Não foi possível. Tenta outra vez.");
    setBusy(false);
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm motion-safe:animate-[sheet-up_400ms_200ms_ease-out_both]">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Quem vai</h2>
        <span className="text-sm font-semibold text-accent">{event.going.length === 1 ? "1 pessoa" : `${event.going.length} pessoas`}</span>
      </div>

      <ul className="mt-3 grid grid-cols-4 gap-3">
        {event.going.map((person, index) => (
          <li
            key={person.id}
            style={{ animationDelay: `${300 + Math.min(index, 12) * 60}ms` }}
            className="flex flex-col items-center gap-1 text-center motion-safe:animate-[badge-pop_350ms_ease-out_both]"
          >
            <ProfileLink person={person} className="relative">
              <PersonAvatar person={person} className="size-12 text-base" />
              {locked.has(person.id) && (
                <span
                  title={person.id === event.mordomo?.id ? "Mordomo" : "Votou neste dia"}
                  className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white ring-2 ring-white"
                >
                  {person.id === event.mordomo?.id ? "🎩" : "✓"}
                </span>
              )}
            </ProfileLink>
            <span className="w-full truncate text-xs font-medium text-neutral-700">{person.displayName.split(" ")[0]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-neutral-400">✓ votou neste dia · 🎩 mordomo</p>

      {/* My place */}
      <div className="mt-4 border-t border-neutral-100 pt-4">
        {event.me === "locked" ? (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {event.isMordomo ? "🎩 És o mordomo: contas com a tua presença!" : "🔒 Votaste neste dia: estás dentro!"}
          </p>
        ) : event.me === "undecided" ? (
          <>
            <p className="font-semibold">Não votaste neste dia. Vens?</p>
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={busy} onClick={() => run(() => answerGroupEvent(event.id, true))} className={`${primary} h-11 flex-1`}>
                👍 Vou
              </button>
              <button type="button" disabled={busy} onClick={notGoing} className={`${secondary} h-11 flex-1`}>
                Não vou
              </button>
            </div>
          </>
        ) : event.me === "going" ? (
          <div className="flex items-center gap-2">
            <p className="flex-1 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">👍 Vais a este evento!</p>
            <button type="button" disabled={busy} onClick={notGoing} className="shrink-0 text-sm font-semibold text-neutral-500 underline">
              Afinal não vou
            </button>
          </div>
        ) : event.me === "left" ? (
          <>
            <p className="text-sm text-neutral-600">Disseste que não vais: estás fora deste evento (continuas no grupo).</p>
            <button type="button" disabled={busy} onClick={() => run(() => requestGroupEventRejoin(event.id))} className={`${primary} mt-3 h-11 w-full`}>
              Pedir a {mordomoName} para voltar
            </button>
          </>
        ) : event.me === "requested" ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">⏳ Pediste para voltar. À espera de {mordomoName}.</p>
        ) : null}
      </div>

      {event.isMordomo && requests.length > 0 && (
        <div className="mt-4 rounded-2xl bg-orange-50 p-3">
          <p className="mb-2 text-sm font-semibold text-orange-900">Pedidos para voltar</p>
          <ul className="flex flex-col gap-2">
            {requests.map(({ person }) => (
              <li key={person.id} className="flex items-center gap-2">
                <ProfileLink person={person} className="flex min-w-0 flex-1 items-center gap-2">
                  <PersonAvatar person={person} className="size-9 text-sm" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{person.displayName}</span>
                </ProfileLink>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => answerGroupEventRejoin(event.id, person.id, false))}
                  className="h-9 rounded-full bg-white px-3 text-sm font-semibold text-neutral-700 disabled:opacity-50"
                >
                  Recusar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => answerGroupEventRejoin(event.id, person.id, true))}
                  className="h-9 rounded-full bg-accent px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Aceitar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {event.undecided.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-neutral-400 uppercase">Por responder</p>
          <div className="flex flex-wrap gap-1.5">
            {event.undecided.map((person) => (
              <ProfileLink key={person.id} person={person} className="relative opacity-70">
                <PersonAvatar person={person} className="size-8 text-xs" />
                <span aria-hidden="true" className="absolute -right-1 -bottom-1 text-xs">
                  ❔
                </span>
              </ProfileLink>
            ))}
          </div>
        </div>
      )}

      {event.left.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-neutral-400 uppercase">Não vão</p>
          <div className="flex flex-wrap gap-1.5">
            {event.left.map(({ person, rejoinRequested }) => (
              <ProfileLink key={person.id} person={person} className="relative opacity-50 grayscale">
                <PersonAvatar person={person} className="size-8 text-xs" />
                {rejoinRequested && (
                  <span aria-hidden="true" className="absolute -right-1 -bottom-1 text-xs">
                    ⏳
                  </span>
                )}
              </ProfileLink>
            ))}
          </div>
        </div>
      )}

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
