// Map defaults and the map style (design.md → Pure logic).

export const PORTO = { lat: 41.1579, lng: -8.6291 };
// Zooms on the Google/256px-tile scale used across the app; MapLibre uses 512px tiles (see toMapLibreZoom).
export const ZOOM_LOCATED = 15;
export const ZOOM_FALLBACK = 13;

export const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 0,
};

// Free OpenStreetMap vector tiles, no key or account.
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

// Same visible area as the 256px-tile zoom: MapLibre's 512px tiles are one level "bigger".
export function toMapLibreZoom(zoom: number): number {
  return zoom - 1;
}
