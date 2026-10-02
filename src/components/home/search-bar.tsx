"use client";

import { MagnifierIcon } from "./search-modal";

// Floating rounded bar at the bottom of the map, left of the fork menu; tapping it opens the search.
export function SearchBar({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="absolute right-[calc(env(safe-area-inset-right)+5.25rem)] bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-[calc(env(safe-area-inset-left)+1rem)] z-20 flex h-14 items-center gap-3 rounded-full bg-white px-5 text-left text-base text-neutral-500 shadow-lg ring-1 ring-black/5 transition active:scale-[0.98]"
    >
      <MagnifierIcon className="size-5 shrink-0 text-accent" />
      <span className="truncate">Pesquisar restaurantes</span>
    </button>
  );
}
