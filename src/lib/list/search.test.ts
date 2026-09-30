import { describe, expect, it } from "vitest";
import { searchList } from "./search";
import type { ListItem } from "./types";

function item(name: string, status: ListItem["status"] = "saved"): ListItem {
  return { entryId: name, status, placeId: name, name, kind: "restaurant", lat: 0, lng: 0, rating: null, notes: null };
}

describe("searchList", () => {
  const items = [item("Café Santiago"), item("Ponto F", "want"), item("Tasca do Zé")];

  it("returns every item for a blank query", () => {
    expect(searchList(items, "  ")).toEqual(items);
  });

  it("matches part of the name, ignoring case and accents", () => {
    expect(searchList(items, "cafe sant").map((i) => i.name)).toEqual(["Café Santiago"]);
    expect(searchList(items, "ZE").map((i) => i.name)).toEqual(["Tasca do Zé"]);
  });

  it("matches words in any order and position", () => {
    expect(searchList(items, "ze tasca").map((i) => i.name)).toEqual(["Tasca do Zé"]);
    expect(searchList(items, "tasca sushi")).toEqual([]);
  });

  it("searches both lists", () => {
    expect(searchList(items, "ponto").map((i) => i.status)).toEqual(["want"]);
  });

  it("returns nothing when no name matches", () => {
    expect(searchList(items, "sushi")).toEqual([]);
  });
});
