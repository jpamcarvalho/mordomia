import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export type TestUser = { id: string; email: string; password: string; username: string };

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.test.example)");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Creates an already-confirmed user through the local Supabase admin API.
// The DB trigger handle_new_user creates the matching profiles row.
export async function createConfirmedUser(): Promise<TestUser> {
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const username = `e2e_${suffix}`;
  const email = `${username}@example.test`;
  const password = `pw-${randomUUID()}`;

  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username },
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");

  return { id: data.user.id, email, password, username };
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await adminClient().auth.admin.deleteUser(id);
  if (error) throw error;
}
