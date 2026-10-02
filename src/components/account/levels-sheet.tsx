"use client";

import { Sheet, SheetHeader } from "@/components/social/groups-tab";
import { allLevels } from "@/lib/profile/account";

// Placeholder rows after the last real level, fading out. The names are blurred, so they only need to look like words.
const MYSTERY = [
  { name: "Mestre Secreto", width: "w-2/3", opacity: 0.8 },
  { name: "Lenda Oculta", width: "w-1/2", opacity: 0.5 },
  { name: "Mistério", width: "w-1/3", opacity: 0.25 },
];

// Every level as a path: the ones reached are ticked, the current one shows its progress, the rest are still to come.
export function LevelsSheet({ went, onClose }: { went: number; onClose: () => void }) {
  const levels = allLevels();
  const top = levels[levels.length - 1];

  return (
    <Sheet label="Os níveis" onClose={onClose}>
      <SheetHeader title="Os níveis" onClose={onClose} />
      <p className="-mt-2 text-sm text-neutral-500">
        Já foste a <span className="font-semibold text-neutral-800">{went}</span>{" "}
        {went === 1 ? "restaurante" : "restaurantes"}.{" "}
        {went < top.from ? `Faltam ${top.from - went} para ${top.emoji} ${top.name}.` : "Chegaste ao último nível conhecido… por agora 👀"}
      </p>

      <ol className="relative flex flex-col">
        {levels.map((level, index) => {
          const reached = went >= level.from;
          const current = reached && (level.next === null || went < level.next);
          const progress = level.next === null ? 1 : Math.min((went - level.from) / (level.next - level.from), 1);
          const last = index === levels.length - 1;

          return (
            <li
              key={level.name}
              style={{ animationDelay: `${index * 40}ms` }}
              className="relative flex gap-3 pb-3 motion-safe:animate-[sheet-up_350ms_ease-out_both]"
            >
              {/* The line joining the steps: coloured up to where you are. */}
              {last ? (
                // The path goes on into the levels still to be revealed.
                <span aria-hidden="true" className="absolute top-11 bottom-0 left-[21px] border-l-2 border-dashed border-neutral-200" />
              ) : (
                <span
                  aria-hidden="true"
                  className={`absolute top-11 bottom-0 left-[21px] w-0.5 ${went >= (level.next ?? Infinity) ? "bg-accent" : "bg-neutral-200"}`}
                />
              )}
              <span
                aria-hidden="true"
                className={`relative flex size-11 shrink-0 items-center justify-center rounded-full text-2xl ${
                  current
                    ? "bg-orange-100 ring-2 ring-accent"
                    : reached
                      ? "bg-orange-50"
                      : "bg-neutral-100 opacity-50 grayscale"
                }`}
              >
                {level.emoji}
              </span>

              <div
                className={`min-w-0 flex-1 rounded-2xl px-3 py-2 ${current ? "bg-orange-50 ring-1 ring-orange-200" : ""}`}
              >
                <div className="flex items-baseline gap-2">
                  <p className={`font-semibold ${reached ? "text-neutral-900" : "text-neutral-400"}`}>{level.name}</p>
                  {current && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white">Estás aqui</span>
                  )}
                  {reached && !current && (
                    <span aria-label="Conseguido" className="text-sm font-bold text-accent">
                      ✓
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-500">
                  {level.from === 0
                    ? "Logo no início"
                    : `${level.from} ${level.from === 1 ? "restaurante" : "restaurantes"}`}
                  {!reached && ` · faltam ${level.from - went}`}
                </p>
                {current && level.next !== null && (
                  <div
                    role="progressbar"
                    aria-label={`Progresso de ${level.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress * 100)}
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-orange-100"
                  >
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-orange-400 to-accent"
                      style={{ width: `${Math.max(progress * 100, 4)}%` }}
                    />
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {/* Secret levels: there are none yet, but the path should feel like it keeps going. */}
        {MYSTERY.map((mystery, index) => (
          <li
            key={index}
            aria-hidden="true"
            style={{ animationDelay: `${(levels.length + index) * 40}ms`, opacity: mystery.opacity }}
            className="relative flex gap-3 pb-3 motion-safe:animate-[sheet-up_350ms_ease-out_both]"
          >
            {index < MYSTERY.length - 1 && (
              <span className="absolute top-11 bottom-0 left-[21px] border-l-2 border-dashed border-neutral-200" />
            )}
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-neutral-300 bg-neutral-50 text-lg">
              🔒
            </span>
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 px-3 py-2">
              <span className="font-semibold tracking-widest text-neutral-300 blur-[3px] select-none">{mystery.name}</span>
              <span className={`h-2.5 rounded-full bg-neutral-200 ${mystery.width}`} />
            </span>
          </li>
        ))}
      </ol>
      <p className="-mt-2 text-center text-sm font-medium text-neutral-400">✨ Há mais níveis por desbloquear…</p>
    </Sheet>
  );
}
