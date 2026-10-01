"use client";

import { useState } from "react";
import { closeDatePoll, createDatePoll, submitDateVotes, type DateOption, type GroupEvent } from "@/app/social/groups";
import { Spinner } from "@/components/spinner";
import { WEEKDAYS, dayKey, formatDay, formatDayShort, formatMonth, monthGrid, todayKey } from "@/lib/social/dates";
import { kindEmoji, type SelectedPlace } from "@/lib/map/restaurants";
import { RestaurantSearch } from "./event-location";
import { PersonAvatar, Sheet, SheetHeader, primary, secondary } from "./groups-tab";

const POLL_DAYS_MAX = 31;

type Props = { event: GroupEvent; onChanged: () => Promise<void> };

// The event's date: set (shown big), being voted (the poll), or not started (the mordomo picks days on a
// calendar; everyone else waits). Only shown once the event has a mordomo.
export function DateSection({ event, onChanged }: Props) {
  const [picking, setPicking] = useState(false);

  if (event.date) {
    return (
      <section className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-sm motion-safe:animate-[sheet-up_400ms_ease-out_both]">
        <CalendarBadge day={event.date} />
        <span className="min-w-0">
          <span className="block text-xs font-semibold tracking-wide text-neutral-400 uppercase">Data</span>
          <span className="block text-xl font-bold first-letter:uppercase">{formatDay(event.date)}</span>
        </span>
      </section>
    );
  }

  if (event.dateOptions.length > 0) return <PollCard event={event} onChanged={onChanged} />;

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-3xl">
          📅
        </span>
        <div>
          <h2 className="text-lg font-bold">Quando é?</h2>
          <p className="text-sm text-neutral-600">
            {event.isMordomo
              ? "Escolhe no calendário os dias possíveis. O grupo vota e tu fechas a votação."
              : `À espera que ${event.mordomo?.displayName ?? "o mordomo"} escolha os dias para votar.`}
          </p>
        </div>
      </div>
      {event.isMordomo && (
        <button type="button" onClick={() => setPicking(true)} className={`${primary} mt-4 flex h-12 w-full items-center justify-center gap-2 text-base`}>
          <span aria-hidden="true">🗓️</span> Escolher dias
        </button>
      )}
      {picking && (
        <CalendarSheet
          eventId={event.id}
          onClose={() => setPicking(false)}
          onCreated={async () => {
            setPicking(false);
            await onChanged();
          }}
        />
      )}
    </section>
  );
}

// A little tear-off calendar page: month on top, day number below.
function CalendarBadge({ day }: { day: string }) {
  const date = new Date(`${day}T12:00:00`);
  return (
    <span aria-hidden="true" className="flex w-16 shrink-0 flex-col overflow-hidden rounded-2xl text-center shadow ring-1 ring-black/5">
      <span className="bg-accent py-0.5 text-xs font-bold text-white uppercase">
        {new Intl.DateTimeFormat("pt-PT", { month: "short" }).format(date).replace(".", "")}
      </span>
      <span className="bg-white py-1 text-2xl font-bold">{date.getDate()}</span>
    </span>
  );
}

type CalendarProps = { eventId: string; onClose: () => void; onCreated: () => void };

