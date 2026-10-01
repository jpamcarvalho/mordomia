"use server";

import { createClient } from "@/lib/supabase/server";
import { parseDetails } from "@/lib/list/details";
import { isListStatus, type ListItem, type ListStatus } from "@/lib/list/types";
import { DUPLICATE_RADIUS_M, NAME_MAX, distanceMeters, parseNewRestaurant, type NewRestaurant } from "@/lib/list/new-restaurant";
import { findGoogleMapsLink, isGoogleMapsUrl, parseGoogleMapsUrl, type LinkPlace } from "@/lib/search/google-link";
import { PHOTON_URL, normalizeName } from "@/lib/search/photon";
import { customPlaceId, customRestaurantId, isFoodClass, parseKinds, type FoodClass, type SelectedPlace } from "@/lib/map/restaurants";

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
  return saveRestaurant(restaurant);
}

async function saveRestaurant(restaurant: { name: string; kinds: FoodClass[]; lat: number; lng: number }): Promise<CreateResult> {
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

const LINK_ERROR = "Não conseguimos ler este link. No Google Maps, abre o restaurante, toca em Partilhar e copia o link.";
const MAX_REDIRECTS = 5;
const LINK_TIMEOUT_MS = 5000;

// Reads the place behind a Google Maps link, following short-link redirects. Only Google Maps hosts are fetched,
// and only their redirect headers are read (never a page body).
async function resolveGoogleLink(text: string): Promise<LinkPlace | null> {
  let url = findGoogleMapsLink(text);
  for (let hop = 0; url && hop <= MAX_REDIRECTS; hop++) {
    const place = parseGoogleMapsUrl(url);
    if (place) return place;
    if (hop === MAX_REDIRECTS) break;
    try {
      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(LINK_TIMEOUT_MS) });
      const location = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || !location) return null;
      const next = new URL(location, url);
      url = isGoogleMapsUrl(next) ? next : null;
    } catch {
      return null;
    }
  }
  return null;
}

export type LinkResult = { ok: true; place: LinkPlace } | { ok: false; error: string };

// Search → pasted Google Maps link: the name and position it points to.
export async function readGoogleLink(text: string): Promise<LinkResult> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return { ok: false, error: "Sessão não iniciada." };
  if (typeof text !== "string" || text.length > 2000) return { ok: false, error: LINK_ERROR };
  const place = await resolveGoogleLink(text);
  if (!place) return { ok: false, error: LINK_ERROR };
  if (!place.position) place.guess = await geocode([place.name, place.address].filter(Boolean).join(", "));
  return { ok: true, place };
}

// Rough spot for a link without a position, so the pin starts near it (Photon: free, OpenStreetMap). Null when
// nothing is found; the user then moves the map there.
async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  for (const q of [query, query.split(",").slice(1).join(",")]) {
    if (!q.trim()) continue;
    try {
      const res = await fetch(`${PHOTON_URL}?${new URLSearchParams({ q, limit: "1" })}`, {
        headers: { "User-Agent": "Mordomia (friends-only restaurant app)" },
        signal: AbortSignal.timeout(LINK_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const body = (await res.json()) as { features?: { geometry?: { coordinates?: [number, number] } }[] };
      const coords = body.features?.[0]?.geometry?.coordinates;
      if (coords) return { lat: coords[1], lng: coords[0] };
    } catch {
      // Try the next, shorter query.
    }
  }
  return null;
}

// Adds a restaurant from a Google Maps link (no GPS step). The link is read again here, so the name and, when the
// link has one, the position come from Google, never from the browser. input.name is only used when the link has
// no name (a dropped pin); input.lat/lng (the pin the user placed) only when the link has no position.
export async function createRestaurantFromLink(input: {
  link?: unknown;
  name?: unknown;
  kinds?: unknown;
  lat?: unknown;
  lng?: unknown;
}): Promise<CreateResult> {
  const kinds = parseKinds(input?.kinds);
  if (!kinds || typeof input.link !== "string" || input.link.length > 2000) return { ok: false, error: "Escolhe um tipo." };
  const place = await resolveGoogleLink(input.link);
  if (!place) return { ok: false, error: LINK_ERROR };
  const typed = typeof input.name === "string" ? input.name : "";
  const name = (place.name ?? typed).trim().replace(/\s+/g, " ").slice(0, NAME_MAX);
  if (!name) return { ok: false, error: "Indica o nome do restaurante." };
  const { lat, lng } = input;
  const position =
    place.position ??
    (typeof lat === "number" && typeof lng === "number" && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? { lat, lng }
      : null);
  if (!position) return { ok: false, error: "Põe o pin no sítio do restaurante." };
  return saveRestaurant({ name, kinds, ...position });
}
