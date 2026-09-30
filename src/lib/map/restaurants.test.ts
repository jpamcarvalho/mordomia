import { describe, expect, it } from "vitest";
import { customPlaceId, customRestaurantId, kindLabel, kindsLabel, parseKinds, placeKinds, toSelectedPlace } from "./restaurants";

const AT = { lat: 41.15, lng: -8.61 };

describe("toSelectedPlace", () => {
  it("builds a place from a named food feature", () => {
    expect(toSelectedPlace({ id: 42, properties: { name: " Tasca ", class: "restaurant" } }, AT)).toEqual({
      id: "42",
      name: "Tasca",
      kind: "restaurant",
      ...AT,
    });
  });

  it("prefers the latin name", () => {
    const place = toSelectedPlace({ id: 1, properties: { name: "x", "name:latin": "Café Y", class: "cafe" } }, AT);
    expect(place?.name).toBe("Café Y");
  });

  it("ignores unnamed or non-food features", () => {
    expect(toSelectedPlace({ id: 1, properties: { class: "restaurant" } }, AT)).toBeNull();
    expect(toSelectedPlace({ id: 1, properties: { name: "Shop", class: "shop" } }, AT)).toBeNull();
  });

  it("falls back to a name+position id", () => {
    expect(toSelectedPlace({ properties: { name: "Bar", class: "bar" } }, AT)?.id).toBe("Bar@41.15000,-8.61000");
  });
});

describe("parseKinds", () => {
  it("accepts distinct food types in order", () => {
    expect(parseKinds(["cafe", "bakery"])).toEqual(["cafe", "bakery"]);
  });

  it("rejects empty, unknown, repeated or non-array values", () => {
    expect(parseKinds([])).toBeNull();
    expect(parseKinds(["cafe", "shop"])).toBeNull();
    expect(parseKinds(["cafe", "cafe"])).toBeNull();
    expect(parseKinds("cafe")).toBeNull();
    expect(parseKinds(null)).toBeNull();
  });
});

describe("placeKinds / kindsLabel", () => {
  it("uses every type when there are several, else the main one", () => {
    expect(placeKinds({ kind: "cafe", kinds: ["cafe", "bakery"] })).toEqual(["cafe", "bakery"]);
    expect(placeKinds({ kind: "bar" })).toEqual(["bar"]);
    expect(placeKinds({ kind: null })).toEqual([]);
    expect(kindsLabel(["cafe", "fast_food"])).toBe("Café · Fast food");
  });
});

describe("kindLabel", () => {
  it("labels the classes", () => {
    expect(kindLabel("cafe")).toBe("Café");
    expect(kindLabel("beer")).toBe("Pub");
  });
});

describe("custom place ids", () => {
  it("round-trips a restaurant id and ignores map ids", () => {
    expect(customPlaceId("abc")).toBe("custom:abc");
    expect(customRestaurantId("custom:abc")).toBe("abc");
    expect(customRestaurantId("61816551851")).toBeNull();
  });

  it("uses properties.placeId for user-added features", () => {
    const place = toSelectedPlace({ id: 3, properties: { placeId: "custom:abc", name: "Tasca", class: "restaurant" } }, AT);
    expect(place?.id).toBe("custom:abc");
  });
});
