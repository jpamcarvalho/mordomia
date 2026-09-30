import { describe, expect, it } from "vitest";
import { NAME_MAX, PIN_RANGE_M, circleRing, distanceMeters, parseNewRestaurant } from "./new-restaurant";

const OK = { name: "  Tasca   do Zé ", kind: "restaurant", lat: 41.15, lng: -8.61, gpsLat: 41.1503, gpsLng: -8.61 };

describe("parseNewRestaurant", () => {
  it("accepts a valid restaurant and tidies the name", () => {
    expect(parseNewRestaurant(OK)).toEqual({
      name: "Tasca do Zé",
      kind: "restaurant",
      lat: 41.15,
      lng: -8.61,
      gpsLat: 41.1503,
      gpsLng: -8.61,
    });
  });

  it("rejects missing or bad fields", () => {
    expect(parseNewRestaurant({ ...OK, name: "  " })).toBeNull();
    expect(parseNewRestaurant({ ...OK, name: "x".repeat(NAME_MAX + 1) })).toBeNull();
    expect(parseNewRestaurant({ ...OK, kind: "shop" })).toBeNull();
    expect(parseNewRestaurant({ ...OK, lat: undefined })).toBeNull();
    expect(parseNewRestaurant({ ...OK, lat: 91 })).toBeNull();
    expect(parseNewRestaurant({ ...OK, lng: Number.NaN })).toBeNull();
    expect(parseNewRestaurant({ ...OK, gpsLat: undefined })).toBeNull();
    expect(parseNewRestaurant(null)).toBeNull();
  });

  it(`rejects a pin more than ${PIN_RANGE_M} m from the user`, () => {
    // 0.0004° of latitude ≈ 44.5 m; 0.0005° ≈ 55.7 m
    expect(parseNewRestaurant({ ...OK, gpsLat: 41.15 + 0.0004 })).not.toBeNull();
    expect(parseNewRestaurant({ ...OK, gpsLat: 41.15 + 0.0005 })).toBeNull();
  });
});

describe("distanceMeters", () => {
  it("measures short distances", () => {
    // ~111 m per 0.001° of latitude
    expect(Math.round(distanceMeters({ lat: 41.15, lng: -8.61 }, { lat: 41.151, lng: -8.61 }))).toBe(111);
    expect(distanceMeters({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })).toBe(0);
  });
});

describe("circleRing", () => {
  it("draws a closed ring at the given radius", () => {
    const center = { lat: 41.15, lng: -8.61 };
    const ring = circleRing(center, 50, 16);
    expect(ring).toHaveLength(17);
    expect(ring[0]).toEqual(ring[16]);
    for (const [lng, lat] of ring) expect(Math.round(distanceMeters(center, { lat, lng }))).toBe(50);
  });
});
