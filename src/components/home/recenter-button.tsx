"use client";

// Floating recenter button, bottom-left above the search bar (AC-7).
export function RecenterButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Recentrar o mapa"
      disabled={busy}
      aria-busy={busy}
      onClick={onClick}
      className="flex size-12 items-center justify-center rounded-full bg-white text-foreground shadow-lg disabled:opacity-60"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="size-6"
      >
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      </svg>
    </button>
  );
}
