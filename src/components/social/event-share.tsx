"use client";

import type { GroupEvent } from "@/app/social/groups";
import { formatDayTime } from "@/lib/social/dates";

// "Partilhar": the phone's share sheet (WhatsApp, Mensagens…) with the event's title, date and short link (/e/<code>);
// where there is no share sheet (desktop), WhatsApp Web. The link only opens for the group's members (RLS + login).
// Links point at NEXT_PUBLIC_SITE_URL (production) when it is set, else at the current site.
export function ShareEvent({ event, className = "" }: { event: GroupEvent; className?: string }) {
  async function share() {
    const url = `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/e/${event.shareCode}`;
    const text = `🍽️ ${event.title}${event.date ? ` — ${formatDayTime(event.date, event.startTime)}` : ""}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text, url });
      } catch {
        // Cancelled, or the share sheet failed: nothing to do.
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Partilhar evento"
      title="Partilhar evento"
      className={`flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100 active:scale-90 ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
        <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
      </svg>
    </button>
  );
}
