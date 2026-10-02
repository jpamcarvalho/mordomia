"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { guessEventPrice, revealEventBill, setEventPriceGame, type GroupEvent } from "@/app/social/groups";
import { Spinner } from "@/components/spinner";
import { formatEuros, parseEuros, pricePerPerson, rankGuesses } from "@/lib/social/price-guess";
import { PersonAvatar, Sheet, primary, secondary } from "./groups-tab";
import { ProfileLink } from "./profile-link";

type Props = { event: GroupEvent; onChanged: () => Promise<void> };

const input =
  "h-12 w-full rounded-2xl bg-neutral-50 px-4 text-lg font-semibold ring-1 ring-neutral-200 outline-none focus:ring-2 focus:ring-accent";

// Remembers (on this device) that the reveal ceremony was seen, so it plays once per event.
const seenKey = (eventId: string) => `mordomia:preco-certo:${eventId}`;
function ceremonySeen(eventId: string): boolean {
  try {
    return localStorage.getItem(seenKey(eventId)) === "1";
  } catch {
    return true;
  }
}
function markCeremonySeen(eventId: string) {
  try {
    localStorage.setItem(seenKey(eventId), "1");
  } catch {}
}

// "Preço certo": the mordomo opens the guesses; everyone going guesses the price per person (secretly); the
// mordomo closes the guesses, types the bill and reveals it. The closest guess without going over wins (ties: who
// guessed first). Only the mordomo sees it before it is opened.
export function PriceSection({ event, onChanged }: Props) {
  const { bill, status } = event.price;
  const [ceremony, setCeremony] = useState(false);

  // The reveal plays the ceremony once, whether it happens live or I open the event later.
  useEffect(() => {
    if (bill && !ceremonySeen(event.id)) {
      markCeremonySeen(event.id);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- once, when the reveal arrives
      setCeremony(true);
    }
  }, [bill, event.id]);

  if (status === "off" && !event.isMordomo) return null;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-white p-5 shadow-sm motion-safe:animate-[sheet-up_400ms_250ms_ease-out_both]">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-3xl">
          💶
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">Preço certo</h2>
            {status === "open" && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                <span className="size-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
                Apostas abertas
              </span>
            )}
            {status === "closed" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">🔒 Fechadas</span>
            )}
          </div>
          <p className="text-sm text-neutral-500">Quanto vai custar a cada um?</p>
        </div>
      </div>
      <Rules />
      {status === "off" ? (
        <OpenGame event={event} onChanged={onChanged} />
      ) : status === "revealed" ? (
        <Results event={event} onReplay={() => setCeremony(true)} />
      ) : (
        <Guessing event={event} onChanged={onChanged} />
      )}
      {/* On <body>: the section's animation would otherwise trap the full-screen overlay inside the card. */}
      {ceremony && bill && createPortal(<Ceremony event={event} onClose={() => setCeremony(false)} />, document.body)}
    </section>
  );
}

// The rules, always on show so everyone plays by the same ones.
const RULES: [string, React.ReactNode][] = [
  ["💶", <>Adivinha o preço <b>por pessoa</b>: a conta total a dividir pelo número de pessoas.</>],
  ["⏱️", <>Só contam os palpites feitos <b>antes de o mordomo fechar</b> as apostas.</>],
  ["🎯", <>Ganha quem acertar em cheio ou chegar <b>mais perto sem passar</b>.</>],
  ["🚫", <>Quem <b>passa</b> do preço certo não pode ganhar.</>],
  ["🤝", <>Empate? Ganha <b>quem apostou primeiro</b>.</>],
  ["😅", <>Se todos passarem, <b>ninguém ganha</b>.</>],
];

function Rules() {
  return (
    <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
      <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">📜 Regras</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {RULES.map(([icon, text], index) => (
          <li key={index} className="flex gap-2 text-sm leading-snug text-amber-950 [&_b]:font-semibold">
            <span aria-hidden="true" className="shrink-0">
              {icon}
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Runs a mordomo action and reloads the event, with an error message on failure.
function useAction(onChanged: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<{ ok: boolean }>, failed: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    const { ok } = await action();
    if (ok) await onChanged();
    else setError(failed);
    setBusy(false);
    return ok;
  }
  return { busy, error, run };
}

function ErrorText({ error }: { error: string | null }) {
  return error ? <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null;
}

// Not opened yet (the mordomo only sees this).
function OpenGame({ event, onChanged }: Props) {
  const { busy, error, run } = useAction(onChanged);
  return (
    <div className="mt-4">
      <p className="text-sm text-neutral-600">
        🎩 Só tu, o mordomo, abres o jogo. Quem vai aposta em segredo; depois fechas as apostas, metes o valor da conta e
        revelas.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => run(() => setEventPriceGame(event.id, true), "Não foi possível abrir.")}
        className={`${primary} mt-3 flex h-12 w-full items-center justify-center gap-2 text-base`}
      >
        {busy ? <Spinner className="size-5 border-white/30 border-t-white" /> : <span aria-hidden="true">🎯</span>}
        Abrir o Preço certo
      </button>
      <ErrorText error={error} />
    </div>
  );
}

