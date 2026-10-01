// The user's own list places drawn on the home map, colored by list.
import type { ListItem, ListStatus } from "@/lib/list/types";

// "Já fui" uses the accent; "Quero ir" a hue far from it and from the blue user dot.
export const STATUS_COLORS: Record<ListStatus, string> = {
  saved: "#c2410c",
  want: "#7c3aed",
};

export const STATUS_CHIPS: Record<ListStatus, { emoji: string; label: string }> = {
  saved: { emoji: "⭐", label: "Já fui" },
  want: { emoji: "🤤", label: "Quero ir" },
};

export type ShownLists = Record<ListStatus, boolean>;

export const ALL_LISTS: ShownLists = { saved: true, want: true };

// One item per place from the shown lists; a place on both lists counts as "Já fui".
export function shownPlaces(items: ListItem[], shown: ShownLists): ListItem[] {
  const byPlace = new Map<string, ListItem>();
  for (const item of items) {
    if (!shown[item.status]) continue;
    const other = byPlace.get(item.placeId);
    if (!other || (other.status === "want" && item.status === "saved")) byPlace.set(item.placeId, item);
  }
  return [...byPlace.values()];
}

export function myPlacesData(items: ListItem[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: items.map((item) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [item.lng, item.lat] },
      properties: { placeId: item.placeId, name: item.name, class: item.kind ?? "restaurant", status: item.status },
    })),
  };
}

// Restores a stored chip state; anything unreadable shows both lists.
export function parseShownLists(value: string | null): ShownLists {
  if (!value) return ALL_LISTS;
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return ALL_LISTS;
    const { saved, want } = parsed as Record<string, unknown>;
    return { saved: saved !== false, want: want !== false };
  } catch {
    return ALL_LISTS;
  }
}
