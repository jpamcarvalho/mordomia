import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", data!.claims.sub)
    .single();

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mordomia</h1>
        <form action={logout}>
          <button className="text-sm underline">Sign out</button>
        </form>
      </header>
      <p>Hi @{profile?.username ?? "there"} 👋</p>
      <p className="text-sm opacity-70">
        Your restaurants will live here: “I went” and “I want to go”, as a list and a map.
      </p>
    </main>
  );
}
