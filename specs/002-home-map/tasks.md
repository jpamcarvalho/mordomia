# 002 · Home map, light theme, login polish — Tasks

> Written by: architect · Executed by: implementer (tick each box and commit after finishing a task)
> Each task: small, independently verifiable, lists files and the AC ids it satisfies.
> Commit message per task: `feat(002): task N - <summary>`.
> Prerequisites: local Supabase running (`npx supabase start`), filled-in `.env.test`; `PATH` includes
> `~/.local/node/bin` and `~/.docker/bin` (architecture §10). No migration in this feature.
> Read `design.md` first. Architect questions were answered in the requirements Decisions log #23–#26.

**User setup (outside the repo, done by the user; not a blocker for Tasks 1–6):**
1. Google Cloud → APIs & Services: enable *Maps JavaScript API*; create a browser key restricted to HTTP referrers
   (`http://localhost:3000/*`, the Vercel domain) and to the Maps JavaScript API only →
   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
2. Google Maps Platform → Map Management → Create Map ID: type *JavaScript*, *Vector* →
   `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`.
3. Map Styles → Create style (light, based on the default Google style) and associate it with that Map ID.
4. In the style, Points of interest: visibility **off** for every category except *Food and drink* (restaurants,
   cafés, bars, bakeries); Transit (stations, lines): **off**. Save and publish.
5. Put both values in `.env.local` (and in Vercel project env vars). Without either, `/` shows the AC-11 error.
> Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/loading.md` before Task 4.

- [x] **Task 1 — Always-light theme and accent token**
  - Files: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/manifest.ts`, `src/app/login/page.tsx` (remove the
    `dark:` classes only), `src/app/theme.test.ts`
  - AC: AC-1, AC-2 (token)
  - Do: as in design.md → UI → Theme: remove the dark `@media` block, add `--color-accent: #c2410c` to `@theme inline`,
    `viewport.colorScheme = "only light"` + `themeColor: "#ffffff"`, manifest `theme_color: "#ffffff"`, drop
    `dark:bg-white dark:text-black`. Add the node-environment Vitest guard (no `dark:` variant / dark media query
    under `src/`, viewport `colorScheme` is `only light`).
  - Done when: `npm test`, `npm run typecheck`, `npm run lint` pass; `grep -rn "dark:" src` prints nothing; and
    `npx playwright test tests/e2e/pwa.spec.ts tests/e2e/auth.spec.ts` still passes.

