import { normalizeName } from "@/lib/search/photon";
import type { ListItem } from "./types";

// Items on either list whose name contains every word of the query, ignoring case and accents
// ("tasca ze" finds "Tasca do Zé"). Blank query → all items.
export function searchList(items: ListItem[], query: string): ListItem[] {
  const words = normalizeName(query).split(" ").filter(Boolean);
  if (words.length === 0) return items;
  return items.filter((item) => {
    const name = normalizeName(item.name);
    return words.every((word) => name.includes(word));
  });
}