// Month calendar: tap the possible days (from today on), then open the poll.
function CalendarSheet({ eventId, onClose, onCreated }: CalendarProps) {
  const today = todayKey();
  const now = new Date();
  const [month, setMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [days, setDays] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const atCurrentMonth = month.year === now.getFullYear() && month.month === now.getMonth();
  const sorted = [...days].sort();

  function shift(delta: number) {
    const date = new Date(month.year, month.month + delta, 1);
    setMonth({ year: date.getFullYear(), month: date.getMonth() });
  }

  function toggle(key: string) {
    const next = new Set(days);
    if (next.has(key)) next.delete(key);
    else if (next.size < POLL_DAYS_MAX) next.add(key);
    setDays(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const { ok } = await createDatePoll(eventId, sorted);
    if (ok) onCreated();
    else {
      setError("Não foi possível abrir a votação. Tenta outra vez.");
      setSaving(false);
    }
  }

  return (
    <Sheet label="Escolher dias" onClose={onClose}>
      <SheetHeader title="Escolher dias" onClose={onClose} />
      <p className="-mt-2 text-sm text-neutral-500">Toca nos dias possíveis. O grupo vai votar nos que lhe dão jeito.</p>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Mês anterior"
            disabled={atCurrentMonth}
            onClick={() => shift(-1)}
            className="flex size-10 items-center justify-center rounded-full text-xl hover:bg-neutral-100 disabled:opacity-30"
          >
            ‹
          </button>
          <span className="font-semibold first-letter:uppercase">{formatMonth(month.year, month.month)}</span>
          <button
            type="button"
            aria-label="Mês seguinte"
            onClick={() => shift(1)}
            className="flex size-10 items-center justify-center rounded-full text-xl hover:bg-neutral-100"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((weekday, index) => (
            <span key={index} aria-hidden="true" className="py-1 text-xs font-semibold text-neutral-400">
              {weekday}
            </span>
          ))}
          {monthGrid(month.year, month.month).map((day, index) => {
            if (day === null) return <span key={`blank-${index}`} />;
            const key = dayKey(month.year, month.month, day);
            const past = key < today;
            const on = days.has(key);
            return (
              <button
                key={key}
                type="button"
                disabled={past}
                aria-pressed={on}
                aria-label={formatDay(key)}
                onClick={() => toggle(key)}
                className={`flex aspect-square items-center justify-center rounded-full text-[15px] font-medium transition active:scale-90 ${
                  on
                    ? "bg-accent font-bold text-white shadow motion-safe:animate-[badge-pop_250ms_ease-out_both]"
                    : past
                      ? "text-neutral-300"
                      : key === today
                        ? "text-accent ring-1 ring-accent/40 hover:bg-orange-50"
                        : "hover:bg-neutral-100"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {sorted.length > 0 && (
        <ul aria-label="Dias escolhidos" className="flex flex-wrap gap-1.5">
          {sorted.map((key) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-label={`Tirar ${formatDay(key)}`}
                className="flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-accent"
              >
                {formatDayShort(key)} <span aria-hidden="true">✕</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button
        type="button"
        disabled={sorted.length === 0 || saving}
        onClick={save}
        className={`${primary} flex h-12 items-center justify-center gap-2 text-base`}
      >
        {saving && <Spinner className="size-5 border-white/30 border-t-white" />}
        {sorted.length === 0 ? "Escolhe pelo menos um dia" : sorted.length === 1 ? "Abrir votação com 1 dia" : `Abrir votação com ${sorted.length} dias`}
      </button>
    </Sheet>
  );
}

// The most voted day (the earliest on a tie), or null when nobody voted.
function leader(options: DateOption[]): DateOption | null {
  const best = options.reduce<DateOption | null>((top, option) => (!top || option.voters.length > top.voters.length ? option : top), null);
  return best && best.voters.length > 0 ? best : null;
}

// Open poll: everyone ticks the days that work for them and confirms; the mordomo closes it.
function PollCard({ event, onChanged }: Props) {
  // My votes as saved, and the ticks being edited (sent with "Confirmar").
  const saved = new Set(event.dateOptions.filter((option) => option.mine).map((option) => option.id));
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  // Before my first vote the days are open to tick; after it they are locked until "Mudar votos".
  const [editing, setEditing] = useState(saved.size === 0);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const top = leader(event.dateOptions);
  const most = Math.max(1, ...event.dateOptions.map((option) => option.voters.length));
  const changed = draft.size !== saved.size || [...draft].some((id) => !saved.has(id));
  const voted = saved.size > 0;

  function toggle(option: DateOption) {
    const next = new Set(draft);
    if (next.has(option.id)) next.delete(option.id);
    else next.add(option.id);
    setDraft(next);
  }

  function cancel() {
    setDraft(saved);
    setEditing(false);
    setError(null);
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    const { ok } = await submitDateVotes(event.id, [...draft]);
    if (ok) {
      await onChanged();
      setEditing(false);
    } else setError("Não foi possível enviar. Talvez a votação já tenha fechado.");
    setSaving(false);
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-2 ring-violet-200 motion-safe:animate-[sheet-up_400ms_ease-out_both]">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-3xl">
          🗳️
        </span>
        <div>
          <h2 className="text-lg font-bold">Que dias dão para ti?</h2>
          <p className="text-sm text-neutral-600">
            Marca todos os dias em que podes e confirma.{" "}
            {event.isMordomo ? "Quando quiseres, fecha a votação." : `${event.mordomo?.displayName ?? "O mordomo"} fecha a votação.`}
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {event.dateOptions.map((option) => {
          const ticked = draft.has(option.id);
          return (
            <li key={option.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={ticked}
                disabled={saving || !editing}
                onClick={() => toggle(option)}
                className={`relative w-full overflow-hidden rounded-2xl px-3 py-2.5 text-left ring-1 transition enabled:active:scale-[0.99] ${
                  !editing
                    ? ticked
                      ? "bg-emerald-50/60 ring-2 ring-emerald-500"
                      : "bg-neutral-50 opacity-60 ring-neutral-200"
                    : ticked
                      ? "ring-2 ring-violet-500"
                      : "ring-neutral-200"
                }`}
              >
                {/* Votes bar */}
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${editing ? "bg-violet-50" : "bg-emerald-100/70"}`}
                  style={{ width: `${(option.voters.length / most) * 100}%` }}
                />
                <span className="relative flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className={`flex size-6 shrink-0 items-center justify-center rounded-md text-sm font-bold ${
                      !editing
                        ? ticked
                          ? "bg-emerald-600 text-white"
                          : "bg-neutral-200 text-neutral-400"
                        : ticked
                          ? "bg-violet-600 text-white"
                          : "bg-white ring-1 ring-neutral-300"
                    }`}
                  >
                    {/* Locked after confirming: a padlock on my days; editing: a tick. */}
                    {!editing ? (ticked ? <LockIcon /> : null) : ticked && "✓"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug font-semibold first-letter:uppercase">{formatDay(option.day)}</span>
                    {top?.id === option.id && <span className="text-xs font-semibold text-violet-700">⭐ Mais votado</span>}
                  </span>
                  <span className="text-sm font-bold text-neutral-600">
                    {option.voters.length === 1 ? "1 voto" : `${option.voters.length} votos`}
                  </span>
                </span>
                {/* Who voted for this day: avatars only (the name is in the tooltip / for screen readers). */}
                {option.voters.length > 0 && (
                  <span className="relative mt-2 flex flex-wrap gap-1 pl-9">
                    {option.voters.map((person) => (
                      <span key={person.id} title={person.displayName} aria-label={person.displayName} role="img">
                        <PersonAvatar person={person} className="size-8 text-xs ring-2 ring-white" />
                      </span>
                    ))}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {editing ? (
        <div className="mt-4 flex gap-2">
          {voted && (
            <button type="button" disabled={saving} onClick={cancel} className={`${secondary} h-12 flex-1 text-base`}>
              Cancelar
            </button>
          )}
          <button
            type="button"
            disabled={!changed || saving}
            onClick={confirm}
            className={`${primary} flex h-12 flex-1 items-center justify-center gap-2 text-base`}
          >
            {saving && <Spinner className="size-5 border-white/30 border-t-white" />}
            Confirmar
          </button>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <p className="flex flex-1 items-center gap-1.5 text-sm font-semibold text-emerald-700">
            <LockIcon /> Os teus votos foram enviados
          </p>
          <button type="button" onClick={() => setEditing(true)} className={secondary}>
            ✏️ Mudar votos
          </button>
        </div>
      )}

      {event.isMordomo && (
        <button type="button" onClick={() => setClosing(true)} className={`${secondary} mt-3 flex h-12 w-full items-center justify-center gap-2 text-base`}>
          <span aria-hidden="true">🔒</span> Fechar votação
        </button>
      )}
      {closing && (
        <CloseSheet
          event={event}
          initial={top?.day ?? event.dateOptions[0].day}
          onClose={() => setClosing(false)}
          onClosed={async () => {
            setClosing(false);
            await onChanged();
          }}
        />
      )}
    </section>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

type CloseProps = { event: GroupEvent; initial: string; onClose: () => void; onClosed: () => void };

// The mordomo confirms the date: the most voted day comes selected; any poll day can be chosen.
function CloseSheet({ event, initial, onClose, onClosed }: CloseProps) {
  const [day, setDay] = useState(initial);
  // Optional: where it will be (a restaurant), set together with the date.
  const [place, setPlace] = useState<SelectedPlace | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const { ok } = await closeDatePoll(event.id, day, place);
    if (ok) onClosed();
    else {
      setError("Não foi possível fechar a votação. Tenta outra vez.");
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet label="Fechar votação" onClose={onClose}>
        <SheetHeader title="Fechar votação" onClose={onClose} />
        <p className="-mt-2 text-sm text-neutral-500">Escolhe o dia do evento. Depois disso já não se vota.</p>
        <ul role="radiogroup" aria-label="Dia do evento" className="flex flex-col gap-2">
          {event.dateOptions.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="radio"
                aria-checked={day === option.day}
                onClick={() => setDay(option.day)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                  day === option.day ? "bg-orange-50 ring-2 ring-accent" : "bg-neutral-50 ring-1 ring-neutral-200"
                }`}
              >
                <span className="min-w-0 flex-1 font-semibold first-letter:uppercase">{formatDay(option.day)}</span>
                <span className="text-sm text-neutral-500">
                  {option.voters.length === 1 ? "1 voto" : `${option.voters.length} votos`}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div>
          <p className="mb-2 text-sm font-semibold">
            📍 Local <span className="font-normal text-neutral-400">(opcional)</span>
          </p>
          {place ? (
            <div className="flex items-center gap-3 rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-200">
              <span aria-hidden="true" className="text-2xl">
                {kindEmoji(place.kind)}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{place.name}</span>
              <button type="button" aria-label="Tirar o local" onClick={() => setPlace(null)} className="-mr-1 flex size-8 items-center justify-center rounded-full text-neutral-400 hover:bg-white">
                ✕
              </button>
            </div>
          ) : (
            <>
              <button type="button" onClick={() => setSearching(true)} className={`${secondary} flex h-11 w-full items-center justify-center gap-2`}>
                <span aria-hidden="true">🔎</span> Escolher restaurante
              </button>
              <p className="mt-1 text-xs text-neutral-400">Se não escolheres, quem vai pode sugerir restaurantes.</p>
            </>
          )}
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="button" disabled={saving} onClick={save} className={`${primary} flex h-12 items-center justify-center gap-2 text-base`}>
          {saving && <Spinner className="size-5 border-white/30 border-t-white" />}
          {place ? "Confirmar data e local" : "Confirmar data"}
        </button>
      </Sheet>
      {searching && (
        <RestaurantSearch
          label="Escolher o restaurante"
          onPick={(picked) => {
            setPlace(picked);
            setSearching(false);
          }}
          onClose={() => setSearching(false)}
        />
      )}
    </>
  );
}
