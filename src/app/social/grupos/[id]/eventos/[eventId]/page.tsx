import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { EventPage } from "@/components/social/event-page";
import { dataKey } from "@/lib/data-key";
import { loadGroup, loadGroupEvent } from "../../../../groups";

export const metadata: Metadata = { title: "Evento · Mordomia Social" };

// An event of a group: only the group's members get here (RLS hides events from everyone else).
export default async function EventRoute({ params }: PageProps<"/social/grupos/[id]/eventos/[eventId]">) {
  const { id, eventId } = await params;
  const [group, event] = await Promise.all([loadGroup(id), loadGroupEvent(id, eventId)]);
  if (!group || !event) notFound();

  return (
    <PullToRefresh>
      <EventPage key={dataKey([event, group.members.map((m) => [m.id, m.status])])} group={group} initialEvent={event} />
    </PullToRefresh>
  );
}
