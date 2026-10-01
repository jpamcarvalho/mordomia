import { RATING_MAX } from "./details";

// One colour per grade, red (0) → orange → yellow (5) → green (10). Dark enough to carry white text.
const RATING_COLORS = [
  "#b91c1c",
  "#dc2626",
  "#ea580c",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#8fb30f",
  "#65a30d",
  "#40a02b",
  "#16a34a",
  "#15803d",
];

export function ratingColor(rating: number): string {
  return RATING_COLORS[Math.min(Math.max(Math.round(rating), 0), RATING_MAX)];
}

// The whole scale as a CSS gradient (0 on the left, 10 on the right).
export const RATING_GRADIENT = `linear-gradient(to right, ${RATING_COLORS.join(", ")})`;
