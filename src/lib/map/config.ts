// Map defaults and the browser Maps configuration (design.md → Pure logic).

export const PORTO = { lat: 41.1579, lng: -8.6291 };
export const ZOOM_LOCATED = 15;
export const ZOOM_FALLBACK = 13;

export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 0,
};

export type MapsConfig = { apiKey: string; mapId: string };

// Both the browser key and the cloud Map ID are required (Decision #23); missing or blank → null (AC-11).
export function getMapsConfig(env: Record<string, string | undefined>): MapsConfig | null {
  const apiKey = env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const mapId = env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() ?? "";
  if (!apiKey || !mapId) return null;
  return { apiKey, mapId };
}
