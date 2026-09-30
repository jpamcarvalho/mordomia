"use client";

import { useActionState, useState } from "react";
import { login, signup, type AuthState } from "./actions";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "login" ? login : signup,
    {},
  );

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold">Mordomia</h1>

      <form action={action} className="flex flex-col gap-3">
        {mode === "signup" && (
          <input
            name="username"
            placeholder="Username"
            autoComplete="username"
            required
            className="rounded-lg border px-3 py-2"
          />
        )}
        <input
          name="email"
          type="email"
          placeholder="Email"
          autoComplete="email"
          required
          className="rounded-lg border px-3 py-2"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={8}
          required
          className="rounded-lg border px-3 py-2"
        />
        <button
          disabled={pending}
          className="rounded-lg bg-black px-3 py-2 font-medium text-white disabled:opacity-50"
        >
          {mode === "login" ? "Sign in" : "Create account"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        {state.message && <p className="text-sm text-green-700">{state.message}</p>}
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="text-sm underline"
      >
        {mode === "login" ? "No account? Sign up" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
