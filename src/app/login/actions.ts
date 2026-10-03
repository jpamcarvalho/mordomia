"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isValidPassword, MIN_PASSWORD_LENGTH } from "@/lib/validation/password";
import { isValidUsername, normalizeUsername } from "@/lib/validation/username";

export type AuthState = { error?: string; message?: string };

// Supabase Auth error codes shown to the user in Portuguese; anything else gets a generic message.
const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "Email ou palavra-passe errados.",
  email_not_confirmed: "Ainda não confirmaste o teu email.",
  user_already_exists: "Já existe uma conta com este email.",
  email_exists: "Já existe uma conta com este email.",
  weak_password: "A palavra-passe é demasiado fraca.",
  over_email_send_rate_limit: "Demasiados emails enviados. Tenta mais tarde.",
  over_request_rate_limit: "Demasiadas tentativas. Tenta mais tarde.",
};

function authError(error: { code?: string }): string {
  return (error.code && AUTH_ERRORS[error.code]) || "Algo correu mal. Tenta outra vez.";
}

// Where to go after logging in: only a path on this site ("/x", not "//host" or "/\host"), else home.
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });
  if (error) return { error: authError(error) };
  redirect(safeNext(formData.get("next")));
}

export async function signup(_: AuthState, formData: FormData): Promise<AuthState> {
  const username = normalizeUsername(String(formData.get("username")));
  if (!isValidUsername(username)) {
    return { error: "O nome de utilizador tem de ter 3–24 caracteres: letras, números ou _." };
  }
  const password = String(formData.get("password"));
  if (!isValidPassword(password)) {
    return { error: `A palavra-passe tem de ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email")),
    password,
    options: {
      data: { username },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });
  if (error) return { error: authError(error) };
  return { message: "Vê o teu email para confirmares a conta." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
