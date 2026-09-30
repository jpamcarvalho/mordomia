import { describe, expect, it } from "vitest";
import type { FoodClass } from "@/lib/map/restaurants";
import { filterByKinds, filterByRating, kindCounts, ratingOptions, sameRatingFilter } from "./filter";
import type { ListItem } from "./types";

function item(entryId: string, kind: FoodClass | null, kinds?: FoodClass[], rating: number | null = null): ListItem {
  return { entryId, status: "saved", placeId: entryId, name: entryId, kind, kinds, lat: 41, lng: -8, rating, notes: null };
}

const ITEMS = [
  item("tasca", "restaurant"),
  item("padaria-cafe", "cafe", ["cafe", "bakery"]),
  item("cafe", "cafe"),
  item("unknown", null),
];

describe("kindCounts", () => {
  it("counts every type of each place, in type order, skipping absent types", () => {
    expect(kindCounts(ITEMS)).toEqual([
      { kind: "restaurant", count: 1 },
      { kind: "cafe", count: 2 },
      { kind: "bakery", count: 1 },
    ]);
  });

  it("is empty for no items", () => {
    expect(kindCounts([])).toEqual([]);
  });
});

describe("filterByKinds", () => {
  it("returns everything when no type is chosen", () => {
    expect(filterByKinds(ITEMS, [])).toBe(ITEMS);
  });

  it("matches any chosen type, including extra types", () => {
    expect(filterByKinds(ITEMS, ["bakery"]).map((i) => i.entryId)).toEqual(["padaria-cafe"]);
    expect(filterByKinds(ITEMS, ["restaurant", "bakery"]).map((i) => i.entryId)).toEqual(["tasca", "padaria-cafe"]);
  });

  it("never matches places without a type", () => {
    expect(filterByKinds(ITEMS, ["cafe"]).map((i) => i.entryId)).toEqual(["padaria-cafe", "cafe"]);
  });
});

describe("filterByRating", () => {
  const RATED = [item("six", "cafe", undefined, 6), item("none", "cafe"), item("ten", "bar", undefined, 10), item("seven", "bar", undefined, 7)];

  it("returns everything, in order, without a filter", () => {
    expect(filterByRating(RATED, null)).toBe(RATED);
  });

  it("keeps ratings at or above the minimum, best first", () => {
    expect(filterByRating(RATED, { min: 7 }).map((i) => i.entryId)).toEqual(["ten", "seven"]);
    expect(filterByRating(RATED, { min: 9 }).map((i) => i.entryId)).toEqual(["ten"]);
  });

  it("can show only places without a rating", () => {
    expect(filterByRating(RATED, "unrated").map((i) => i.entryId)).toEqual(["none"]);
  });
});

describe("ratingOptions", () => {
  it("offers the ratings the user gave, best first, counting places at or above each", () => {
    const items = [item("a", "cafe", undefined, 7), item("b", "cafe", undefined, 10), item("c", "cafe", undefined, 7), item("d", "cafe")];
    expect(ratingOptions(items)).toEqual([
      { filter: { min: 10 }, label: "10", count: 1 },
      { filter: { min: 7 }, label: "7+", count: 3 },
      { filter: "unrated", label: "Sem nota", count: 1 },
    ]);
  });

  it("leaves out Sem nota when everything is rated, and is empty for no items", () => {
    expect(ratingOptions([item("a", "cafe", undefined, 5)])).toEqual([{ filter: { min: 5 }, label: "5+", count: 1 }]);
    expect(ratingOptions([])).toEqual([]);
  });
});

describe("sameRatingFilter", () => {
  it("compares filters by value", () => {
    expect(sameRatingFilter({ min: 7 }, { min: 7 })).toBe(true);
    expect(sameRatingFilter({ min: 7 }, { min: 8 })).toBe(false);
    expect(sameRatingFilter("unrated", "unrated")).toBe(true);
    expect(sameRatingFilter(null, null)).toBe(true);
    expect(sameRatingFilter(null, "unrated")).toBe(false);
  });
});
