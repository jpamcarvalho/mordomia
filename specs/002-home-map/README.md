# 002 · Home map, light theme, login polish

> Explanation of the feature **as built**. Written by the architect after the feature was closed (2026-09-30).
> Agents: read this before changing anything this feature touches.
>
> **Review status:** review round 1 = **PASS** with findings. Its fixes (Tasks 8–9) were **not re-reviewed**: the user
> closed 002 without a round-2 review (Decision #32); Tasks 8–9 are verified only by the implementer's
> `npm run check`. See "Known limitations / follow-ups".
>
> **Upcoming:** feature **003** will replace Google Maps with **MapLibre + OpenFreeMap** tiles (no API key). Everything
> below describes 002 as it is today (Google Maps).

## What it does
- **Always light.** Every page is white with dark text, whatever the device theme; there is no dark mode. Primary
  buttons, the active login tab and spinners use a terracotta accent (`#c2410c`).
- **Home (`/`, signed-in) is a full-screen map.** On open (and right after signing in) a white splash shows
  "Mordomia", a spinner and "Finding your location…". The app asks for the browser location once:
  - located → map centered on the user at zoom 15 with a blue "you are here" dot;
  - denied / unavailable / no answer within 10 s → map on Porto at zoom 13 with a dismissible notice
    "Location is off — showing Porto. Enable location to see what's near you." (reappears on every visit);
  - if the location arrives after the 10 s fallback (e.g. the permission prompt was answered late), the map moves to
    it at zoom 15, the dot appears and the notice disappears.
  - A floating **Recenter map** button takes a fresh reading and moves map + dot there. If it fails, the map returns
    to the last known position (dot kept) or to Porto if there never was one, and the notice shows again.
  - No top bar, no Google controls (gestures only), no restaurant markers. A round avatar button (user's initial,
    top-right) opens a menu with `@username` and "Sign out".
  - If the map cannot load (missing key / Map ID, invalid key, network) → "We couldn't load the map." + "Try again"
    (reloads the page); the avatar menu still works.
- **Login (`/login`)** has a tagline, "Sign in" / "Sign up" tabs, visible field labels and a Show/Hide password
  toggle. Sign-in / sign-up behavior and messages are unchanged.

No database changes: no migration, no RLS change, no new server action or route handler.

## How it works
1. **Theme.** `globals.css` has no dark media query; `@theme inline` defines `--color-accent: #c2410c` (utilities
   `bg-accent`, `text-accent`, `border-accent`, `border-t-accent`). The root `viewport` sets
   `colorScheme: "only light"` and `themeColor: "#ffffff"`; the manifest `theme_color` is `#ffffff`. A Vitest guard
   (`src/app/theme.test.ts`) fails if any `dark:` variant or dark media query appears under `src/`.
2. **Route.** The home lives in the route group `src/app/(home)/` so its `loading.tsx` (the `Splash`) is the Suspense
   fallback for `/` only; `/login` and future routes never show the splash (Decision #30).
3. **Server.** `src/app/(home)/page.tsx` (Server Component): `getClaims()`, reads the caller's own
   `profiles.username`, computes `getMapsConfig(process.env)` (returns `null` unless both
   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` are non-blank) and renders
   `<HomeMap username config />`.
4. **Client orchestrator** `HomeMap`:
   - On mount (once, guarded by a `useRef` against StrictMode's double effect) calls
     `requestLocation(navigator.geolocation, { onLateSuccess })`: one `getCurrentPosition` with
     `{ enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }`, never `watchPosition`. An own 10 s timer
     resolves `{ ok: false, reason: "timeout" }` even while the permission prompt is unanswered (the browser timeout only
     starts after permission is granted; Decision #29). A success after that goes to `onLateSuccess`, which applies it
     like a successful recenter (AC-18); a late failure is ignored. Result → `resolveInitialView` → center/zoom/dot/notice.
   - If `config` is `null` the map status starts as `failed` and `APIProvider` is never rendered (no request to
     Google). Otherwise `APIProvider` (`libraries={["marker"]}`, `onError` → failed) loads in parallel with the
     location reading, and `window.gm_authFailure` is set to "failed" (Google's global callback for key errors;
     `@vis.gl/react-google-maps` 1.10 never sets `AUTH_FAILURE` itself), removed on unmount.
   - `MapView` mounts once the location has settled; its first `tilesloaded` sets status `ready`.
   - `homePhase(locationSettled, mapStatus)` → `splash` until the location settled **and** the map is ready or
     failed; then `map` (map, dot, recenter, notice, avatar) or `error` (message, "Try again", avatar only).
   - Recenter: `requestLocation` again (same 10 s cap, no late-success handler) → `resolveRecenter(prev, result)`
     (Decision #25) → new state + a `Camera`, which `MapView` applies with `map.panTo` + `map.setZoom`. On failure
     the notice's dismissal is reset so it shows again.
5. **Map.** `<Map mapId colorScheme={LIGHT} defaultCenter defaultZoom disableDefaultUI gestureHandling="greedy"
   clickableIcons={false} onTilesLoaded>`; the only child is the user dot (`AdvancedMarker`, HTML dot, centered
   anchor, not clickable). The clean style (AC-9) is a **cloud map style** attached to the Map ID in Google Cloud,
   not code (Decision #23).
6. **Privacy.** The location never leaves the browser (only the Google Maps JS API in the page receives it). The only
   data read is the caller's own username, under the existing `profiles` read policy.

## Key files
| File | Role |
|---|---|
| `src/app/globals.css` | Light-only colors, `--color-accent` token |
| `src/app/layout.tsx` | Root `viewport`: `colorScheme: "only light"`, `themeColor: "#ffffff"` |
| `src/app/manifest.ts` | `theme_color: "#ffffff"` |
| `src/app/theme.test.ts` | Vitest guard: no `dark:` / dark media query in `src/`; viewport is only light |
| `src/app/(home)/page.tsx` | Home Server Component: auth, own username, maps config → `HomeMap` |
| `src/app/(home)/loading.tsx` | Splash as the `/` loading fallback |
| `src/components/spinner.tsx`, `src/components/splash.tsx` | Shared accent spinner and full-screen splash |
| `src/components/home/home-map.tsx` | Client orchestrator: location, map status, phase, notice, recenter, error |
| `src/components/home/map-view.tsx` | Google `<Map>` + user dot + recenter button; applies camera moves via `useMap()` |
| `src/components/home/user-dot.tsx` | Blue dot (`AdvancedMarker`, `data-testid="user-dot"`) |
| `src/components/home/recenter-button.tsx` | "Recenter map" floating button (disabled / `aria-busy` while reading) |
| `src/components/home/location-notice.tsx` | Porto fallback notice with "Dismiss" ✕ |
| `src/components/home/map-error.tsx` | "We couldn't load the map." + "Try again" (`window.location.reload()`) |
| `src/components/home/avatar-menu.tsx` | "Account menu" button + menu (`@username`, "Sign out" via `logout` action) |
| `src/lib/map/config.ts` | `PORTO`, zooms, `GEOLOCATION_OPTIONS`, `MapsConfig`, `getMapsConfig(env)` |
| `src/lib/map/location.ts` | `requestLocation` (10 s cap + late success), `resolveInitialView`, `resolveRecenter` |
| `src/lib/map/phase.ts` | `homePhase` (splash / map / error) |
| `src/lib/profile/avatar.ts` | `avatarInitial(username)` |
| `src/app/login/page.tsx` | Tagline, tabs, labels, password toggle, accent submit |
| `tests/e2e/helpers/auth.ts` | Shared `signIn(page, user)` using the labels (`exact: true`) |
| `.env.example` | Adds `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` |

## Rules & invariants
- No dark mode anywhere: no `dark:` variant and no `prefers-color-scheme: dark` under `src/` (enforced by
  `theme.test.ts`). Use the `accent` token for the accent color, never a hard-coded hex or Tailwind `orange-700`
  (v4's `orange-700` is not `#c2410c`).
- The user's location is never sent to a Mordomia server action, route handler or table.
- Exactly one `getCurrentPosition` per home load (plus one per recenter tap); never `watchPosition`.
- The home map shows no restaurant markers yet; the only marker is the user dot.
- Both Maps env vars are required; either missing → error state, and no request is made to Google.
- The splash belongs to `/` only (route group `(home)`); do not put a `loading.tsx` at the app root.

## Key decisions
(Numbers refer to the Decisions log in `requirements.md`.)
- #1, #18: always light; terracotta accent `#c2410c` as a theme token.
- #3, #12, #13: Porto fallback, zoom 15 located / 13 fallback, 10 s location timeout.
- #6, #7: single reading, no live tracking; recenter takes a fresh reading.
- #9, #10, #24: no top bar (avatar menu), no Google controls, Google's own place icons not clickable.
- #23: clean style via a cloud Map ID (`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`), since JSON `styles` cannot keep restaurants
  while hiding other businesses; no `DEMO_MAP_ID` fallback.
- #25: recenter failure keeps the last fix (or Porto if none) and shows the notice.
- #26: accessible names "Account menu", "Recenter map", "Dismiss", "Show password" / "Hide password".
- #27: the user asked for no new tests from Task 4 on; Task 5 (home/theme e2e) was dropped.
- #29 (AC-18): overall 10 s cap from the request, late success moves the map. #30: splash on `/` only.
- #31: review finding 1 (Playwright env) not fixed. #32: closed without round-2 review; Google Maps to be replaced
  by MapLibre + OpenFreeMap in 003.

## Tests
- **Vitest** (`npm test`; whole suite 71 tests at close):
  - `src/app/theme.test.ts` — AC-1 guard.
  - `src/lib/map/config.test.ts` — constants, `getMapsConfig` (AC-11).
  - `src/lib/map/location.test.ts` — `requestLocation` single call/options/error mapping (AC-4),
    `resolveInitialView` (AC-5, AC-6), `resolveRecenter` (AC-7).
  - `src/lib/map/phase.test.ts` — `homePhase` (AC-3).
  - `src/lib/profile/avatar.test.ts` — `avatarInitial` (AC-10).
  - `src/components/home/home-map.test.tsx` — mocks `@vis.gl/react-google-maps` and `Geolocation`; covers AC-3, AC-4
    (once under StrictMode), AC-5, AC-6, AC-7, AC-8, AC-9 (props), AC-10, AC-11 (`config` null, `onError`,
    `gm_authFailure`), AC-12.
- **Playwright** (`npm run test:e2e`; whole suite 11 tests at close):
  - `tests/e2e/login.spec.ts` — AC-2 (accent on submit + active tab), AC-13, AC-14, AC-15, AC-16.
  - `tests/e2e/auth.spec.ts` (rewritten to the new selectors) — AC-17 (000 tests still pass); sign in → avatar menu
    shows `@username` → sign out → `/login`.
  - `tests/e2e/places.spec.ts` — uses the shared `signIn` helper.
- **pgTAP:** unchanged (51 tests at close; 002 has no DB changes).
- Last full run: `npm run check` passed after Tasks 8–9 (lint, typecheck, Vitest 71, pgTAP 51, Playwright 11, build).

## Known limitations / follow-ups
- **Not re-reviewed:** Tasks 8 (10 s cap + late success, AC-18) and 9 (`(home)` route group) were never reviewed
  (Decision #32).
- **No automated test for AC-18 or the 10 s cap**: `location.test.ts` / `home-map.test.tsx` were not extended for
  the overall timer or `onLateSuccess` (Decision #27: no new tests), and nothing tests that `/login` shows no splash.
- **Task 5 dropped** (Decision #27): no e2e for AC-1 (dark-emulated page is white), AC-2 on the home spinner, AC-3
  splash, AC-4 single reading in a real browser, AC-10 "no top bar", AC-11 error in a real browser. These rely on the
  Vitest tests above.
- **Task 7 never done:** no manual check with a real Google key + Map ID. AC-5…AC-9 and AC-12 were never seen on a
  real Google map; the AC-9 cloud style (POIs off except Food and drink, Transit off) was never created/verified.
- **Review finding 1 not fixed** (Decision #31): Next's dev server loads `.env.local` itself, so once a real
  `.env.local` with Maps vars exists, the Playwright server (port 3100, `playwright.config.ts` does not override the
  Maps vars) and the sign-in test in `auth.spec.ts` (which does not block Google) would load the real Google map
  and spend quota / depend on network.
- **Recenter reading**: a success that arrives after its 10 s cap is ignored (only the initial reading has a
  late-success handler).
- **`tilesloaded` never firing** after the script loads would keep the splash up (no extra timeout; accepted in design).
- **Style outside the repo:** the AC-9 style lives in Google Cloud; editing it changes the app silently.
- **Upcoming 003:** replace Google Maps (`@vis.gl/react-google-maps`, Map ID, both Maps env vars) with MapLibre +
  OpenFreeMap tiles (no key). Most of the above Google-specific gaps (Task 7, cloud style, finding 1) are expected to
  be superseded by that feature's spec.
- **Google Cloud setup (only while 002's Google map is in use):**
  1. APIs & Services: enable *Maps JavaScript API*; create a browser key restricted to HTTP referrers
     (`http://localhost:3000/*`, the Vercel domain) and to the Maps JavaScript API → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
  2. Map Management → Create Map ID (type *JavaScript*, *Vector*) → `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`.
  3. Map Styles → create a light style from the default, associate it with the Map ID; Points of interest visibility
     **off** for every category except *Food and drink*; Transit **off**; publish.
  4. Put both values in `.env.local` and in the Vercel project env vars.