// Open: I guess (or change it). Closed: my guess is kept, the mordomo types the bill.
function Guessing({ event, onChanged }: Props) {
  const { myGuess, canGuess, guessers, status } = event.price;
  const [editing, setEditing] = useState(myGuess === null);
  const [value, setValue] = useState(myGuess !== null ? String(myGuess).replace(".", ",") : "");
  const { busy, error, run } = useAction(onChanged);
  const [confirmClose, setConfirmClose] = useState(false);
  // Right after I close the guesses, the bill form takes the focus.
  const [justClosed, setJustClosed] = useState(false);
  const amount = parseEuros(value, 10000);
  const mordomoName = event.mordomo?.displayName ?? "o mordomo";

  async function submit(form: React.FormEvent) {
    form.preventDefault();
    if (amount === null) return;
    if (await run(() => guessEventPrice(event.id, amount), "Não foi possível guardar o palpite.")) setEditing(false);
  }

  async function close() {
    const ok = await run(() => setEventPriceGame(event.id, false), "Não foi possível fechar as apostas.");
    setConfirmClose(false);
    if (ok) setJustClosed(true);
  }

  return (
    <>
      {event.isMordomo && status === "closed" && <RevealForm event={event} onChanged={onChanged} focus={justClosed} />}
      <div className="mt-4">
        {myGuess !== null && (!editing || !canGuess) ? (
          <div className="flex items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3 ring-1 ring-orange-200">
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold tracking-wide text-orange-700 uppercase">O teu palpite 🤫</span>
              <span className="text-2xl font-black text-neutral-900">{formatEuros(myGuess)}</span>
              <span className="text-sm text-neutral-500"> por pessoa</span>
            </span>
            {canGuess && (
              <button type="button" onClick={() => setEditing(true)} className={`${secondary} shrink-0 bg-white`}>
                Mudar
              </button>
            )}
          </div>
        ) : status === "closed" ? (
          <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">Não apostaste a tempo.</p>
        ) : !canGuess ? (
          <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-500">Só quem vai ao evento pode dar palpite.</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-2">
            <label htmlFor="price-guess" className="text-sm font-semibold text-neutral-600">
              O teu palpite, por pessoa
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="price-guess"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  value={value}
                  onChange={(change) => setValue(change.target.value)}
                  className={`${input} pr-10`}
                />
                <span aria-hidden="true" className="absolute top-1/2 right-4 -translate-y-1/2 font-semibold text-neutral-400">
                  €
                </span>
              </div>
              <button type="submit" disabled={amount === null || busy} className={`${primary} flex h-12 items-center gap-2 px-5`}>
                {busy && <Spinner className="size-4 border-white/30 border-t-white" />}
                Apostar
              </button>
            </div>
            {myGuess !== null && (
              <p className="text-xs text-neutral-400">Mudar o palpite conta como novo: num empate, ganha quem apostou primeiro.</p>
            )}
          </form>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        {guessers.length > 0 && (
          <span className="flex -space-x-2">
            {guessers.slice(0, 6).map((person) => (
              <PersonAvatar key={person.id} person={person} className="size-8 text-xs ring-2 ring-white" />
            ))}
          </span>
        )}
        <span className="text-sm text-neutral-500">
          {guessers.length === 0
            ? "Ainda ninguém apostou."
            : `${guessers.length === 1 ? "1 palpite" : `${guessers.length} palpites`} · secretos até à revelação`}
        </span>
      </div>

      {event.isMordomo ? (
        status === "open" ? (
          <div className="mt-4 border-t border-neutral-100 pt-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmClose(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-neutral-900 text-base font-semibold text-white shadow transition active:scale-95 disabled:opacity-50"
            >
              <span aria-hidden="true">🔒</span>
              Fechar apostas
            </button>
            <p className="mt-2 text-center text-xs text-neutral-400">Depois de fechar, metes o valor da conta e revelas.</p>
          </div>
        ) : null
      ) : (
        <p className="mt-4 border-t border-neutral-100 pt-4 text-sm text-neutral-500">
          {status === "open"
            ? `🎩 As apostas estão abertas até ${mordomoName} as fechar.`
            : `🥁 Apostas fechadas. À espera que ${mordomoName} revele o preço certo…`}
        </p>
      )}
      <ErrorText error={error} />

      {confirmClose && (
        <Sheet label="Fechar apostas" onClose={() => !busy && setConfirmClose(false)}>
          <div className="flex flex-col items-center gap-2 pt-2 text-center">
            <span aria-hidden="true" className="flex size-20 items-center justify-center rounded-full bg-amber-100 text-4xl ring-4 ring-amber-50">
              🔒
            </span>
            <h2 className="mt-2 text-xl font-semibold">Fechar as apostas?</h2>
            <p className="text-sm text-neutral-500">
              {guessers.length === 0
                ? "Ainda ninguém apostou."
                : `${guessers.length === 1 ? "1 pessoa apostou" : `${guessers.length} pessoas apostaram`}.`}{" "}
              Depois de fechar já ninguém pode apostar, e metes o valor final da conta. Podes reabrir antes de revelar.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={close}
              className="flex h-12 items-center justify-center gap-2 rounded-full bg-neutral-900 font-semibold text-white shadow transition active:scale-95 disabled:opacity-50"
            >
              {busy && <Spinner className="size-5 border-white/30 border-t-white" />}
              Fechar e meter a conta
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirmClose(false)}
              className="h-12 rounded-full bg-neutral-100 font-semibold text-neutral-700 transition active:scale-95 disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

// Guesses closed: the mordomo types the bill's total and how many split it, checks it, then reveals (final).
function RevealForm({ event, onChanged, focus }: Props & { focus: boolean }) {
  const [total, setTotal] = useState("");
  const [people, setPeople] = useState(String(Math.max(event.going.length, 1)));
  const [checking, setChecking] = useState(false);
  const { busy, error, run } = useAction(onChanged);
  const totalValue = parseEuros(total, 1000000);
  const peopleValue = /^\d+$/.test(people) && Number(people) >= 1 && Number(people) <= 500 ? Number(people) : null;
  const ready = totalValue !== null && peopleValue !== null;
  const totalRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focus) return;
    totalRef.current?.focus({ preventScroll: true });
    totalRef.current?.closest("form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  function next(form: React.FormEvent) {
    form.preventDefault();
    if (ready) setChecking(true);
  }

  if (checking && ready) {
    return (
      <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-orange-50 p-4 ring-2 ring-orange-200">
        <p className="font-semibold">🎩 Pronto para revelar?</p>
        <div className="rounded-2xl bg-neutral-900 px-4 py-4 text-center text-white">
          <p className="text-xs font-semibold tracking-wide text-white/60 uppercase">Só tu vês isto</p>
          <p className="text-3xl font-black">{formatEuros(pricePerPerson(totalValue, peopleValue))}</p>
          <p className="text-sm text-white/60">
            {formatEuros(totalValue)} ÷ {peopleValue} {peopleValue === 1 ? "pessoa" : "pessoas"}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => run(() => revealEventBill(event.id, totalValue, peopleValue), "Não foi possível revelar a conta.")}
          className={`${primary} flex h-14 w-full items-center justify-center gap-2 text-lg motion-safe:animate-[badge-pop_350ms_ease-out_both]`}
        >
          {busy ? <Spinner className="size-5 border-white/30 border-t-white" /> : <span aria-hidden="true">🥁</span>}
          Revelar a todos
        </button>
        <button type="button" disabled={busy} onClick={() => setChecking(false)} className="text-sm font-semibold text-neutral-500">
          Corrigir valores
        </button>
        <ErrorText error={error} />
      </div>
    );
  }

  return (
    <form
      onSubmit={next}
      className="mt-4 flex scroll-mt-24 flex-col gap-3 rounded-2xl bg-orange-50 p-4 ring-2 ring-orange-200 motion-safe:animate-[sheet-up_300ms_ease-out_both]"
    >
      <p className="font-semibold">🎩 Qual foi a conta final?</p>
      <div className="flex gap-2">
        <label className="flex flex-[3] flex-col gap-1 text-xs font-semibold text-neutral-500">
          Total da conta
          <span className="relative">
            <input
              ref={totalRef}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              value={total}
              onChange={(change) => setTotal(change.target.value)}
              className={`${input} pr-10`}
            />
            <span aria-hidden="true" className="absolute top-1/2 right-4 -translate-y-1/2 text-base text-neutral-400">
              €
            </span>
          </span>
        </label>
        <label className="flex flex-[2] flex-col gap-1 text-xs font-semibold text-neutral-500">
          Pessoas
          <input
            inputMode="numeric"
            autoComplete="off"
            value={people}
            onChange={(change) => setPeople(change.target.value)}
            className={input}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={!ready}
        className="flex h-12 w-full items-center justify-center rounded-full bg-neutral-900 text-base font-semibold text-white shadow transition active:scale-95 disabled:opacity-50"
      >
        Continuar
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => run(() => setEventPriceGame(event.id, true), "Não foi possível reabrir.")}
        className="text-sm font-semibold text-neutral-500"
      >
        Reabrir apostas
      </button>
      <ErrorText error={error} />
    </form>
  );
}

function Results({ event, onReplay }: { event: GroupEvent; onReplay: () => void }) {
  const bill = event.price.bill!;
  const actual = pricePerPerson(bill.total, bill.people);
  const { winner, valid, above } = rankGuesses(event.price.guesses, bill.total, bill.people);

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 px-4 py-4 text-center">
        <p className="text-xs font-semibold tracking-wide text-orange-800 uppercase">O preço certo</p>
        <p className="text-4xl font-black text-neutral-900">{formatEuros(actual)}</p>
        <p className="text-sm text-orange-900/70">
          {formatEuros(bill.total)} ÷ {bill.people} {bill.people === 1 ? "pessoa" : "pessoas"}
        </p>
      </div>

      {winner ? (
        <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-2 ring-amber-300">
          <ProfileLink person={winner.person} className="relative shrink-0">
            <PersonAvatar person={winner.person} className="size-12 text-lg" />
            <span aria-hidden="true" className="absolute -top-3 -right-1 text-xl">
              👑
            </span>
          </ProfileLink>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{winner.person.displayName} ganhou!</span>
            <span className="text-sm text-neutral-500">
              Apostou {formatEuros(winner.amount)}
              {Math.round(winner.amount * 100) === Math.round(actual * 100) ? " — em cheio! 🎯" : ""}
            </span>
          </span>
        </div>
      ) : (
        <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-center text-sm font-semibold text-neutral-600">
          {event.price.guesses.length === 0 ? "Ninguém deu palpite. 🤷" : "Ninguém ganhou: todos passaram do preço 😅"}
        </p>
      )}

      {event.price.guesses.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {[...valid, ...above].map((guess, index) => {
            const over = index >= valid.length;
            const difference = guess.amount - actual;
            return (
              <li key={guess.person.id} className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${over ? "opacity-60" : ""}`}>
                <span className="w-5 text-center text-sm font-bold text-neutral-400">{over ? "✕" : index + 1}</span>
                <PersonAvatar person={guess.person} className="size-8 text-xs" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{guess.person.displayName}</span>
                <span className={`text-sm font-bold ${over ? "text-neutral-400 line-through" : ""}`}>{formatEuros(guess.amount)}</span>
                <span className={`w-16 text-right text-xs ${over ? "text-red-500" : "text-neutral-400"}`}>
                  {over ? `+${formatEuros(difference)}` : Math.abs(difference) < 0.005 ? "🎯" : `−${formatEuros(-difference)}`}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <button type="button" onClick={onReplay} className="self-center text-sm font-semibold text-accent">
        🎬 Ver a cerimónia outra vez
      </button>
    </div>
  );
}

const CONFETTI: [string, number, number, string][] = [
  ["🎉", 8, 0, "300deg"],
  ["💶", 20, 200, "-220deg"],
  ["✨", 32, 100, "420deg"],
  ["🎊", 46, 320, "-320deg"],
  ["👑", 58, 60, "200deg"],
  ["💶", 70, 260, "-380deg"],
  ["🎉", 82, 150, "360deg"],
  ["🥳", 92, 400, "-260deg"],
];

// Drumroll → the price counts up → the winner (or nobody), with confetti.
function Ceremony({ event, onClose }: { event: GroupEvent; onClose: () => void }) {
  const bill = event.price.bill!;
  const actual = pricePerPerson(bill.total, bill.people);
  const { winner } = rankGuesses(event.price.guesses, bill.total, bill.people);
  // Reduced motion goes straight to the result. (Only rendered on the client, after the reveal.)
  const [phase, setPhase] = useState<"drum" | "count" | "winner">(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "winner" : "drum",
  );
  const [shown, setShown] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (phase !== "drum") return;
    let frame = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        setPhase("count");
        const start = performance.now();
        const step = (now: number) => {
          const t = Math.min((now - start) / 1600, 1);
          setShown(actual * (1 - (1 - t) ** 3));
          if (t < 1) frame = requestAnimationFrame(step);
          else timers.push(setTimeout(() => setPhase("winner"), 500));
        };
        frame = requestAnimationFrame(step);
      }, 1600),
    );
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
    // Runs once: the phases move on from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual]);

  useEffect(() => {
    if (phase === "winner") closeRef.current?.focus();
  }, [phase]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Preço certo: a revelação"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-neutral-950/80 px-6 backdrop-blur-sm motion-safe:animate-[fade-in_200ms_ease-out]"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-gradient-to-b from-amber-200 via-orange-200 to-rose-200 px-6 pt-8 pb-6 text-center shadow-2xl motion-safe:animate-[badge-pop_450ms_ease-out_both]">
        {phase === "winner" && winner && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            {CONFETTI.map(([emoji, left, delay, spin], index) => (
              <span
                key={index}
                className="absolute -top-6 text-2xl opacity-0 motion-safe:animate-[confetti-fall_2400ms_ease-in_both]"
                style={{ left: `${left}%`, animationDelay: `${delay}ms`, ["--spin" as string]: spin }}
              >
                {emoji}
              </span>
            ))}
          </div>
        )}

        <p className="relative text-xs font-bold tracking-[0.25em] text-orange-900/70 uppercase">Preço certo</p>

        {phase === "drum" ? (
          <div role="status" className="relative py-6">
            <span aria-hidden="true" className="inline-block text-7xl motion-safe:animate-[drum-roll_180ms_linear_infinite]">
              🥁
            </span>
            <p className="mt-4 font-serif text-2xl font-black text-orange-950 italic">E o preço certo é…</p>
          </div>
        ) : (
          <div role="status" aria-live="polite" className="relative">
            <p className="mt-3 text-sm font-semibold text-orange-900/70">por pessoa</p>
            <p
              className={`text-6xl font-black tracking-tight text-neutral-900 tabular-nums ${
                phase === "winner" ? "motion-safe:animate-[badge-pop_400ms_ease-out_both]" : ""
              }`}
            >
              {formatEuros(phase === "winner" ? actual : shown)}
            </p>
            <p className="mt-1 text-sm text-orange-900/70">
              {formatEuros(bill.total)} ÷ {bill.people}
            </p>

            {phase === "winner" && (
              <div className="mt-6 flex flex-col items-center gap-2">
                {winner ? (
                  <>
                    <span className="relative motion-safe:animate-[badge-pop_500ms_200ms_ease-out_both]">
                      <PersonAvatar person={winner.person} className="size-20 text-3xl ring-4 ring-white shadow-lg" />
                      <span aria-hidden="true" className="absolute -top-6 left-1/2 -translate-x-1/2 text-4xl">
                        👑
                      </span>
                    </span>
                    <p className="text-2xl font-black text-orange-950 motion-safe:animate-[sheet-up_400ms_400ms_ease-out_both]">
                      {winner.person.displayName} ganhou!
                    </p>
                    <p className="text-sm text-orange-900/80 motion-safe:animate-[fade-in_400ms_600ms_ease-out_both]">
                      Apostou {formatEuros(winner.amount)}
                      {Math.round(winner.amount * 100) === Math.round(actual * 100) ? " — em cheio! 🎯" : ""}
                    </p>
                  </>
                ) : (
                  <>
                    <span aria-hidden="true" className="text-6xl motion-safe:animate-[badge-pop_500ms_200ms_ease-out_both]">
                      {event.price.guesses.length === 0 ? "🤷" : "😅"}
                    </span>
                    <p className="text-xl font-black text-orange-950">
                      {event.price.guesses.length === 0 ? "Ninguém deu palpite" : "Ninguém ganhou!"}
                    </p>
                    {event.price.guesses.length > 0 && <p className="text-sm text-orange-900/80">Todos passaram do preço.</p>}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className={`relative mt-6 h-11 w-full rounded-full text-sm font-semibold transition ${
            phase === "winner" ? "bg-neutral-900 text-white shadow" : "text-orange-900/60"
          }`}
        >
          {phase === "winner" ? "Ver resultados" : "Saltar"}
        </button>
      </div>
    </div>
  );
}
