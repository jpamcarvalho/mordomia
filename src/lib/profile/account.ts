import type { ListItem } from "@/lib/list/types";

// "Sobre mim" on the account page.
export const BIO_MAX = 160;

// Validates a bio coming from the client; blank becomes null.
export function parseBio(input: unknown): { bio: string | null } | null {
  if (input !== null && typeof input !== "string") return null;
  const bio = input?.trim() || null;
  if (bio && bio.length > BIO_MAX) return null;
  return { bio };
}

// The name shown on the profile; blank falls back to the username.
export const DISPLAY_NAME_MAX = 40;

// Validates a display name from the client: trims, collapses spaces; blank becomes null.
export function parseDisplayName(input: unknown): { displayName: string | null } | null {
  if (input !== null && typeof input !== "string") return null;
  const displayName = input?.trim().replace(/\s+/g, " ") || null;
  if (displayName && displayName.length > DISPLAY_NAME_MAX) return null;
  return { displayName };
}

// Profile photos live in the "avatars" bucket at {userId}/{filename}.
export function isOwnAvatarPath(userId: string, path: unknown): path is string {
  if (typeof path !== "string") return false;
  const [folder, file, ...rest] = path.split("/");
  return folder === userId && !!file && rest.length === 0 && /^[\w.-]+$/.test(file);
}

export type Favourite = { entryId: string; name: string; rating: number };

export type AccountStats = {
  // "Adiciona à minha lista": places the user has been to.
  went: number;
  want: number;
  // Average of the rated places, one decimal; null when nothing is rated.
  average: number | null;
  // Best rated first, at most 3.
  favourites: Favourite[];
};

export function accountStats(items: ListItem[]): AccountStats {
  const went = items.filter((item) => item.status === "saved");
  const rated = went.filter((item): item is ListItem & { rating: number } => item.rating !== null);
  const average = rated.length
    ? Math.round((rated.reduce((sum, item) => sum + item.rating, 0) / rated.length) * 10) / 10
    : null;
  const favourites = [...rated]
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 3)
    .map(({ entryId, name, rating }) => ({ entryId, name, rating }));
  return { went: went.length, want: items.length - went.length, average, favourites };
}

export type Level = {
  emoji: string;
  name: string;
  // Places needed to reach this level.
  from: number;
  // Places needed for the next level; null at the top.
  next: number | null;
};

const LEVELS: readonly Omit<Level, "next">[] = [
  { emoji: "🌱", name: "A começar", from: 0 },
  { emoji: "🍴", name: "Provador", from: 5 },
  { emoji: "🧭", name: "Explorador", from: 15 },
  { emoji: "🏅", name: "Gourmet", from: 30 },
  { emoji: "👑", name: "Mordomo-mor", from: 60 },
];

// Level earned by the number of places the user has been to.
export function levelFor(went: number): Level {
  const index = LEVELS.findLastIndex((level) => went >= level.from);
  return { ...LEVELS[index], next: LEVELS[index + 1]?.from ?? null };
}
