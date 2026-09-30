import type { createClient } from "@/lib/supabase/server";
import { isFoodClass } from "@/lib/map/restaurants";
import { LIST_STATUSES, isListStatus, type ListItem } from "./types";

type Row = {
  id: string;
  status: string;
  rating: number | null;
  notes: string | null;
  restaurants: { osm_id: string | null; name: string; kind: string | null; lat: number | null; lng: number | null } | null;
};

// The user's private lists, newest first. Only map (OSM) places with coordinates are shown.
export async function loadList(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<ListItem[]> {
  const { data } = await supabase
    .from("entries")
    .select("id, status, rating, notes, restaurants(osm_id, name, kind, lat, lng)")
    .eq("user_id", userId)
    .in("status", [...LIST_STATUSES])
    .order("updated_at", { ascending: false });

  return ((data ?? []) as unknown as Row[]).flatMap(({ id, status, rating, notes, restaurants: r }) =>
    r?.osm_id && r.lat != null && r.lng != null && isListStatus(status)
      ? [
          {
            entryId: id,
            status,
            placeId: r.osm_id,
            name: r.name,
            kind: isFoodClass(r.kind) ? r.kind : null,
            lat: r.lat,
            lng: r.lng,
            rating,
            notes,
          },
        ]
      : [],
  );
}
