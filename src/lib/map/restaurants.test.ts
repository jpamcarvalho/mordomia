import { describe, expect, it } from "vitest";
import { kindLabel, toSelectedPlace } from "./restaurants";

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

describe("kindLabel", () => {
  it("labels the classes", () => {
    expect(kindLabel("cafe")).toBe("Café");
    expect(kindLabel("beer")).toBe("Pub");
  });
});
