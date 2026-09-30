import { AccountView } from "@/components/account/account-view";
import { loadList } from "@/lib/list/load";
import { accountStats } from "@/lib/profile/account";
import { avatarUrl } from "@/lib/profile/load";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data!.claims.sub;

  const [{ data: profile }, list] = await Promise.all([
    supabase.from("profiles").select("username, display_name, bio, avatar_path, created_at").eq("id", userId).single(),
    loadList(supabase, userId),
  ]);

  return (
    <AccountView
      userId={userId}
      username={profile?.username ?? null}
      displayName={profile?.display_name ?? null}
      bio={profile?.bio ?? null}
      avatarUrl={await avatarUrl(supabase, profile?.avatar_path)}
      memberSince={profile?.created_at ?? null}
      stats={accountStats(list)}
    />
  );
}
