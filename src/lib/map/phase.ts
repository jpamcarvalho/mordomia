export type MapStatus = "loading" | "ready" | "failed";
export type HomePhase = "splash" | "map" | "error";

// AC-3: splash until the location has settled AND the map has rendered or failed.
export function homePhase(locationSettled: boolean, mapStatus: MapStatus): HomePhase {
  if (!locationSettled || mapStatus === "loading") return "splash";
  return mapStatus === "ready" ? "map" : "error";
}
