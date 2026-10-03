// Event days are calendar days ("YYYY-MM-DD", no time zone). Helpers for the date poll's calendar and labels.

const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

// Today on this device.
export function todayKey(now = new Date()): string {
  return dayKey(now.getFullYear(), now.getMonth(), now.getDate());
}

// Noon avoids any time-zone shift when formatting.
function toDate(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

const LONG = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long" });
const SHORT = new Intl.DateTimeFormat("pt-PT", { weekday: "short", day: "numeric", month: "short" });
const MONTH = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" });

// "sábado, 12 de outubro"
export function formatDay(key: string): string {
  return LONG.format(toDate(key));
}

// "sáb., 12/out." style, for chips.
// "sábado, 10 de outubro às 20:30" (just the day without a time).
export function formatDayTime(key: string, time: string | null): string {
  return time ? `${formatDay(key)} às ${time}` : formatDay(key);
}

export function formatDayShort(key: string): string {
  return SHORT.format(toDate(key));
}

// "outubro de 2026"
export function formatMonth(year: number, month: number): string {
  return MONTH.format(new Date(year, month, 15));
}

// Monday-first weeks: day numbers of the month, with null padding before the 1st and after the last day.
export function monthGrid(year: number, month: number): (number | null)[] {
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  return cells;
}

export const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];
