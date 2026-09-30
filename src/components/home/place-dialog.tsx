"use client";

import { useEffect } from "react";
import { LIST_LABELS, type ListStatus } from "@/lib/list/types";
import { kindLabel, type SelectedPlace } from "@/lib/map/restaurants";

type Props = {
  place: SelectedPlace;
  // The list the place is already on, if any.
  current: ListStatus | null;
  // The list being saved to right now.
  pending: ListStatus | null;
  onChoose: (status: ListStatus) => void;
  onClose: () => void;
};

const OPTIONS: { status: ListStatus; label: string }[] = [
  { status: "saved", label: "Adiciona à minha lista" },
  { status: "want", label: "Quero ir!" },
];

// Centered dialog for the restaurant tapped on the map: put it on one of the two lists.
export function PlaceDialog({ place, current, pending, onChoose, onClose }: Props) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${place.name} ${place.lat},${place.lng}`,
  )}`;

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 px-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-dialog-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-accent uppercase">{kindLabel(place.kind)}</p>
            <h2 id="place-dialog-title" className="text-xl font-semibold">
              {place.name}
            </h2>
            {current && <p className="mt-1 text-sm text-neutral-500">Em: {LIST_LABELS[current]}</p>}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="-m-1 p-1 leading-none text-neutral-500">
            ✕
          </button>
        </div>
        <div className="mt-5 flex flex-col gap-3">
          {OPTIONS.map(({ status, label }) => {
            const active = current === status;
            return (
              <button
                key={status}
                type="button"
                disabled={active || pending !== null}
                aria-pressed={active}
                onClick={() => onChoose(status)}
                className={`flex h-12 items-center justify-center gap-2 rounded-full font-semibold disabled:opacity-60 ${
                  status === "want" ? "bg-accent text-white" : "border-2 border-accent text-accent"
                }`}
              >
                {active && <span aria-hidden="true">✓</span>}
                {pending === status ? "…" : label}
              </button>
            );
          })}
        </div>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block text-center text-sm text-neutral-600 underline"
        >
          Open in Maps
        </a>
      </div>
    </div>
  );
}
