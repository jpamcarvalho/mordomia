import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { findSharedEvent } from "@/app/social/groups";
import { PrivateEvent } from "@/components/social/private-event";

export const metadata: Metadata = { title: "Evento · Mordomia Social" };

// A shared event link (/e/<code>, e.g. from WhatsApp): members go to the event; anyone else sees it is private.
// Signed-out visitors are sent to /login first and come back here after logging in (proxy).
export default async function SharedEventRoute({ params }: PageProps<"/e/[code]">) {
  const { code } = await params;
  const event = await findSharedEvent(code);
  if (!event) return <PrivateEvent />;
  redirect(`/social/grupos/${event.groupId}/eventos/${event.eventId}`);
}
