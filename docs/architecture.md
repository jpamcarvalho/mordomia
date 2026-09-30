# Mordomia — Architecture

> Source of truth for how the app is built. Owned by the `architect` agent; updated after every feature passes review.
> Last updated: 2026-09-30 (002-home-map closed without a round-2 review; 000 security gaps still open until 001, see §6)

## 1. Product in one paragraph
A friends-only social app. Each user keeps restaurants as **went** (visible to accepted friends) or **want to go**
(private to the owner), with optional rating (went only), notes and photos. Friendships are mutual (request → accept).
Mobile-first web app (PWA); a native app may come later, so logic stays in React/TypeScript.

## 2. Stack
| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js App Router, Turbopack | 16.3 (see `node_modules/next/dist/docs/`, APIs differ from older versions) |
| UI | React, Tailwind CSS v4 | 19.2 / 4 |
| Language | TypeScript (strict) | 5 |
| DB / Auth / Storage | Supabase (Postgres, Auth email+password, Storage) | `@supabase/supabase-js` 2, `@supabase/ssr` 0.12 |
| Places search | Google Places API (New): Autocomplete | server-side only |
| Maps | Google Maps JavaScript API via `@vis.gl/react-google-maps` (vector map + cloud Map ID, `AdvancedMarker`) | 1.10; home map since 002. **To be replaced in 003** by MapLibre + OpenFreeMap tiles (no key) |
| Hosting | Vercel Hobby + Supabase Free + Google Maps Platform free monthly usage caps | |
| Runtime | Node 24 LTS (`~/.local/node` on the dev Mac) | |

## 3. Folder structure
```
src/
  proxy.ts                    # Next 16 "middleware": refreshes session, redirects signed-out users to /login
  lib/supabase/
    client.ts                 # createClient() for Client Components (browser)
    server.ts                 # createClient() for Server Components, Server Actions, Route Handlers (per request)
    proxy.ts                  # updateSession() used by src/proxy.ts
  app/
    layout.tsx                # root layout, metadata, viewport (colorScheme "only light"), PWA meta
    globals.css               # Tailwind v4 import, light colors, @theme tokens (incl. --color-accent)
    manifest.ts               # PWA manifest
    theme.test.ts             # Vitest guard: no dark mode anywhere under src/
    (home)/                   # route group: `/` only, so its loading.tsx never applies to other routes
      page.tsx                # home (signed-in): own username + maps config → <HomeMap>
      loading.tsx             # <Splash> while `/` renders
    login/page.tsx            # sign in / sign up (client component, useActionState, tabs)
    login/actions.ts          # login, signup, logout server actions
    auth/confirm/route.ts     # email confirmation link target (verifyOtp / code exchange)
    api/places/route.ts       # GET: Google Places autocomplete proxy (auth required)
  components/                 # shared UI components (spinner.tsx, splash.tsx)
    home/                     # home-only client components (home-map, map-view, user-dot, recenter-button,
                              #   location-notice, map-error, avatar-menu) + home-map.test.tsx
  lib/validation/             # pure validation helpers + colocated *.test.ts (e.g. username.ts)
  lib/map/                    # pure map logic: config.ts (Porto, zooms, geolocation options, getMapsConfig),
                              #   location.ts (requestLocation, resolveInitialView, resolveRecenter), phase.ts
  lib/profile/                # pure profile helpers (avatar.ts: avatarInitial)
supabase/
  config.toml                 # local Supabase config
  migrations/                 # SQL migrations (never edit an applied one; add a new file)
  tests/                      # pgTAP tests (*.test.sql)
tests/e2e/                    # Playwright specs (*.spec.ts)
  helpers/users.ts            # create/delete confirmed test users via the admin API
  helpers/auth.ts             # signIn(page, user) through the /login form
vitest.config.ts, playwright.config.ts
.env.example, .env.test.example  # committed templates; real .env* files are git-ignored
docs/architecture.md          # this file
specs/                        # spec-driven feature folders (see CLAUDE.md)
```

## 4. Conventions
- **Server-first:** pages are Server Components; add `"use client"` only for interactivity.
- **Mutations:** Server Actions in an `actions.ts` next to the route that uses them. Return `{ error?, message? }`-style
  state for forms (`useActionState`); `redirect()` on success where navigation is needed.
- **Route Handlers** (`app/api/**/route.ts`) only for things that need an HTTP endpoint (e.g. autocomplete fetched while typing).
- **Supabase client:** always `await createClient()` from `@/lib/supabase/server` on the server (new per request);
  `createClient()` from `@/lib/supabase/client` in the browser. Never share a server client across requests.
