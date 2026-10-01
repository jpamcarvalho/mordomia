"use client";

import { useRouter } from "next/navigation";
import type { Group } from "@/app/social/groups";
import type { GroupStats, MemberStats } from "@/lib/social/group-stats";
import { CrownedAvatar, GroupPhoto, PersonAvatar, groupHref, memberCount } from "./groups-tab";

const MEDALS = ["🥇", "🥈", "🥉"];

type Props = { group: Group; stats: GroupStats };

// Group details: who went to the most mordomias (events with a date they were going to) and who was mordomo
// the most times.
export function GroupDetails({ group, stats }: Props) {
  const router = useRouter();
  return (
    <main className="min-h-dvh bg-gradient-to-b from-orange-50 to-neutral-50 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => (window.history.length > 1 ? router.back() : router.push(groupHref(group.id)))}
          className="-ml-1 flex size-10 items-center justify-center rounded-full hover:bg-neutral-100"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>

        <header className="flex items-center gap-4 motion-safe:animate-[sheet-up_400ms_ease-out_both]">
          <GroupPhoto group={group} className="size-16 text-3xl shadow-md" />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">Detalhes do grupo</p>
            <h1 className="truncate text-2xl font-bold">{group.name}</h1>
            <p className="text-sm text-neutral-500">{memberCount(group)}</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 motion-safe:animate-[sheet-up_400ms_80ms_ease-out_both]">
          <Stat emoji="🎉" value={stats.dated} label={stats.dated === 1 ? "mordomia marcada" : "mordomias marcadas"} />
          <Stat emoji="🗓️" value={stats.total} label={stats.total === 1 ? "evento no total" : "eventos no total"} />
        </section>

        <Ranking
          title="🍽️ Quem foi a mais mordomias"
          hint="Eventos com data a que a pessoa vai ou foi."
          rows={stats.byMordomias}
          value={(row) => row.mordomias}
          unit={(count) => (count === 1 ? "mordomia" : "mordomias")}
          empty="Ainda não há mordomias com data."
          delay={160}
        />

        <Ranking
          crownId={group.connoisseur?.person.id}
          title="🎩 Quem foi mordomo mais vezes"
          hint="Eventos que a pessoa organizou."
          rows={stats.byMordomo}
          value={(row) => row.asMordomo}
          unit={(count) => (count === 1 ? "vez" : "vezes")}
          empty="Ainda ninguém foi mordomo."
          delay={240}
        />
      </div>
    </main>
  );
}

function Stat({ emoji, value, label }: { emoji: string; value: number; label: string }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm">
      <span aria-hidden="true" className="text-2xl">
        {emoji}
      </span>
      <p className="mt-1 text-3xl font-black">{value}</p>
      <p className="text-sm text-neutral-500">{label}</p>
    </div>
  );
}

type RankingProps = {
  // The group's Connoisseur, crowned in the mordomo ranking.
  crownId?: string;
  title: string;
  hint: string;
  rows: MemberStats[];
  value: (row: MemberStats) => number;
  unit: (count: number) => string;
  empty: string;
  delay: number;
};

// A podium for the top 3 (with any score) and the rest as a list, with bars against the leader.
function Ranking({ crownId, title, hint, rows, value, unit, empty, delay }: RankingProps) {
  const top = Math.max(0, ...rows.map(value));
  // Ties share a place: 1, 1, 3…
  const places = rows.map((row) => rows.findIndex((other) => value(other) === value(row)));

  return (
    <section style={{ animationDelay: `${delay}ms` }} className="rounded-3xl bg-white p-5 shadow-sm motion-safe:animate-[sheet-up_400ms_ease-out_both]">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-xs text-neutral-400">{hint}</p>

      {top === 0 ? (
        <p className="mt-4 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">{empty}</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-2">
          {rows.map((row, index) => {
            const count = value(row);
            const place = places[index];
            return (
              <li key={row.person.id} className={`flex items-center gap-3 ${count === 0 ? "opacity-50" : ""}`}>
                <span aria-label={`${place + 1}.º`} className="w-7 shrink-0 text-center text-lg font-bold text-neutral-400">
                  {count > 0 && place < 3 ? MEDALS[place] : `${place + 1}`}
                </span>
                {row.person.id === crownId ? (
                  <CrownedAvatar person={row.person} className="size-11 text-sm" />
                ) : (
                  <PersonAvatar person={row.person} className={`text-sm ${count > 0 && place === 0 ? "size-11 ring-2 ring-amber-400" : "size-9"}`} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-semibold">{row.person.displayName}</span>
                    {row.person.id === crownId && (
                      <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase">Connoisseur</span>
                    )}
                  </span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-neutral-100">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-accent transition-[width] duration-700"
                      style={{ width: `${top ? (count / top) * 100 : 0}%` }}
                    />
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-lg leading-none font-black">{count}</span>
                  <span className="text-[11px] text-neutral-400">{unit(count)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
