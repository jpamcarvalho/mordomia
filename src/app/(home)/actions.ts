"use server";

import { createClient } from "@/lib/supabase/server";
import { isListStatus, type ListItem, type ListStatus } from "@/lib/list/types";
import { isFoodClass, type SelectedPlace } from "@/lib/map/restaurants";

export type AddResult = { ok: true; item: ListItem } | { ok: false; error: string };

const UNIQUE_VIOLATION = "23505";

// Finds or creates the shared restaurant row for a map place (RLS: any signed-in user may insert).
async function restaurantIdFor(supabase: Awaited<ReturnType<typeof createClient>>, place: SelectedPlace) {
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

// Puts the place on one of the user's private lists. Already on a list → moves it to this one.
export async function addToList(place: SelectedPlace, status: ListStatus): Promise<AddResult> {
  if (!place?.id || !place.name || !isFoodClass(place.kind) || !isListStatus(status)) {
    return { ok: false, error: "Invalid place." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false, error: "Not signed in." };

  const restaurantId = await restaurantIdFor(supabase, place);
  if (!restaurantId) return { ok: false, error: "Couldn't save the restaurant." };

  const inserted = await supabase
    .from("entries")
    .insert({ restaurant_id: restaurantId, status })
    .select("id")
    .single();

  let entryId = inserted.data?.id as string | undefined;
  if (!entryId && inserted.error?.code === UNIQUE_VIOLATION) {
    const moved = await supabase
      .from("entries")
      .update({ status })
      .eq("user_id", claims.claims.sub)
      .eq("restaurant_id", restaurantId)
      .select("id")
      .single();
    entryId = moved.data?.id as string | undefined;
  }
  if (!entryId) return { ok: false, error: "Couldn't add it to your list." };

  return {
    ok: true,
    item: { entryId, status, placeId: place.id, name: place.name, kind: place.kind, lat: place.lat, lng: place.lng },
  };
}

export async function removeFromList(entryId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  // RLS limits deletes to the user's own entries.
  const { error } = await supabase.from("entries").delete().eq("id", entryId);
  return { ok: !error };
}
