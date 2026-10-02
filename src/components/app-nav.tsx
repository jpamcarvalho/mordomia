"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { NavData } from "@/app/social/actions";
import { MagnifierIcon } from "@/components/home/search-modal";
import { avatarInitial } from "@/lib/profile/avatar";
import { badgeText, countNew, readFeedSeen, subscribeNothing } from "@/lib/social/seen";

type NavTab = "procurar" | "grupos" | "feed";
const NAV_EVENT = "mordomia:nav";

// Asks the bar to reload its badges (e.g. after accepting a friend request without leaving the page).
export function refreshNav() {
  window.dispatchEvent(new Event(NAV_EVENT));
}

// Screens without the bar: the map has its own floating buttons; sign-in comes before the app.
function hiddenOn(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/auth");
}

function tabHref(tab: NavTab): string {
  return tab === "feed" ? "/social" : `/social?tab=${tab}`;
}

// Kept between mounts so the bar shows the avatar and badges straight away after the first load.
let cached: NavData | null = null;
let loadedAt = 0;

// Badges are refreshed after the new screen has settled, and at most this often when just moving between screens.
const SETTLE_MS = 400;
const FRESH_MS = 15_000;

async function fetchNavData(): Promise<NavData | null> {
  const response = await fetch("/api/nav", { cache: "no-store" });
  return response.ok ? ((await response.json()) as NavData) : null;
}

// The app's bottom bar (Mapa, Procurar, Grupos, Feed, Perfil), on every screen except the map.
export function AppNav() {
  const pathname = usePathname();
  const search = useSearchParams();
  const tabParam = search.get("tab");
  const [data, setData] = useState<NavData | null>(cached);
  const seen = useSyncExternalStore(subscribeNothing, readFeedSeen, () => null);
  const hidden = hiddenOn(pathname);

  // Fresh badges after a screen change (unless just loaded), when a page asks for it, and when the app comes back
  // to the foreground. Deferred so the new screen gets the network first.
  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    const load = () =>
      void fetchNavData()
        .then((next) => {
          if (cancelled || !next) return;
          cached = next;
          loadedAt = Date.now();
          setData(next);
        })
        .catch(() => {});
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = Date.now() - loadedAt > FRESH_MS ? window.setTimeout(load, cached ? SETTLE_MS : 0) : undefined;
    window.addEventListener(NAV_EVENT, load);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener(NAV_EVENT, load);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [hidden, pathname, tabParam]);

  if (hidden) return null;

  const active: NavTab | "perfil" | null =
    pathname === "/social"
      ? tabParam === "procurar" || tabParam === "grupos"
        ? tabParam
        : "feed"
      : pathname.startsWith("/social/grupos")
        ? "grupos"
        : pathname === "/account"
          ? "perfil"
          : null;

  const tabs: { id: NavTab; label: string; icon: React.ReactNode; badge: number }[] = [
    { id: "procurar", label: "Procurar", icon: <MagnifierIcon className="size-6" />, badge: data?.requests ?? 0 },
    { id: "grupos", label: "Grupos", icon: <GroupIcon />, badge: data?.invites ?? 0 },
    // No feed badge while on the Feed: it is being read.
    { id: "feed", label: "Feed", icon: <FeedIcon />, badge: active === "feed" ? 0 : countNew(data?.feedTimes ?? [], seen) },
  ];
  const item = "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold";

  return (
    <nav
      aria-label="Navegação"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-md">
        <Link href="/" className={`${item} text-neutral-500`}>
          <MapIcon />
          Mapa
        </Link>
        {tabs.map(({ id, label, icon, badge }) => (
          <Link
            key={id}
            href={tabHref(id)}
            aria-current={active === id ? "page" : undefined}
            onClick={(event) => {
              // Already on Mordomia Social: switch tab in place (the page keeps its data), like before.
              if (pathname !== "/social") return;
              event.preventDefault();
              window.history.replaceState(null, "", tabHref(id));
            }}
            className={`${item} ${active === id ? "text-accent" : "text-neutral-500"}`}
          >
            {icon}
            {label}
            {badge > 0 && (
              <span className="absolute top-1 left-1/2 ml-2 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white ring-2 ring-white motion-safe:animate-[badge-pop_350ms_ease-out_both]">
                {badgeText(badge)}
              </span>
            )}
          </Link>
        ))}
        <Link
          href="/account"
          aria-current={active === "perfil" ? "page" : undefined}
          className={`${item} ${active === "perfil" ? "text-accent" : "text-neutral-500"}`}
        >
          <span
            className={`flex size-6 items-center justify-center overflow-hidden rounded-full bg-accent text-xs font-semibold text-white ${
              active === "perfil" ? "ring-2 ring-accent ring-offset-1" : ""
            }`}
          >
            {data?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
              <img src={data.avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              avatarInitial(data?.username ?? null)
            )}
          </span>
          Perfil
        </Link>
      </div>
    </nav>
  );
}

function MapIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <circle cx="12" cy="8" r="3" />
      <path d="M6.5 20a5.5 5.5 0 0 1 11 0" />
      <circle cx="5" cy="10" r="2.2" />
      <path d="M1.5 18a3.5 3.5 0 0 1 4.2-3.4" />
      <circle cx="19" cy="10" r="2.2" />
      <path d="M22.5 18a3.5 3.5 0 0 0-4.2-3.4" />
    </svg>
  );
}

function FeedIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6">
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M7.5 8.5h9M7.5 12h9M7.5 15.5h5" />
    </svg>
  );
}
