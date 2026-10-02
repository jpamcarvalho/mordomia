import type { Metadata } from "next";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { FriendsPage } from "@/components/social/friends-page";
import { dataKey } from "@/lib/data-key";
import { friendIds, signedIn } from "@/lib/social/people";
import { loadFriends } from "../actions";

export const metadata: Metadata = { title: "Os meus amigos · Mordomia Social" };

// How many places each friend has been to (RLS lets friends read each other's entries).
async function wentCounts(): Promise<Map<string, number>> {
  const went = new Map<string, number>();
  const session = await signedIn();
  if (!session) return went;
  const ids = await friendIds(session.supabase, session.me);
  if (!ids.length) return went;
  const { data } = await session.supabase.from("entries").select("user_id").in("user_id", ids).eq("status", "saved");
  for (const row of data ?? []) went.set(row.user_id, (went.get(row.user_id) ?? 0) + 1);
  return went;
}

// My friends, each with their level. The counts load alongside the friends (and their photos), not after them.
export default async function FriendsRoute() {
  const [{ friends }, went] = await Promise.all([loadFriends(), wentCounts()]);
  const rows = friends.map((person) => ({ person, went: went.get(person.id) ?? 0 }));

  return (
    <PullToRefresh>
      <FriendsPage key={dataKey(rows.map((row) => [row.person.id, row.went]))} friends={rows} />
    </PullToRefresh>
  );
}
