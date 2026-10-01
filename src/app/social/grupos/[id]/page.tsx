import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { GroupPage } from "@/components/social/group-page";
import { dataKey } from "@/lib/data-key";
import { createClient } from "@/lib/supabase/server";
import { loadFriends } from "../../actions";
import { loadGroup, loadGroupEvents } from "../../groups";

export const metadata: Metadata = { title: "Grupo · Mordomia Social" };

// A group's page: only its members and invitees get here (RLS hides the group from everyone else).
export default async function GroupRoute({ params }: PageProps<"/social/grupos/[id]">) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data!.claims.sub;
  const [group, events, friends] = await Promise.all([loadGroup(id), loadGroupEvents(id), loadFriends()]);
  if (!group) notFound();

  return (
    <PullToRefresh>
      <GroupPage
        // Rebuilt from the fresh data after a pull-to-refresh.
        key={dataKey([group, events])}
        userId={userId}
        initialGroup={group}
        initialEvents={events}
        friends={friends.friends}
      />
    </PullToRefresh>
  );
}
