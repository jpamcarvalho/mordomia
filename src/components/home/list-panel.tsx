"use client";

import { useState } from "react";
import { LIST_LABELS, LIST_STATUSES, type ListItem, type ListStatus } from "@/lib/list/types";
import { kindLabel } from "@/lib/map/restaurants";

type Props = {
  items: ListItem[];
  removing: string | null;
  onPick: (item: ListItem) => void;
  onRemove: (item: ListItem) => void;
  onClose: () => void;
};

// Bottom sheet with the user's two private lists as tabs.
export function ListPanel({ items, removing, onPick, onRemove, onClose }: Props) {
  const [tab, setTab] = useState<ListStatus>("saved");
  const shown = items.filter((item) => item.status === tab);

  return (
    <section
      aria-label="My list"
      className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
    >
      <div className="mx-auto flex max-h-[60vh] max-w-md flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3">
          <div role="tablist" className="flex flex-1 gap-2">
            {LIST_STATUSES.map((status) => {
              const count = items.filter((item) => item.status === status).length;
              return (
                <button
                  key={status}
                  role="tab"
                  type="button"
                  aria-selected={tab === status}
                  onClick={() => setTab(status)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                    tab === status ? "bg-accent text-white" : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {LIST_LABELS[status]} {count > 0 && <span className="opacity-80">({count})</span>}
                </button>
              );
            })}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="-m-1 p-1 leading-none text-neutral-500">
            ✕
          </button>
        </div>
        {shown.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-neutral-600">Nothing here yet. Tap a restaurant on the map to add it.</p>
        ) : (
          <ul role="tabpanel" className="overflow-y-auto pb-2">
            {shown.map((item) => (
              <li key={item.entryId} className="flex items-center gap-2 border-t border-neutral-100 px-4">
                <button type="button" onClick={() => onPick(item)} className="min-w-0 flex-1 py-3 text-left">
                  <span className="block truncate font-medium">{item.name}</span>
                  {item.kind && <span className="text-xs text-neutral-500">{kindLabel(item.kind)}</span>}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${item.name}`}
                  disabled={removing === item.entryId}
                  onClick={() => onRemove(item)}
                  className="rounded-full px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
