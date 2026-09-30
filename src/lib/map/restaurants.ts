// Food places from the OpenMapTiles "poi" layer (OpenFreeMap tiles).

export const FOOD_CLASSES = [
  "restaurant",
  "fast_food",
  "cafe",
  "bar",
  "beer",
  "ice_cream",
  "bakery",
] as const;

export type FoodClass = (typeof FOOD_CLASSES)[number];

export type SelectedPlace = {
  id: string;
  name: string;
  // Main type (map icon).
  kind: FoodClass;
  // All types, main first; only user-added places can have more than one.
  kinds?: FoodClass[];
  lat: number;
  lng: number;
};

const KIND_LABELS: Record<FoodClass, string> = {
  restaurant: "Restaurante",
  fast_food: "Fast food",
  cafe: "Café",
  bar: "Bar",
  beer: "Pub",
  ice_cream: "Gelataria",
  bakery: "Padaria",
};

export function kindLabel(kind: FoodClass): string {
  return KIND_LABELS[kind];
}

// All of a place's types, main first.
export function placeKinds(place: { kind: FoodClass | null; kinds?: FoodClass[] }): FoodClass[] {
  return place.kinds?.length ? place.kinds : place.kind ? [place.kind] : [];
}

export function kindsLabel(kinds: FoodClass[]): string {
  return kinds.map(kindLabel).join(" · ");
}

// A list of distinct food types (as stored in restaurants.kinds), or null.
export function parseKinds(value: unknown): FoodClass[] | null {
  if (!Array.isArray(value) || value.length === 0 || !value.every(isFoodClass)) return null;
  return new Set(value).size === value.length ? value : null;
}

export function isFoodClass(value: unknown): value is FoodClass {
  return typeof value === "string" && (FOOD_CLASSES as readonly string[]).includes(value);
}

// Restaurants added by users (not in OpenStreetMap) use "custom:<restaurants.id>" as their place id.
const CUSTOM_PREFIX = "custom:";

export function customPlaceId(restaurantId: string): string {
  return CUSTOM_PREFIX + restaurantId;
}

// The restaurants.id inside a custom place id, or null for map (OSM) places.
export function customRestaurantId(placeId: string): string | null {
  return placeId.startsWith(CUSTOM_PREFIX) ? placeId.slice(CUSTOM_PREFIX.length) : null;
}

// Turns a clicked map feature into a place; null for unnamed or non-food features.
// User-added places carry their id in properties.placeId; tile features use the feature id.
export function toSelectedPlace(
  feature: { id?: string | number; properties: Record<string, unknown> },
  lngLat: { lng: number; lat: number },
): SelectedPlace | null {
  const { properties } = feature;
  const name = properties["name:latin"] ?? properties.name;
  if (typeof name !== "string" || !name.trim() || !isFoodClass(properties.class)) return null;
  return {
    id:
      typeof properties.placeId === "string"
        ? properties.placeId
        : String(feature.id ?? `${name}@${lngLat.lat.toFixed(5)},${lngLat.lng.toFixed(5)}`),
    name: name.trim(),
    kind: properties.class,
    lat: lngLat.lat,
    lng: lngLat.lng,
  };
}

const KIND_EMOJI: Record<FoodClass, string> = {
  restaurant: "🍽️",
  fast_food: "🍔",
  cafe: "☕",
  bar: "🍸",
  beer: "🍺",
  ice_cream: "🍦",
  bakery: "🥐",
};

export function kindEmoji(kind: FoodClass | null): string {
  return kind ? KIND_EMOJI[kind] : KIND_EMOJI.restaurant;
}
