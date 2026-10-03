"use client";

import { ProfileLink } from "./profile-link";
import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";
import { setEventLocation, setEventStartTime, suggestEventLocation, withdrawLocationSuggestion, type GroupEvent } from "@/app/social/groups";
import { SearchModal } from "@/components/home/search-modal";
import { PORTO } from "@/lib/map/config";
import { mapHref } from "@/lib/map/place-link";
import { kindEmoji, kindsLabel, placeKinds, type SelectedPlace } from "@/lib/map/restaurants";
import type { SearchResult } from "@/lib/search/photon";
import { PersonAvatar, primary, secondary } from "./groups-tab";

// A search result as a plain place (what the server stores).
export function toPlace(result: SearchResult): SelectedPlace {
  return { id: result.id, name: result.name, kind: result.kind, kinds: result.kinds, lat: result.lat, lng: result.lng };
}

// Restaurant search for events: biased towards Porto (the country can be chosen in the search). Rendered at the
// top of the page so the animated cards around it cannot cover it.
export function RestaurantSearch({ label, onPick, onClose }: { label: string; onPick: (place: SelectedPlace) => void; onClose: () => void }) {
  return createPortal(
    <SearchModal near={PORTO} label={label} onPick={(result) => onPick(toPlace(result))} onClose={onClose} />,
    document.body,
  );
}

type Props = { event: GroupEvent; onChanged: () => Promise<void> };

// Where (once the event has a date). Set: the restaurant, "Ver no mapa", and for the mordomo "Mudar".
// Not set: who is going suggests restaurants; the mordomo picks one of them or any other.
export function LocationSection({ event, onChanged }: Props) {
  const [searching, setSearching] = useState<"set" | "suggest" | null>(null);
  const [busy, setBusy] = useState(false);
  // The mordomo editing the start time: the value in the time field.
  const [timeDraft, setTimeDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mordomoName = event.mordomo?.displayName ?? "O mordomo";

  async function run(action: () => Promise<{ ok: boolean }>, failure = "Não foi possível. Tenta outra vez.") {
    setBusy(true);
    setError(null);
    const { ok } = await action();
    if (ok) await onChanged();
    else setError(failure);
    setBusy(false);
  }

  function picked(place: SelectedPlace) {
    const mode = searching;
    setSearching(null);
    if (mode === "set") void run(() => setEventLocation(event.id, place));
    else void run(() => suggestEventLocation(event.id, place), "Não foi possível sugerir. Talvez o local já esteja escolhido.");
  }

  const search = searching && (
    <RestaurantSearch
      label={searching === "set" ? "Escolher o restaurante" : "Sugerir um restaurante"}
      onPick={picked}
      onClose={() => setSearching(null)}
    />
  );

  if (event.location) {
    const place = event.location;
    return (
      <section className="rounded-3xl bg-white p-5 shadow-sm motion-safe:animate-[sheet-up_400ms_ease-out_both]">
        <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">Onde</p>
        <div className="mt-2 flex items-center gap-3">
          <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-3xl">
            {kindEmoji(place.kind)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xl font-bold">{place.name}</span>
            <span className="block text-sm text-neutral-500">{kindsLabel(placeKinds(place))}</span>
          </span>
        </div>
        <StartTime
          event={event}
          draft={timeDraft}
          busy={busy}
          onDraft={setTimeDraft}
          onSave={(time) => {
            setTimeDraft(null);
            void run(() => setEventStartTime(event.id, time));
          }}
        />
        <div className="mt-4 flex gap-2">
          <Link href={mapHref(place)} className={`${primary} flex flex-1 items-center justify-center gap-1.5`}>
            <span aria-hidden="true">🗺️</span> Ver no mapa
          </Link>
          {event.isMordomo && (
            <button type="button" disabled={busy} onClick={() => setSearching("set")} className={`${secondary} flex-1`}>
              Mudar local
            </button>
          )}
        </div>
        {event.isMordomo && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Tirar o local? Quem vai pode voltar a sugerir restaurantes.")) void run(() => setEventLocation(event.id, null));
            }}
            className="mt-2 w-full text-center text-xs text-neutral-400 underline"
          >
            Tirar o local
          </button>
        )}
        {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {search}
      </section>
    );
  }

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-2 ring-sky-200 motion-safe:animate-[sheet-up_400ms_ease-out_both]">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-3xl">
          📍
        </span>
        <div>
          <h2 className="text-lg font-bold">Onde vai ser?</h2>
          <p className="text-sm text-neutral-600">
            {event.isMordomo
              ? "Escolhe o restaurante, ou espera pelas sugestões de quem vai."
              : event.canSuggest
                ? `${mordomoName} ainda não escolheu o local. Sugere um restaurante!`
                : `${mordomoName} ainda não escolheu o local. Só quem vai pode sugerir.`}
          </p>
        </div>
      </div>

      {event.suggestions.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {event.suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
              className="flex items-center gap-3 rounded-2xl bg-sky-50/60 px-3 py-2.5 ring-1 ring-sky-100 motion-safe:animate-[fork-pop_260ms_ease-out_both]"
            >
              <span aria-hidden="true" className="text-2xl">
                {kindEmoji(suggestion.place.kind)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{suggestion.place.name}</span>
                <Link href={mapHref(suggestion.place)} className="text-xs font-medium text-sky-700 underline">
                  Ver no mapa
                </Link>
              </span>
              {suggestion.by && (
                <ProfileLink person={suggestion.by} className="shrink-0">
                  <span title={`Sugerido por ${suggestion.by.displayName}`}>
                    <PersonAvatar person={suggestion.by} className="size-7 text-[11px] ring-2 ring-white" />
                  </span>
                </ProfileLink>
              )}
              {event.isMordomo ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => setEventLocation(event.id, suggestion.place))}
                  className="h-9 shrink-0 rounded-full bg-accent px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Escolher
                </button>
              ) : (
                suggestion.mine && (
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={`Retirar a sugestão ${suggestion.place.name}`}
                    onClick={() => run(() => withdrawLocationSuggestion(suggestion.id))}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-white"
                  >
                    ✕
                  </button>
                )
              )}
            </li>
          ))}
        </ul>
      )}

      {event.isMordomo ? (
        <button type="button" disabled={busy} onClick={() => setSearching("set")} className={`${primary} mt-4 flex h-12 w-full items-center justify-center gap-2 text-base`}>
          <span aria-hidden="true">📍</span> {event.suggestions.length ? "Escolher outro restaurante" : "Escolher restaurante"}
        </button>
      ) : (
        event.canSuggest && (
          <button type="button" disabled={busy} onClick={() => setSearching("suggest")} className={`${secondary} mt-4 flex h-12 w-full items-center justify-center gap-2 text-base`}>
            <span aria-hidden="true">💡</span> Sugerir restaurante
          </button>
        )
      )}

      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {search}
    </section>
  );
}

