// A group's "Connoisseur": the member who has been mordomo the most times. On a tie the title stays with whoever
// got there first (someone has to pass them to take it).

type MordomoEvent = { mordomoId: string | null; createdAt: string };

export function connoisseur(events: MordomoEvent[], memberIds: string[]): { id: string; count: number } | null {
  const members = new Set(memberIds);
  const counts = new Map<string, number>();
  let leader: { id: string; count: number } | null = null;
  for (const event of [...events].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!event.mordomoId || !members.has(event.mordomoId)) continue;
    const count = (counts.get(event.mordomoId) ?? 0) + 1;
    counts.set(event.mordomoId, count);
    if (!leader || count > leader.count) leader = { id: event.mordomoId, count };
    else if (leader.id === event.mordomoId) leader = { id: leader.id, count };
  }
  return leader;
}
