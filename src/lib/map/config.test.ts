import { describe, expect, it } from "vitest";
import { GEOLOCATION_OPTIONS, PORTO, ZOOM_FALLBACK, ZOOM_LOCATED, getMapsConfig } from "./config";

describe("map constants", () => {
  it("defines Porto, the zooms and the geolocation options", () => {
    expect(PORTO).toEqual({ lat: 41.1579, lng: -8.6291 });
    expect(ZOOM_LOCATED).toBe(15);
    expect(ZOOM_FALLBACK).toBe(13);
    expect(GEOLOCATION_OPTIONS).toEqual({ enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
  });
});

describe("AC-11: getMapsConfig", () => {
  const KEY = "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY";
  const MAP_ID = "NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID";

  it("returns null when the key is missing or blank", () => {
    expect(getMapsConfig({ [MAP_ID]: "abc" })).toBeNull();
    expect(getMapsConfig({ [KEY]: "", [MAP_ID]: "abc" })).toBeNull();
    expect(getMapsConfig({ [KEY]: "   ", [MAP_ID]: "abc" })).toBeNull();
  });

  it("returns null when the Map ID is missing or blank", () => {
    expect(getMapsConfig({ [KEY]: "key" })).toBeNull();
    expect(getMapsConfig({ [KEY]: "key", [MAP_ID]: "" })).toBeNull();
    expect(getMapsConfig({ [KEY]: "key", [MAP_ID]: "  " })).toBeNull();
  });

  it("returns null when both are missing", () => {
    expect(getMapsConfig({})).toBeNull();
  });

  it("returns the trimmed config when both are set", () => {
    expect(getMapsConfig({ [KEY]: "  key-123 ", [MAP_ID]: " map-456  " })).toEqual({
      apiKey: "key-123",
      mapId: "map-456",
    });
  });
});
