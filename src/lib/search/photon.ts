import type { FoodClass, SelectedPlace } from "@/lib/map/restaurants";

// Restaurant search through Photon (https://photon.komoot.io): free, OpenStreetMap data, no key.

export const PHOTON_URL = "https://photon.komoot.io/api/";

// OSM tag → our food class. Same places the map shows (OpenMapTiles poi classes).
const TAG_CLASSES: Record<string, FoodClass> = {
  "amenity:restaurant": "restaurant",
  "amenity:fast_food": "fast_food",
  "amenity:cafe": "cafe",
  "amenity:bar": "bar",
  "amenity:pub": "beer",
  "amenity:biergarten": "beer",
  "amenity:ice_cream": "ice_cream",
  "shop:bakery": "bakery",
};

export const PHOTON_TAGS = Object.keys(TAG_CLASSES);

// OpenMapTiles/planetiler feature id = OSM id × 10 + element type, so search results match map pins.
const TYPE_DIGIT: Record<string, number> = { N: 1, W: 2, R: 3 };

export type SearchResult = SelectedPlace & { address: string | null };

type PhotonFeature = {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: number[] };
};

export function toSearchResult(feature: PhotonFeature): SearchResult | null {
  const p = feature.properties;
  const kind = TAG_CLASSES[`${p.osm_key}:${p.osm_value}`];
  const digit = TYPE_DIGIT[String(p.osm_type)];
  const name = typeof p.name === "string" ? p.name.trim() : "";
  const [lng, lat] = feature.geometry.coordinates ?? [];
  if (!kind || !digit || !name || typeof p.osm_id !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const streetName = typeof p.street === "string" ? p.street : "";
  const number = typeof p.housenumber === "string" ? p.housenumber : "";
  // OSM data sometimes has the number glued to the street already.
  const street = number && !streetName.endsWith(number) ? `${streetName} ${number}`.trim() : streetName;
  const place = [p.locality, p.county ?? p.city].find((part) => typeof part === "string" && part) as string | undefined;
  const address = [street, place].filter(Boolean).join(", ") || null;

  return { id: String(p.osm_id * 10 + digit), name, kind, lat, lng, address };
}

// Lowercase, no accents, single spaces: "Café  Ponto" → "cafe ponto".
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchRank(name: string, query: string): number {
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (` ${name}`.includes(` ${query}`)) return 2;
  return 3;
}

// Exact name first, then names starting with the query, then word matches, then the rest.
// Photon's order (relevance, then distance) is kept inside each group.
export function rankResults<T extends { name: string }>(results: T[], query: string): T[] {
  const q = normalizeName(query);
  return results
    .map((result, index) => ({ result, index, rank: matchRank(normalizeName(result.name), q) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ result }) => result);
}
