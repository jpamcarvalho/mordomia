import Link from "next/link";

// What a shared event link shows to someone who is not a member of the group (or when there is no such event).
export function PrivateEvent() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
      <span aria-hidden="true" className="text-5xl">
        🔒
      </span>
      <h1 className="text-2xl font-bold">Este evento é privado</h1>
      <p className="text-neutral-500">Só os membros do grupo o podem ver.</p>
      <Link href="/social" className="mt-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-white">
        Ir para o Mordomia Social
      </Link>
    </main>
  );
}
