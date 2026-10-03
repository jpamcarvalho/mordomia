"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { ENTER, delay } from "@/components/enter";
import { ProfileLists } from "@/components/profile-lists";
import { LevelsSheet } from "./levels-sheet";
import { levelFor, type AccountStats } from "@/lib/profile/account";
import { ratingColor } from "@/lib/list/rating-color";
import type { ListItem } from "@/lib/list/types";
import { avatarInitial } from "@/lib/profile/avatar";

type Props = {
  username: string | null;
  avatarUrl: string | null;
  stats: AccountStats;
  friendCount: number | null;
  list: ListItem[];
};

const EDIT_HREF = "/account/editar";
const MEDALS = ["🥇", "🥈", "🥉"];

// Counts up from 0 to `value` once (instant when the user prefers reduced motion).
function useCountUp(value: number, decimals = 0) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      queueMicrotask(() => setShown(value));
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / 900);
      setShown(value * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown.toFixed(decimals).replace(".", ",");
}

// My account: level and friends, my top restaurants with the average score, then my lists. The photo in the corner
// opens "Editar perfil" (photo, name, bio, and "Terminar sessão").
export function AccountView({ username, avatarUrl, stats, friendCount, list }: Props) {
  const router = useRouter();
  const level = levelFor(stats.went);

  return (
    <main className="min-h-dvh bg-gradient-to-b from-orange-100 via-orange-50/40 to-white pb-[calc(env(safe-area-inset-bottom)+6rem)]">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="flex items-center justify-between">
          {/* Back to wherever the account was opened from (map or Mordomia Social); the map when opened directly. */}
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            className="flex w-fit items-center gap-1 rounded-full bg-white/80 px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm backdrop-blur active:scale-95"
          >
            <span aria-hidden="true">←</span> Voltar
          </button>
          <div className="flex items-center gap-2">
            {friendCount !== null && <FriendsPill count={friendCount} />}
            <Link
              href={EDIT_HREF}
              aria-label="Editar perfil"
              className="group relative size-11 rounded-full transition active:scale-95"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
                <img src={avatarUrl} alt="" className="size-full rounded-full object-cover ring-2 ring-white" />
              ) : (
                <span className="flex size-full items-center justify-center rounded-full bg-accent text-lg font-bold text-white ring-2 ring-white">
                  {avatarInitial(username)}
                </span>
              )}
              <span
                aria-hidden="true"
                className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-white text-[10px] shadow ring-1 ring-orange-100 transition group-hover:scale-110"
              >
                ✏️
              </span>
            </Link>
          </div>
        </div>

        <LevelCard went={stats.went} level={level} style={delay(0)} />

        <FavouritesCard favourites={stats.favourites} average={stats.average} style={delay(80)} />

        <ProfileLists
          items={list}
          title="📍 Os meus restaurantes"
          tabs={{
            saved: {
              label: "⭐ Já fui",
              empty: "Ainda não adicionaste sítios onde foste.",
            },
            want: {
              label: "🤤 Quero ir",
              empty: "Ainda não tens sítios onde queres ir.",
            },
          }}
          style={delay(160)}
        />

      </div>
    </main>
  );
}

// Next to the photo: how many friends; opens "Os meus amigos".
function FriendsPill({ count }: { count: number }) {
  const shown = useCountUp(count);
  return (
    <Link
      href="/social/amigos"
      aria-label={`${count} ${count === 1 ? "amigo" : "amigos"}`}
      className="flex h-11 items-center gap-1.5 rounded-full bg-white/80 px-3.5 shadow-sm backdrop-blur transition hover:bg-white active:scale-95"
    >
      <span aria-hidden="true" className="text-lg">
        👥
      </span>
      <span className="text-lg font-extrabold tabular-nums">{shown}</span>
    </Link>
  );
}

// My three best rated places, with the average of every rated place.
function FavouritesCard({
  favourites,
  average,
  style,
}: {
  favourites: AccountStats["favourites"];
  average: number | null;
  style: CSSProperties;
}) {
  const shownAverage = useCountUp(average ?? 0, 1);
  return (
    // Informative only: plain compact rows, nothing to tap.
    <section style={style} className={`rounded-3xl bg-white px-4 py-3.5 shadow-sm ${ENTER}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold whitespace-nowrap">🏆 Os meus favoritos</h2>
        <span className="flex shrink-0 items-baseline gap-1 whitespace-nowrap">
          <span aria-hidden="true" className="text-sm">
            ⭐
          </span>
          <span className="font-extrabold text-accent tabular-nums">{average === null ? "–" : shownAverage}</span>
          <span className="text-xs text-neutral-500">média</span>
        </span>
      </div>
      {favourites.length ? (
        <ol className="mt-1.5 divide-y divide-neutral-100">
          {favourites.map((favourite, index) => (
            <li key={favourite.entryId} className="flex items-center gap-2 py-1.5 text-sm">
              <span aria-hidden="true">{MEDALS[index]}</span>
              <span className="min-w-0 flex-1 truncate text-neutral-700">{favourite.name}</span>
              <span style={{ color: ratingColor(favourite.rating) }} className="font-bold tabular-nums">
                {favourite.rating}/10
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-1 text-xs text-neutral-500">
          Dá nota aos sítios onde vais e os teus preferidos aparecem aqui. ⭐
        </p>
      )}
    </section>
  );
}

function LevelCard({ went, level, style }: { went: number; level: ReturnType<typeof levelFor>; style: CSSProperties }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const [showLevels, setShowLevels] = useState(false);
  const progress = level.next === null ? 1 : (went - level.from) / (level.next - level.from);
  const nextLevel = level.next === null ? null : levelFor(level.next);

  return (
    <>
      {/* Tapping the card shows every level and how far each one is. */}
      <button
        type="button"
        onClick={() => setShowLevels(true)}
        aria-haspopup="dialog"
        style={style}
        className={`relative block w-full overflow-hidden rounded-3xl bg-gradient-to-br from-orange-400 via-accent to-orange-700 p-5 text-left text-white shadow-lg shadow-accent/30 transition active:scale-[0.98] ${ENTER}`}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-10 -right-8 size-36 rounded-full bg-white/15 blur-2xl"
        />
        <span className="relative flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-4xl ring-1 ring-white/30 motion-safe:animate-bounce [animation-iteration-count:2]"
          >
            {level.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold tracking-wide text-white/80 uppercase">O teu nível</span>
            <span className="block text-2xl leading-tight font-extrabold">{level.name}</span>
          </span>
          <span className="shrink-0 text-sm font-semibold text-white/90">Ver níveis ›</span>
        </span>
        <span
          role="progressbar"
          aria-label="Progresso para o próximo nível"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          className="relative mt-4 block h-3 overflow-hidden rounded-full bg-white/25"
        >
          <span
            className="block h-full rounded-full bg-white transition-[width] duration-1000 ease-out"
            style={{ width: grown ? `${Math.max(progress * 100, 4)}%` : "0%" }}
          />
        </span>
        <span className="relative mt-2 block text-sm text-white/90">
          {nextLevel
            ? `Faltam ${level.next! - went} ${level.next! - went === 1 ? "restaurante" : "restaurantes"} para ${nextLevel.emoji} ${nextLevel.name}`
            : "Último nível conhecido… há mais por desbloquear 👀"}
        </span>
      </button>
      {showLevels && <LevelsSheet went={went} onClose={() => setShowLevels(false)} />}
    </>
  );
}
