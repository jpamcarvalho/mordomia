import { parseKinds, type FoodClass } from "@/lib/map/restaurants";

export const NAME_MAX = 100;
// A restaurant with the same name this close by is treated as the same place.
export const DUPLICATE_RADIUS_M = 75;

// kinds: one or more types, main (first chosen) first. lat/lng: where the pin was placed.
// gpsLat/gpsLng: the user's position when adding (the pin must be near it).
export type NewRestaurant = { name: string; kinds: FoodClass[]; lat: number; lng: number; gpsLat: number; gpsLng: number };

function isCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

// Validates a new restaurant from the client; null when anything is missing, out of range, or the pin is
// more than PIN_RANGE_M from the user's position.
export function parseNewRestaurant(input: Partial<Record<keyof NewRestaurant, unknown>> | null | undefined): NewRestaurant | null {
  const name = typeof input?.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const { lat, lng, gpsLat, gpsLng } = input ?? {};
  const kinds = parseKinds(input?.kinds);
  if (!name || name.length > NAME_MAX || !kinds) return null;
  if (!isCoord(lat, lng) || !isCoord(gpsLat, gpsLng)) return null;
  const pin = { lat, lng: lng as number };
  const gps = { lat: gpsLat, lng: gpsLng as number };
  if (!withinPinRange(gps, pin)) return null;
  return { name, kinds, ...pin, gpsLat: gps.lat, gpsLng: gps.lng };
}

// Great-circle distance in meters.
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

// How far the pin may be moved from the user's GPS position when adding a restaurant.
export const PIN_RANGE_M = 50;
// GPS positions travel as floats; allow a hair over the limit for rounding.
const PIN_RANGE_TOLERANCE_M = 1;

export function withinPinRange(gps: { lat: number; lng: number }, pin: { lat: number; lng: number }): boolean {
  return distanceMeters(gps, pin) <= PIN_RANGE_M + PIN_RANGE_TOLERANCE_M;
}

// Ring of [lng, lat] points approximating a circle, for drawing the allowed pin range.
export function circleRing(center: { lat: number; lng: number }, radiusM: number, steps = 64): [number, number][] {
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (i / steps) * 2 * Math.PI;
    return [center.lng + dLng * Math.cos(angle), center.lat + dLat * Math.sin(angle)];
  });
}
