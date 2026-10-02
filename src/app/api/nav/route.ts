import { NextResponse } from "next/server";
import { loadNavData } from "@/app/social/actions";

// The bottom bar's avatar and badges. A plain GET rather than a server action: server actions run one at a time,
// so the bar's refresh would otherwise hold up the action a tap just started.
export async function GET() {
  const data = await loadNavData();
  if (!data) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}
