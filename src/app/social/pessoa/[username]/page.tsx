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
    .select("id, username, display_name, bio, avatar_path")
    .eq("username", username)
    .maybeSingle();
  if (!profile) notFound();
  if (profile.id === me) redirect("/account");

  // Everything at once, so the page waits for one round trip instead of several. The lists and the friends are
  // fetched before knowing whether we are friends: RLS and friends_of return nothing to anyone else, and they are
  // only shown to friends anyway.
  const [{ data: friendship }, { data: friends }, photo, theirList, friendPeople] = await Promise.all([
    supabase
      .from("friendships")
      .select("requester_id, status")
      .or(`and(requester_id.eq.${me},addressee_id.eq.${profile.id}),and(requester_id.eq.${profile.id},addressee_id.eq.${me})`)
      .maybeSingle(),
    supabase.rpc("friend_count", { uid: profile.id }),
    avatarUrl(supabase, profile.avatar_path),
    loadList(supabase, profile.id),
    supabase
      .rpc("friends_of", { uid: profile.id })
      .then(({ data }) => (data?.length ? toPeople(supabase, data as ProfileRow[]) : [])),
  ]);
  const relation: Relation = !friendship
    ? "none"
    : friendship.status === "accepted"
      ? "friends"
      : friendship.requester_id === me
        ? "sent"
        : "received";
  const list = relation === "friends" ? theirList : null;
  const friendList = relation === "friends" ? friendPeople : null;

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
          avatarUrl: photo,
        }}
        bio={profile.bio}
        friendCount={typeof friends === "number" ? friends : null}
        relation={relation}
        list={list}
        friendList={friendList}
        me={me}
      />
    </PullToRefresh>
  );
}
