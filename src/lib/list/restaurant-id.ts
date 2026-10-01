import type { createClient } from "@/lib/supabase/server";
import { customPlaceId, customRestaurantId, isFoodClass, parseKinds, type SelectedPlace } from "@/lib/map/restaurants";

const UNIQUE_VIOLATION = "23505";

// Finds or creates the shared restaurant row for a map place (RLS: any signed-in user may insert).
// User-added places already have a row.
export async function restaurantIdFor(supabase: Awaited<ReturnType<typeof createClient>>, place: SelectedPlace) {
  const customId = customRestaurantId(place.id);
  if (customId) {
    const { data } = await supabase.from("restaurants").select("id").eq("id", customId).eq("user_added", true).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  }

  const find = () => supabase.from("restaurants").select("id").eq("osm_id", place.id).maybeSingle();

  const existing = await find();
  if (existing.data) return existing.data.id as string;

  const inserted = await supabase
    .from("restaurants")
    .insert({ osm_id: place.id, name: place.name, kind: place.kind, lat: place.lat, lng: place.lng })
    .select("id")
    .single();
  if (inserted.data) return inserted.data.id as string;
  // Someone added it between our select and insert.
  if (inserted.error?.code === UNIQUE_VIOLATION) return ((await find()).data?.id as string) ?? null;
  return null;
}

export const RESTAURANT_PLACE_COLUMNS = "id, osm_id, user_added, name, kind, kinds, lat, lng";

export type RestaurantPlaceRow = {
  id: string;
  osm_id: string | null;
  user_added: boolean;
  name: string;
  kind: string | null;
  kinds: string[] | null;
  lat: number | null;
  lng: number | null;
};

// A restaurant row as a map place, or null when it cannot be shown on the map.
export function restaurantToPlace(row: RestaurantPlaceRow): SelectedPlace | null {
  const id = row.osm_id ?? (row.user_added ? customPlaceId(row.id) : null);
  if (!id || row.lat == null || row.lng == null) return null;
  return {
    id,
    name: row.name,
    kind: isFoodClass(row.kind) ? row.kind : "restaurant",
    kinds: parseKinds(row.kinds) ?? undefined,
    lat: row.lat,
    lng: row.lng,
  };
}
