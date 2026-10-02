"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { closeGroupEvent, type GroupEvent } from "@/app/social/groups";
import { Spinner } from "@/components/spinner";
import { PersonAvatar, Sheet } from "./groups-tab";

type Props = { event: GroupEvent; onClosed: () => Promise<void> };

// The mordomo ends a dated event ("Encerrar evento"): a confirmation, then a thank-you for organising it.
// A Preço certo that was opened has to be revealed first.
export function CloseEvent({ event, onClosed }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingPrice = event.price.status === "open" || event.price.status === "closed";

  if (!event.isMordomo || !event.date || event.closedAt) return null;

  async function close() {
    setBusy(true);
    setError(null);
    const { ok } = await closeGroupEvent(event.id);
    if (ok) {
      setConfirming(false);
      await onClosed();
    } else setError("Não foi possível encerrar o evento.");
    setBusy(false);
  }

  return (
    <section className="flex flex-col items-center gap-2 pt-2 text-center motion-safe:animate-[sheet-up_400ms_300ms_ease-out_both]">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex h-12 items-center gap-2 rounded-full bg-white px-6 text-base font-semibold text-neutral-800 shadow-sm ring-1 ring-black/10 transition active:scale-95"
      >
        <span aria-hidden="true">🏁</span>
        Encerrar evento
      </button>
      <p className="text-xs text-neutral-400">Quando a mordomia acabar. Depois o evento fica fechado.</p>

      {confirming && (
        <Sheet label="Encerrar evento" onClose={() => !busy && setConfirming(false)}>
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <span aria-hidden="true" className="flex size-20 items-center justify-center rounded-full bg-neutral-100 text-4xl ring-4 ring-neutral-50">
              🏁
            </span>
            <h2 className="mt-2 text-xl font-semibold">Encerrar “{event.title}”?</h2>
            <p className="text-sm text-neutral-500">
              {pendingPrice
                ? "Primeiro revela o Preço certo: as apostas ainda não têm vencedor."
                : "O evento fica fechado: já ninguém muda quem foi, o local ou o Preço certo."}
            </p>
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-sm text-red-700">{error}</p>}
          <div className="flex flex-col gap-2">
            {!pendingPrice && (
              <button
                type="button"
                disabled={busy}
                onClick={close}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-neutral-900 font-semibold text-white shadow transition active:scale-95 disabled:opacity-50"
              >
                {busy && <Spinner className="size-5 border-white/30 border-t-white" />}
                Encerrar evento
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="h-12 rounded-full bg-neutral-100 font-semibold text-neutral-700 transition active:scale-95 disabled:opacity-50"
            >
              {pendingPrice ? "Ok" : "Cancelar"}
            </button>
          </div>
        </Sheet>
      )}
    </section>
  );
}

const CONFETTI: [string, number, number, string][] = [
  ["🎉", 6, 0, "300deg"],
  ["🥂", 18, 250, "-200deg"],
  ["🎩", 30, 120, "420deg"],
  ["🎊", 44, 380, "-320deg"],
  ["👏", 58, 60, "260deg"],
  ["✨", 70, 300, "-420deg"],
  ["🍾", 82, 180, "360deg"],
  ["🥳", 92, 440, "-260deg"],
];

// "Obrigado, mordomo!": shown to the mordomo right after closing the event.
export function ThankYou({ mordomo, going, onClose }: { mordomo: GroupEvent["mordomo"] & {}; going: number; onClose: () => void }) {
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Obrigado, mordomo"
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-950/75 px-6 backdrop-blur-sm motion-safe:animate-[fade-in_200ms_ease-out]"
    >
      <div
        onClick={(click) => click.stopPropagation()}
        className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-gradient-to-b from-amber-200 via-orange-200 to-rose-200 px-6 pt-10 pb-6 text-center shadow-2xl motion-safe:animate-[badge-pop_450ms_ease-out_both]"
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          {CONFETTI.map(([emoji, left, delay, spin], index) => (
            <span
              key={index}
              className="absolute -top-6 text-2xl opacity-0 motion-safe:animate-[confetti-fall_2400ms_ease-in_both]"
              style={{ left: `${left}%`, animationDelay: `${delay}ms`, ["--spin" as string]: spin }}
            >
              {emoji}
            </span>
          ))}
        </div>

        <span className="relative inline-block motion-safe:animate-[badge-pop_500ms_200ms_ease-out_both]">
          <PersonAvatar person={mordomo} className="size-24 text-4xl shadow-lg ring-4 ring-white" />
          <span aria-hidden="true" className="absolute -top-7 left-1/2 -translate-x-1/2 text-5xl">
            🎩
          </span>
        </span>
        <p className="relative mt-4 text-xs font-bold tracking-[0.25em] text-orange-900/70 uppercase">Evento encerrado</p>
        <h2 className="relative mt-1 font-serif text-3xl leading-tight font-black text-orange-950 italic motion-safe:animate-[sheet-up_400ms_350ms_ease-out_both]">
          Obrigado, {mordomo.displayName.split(" ")[0]}!
        </h2>
        <p className="relative mt-2 text-base text-orange-950/80 motion-safe:animate-[fade-in_400ms_550ms_ease-out_both]">
          Organizaste um evento incrível{going > 1 ? ` para ${going} pessoas` : ""}. O grupo agradece! 🥂
        </p>
        <p aria-hidden="true" className="relative mt-3 flex justify-center gap-1 text-2xl">
          {["👏", "👏", "👏"].map((clap, index) => (
            <span key={index} className="motion-safe:animate-[drum-roll_400ms_ease-in-out_infinite]" style={{ animationDelay: `${index * 130}ms` }}>
              {clap}
            </span>
          ))}
        </p>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="relative mt-6 h-12 w-full rounded-full bg-neutral-900 text-base font-semibold text-white shadow transition active:scale-95"
        >
          De nada 😎
        </button>
      </div>
    </div>,
    document.body,
  );
}
