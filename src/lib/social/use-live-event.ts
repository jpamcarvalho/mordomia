"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Bursts of changes (e.g. someone confirming several days) trigger one refresh.
const DEBOUNCE_MS = 300;

// Keeps an open event page live: any change to the event, its date poll, the votes, who is going, the location
// suggestions or the "Preço certo" (by anyone)
// calls `onChange` so the page reloads its data. Realtime applies RLS, so only the group's members get the
// changes. While `paused()` is true (e.g. the dice animation) a change waits until the next one or the
// caller's own refresh. Also catches up when the page becomes visible again. Returns whether it is connected.
export function useLiveEvent(eventId: string, onChange: () => void, paused: () => boolean = () => false): boolean {
  const [live, setLive] = useState(false);
  const latest = useRef({ onChange, paused });
  useEffect(() => {
    latest.current = { onChange, paused };
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!latest.current.paused()) latest.current.onChange();
      }, DEBOUNCE_MS);
    };
    const byEvent = `event_id=eq.${eventId}`;
    const channel = supabase
      .channel(`event:${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_events", filter: `id=eq.${eventId}` }, fire)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_event_date_options", filter: byEvent }, fire)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_event_attendance", filter: byEvent }, fire)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_event_location_suggestions", filter: byEvent }, fire)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_event_price_guesses", filter: byEvent }, fire)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_event_bills", filter: byEvent }, fire)
      // Votes only carry the option id; RLS already limits them to my groups' events.
      .on("postgres_changes", { event: "*", schema: "public", table: "group_event_date_votes" }, fire);
    // Realtime checks RLS as the signed-in user, so it needs the session's token before subscribing.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      await supabase.realtime.setAuth(data.session?.access_token ?? null);
      channel.subscribe((status) => setLive(status === "SUBSCRIBED"));
    });

    const onVisible = () => document.visibilityState === "visible" && fire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [eventId]);

  return live;
}
