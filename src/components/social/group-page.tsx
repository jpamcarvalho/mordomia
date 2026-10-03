"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  acceptGroupInvite,
  createGroupEvent,
  deleteGroupEvent,
  loadGroup,
  loadGroupEvents,
  removeGroupMember,
  type Group,
  type GroupEvent,
} from "@/app/social/groups";
import type { Person } from "@/app/social/actions";
import { Spinner } from "@/components/spinner";
import { EVENT_TITLE_MAX } from "@/lib/social/groups";
import { formatDay, formatDayTime } from "@/lib/social/dates";
import { mapHref } from "@/lib/map/place-link";
import { kindEmoji } from "@/lib/map/restaurants";
import { priceWinner } from "./event-past";
import { ConnoisseurPill, GroupPhoto, GroupSheet, PersonAvatar, Sheet, SheetHeader, groupHref, memberCount, primary, secondary } from "./groups-tab";

type Props = {
  userId: string;
  initialGroup: Group;
  initialEvents: GroupEvent[];
  // My friends, to invite.
  friends: Person[];
};

type EventsTab = "abertos" | "passados";

const GROUPS_HREF = "/social?tab=grupos";

// A group's page: photo, name and member count, then the group's events. The floating + creates an event;
// the info button opens the members / invite / edit sheet.
export function GroupPage({ userId, initialGroup, initialEvents, friends }: Props) {
  const router = useRouter();
  const [group, setGroup] = useState(initialGroup);
  const [events, setEvents] = useState(initialEvents);
  const [info, setInfo] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const member = group.myStatus === "member";
  // The tab lives in the URL (?eventos=passados), so coming back from an event lands on it.
  const tab: EventsTab = useSearchParams().get("eventos") === "passados" ? "passados" : "abertos";
  const openEvents = events.filter((event) => !event.closedAt);
  // Most recent first.
  const pastEvents = events
    .filter((event) => event.closedAt)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.closedAt!.localeCompare(a.closedAt!));

  function chooseTab(next: EventsTab) {
    window.history.replaceState(null, "", next === "passados" ? "?eventos=passados" : window.location.pathname);
  }

  async function refreshGroup() {
    const next = await loadGroup(group.id);
    // Deleted, or I left: back to my groups.
    if (!next) {
      router.replace(GROUPS_HREF);
      return;
    }
    setGroup(next);
  }

  async function refreshEvents() {
    setEvents(await loadGroupEvents(group.id));
  }

  async function answerInvite(accept: boolean) {
    setBusy(true);
    setError(null);
    const { ok } = accept ? await acceptGroupInvite(group.id) : await removeGroupMember(group.id, userId);
    if (!ok) setError("Não foi possível. Tenta outra vez.");
    else if (accept) await Promise.all([refreshGroup(), refreshEvents()]);
    else router.replace(GROUPS_HREF);
    setBusy(false);
  }

  return (
    <main className="min-h-dvh bg-neutral-50 pb-[calc(env(safe-area-inset-bottom)+11rem)]">
      <div className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => (window.history.length > 1 ? router.back() : router.push(GROUPS_HREF))}
            className="-ml-1 flex size-10 items-center justify-center rounded-full hover:bg-neutral-100"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Membros e definições do grupo"
            onClick={() => setInfo(true)}
            className="-mr-1 flex size-10 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="size-6">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
        </div>

        <header className="mt-2 flex flex-col items-center text-center motion-safe:animate-[sheet-up_400ms_ease-out_both]">
          <GroupPhoto group={group} className="size-24 text-4xl shadow-md" />
          <h1 className="mt-3 text-2xl font-bold">{group.name}</h1>
          <button type="button" onClick={() => setInfo(true)} className="mt-0.5 text-sm text-neutral-500 hover:text-accent">
            {memberCount(group)}
          </button>
          {group.connoisseur && (
            <span className="mt-3 flex max-w-full">
              <ConnoisseurPill connoisseur={group.connoisseur} />
            </span>
          )}
          {member && (
            <Link
              href={`${groupHref(group.id)}/detalhes`}
              className="mt-3 flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-neutral-700 shadow-sm ring-1 ring-black/5 transition hover:text-accent active:scale-95"
            >
              <span aria-hidden="true">🏆</span> Detalhes do grupo
            </Link>
          )}
        </header>

        {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {member ? (
          <section className="mt-8">
            <div role="tablist" aria-label="Eventos" className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-neutral-200/70 p-1">
              {(
                [
                  ["abertos", "Abertos", openEvents.length],
                  ["passados", "Passados", pastEvents.length],
                ] as const
              ).map(([id, label, count]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => chooseTab(id)}
                  className={`h-9 rounded-full text-sm font-semibold transition ${
                    tab === id ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
                  }`}
                >
                  {id === "passados" ? "🏁 " : ""}
                  {label}
                  {count > 0 && <span className="ml-1 text-xs text-neutral-400">{count}</span>}
                </button>
              ))}
            </div>
            {tab === "passados" ? (
              pastEvents.length === 0 ? (
                <div className="mt-6 flex flex-col items-center gap-1 px-6 text-center">
                  <span aria-hidden="true" className="text-4xl">
                    🏁
                  </span>
                  <p className="font-semibold">Ainda não há eventos passados</p>
                  <p className="text-sm text-neutral-500">Quando o mordomo encerrar um evento, ele aparece aqui.</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {pastEvents.map((event, index) => (
                    <PastEventCard key={event.id} event={event} index={index} />
                  ))}
                </ul>
              )
            ) : openEvents.length === 0 ? (
              <div className="mt-6 flex flex-col items-center gap-1 px-6 text-center">
                <span aria-hidden="true" className="text-4xl">
                  🗓️
                </span>
                <p className="font-semibold">Ainda não há eventos</p>
                <p className="text-sm text-neutral-500">Toca no + para criar o primeiro.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {openEvents.map((event, index) => (
                  <EventCard key={event.id} event={event} index={index} onChanged={refreshEvents} />
                ))}
              </ul>
            )}
          </section>
        ) : (
          <div className="mt-8 rounded-2xl bg-white p-4 text-center shadow-sm ring-2 ring-accent/40">
            <p className="font-semibold">{group.invitedBy ? `${group.invitedBy.displayName} convidou-te` : "Foste convidado"}</p>
            <p className="mt-1 text-sm text-neutral-500">Entra no grupo para veres os eventos.</p>
            <div className="mt-3 flex justify-center gap-2">
              <button type="button" disabled={busy} onClick={() => answerInvite(false)} className={secondary}>
                Recusar
              </button>
              <button type="button" disabled={busy} onClick={() => answerInvite(true)} className={primary}>
                Entrar no grupo
              </button>
            </div>
          </div>
        )}
      </div>

      {member && (
        <button
          type="button"
          aria-label="Criar evento"
          onClick={() => setCreating(true)}
          className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-30 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition active:scale-95 motion-safe:animate-[fork-pop_300ms_ease-out_both]"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="size-7">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {creating && (
        <EventForm
          groupId={group.id}
          onClose={() => setCreating(false)}
          // A new event opens on its own page (where a missing mordomo is chosen first).
          onCreated={(id) => router.push(eventHref(group.id, id))}
        />
      )}
      {info && (
        <GroupSheet
          group={group}
          userId={userId}
          friends={friends}
          onClose={() => setInfo(false)}
          onChanged={refreshGroup}
        />
      )}
    </main>
  );
}

