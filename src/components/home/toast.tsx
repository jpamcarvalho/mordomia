"use client";

// Short status message, top-center below the avatar row.
export function Toast({ message }: { message: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-40 flex justify-center px-4">
      <p role="status" className="rounded-full bg-neutral-900/90 px-4 py-2 text-sm text-white shadow-lg">
        {message}
      </p>
    </div>
  );
}
