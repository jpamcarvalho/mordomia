"use client";

import { useEffect, useState } from "react";
import { NOTES_MAX, RATING_MAX, RATING_MIN, type EntryDetails } from "@/lib/list/details";
import { LIST_LABELS, type ListItem, type ListStatus } from "@/lib/list/types";
import { kindLabel, type SelectedPlace } from "@/lib/map/restaurants";

type Props = {
  place: SelectedPlace;
  // The list entry for this place, if it is already on a list.
  current: ListItem | null;
  // The list being saved to right now.
  pending: ListStatus | null;
  // origin: the tapped button, where the "added" animation starts.
  onChoose: (status: ListStatus, details: EntryDetails | undefined, origin: DOMRect) => void;
  onClose: () => void;
};

const RATINGS = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

// Centered dialog for the restaurant tapped on the map: put it on one of the two lists.
// "Adiciona à minha lista" first opens a form with a 0–10 rating and notes.
export function PlaceDialog({ place, current, pending, onChoose, onClose }: Props) {
  const [view, setView] = useState<"choose" | "form">("choose");
  const [rating, setRating] = useState<number | null>(current?.status === "saved" ? current.rating : null);
  const [notes, setNotes] = useState(current?.notes ?? "");

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
  const isSaved = current?.status === "saved";
  const isWant = current?.status === "want";

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 px-5" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-dialog-title"
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium tracking-wide text-accent uppercase">{kindLabel(place.kind)}</p>
            <h2 id="place-dialog-title" className="text-xl font-semibold">
              {place.name}
            </h2>
            {view === "choose" && current && (
              <p className="mt-1 text-sm text-neutral-500">
                Em: {LIST_LABELS[current.status]}
                {isSaved && current.rating !== null && ` · ${current.rating}/10`}
              </p>
            )}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="-m-1 p-1 leading-none text-neutral-500">
            ✕
          </button>
        </div>

        {view === "choose" ? (
          <>
            {isSaved && current.notes && (
              <p className="mt-3 line-clamp-3 rounded-xl bg-neutral-50 px-3 py-2 text-sm whitespace-pre-line text-neutral-700">
                {current.notes}
              </p>
            )}
            <div className="mt-5 flex flex-col gap-3">
              <button
                type="button"
                disabled={pending !== null}
                aria-pressed={isSaved}
                onClick={() => setView("form")}
                className="flex h-12 items-center justify-center gap-2 rounded-full border-2 border-accent font-semibold text-accent disabled:opacity-60"
              >
                {isSaved && <span aria-hidden="true">✓</span>}
                {isSaved ? "Edit rating & notes" : "Adiciona à minha lista"}
              </button>
              <button
                type="button"
                disabled={isWant || pending !== null}
                aria-pressed={isWant}
                onClick={(event) => onChoose("want", undefined, event.currentTarget.getBoundingClientRect())}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent font-semibold text-white disabled:opacity-60"
              >
                {isWant && <span aria-hidden="true">✓</span>}
                {pending === "want" ? "…" : "Quero ir!"}
              </button>
            </div>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block text-center text-sm text-neutral-600 underline"
            >
              Open in Maps
            </a>
          </>
        ) : (
          <form
            className="mt-4 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const submitter = (event.nativeEvent as SubmitEvent).submitter ?? event.currentTarget;
              onChoose("saved", { rating, notes: notes.trim() || null }, submitter.getBoundingClientRect());
            }}
          >
            <fieldset>
              <div className="mb-2 flex items-baseline justify-between">
                <legend className="text-sm font-semibold">
                  Rating <span className="font-normal text-neutral-500">(optional)</span>
                </legend>
                <span aria-live="polite" className="text-2xl font-bold text-accent">
                  {rating === null ? "–" : rating}
                  <span className="text-sm font-medium text-neutral-400">/10</span>
                </span>
              </div>
              <div role="radiogroup" aria-label="Rating from 0 to 10" className="grid grid-cols-6 gap-2">
                {RATINGS.map((value) => {
                  const active = rating === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={`${value} out of 10`}
                      // Tapping the chosen number again clears the rating.
                      onClick={() => setRating(active ? null : value)}
                      className={`h-11 rounded-xl text-base font-semibold transition active:scale-95 ${
                        active ? "bg-accent text-white shadow" : "bg-neutral-100 text-neutral-700"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={NOTES_MAX}
                rows={4}
                placeholder="Whatever you want to remember: dishes, who you went with, price…"
                className="resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-base outline-none focus:border-accent focus:bg-white"
              />
            </label>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setView("choose")}
                className="h-12 flex-1 rounded-full border-2 border-neutral-200 font-semibold text-neutral-700"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={pending !== null}
                className="h-12 flex-[2] rounded-full bg-accent font-semibold text-white shadow disabled:opacity-60"
              >
                {pending === "saved" ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
