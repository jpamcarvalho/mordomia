// When the Feed was last seen, remembered on this device; feed items newer than that count as new.
export const FEED_SEEN_KEY = "mordomia.feedSeenAt";

export function readFeedSeen(): string | null {
  try {
    return localStorage.getItem(FEED_SEEN_KEY);
  } catch {
    return null;
  }
}

export function markFeedSeen(at: string) {
  try {
    const current = localStorage.getItem(FEED_SEEN_KEY);
    if (!current || at > current) localStorage.setItem(FEED_SEEN_KEY, at);
  } catch {
    // Storage blocked: everything just stays "new".
  }
}

// How many feed times (ISO strings) are newer than seen; all of them when the Feed was never seen.
export function countNew(times: string[], seen: string | null): number {
  return seen ? times.filter((time) => new Date(time) > new Date(seen)).length : times.length;
}

// Badge text: "9+" above nine.
export function badgeText(count: number): string {
  return count > 9 ? "9+" : String(count);
}

// For useSyncExternalStore: the stored value only changes when this tab writes it.
export function subscribeNothing() {
  return () => {};
}
