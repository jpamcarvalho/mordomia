import type { Person } from "./people";
import { rankGuesses, type PriceGuess } from "./price-guess";

// Group details: who went to the most "mordomias" (the group's events), who was mordomo the most, and who won the
// Preço certo the most.

type StatsEvent = {
  date: string | null;
  going: Person[];
  mordomo: Person | null;
  price: { bill: { total: number; people: number } | null; guesses: PriceGuess<Person>[] };
};

export type MemberStats = { person: Person; mordomias: number; asMordomo: number; priceWins: number };

export type GroupStats = {
  // Events with a date ("Habemus data").
  dated: number;
  // Every event (with or without a date).
  total: number;
  // Most mordomias first (then most times mordomo, then name).
  byMordomias: MemberStats[];
  // Most times mordomo first (then most mordomias, then name).
  byMordomo: MemberStats[];
  // Preço certo games revealed.
  priceGames: number;
  // Most Preço certo wins first (then name).
  byPriceWins: MemberStats[];
};

const byName = (a: MemberStats, b: MemberStats) => a.person.displayName.localeCompare(b.person.displayName, "pt");

// A mordomia counts for someone once the event has a date and they are going to it. Being mordomo counts for
// every event they organise. On a tie for mordomo, the group's Connoisseur (`crownId`) comes first.
export function groupStats(members: Person[], events: StatsEvent[], crownId?: string): GroupStats {
  const rows = new Map(members.map((person) => [person.id, { person, mordomias: 0, asMordomo: 0, priceWins: 0 }]));
  for (const event of events) {
    // People who left the group are not ranked.
    if (event.date) for (const person of event.going) if (rows.has(person.id)) rows.get(person.id)!.mordomias += 1;
    if (event.mordomo && rows.has(event.mordomo.id)) rows.get(event.mordomo.id)!.asMordomo += 1;
    const { bill, guesses } = event.price;
    const winner = bill ? rankGuesses(guesses, bill.total, bill.people).winner : null;
    if (winner && rows.has(winner.person.id)) rows.get(winner.person.id)!.priceWins += 1;
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
    priceGames: events.filter((event) => event.price.bill).length,
    byPriceWins: [...all].sort((a, b) => b.priceWins - a.priceWins || byName(a, b)),
  };
}