function EventForm({ groupId, onClose, onCreated }: { groupId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [mordomo, setMordomo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const result = await createGroupEvent(groupId, { title, mordomo });
    if (result.ok && result.id) onCreated(result.id);
    else {
      setError(result.error ?? "Não foi possível guardar. Tenta outra vez.");
      setSaving(false);
    }
  }

  return (
    <Sheet label="Novo evento" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim() && !saving) void save();
        }}
      >
        <SheetHeader title="Novo evento" onClose={onClose} />
        <label className="flex flex-col gap-1">
          <span className="flex justify-between text-sm font-medium">
            Nome do evento{" "}
            <span className="font-normal text-neutral-400">
              {title.length}/{EVENT_TITLE_MAX}
            </span>
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={EVENT_TITLE_MAX}
            placeholder="Ex.: Jantar de anos da Rita"
            autoFocus
            className="h-12 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-base outline-none focus:border-accent focus:bg-white"
          />
        </label>

        <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3">
          <span aria-hidden="true" className="text-2xl">
            🎩
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Sou o mordomo</span>
            <span className="block text-sm text-neutral-500">Quem organiza o evento. Podes deixar para depois.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={mordomo}
            onChange={(event) => setMordomo(event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-7 w-12 shrink-0 rounded-full bg-neutral-300 transition peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40 after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5"
          />
        </label>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <button type="submit" disabled={!title.trim() || saving} className={`${primary} flex h-12 items-center justify-center gap-2 text-base`}>
          {saving && <Spinner className="size-5 border-white/30 border-t-white" />}
          Criar evento
        </button>
      </form>
    </Sheet>
  );
}