- **Auth check:** `supabase.auth.getClaims()`; `claims.sub` is the user id. Every Server Action / Route Handler that
  touches user data checks it (the proxy is only a first line).
- **Async request APIs (Next 16):** `await cookies()`, `await headers()`, `await params`, `await searchParams`.
- **Imports:** `@/*` → `src/*`.
- **Styling:** Tailwind utility classes; mobile-first. **Always light, no dark mode** (002): never use `dark:`
  variants or `prefers-color-scheme: dark` (guarded by `src/app/theme.test.ts`); the root viewport declares
  `colorScheme: "only light"`, `themeColor: "#ffffff"`. Background `#ffffff`, foreground `#171717`.
- **Accent color:** the theme token `--color-accent: #c2410c` (terracotta) in `globals.css` → `bg-accent`,
  `text-accent`, `border-accent`, `border-t-accent`. Use it for primary buttons, the active tab and spinners; never
  hard-code the hex or use Tailwind v4 `orange-700` (a different color).
- **Components:** shared UI in `src/components/`, feature-specific client components in `src/components/<area>/`;
  decision logic stays pure in `src/lib/**` and is passed plain props (e.g. the maps config is computed on the server
  with `getMapsConfig(process.env)` and passed to the client component).
- **Full-screen screens / floating UI:** page root `fixed inset-0`; floating controls inset with
  `env(safe-area-inset-*)` (root viewport has `viewportFit: "cover"`).
- **Route-level loading UI:** put `loading.tsx` inside a route group that covers only the intended route (e.g.
  `(home)`), never at the app root.
- **Secrets:** only `NEXT_PUBLIC_*` vars reach the browser. `GOOGLE_PLACES_API_KEY` is server-only.
- **Validation:** validate user input on the server even when the form validates too; DB constraints are the last line.

## 5. Data model (`supabase/migrations/20260929000000_init.sql`)
| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (= auth.users.id), `username` unique `^[a-z0-9_]{3,24}$`, `display_name`, `avatar_path` | created by trigger `handle_new_user` from signup metadata `username` |
| `restaurants` | `id`, `google_place_id` unique, `name`, `address`, `lat`, `lng`, `created_by` | shared catalogue, deduplicated by Google place id |
| `entries` | `id`, `user_id`, `restaurant_id`, `status` (`want`/`went`), `rating` 1–5, `notes`, `visited_at` | unique (`user_id`, `restaurant_id`); rating only allowed when `went`; `updated_at` trigger |
| `entry_photos` | `id`, `entry_id`, `user_id`, `storage_path` unique | file in bucket `entry-photos` at `{user_id}/{entry_id}/{filename}` |
| `friendships` | `requester_id`, `addressee_id`, `status` (`pending`/`accepted`) | one row per pair (unique on least/greatest) |

Helper: `public.are_friends(a, b)` (security definer) → true if an accepted friendship exists.
Currently executable by PUBLIC/anon for any pair (gap 3 below; 001 restricts it).

## 6. Privacy model (RLS, all tables enabled)

