import type { Metadata } from "next";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { dataKey } from "@/lib/data-key";
import { SocialView } from "@/components/social/social-view";
import { avatarUrl } from "@/lib/profile/load";
import { createClient } from "@/lib/supabase/server";
import { loadFeed, loadFriends } from "./actions";
import { loadGroups } from "./groups";

export const metadata: Metadata = { title: "Mordomia Social" };

export default async function SocialPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data!.claims.sub;
  const [{ data: profile }, friends, feed, groups] = await Promise.all([
    supabase.from("profiles").select("username, avatar_path").eq("id", userId).single(),
    loadFriends(),
    loadFeed(),
    loadGroups(),
  ]);

  return (
    <PullToRefresh>
      <SocialView
        // Changes with the data: after a pull-to-refresh with news, the view starts again from the fresh data.
        key={dataKey([
          friends,
          feed.map((item) => [item.id, item.at]),
          groups.map((group) => [group.id, group.name, group.description, group.myStatus, group.members.map((m) => [m.id, m.status])]),
        ])}
        userId={userId}
        initialFriends={friends}
        initialGroups={groups}
        feed={feed}
        username={profile?.username ?? null}
        avatarUrl={await avatarUrl(supabase, profile?.avatar_path)}
      />
    </PullToRefresh>
  );
}
