// "Preço certo": the winner is the highest guess not above the price per person (total / people); on a tie, the
// earliest guess. Guesses above the price cannot win; when every guess is above, there is no winner.
// Amounts are compared in cents (guess × people ≤ total), so 32.14… needs no rounding.

export type PriceGuess<P> = { person: P; amount: number; at: string };

export const toCents = (euros: number) => Math.round(euros * 100);

export function pricePerPerson(total: number, people: number): number {
  return total / people;
}

// The guesses, best first: the valid ones from closest down, then the ones that went over (closest first).
// `winner` is the first one when it is valid.
export function rankGuesses<P>(guesses: PriceGuess<P>[], total: number, people: number) {
  const totalCents = toCents(total);
  const over = (guess: PriceGuess<P>) => toCents(guess.amount) * people > totalCents;
  const byTime = (a: PriceGuess<P>, b: PriceGuess<P>) => a.at.localeCompare(b.at);
  const valid = guesses.filter((guess) => !over(guess)).sort((a, b) => b.amount - a.amount || byTime(a, b));
  const above = guesses.filter(over).sort((a, b) => a.amount - b.amount || byTime(a, b));
  return { winner: valid[0] ?? null, valid, above };
}

const euros = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });
export const formatEuros = (amount: number) => euros.format(amount);

// "32,5" / "32.50" / "€ 32" → 32.5; null when not a positive amount with at most 2 decimals.
export function parseEuros(input: string, max: number): number | null {
  const clean = input.replace(/[€\s]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const value = Number(clean);
  return value > 0 && value <= max ? value : null;
}
