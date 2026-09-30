import type { createClient } from "@/lib/supabase/server";
import { customPlaceId, isFoodClass, type SelectedPlace } from "@/lib/map/restaurants";
import { LIST_STATUSES, isListStatus, type ListItem } from "./types";

type Row = {
  id: string;
  status: string;
  rating: number | null;
  notes: string | null;
  restaurants: {
    id: string;
    osm_id: string | null;
    user_added: boolean;
    name: string;
    kind: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
};

// The user's private lists, newest first. Only map (OSM) and user-added places with coordinates are shown.
export async function loadList(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<ListItem[]> {
  const { data } = await supabase
    .from("entries")
    .select("id, status, rating, notes, restaurants(id, osm_id, user_added, name, kind, lat, lng)")
    .eq("user_id", userId)
    .in("status", [...LIST_STATUSES])
    .order("updated_at", { ascending: false });

  return ((data ?? []) as unknown as Row[]).flatMap(({ id, status, rating, notes, restaurants: r }) => {
    const placeId = r?.osm_id ?? (r?.user_added ? customPlaceId(r.id) : null);
    return r && placeId && r.lat != null && r.lng != null && isListStatus(status)
      ? [
          {
            entryId: id,
            status,
            placeId,
            name: r.name,
            kind: isFoodClass(r.kind) ? r.kind : null,
            lat: r.lat,
            lng: r.lng,
            rating,
            notes,
          },
        ]
      : [];
  });
}

// Restaurants added by users (shared with everyone), shown on the map next to the OpenStreetMap ones.
export async function loadCustomPlaces(supabase: Awaited<ReturnType<typeof createClient>>): Promise<SelectedPlace[]> {
  const { data } = await supabase
    .from("restaurants")
    .select("id, name, kind, lat, lng")
    .eq("user_added", true)
    .limit(5000);
  return (data ?? []).flatMap((r) =>
    isFoodClass(r.kind) && r.lat != null && r.lng != null
      ? [{ id: customPlaceId(r.id), name: r.name, kind: r.kind, lat: r.lat, lng: r.lng }]
      : [],
  );
}
