import { describe, expect, it } from "vitest";
import { GEOLOCATION_OPTIONS, PORTO, ZOOM_FALLBACK, ZOOM_LOCATED, toMapLibreZoom } from "./config";

describe("map constants", () => {
  it("defines Porto, the zooms and the geolocation options", () => {
    expect(PORTO).toEqual({ lat: 41.1579, lng: -8.6291 });
    expect(ZOOM_LOCATED).toBe(15);
    expect(ZOOM_FALLBACK).toBe(13);
    expect(GEOLOCATION_OPTIONS).toEqual({ enableHighAccuracy: false, timeout: 10000, maximumAge: 0 });
  });

  it("maps 256px-tile zooms to MapLibre's 512px-tile scale", () => {
    expect(toMapLibreZoom(15)).toBe(14);
    expect(toMapLibreZoom(13)).toBe(12);
  });
});
