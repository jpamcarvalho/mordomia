"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { saveBio, saveDisplayName, setAvatar } from "@/app/account/actions";
import { Spinner } from "@/components/spinner";
import { BIO_MAX, DISPLAY_NAME_MAX, memberSinceLabel } from "@/lib/profile/account";
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
};

const BIO_EMOJIS = ["🍕", "🍣", "🍷", "☕", "🥐", "🌶️", "🍔", "🥗", "🍰", "🐟"];

const field =
  "w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-base outline-none transition focus:border-accent focus:bg-white";

// "Editar perfil": the photo (saved as soon as it is picked), the name and "Sobre mim" (saved together).
// The @username and the join date are shown but never change.
export function EditProfileView({ userId, username, displayName, bio, avatarUrl, memberSince }: Props) {
  const router = useRouter();
  const [name, setName] = useState(displayName ?? "");
  const [about, setAbout] = useState(bio ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const since = memberSinceLabel(memberSince);
  const left = BIO_MAX - about.length;
  const changed = name.trim() !== (displayName ?? "") || about.trim() !== (bio ?? "");

  // Back to the account page (it was opened from there); the account page when opened directly.
  function leave() {
    if (window.history.length > 1) router.back();
    else router.push("/account");
  }

  function addEmoji(emoji: string) {
    setAbout((text) => (text.length + emoji.length <= BIO_MAX ? `${text}${emoji}` : text));
    bioRef.current?.focus();
  }

  function save() {
    setError(null);
    startSaving(async () => {
      const [nameResult, bioResult] = await Promise.all([saveDisplayName(name), saveBio(about)]);
      const failed = [nameResult, bioResult].find((result) => !result.ok);
      if (failed && !failed.ok) {
        setError(failed.error);
        return;
      }
      leave();
    });
  }

  return (
    <main className="min-h-dvh bg-gradient-to-b from-orange-100 via-orange-50/40 to-white pb-[calc(env(safe-area-inset-bottom)+6rem)]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
        className="mx-auto flex max-w-md flex-col gap-5 px-5 pt-[calc(env(safe-area-inset-top)+1rem)]"
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={leave}
            className="flex w-fit items-center gap-1 rounded-full bg-white/80 px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm backdrop-blur active:scale-95"
          >
            <span aria-hidden="true">←</span> Voltar
          </button>
          <h1 className="text-lg font-extrabold tracking-tight">Editar perfil</h1>
          {/* Keeps the title centred. */}
          <span aria-hidden="true" className="w-[5.5rem]" />
        </div>

        <AvatarPicker userId={userId} username={username} initialUrl={avatarUrl} />

        <section className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="display-name" className="text-sm font-semibold text-neutral-700">
              Nome
            </label>
            <input
              id="display-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={DISPLAY_NAME_MAX}
              placeholder={username ?? "O teu nome"}
              className={field}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="bio" className="text-sm font-semibold text-neutral-700">
                Sobre mim
              </label>
              <span className={`text-xs tabular-nums ${left <= 10 ? "text-accent" : "text-neutral-400"}`}>{left}</span>
            </div>
            <textarea
              id="bio"
              ref={bioRef}
              value={about}
              onChange={(event) => setAbout(event.target.value)}
              maxLength={BIO_MAX}
              rows={3}
              placeholder="Ex.: Fã de francesinhas e de tascas com toalhas aos quadrados."
              className={`${field} resize-none`}
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
          </div>
        </section>

        {/* Shown, not editable. */}
        <section className="flex flex-col divide-y divide-neutral-100 rounded-3xl bg-white px-5 shadow-sm">
          <ReadOnlyRow label="Nome de utilizador" value={username ? `@${username}` : "—"} />
          <ReadOnlyRow label="No Mordomia desde" value={since ?? "—"} />
        </section>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || !changed}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-accent font-bold text-white shadow-lg shadow-accent/30 transition active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
        >
          {saving ? "A guardar…" : "Guardar"}
        </button>
      </form>
    </main>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3.5">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
        {value}
        <span aria-label="Não editável" className="text-xs">
          🔒
        </span>
      </span>
    </div>
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
      <div className="mt-2 flex gap-3 text-sm">
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="font-semibold text-accent">
          {url ? "Mudar foto" : "Adicionar foto"}
        </button>
        {url && !busy && (
          <button type="button" onClick={remove} className="text-neutral-400 underline">
            Remover
          </button>
        )}
      </div>
    </div>
  );
}
