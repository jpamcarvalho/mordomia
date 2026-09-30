import { HomeMap } from "@/components/home/home-map";
import { loadCustomPlaces, loadList } from "@/lib/list/load";
import { avatarUrl } from "@/lib/profile/load";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data!.claims.sub;

  const [{ data: profile }, list, customPlaces] = await Promise.all([
    supabase.from("profiles").select("username, avatar_path").eq("id", userId).single(),
    loadList(supabase, userId),
    loadCustomPlaces(supabase),
  ]);

  return (
    <HomeMap
      username={profile?.username ?? null}
      avatarUrl={await avatarUrl(supabase, profile?.avatar_path)}
      initialList={list}
      initialCustomPlaces={customPlaces}
    />
  );
}
