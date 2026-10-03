"use client";

import { useEffect, useState } from "react";
import type { EntryDetails } from "@/lib/list/details";
import { LIST_LABELS, type ListItem, type ListStatus } from "@/lib/list/types";
import { kindEmoji, kindsLabel, placeKinds } from "@/lib/map/restaurants";
import { NotesField, RatingField } from "./entry-fields";

type Props = {
  item: ListItem;
  saving: boolean;
  // Resolves true once saved (the sheet then closes).
  onSave: (status: ListStatus, details: EntryDetails) => Promise<boolean>;
  onShowOnMap: () => void;
  onClose: () => void;
};

// Centered dialog over "A minha lista": edit a place's rating and notes without going to the map.
// "Minha lista": rating + notes. "Quero ir!": notes only, plus "Já fui" to rate it and move it to "Minha lista".
export function EntrySheet({ item, saving, onSave, onShowOnMap, onClose }: Props) {
  const [status, setStatus] = useState<ListStatus>(item.status);
  const [rating, setRating] = useState<number | null>(item.rating);
  const [notes, setNotes] = useState(item.notes ?? "");
  const moving = item.status === "want" && status === "saved";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Before the list's own Escape handling (which would close the list).
      event.stopImmediatePropagation();
      onClose();
    }
    document.addEventListener("keydown", onKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [onClose]);

  async function save() {
    const details = { rating: status === "saved" ? rating : null, notes: notes.trim() || null };
    if (await onSave(status, details)) onClose();
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 px-5 motion-safe:animate-[fade-in_150ms_ease-out]" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-sheet-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="flex max-h-[90dvh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-2xl">
            {kindEmoji(item.kind)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="entry-sheet-title" className="truncate text-xl font-semibold">
              {item.name}
            </h2>
            <p className="text-sm text-neutral-500">
              {kindsLabel(placeKinds(item))} · {moving ? `${LIST_LABELS.want} → ${LIST_LABELS.saved}` : LIST_LABELS[item.status]}
            </p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="-m-1 p-1 leading-none text-neutral-500">
            ✕
          </button>
        </div>

        {status === "saved" && <RatingField rating={rating} onChange={setRating} />}
        <NotesField notes={notes} onChange={setNotes} />

        {item.status === "want" && !moving && (
          <button
            type="button"
            onClick={() => setStatus("saved")}
            className="flex h-12 items-center justify-center gap-2 rounded-full border-2 border-accent font-semibold text-accent"
          >
            <span aria-hidden="true">⭐</span>Já fui — dar nota
          </button>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={moving ? () => setStatus("want") : onClose}
            className="h-12 flex-1 rounded-full border-2 border-neutral-200 font-semibold text-neutral-700"
          >
            {moving ? "Voltar" : "Cancelar"}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-12 flex-[2] rounded-full bg-accent font-semibold text-white shadow disabled:opacity-60"
          >
            {saving ? "A guardar…" : moving ? `Mover para ${LIST_LABELS.saved}` : "Guardar 👌"}
          </button>
        </div>

        <button type="button" onClick={onShowOnMap} className="text-center text-sm text-neutral-600 underline">
          <span aria-hidden="true">📍 </span>Ver no mapa
        </button>
      </form>
    </div>
  );
}
