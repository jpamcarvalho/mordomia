# 002 · Home map, light theme, login polish — Design

> Written by: architect · Based on: requirements.md (approved 2026-09-30) · Approved by user on: YYYY-MM-DD
> Architect open questions answered by the user: requirements Decisions log #23 (cloud Map ID), #24 (Google place
> icons not clickable), #25 (recenter failure), #26 (accessible names).

## Overview
UI-only feature. No migration, no RLS change, no new server action or route handler.

1. **Always light (AC-1, AC-2):** delete the `prefers-color-scheme: dark` block from `src/app/globals.css` and every
   `dark:` variant in `src/**`; declare `color-scheme: only light` through the root `viewport` export so browsers
   (incl. Chrome Android auto-dark) never darken the page; add one Tailwind theme token `--color-accent: #c2410c`
   used for primary buttons, the active tab and spinners.
2. **Home `/` (AC-3…AC-12):** `src/app/page.tsx` stays a Server Component (session + own `username`, as today) and
   renders one Client Component, `HomeMap`, that owns: a single geolocation reading, the Google map
   (`@vis.gl/react-google-maps`), the blue dot, the fallback notice, the recenter button, the map-error state and
   the floating avatar menu. A shared `Splash` is shown by `src/app/loading.tsx` while the server renders `/`, and by
   `HomeMap` until the location has settled **and** the map has either rendered its first tiles or failed, so the
   user sees one continuous splash from sign-in (or app open) to the ready map.
3. **Login `/login` (AC-13…AC-17):** same client component and same server actions; adds the tagline, visible
   labels, a two-tab mode switch and a password show/hide toggle. `login` / `signup` / `logout` are not modified.

All decision logic (geolocation result → center/zoom/dot/notice, splash/map/error phase, env → maps config, avatar
initial) is pure TypeScript in `src/lib/**` with colocated Vitest tests (architecture §4, §10).

Relies on: architecture §3 (folders), §4 (server-first, `"use client"` only for interactivity, Tailwind, secrets),
§7 (auth flow; `logout` server action), §9 (env vars), §10 (test layers and patterns).

## Data model
None. No new tables, columns or migrations.

## Row-level security
None added or changed. The home page reads only the caller's own `profiles.username`
(`.eq("id", claims.sub)`), allowed by the existing `profiles` read policy ("any signed-in user"). The user's location
never leaves the browser: it is passed only to the Google Maps JS API running in the page and is never sent to a
Mordomia server action, route handler or table (requirements → Privacy).

## Server
No new server actions or route handlers.

- `src/app/page.tsx` (Server Component, dynamic because it reads cookies): unchanged auth pattern
  (`await createClient()`, `getClaims()`, select own `username`). New: reads the maps config on the server with
  `getMapsConfig(process.env)` and passes it to `HomeMap` as a prop (so the component is testable with plain props and
  the "missing key" state is decided in one place). Both values are browser-safe `NEXT_PUBLIC_*` values.
- `logout` (`src/app/login/actions.ts`) is reused unchanged by the avatar menu (`<form action={logout}>`).
- `login` / `signup` unchanged (AC-17). Note: feature 001 Task 4 also edits `signup` and the password input's
  `minLength`; 002 must keep whatever `minLength` value/import is present when it is implemented.

