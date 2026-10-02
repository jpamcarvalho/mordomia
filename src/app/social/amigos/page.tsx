import type { Metadata } from "next";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { FriendsPage } from "@/components/social/friends-page";
import { dataKey } from "@/lib/data-key";
import { signedIn } from "@/lib/social/people";
import { loadFriends } from "../actions";

export const metadata: Metadata = { title: "Os meus amigos · Mordomia Social" };

// My friends, each with their level (places they have been to; RLS lets friends read each other's entries).
export default async function FriendsRoute() {
  const [session, { friends }] = await Promise.all([signedIn(), loadFriends()]);
  const went = new Map<string, number>();
  if (session && friends.length) {
    const { data } = await session.supabase
      .from("entries")
      .select("user_id")
      .in(
        "user_id",
        friends.map((friend) => friend.id),
      )
      .eq("status", "saved");
    for (const row of data ?? []) went.set(row.user_id, (went.get(row.user_id) ?? 0) + 1);
  }
  const rows = friends.map((person) => ({ person, went: went.get(person.id) ?? 0 }));

  return (
    <PullToRefresh>
      <FriendsPage key={dataKey(rows.map((row) => [row.person.id, row.went]))} friends={rows} />
    </PullToRefresh>
  );
}
