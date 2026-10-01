import { AccountView } from "@/components/account/account-view";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { dataKey } from "@/lib/data-key";
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
    <PullToRefresh>
      <AccountView
        // Changes with the data: after a pull-to-refresh with news, the view starts again from the fresh data.
        key={dataKey([profile, list.map((item) => [item.entryId, item.status, item.rating])])}
        userId={userId}
        username={profile?.username ?? null}
        displayName={profile?.display_name ?? null}
        bio={profile?.bio ?? null}
        avatarUrl={await avatarUrl(supabase, profile?.avatar_path)}
        memberSince={profile?.created_at ?? null}
        stats={accountStats(list)}
      />
    </PullToRefresh>
  );
}
