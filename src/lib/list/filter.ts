import { FOOD_CLASSES, placeKinds, type FoodClass } from "@/lib/map/restaurants";
import type { ListItem } from "./types";

export type KindCount = { kind: FoodClass; count: number };

// How many items have each type (a place with several types counts for each), in the usual type order.
export function kindCounts(items: ListItem[]): KindCount[] {
  return FOOD_CLASSES.flatMap((kind) => {
    const count = items.filter((item) => placeKinds(item).includes(kind)).length;
    return count ? [{ kind, count }] : [];
  });
}

// Items having any of the chosen types; no types chosen → all items.
export function filterByKinds(items: ListItem[], kinds: readonly FoodClass[]): ListItem[] {
  if (kinds.length === 0) return items;
  return items.filter((item) => placeKinds(item).some((kind) => kinds.includes(kind)));
}
