import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { GroupDetails } from "@/components/social/group-details";
import { dataKey } from "@/lib/data-key";
import { groupStats } from "@/lib/social/group-stats";
import { loadGroup, loadGroupEvents } from "../../../groups";

export const metadata: Metadata = { title: "Detalhes do grupo · Mordomia Social" };

// Group details: rankings of mordomias and mordomos. Members only (invitees see no events).
export default async function GroupDetailsRoute({ params }: PageProps<"/social/grupos/[id]/detalhes">) {
  const { id } = await params;
  const [group, events] = await Promise.all([loadGroup(id), loadGroupEvents(id)]);
  if (!group || group.myStatus !== "member") notFound();
  const members = group.members.filter((member) => member.status === "member");
  const stats = groupStats(members, events, group.connoisseur?.person.id);

  return (
    <PullToRefresh>
      <GroupDetails key={dataKey(stats)} group={group} stats={stats} />
    </PullToRefresh>
  );
}
