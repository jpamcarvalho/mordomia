"use client";

import { NOTES_MAX, RATING_MAX, RATING_MIN } from "@/lib/list/details";
import { RATING_GRADIENT, ratingColor } from "@/lib/list/rating-color";

const RATINGS = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

// The 0–10 rating picker of a "Minha lista" place (map popup and list edit sheet).
export function RatingField({ rating, onChange }: { rating: number | null; onChange: (rating: number | null) => void }) {
  return (
    <fieldset>
      <div className="mb-2 flex items-baseline justify-between">
        <legend className="text-sm font-semibold">
          <span aria-hidden="true">⭐ </span>Que nota lhe dás? <span className="font-normal text-neutral-500">(opcional)</span>
        </legend>
        <span aria-live="polite" style={rating === null ? undefined : { color: ratingColor(rating) }} className="text-2xl font-bold text-neutral-400 transition-colors">
          {rating === null ? "–" : rating}
          <span className="text-sm font-medium text-neutral-400">/10</span>
        </span>
      </div>
      <div role="radiogroup" aria-label="Nota de 0 a 10" className="grid grid-cols-6 gap-2">
        {RATINGS.map((value) => {
          const active = rating === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${value} em 10`}
              // Tapping the chosen number again clears the rating.
              onClick={() => onChange(active ? null : value)}
              style={active ? { backgroundColor: ratingColor(value) } : { boxShadow: `inset 0 -3px 0 ${ratingColor(value)}` }}
              className={`h-11 rounded-xl text-base font-semibold transition active:scale-95 ${
                active ? "text-white shadow" : "bg-neutral-100 text-neutral-700"
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
      <div aria-hidden="true" style={{ background: RATING_GRADIENT }} className="mt-3 h-1.5 rounded-full" />
    </fieldset>
  );
}

export function NotesField({ notes, onChange }: { notes: string; onChange: (notes: string) => void }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold"><span aria-hidden="true">📝 </span>Notas</span>
      <textarea
        value={notes}
        onChange={(event) => onChange(event.target.value)}
        maxLength={NOTES_MAX}
        rows={4}
        placeholder="O que queres lembrar? Pratos, com quem foste, preço…"
        className="resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-base outline-none focus:border-accent focus:bg-white"
      />
    </label>
  );
}
