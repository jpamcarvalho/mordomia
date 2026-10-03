"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addToList } from "@/app/(home)/actions";
import type { ListStatus } from "@/lib/list/types";
import type { SelectedPlace } from "@/lib/map/restaurants";

const LABELS: Record<ListStatus, { emoji: string; name: string }> = {
  saved: { emoji: "⭐", name: "Já fui" },
  want: { emoji: "🤤", name: "Quero ir" },
};

type Props = {
  place: SelectedPlace;
  // Which of my lists the place is already on, if any.
  mine: ListStatus | undefined;
  onSaved: (status: ListStatus) => void;
};

// Corner of a friend's restaurant in the Feed: a small ＋ that saves it to one of my lists, or a ✓ once it is there.
export function FeedSave({ place, mine, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // A tap anywhere else, a scroll or a resize closes the menu.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    }
    function close() {
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // The menu lives in a portal (each feed card animates in, so a later card stacks over anything inside an earlier
  // one), placed under the button, or above it when the bottom nav would cover it.
  useLayoutEffect(() => {
    const button = ref.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!open || !button || !menu) return;
    const navTop = document.querySelector("nav[aria-label='Navegação']")?.getBoundingClientRect().top ?? window.innerHeight;
    const gap = 4;
    const below = button.bottom + gap;
    const top = below + menu.offsetHeight > navTop - gap ? button.top - gap - menu.offsetHeight : below;
    menu.style.top = `${top}px`;
    menu.style.right = `${window.innerWidth - button.right}px`;
    menu.style.visibility = "visible";
  }, [open]);

  async function save(status: ListStatus) {
    setBusy(true);
    setError(false);
    const result = await addToList(place, status);
    setBusy(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    setOpen(false);
    setJustSaved(true);
    onSaved(status);
  }

  // On "Quero ir" it can still move to "Já fui"; on "Já fui" there is nothing left to do.
  const options: ListStatus[] = mine === "saved" ? [] : mine === "want" ? ["saved"] : ["want", "saved"];

  return (
    <div ref={ref} className="relative shrink-0">
      {mine ? (
        <button
          type="button"
          disabled={options.length === 0}
          onClick={() => setOpen((shown) => !shown)}
          aria-label={`Na tua lista: ${LABELS[mine].name}`}
          title={`Na tua lista: ${LABELS[mine].name}`}
          className={`flex h-6 items-center gap-0.5 rounded-full px-1.5 text-[11px] font-bold ${
            mine === "want" ? "bg-violet-50 text-violet-600" : "bg-orange-50 text-accent"
          } ${justSaved ? "motion-safe:animate-[badge-pop_350ms_ease-out_both]" : ""}`}
        >
          ✓ <span aria-hidden="true">{LABELS[mine].emoji}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((shown) => !shown)}
          aria-label="Guardar nas minhas listas"
          aria-expanded={open}
          className="flex size-6 items-center justify-center rounded-full bg-neutral-100 text-sm font-bold text-neutral-500 transition hover:bg-orange-50 hover:text-accent active:scale-90"
        >
          ＋
        </button>
      )}

      {open &&
        options.length > 0 &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ visibility: "hidden" }}
            className="fixed z-30 w-40 rounded-xl bg-white p-1 shadow-lg ring-1 ring-black/5 motion-safe:animate-[fade-in_120ms_ease-out]"
          >
            <p className="px-2 pt-1 pb-0.5 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
              {mine === "want" ? "Mudar para" : "Guardar em"}
            </p>
            {options.map((status) => (
              <button
                key={status}
                type="button"
                role="menuitem"
                disabled={busy}
                onClick={() => save(status)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium hover:bg-neutral-50 disabled:opacity-60"
              >
                <span aria-hidden="true">{LABELS[status].emoji}</span>
                {LABELS[status].name}
              </button>
            ))}
            {error && <p className="px-2 pb-1 text-[11px] text-red-600">Não foi possível guardar.</p>}
          </div>,
          document.body,
        )}
    </div>
  );
}
