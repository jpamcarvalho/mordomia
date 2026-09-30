"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NAME_MAX, PIN_RANGE_M } from "@/lib/list/new-restaurant";
import type { LatLng } from "@/lib/map/location";
import { FOOD_CLASSES, kindEmoji, kindLabel, type FoodClass } from "@/lib/map/restaurants";

// kinds: main (first chosen) first.
export type RestaurantDraft = { name: string; kinds: FoodClass[] };

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
  1: "A localização está desligada. Ativa-a para adicionar um restaurante — tens de estar lá.",
  2: "Não conseguimos encontrar a tua localização. Tenta outra vez.",
  3: "Encontrar a tua localização demorou demasiado. Tenta outra vez.",
};

// Step 1 of adding a restaurant that isn't on the map: name, type and the user's position.
// Step 2 (PinPlacement) puts the pin on the exact spot.
export function NewRestaurantModal({ initial, onNext, onClose }: Props) {
  const [name, setName] = useState(initial.name);
  const [kinds, setKinds] = useState<FoodClass[]>(initial.kinds);
  const [fix, setFix] = useState<Fix>({ status: "locating" });
  const nameRef = useRef<HTMLInputElement>(null);

  // Results arrive in callbacks; the "locating" state is set by the caller (initial state or Try again).
  const requestFix = useCallback(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => setFix({ status: "error", message: "Este dispositivo não consegue partilhar a localização." }));
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

  const canContinue = name.trim().length > 0 && kinds.length > 0 && fix.status === "ok";

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
          onNext({ name: name.trim(), kinds, gps: fix.position });
        }}
        className="flex max-h-[90vh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="new-restaurant-title" className="text-xl font-semibold">
              Novo restaurante
            </h2>
            <p className="mt-1 text-sm text-neutral-500">Não está no mapa? Adiciona-o enquanto lá estás.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="-m-1 p-1 leading-none text-neutral-500">
            ✕
          </button>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Nome</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={NAME_MAX}
            required
            placeholder="ex.: Tasca do Zé"
            className="h-12 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-base outline-none focus:border-accent focus:bg-white"
          />
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            Tipo <span className="font-normal text-neutral-500">(podes escolher vários)</span>
          </legend>
          <div role="group" aria-label="Tipo" className="flex flex-wrap gap-2">
            {FOOD_CLASSES.map((value) => {
              const active = kinds.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  role="checkbox"
                  aria-checked={active}
                  onClick={() =>
                    setKinds((current) => (active ? current.filter((k) => k !== value) : [...current, value]))
                  }
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
            {fix.status === "locating" && <p>A encontrar a tua localização exata…</p>}
            {fix.status === "ok" && (
              <>
                <p className="font-medium">Encontrámos a tua localização</p>
                <p className={fix.accuracy > IMPRECISE_M ? "text-amber-700" : "text-neutral-500"}>
                  Precisão de cerca de {fix.accuracy} m
                  {fix.accuracy > IMPRECISE_M && " — move outside or closer to the door for a better fix"}
                </p>
                <p className="text-neutral-500">
                  A seguir vais pôr o pin no sítio exato (até {PIN_RANGE_M} m de ti).
                </p>
              </>
            )}
            {fix.status === "error" && <p>{fix.message}</p>}
          </div>
          {fix.status !== "locating" && (
            <button type="button" onClick={relocate} className="shrink-0 font-semibold text-accent">
              {fix.status === "ok" ? "Atualizar" : "Tentar outra vez"}
            </button>
          )}
        </div>

        <p className="text-xs text-neutral-500">Todos no Mordomia vão poder vê-lo no mapa e encontrá-lo na pesquisa.</p>

        <button
          type="submit"
          disabled={!canContinue}
          className="h-12 rounded-full bg-accent font-semibold text-white shadow disabled:opacity-50"
        >
          Seguinte: pôr o pin
        </button>
      </form>
    </div>
  );
}
