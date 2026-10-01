import type { Person } from "./people";

// Group details: who went to the most "mordomias" (the group's events) and who was mordomo the most.

type StatsEvent = { date: string | null; going: Person[]; mordomo: Person | null };

export type MemberStats = { person: Person; mordomias: number; asMordomo: number };

export type GroupStats = {
  // Events with a date ("Habemus data").
  dated: number;
  // Every event (with or without a date).
  total: number;
  // Most mordomias first (then most times mordomo, then name).
  byMordomias: MemberStats[];
  // Most times mordomo first (then most mordomias, then name).
  byMordomo: MemberStats[];
};

const byName = (a: MemberStats, b: MemberStats) => a.person.displayName.localeCompare(b.person.displayName, "pt");

// A mordomia counts for someone once the event has a date and they are going to it. Being mordomo counts for
// every event they organise. On a tie for mordomo, the group's Connoisseur (`crownId`) comes first.
export function groupStats(members: Person[], events: StatsEvent[], crownId?: string): GroupStats {
  const rows = new Map(members.map((person) => [person.id, { person, mordomias: 0, asMordomo: 0 }]));
  for (const event of events) {
    // People who left the group are not ranked.
    if (event.date) for (const person of event.going) if (rows.has(person.id)) rows.get(person.id)!.mordomias += 1;
    if (event.mordomo && rows.has(event.mordomo.id)) rows.get(event.mordomo.id)!.asMordomo += 1;
  }
  const all = [...rows.values()];
  return {
    dated: events.filter((event) => event.date).length,
    total: events.length,
    byMordomias: [...all].sort((a, b) => b.mordomias - a.mordomias || b.asMordomo - a.asMordomo || byName(a, b)),
    byMordomo: [...all].sort(
      (a, b) =>
        b.asMordomo - a.asMordomo ||
        Number(b.person.id === crownId) - Number(a.person.id === crownId) ||
        b.mordomias - a.mordomias ||
        byName(a, b),
    ),
  };
}
