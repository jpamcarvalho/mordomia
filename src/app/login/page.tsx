"use client";

import { use, useActionState, useState } from "react";
import { PinMark } from "@/components/splash";
import { MIN_PASSWORD_LENGTH } from "@/lib/validation/password";
import { login, signup, type AuthState } from "./actions";

type Mode = "login" | "signup";

const TABS: { mode: Mode; label: string }[] = [
  { mode: "login", label: "Entrar" },
  { mode: "signup", label: "Registar" },
];

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  // The page that sent a signed-out visitor here; login returns to it (checked again by the action).
  const { next } = use(searchParams);
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  // Controlled so a failed attempt keeps them: React resets the uncontrolled fields of a form after its action runs.
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "login" ? login : signup,
    {},
  );

  function selectMode(next: Mode) {
    setMode(next);
    setShowPassword(false);
  }

  const field =
    "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-[15px] outline-none transition focus:border-accent focus:bg-white focus:ring-4 focus:ring-accent/15";

  return (
    // Same warm gradient and pin as the splash, so opening the app feels like one piece.
    <main className="relative flex w-full flex-1 flex-col overflow-hidden bg-gradient-to-b from-orange-100 via-orange-50 to-white">
      <div aria-hidden="true" className="pointer-events-none absolute -top-24 -right-20 size-72 rounded-full bg-orange-300/30 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute top-40 -left-24 size-64 rounded-full bg-amber-200/40 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-7 px-5 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <div className="flex flex-col items-center text-center motion-safe:animate-[sheet-up_500ms_ease-out_both]">
          <PinMark className="h-16 w-12 drop-shadow-md" />
          <h1 className="mt-3 text-5xl font-extrabold tracking-tight">Mordomia</h1>
          <p className="mt-2 max-w-xs text-[17px] leading-snug text-balance text-neutral-600">
            Os restaurantes onde foste e os que queres experimentar, com amigos.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-5 shadow-xl ring-1 shadow-orange-900/10 ring-black/5 motion-safe:animate-[sheet-up_500ms_120ms_ease-out_both]">
          <div role="tablist" aria-label="Conta" className="flex rounded-full bg-neutral-100 p-1">
            {TABS.map((tab) => {
              const active = mode === tab.mode;
              return (
                <button
                  key={tab.mode}
                  id={`tab-${tab.mode}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="auth-panel"
                  onClick={() => selectMode(tab.mode)}
                  className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                    active ? "bg-white text-accent shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <form
            id="auth-panel"
            role="tabpanel"
            aria-labelledby={`tab-${mode}`}
            action={action}
            className="mt-5 flex flex-col gap-4"
          >
            {mode === "login" && typeof next === "string" && <input type="hidden" name="next" value={next} />}
            {mode === "signup" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="username" className="text-sm font-semibold text-neutral-700">
                  Nome de utilizador
                </label>
                <input
                  id="username"
                  name="username"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className={field}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-neutral-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={field}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-semibold text-neutral-700">
                Palavra-passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  className={`${field} pr-20`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Esconder palavra-passe" : "Mostrar palavra-passe"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((shown) => !shown)}
                  className="absolute inset-y-0 right-0 px-3.5 text-sm font-semibold text-accent"
                >
                  {showPassword ? "Esconder" : "Mostrar"}
                </button>
              </div>
            </div>
            <button
              disabled={pending}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-base font-bold text-white shadow-lg shadow-accent/30 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
            >
              {pending && (
                <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {mode === "login" ? "Entrar" : "Criar conta"}
            </button>
            {state.error && (
              <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
                {state.error}
              </p>
            )}
            {state.message && (
              <p role="status" className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700">
                {state.message}
              </p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}
