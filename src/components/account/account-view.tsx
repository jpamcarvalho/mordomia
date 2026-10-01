"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { logout } from "@/app/login/actions";
import { saveBio, saveDisplayName, setAvatar } from "@/app/account/actions";
import { Spinner } from "@/components/spinner";
import { BIO_MAX, DISPLAY_NAME_MAX, levelFor, type AccountStats } from "@/lib/profile/account";
import { ratingColor } from "@/lib/list/rating-color";
import { avatarInitial } from "@/lib/profile/avatar";
import { AVATAR_BUCKET } from "@/lib/profile/load";
import { toSquareJpeg } from "@/lib/profile/square-photo";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  username: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  memberSince: string | null;
  stats: AccountStats;
};

const BIO_EMOJIS = ["🍕", "🍣", "🍷", "☕", "🥐", "🌶️", "🍔", "🥗", "🍰", "🐟"];
const MEDALS = ["🥇", "🥈", "🥉"];

// Staggered entrance for each section.
const ENTER = "motion-safe:animate-[sheet-up_450ms_ease-out_both]";
const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

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

export function AccountView({ userId, username, displayName, bio, avatarUrl, memberSince, stats }: Props) {
  const router = useRouter();
  const level = levelFor(stats.went);
  const since = memberSince
    ? new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(new Date(memberSince))
    : null;

  return (
    <main className="min-h-dvh bg-gradient-to-b from-orange-100 via-orange-50/40 to-white pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
        {/* Back to wherever the account was opened from (map or Mordomia Social); the map when opened directly. */}
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          className="flex w-fit items-center gap-1 rounded-full bg-white/80 px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm backdrop-blur active:scale-95"
        >
          <span aria-hidden="true">←</span> Voltar
        </button>

        <section style={delay(0)} className={`flex flex-col items-center text-center ${ENTER}`}>
          <AvatarPicker userId={userId} username={username} initialUrl={avatarUrl} />
          <NameEditor initialName={displayName} username={username} />
          {username && <p className="text-neutral-500">@{username}</p>}
          {since && <p className="mt-1 text-xs text-neutral-400">No Mordomia desde {since}</p>}
        </section>

        <LevelCard went={stats.went} level={level} style={delay(80)} />

        <section style={delay(160)} className={`grid grid-cols-3 gap-3 ${ENTER}`}>
          <StatCard emoji="🍽️" label="Onde já fui" value={stats.went} highlight />
          <StatCard emoji="🤤" label="Quero ir" value={stats.want} />
          <StatCard emoji="⭐" label="Nota média" value={stats.average} decimals={1} />
        </section>

        <BioCard initialBio={bio} style={delay(240)} />

        <section style={delay(320)} className={`rounded-3xl bg-white p-5 shadow-sm ${ENTER}`}>
          <h2 className="font-semibold">🏆 Os meus favoritos</h2>
          {stats.favourites.length ? (
            <ol className="mt-3 flex flex-col gap-2">
              {stats.favourites.map((favourite, index) => (
                <li
                  key={favourite.entryId}
                  className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-3 py-3 transition hover:bg-orange-50"
                >
                  <span aria-hidden="true" className="text-2xl">
                    {MEDALS[index]}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{favourite.name}</span>
                  <span style={{ backgroundColor: ratingColor(favourite.rating) }} className="rounded-full px-2.5 py-1 text-sm font-bold text-white">
                    {favourite.rating}/10
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">
              Dá nota aos sítios onde vais e os teus preferidos aparecem aqui. ⭐
            </p>
          )}
        </section>

        <form action={logout} style={delay(400)} className={`flex justify-center ${ENTER}`}>
          <button className="flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-red-100 bg-white font-semibold text-red-600 shadow-sm transition hover:bg-red-50 active:scale-95">
            <span aria-hidden="true">👋</span>
            Terminar sessão
          </button>
        </form>
      </div>
    </main>
  );
}

function AvatarPicker({ userId, username, initialUrl }: { userId: string; username: string | null; initialUrl: string | null }) {
  const [url, setUrl] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    const preview = URL.createObjectURL(file);
    const previous = url;
    setUrl(preview);
    try {
      const blob = await toSquareJpeg(file);
      const path = `${userId}/${Date.now()}.jpg`;
      const storage = createClient().storage.from(AVATAR_BUCKET);
      const { error: uploadError } = await storage.upload(path, blob, { contentType: "image/jpeg" });
      if (uploadError) throw uploadError;
      const result = await setAvatar(path);
      if (!result.ok) {
        await storage.remove([path]);
        throw new Error(result.error);
      }
      setUrl(result.url);
    } catch {
      setUrl(previous);
      setError("Não foi possível usar esta foto. Experimenta outra.");
    } finally {
      URL.revokeObjectURL(preview);
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await setAvatar(null);
    if (result.ok) setUrl(null);
    else setError(result.error);
    setBusy(false);
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label={url ? "Mudar a foto" : "Adicionar foto"}
        className="group relative size-32 rounded-full transition active:scale-95"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL / local preview
          <img src={url} alt="" className="size-full rounded-full object-cover shadow-lg ring-4 ring-white" />
        ) : (
          <span className="flex size-full items-center justify-center rounded-full bg-accent text-5xl font-bold text-white shadow-lg ring-4 ring-white">
            {avatarInitial(username)}
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/60">
            <Spinner />
          </span>
        )}
        <span
          aria-hidden="true"
          className="absolute right-0 bottom-0 flex size-10 items-center justify-center rounded-full bg-white text-lg shadow-md ring-2 ring-orange-100 transition group-hover:scale-110"
        >
          📷
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {url && !busy && (
        <button type="button" onClick={remove} className="mt-2 text-xs text-neutral-400 underline">
          Remover foto
        </button>
      )}
    </div>
  );
}

function NameEditor({ initialName, username }: { initialName: string | null; username: string | null }) {
  const [name, setName] = useState(initialName);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function save() {
    startSaving(async () => {
      const result = await saveDisplayName(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setName(result.displayName);
      setDraft(null);
    });
  }

  if (draft === null) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(name ?? "");
          setError(null);
        }}
        aria-label="Mudar o nome"
        className="group mt-4 flex items-center gap-2 rounded-full px-3 py-1 transition hover:bg-white/70 active:scale-95"
      >
        <h1 className="text-2xl font-bold">{name || username}</h1>
        <span aria-hidden="true" className="text-base opacity-60 transition group-hover:opacity-100">
          ✏️
        </span>
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
      className="mt-4 flex w-full max-w-xs flex-col items-center gap-2"
    >
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && setDraft(null)}
        maxLength={DISPLAY_NAME_MAX}
        aria-label="Nome"
        placeholder={username ?? "O teu nome"}
        className="w-full rounded-2xl border-2 border-accent bg-white px-4 py-2 text-center text-xl font-bold outline-none"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDraft(null)}
          className="h-9 rounded-full border-2 border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="h-9 rounded-full bg-accent px-5 text-sm font-semibold text-white shadow disabled:opacity-60"
        >
          {saving ? "A guardar…" : "Guardar"}
        </button>
      </div>
      <p className="text-xs text-neutral-400">O @nome de utilizador não muda.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