### Environment variables
| Var | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | browser (existing, §9) | Maps JavaScript API only, HTTP-referrer restricted. Not set locally yet → AC-11 error state. |
| `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` | browser (new, Decision #23) | Cloud Map ID whose cloud style implements AC-9. Missing/blank → same AC-11 error state as a missing key (no `DEMO_MAP_ID` fallback). Added to `.env.example` with a setup comment. |

`.env.test.example` gets a comment that neither Maps variable is needed: e2e tests block Google Maps (see Test plan) and the Playwright `webServer.env` does not pass them.

## Map rendering choice (Decision #23: cloud Map ID)
Google offers two mutually exclusive ways to style a JS map: a **cloud Map ID** (style configured in the Google
Cloud console; required for `AdvancedMarker`) or a client-side **`styles` JSON array** (ignored whenever a `mapId`
is set; only works on raster maps; `AdvancedMarker` unavailable, so a custom dot needs the deprecated
`google.maps.Marker` or a hand-written `OverlayView`).

AC-9 asks to hide **non-restaurant** POIs. The JSON `styles` feature types only have `poi.business` for *all*
businesses (shops and restaurants alike) and no restaurant sub-type, so JSON can hide shops only by also hiding
restaurants. Cloud-based map styling has per-category POI controls (e.g. keep "Food and drink", hide "Retail",
"Transit", "Lodging", …), so it is the only option that meets AC-9 as written. It is also required later for our own
restaurant markers (`AdvancedMarker`; the legacy `Marker` is deprecated).

**Chosen: cloud Map ID** (Decision #23).
- Map: `<Map mapId={config.mapId} colorScheme={ColorScheme.LIGHT} …>`; no `styles` prop.
- Blue dot (AC-5): `<AdvancedMarker position={userPosition}>` with a small HTML dot (16 px blue circle, 2 px white
  ring, shadow), anchored at its center (`anchorLeft="-50%"`, `anchorTop="-50%"`), `clickable={false}`.
- AC-9 style is configured once in the Google Cloud console by the user (not in the repo). Setup (listed in tasks.md →
  "User setup" and written into the 002 README at Mode B):
  1. Maps Management → Create Map ID: type *JavaScript*, *Vector*.
  2. Map Styles → Create style (light, based on the default Google style), associate it with that Map ID.
  3. In the style, Points of interest: set visibility **off** for every category except *Food and drink*
     (restaurants, cafés, bars, bakeries — the same types the 000 Places proxy uses); Transit (stations, lines):
     **off**. Save and publish.
  4. Put the Map ID in `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (and in Vercel).

## UI

### Theme (AC-1, AC-2)
| File | Change |
|---|---|
| `src/app/globals.css` | Remove the `@media (prefers-color-scheme: dark)` block. In `@theme inline` add `--color-accent: #c2410c;` (gives `bg-accent`, `text-accent`, `border-accent`, `border-t-accent` utilities). Keep `--background: #ffffff`, `--foreground: #171717`. |
| `src/app/layout.tsx` | `viewport` gains `colorScheme: "only light"` and `themeColor: "#ffffff"`. |
| `src/app/manifest.ts` | `theme_color: "#ffffff"` (was `#000000`) so the installed PWA's status bar matches the white app. |
| `src/app/login/page.tsx` | Remove `dark:bg-white dark:text-black` (the only `dark:` variant in `src/`). |

The accent is the literal `#c2410c` requested in AC-2, not Tailwind v4's `orange-700` utility: in the installed
Tailwind v4 `orange-700` is `oklch(55.3% 0.195 38.402)` (≈ `#ca3500`), not `#c2410c` (that was the v3 value).

### Shared components (new folder `src/components/`)
| File | Kind | Content |
|---|---|---|
| `src/components/spinner.tsx` | server-compatible (no hooks) | `Spinner({ className })`: decorative `span` (`aria-hidden`), `animate-spin rounded-full border-2 border-accent/20 border-t-accent`, size via `className` (default `size-8`). |
| `src/components/splash.tsx` | server-compatible | `Splash()`: `div role="status" aria-live="polite"` fixed `inset-0 z-50` white, centered column: `<p className="text-3xl font-semibold">Mordomia</p>`, `<Spinner />`, `<p>Finding your location…</p>`. Used by `loading.tsx` and `HomeMap`. (The word "Mordomia" is a `p`, not a heading, so the login page stays the only `heading "Mordomia"`.) |

### Home `/` (AC-3 … AC-12)
| File | Kind | Responsibility |
|---|---|---|
| `src/app/page.tsx` | Server | Auth + own `username` (unchanged query) + `getMapsConfig(process.env)`; returns `<HomeMap username={profile?.username ?? null} config={config} />`. The "Hi @username 👋" placeholder and header are removed (superseded by AC-10: no top bar, username in the avatar menu). |
| `src/app/loading.tsx` | Server | `export default function Loading() { return <Splash />; }` (Next 16 `loading.js` convention: Suspense fallback for the `/` segment while the page renders, covers app open and the navigation after sign-in; AC-3). |
| `src/components/home/home-map.tsx` | Client | Orchestrator (below). |
| `src/components/home/map-view.tsx` | Client | `<Map>` + `<UserDot>` + recenter wiring (needs `useMap()`, so it lives inside `APIProvider`). |
| `src/components/home/user-dot.tsx` | Client | The blue dot (`AdvancedMarker`, see Map rendering choice). `data-testid="user-dot"` on the dot element. |
| `src/components/home/recenter-button.tsx` | Client | Floating round button, bottom-right, `aria-label="Recenter map"`, crosshair SVG icon; `disabled` + `aria-busy` while a reading is in flight. |
| `src/components/home/location-notice.tsx` | Client | Floating card, top-center below the avatar row, `role="status"`, exact AC-6 copy, ✕ button `aria-label="Dismiss"`. |
| `src/components/home/map-error.tsx` | Client | Centered "We couldn't load the map." + accent button "Try again" → `window.location.reload()` (AC-11). |
| `src/components/home/avatar-menu.tsx` | Client | Floating round accent button top-right showing `avatarInitial(username)`, `aria-label="Account menu"`, `aria-haspopup="menu"`, `aria-expanded`. Opens a small white card (`role="menu"`) with `@username` and a `<form action={logout}>` whose submit button is `role="menuitem"` "Sign out". Closes on outside pointer-down, Escape, or second tap. (AC-10) |

All floating elements use `env(safe-area-inset-*)` padding (the root viewport already has `viewportFit: "cover"`).
Page root: `<main className="fixed inset-0">` so the map is truly full-screen (AC-5) and nothing scrolls.

#### `HomeMap` state machine
Props: `{ username: string | null; config: MapsConfig | null }`.

State: `location: LocationState` (from `src/lib/map/location.ts`), `mapStatus: "loading" | "ready" | "failed"`,
`noticeDismissed: boolean`, `recentering: boolean`.

1. **Mount:** a `useEffect` guarded by a `useRef` flag calls `requestLocation(navigator.geolocation)` exactly once
   (the ref keeps React StrictMode's dev double-invoke from issuing a second reading; AC-4). On settle →
   `location = resolveInitialView(result)`.
2. **Config missing** (`config === null`, i.e. no key or no Map ID): `mapStatus = "failed"` from the start and
   `APIProvider` is **not** rendered (no request to Google).
3. **Config present:** `<APIProvider apiKey={config.apiKey} libraries={["marker"]} onError={() => fail()}>` is rendered
   immediately (script loads in parallel with the geolocation reading). A `useEffect` installs
   `window.gm_authFailure = fail` (Google's documented global callback for invalid/unauthorized keys; `vis.gl` 1.10
   never sets `AUTH_FAILURE` itself) and removes it on unmount. `MapView` mounts only once `location` has settled
   (so `defaultCenter` / `defaultZoom` are known) and reports `onTilesLoaded` (first time) → `mapStatus = "ready"`.
4. **Phase** = `homePhase(locationSettled, mapStatus)` (pure): `"splash"` until the location has settled **and**
   `mapStatus !== "loading"`; then `"map"` or `"error"`.
   - `splash`: `<Splash />` overlays everything (the map mounts underneath so its tiles can load).
   - `map`: map + `UserDot` (only if `location.userPosition`) + `RecenterButton` + `LocationNotice` (if
     `location.showNotice && !noticeDismissed`) + `AvatarMenu`.
   - `error`: `MapError` + `AvatarMenu` only (no notice, no recenter: they refer to a map that is not there; AC-11).
5. **Dismiss ✕:** `noticeDismissed = true` (React state only; nothing stored, so it reappears on the next visit; AC-6).
6. **Recenter (AC-7):** `recentering = true` → `requestLocation(navigator.geolocation)` (a new
   `getCurrentPosition` call; the browser re-prompts if permission is in "prompt" state) →
   `{ state, camera } = resolveRecenter(location, result)` (Decision #25), `location = state`, and `MapView` applies
   `camera` with `map.panTo(camera.center)` + `map.setZoom(camera.zoom)`: success → new fix, zoom 15, dot moves;
   failure with an earlier fix → back to that last fix at zoom 15, dot stays there; failure with no fix ever → Porto,
   zoom 13, no dot. On failure (both cases)
   `noticeDismissed = false` so the notice shows again. `recentering = false`.

#### `Map` props (AC-5, AC-8, AC-9, AC-12)
```tsx
<Map
  className="h-full w-full"
  mapId={config.mapId}                 // Decision #23: cloud style (AC-9)
  colorScheme={ColorScheme.LIGHT}      // AC-1/AC-9: never the dark map, whatever the OS theme
  defaultCenter={location.center}
  defaultZoom={location.zoom}          // 15 located, 13 Porto
  disableDefaultUI                     // AC-8: no zoom, map type, Street View, fullscreen, camera controls
  gestureHandling="greedy"             // AC-8: one-finger pan/pinch on the full-screen map
  clickableIcons={false}               // Decision #24: Google place icons do nothing on tap
  onTilesLoaded={onFirstTilesLoaded}
/>
```
The only child is the user dot: no restaurant markers (AC-12).

### Login `/login` (AC-13 … AC-17) — `src/app/login/page.tsx`
Order top to bottom (still one `"use client"` component, same `useActionState` wiring and `mode` state):
1. `h1` "Mordomia" (unchanged).
2. Tagline `p`: "The restaurants you went to and the ones you want to try, with friends." (AC-13).
3. Tabs (AC-15): `div role="tablist" aria-label="Account"`, two `button type="button" role="tab"`
   "Sign in" / "Sign up" with `aria-selected`; the active tab has `text-accent` and a 2 px `border-accent` underline,
   the inactive tab neutral gray. Clicking sets `mode` exactly as the old link did. The bottom toggle link is removed.
4. Form (`role="tabpanel"`): each field is `<label>` text above its input, linked by `htmlFor`/`id`
   (`username`, `email`, `password`): "Username" (sign-up only), "Email", "Password" (AC-14). Inputs keep `name`,
   `type`, `autoComplete`, `required`, `minLength`; the `placeholder` attributes are removed (the labels replace
   them).
5. Password show/hide (AC-16): the password input sits in a relative wrapper with a `button type="button"` on the
   right: visible text "Show" / "Hide", `aria-label="Show password"` / `"Hide password"`, `aria-pressed`
  ; toggles the input `type` between `password` and `text`. It resets to hidden when switching tabs.
6. Submit button: `bg-accent text-white` (AC-2), text "Sign in" / "Create account" unchanged; error / message
   paragraphs unchanged (AC-17).

## Pure logic (`src/lib/**`, Vitest)
| File | Exports |
|---|---|
| `src/lib/map/config.ts` | `PORTO = { lat: 41.1579, lng: -8.6291 }`, `ZOOM_LOCATED = 15`, `ZOOM_FALLBACK = 13`, `GEOLOCATION_OPTIONS = { enableHighAccuracy: false, timeout: 10_000, maximumAge: 0 }`, `type MapsConfig = { apiKey: string; mapId: string }`, `getMapsConfig(env: Record<string, string \| undefined>): MapsConfig \| null` (trimmed; `null` if the key or the Map ID is missing/blank). |
| `src/lib/map/location.ts` | `type LatLng`, `type LocationResult = { ok: true; position: LatLng } \| { ok: false; reason: "denied" \| "unavailable" \| "timeout" \| "unsupported" }`; `requestLocation(geo: Geolocation \| undefined): Promise<LocationResult>` (one `getCurrentPosition` call with `GEOLOCATION_OPTIONS`; maps `GeolocationPositionError.code` 1/2/3; `undefined` → `unsupported`; never calls `watchPosition`); `type LocationState = { center: LatLng; zoom: number; userPosition: LatLng \| null; showNotice: boolean }`; `resolveInitialView(result): LocationState` (ok → position, 15, dot, no notice; failure → Porto, 13, no dot, notice); `type Camera = { center: LatLng; zoom: number }`; `resolveRecenter(prev: LocationState, result): { state: LocationState; camera: Camera }` (Decision #25): ok → `userPosition` = new fix, center = fix, zoom 15, no notice, camera = fix/15; failure and `prev.userPosition` set → `userPosition` kept, center = that last fix, zoom 15, notice, camera = last fix/15; failure and no `prev.userPosition` → Porto, 13, no dot, notice, camera = Porto/13. |
| `src/lib/map/phase.ts` | `homePhase(locationSettled: boolean, mapStatus: "loading" \| "ready" \| "failed"): "splash" \| "map" \| "error"`. |
| `src/lib/profile/avatar.ts` | `avatarInitial(username: string \| null): string` → first character upper-cased, `"?"` when null/empty. |

## Test plan
> **Scope change (Decision #27, 2026-09-30):** the Playwright rows for the home and theme (Task 5:
> `helpers/maps.ts`, `home.spec.ts`, `theme.spec.ts`) are **dropped**. Tests written before the decision stay
> (Tasks 1–3 tests and `src/components/home/home-map.test.tsx`); no new tests are written in 002.

E2E never reaches Google: every home test calls `blockGoogleMaps(page)` (aborts `maps.googleapis.com` /
`maps.gstatic.com`), so the map always ends in the AC-11 error state whether or not a key is present locally
(no key → config `null`; key → aborted script → `APIProvider` `onError`). Behaviour that needs a rendered Google map
(center, zoom, dot, notice, recenter, controls, markers) is covered by Vitest component tests that mock
`@vis.gl/react-google-maps`, plus the manual smoke check in Task 7 once the user has a key.

New e2e helpers:
- `tests/e2e/helpers/auth.ts`: `signIn(page, user)` using the new labels (replaces the local copies in
  `auth.spec.ts` / `places.spec.ts`).
- `tests/e2e/helpers/maps.ts`: `blockGoogleMaps(page)`; `trackGeolocation(page, { hold?: boolean })` — an
  `addInitScript` that wraps `navigator.geolocation.getCurrentPosition` / `watchPosition`, records each call's
  options in `window.__geo`, and with `hold: true` keeps the callbacks pending until `window.__geoRelease()` is
  evaluated (then forwards to the real API). Tests set real positions with `context.grantPermissions(["geolocation"])`
  + `context.setGeolocation(...)`.

| AC | Type | File | What it proves |
|---|---|---|---|
| AC-1 | Vitest | `src/app/theme.test.ts` (`// @vitest-environment node`) | No file under `src/` contains a `dark:` class variant or `prefers-color-scheme: dark`; `layout.tsx` viewport has `colorScheme: "only light"`. |
| AC-1 | Playwright | `tests/e2e/theme.spec.ts` | With `page.emulateMedia({ colorScheme: "dark" })`, `/login` and signed-in `/` have `body` background `rgb(255, 255, 255)` and dark text color; the `color-scheme` meta is `only light`. |
| AC-2 | Playwright | `tests/e2e/login.spec.ts` | Submit button background and active tab color are `rgb(194, 65, 12)`. |
| AC-2 | Playwright | `tests/e2e/home.spec.ts` | Splash spinner `border-top-color` is `rgb(194, 65, 12)`. |
| AC-3 | Vitest | `src/lib/map/phase.test.ts` | `homePhase`: splash while location unsettled or map loading; map when both done; error when map failed (after location settled). |
| AC-3 | Vitest | `src/components/home/home-map.test.tsx` | Splash (text "Mordomia", "Finding your location…") shown while the geolocation fake is pending and while tiles have not loaded; gone after both. |
| AC-3 | Playwright | `tests/e2e/home.spec.ts` | With `trackGeolocation({ hold: true })`: after clicking "Sign in", the splash ("Finding your location…") is visible on `/`; after `__geoRelease()` it disappears. |
| AC-4 | Vitest | `src/lib/map/location.test.ts` | `requestLocation` calls `getCurrentPosition` once with `{ timeout: 10000, maximumAge: 0, enableHighAccuracy: false }`, never `watchPosition`; maps codes 1/2/3 and missing API to reasons. |
| AC-4 | Playwright | `tests/e2e/home.spec.ts` | With geolocation granted, loading `/` records exactly 1 `getCurrentPosition` call with `timeout: 10000` and 0 `watchPosition` calls (dev server, StrictMode on). |
| AC-5 | Vitest | `src/lib/map/location.test.ts` | `resolveInitialView(ok)` → center = position, zoom 15, `userPosition` = position, no notice. |
| AC-5 | Vitest | `src/components/home/home-map.test.tsx` | With a successful fake reading: mocked `Map` receives `defaultCenter`/`defaultZoom: 15`; one `user-dot` at that position. |
| AC-6 | Vitest | `src/lib/map/location.test.ts` | `resolveInitialView` for denied / unavailable / timeout / unsupported → Porto, 13, no dot, notice. |
| AC-6 | Vitest | `src/components/home/home-map.test.tsx` | Failed reading: Porto/13 passed to `Map`, exact notice text visible, ✕ hides it; a fresh render (new visit) shows it again. |
| AC-7 | Vitest | `src/lib/map/location.test.ts` | `resolveRecenter`: success → new fix/15, dot, no notice; failure after an earlier fix → dot and camera at the last fix/15 + notice; failure with no fix ever → Porto/13, no dot + notice. |
| AC-7 | Vitest | `src/components/home/home-map.test.tsx` | Tapping "Recenter map" issues a new `getCurrentPosition` call; success → mocked map `panTo(position)` + `setZoom(15)` and the dot moves; failure after a fix → `panTo(last fix)`, dot still there, notice shown (even if previously dismissed); failure with no fix ever → `panTo(Porto)` + `setZoom(13)`, no dot, notice. |
| AC-8 | Vitest | `src/components/home/home-map.test.tsx` | Mocked `Map` receives `disableDefaultUI: true` and `gestureHandling: "greedy"`. |
| AC-9 | Vitest | `src/components/home/home-map.test.tsx` | Mocked `Map` receives `mapId` from config and `colorScheme: "LIGHT"`, and no `styles` prop; `clickableIcons: false` (Decision #24). |
| AC-9 | Manual | Task 7 smoke check | With a real key + Map ID: shops/transit icons hidden, restaurant icons visible. |
| AC-10 | Vitest | `src/lib/profile/avatar.test.ts` | `avatarInitial("joao") === "J"`, `null`/`""` → `"?"`. |
| AC-10 | Playwright | `tests/e2e/home.spec.ts` | No `banner`/top bar; "Account menu" button shows the initial; opens a menu with `@username`; "Sign out" → `/login`, and `/` then redirects to `/login` (also replaces the 000 AC-4/AC-5 test). |
| AC-11 | Vitest | `src/lib/map/config.test.ts` | `getMapsConfig`: missing/blank key [or Map ID] → `null`; both set → trimmed config. |
| AC-11 | Vitest | `src/components/home/home-map.test.tsx` | `config = null` → error text + "Try again", `APIProvider` not rendered, avatar menu present; `APIProvider` `onError` → error state; `window.gm_authFailure()` → error state. |
| AC-11 | Playwright | `tests/e2e/home.spec.ts` | With Google blocked: "We couldn't load the map." and "Try again" visible, "Account menu" usable; clicking "Try again" reloads the page (a `load` event fires and the splash shows again). |
| AC-12 | Vitest | `src/components/home/home-map.test.tsx` | Mocked `Map` has exactly one marker child (the user dot) when located, zero when on the Porto fallback. |
| AC-13 | Playwright | `tests/e2e/login.spec.ts` | Tagline text visible below the "Mordomia" heading. |
| AC-14 | Playwright | `tests/e2e/login.spec.ts` | `getByLabel("Email", { exact: true })` / `"Password"` visible in Sign in; `"Username"` only in Sign up. |
| AC-15 | Playwright | `tests/e2e/login.spec.ts` | Two `tab`s; "Sign in" `aria-selected=true` by default; clicking "Sign up" selects it, shows the Username field and "Create account"; no "No account? Sign up" link. |
| AC-16 | Playwright | `tests/e2e/login.spec.ts` | Password input `type=password`; "Show password" → `type=text`; "Hide password" → `type=password`. |
| AC-17 | Playwright | `tests/e2e/auth.spec.ts` | Existing 000 tests (AC-1, AC-2, sign in → `/`, sign out) rewritten to the new selectors still pass, same messages; `tests/e2e/places.spec.ts` sign-in still reaches `/`. |

## Technical decisions
1. **Map config passed as props from the Server Component** (`getMapsConfig(process.env)` in `page.tsx`) instead of
   reading `process.env.NEXT_PUBLIC_*` inside the client component: one place decides "missing key", and component
   tests pass plain props.
2. **Invalid key detection via `window.gm_authFailure`**: `@vis.gl/react-google-maps` 1.10.1 declares
   `APILoadingStatus.AUTH_FAILURE` but never sets it; Google calls the global `gm_authFailure()` on key errors.
   Network/script failures come from `APIProvider`'s `onError`.
3. **Splash = location settled AND map settled** (first `tilesloaded`, or failure). If the map fails before the
   location settles, the splash waits for the location (≤ 10 s) so the phase logic stays one rule.
4. **Single reading guarded by a `useRef`** so StrictMode's dev double effect does not create a second reading.
5. **Geolocation options** `enableHighAccuracy: false` (faster, network accuracy is enough to show "near me";
   avoids timeouts indoors), `timeout: 10000` (AC-4), `maximumAge: 0` (fresh reading, also for recenter).
6. **Porto fallback coordinates** `41.1579, -8.6291` (city centre).
7. **Recenter always moves the camera** (the user may have panned away): success → new fix at zoom 15 (the
   "located" zoom of AC-5 / Decision #12); failure after an earlier fix → back to that last fix at zoom 15 (reading of
   Decision #25 "keep map + dot at the last successful fix"); failure with no fix ever → Porto at zoom 13.
8. **Error state shows only the message, "Try again" and the avatar**: no notice, no recenter button.
9. **Accent as a theme token** `--color-accent: #c2410c` (exact AC-2 hex; Tailwind v4 `orange-700` differs).
10. **`color-scheme: only light` + `themeColor`/manifest `theme_color` `#ffffff`** so the OS/browser never darkens the
    page or paints a black status bar (AC-1).
11. **Placeholders removed from login inputs** (visible labels replace them); tests switch to `getByLabel(…, { exact: true })`
    (non-exact would also match the "Show password" toggle).
12. **Layout of floating elements:** avatar top-right, notice top-center below it, recenter bottom-right above
    Google's attribution, all inset by the safe area; blue dot 16 px `#3b82f6`-style blue with white ring.
13. **New folder `src/components/`** (shared `Splash`, `Spinner`) and `src/components/home/` (home-only client
    components); pure logic in `src/lib/map/` and `src/lib/profile/`. Architecture §3 gets these at Mode B.
14. **E2E blocks Google** with `page.route` for every home test, so results never depend on a local key or network.
15. **Removal of the "Hi @username 👋" greeting** (000 AC-4 as built): the home is now the full-screen map without a
    top bar (AC-5, AC-10); the username appears in the avatar menu. The 000 e2e test is rewritten accordingly.

## Risks & notes
- **001 overlap:** 001 (specced, not built) Task 4 edits `src/app/login/page.tsx` (`minLength`) and
  `tests/e2e/auth.spec.ts`. Whichever feature is implemented second adapts to the other: 002 keeps 001's
  `MIN_PASSWORD_LENGTH` if present; 001's new tests must use the 002 selectors (`tab` "Sign up",
  `getByLabel(…, { exact: true })`) if 002 lands first.
- **No automated test renders a real Google map.** AC-5…AC-9 and AC-12 rely on mocked-component tests + a manual
  smoke check (Task 7). If the user adds a key before the build, Task 7 must be done with it.
- **Cloud style lives outside the repo (Decision #23)**: if someone edits the style in the console, AC-9 changes
  silently. The README will record the exact settings.
- **`tilesloaded` never firing** (e.g. very slow network after the script loaded) would keep the splash up; accepted
  for v1 (no extra timeout invented).
- Map loads cost Google credit (Dynamic Maps SKU) on every home visit; within the $200/mo credit for a friends-only app.
