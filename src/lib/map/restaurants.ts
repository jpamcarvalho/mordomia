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
  kind: FoodClass;
  lat: number;
  lng: number;
};

const KIND_LABELS: Record<FoodClass, string> = {
  restaurant: "Restaurant",
  fast_food: "Fast food",
  cafe: "Café",
  bar: "Bar",
  beer: "Pub",
  ice_cream: "Ice cream",
  bakery: "Bakery",
};

export function kindLabel(kind: FoodClass): string {
  return KIND_LABELS[kind];
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
