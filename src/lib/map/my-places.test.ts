import { describe, expect, it } from "vitest";
import type { ListItem, ListStatus } from "@/lib/list/types";
import { ALL_LISTS, myPlacesData, parseShownLists, shownPlaces } from "./my-places";

function item(entryId: string, status: ListStatus, placeId = entryId): ListItem {
  return { entryId, status, placeId, name: entryId, kind: null, lat: 41, lng: -8, rating: null, notes: null };
}

describe("shownPlaces", () => {
  const items = [item("a", "saved"), item("b", "want"), item("c", "want")];

  it("keeps both lists by default", () => {
    expect(shownPlaces(items, ALL_LISTS).map((i) => i.entryId)).toEqual(["a", "b", "c"]);
  });

  it("drops a hidden list", () => {
    expect(shownPlaces(items, { saved: false, want: true }).map((i) => i.entryId)).toEqual(["b", "c"]);
    expect(shownPlaces(items, { saved: true, want: false }).map((i) => i.entryId)).toEqual(["a"]);
    expect(shownPlaces(items, { saved: false, want: false })).toEqual([]);
  });

  it("shows a place on both lists once, as Já fui", () => {
    const both = [item("w", "want", "p"), item("s", "saved", "p")];
    expect(shownPlaces(both, ALL_LISTS).map((i) => i.entryId)).toEqual(["s"]);
    expect(shownPlaces(both, { saved: false, want: true }).map((i) => i.entryId)).toEqual(["w"]);
  });
});

describe("myPlacesData", () => {
  it("builds one point per item with status and a fallback type", () => {
    const [feature] = myPlacesData([item("a", "want")]).features;
    expect(feature.geometry).toEqual({ type: "Point", coordinates: [-8, 41] });
    expect(feature.properties).toEqual({ placeId: "a", name: "a", class: "restaurant", status: "want" });
  });
});

describe("parseShownLists", () => {
  it("shows both lists for missing or broken values", () => {
    expect(parseShownLists(null)).toEqual(ALL_LISTS);
    expect(parseShownLists("{oops")).toEqual(ALL_LISTS);
    expect(parseShownLists("42")).toEqual(ALL_LISTS);
  });

  it("restores a stored choice", () => {
    expect(parseShownLists('{"saved":false,"want":true}')).toEqual({ saved: false, want: true });
  });
});
