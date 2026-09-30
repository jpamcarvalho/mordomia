import type { createClient } from "@/lib/supabase/server";

export const AVATAR_BUCKET = "avatars";
// Signed photo links last a day; pages are rendered per request, so they are refreshed on every visit.
const AVATAR_URL_TTL_S = 60 * 60 * 24;

// A temporary link to a profile photo in the private bucket, or null.
export async function avatarUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, AVATAR_URL_TTL_S);
  return data?.signedUrl ?? null;
}
