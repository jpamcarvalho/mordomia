// Rating (whole number 0–10, optional) and free-text notes for "Adiciona à minha lista".

export const RATING_MIN = 0;
export const RATING_MAX = 10;
export const NOTES_MAX = 2000;

export type EntryDetails = { rating: number | null; notes: string | null };

// Validates details coming from the client; blank notes become null.
export function parseDetails(input: { rating?: unknown; notes?: unknown } | null | undefined): EntryDetails | null {
  const rating = input?.rating ?? null;
  if (rating !== null && !(Number.isInteger(rating) && (rating as number) >= RATING_MIN && (rating as number) <= RATING_MAX)) {
    return null;
  }
  const rawNotes = input?.notes ?? null;
  if (rawNotes !== null && typeof rawNotes !== "string") return null;
  const notes = rawNotes?.trim() || null;
  if (notes && notes.length > NOTES_MAX) return null;
  return { rating: rating as number | null, notes };
}
