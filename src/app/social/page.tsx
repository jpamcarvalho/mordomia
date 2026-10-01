import type { Metadata } from "next";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { dataKey } from "@/lib/data-key";
import { SocialView, type SocialTab } from "@/components/social/social-view";
import { avatarUrl } from "@/lib/profile/load";
import { createClient } from "@/lib/supabase/server";
import { loadFeed, loadFriends } from "./actions";

export const metadata: Metadata = { title: "Mordomia Social" };

const TABS: SocialTab[] = ["procurar", "grupos", "feed"];

export default async function SocialPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data!.claims.sub;
  const [{ data: profile }, friends, feed] = await Promise.all([
    supabase.from("profiles").select("username, avatar_path").eq("id", userId).single(),
    loadFriends(),
    loadFeed(),
  ]);

  return (
    <PullToRefresh>
      <SocialView
        // Changes with the data: after a pull-to-refresh with news, the view starts again from the fresh data.
        key={dataKey([friends, feed.map((item) => [item.id, item.at])])}
        initialTab={TABS.includes(tab as SocialTab) ? (tab as SocialTab) : "feed"}
        initialFriends={friends}
        feed={feed}
        username={profile?.username ?? null}
        avatarUrl={await avatarUrl(supabase, profile?.avatar_path)}
      />
    </PullToRefresh>
  );
}
