// Full-screen splash (AC-3). Shown by app/(home)/loading.tsx and by HomeMap until the map is ready.
// A pin hops over its shadow while a location ping ripples out. Pure CSS, transform/opacity only, so it runs on the
// compositor and never competes with the map loading.
export function Splash() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-orange-100 via-orange-50 to-white text-foreground"
    >
      <div aria-hidden="true" className="relative flex h-36 w-32 items-end justify-center">
        {/* Location ping on the ground, two rings out of step. */}
        <span className="absolute bottom-1 h-8 w-20 rounded-[50%] border-2 border-accent/40 motion-safe:animate-[splash-ping_2s_ease-out_infinite]" />
        <span className="absolute bottom-1 h-8 w-20 rounded-[50%] border-2 border-accent/40 motion-safe:animate-[splash-ping_2s_ease-out_1s_infinite]" />
        {/* Shadow shrinks as the pin goes up. */}
        <span className="absolute bottom-3 h-2.5 w-10 rounded-[50%] bg-orange-900/15 motion-safe:animate-[splash-shadow_1.4s_ease-in-out_infinite]" />
        <PinMark className="relative mb-4 h-20 w-16 drop-shadow-md motion-safe:animate-[splash-hop_1.4s_ease-in-out_infinite]" />
      </div>

      <p className="mt-4 text-3xl font-bold tracking-tight motion-safe:animate-[sheet-up_500ms_ease-out_both]">
        Mordomia
      </p>
      <p className="mt-1 flex items-center gap-1 text-sm text-neutral-500 motion-safe:animate-[fade-in_600ms_200ms_ease-out_both]">
        A encontrar a tua localização
        <span aria-hidden="true" className="flex gap-0.5 pt-1.5">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              style={{ animationDelay: `${dot * 160}ms` }}
              className="size-1 rounded-full bg-neutral-400 motion-safe:animate-[splash-dot_1.2s_ease-in-out_infinite]"
            />
          ))}
        </span>
      </p>
    </div>
  );
}

// The brand mark: an orange map pin with a knife and fork. Size via className.
export function PinMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 64" className={className}>
      <path d="M24 2C12.4 2 3 11.2 3 22.6 3 38 24 62 24 62s21-24 21-39.4C45 11.2 35.6 2 24 2Z" className="fill-accent" />
      <circle cx="24" cy="22.5" r="12" fill="white" />
      {/* Fork and knife. */}
      <path
        d="M20 15.5v6.5a2 2 0 0 0 2 2v6M18 15.5v4.5M22 15.5v4.5M28.5 30V15.5c-2 1-3 3.2-3 5.5v3h3"
        fill="none"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-accent"
      />
    </svg>
  );
}