// When it starts: "às 20:30" or "Hora por definir". The mordomo sets, changes or clears it (time field + Guardar).
function StartTime({
  event,
  draft,
  busy,
  onDraft,
  onSave,
}: {
  event: GroupEvent;
  draft: string | null;
  busy: boolean;
  onDraft: (value: string | null) => void;
  onSave: (time: string | null) => void;
}) {
  if (draft !== null) {
    return (
      <form
        className="mt-3 flex flex-col gap-2 rounded-2xl bg-orange-50 p-3"
        onSubmit={(submit) => {
          submit.preventDefault();
          if (draft) onSave(draft);
        }}
      >
        <label className="flex items-center gap-2">
          <span aria-hidden="true" className="text-xl">
            🕗
          </span>
          <input
            type="time"
            aria-label="Hora de início"
            value={draft}
            onChange={(change) => onDraft(change.target.value)}
            autoFocus
            required
          className="h-11 min-w-0 flex-1 rounded-xl border border-orange-200 bg-white px-3 text-lg font-semibold outline-none focus:border-accent"
          />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => onDraft(null)} className={`${secondary} flex-1`}>
            Cancelar
          </button>
          <button type="submit" disabled={busy || !draft} className={`${primary} flex-1`}>
            Guardar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl bg-neutral-50 px-3 py-2.5">
      <span aria-hidden="true" className="text-xl">
        🕗
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold tracking-wide text-neutral-400 uppercase">Hora</span>
        {event.startTime ? (
          <span className="block text-lg font-bold">às {event.startTime}</span>
        ) : (
          <span className="block text-sm text-neutral-500">Hora por definir</span>
        )}
      </span>
      {event.isMordomo && (
        <span className="flex shrink-0 items-center gap-1">
          {event.startTime && (
            <button
              type="button"
              disabled={busy}
              aria-label="Tirar a hora"
              onClick={() => onSave(null)}
              className="flex size-9 items-center justify-center rounded-full text-neutral-400 hover:bg-white"
            >
              ✕
            </button>
          )}
          <button type="button" disabled={busy} onClick={() => onDraft(event.startTime ?? "20:00")} className={secondary}>
            {event.startTime ? "Mudar" : "Definir hora"}
          </button>
        </span>
      )}
    </div>
  );
}