function EventCard({ event, index, onChanged }: { event: GroupEvent; index: number; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Apagar o evento “${event.title}”?`)) return;
    setBusy(true);
    if ((await deleteGroupEvent(event.id)).ok) await onChanged();
    setBusy(false);
  }

  return (
    <li
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 motion-safe:animate-[fork-pop_260ms_ease-out_both]"
    >
      <div className="flex items-start gap-2">
        <Link href={eventHref(event.groupId, event.id)} className="group min-w-0 flex-1">
          <p className="text-lg leading-snug font-semibold group-hover:text-accent">
            {event.title} <span aria-hidden="true" className="text-neutral-300">›</span>
          </p>
          {event.mordomo ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-neutral-500">
              <span aria-hidden="true">🎩</span>
              Mordomo: <span className="font-semibold text-foreground">{event.mordomo.displayName}</span>
            </p>
          ) : (
            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              <span aria-hidden="true">🎩</span> Falta escolher o mordomo
            </p>
          )}
        </Link>
        {event.canDelete && (
          <button
            type="button"
            disabled={busy}
            aria-label={`Apagar o evento ${event.title}`}
            onClick={remove}
            className="-mt-1 -mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100"
          >
            ✕
          </button>
        )}
      </div>
      {event.date ? (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-100 to-rose-100 px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-orange-800">🎉 Habemus data</span>
            <span className="block truncate text-sm font-semibold first-letter:uppercase">{formatDayTime(event.date, event.startTime)}</span>
          </span>
          <span className="flex -space-x-2">
            {event.going.slice(0, 4).map((person) => (
              <PersonAvatar key={person.id} person={person} className="size-7 text-[11px] ring-2 ring-white" />
            ))}
          </span>
          <span className="text-xs font-semibold text-neutral-600">{event.going.length === 1 ? "1 vai" : `${event.going.length} vão`}</span>
        </div>
      ) : null}
      {event.date && event.location ? (
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-sky-50 px-3 py-2 ring-1 ring-sky-100">
          <span aria-hidden="true" className="text-xl">
            {kindEmoji(event.location.kind)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-sky-800">📍 Local</span>
            <span className="block truncate text-sm font-semibold">{event.location.name}</span>
          </span>
          <Link href={mapHref(event.location)} className="shrink-0 text-xs font-semibold text-sky-700 underline">
            Ver no mapa
          </Link>
        </div>
      ) : event.date ? (
        <p className="mt-2 text-sm text-neutral-500">
          📍 Ainda sem local
          {event.suggestions.length > 0 &&
            ` · ${event.suggestions.length === 1 ? "1 sugestão" : `${event.suggestions.length} sugestões`}`}
        </p>
      ) : event.mordomo ? (
        <p className="mt-2 text-sm text-neutral-500">
          {event.dateOptions.length > 0 ? "🗳️ Votação dos dias a decorrer" : "📅 Ainda sem data"}
        </p>
      ) : null}
    </li>
  );
}

// A closed event in "Passados": when, where, the mordomo and the Preço certo winner; it opens the summary.
function PastEventCard({ event, index }: { event: GroupEvent; index: number }) {
  const winner = priceWinner(event);
  return (
    <li style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }} className="motion-safe:animate-[fork-pop_260ms_ease-out_both]">
      <Link
        href={eventHref(event.groupId, event.id)}
        className="group flex flex-col gap-1.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 transition active:scale-[0.99]"
      >
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-lg font-semibold group-hover:text-accent">{event.title}</span>
          {event.date && <span className="shrink-0 text-xs font-semibold text-neutral-400 first-letter:uppercase">{formatDay(event.date)}</span>}
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-neutral-600">
          {event.mordomo && <span>🎩 {event.mordomo.displayName.split(" ")[0]}</span>}
          {event.location && <span className="max-w-full truncate">📍 {event.location.name}</span>}
          <span>👥 {event.going.length}</span>
          {winner && <span className="font-semibold text-amber-700">👑 {winner.person.displayName.split(" ")[0]}</span>}
        </span>
      </Link>
    </li>
  );
}

export function eventHref(groupId: string, eventId: string): string {
  return `/social/grupos/${groupId}/eventos/${eventId}`;
}
