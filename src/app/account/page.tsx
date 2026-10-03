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

  // The photo link is signed as soon as the profile arrives, alongside the other queries.
  const [[profile, photo], list, { data: friends }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, avatar_path")
      .eq("id", userId)
      .single()
      .then(async ({ data }) => [data, await avatarUrl(supabase, data?.avatar_path)] as const),
    loadList(supabase, userId),
    supabase.rpc("friend_count", { uid: userId }),
  ]);

  return (
    <PullToRefresh>
      <AccountView
        // Changes with the data: after a pull-to-refresh with news, the view starts again from the fresh data.
        key={dataKey([profile, friends, list.map((item) => [item.entryId, item.status, item.rating, item.notes])])}
        username={profile?.username ?? null}
        avatarUrl={photo}
        stats={accountStats(list)}
        friendCount={typeof friends === "number" ? friends : null}
        list={list}
      />
    </PullToRefresh>
  );
}
