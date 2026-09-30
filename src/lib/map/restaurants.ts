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

// Turns a clicked tile feature into a place; null for unnamed or non-food features.
export function toSelectedPlace(
  feature: { id?: string | number; properties: Record<string, unknown> },
  lngLat: { lng: number; lat: number },
): SelectedPlace | null {
  const { properties } = feature;
  const name = properties["name:latin"] ?? properties.name;
  if (typeof name !== "string" || !name.trim() || !isFoodClass(properties.class)) return null;
  return {
    id: String(feature.id ?? `${name}@${lngLat.lat.toFixed(5)},${lngLat.lng.toFixed(5)}`),
    name: name.trim(),
    kind: properties.class,
    lat: lngLat.lat,
    lng: lngLat.lng,
  };
}
