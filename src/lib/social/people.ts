import { createClient } from "@/lib/supabase/server";
import { AVATAR_BUCKET } from "@/lib/profile/load";

// Shared by the Mordomia Social server actions (friends, feed, groups).

export type Person = { id: string; username: string; displayName: string; avatarUrl: string | null };
export type ProfileRow = { id: string; username: string; display_name: string; avatar_path: string | null };
export type Supabase = Awaited<ReturnType<typeof createClient>>;

export const PROFILE_COLUMNS = "id, username, display_name, avatar_path";
export const PHOTO_URL_TTL_S = 60 * 60;

export async function signedIn(): Promise<{ supabase: Supabase; me: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const me = data?.claims?.sub;
  return typeof me === "string" ? { supabase, me } : null;
}

// Temporary links to files in a private bucket, by path.
export async function signedUrls(supabase: Supabase, bucket: string, paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, PHOTO_URL_TTL_S);
    for (const item of data ?? []) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

export async function toPeople(supabase: Supabase, rows: ProfileRow[]): Promise<Person[]> {
  const paths = rows.map((row) => row.avatar_path).filter((path): path is string => !!path);
  const urls = await signedUrls(supabase, AVATAR_BUCKET, paths);
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_path ? (urls.get(row.avatar_path) ?? null) : null,
  }));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ids reach PostgREST filters, so only real UUIDs are accepted.
export function isId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// The ids of my accepted friends.
export async function friendIds(supabase: Supabase, me: string): Promise<string[]> {
  const { data } = await supabase.from("friendships").select("requester_id, addressee_id").eq("status", "accepted");
  return (data ?? []).map((row) => (row.requester_id === me ? row.addressee_id : row.requester_id) as string);
}
