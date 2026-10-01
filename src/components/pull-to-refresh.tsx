"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

// How far (px, after resistance) the page must be pulled to refresh, and the most it moves.
const TRIGGER_PX = 64;
const MAX_PX = 96;
const RESISTANCE = 0.5;

// Pull down from the top of the page to reload its data: the server page is re-rendered (router.refresh). Pages
// give their view a per-render key so it is rebuilt from the fresh props. Touch only; the browser's own
// pull-to-refresh is turned off while this is mounted. Only the spinner moves (moving the page would break its
// fixed / sticky bars).
export function PullToRefresh({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, startRefresh] = useTransition();
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = "contain";

    function onStart(event: TouchEvent) {
      startY.current = window.scrollY <= 0 && event.touches.length === 1 ? event.touches[0].clientY : null;
    }
    function onMove(event: TouchEvent) {
      if (startY.current === null) return;
      const dy = event.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      // Only a pull at the very top: keep the page itself from bouncing.
      event.preventDefault();
      pullRef.current = Math.min(dy * RESISTANCE, MAX_PX);
      setPull(pullRef.current);
    }
    function onEnd() {
      if (startY.current === null) return;
      startY.current = null;
      if (pullRef.current >= TRIGGER_PX) startRefresh(() => router.refresh());
      pullRef.current = 0;
      setPull(0);
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      root.style.overscrollBehaviorY = previous;
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [router]);

  const offset = refreshing ? TRIGGER_PX : pull;
  const ready = pull >= TRIGGER_PX;

  return (
    <>
      <div
        aria-hidden={!refreshing}
        role="status"
        aria-label={refreshing ? "A atualizar" : undefined}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
        style={{
          transform: `translateY(${offset - 44}px)`,
          opacity: offset > 0 ? 1 : 0,
          transition: pull > 0 ? "none" : "transform 200ms ease-out, opacity 200ms ease-out",
        }}
      >
        <span
          className={`mt-[env(safe-area-inset-top)] flex size-10 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/5 ${
            ready || refreshing ? "text-accent" : "text-neutral-400"
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`size-5 ${refreshing ? "animate-spin" : ""}`}
            style={refreshing ? undefined : { transform: `rotate(${pull * 3.5}deg)` }}
          >
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v4.5h-4.5" />
          </svg>
        </span>
      </div>
      {children}
    </>
  );
}
