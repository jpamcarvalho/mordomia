"use server";

import { createClient } from "@/lib/supabase/server";
import { parseDetails } from "@/lib/list/details";
import { isListStatus, type ListItem, type ListStatus } from "@/lib/list/types";
import { DUPLICATE_RADIUS_M, distanceMeters, parseNewRestaurant, type NewRestaurant } from "@/lib/list/new-restaurant";
import { normalizeName } from "@/lib/search/photon";
import { customPlaceId, customRestaurantId, isFoodClass, parseKinds, type SelectedPlace } from "@/lib/map/restaurants";

export type AddResult = { ok: true; item: ListItem } | { ok: false; error: string };

const UNIQUE_VIOLATION = "23505";

// Finds or creates the shared restaurant row for a map place (RLS: any signed-in user may insert).
// User-added places already have a row.
async function restaurantIdFor(supabase: Awaited<ReturnType<typeof createClient>>, place: SelectedPlace) {
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

// Puts the place on one of the user's private lists. Already on a list → moves it / updates it.
// "saved" carries a rating (0–10, optional) and notes; "want" has no rating (notes are kept).
export async function addToList(
  place: SelectedPlace,
  status: ListStatus,
  input?: { rating?: number | null; notes?: string | null },
): Promise<AddResult> {
  if (!place?.id || !place.name || !isFoodClass(place.kind) || !isListStatus(status)) {
    return { ok: false, error: "Sítio inválido." };
  }
  const details = parseDetails(input);
  if (!details) return { ok: false, error: "A nota tem de ser um número inteiro de 0 a 10." };
  const fields = status === "saved" ? { status, rating: details.rating, notes: details.notes } : { status, rating: null };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false, error: "Sessão não iniciada." };

  const restaurantId = await restaurantIdFor(supabase, place);
  if (!restaurantId) return { ok: false, error: "Não foi possível guardar o restaurante." };

  const inserted = await supabase
    .from("entries")
    .insert({ restaurant_id: restaurantId, ...fields })
    .select("id, rating, notes")
    .single();

  type Saved = { id: string; rating: number | null; notes: string | null };
  let saved = inserted.data as Saved | null;
  if (!saved && inserted.error?.code === UNIQUE_VIOLATION) {
    const moved = await supabase
      .from("entries")
      .update(fields)
      .eq("user_id", claims.claims.sub)
      .eq("restaurant_id", restaurantId)
      .select("id, rating, notes")
      .single();
    saved = moved.data as Saved | null;
  }
  if (!saved) return { ok: false, error: "Não foi possível adicionar à tua lista." };

  return {
    ok: true,
    item: {
      entryId: saved.id,
      status,
      placeId: place.id,
      name: place.name,
      kind: place.kind,
      kinds: place.kinds,
      lat: place.lat,
      lng: place.lng,
      rating: saved.rating,
      notes: saved.notes,
    },
  };
}

export async function removeFromList(entryId: string): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  // RLS limits deletes to the user's own entries.
  const { error } = await supabase.from("entries").delete().eq("id", entryId);
  return { ok: !error };
}

export type CreateResult =
  | { ok: true; place: SelectedPlace; existing: boolean }
  | { ok: false; error: string };

// Adds a restaurant that is not on the map, at the pin the user placed within PIN_RANGE_M of their position.
// Shared with every signed-in user.
// The same name already added within DUPLICATE_RADIUS_M is returned instead of creating a copy.
export async function createRestaurant(input: Partial<NewRestaurant>): Promise<CreateResult> {
  const restaurant = parseNewRestaurant(input);
  if (!restaurant) return { ok: false, error: "Indica um nome e um tipo, e mantém o pin a menos de 50 m de ti." };
  const { kinds } = restaurant;
  const row = { name: restaurant.name, kind: kinds[0], kinds, lat: restaurant.lat, lng: restaurant.lng };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false, error: "Sessão não iniciada." };

  // ~0.002° ≈ 200 m: candidates for the duplicate check.
  const { data: nearby } = await supabase
    .from("restaurants")
    .select("id, name, kind, kinds, lat, lng")
    .eq("user_added", true)
    .gte("lat", restaurant.lat - 0.002)
    .lte("lat", restaurant.lat + 0.002)
    .gte("lng", restaurant.lng - 0.003)
    .lte("lng", restaurant.lng + 0.003);
  const duplicate = (nearby ?? []).find(
    (row) =>
      normalizeName(row.name) === normalizeName(restaurant.name) &&
      distanceMeters(row as { lat: number; lng: number }, restaurant) <= DUPLICATE_RADIUS_M,
  );
  if (duplicate && isFoodClass(duplicate.kind)) {
    return {
      ok: true,
      existing: true,
      place: {
        id: customPlaceId(duplicate.id),
        name: duplicate.name,
        kind: duplicate.kind,
        kinds: parseKinds(duplicate.kinds) ?? undefined,
        lat: duplicate.lat,
        lng: duplicate.lng,
      },
    };
  }

  const { data, error } = await supabase
    .from("restaurants")
    .insert({ ...row, user_added: true })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Não foi possível adicionar o restaurante." };

  return { ok: true, existing: false, place: { id: customPlaceId(data.id as string), ...row } };
}
