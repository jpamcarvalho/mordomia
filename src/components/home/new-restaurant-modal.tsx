"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NAME_MAX, PIN_RANGE_M } from "@/lib/list/new-restaurant";
import type { LatLng } from "@/lib/map/location";
import { FOOD_CLASSES, kindEmoji, kindLabel, type FoodClass } from "@/lib/map/restaurants";

export type RestaurantDraft = { name: string; kind: FoodClass };

type Props = {
  initial: RestaurantDraft;
  // Name + type done and the user's position found → place the pin on the map.
  onNext: (draft: RestaurantDraft & { gps: LatLng }) => void;
  onClose: () => void;
};

type Fix =
  | { status: "locating" }
  | { status: "ok"; position: LatLng; accuracy: number }
  | { status: "error"; message: string };

// You have to be at the restaurant: the pin starts at a fresh, high-accuracy reading of your position.
const FIX_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 };
// Above this the pin could be on the wrong street; we still allow saving but say so.
const IMPRECISE_M = 100;

const ERRORS: Record<number, string> = {
  1: "Location is off. Allow location to add a restaurant — you need to be there.",
  2: "We couldn't find your location. Try again.",
  3: "Finding your location took too long. Try again.",
};

// Step 1 of adding a restaurant that isn't on the map: name, type and the user's position.
// Step 2 (PinPlacement) puts the pin on the exact spot.
export function NewRestaurantModal({ initial, onNext, onClose }: Props) {
  const [name, setName] = useState(initial.name);
  const [kind, setKind] = useState<FoodClass>(initial.kind);
  const [fix, setFix] = useState<Fix>({ status: "locating" });
  const nameRef = useRef<HTMLInputElement>(null);

  // Results arrive in callbacks; the "locating" state is set by the caller (initial state or Try again).
  const requestFix = useCallback(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => setFix({ status: "error", message: "This device can't share its location." }));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        setFix({
          status: "ok",
          position: { lat: coords.latitude, lng: coords.longitude },
          accuracy: Math.round(coords.accuracy),
        }),
      (error) => setFix({ status: "error", message: ERRORS[error.code] ?? ERRORS[2] }),
      FIX_OPTIONS,
    );
  }, []);

  function relocate() {
    setFix({ status: "locating" });
    requestFix();
  }

  useEffect(() => {
    requestFix();
    if (!initial.name) nameRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [requestFix, initial.name, onClose]);

  const canContinue = name.trim().length > 0 && fix.status === "ok";

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 px-5" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-restaurant-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!canContinue || fix.status !== "ok") return;
          onNext({ name: name.trim(), kind, gps: fix.position });
        }}
        className="flex max-h-[90vh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="new-restaurant-title" className="text-xl font-semibold">
              New restaurant
            </h2>
            <p className="mt-1 text-sm text-neutral-500">Not on the map? Add it while you&apos;re there.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="-m-1 p-1 leading-none text-neutral-500">
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Name</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={NAME_MAX}
            required
            placeholder="e.g. Tasca do Zé"
            className="h-12 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-base outline-none focus:border-accent focus:bg-white"
          />
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Type</legend>
          <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-2">
            {FOOD_CLASSES.map((value) => {
              const active = kind === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setKind(value)}
                  className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition ${
                    active ? "bg-accent text-white shadow" : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  <span aria-hidden="true">{kindEmoji(value)}</span>
                  {kindLabel(value)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div
          role="status"
          className={`flex items-start gap-3 rounded-xl px-3 py-3 text-sm ${
            fix.status === "error" ? "bg-red-50 text-red-700" : "bg-neutral-50 text-neutral-700"
          }`}
        >
          <span aria-hidden="true" className="text-lg leading-5">
            📍
          </span>
          <div className="flex-1">
            {fix.status === "locating" && <p>Finding your exact location…</p>}
            {fix.status === "ok" && (
              <>
                <p className="font-medium">Found your location</p>
                <p className={fix.accuracy > IMPRECISE_M ? "text-amber-700" : "text-neutral-500"}>
                  Accurate to about {fix.accuracy} m
                  {fix.accuracy > IMPRECISE_M && " — move outside or closer to the door for a better fix"}
                </p>
                <p className="text-neutral-500">
                  Next you&apos;ll place the pin on the exact spot (up to {PIN_RANGE_M} m from you).
                </p>
              </>
            )}
            {fix.status === "error" && <p>{fix.message}</p>}
          </div>
          {fix.status !== "locating" && (
            <button type="button" onClick={relocate} className="shrink-0 font-semibold text-accent">
              {fix.status === "ok" ? "Refresh" : "Try again"}
            </button>
          )}
        </div>

        <p className="text-xs text-neutral-500">Everyone on Mordomia will be able to see it on the map and find it in search.</p>

        <button
          type="submit"
          disabled={!canContinue}
          className="h-12 rounded-full bg-accent font-semibold text-white shadow disabled:opacity-50"
        >
          Next: place the pin
        </button>
      </form>
    </div>
  );
}
