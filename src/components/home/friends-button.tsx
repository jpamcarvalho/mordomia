"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { badgeText, countNew, readFeedSeen, subscribeNothing } from "@/lib/social/seen";

type Props = {
  // Friend requests received.
  requests: number;
  // Group invites not answered yet.
  invites: number;
  // When friends last added to their lists, newest first.
  feedTimes: string[];
};

// Floating social button (right side, above the fork menu): opens Mordomia Social (/social).
// The badge counts friend requests, group invites and feed activity not seen on this device; while there is any, the icon rings.
export function FriendsButton({ requests, invites, feedTimes }: Props) {
  const seen = useSyncExternalStore(subscribeNothing, readFeedSeen, () => null);
  const newFeed = countNew(feedTimes, seen);
  const total = requests + invites + newFeed;
  const label =
    total === 0
      ? "Mordomia Social"
      : `Mordomia Social: ${[
          requests > 0 && `${requests} ${requests === 1 ? "pedido de amizade" : "pedidos de amizade"}`,
          invites > 0 && `${invites} ${invites === 1 ? "convite para um grupo" : "convites para grupos"}`,
          newFeed > 0 && `${newFeed} ${newFeed === 1 ? "novidade" : "novidades"} no feed`,
        ]
          .filter(Boolean)
          .join(", ")}`;

  return (
    <Link
      // Requests are answered on Procurar, group invites on Grupos; otherwise the Feed (the default tab).
      href={requests > 0 ? "/social?tab=procurar" : invites > 0 ? "/social?tab=grupos" : "/social"}
      aria-label={label}
      className={`relative flex size-12 items-center justify-center rounded-full bg-white shadow-lg transition active:scale-95 ${
        total > 0 ? "text-accent" : "text-foreground"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`size-6 ${total > 0 ? "motion-safe:animate-[social-ring_4s_ease-in-out_1s_infinite]" : ""}`}
      >
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
        <path d="M18.5 14.2A6.5 6.5 0 0 1 21.5 20" />
      </svg>
      {total > 0 && (
        <span className="absolute -top-1 -right-1 flex size-5">
          <span className="absolute inset-0 rounded-full bg-red-500 opacity-60 motion-safe:animate-ping" />
          <span className="relative flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white ring-2 ring-white motion-safe:animate-[badge-pop_350ms_ease-out_both]">
            {badgeText(total)}
          </span>
        </span>
      )}
    </Link>
  );
}
