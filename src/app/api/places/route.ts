import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Proxies Google Places Autocomplete (New) so the API key stays on the server.
// GET /api/places?q=taberna&lat=38.72&lng=-9.14
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ suggestions: [] });

  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng) && params.has("lat");

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY!,
    },
    body: JSON.stringify({
      input: q,
      includedPrimaryTypes: ["restaurant", "cafe", "bar", "bakery"],
      ...(hasLocation && {
        locationBias: {
          circle: { center: { latitude: lat, longitude: lng }, radius: 20000 },
        },
      }),
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Places search failed" }, { status: 502 });
  }

  const json = await res.json();
  type Suggestion = {
    placePrediction?: {
      placeId: string;
      structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
    };
  };
  const suggestions = ((json.suggestions ?? []) as Suggestion[])
    .filter((s) => s.placePrediction)
    .map(({ placePrediction: p }) => ({
      placeId: p!.placeId,
      name: p!.structuredFormat?.mainText?.text ?? "",
      address: p!.structuredFormat?.secondaryText?.text ?? "",
    }));

  return NextResponse.json({ suggestions });
}
