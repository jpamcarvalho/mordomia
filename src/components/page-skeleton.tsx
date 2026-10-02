// Placeholder shown the moment a link is tapped, while the server builds the page (loading.tsx files).
// Shapes roughly follow the real screens so the swap feels like the page filling in, not jumping.

type Variant = "profile" | "list" | "feed";

const bone = "rounded-full bg-neutral-200/80";

export function PageSkeleton({ variant }: { variant: Variant }) {
  if (variant === "feed") {
    return (
      <main aria-busy="true" className="min-h-dvh bg-neutral-50">
        <span className="sr-only">A carregar…</span>
        <div className="bg-white px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-3 shadow-sm">
          <div className="mx-auto max-w-md animate-pulse">
            <div className={`h-7 w-44 ${bone}`} />
          </div>
        </div>
        <div className="mx-auto flex max-w-md animate-pulse flex-col gap-3 px-4 pt-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm">
              <div className="size-12 shrink-0 rounded-full bg-neutral-200/80" />
              <div className="flex flex-1 flex-col gap-2">
                <div className={`h-4 w-2/3 ${bone}`} />
                <div className={`h-3 w-1/3 ${bone}`} />
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main
      aria-busy="true"
      className="min-h-dvh bg-gradient-to-b from-orange-100 via-orange-50/40 to-white pb-[calc(env(safe-area-inset-bottom)+6rem)]"
    >
      <span className="sr-only">A carregar…</span>
      <div className="mx-auto flex max-w-md animate-pulse flex-col gap-5 px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="h-9 w-24 rounded-full bg-white/80" />
        {variant === "profile" ? (
          <>
            <div className="flex flex-col items-center gap-3">
              <div className="size-28 rounded-full bg-neutral-200/80 ring-4 ring-white" />
              <div className={`h-6 w-40 ${bone}`} />
              <div className={`h-4 w-24 ${bone}`} />
              <div className="h-8 w-28 rounded-full bg-white/80" />
            </div>
            <div className="h-24 rounded-3xl bg-white shadow-sm" />
            <div className="h-56 rounded-3xl bg-white shadow-sm" />
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <div className="size-10 rounded-full bg-neutral-200/80" />
              <div className={`h-7 w-48 ${bone}`} />
              <div className={`h-4 w-32 ${bone}`} />
            </div>
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm">
                  <div className="size-14 shrink-0 rounded-full bg-neutral-200/80" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className={`h-4 w-1/2 ${bone}`} />
                    <div className={`h-3 w-1/3 ${bone}`} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
