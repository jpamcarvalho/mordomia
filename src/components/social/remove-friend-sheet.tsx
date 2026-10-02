"use client";

import { useState } from "react";
import { avatarInitial } from "@/lib/profile/avatar";
import type { Person } from "@/lib/social/people";
import { Sheet } from "./groups-tab";

// "Deixar de ser amigo de …?": the one confirmation used everywhere a friend can be removed.
export function RemoveFriendSheet({
  person,
  onConfirm,
  onClose,
}: {
  person: Person;
  // Resolves when the removal is done (successful or not); the sheet then closes.
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    await onConfirm();
    setBusy(false);
    onClose();
  }

  return (
    <Sheet label="Remover amigo" onClose={() => !busy && onClose()}>
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <span className="flex size-20 items-center justify-center overflow-hidden rounded-full bg-accent text-3xl font-bold text-white shadow ring-4 ring-orange-50">
          {person.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
            <img src={person.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            avatarInitial(person.username)
          )}
        </span>
        <h2 className="mt-2 text-xl font-semibold">Deixar de ser amigo de {person.displayName}?</h2>
        <p className="text-sm text-neutral-500">Deixam de ver as listas um do outro. Podes voltar a enviar um pedido quando quiseres.</p>
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={confirm}
          className="h-12 rounded-full bg-red-600 font-semibold text-white shadow transition active:scale-95 disabled:opacity-50"
        >
          {busy ? "A remover…" : "Remover amigo"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="h-12 rounded-full bg-neutral-100 font-semibold text-neutral-700 transition active:scale-95 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </Sheet>
  );
}
