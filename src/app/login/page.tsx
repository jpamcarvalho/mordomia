"use client";

import { use, useActionState, useState } from "react";
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
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "login" ? login : signup,
    {},
  );

  function selectMode(next: Mode) {
    setMode(next);
    setShowPassword(false);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Mordomia</h1>
        <p className="text-neutral-600">
          Os restaurantes onde foste e os que queres experimentar, com amigos.
        </p>
      </div>

      <div role="tablist" aria-label="Conta" className="flex border-b border-neutral-200">
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
              className={`-mb-px flex-1 border-b-2 px-3 py-2 font-medium ${
                active ? "border-accent text-accent" : "border-transparent text-neutral-500"
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
        className="flex flex-col gap-3"
      >
        {mode === "login" && typeof next === "string" && <input type="hidden" name="next" value={next} />}
        {mode === "signup" && (
          <div className="flex flex-col gap-1">
            <label htmlFor="username" className="text-sm font-medium">
              Nome de utilizador
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              required
              className="rounded-lg border px-3 py-2"
            />
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="rounded-lg border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
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
              className="w-full rounded-lg border py-2 pr-16 pl-3"
            />
            <button
              type="button"
              aria-label={showPassword ? "Esconder palavra-passe" : "Mostrar palavra-passe"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((shown) => !shown)}
              className="absolute inset-y-0 right-0 px-3 text-sm font-medium text-neutral-600"
            >
              {showPassword ? "Esconder" : "Mostrar"}
            </button>
          </div>
        </div>
        <button
          disabled={pending}
          className="rounded-lg bg-accent px-3 py-2 font-medium text-white disabled:opacity-50"
        >
          {mode === "login" ? "Entrar" : "Criar conta"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.message && <p className="text-sm text-green-700">{state.message}</p>}
      </form>
    </main>
  );
}
