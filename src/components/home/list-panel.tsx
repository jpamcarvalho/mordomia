"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LIST_LABELS, LIST_STATUSES, type ListItem, type ListStatus } from "@/lib/list/types";
import { searchList } from "@/lib/list/search";
import { filterByKinds, filterByRating, kindCounts, ratingOptions, sameRatingFilter, type RatingFilter } from "@/lib/list/filter";
import { kindEmoji, kindLabel, kindsLabel, placeKinds, type FoodClass } from "@/lib/map/restaurants";
import { ratingColor } from "@/lib/list/rating-color";
import { onNavMap, showNavOnMap } from "@/components/app-nav";
import { CutleryIcon } from "./list-fab";
import { MagnifierIcon } from "./search-modal";

// The popup button that puts a place on each list (PlaceDialog).
const ADD_BUTTON_LABELS: Record<ListStatus, string> = {
  saved: "Adiciona à minha lista",
  want: "Quero ir!",
};

type Props = {
  items: ListItem[];
  removing: string | null;
  onPick: (item: ListItem) => void;
  onRemove: (item: ListItem) => void;
  // Open on this list (from a link); otherwise on the first list that has something in it.
  initialTab?: ListStatus | null;
  onClose: () => void;
};

// Full-screen page with the user's two private lists as tabs.
export function ListPanel({ items, removing, onPick, onRemove, initialTab, onClose }: Props) {
  const [tab, setTab] = useState<ListStatus>(
    () => initialTab ?? LIST_STATUSES.find((status) => items.some((item) => item.status === status)) ?? "saved",
  );
  const [query, setQuery] = useState("");
  // Type filter (any of these); kept when switching tabs.
  const [kinds, setKinds] = useState<FoodClass[]>([]);
  // Rating filter; only on "Adiciona à minha lista" (the other list has no ratings) and while searching.
  const [rating, setRating] = useState<RatingFilter | null>(null);
  // The filter dropdown that is open.
  const [sheet, setSheet] = useState<"kind" | "rating" | null>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // The app's bottom bar shows over the list; its "Mapa" closes the list.
  useEffect(() => {
    showNavOnMap(true);
    const off = onNavMap(() => closeRef.current());
    return () => {
      showNavOnMap(false);
      off();
    };
  }, []);

  useEffect(() => {
    if (!sheet) return;
    function onPointerDown(event: PointerEvent) {
      if (!laneRef.current?.contains(event.target as Node)) setSheet(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [sheet]);

  function pickRating(value: RatingFilter | null) {
    setRating(value);
    setSheet(null);
  }
  // Searching looks through both lists; otherwise the current tab.
  const searching = query.trim() !== "";
  const base = searching ? searchList(items, query) : items.filter((item) => item.status === tab);
  // Both filters only offer (and only apply) what the restaurants on screen have.
  const chips = kindCounts(base);
  const activeKinds = kinds.filter((kind) => chips.some((chip) => chip.kind === kind));
  const byKind = filterByKinds(base, activeKinds);
  // "Quero ir!" places have no rating: no rating filter on that tab.
  const ratingChips = searching || tab === "saved" ? ratingOptions(byKind) : [];
  const activeRating = ratingChips.some((option) => sameRatingFilter(option.filter, rating)) ? rating : null;
  const shown = filterByRating(byKind, activeRating);
  const filtering = activeKinds.length > 0 || activeRating !== null;
  const showKindFilter = chips.length > 1;
  // Worth offering once at least one place here has a rating.
  const showRatingRow = ratingChips.some((option) => option.filter !== "unrated");

  function clearFilters() {
    setSheet(null);
    setKinds([]);
    setRating(null);
  }

  function toggleKind(kind: FoodClass) {
    setKinds((current) => (current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind]));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // Escape closes a filter dropdown, then clears the search, then the filters, then closes the page.
      if (sheet) setSheet(null);
      else if (query) setQuery("");
      else if (filtering) clearFilters();
      else onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, query, filtering, sheet]);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="A minha lista"
      className="absolute inset-0 z-40 flex flex-col bg-neutral-50 motion-safe:animate-[sheet-up_220ms_ease-out]"
    >
      <header className="bg-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Voltar ao mapa"
            onClick={onClose}
            className="-ml-1 flex size-10 items-center justify-center rounded-full text-foreground hover:bg-neutral-100"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold">A minha lista</h1>
            <p className="text-sm text-neutral-500">
              {items.length === 1 ? "1 restaurante" : `${items.length} restaurantes`}
            </p>
          </div>
        </div>

        <div role="tablist" className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-neutral-100 p-1">
          {LIST_STATUSES.map((status) => {
            const count = items.filter((item) => item.status === status).length;
            const active = !searching && tab === status;
            return (
              <button
                key={status}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => {
                  setTab(status);
                  setQuery("");
                }}
                className={`flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition ${
                  active ? "bg-accent text-white shadow" : "text-neutral-600"
                }`}
              >
                {LIST_LABELS[status]}
                <span
                  className={`min-w-5 rounded-full px-1.5 text-xs ${
                    active ? "bg-white/25 text-white" : "bg-neutral-200 text-neutral-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex h-11 items-center gap-2 rounded-full bg-neutral-100 px-4 focus-within:ring-2 focus-within:ring-accent/40">
          <MagnifierIcon className="size-5 shrink-0 text-neutral-500" />
          <input
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            aria-label="Pesquisar na minha lista"
            placeholder="Pesquisar na minha lista"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Limpar pesquisa"
              onClick={() => setQuery("")}
              className="-mr-1 flex size-7 items-center justify-center rounded-full leading-none text-neutral-500 hover:bg-neutral-200"
            >
              ✕
            </button>
          )}
        </div>

        {(showKindFilter || showRatingRow) && (
          <div ref={laneRef} role="group" aria-label="Filtros" className="relative mt-3 flex items-center gap-2">
            {showKindFilter && (
              <FilterButton
                icon="🍽️"
                label="Tipo"
                summary={
                  activeKinds.length === 0
                    ? null
                    : activeKinds.length === 1
                      ? kindLabel(activeKinds[0])
                      : `${kindLabel(activeKinds[0])} +${activeKinds.length - 1}`
                }
                open={sheet === "kind"}
                onClick={() => setSheet((open) => (open === "kind" ? null : "kind"))}
              />
            )}
            {showRatingRow && (
              <FilterButton
                icon="⭐"
                label="Nota"
                summary={ratingChips.find((option) => sameRatingFilter(option.filter, activeRating))?.label ?? null}
                open={sheet === "rating"}
                onClick={() => setSheet((open) => (open === "rating" ? null : "rating"))}
              />
            )}
            {filtering && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto shrink-0 rounded-full px-3 py-2 text-sm font-medium text-accent hover:bg-orange-50"
              >
                Limpar
              </button>
            )}
            {sheet === "kind" && (
              <FilterDropdown label="Tipo de sítio">
                <OptionRow type="checkbox" active={activeKinds.length === 0} onClick={() => setKinds([])}>
                  Todos
                </OptionRow>
                {chips.map(({ kind, count }) => (
                  <OptionRow key={kind} type="checkbox" active={activeKinds.includes(kind)} count={count} onClick={() => toggleKind(kind)}>
                    <span aria-hidden="true">{kindEmoji(kind)}</span> {kindLabel(kind)}
                  </OptionRow>
                ))}
              </FilterDropdown>
            )}
            {sheet === "rating" && (
              <FilterDropdown label="Nota">
                <OptionRow type="radio" active={activeRating === null} onClick={() => pickRating(null)}>
                  Todas as notas
                </OptionRow>
                {ratingChips.map(({ filter, label, count }) => (
                  <OptionRow
                    key={label}
                    type="radio"
                    active={sameRatingFilter(activeRating, filter)}
                    count={count}
                    onClick={() => pickRating(filter)}
                  >
                    {filter !== "unrated" && <span aria-hidden="true">⭐</span>} {label}
                  </OptionRow>
                ))}
              </FilterDropdown>
            )}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        {shown.length === 0 && searching && !(filtering && base.length > 0) ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-accent/10 text-accent">
              <CutleryIcon className="size-10" />
            </span>
            <p className="max-w-72 text-lg font-semibold">Não tens esse restaurante na lista, vai petiscar outro</p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-2 h-11 rounded-full bg-accent px-6 text-sm font-semibold text-white shadow"
            >
              Limpar pesquisa
            </button>
          </div>
        ) : shown.length === 0 && filtering && base.length > 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span aria-hidden="true" className="flex size-20 items-center justify-center rounded-full bg-accent/10 text-4xl">
              {activeKinds.length ? kindEmoji(activeKinds[0]) : "⭐"}
            </span>
            <p className="max-w-72 text-lg font-semibold">
              Nenhum sítio com estes filtros {searching ? "na pesquisa" : "nesta lista"}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-2 h-11 rounded-full bg-accent px-6 text-sm font-semibold text-white shadow"
            >
              Ver todos
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-accent/10 text-accent">
              <CutleryIcon className="size-10" />
            </span>
            <p className="text-lg font-semibold">Ainda não há nada aqui</p>
            <p className="max-w-64 text-sm text-neutral-500">
              Toca num restaurante no mapa e escolhe “{ADD_BUTTON_LABELS[tab]}”.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 h-11 rounded-full bg-accent px-6 text-sm font-semibold text-white shadow"
            >
              Explorar o mapa
            </button>
          </div>
        ) : (
          <ul role={searching ? undefined : "tabpanel"} aria-label={searching ? "Resultados da pesquisa" : undefined} className="flex flex-col gap-3">
            {shown.map((item) => (
              <li
                key={item.entryId}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5"
              >
                <button
                  type="button"
                  onClick={() => onPick(item)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-2xl"
                  >
                    {kindEmoji(item.kind)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-base font-semibold">{item.name}</span>
                      {item.rating !== null && (
                        <span style={{ backgroundColor: ratingColor(item.rating) }} className="shrink-0 rounded-full px-2 py-0.5 text-xs font-bold text-white">
                          {item.rating}/10
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-sm text-neutral-500">
                      {item.kind ? kindsLabel(placeKinds(item)) : "Restaurante"}
                      {searching && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-neutral-700">{LIST_LABELS[item.status]}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span className="text-accent">Ver no mapa</span>
                    </span>
                    {item.notes && (
                      <span className="mt-1 line-clamp-2 text-sm whitespace-pre-line text-neutral-600">{item.notes}</span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Remover ${item.name}`}
                  disabled={removing === item.entryId}
                  onClick={() => onRemove(item)}
                  className="flex size-10 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// A filter in the lane: shows the chosen value, opens its dropdown.
function FilterButton({
  icon,
  label,
  summary,
  open,
  onClick,
}: {
  icon: string;
  label: string;
  summary: string | null;
  open: boolean;
  onClick: () => void;
}) {
  const active = summary !== null;
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={onClick}
      className={`flex h-10 min-w-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-95 ${
        active ? "bg-accent text-white shadow" : "bg-neutral-100 text-neutral-700"
      } ${open ? "ring-2 ring-accent/40" : ""}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="truncate">{active ? summary : label}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`size-4 shrink-0 opacity-70 transition ${open ? "rotate-180" : ""}`}
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}

// Dropdown under the filter lane; changes apply right away.
function FilterDropdown({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="menu"
      aria-label={label}
      className="absolute inset-x-0 top-full z-10 mt-2 max-h-80 overflow-y-auto rounded-2xl bg-white py-2 shadow-xl ring-1 ring-black/5 motion-safe:animate-[fade-in_120ms_ease-out]"
    >
      {children}
    </div>
  );
}

function OptionRow({
  type,
  active,
  count,
  onClick,
  children,
}: {
  type: "checkbox" | "radio";
  active: boolean;
  count?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role={type === "checkbox" ? "menuitemcheckbox" : "menuitemradio"}
      aria-checked={active}
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left text-base transition hover:bg-neutral-50 ${
        active ? "font-semibold text-accent" : "text-neutral-800"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex size-5 shrink-0 items-center justify-center border-2 text-xs text-white ${
          type === "checkbox" ? "rounded-md" : "rounded-full"
        } ${active ? "border-accent bg-accent" : "border-neutral-300"}`}
      >
        {active && "✓"}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {count !== undefined && <span className="text-sm text-neutral-400 tabular-nums">{count}</span>}
    </button>
  );
}