- [x] **Task 2 — Login polish: tagline, labels, tabs, password toggle**
  - Files: `src/app/login/page.tsx`, `tests/e2e/helpers/auth.ts` (new `signIn`), `tests/e2e/auth.spec.ts`,
    `tests/e2e/places.spec.ts`, `tests/e2e/login.spec.ts` (new)
  - AC: AC-2, AC-13, AC-14, AC-15, AC-16, AC-17
  - Do: implement design.md → UI → Login (tagline, `tablist`/`tab`s with accent on the active one, labelled inputs
    without placeholders, visible "Show"/"Hide" toggle with aria-labels "Show password"/"Hide password" (Decision #26), `bg-accent` submit button); keep `useActionState`, actions,
    messages and `minLength` source untouched. Move `signIn` to the helper (labels, `exact: true`) and use it in
    `auth.spec.ts` and `places.spec.ts`; rewrite the 000 AC-2 test to click the "Sign up" tab. Add `login.spec.ts`
    with the AC-2, AC-13…AC-16 rows of the test plan (named with their AC ids).
  - Done when: `npm run typecheck`, `npm run lint` pass, and `npx playwright test tests/e2e/login.spec.ts
    tests/e2e/auth.spec.ts tests/e2e/places.spec.ts` passes (the existing 000 tests prove AC-17).

- [x] **Task 3 — Pure map / location / avatar logic**
  - Files: `src/lib/map/config.ts`, `src/lib/map/config.test.ts`, `src/lib/map/location.ts`,
    `src/lib/map/location.test.ts`, `src/lib/map/phase.ts`, `src/lib/map/phase.test.ts`, `src/lib/profile/avatar.ts`,
    `src/lib/profile/avatar.test.ts`
  - AC: AC-3, AC-4, AC-5, AC-6, AC-7, AC-10, AC-11
  - Do: implement the exports in design.md → Pure logic, with `resolveRecenter` returning `{ state, camera }` per
    Decision #25 and `getMapsConfig` returning `null` when the key or the Map ID is missing/blank (Decision #23). `requestLocation` takes the `Geolocation` object as a parameter (tests pass a fake).
  - Done when: `npm test` passes with every Vitest row of the test plan for these files, and `npm run typecheck`,
    `npm run lint` pass.

- [x] **Task 4 — Home map screen (splash, map, dot, notice, recenter, avatar menu, error)**
  - Files: `src/components/spinner.tsx`, `src/components/splash.tsx`, `src/app/loading.tsx`, `src/app/page.tsx`,
    `src/components/home/home-map.tsx`, `src/components/home/map-view.tsx`, `src/components/home/user-dot.tsx`,
    `src/components/home/recenter-button.tsx`, `src/components/home/location-notice.tsx`,
    `src/components/home/map-error.tsx`, `src/components/home/avatar-menu.tsx`,
    `src/components/home/home-map.test.tsx`, `.env.example` (add `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=` under the Maps key,
    with a comment: cloud Map ID whose style hides non-restaurant POIs, see `specs/002-home-map/tasks.md` → User setup;
    required, the map shows an error without it), `.env.test.example` (comment: the Maps variables are not needed,
    e2e tests block Google Maps), `tests/e2e/auth.spec.ts` (replace the "Hi @username 👋" sign-in/sign-out test with one that
    opens the avatar menu, sees `@username` and signs out)
  - AC: AC-3, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12
  - Do: build the components and the `HomeMap` state machine exactly as in design.md → UI → Home (Map props block,
    `gm_authFailure` hook, `APIProvider` not rendered when `config` is `null`, `clickableIcons={false}` (Decision #24),
    accessible names "Account menu" / "Recenter map" / "Dismiss" (Decision #26), recenter camera moves per Decision #25). `home-map.test.tsx` mocks `@vis.gl/react-google-maps` (`APIProvider`, `Map`
    recording its props and exposing `onTilesLoaded`, `AdvancedMarker`, `useMap` returning `{ panTo, setZoom }` spies,
    `ColorScheme`) and a fake `Geolocation`, and covers every `home-map.test.tsx` row of the test plan.
  - Done when: `npm test`, `npm run typecheck`, `npm run lint` pass; `npx playwright test tests/e2e/auth.spec.ts
    tests/e2e/places.spec.ts` passes; and `npm run dev` without a Maps key shows splash → "We couldn't load the map."
    with a working avatar menu.

- [x] ~~**Task 5 — Home and theme end-to-end tests**~~ — **Dropped** (Decision #27: no new tests from Task 4 on;
  AC-1…AC-4, AC-10, AC-11 have no e2e coverage in 002 beyond the Vitest tests already written).
  - Files: `tests/e2e/helpers/maps.ts` (new: `blockGoogleMaps`, `trackGeolocation`), `tests/e2e/home.spec.ts` (new),
    `tests/e2e/theme.spec.ts` (new)
  - AC: AC-1, AC-2, AC-3, AC-4, AC-10, AC-11
  - Do: write the helpers and the Playwright rows of the test plan for these ACs, each test named with its AC ids;
    every test that reaches `/` calls `blockGoogleMaps(page)` first; signed-in tests use `createConfirmedUser()` /
    `deleteUser()` in `beforeEach` / `afterEach` and `signIn` from `helpers/auth.ts`; geolocation via
    `context.grantPermissions(["geolocation"])` + `context.setGeolocation(...)`.
  - Done when: `npx playwright test tests/e2e/home.spec.ts tests/e2e/theme.spec.ts` passes twice in a row, both with
    `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` unset and (if the user has one) set in `.env.local`.

- [x] **Task 6 — Full check**
  - Files: none (fix anything that fails in the task that introduced it, then re-run)
  - AC: AC-1 … AC-17
  - Do: `npm run check`.
  - Done when: `npm run check` (lint → typecheck → Vitest → pgTAP → Playwright → build) passes end to end with no
    skipped tests. Commit only if something changed.

- [ ] **Task 7 — Manual smoke check with a real Google key (user-assisted)**
  - Files: none (record the result in the implementer's report; bugs found are fixed in the task that owns the file)
  - AC: AC-5, AC-6, AC-7, AC-8, AC-9, AC-12
  - Do: only when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` are set (User setup done) in `.env.local`: on a phone or
    Chrome device emulation, check: location allowed → map at your position, zoom 15, blue dot; location blocked →
    Porto, zoom 13, notice, ✕ hides it, reload shows it again; recenter moves map and dot; with location blocked after a fix, recenter keeps the dot and returns to the last fix + notice; no Google controls; shops
    and transit hidden, restaurant icons visible; no restaurant markers. If no key is available yet, report the task
    as **pending (no key)** and do not block the feature on it.
  - Done when: every check above is reported as pass, or the task is reported as pending (no key).

## Review round 1 fixes (Decisions #29–31)
No new test files (Decision #27): update existing tests only where the behavior change breaks them.

- [x] **Task 8 — Location: overall 10 s cap + late success (AC-4, AC-6, AC-18)**
  - Files: `src/lib/map/location.ts`, `src/lib/map/phase.ts` (if needed), `src/components/home/home-map.tsx`,
    existing `src/lib/map/location.test.ts` / `src/components/home/home-map.test.tsx` only where they break
  - Do: the initial reading resolves `{ ok: false, reason: "timeout" }` 10 s after the request even while the
    permission prompt is unanswered (splash → Porto zoom 13 + notice). If the underlying `getCurrentPosition` later
    succeeds, move the map to it at zoom 15, show the blue dot and hide the notice. A late failure changes nothing.
    Keep the single-request guarantee (one `getCurrentPosition` call; no `watchPosition`). Apply the same 10 s cap to
    the recenter reading (AC-7 failure rules unchanged).
  - Done when: lint, typecheck and `npm test` pass.

- [ ] **Task 9 — Splash on `/` only (AC-3)**
  - Files: move `src/app/page.tsx` → `src/app/(home)/page.tsx` and `src/app/loading.tsx` → `src/app/(home)/loading.tsx`;
    fix imports (e.g. `../login/actions`) and any test that imports these paths
  - Do: route group so the splash is the Suspense fallback for `/` only; `/login` and future routes get no splash.
  - Done when: `npm run build` lists `/` and `/login` as before, and `npm run check` passes.
