"use client";

import { PIN_RANGE_M, distanceMeters } from "@/lib/list/new-restaurant";
import type { LatLng } from "@/lib/map/location";
import { kindEmoji, type FoodClass } from "@/lib/map/restaurants";

type Props = {
  name: string;
  kind: FoodClass;
  gps: LatLng;
  // Where the pin is now (the map center).
  pin: LatLng;
  saving: boolean;
  onConfirm: (origin: DOMRect) => void;
  onRecenter: () => void;
  onBack: () => void;
};

// Step 2 of adding a restaurant: the pin stays in the middle of the screen and the user moves the map under it,
// up to PIN_RANGE_M from their position (the dashed circle drawn by MapView).
export function PinPlacement({ name, kind, gps, pin, saving, onConfirm, onRecenter, onBack }: Props) {
  const distance = Math.round(distanceMeters(gps, pin));
  const tooFar = distance > PIN_RANGE_M;

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-[calc(env(safe-area-inset-top)+1rem)] z-30 flex justify-center px-4">
        <p className="rounded-full bg-neutral-900/85 px-4 py-2 text-sm text-white shadow-lg">
          Move o mapa para pôr o pin na entrada
        </p>
      </div>

      {/* The pin: its tip marks the map center. */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-full">
        <div className="flex flex-col items-center drop-shadow-lg">
          <div
            className={`flex size-12 items-center justify-center rounded-full border-4 border-white text-2xl ${
              tooFar ? "bg-neutral-400" : "bg-accent"
            }`}
          >
            <span aria-hidden="true">{kindEmoji(kind)}</span>
          </div>
          <div className={`-mt-1 h-4 w-1 rounded-b-full ${tooFar ? "bg-neutral-400" : "bg-accent"}`} />
        </div>
      </div>
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-30 size-2 -translate-1/2 rounded-full bg-black/40" />

      <section
        aria-label="Colocar o pin"
        className="absolute inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
      >
        <div className="mx-auto flex max-w-md flex-col gap-3 rounded-2xl bg-white p-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{name}</p>
              <p role="status" className={`text-sm ${tooFar ? "font-medium text-red-600" : "text-neutral-500"}`}>
                {tooFar
                  ? `A ${distance} m de ti — mantém-no a menos de ${PIN_RANGE_M} m`
                  : distance === 0
                    ? "Mesmo onde estás"
                    : `A ${distance} m de ti`}
              </p>
            </div>
            <button
              type="button"
              onClick={onRecenter}
              className="shrink-0 rounded-full bg-neutral-100 px-3 py-2 text-sm font-semibold text-neutral-700"
            >
              Repor
            </button>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onBack}
              className="h-12 flex-1 rounded-full border-2 border-neutral-200 font-semibold text-neutral-700"
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={tooFar || saving}
              onClick={(event) => onConfirm(event.currentTarget.getBoundingClientRect())}
              className="h-12 flex-[2] rounded-full bg-accent font-semibold text-white shadow disabled:opacity-50"
            >
              {saving ? "A adicionar…" : "Confirmar localização"}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
