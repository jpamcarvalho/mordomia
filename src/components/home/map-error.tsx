"use client";

// Shown when the map cannot load (AC-11).
export function MapError() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white px-4 text-center">
      <p>Não conseguimos carregar o mapa.</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-white"
      >
        Tentar outra vez
      </button>
    </div>
  );
}
