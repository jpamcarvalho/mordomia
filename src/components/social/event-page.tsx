"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLiveEvent } from "@/lib/social/use-live-event";
import {
  chooseEventMordomo,
  loadGroupEvent,
  rollEventMordomo,
  type Group,
  type GroupEvent,
  type GroupMember,
} from "@/app/social/groups";
import { Spinner } from "@/components/spinner";
import { DateSection } from "./date-poll";
import { Attendance, HabemusBanner } from "./event-attendance";
import { LocationSection } from "./event-location";
import { GroupPhoto, PersonAvatar, groupHref, primary } from "./groups-tab";

type Props = { group: Group; initialEvent: GroupEvent };

// The dice shows names for at least this long before landing on the drawn one, then celebrates for a moment.
const ROLL_MS = 1800;
const ROLL_STEP_MS = 90;
const REVEAL_MS = 1400;

// An event's page. An event without a mordomo is blocked on choosing one: the event's creator names a member or
// rolls the dice (the group owner can only name one); everyone else waits. Then the mordomo runs the date poll;
// once it is closed the page celebrates ("Habemus data!") and shows who is going.
export function EventPage({ group, initialEvent }: Props) {
  const router = useRouter();
  const [event, setEvent] = useState(initialEvent);
  const members = group.members.filter((member) => member.status === "member");
  // Live updates wait while the dice is rolling (the roll ends with its own refresh).
  const rolling = useRef(false);
  // Only the newest of overlapping refreshes is applied.
  const latest = useRef(0);

  async function refresh() {
    const call = ++latest.current;
    const next = await loadGroupEvent(group.id, event.id);
    if (call !== latest.current) return;
    // Deleted, or I am no longer in the group.
    if (!next) {
      router.replace(groupHref(group.id));
      return;
    }
    setEvent(next);
  }

  // Whatever anyone does on this event (mordomo, poll, votes, who goes) shows up here right away.
  const live = useLiveEvent(event.id, () => void refresh(), () => rolling.current);

  return (
    // With a date the whole page turns festive ("Habemus data").
    <main
      className={`min-h-dvh pb-[calc(env(safe-area-inset-bottom)+2rem)] transition-colors duration-700 ${
        event.date ? "bg-gradient-to-b from-amber-100 via-orange-50 to-rose-50" : "bg-neutral-50"
      }`}
    >
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => (window.history.length > 1 ? router.back() : router.push(groupHref(group.id)))}
            className="-ml-1 flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-neutral-100"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <Link href={groupHref(group.id)} className="flex min-w-0 items-center gap-2 rounded-full py-1 pr-3 pl-1 hover:bg-neutral-100">
            <GroupPhoto group={group} className="size-7 rounded-lg text-sm" />
            <span className="truncate text-sm font-semibold text-neutral-600">{group.name}</span>
          </Link>
          {live && (
            <span title="Atualiza sozinho quando alguém mexe no evento" className="ml-auto flex shrink-0 items-center gap-1.5 text-xs font-semibold text-emerald-700">
              <span className="relative flex size-2">
                <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-75 motion-safe:animate-ping" />
                <span className="relative size-2 rounded-full bg-emerald-500" />
              </span>
              Ao vivo
            </span>
          )}
        </div>

        <header className="motion-safe:animate-[sheet-up_400ms_ease-out_both]">
          <p className={`text-xs font-semibold tracking-wide uppercase ${event.date ? "text-orange-700" : "text-neutral-400"}`}>
            {event.date ? "🎉 Evento marcado" : "Evento"}
          </p>
          <h1 className="text-3xl leading-tight font-bold">{event.title}</h1>
          {event.createdBy && <p className="mt-1 text-sm text-neutral-500">Criado por {event.createdBy.displayName}</p>}
        </header>

        {event.date && <HabemusBanner day={event.date} />}
        {event.date && <LocationSection event={event} onChanged={refresh} />}

        {event.mordomo ? (
          <section className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-orange-100 to-amber-50 p-5 shadow-sm motion-safe:animate-[sheet-up_400ms_ease-out_both]">
            <span className="relative">
              <PersonAvatar person={event.mordomo} className="size-16 text-2xl ring-4 ring-white" />
              <span aria-hidden="true" className="absolute -top-3 -right-2 text-2xl">
                🎩
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold tracking-wide text-amber-700 uppercase">Mordomo</span>
              <span className="block truncate text-xl font-bold">{event.mordomo.displayName}</span>
              <span className="block text-sm text-neutral-500">Organiza este evento</span>
            </span>
          </section>
        ) : (
          <MordomoPicker event={event} members={members} onChosen={refresh} onRolling={(on) => (rolling.current = on)} />
        )}

        {event.date ? (
          <Attendance event={event} onChanged={refresh} />
        ) : (
          <>
            {event.mordomo ? (
              <DateSection event={event} onChanged={refresh} />
            ) : (
              <Locked title="Data">Primeiro escolhe-se o mordomo. Depois, ele abre a votação dos dias.</Locked>
            )}
            <Locked title="Quem vai">Abre quando o evento tiver data.</Locked>
          </>
        )}
      </div>
    </main>
  );
}

// A step that is not open yet.
function Locked({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border-2 border-dashed border-neutral-200 bg-neutral-100 p-5 text-center">
      <p className="font-semibold text-neutral-400">🔒 {title}</p>
      <p className="mt-1 text-sm text-neutral-500">{children}</p>
    </section>
  );
}

