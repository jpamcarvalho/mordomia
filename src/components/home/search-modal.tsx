"use client";

import { useEffect, useRef, useState } from "react";
import type { LatLng } from "@/lib/map/location";
import { kindLabel } from "@/lib/map/restaurants";
import type { SearchResult } from "@/lib/search/photon";

type Props = {
  // Results are biased towards this position (the user, or the map's start).
  near: LatLng;
  onPick: (result: SearchResult) => void;
  // "Não o encontras?" → add a new restaurant with this name.
  onAddNew: (name: string) => void;
  onClose: () => void;
};

const DEBOUNCE_MS = 300;

type Status = "idle" | "loading" | "done" | "error";

// Search restaurants by name; picking one takes the map there.
export function SearchModal({ near, onPick, onAddNew, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("loading");
      try {
        const params = new URLSearchParams({ q, lat: String(near.lat), lng: String(near.lng) });
        const res = await fetch(`/api/search?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { results: SearchResult[] };
        setResults(body.results);
        setStatus("done");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, near.lat, near.lng]);

  const tooShort = query.trim().length < 2;

  return (
    <div
      className="absolute inset-0 z-40 flex items-start justify-center bg-black/30 px-4 pt-[calc(env(safe-area-inset-top)+4.5rem)]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pesquisar restaurantes"
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center gap-2 border-b border-neutral-100 px-4">
          <MagnifierIcon className="size-5 shrink-0 text-neutral-500" />
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Nome do restaurante"
            placeholder="Pesquisar restaurantes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          <button type="button" aria-label="Fechar" onClick={onClose} className="-m-1 p-1 leading-none text-neutral-500">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto">
          {tooShort ? (
            <p className="px-4 py-5 text-sm text-neutral-500">Escreve pelo menos 2 letras.</p>
          ) : status === "error" ? (
            <p className="px-4 py-5 text-sm text-neutral-600">A pesquisa não está a funcionar agora. Tenta outra vez.</p>
          ) : status === "loading" && results.length === 0 ? (
            <p className="px-4 py-5 text-sm text-neutral-500">A pesquisar…</p>
          ) : status === "done" && results.length === 0 ? (
            <p className="px-4 py-5 text-sm text-neutral-600">Nenhum restaurante encontrado.</p>
          ) : (
            <ul aria-busy={status === "loading"}>
              {results.map((result) => (
                <li key={result.id} className="border-b border-neutral-100 last:border-0">
                  <button type="button" onClick={() => onPick(result)} className="w-full px-4 py-3 text-left hover:bg-neutral-50">
                    <span className="block truncate font-medium">{result.name}</span>
                    <span className="block truncate text-xs text-neutral-500">
                      {kindLabel(result.kind)}
                      {result.address && ` · ${result.address}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!tooShort && (status === "done" || status === "error") && (
            <button
              type="button"
              onClick={() => onAddNew(query.trim())}
              className="flex w-full items-center gap-3 border-t border-neutral-100 bg-accent/5 px-4 py-4 text-left"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-lg text-white">+</span>
              <span className="min-w-0">
                <span className="block text-sm text-neutral-600">Não o encontras?</span>
                <span className="block truncate font-semibold text-accent">Adicionar “{query.trim()}” ao mapa</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function MagnifierIcon({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
