"use client";

import { useEffect, useState } from "react";
import { LIST_LABELS, LIST_STATUSES, type ListItem, type ListStatus } from "@/lib/list/types";
import { kindEmoji, kindLabel } from "@/lib/map/restaurants";
import { CutleryIcon } from "./list-fab";

// The popup button that puts a place on each list (PlaceDialog).
const ADD_BUTTON_LABELS: Record<ListStatus, string> = {
  saved: "Adiciona à minha lista",
  want: "Quero ir!",
};

type Props = {
  items: ListItem[];
  removing: string | null;
  onPick: (item: ListItem) => void;
  onRemove: (item: ListItem) => void;
  onClose: () => void;
};

// Full-screen page with the user's two private lists as tabs.
export function ListPanel({ items, removing, onPick, onRemove, onClose }: Props) {
  // Open on the first list that has something in it.
  const [tab, setTab] = useState<ListStatus>(
    () => LIST_STATUSES.find((status) => items.some((item) => item.status === status)) ?? "saved",
  );
  const shown = items.filter((item) => item.status === tab);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="My list"
      className="absolute inset-0 z-40 flex flex-col bg-neutral-50 motion-safe:animate-[sheet-up_220ms_ease-out]"
    >
      <header className="bg-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Back to map"
            onClick={onClose}
            className="-ml-1 flex size-10 items-center justify-center rounded-full text-foreground hover:bg-neutral-100"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">My list</h1>
            <p className="text-sm text-neutral-500">
              {items.length === 1 ? "1 restaurant" : `${items.length} restaurants`}
            </p>
          </div>
        </div>

        <div role="tablist" className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-neutral-100 p-1">
          {LIST_STATUSES.map((status) => {
            const count = items.filter((item) => item.status === status).length;
            const active = tab === status;
            return (
              <button
                key={status}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(status)}
                className={`flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${
                  active ? "bg-accent text-white shadow" : "text-neutral-600"
                }`}
              >
                {LIST_LABELS[status]}
                <span
                  className={`min-w-5 rounded-full px-1.5 text-xs ${
                    active ? "bg-white/25 text-white" : "bg-neutral-200 text-neutral-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        {shown.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-accent/10 text-accent">
              <CutleryIcon className="size-10" />
            </span>
            <p className="text-lg font-semibold">Nothing here yet</p>
            <p className="max-w-64 text-sm text-neutral-500">
              Tap a restaurant on the map and choose “{ADD_BUTTON_LABELS[tab]}”.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 h-11 rounded-full bg-accent px-6 text-sm font-semibold text-white shadow"
            >
              Explore the map
            </button>
          </div>
        ) : (
          <ul role="tabpanel" className="flex flex-col gap-3">
            {shown.map((item) => (
              <li
                key={item.entryId}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5"
              >
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-2xl"
                  >
                    {kindEmoji(item.kind)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-base font-semibold">{item.name}</span>
                      {item.rating !== null && (
                        <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                          {item.rating}/10
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-sm text-neutral-500">
                      {item.kind ? kindLabel(item.kind) : "Restaurant"}
                      <span aria-hidden="true">·</span>
                      <span className="text-accent">See on map</span>
                    </span>
                    {item.notes && (
                      <span className="mt-1 line-clamp-2 text-sm whitespace-pre-line text-neutral-600">{item.notes}</span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  disabled={removing === item.entryId}
                  onClick={() => onRemove(item)}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