type PickerProps = {
  event: GroupEvent;
  members: GroupMember[];
  onChosen: () => Promise<void>;
  // True while the dice animation runs.
  onRolling: (on: boolean) => void;
};

// Explicit "no mordomo yet" block: pick a member, or (the event's creator only) roll the dice for a random one.
function MordomoPicker({ event, members, onChosen, onRolling }: PickerProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // While rolling: the name the dice is on; then the drawn one.
  const [rolling, setRolling] = useState<{ index: number; done: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const { ok } = await chooseEventMordomo(event.id, selected);
    if (!ok) {
      setError("Não foi possível escolher. Talvez já haja um mordomo.");
      setBusy(false);
    }
    await onChosen();
  }

  async function roll() {
    setBusy(true);
    setError(null);
    setSelected(null);
    onRolling(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let index = Math.floor(Math.random() * members.length);
    setRolling({ index, done: false });
    if (!reduced) {
      timer.current = setInterval(() => {
        index = (index + 1 + Math.floor(Math.random() * Math.max(1, members.length - 1))) % members.length;
        setRolling({ index, done: false });
      }, ROLL_STEP_MS);
    }
    const [result] = await Promise.all([
      rollEventMordomo(event.id),
      new Promise((resolve) => setTimeout(resolve, reduced ? 0 : ROLL_MS)),
    ]);
    if (timer.current) clearInterval(timer.current);
    const drawn = members.findIndex((member) => member.id === result.mordomoId);
    if (!result.ok || drawn < 0) {
      setRolling(null);
      setBusy(false);
      setError("Não foi possível lançar o dado. Talvez já haja um mordomo.");
      onRolling(false);
      await onChosen();
      return;
    }
    setRolling({ index: drawn, done: true });
    await new Promise((resolve) => setTimeout(resolve, reduced ? 600 : REVEAL_MS));
    onRolling(false);
    await onChosen();
  }

  const current = rolling ? members[rolling.index] : null;

  return (
    <section
      aria-labelledby="mordomo-missing"
      className="rounded-3xl bg-white p-5 shadow-sm ring-2 ring-amber-300 motion-safe:animate-[sheet-up_400ms_ease-out_both]"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-4xl">
          🎩
        </span>
        <div>
          <h2 id="mordomo-missing" className="text-lg font-bold">
            Este evento ainda não tem mordomo
          </h2>
          <p className="text-sm text-neutral-600">
            O mordomo organiza o evento. É preciso escolher um antes de juntar mais detalhes.
          </p>
        </div>
      </div>

      {!event.canChooseMordomo ? (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {event.createdBy
            ? `À espera que ${event.createdBy.displayName} escolha o mordomo ou lance o dado.`
            : "À espera que o criador do grupo escolha o mordomo."}
        </p>
      ) : rolling && current ? (
        <div role="status" aria-live="polite" className="mt-5 flex flex-col items-center gap-3 py-2 text-center">
          <span
            aria-hidden="true"
            className={`text-6xl ${rolling.done ? "motion-safe:animate-[badge-pop_400ms_ease-out_both]" : "motion-safe:animate-[dice-roll_600ms_linear_infinite]"}`}
          >
            {rolling.done ? "🎉" : "🎲"}
          </span>
          <span className="flex items-center gap-3">
            <PersonAvatar person={current} className={`size-12 text-lg ${rolling.done ? "ring-4 ring-accent" : ""}`} />
            <span className="text-xl font-bold">{current.displayName}</span>
          </span>
          {rolling.done && <p className="font-semibold text-accent">é o mordomo!</p>}
        </div>
      ) : (
        <>
          <p className="mt-4 mb-2 text-sm font-semibold text-neutral-500">Escolhe o mordomo</p>
          <ul role="radiogroup" aria-label="Escolhe o mordomo" className="flex flex-col gap-2">
            {members.map((member) => (
              <li key={member.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected === member.id}
                  disabled={busy}
                  onClick={() => setSelected(member.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition ${
                    selected === member.id ? "bg-orange-50 ring-2 ring-accent" : "bg-neutral-50 ring-1 ring-neutral-200"
                  }`}
                >
                  <PersonAvatar person={member} className="size-9 text-sm" />
                  <span className="min-w-0 flex-1 truncate font-medium">{member.displayName}</span>
                  {selected === member.id && <span aria-hidden="true">🎩</span>}
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={!selected || busy}
            onClick={confirm}
            className={`${primary} mt-3 flex h-12 w-full items-center justify-center gap-2 text-base`}
          >
            {busy && <Spinner className="size-5 border-white/30 border-t-white" />}
            Confirmar mordomo
          </button>

          {event.canRollMordomo && (
            <>
              <div className="my-3 flex items-center gap-3 text-xs font-semibold text-neutral-400 uppercase">
                <span className="h-px flex-1 bg-neutral-200" />
                ou
                <span className="h-px flex-1 bg-neutral-200" />
              </div>

              <button
                type="button"
                disabled={busy || members.length === 0}
                onClick={roll}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-neutral-900 text-base font-semibold text-white shadow transition active:scale-95 disabled:opacity-50"
              >
                <span aria-hidden="true" className="text-xl transition group-hover:rotate-45">
                  🎲
                </span>
                Lançar o dado
              </button>
              <p className="mt-2 text-center text-xs text-neutral-400">O dado escolhe um membro do grupo ao acaso.</p>
            </>
          )}
        </>
      )}

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
