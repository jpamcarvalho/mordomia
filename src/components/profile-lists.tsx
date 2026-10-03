"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { ENTER } from "@/components/enter";
import { ratingColor } from "@/lib/list/rating-color";
import type { ListItem, ListStatus } from "@/lib/list/types";
import { mapHref } from "@/lib/map/place-link";
import { kindEmoji, kindsLabel, placeKinds } from "@/lib/map/restaurants";

type Tab = { label: string; empty: string };

// Someone's two lists (a friend's profile or my account): tabs for "been there" / "want to go"; each restaurant
// opens on the map.
export function ProfileLists({
  items,
  title,
  tabs,
  style,
}: {
  items: ListItem[];
  title: string;
  tabs: Record<ListStatus, Tab>;
  style: CSSProperties;
}) {
  const [tab, onTab] = useState<ListStatus>("saved");
  const shown = items.filter((item) => item.status === tab);
  const statuses: ListStatus[] = ["saved", "want"];

  return (
    <section style={style} className={`rounded-3xl bg-white p-5 shadow-sm ${ENTER}`}>
      <h2 className="font-semibold">{title}</h2>
      <div role="tablist" className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-neutral-100 p-1">
        {statuses.map((status) => {
          const active = tab === status;
          return (
            <button
              key={status}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => onTab(status)}
              className={`flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${
                active ? "bg-accent text-white shadow" : "text-neutral-600"
              }`}
            >
              {tabs[status].label}
              <span className={`min-w-5 rounded-full px-1.5 text-xs ${active ? "bg-white/25 text-white" : "bg-neutral-200 text-neutral-600"}`}>
                {items.filter((item) => item.status === status).length}
              </span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">{tabs[tab].empty}</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {shown.map((item) => (
            <li key={item.entryId}>
              <Link
                href={mapHref({ id: item.placeId, name: item.name, kind: item.kind ?? "restaurant", lat: item.lat, lng: item.lng })}
                className="flex items-center gap-3 rounded-2xl bg-neutral-50 p-3 transition hover:bg-orange-50 active:scale-[0.98]"
              >
                <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-2xl">
                  {kindEmoji(item.kind)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{item.name}</span>
                    {item.rating !== null && (
                      <span style={{ backgroundColor: ratingColor(item.rating) }} className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white">
                        {item.rating}/10
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-sm text-neutral-500">
                    {item.kind ? kindsLabel(placeKinds(item)) : "Restaurante"}
                    <span aria-hidden="true">·</span>
                    <span className="text-accent">Ver no mapa</span>
                  </span>
                  {item.notes && <span className="mt-1 line-clamp-2 text-sm whitespace-pre-line text-neutral-600">{item.notes}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
