import { HomeMap } from "@/components/home/home-map";
import { getMapsConfig } from "@/lib/map/config";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", data!.claims.sub)
    .single();

  const config = getMapsConfig(process.env);

  return <HomeMap username={profile?.username ?? null} config={config} />;
}
