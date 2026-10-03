import { EditProfileView } from "@/components/account/edit-profile-view";
import { avatarUrl } from "@/lib/profile/load";
import { createClient } from "@/lib/supabase/server";

export default async function EditProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data!.claims.sub;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, bio, avatar_path, created_at")
    .eq("id", userId)
    .single();

  return (
    <EditProfileView
      userId={userId}
      username={profile?.username ?? null}
      displayName={profile?.display_name ?? null}
      bio={profile?.bio ?? null}
      avatarUrl={await avatarUrl(supabase, profile?.avatar_path)}
      memberSince={profile?.created_at ?? null}
    />
  );
}
