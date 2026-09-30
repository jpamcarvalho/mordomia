"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isOwnAvatarPath, parseBio } from "@/lib/profile/account";
import { AVATAR_BUCKET, avatarUrl } from "@/lib/profile/load";

export type BioResult = { ok: true; bio: string | null } | { ok: false; error: string };
export type AvatarResult = { ok: true; url: string | null } | { ok: false; error: string };

async function signedIn() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return { supabase, userId: data?.claims?.sub as string | undefined };
}

export async function saveBio(input: unknown): Promise<BioResult> {
  const parsed = parseBio(input);
  if (!parsed) return { ok: false, error: "O texto é demasiado longo." };

  const { supabase, userId } = await signedIn();
  if (!userId) return { ok: false, error: "Sessão não iniciada." };

  const { error } = await supabase.from("profiles").update({ bio: parsed.bio }).eq("id", userId);
  if (error) return { ok: false, error: "Não foi possível guardar. Tenta outra vez." };
  return { ok: true, bio: parsed.bio };
}

// The photo is uploaded from the browser straight to the user's folder; this points the profile at it
// and removes the previous photo. A null path removes the photo.
export async function setAvatar(path: string | null): Promise<AvatarResult> {
  const { supabase, userId } = await signedIn();
  if (!userId) return { ok: false, error: "Sessão não iniciada." };
  if (path !== null && !isOwnAvatarPath(userId, path)) return { ok: false, error: "Foto inválida." };

  const { data: before } = await supabase.from("profiles").select("avatar_path").eq("id", userId).single();
  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) return { ok: false, error: "Não foi possível guardar a foto. Tenta outra vez." };

  const old = before?.avatar_path as string | null | undefined;
  if (old && old !== path) await supabase.storage.from(AVATAR_BUCKET).remove([old]);

  // The avatar button on the map shows the photo too.
  revalidatePath("/");
  return { ok: true, url: await avatarUrl(supabase, path) };
}
