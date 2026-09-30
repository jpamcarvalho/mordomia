"use client";

// Dismissible fallback notice (AC-6). Top-center, below the avatar row.
export function LocationNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-10 flex justify-center px-4">
      <div
        role="status"
        className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-xl bg-white px-4 py-3 text-sm shadow-lg"
      >
        <p>A localização está desligada — a mostrar o Porto. Ativa-a para veres o que está perto de ti.</p>
        <button
          type="button"
          aria-label="Fechar aviso"
          onClick={onDismiss}
          className="-m-1 p-1 leading-none text-neutral-500"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
