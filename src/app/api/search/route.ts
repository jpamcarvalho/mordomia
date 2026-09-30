import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { customPlaceId, isFoodClass, parseKinds } from "@/lib/map/restaurants";
import { PHOTON_TAGS, PHOTON_URL, rankResults, toSearchResult, type SearchResult } from "@/lib/search/photon";
import { findCountry, inCountryBox } from "@/lib/search/countries";

// Restaurant search by name: restaurants added by users, then Photon (OpenStreetMap) biased to the position.
// Name matches are ranked first (exact, then prefix, then word), so a wider batch is fetched before trimming.
// Optional country=PT limits results to that country (Photon countrycode; user-added places by bounding box).
// GET /api/search?q=tasca&lat=41.15&lng=-8.61&country=PT
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const url = new URL(PHOTON_URL);
  url.searchParams.set("q", q.slice(0, 100));
  url.searchParams.set("limit", "40");
  for (const tag of PHOTON_TAGS) url.searchParams.append("osm_tag", tag);
  const country = findCountry(params.get("country"));
  if (country) url.searchParams.set("countrycode", country.code);
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (params.has("lat") && params.has("lng") && Number.isFinite(lat) && Number.isFinite(lng)) {
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
  }

  // Escape LIKE wildcards in the user's text.
  const pattern = `%${q.slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const [custom, res] = await Promise.all([
    supabase.from("restaurants").select("id, name, kind, kinds, lat, lng").eq("user_added", true).ilike("name", pattern).limit(10),
    fetch(url, { headers: { "User-Agent": "Mordomia (friends-only restaurant app)" } }),
  ]);

  const userAdded: SearchResult[] = (custom.data ?? []).flatMap((r) =>
    isFoodClass(r.kind) && r.lat != null && r.lng != null && (!country || inCountryBox(country, r))
      ? [{ id: customPlaceId(r.id), name: r.name, kind: r.kind, kinds: parseKinds(r.kinds) ?? undefined, lat: r.lat, lng: r.lng, address: "Adicionado por um utilizador do Mordomia" }]
      : [],
  );
  if (!res.ok && userAdded.length === 0) {
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }

  const body = res.ok ? ((await res.json()) as { features?: Parameters<typeof toSearchResult>[0][] }) : {};
  const found = (body.features ?? [])
    .filter((feature) => !country || feature.properties.countrycode === country.code)
    .flatMap((feature) => toSearchResult(feature) ?? []);
  // User-added first so they win ties inside each match group.
  const results = rankResults([...userAdded, ...found], q).slice(0, 10);
  return NextResponse.json({ results });
}
