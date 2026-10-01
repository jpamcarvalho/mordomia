"use client";

import type { ListStatus } from "@/lib/list/types";
import { STATUS_CHIPS, STATUS_COLORS, type ShownLists } from "@/lib/map/my-places";

type Props = {
  shown: ShownLists;
  counts: Record<ListStatus, number>;
  onToggle: (status: ListStatus) => void;
};

const STATUSES: ListStatus[] = ["saved", "want"];

// Top-left chips: the map legend for the user's list places, each one showing or hiding its list.
export function ListChips({ shown, counts, onToggle }: Props) {
  return (
    <div className="absolute top-[calc(env(safe-area-inset-top)+1.375rem)] left-[calc(env(safe-area-inset-left)+1rem)] z-20 flex gap-2">
      {STATUSES.map((status) => {
        const { emoji, label } = STATUS_CHIPS[status];
        const on = shown[status];
        return (
          <button
            key={status}
            type="button"
            aria-pressed={on}
            aria-label={`${on ? "Esconder" : "Mostrar"} ${label} no mapa`}
            onClick={() => onToggle(status)}
            className={`flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-sm font-semibold shadow-lg transition active:scale-95 ${
              on ? "text-foreground" : "text-neutral-400"
            }`}
          >
            <span
              aria-hidden="true"
              className="size-3 rounded-full ring-2 ring-white"
              style={{ backgroundColor: on ? STATUS_COLORS[status] : "#d4d4d4" }}
            />
            <span aria-hidden="true" className={on ? "" : "opacity-50 grayscale"}>
              {emoji}
            </span>
            {label}
            <span className="font-normal text-neutral-500">{counts[status]}</span>
          </button>
        );
      })}
    </div>
  );
}
