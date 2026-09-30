import { Spinner } from "./spinner";

// Full-screen white splash (AC-3). Shown by app/(home)/loading.tsx and by HomeMap until the map is ready.
export function Splash() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white text-foreground"
    >
      <p className="text-3xl font-semibold">Mordomia</p>
      <Spinner />
      <p>Finding your location…</p>
    </div>
  );
}
