import { RATING_MAX } from "./details";
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

// Rating filter on "Adiciona à minha lista": a minimum rating, or places without a rating.
export type RatingFilter = { min: number } | "unrated";

export type RatingOption = { filter: RatingFilter; label: string; count: number };

// Rating choices for these items: one per rating the user actually gave (best first, "at least" that
// rating), then "Sem nota" when some places have no rating.
export function ratingOptions(items: ListItem[]): RatingOption[] {
  const ratings = [...new Set(items.flatMap((item) => (item.rating === null ? [] : [item.rating])))].sort((a, b) => b - a);
  const options: RatingOption[] = ratings.map((min) => ({
    filter: { min },
    label: min === RATING_MAX ? String(min) : `${min}+`,
    count: items.filter((item) => item.rating !== null && item.rating >= min).length,
  }));
  const unrated = items.filter((item) => item.rating === null).length;
  return unrated ? [...options, { filter: "unrated", label: "Sem nota", count: unrated }] : options;
}

export function sameRatingFilter(a: RatingFilter | null, b: RatingFilter | null): boolean {
  if (a === null || b === null) return a === b;
  return a === "unrated" ? b === "unrated" : b !== "unrated" && a.min === b.min;
}

// Items matching the rating filter, best rated first; null → all items, order kept.
export function filterByRating(items: ListItem[], filter: RatingFilter | null): ListItem[] {
  if (filter === null) return items;
  if (filter === "unrated") return items.filter((item) => item.rating === null);
  return items
    .filter((item): item is ListItem & { rating: number } => item.rating !== null && item.rating >= filter.min)
    .sort((a, b) => b.rating - a.rating);
}
