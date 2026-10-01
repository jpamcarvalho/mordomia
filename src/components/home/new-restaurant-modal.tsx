"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NAME_MAX, PIN_RANGE_M } from "@/lib/list/new-restaurant";
import type { LatLng } from "@/lib/map/location";
import { FOOD_CLASSES, kindEmoji, kindLabel, type FoodClass } from "@/lib/map/restaurants";
import { findGoogleMapsLink, isGoogleSearchShare, type LinkPlace } from "@/lib/search/google-link";
import { readGoogleLink } from "@/app/(home)/actions";
import type { ListStatus } from "@/lib/list/types";

// kinds: main (first chosen) first. link: reopen on the Google Maps tab with this link (back from the pin step).
export type RestaurantDraft = { name: string; kinds: FoodClass[]; link?: string };

// A link without a position: the user places the pin, starting at start (a rough spot for the address).
export type PinFromLink = { start: LatLng | null; address: string | null };

type Props = {
  initial: RestaurantDraft;
  // Name + type done and the user's position found → place the pin on the map.
  onNext: (draft: RestaurantDraft & { gps: LatLng }) => void;
  // "Google Maps": the link gives the name and position (no GPS or pin step); saved right away onto a list.
  // origin: the tapped button, where the "added" animation starts.
  onSave: (
    draft: RestaurantDraft & { link: string; status: ListStatus; needsPin: PinFromLink | null },
    origin: DOMRect,
  ) => void;
  saving: boolean;
  onClose: () => void;
};

type Mode = "gps" | "link";

type LinkState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; place: LinkPlace }
  | { status: "error"; message: string };

const LINK_DEBOUNCE_MS = 300;
const SEARCH_SHARE =
  "Este tipo de link não é suportado. Abre o restaurante na app Google Maps, toca em Partilhar e copia o link de lá.";
