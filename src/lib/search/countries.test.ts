import { describe, expect, it } from "vitest";
import { COUNTRIES, findCountry, inCountryBox } from "./countries";

describe("findCountry", () => {
  it("finds a listed country by code", () => {
    expect(findCountry("PT")?.name).toBe("Portugal");
  });

  it("returns null for unknown or missing codes", () => {
    expect(findCountry("XX")).toBeNull();
    expect(findCountry(null)).toBeNull();
  });
});

describe("inCountryBox", () => {
  const pt = findCountry("PT")!;

  it("includes the mainland and the islands", () => {
    expect(inCountryBox(pt, { lat: 41.15, lng: -8.61 })).toBe(true); // Porto
    expect(inCountryBox(pt, { lat: 32.65, lng: -16.91 })).toBe(true); // Funchal
    expect(inCountryBox(pt, { lat: 37.74, lng: -25.67 })).toBe(true); // Ponta Delgada
  });

  it("excludes places far outside", () => {
    expect(inCountryBox(pt, { lat: 48.86, lng: 2.35 })).toBe(false); // Paris
  });
});

describe("COUNTRIES", () => {
  it("has unique codes and valid boxes", () => {
    expect(new Set(COUNTRIES.map((c) => c.code)).size).toBe(COUNTRIES.length);
    for (const { bbox } of COUNTRIES) {
      expect(bbox[0]).toBeLessThan(bbox[2]);
      expect(bbox[1]).toBeLessThan(bbox[3]);
    }
  });
});
