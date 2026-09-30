"use client";

// Shown when the Google map cannot load (AC-11).
export function MapError() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white px-4 text-center">
      <p>We couldn&apos;t load the map.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-white"
      >
        Try again
      </button>
    </div>
  );
}