> **Warning: known security gaps until feature 001 (security hardening) is done.** The 000 review found holes in the
> policies of `20260929000000_init.sql`; the user closed 000 with them and scheduled the fixes in 001 (000
> requirements Decisions log #14–16; details in `specs/000-foundation/README.md` → "Known gaps"). Do not rely on the
> policies below as correct, and do not copy them as patterns, until 001 lands:
> 1. **[blocker]** `friendships: addressee accepts` (init.sql:201-204) lets the addressee change `requester_id` while
>    accepting → forged accepted friendship → reads a non-consenting user's `went` entries/photos (breaks AC-7/AC-10 of 000).
> 2. **[major]** `entry_photos: insert own` (init.sql:184-188, with the storage read policy at 222-229) does not require
>    `storage_path` to start with `{auth.uid()}/{entry_id}/` → can expose another user's orphaned/pending files or squat paths.
> 3. **[minor]** `are_friends` (init.sql:128-141) is SECURITY DEFINER and executable by PUBLIC/anon; the friend graph is
>    meant to be private (only checks involving `auth.uid()`).
>
> 001 fixes these with a new migration (never by editing init.sql) plus pgTAP tests. Other 000 gaps (non-security-policy)
> are listed in §7, §10 and the 000 README.


| Table | Read | Write |
|---|---|---|
| profiles | any signed-in user | update own |
| restaurants | any signed-in user | insert (created_by = self) |
| entries | own; or `status='went'` AND `are_friends(me, owner)` | insert/update/delete own |
| entry_photos | if the parent entry is readable | insert own (on own entry; path prefix **not** checked, gap 2) / delete own |
| friendships | rows where I'm requester or addressee | insert as requester with `pending`; addressee updates to `accepted` (ids **not** immutable, gap 1); either side deletes |
| storage `entry-photos` (private, 5 MB, jpeg/png/webp/heic) | own folder, or path listed in a readable `entry_photos` row | upload/delete in own folder |

**Invariant:** "want to go" entries are never readable by anyone but their owner.
(The "went only to accepted friends" invariant is bypassable via gap 1 until 001.)

**Invariant (002):** the user's geolocation stays in the browser; it is never sent to a Mordomia server action,
route handler or table (only the in-page map library receives it).

## 7. Auth flow
Sign up (email, password, username) → `signup` server action validates the username (`src/lib/validation/username.ts`)
→ `signUp` with `data.username` → trigger creates the profile → Supabase sends a confirmation email → link hits
`/auth/confirm` → session cookie set → `/`. Sign out: the home's avatar menu ("Account menu" → "Sign out") submits
the `logout` server action. `/login` has "Sign in" / "Sign up" tabs (002). `src/proxy.ts` runs on every non-static request: refreshes the session via
`getClaims()` and redirects to `/login` when signed out (public paths: prefix match on `/login`, `/auth`).
- Password ≥ 8 is currently enforced **only in the browser** (`minLength`); the server action does not check it and
  `supabase/config.toml` has `minimum_password_length = 6` (000 gap 4, fixed in 001).
- The proxy matcher excludes any path starting with `icon`/`apple-icon` (000 gap 6, fixed in 001: exact exclusions).
- Local Supabase has email confirmations disabled (`[auth.email] enable_confirmations = false`).

## 8. External APIs
- **Places Autocomplete:** `GET /api/places?q=<text>&lat=&lng=` → `{ suggestions: [{ placeId, name, address }] }`.
  Restricted to types restaurant, cafe, bar, bakery; optional 20 km location bias. Requires a session (the route
  returns 401, but in practice the proxy answers first with a 307 to `/login`). `q` shorter than 2 characters →
  `{ suggestions: [] }` without calling Google; Google failure → 502.
- Place details (lat/lng, photos) not implemented yet.
- **Maps JavaScript API (home map, 002; to be replaced by MapLibre + OpenFreeMap in 003):** loaded in the browser by
  `APIProvider` (`libraries={["marker"]}`) only when `getMapsConfig()` finds both `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
  and `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`; otherwise no request is made and the home shows its map-error state. Vector
  map with a **cloud Map ID** whose cloud style hides non-restaurant POIs (configured in Google Cloud, not in the repo;
  setup in `specs/002-home-map/README.md`), `colorScheme` LIGHT, `disableDefaultUI`, `gestureHandling="greedy"`,
  `clickableIcons={false}`. Failures: `APIProvider` `onError` (script/network) and the global
  `window.gm_authFailure` (invalid/unauthorized key; vis.gl 1.10 never reports `AUTH_FAILURE` itself).
- **Browser geolocation (002):** `requestLocation()` in `src/lib/map/location.ts` makes one `getCurrentPosition` call
  (`enableHighAccuracy: false`, `timeout: 10000`, `maximumAge: 0`), never `watchPosition`, and caps the whole request
  at 10 s with its own timer (the browser timeout does not run while the permission prompt is unanswered); a success
  after the cap is delivered via `onLateSuccess`. Fallback when unavailable: Porto (`41.1579, -8.6291`) at zoom 13;
  located: zoom 15.

## 9. Environment variables (`.env.example`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GOOGLE_PLACES_API_KEY` (server),
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser, HTTP-referrer restricted, Maps JavaScript API only),
`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (browser, cloud Map ID carrying the clean map style; 002). Both Maps vars are
required for the home map; missing or blank → map-error state. Both are expected to go away with 003 (MapLibre).

Tests use `.env.test` (git-ignored; template `.env.test.example`, values from `npx supabase status`):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (e2e helpers only,
never used by the app), `GOOGLE_PLACES_API_KEY` (optional; current e2e tests never reach Google). The Maps vars are
not needed for tests.

## 10. Testing
| Kind | Tool | Location | Script |
|---|---|---|---|
| DB / RLS | pgTAP via `supabase test db` | `supabase/tests/*.test.sql` | `npm run test:db` |
| Unit / component | Vitest + Testing Library (jsdom) | `src/**/*.test.{ts,tsx}` (colocated) | `npm test` |
| End-to-end | Playwright (`@playwright/test`, Chromium, Pixel 7 device) | `tests/e2e/*.spec.ts` | `npm run test:e2e` |
| All | lint → typecheck → Vitest → pgTAP → Playwright → build | | `npm run check` |

Tests run against **local Supabase** (`npx supabase start`, Docker Desktop running).
- **pgTAP pattern:** one file per area; `begin; … select plan(n); … select * from finish(); rollback;`. Create users
  by inserting into `auth.users` with `raw_user_meta_data` `{"username": …}` (fires the profile trigger); impersonate
  with `set local role authenticated` + `set local request.jwt.claims = '{"sub": "<uuid>", "role": "authenticated"}'`;
  `reset role` to inspect as superuser. Assert RLS denials with `throws_ok(…, '42501', …)` for inserts and
  "0 rows affected" (`results_eq` on a `returning` CTE) for updates/deletes.
- **Vitest:** `vitest.config.ts` (jsdom, `@vitejs/plugin-react`, `vite-tsconfig-paths` for `@/`). Put testable pure
  logic in `src/lib/**` and colocate `*.test.ts`. Component tests colocate `*.test.tsx` next to the component and
  mock third-party map libraries (e.g. `home-map.test.tsx` mocks `@vis.gl/react-google-maps` and passes a fake
  `Geolocation`); source-scanning guards use `// @vitest-environment node` (e.g. `src/app/theme.test.ts`).
- **Playwright:** `playwright.config.ts` loads `.env.test` with `process.loadEnvFile` and **throws if it is missing**;
  starts `npm run dev` on **port 3100** (reuses an existing server outside CI) and passes the Supabase/Google env vars
  to it. Signed-in tests create a confirmed user with `createConfirmedUser()` from `tests/e2e/helpers/users.ts`
  (admin API, `SUPABASE_SERVICE_ROLE_KEY`), sign in with `signIn()` from `tests/e2e/helpers/auth.ts` and delete the
  user with `deleteUser()` in `afterEach`. Name tests with their AC ids. Select login fields with
  `getByLabel("Email" | "Password", { exact: true })` (non-exact "Password" also matches the "Show password" toggle).
- **Next 16 dev lock:** only one `next dev` can run per project folder. If a dev server is already running (e.g. on
  :3000), Playwright cannot start its own :3100 server; stop it before `npm run test:e2e` / `npm run check`.
- **Known e2e env leak (002 review finding 1, not fixed):** `next dev` loads `.env.local` itself and
  `webServer.env` does not override the Maps vars, so once `.env.local` has real Google Maps values, e2e runs that
  reach `/` (e.g. the sign-in test in `auth.spec.ts`, which does not block Google) will load the real Google map.
- **Dev deps of note:** `@types/node` `^24` (Node 24; types for `process.loadEnvFile`), `@playwright/test`, `vitest`,
  `jsdom`, `@testing-library/react`, `@testing-library/dom`, `supabase` CLI.
- **Git-ignored:** `.env*` except `.env.example` / `.env.test.example`, `supabase/.temp`, `supabase/.branches`,
  `test-results/`, `playwright-report/`, `blob-report/`, `playwright/.cache/`, `coverage/`.
  `.claude/settings.local.json` is currently tracked and should not be (000 gap 7, fixed in 001).
- **Known coverage gaps (fixed in 001):** AC-1 e2e only checks `/` (gap 5); no pgTAP test for gaps 1–3.
- **Known coverage gaps (002):** no e2e for the home/theme (Task 5 dropped by the user), no automated test for the
  10 s cap / late success (AC-18) or for "no splash on `/login`", and no check against a real Google map (Task 7 not
  done). See `specs/002-home-map/README.md`.
- **Dev Mac:** Node in `~/.local/node/bin`, Docker CLI in `~/.docker/bin` (Docker Desktop's CLI; not on the default
  `PATH`); both must be on `PATH` for `npm run check` / `npx supabase …`:
  `export PATH="$HOME/.local/node/bin:$HOME/.docker/bin:$PATH"`.

## 11. Features
See `specs/README.md` for status. Built so far:
- **000 Foundation** (`specs/000-foundation/README.md`): scaffold, auth, schema + RLS, Places proxy, PWA manifest,
  test tooling. Closed with 7 known gaps (1 blocker, 1 major, 5 minor) scheduled for **001 security hardening**.
- **002 Home map, light theme, login polish** (`specs/002-home-map/README.md`): always-light theme + accent token;
  `/` is a full-screen Google map centered on the user's one-time location (Porto fallback + notice, recenter, blue
  dot, avatar menu with sign-out, splash, map-error state); login tabs, labels, tagline, password toggle. UI only (no
  DB changes). Review round 1 PASS; its fixes (Tasks 8–9) closed without a round-2 review; manual check with a real
  Google key never done.
- **Upcoming 003:** replace Google Maps with MapLibre + OpenFreeMap tiles (no key).
