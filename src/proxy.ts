import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except Next static files, exactly /favicon.ico and /manifest.webmanifest, images and the MapLibre
    // worker (.mjs). A new icon route (app/icon.*, app/apple-icon.*) must be added here as an exact entry.
    "/((?!_next/static|_next/image|favicon\\.ico$|manifest\\.webmanifest$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mjs)$).*)",
  ],
};
