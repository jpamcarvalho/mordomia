import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { ProfileView } from "@/components/social/profile-view";
import { dataKey } from "@/lib/data-key";
import { loadList } from "@/lib/list/load";
import { avatarUrl } from "@/lib/profile/load";
import { signedIn, toPeople, type ProfileRow } from "@/lib/social/people";
import { isValidUsername, normalizeUsername } from "@/lib/validation/username";
import type { Relation } from "../../actions";

export const metadata: Metadata = { title: "Perfil · Mordomia Social" };

// Someone else's profile. Anyone signed in sees the public card (photo, name, bio, friends count); their restaurants
// and their friends are only for their friends (RLS and friends_of).
export default async function PersonRoute({ params }: PageProps<"/social/pessoa/[username]">) {
  const session = await signedIn();
  if (!session) notFound();
  const { supabase, me } = session;
  const username = normalizeUsername(decodeURIComponent((await params).username));
  if (!isValidUsername(username)) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_path, created_at")
    .eq("username", username)
    .maybeSingle();
  if (!profile) notFound();
  if (profile.id === me) redirect("/account");

  const [{ data: friendship }, { data: friends }] = await Promise.all([
    supabase
      .from("friendships")
      .select("requester_id, status")
      .or(`and(requester_id.eq.${me},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${me})`)
      .maybeSingle(),
    supabase.rpc("friend_count", { uid: profile.id }),
  ]);
  const relation: Relation = !friendship
    ? "none"
    : friendship.status === "accepted"
      ? "friends"
      : friendship.requester_id === me
        ? "sent"
        : "received";
  // Their lists and their friends are only for their friends (RLS and friends_of enforce it too).
  const [list, friendRows] =
    relation === "friends"
      ? await Promise.all([loadList(supabase, profile.id), supabase.rpc("friends_of", { uid: profile.id })])
      : [null, null];
  const friendList = friendRows ? await toPeople(supabase, (friendRows.data ?? []) as ProfileRow[]) : null;

  return (
    <PullToRefresh>
      <ProfileView
        key={dataKey([
          profile,
          relation,
          friends,
          list?.map((item) => [item.entryId, item.status, item.rating, item.notes]),
          friendList?.map((person) => person.id),
        ])}
        person={{
          id: profile.id,
          username: profile.username,
          displayName: profile.display_name || profile.username,
          avatarUrl: await avatarUrl(supabase, profile.avatar_path),
        }}
        bio={profile.bio}
        memberSince={profile.created_at}
        friendCount={typeof friends === "number" ? friends : null}
        relation={relation}
        list={list}
        friendList={friendList}
        me={me}
      />
    </PullToRefresh>
  );
}
