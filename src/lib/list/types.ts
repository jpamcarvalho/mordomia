import type { FoodClass } from "@/lib/map/restaurants";

// The two private lists: "Adiciona à minha lista" (saved) and "Quero ir!" (want).
export type ListStatus = "saved" | "want";

export const LIST_STATUSES: readonly ListStatus[] = ["saved", "want"];

export const LIST_LABELS: Record<ListStatus, string> = {
  saved: "Minha lista",
  want: "Quero ir!",
};

export function isListStatus(value: unknown): value is ListStatus {
  return value === "saved" || value === "want";
}

// A restaurant on one of the user's private lists.
export type ListItem = {
  entryId: string;
  status: ListStatus;
  // The map place id (OSM) — matches SelectedPlace.id.
  placeId: string;
  name: string;
  kind: FoodClass | null;
  lat: number;
  lng: number;
};