const NOT_A_LINK = "Isto não é um link do Google Maps. No Google Maps, abre o restaurante, toca em Partilhar e copia o link.";

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
export function NewRestaurantModal({ initial, onNext, onSave, saving, onClose }: Props) {
  const [mode, setMode] = useState<Mode>(initial.link ? "link" : "gps");
  const [name, setName] = useState(initial.name);
  const [link, setLink] = useState(initial.link ?? "");
  const [linkState, setLinkState] = useState<LinkState>({ status: "idle" });
  const fixRequested = useRef(false);
  // The list button tapped while saving from a link.
  const [chosen, setChosen] = useState<ListStatus | null>(null);
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

  // Location is only asked for when adding while there.
  useEffect(() => {
    if (mode !== "gps" || fixRequested.current) return;
    fixRequested.current = true;
    requestFix();
  }, [mode, requestFix]);

  useEffect(() => {
    const text = link.trim();
    if (mode !== "link" || !text) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (isGoogleSearchShare(text)) {
        setLinkState({ status: "error", message: SEARCH_SHARE });
        return;
      }
      if (!findGoogleMapsLink(text)) {
        setLinkState({ status: "error", message: NOT_A_LINK });
        return;
      }
      setLinkState({ status: "loading" });
      const result = await readGoogleLink(text).catch(() => null);
      if (cancelled) return;
      if (!result?.ok) {
        setLinkState({ status: "error", message: result?.error ?? "Não conseguimos ler este link. Tenta outra vez." });
        return;
      }
      setLinkState({ status: "ok", place: result.place });
    }, LINK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [link, mode]);

  useEffect(() => {
    if (!initial.name) nameRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [initial.name, onClose]);

  const fromLink = mode === "link";
  // From a link the name is the place's title on Google Maps; only a link without one (a dropped pin) asks for it.
  const linkName = linkState.status === "ok" ? linkState.place.name : null;
  const linkPlace = linkState.status === "ok" ? linkState.place : null;
  const needsPin: PinFromLink | null =
    linkPlace && !linkPlace.position ? { start: linkPlace.guess, address: linkPlace.address } : null;
  const askName = !fromLink || (linkState.status === "ok" && !linkName);
  const finalName = (fromLink && linkName) || name.trim();
  const canContinue =
    finalName.length > 0 &&
    kinds.length > 0 &&
    (fromLink ? linkState.status === "ok" && link.trim().length > 0 && !saving : fix.status === "ok");

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 px-5" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-restaurant-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          // From a link the user picks a list with one of the two buttons.
          if (!canContinue || fromLink) return;
          if (fix.status === "ok") onNext({ name: name.trim(), kinds, gps: fix.position });
        }}
        className="flex max-h-[90vh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 id="new-restaurant-title" className="text-xl font-semibold">
              Novo restaurante
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              {fromLink ? "Cola o link do restaurante no Google Maps: o nome e o sítio vêm de lá." : "Não está no mapa? Adiciona-o enquanto lá estás."}
            </p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="-m-1 p-1 leading-none text-neutral-500">
            ✕
          </button>
        </div>

        <div role="radiogroup" aria-label="Como adicionar" className="grid grid-cols-2 gap-1 rounded-full bg-neutral-100 p-1">
          {(
            [
              ["gps", "📍", "Estou lá"],
              ["link", "🔗", "Google Maps"],
            ] as const
          ).map(([value, emoji, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => setMode(value)}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold transition ${
                mode === value ? "bg-white text-accent shadow" : "text-neutral-600"
              }`}
            >
              <span aria-hidden="true">{emoji}</span>
              <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {fromLink && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Link do Google Maps</span>
            <input
              value={link}
              onChange={(event) => {
                setLink(event.target.value);
                if (!event.target.value.trim()) setLinkState({ status: "idle" });
              }}
              inputMode="url"
              autoComplete="off"
              placeholder="https://maps.app.goo.gl/…"
              className="h-12 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-base outline-none focus:border-accent focus:bg-white"
            />
            {linkState.status !== "idle" && (
              <span
                role="status"
                className={`text-sm ${linkState.status === "error" ? "text-red-700" : linkState.status === "ok" ? "text-green-700" : "text-neutral-500"}`}
              >
                {linkState.status === "loading" && "A ler o link…"}
                {linkState.status === "ok" &&
                  (linkName ? `✓ Encontrado: ${linkName}` : "✓ Encontrado — este sítio não tem nome no Google Maps, escreve-o abaixo.")}
                {needsPin?.address && <span className="block text-neutral-500">{needsPin.address}</span>}
                {linkState.status === "error" && linkState.message}
              </span>
            )}
          </label>
        )}

        {askName && (
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
        )}

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

        {fromLink ? (
          <div className="flex items-start gap-3 rounded-xl bg-neutral-50 px-3 py-3 text-sm text-neutral-700">
            <span aria-hidden="true" className="text-lg leading-5">
              📍
            </span>
            <p>
              {needsPin
                ? "Este link não traz a localização exata: a seguir pões o pin no sítio do restaurante."
                : "Fica no sítio exato indicado pelo Google Maps."}
            </p>
          </div>
        ) : (
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
        )}

        <p className="text-xs text-neutral-500">Todos no Mordomia vão poder vê-lo no mapa e encontrá-lo na pesquisa.</p>

        {fromLink ? (
          <div className="flex flex-col gap-3">
            {(
              [
                ["saved", "⭐", "Adiciona à minha lista", "border-2 border-accent text-accent"],
                ["want", "🤤", "Quero ir!", "bg-accent text-white shadow"],
              ] as const
            ).map(([status, emoji, label, style]) => (
              <button
                key={status}
                type="button"
                disabled={!canContinue}
                onClick={(event) => {
                  setChosen(status);
                  onSave({ name: finalName, kinds, link: link.trim(), status, needsPin }, event.currentTarget.getBoundingClientRect());
                }}
                className={`flex h-12 items-center justify-center gap-2 rounded-full font-semibold disabled:opacity-50 ${style}`}
              >
                <span aria-hidden="true">{emoji}</span>
                {saving && chosen === status ? "A adicionar…" : label}
              </button>
            ))}
          </div>
        ) : (
          <button
            type="submit"
            disabled={!canContinue}
            className="h-12 rounded-full bg-accent font-semibold text-white shadow disabled:opacity-50"
          >
            Seguinte: pôr o pin
          </button>
        )}
      </form>
    </div>
  );
}