function LevelCard({
  went,
  level,
  style,
}: {
  went: number;
  level: ReturnType<typeof levelFor>;
  style: CSSProperties;
}) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const progress = level.next === null ? 1 : (went - level.from) / (level.next - level.from);
  const nextLevel = level.next === null ? null : levelFor(level.next);

  return (
    <section style={style} className={`rounded-3xl bg-white p-5 shadow-sm ${ENTER}`}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-4xl motion-safe:animate-bounce [animation-iteration-count:2]">
          {level.emoji}
        </span>
        <div>
          <p className="text-xs font-medium tracking-wide text-accent uppercase">O teu nível</p>
          <p className="text-lg font-bold">{level.name}</p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label="Progresso para o próximo nível"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="mt-4 h-3 overflow-hidden rounded-full bg-orange-100"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-400 to-accent transition-[width] duration-1000 ease-out"
          style={{ width: grown ? `${Math.max(progress * 100, 4)}%` : "0%" }}
        />
      </div>
      <p className="mt-2 text-sm text-neutral-500">
        {nextLevel
          ? `Faltam ${level.next! - went} ${level.next! - went === 1 ? "restaurante" : "restaurantes"} para ${nextLevel.emoji} ${nextLevel.name}`
          : "Chegaste ao topo. Os restaurantes do Porto agradecem! 🎉"}
      </p>
    </section>
  );
}

