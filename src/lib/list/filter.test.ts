import { describe, expect, it } from "vitest";
import type { FoodClass } from "@/lib/map/restaurants";
import { filterByKinds, kindCounts } from "./filter";
import type { ListItem } from "./types";

function item(entryId: string, kind: FoodClass | null, kinds?: FoodClass[]): ListItem {
  return { entryId, status: "saved", placeId: entryId, name: entryId, kind, kinds, lat: 41, lng: -8, rating: null, notes: null };
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
