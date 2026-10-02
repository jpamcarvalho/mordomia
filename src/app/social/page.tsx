import type { Metadata } from "next";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { dataKey } from "@/lib/data-key";
import { SocialView } from "@/components/social/social-view";
import { loadList } from "@/lib/list/load";
import type { ListStatus } from "@/lib/list/types";
import { createClient } from "@/lib/supabase/server";
import { loadFeed, loadFriends } from "./actions";
import { loadGroups } from "./groups";

export const metadata: Metadata = { title: "Mordomia Social" };

export default async function SocialPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data!.claims.sub;
  const [friends, feed, groups, mine] = await Promise.all([
    loadFriends(),
    loadFeed(),
    loadGroups(),
    loadList(supabase, userId),
  ]);
  // Which of my lists each place is on, so the Feed can offer to save the ones I do not have yet.
  const myLists: Record<string, ListStatus> = Object.fromEntries(mine.map((item) => [item.placeId, item.status]));

  return (
    <PullToRefresh>
      <SocialView
        // Changes with the data: after a pull-to-refresh with news, the view starts again from the fresh data.
        key={dataKey([
          friends,
          feed.map((item) => [item.id, item.at]),
          myLists,
          groups.map((group) => [group.id, group.name, group.description, group.myStatus, group.members.map((m) => [m.id, m.status])]),
        ])}
        userId={userId}
        initialFriends={friends}
        initialGroups={groups}
        feed={feed}
        myLists={myLists}
      />
    </PullToRefresh>
  );
}