function StatCard({
  emoji,
  label,
  value,
  decimals = 0,
  highlight = false,
}: {
  emoji: string;
  label: string;
  value: number | null;
  decimals?: number;
  highlight?: boolean;
}) {
  const shown = useCountUp(value ?? 0, decimals);
  return (
    <div
      className={`flex flex-col items-center gap-1 rounded-3xl p-4 text-center shadow-sm transition hover:-translate-y-0.5 active:scale-95 ${
        highlight ? "bg-accent text-white" : "bg-white"
      }`}
    >
      <span aria-hidden="true" className="text-2xl">
        {emoji}
      </span>
      <span className="text-3xl font-extrabold tabular-nums">{value === null ? "–" : shown}</span>
      <span className={`text-xs font-medium ${highlight ? "text-white/85" : "text-neutral-500"}`}>{label}</span>
    </div>
  );
}

function BioCard({ initialBio, style }: { initialBio: string | null; style: CSSProperties }) {
  const [bio, setBio] = useState(initialBio);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, startSaving] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  function edit() {
    setDraft(bio ?? "");
    setError(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function addEmoji(emoji: string) {
    setDraft((text) => {
      const next = `${text ?? ""}${emoji}`;
      return next.length <= BIO_MAX ? next : text;
    });
    textareaRef.current?.focus();
  }

  function save() {
    startSaving(async () => {
      const result = await saveBio(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBio(result.bio);
      setDraft(null);
      setSaved(true);
    });
  }

  const left = BIO_MAX - (draft?.length ?? 0);

  return (
    <section style={style} className={`rounded-3xl bg-white p-5 shadow-sm ${ENTER}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">💬 Sobre mim</h2>
        {draft === null && (
          <button type="button" onClick={edit} className="rounded-full px-3 py-1 text-sm font-medium text-accent hover:bg-orange-50">
            {saved ? "Guardado ✓" : bio ? "Editar" : "Escrever"}
          </button>
        )}
      </div>

      {draft === null ? (
        <button type="button" onClick={edit} className="mt-2 block w-full text-left">
          {bio ? (
            <p className="whitespace-pre-line text-neutral-700">{bio}</p>
          ) : (
            <p className="text-sm text-neutral-400">Conta aos teus amigos o que gostas de comer… 😋</p>
          )}
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={BIO_MAX}
            rows={3}
            aria-label="Sobre mim"
            placeholder="Ex.: Fã de francesinhas e de tascas com toalhas aos quadrados."
            className="resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-base outline-none focus:border-accent focus:bg-white"
          />
          <div className="flex flex-wrap gap-1.5">
            {BIO_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => addEmoji(emoji)}
                aria-label={`Adicionar ${emoji}`}
                className="flex size-9 items-center justify-center rounded-full bg-neutral-100 text-lg transition hover:scale-110 active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className={`text-xs tabular-nums ${left <= 10 ? "text-accent" : "text-neutral-400"}`}>{left}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="h-10 rounded-full border-2 border-neutral-200 px-4 text-sm font-semibold text-neutral-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="h-10 rounded-full bg-accent px-5 text-sm font-semibold text-white shadow disabled:opacity-60"
              >
                {saving ? "A guardar…" : "Guardar"}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </section>
  );
}
