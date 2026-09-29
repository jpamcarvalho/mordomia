# 000 · Foundation

> Explanation of the feature **as built**. Written by the architect after review (2026-09-29).
> The review verdict was CHANGES REQUIRED; the user chose to close 000 with the **known gaps listed below** and fix
> them in feature **001 (security hardening)** (Decisions log #14–16 in `requirements.md`).
> Agents: read this before changing auth, the Supabase clients, the proxy, the schema/RLS, the Places route or the
> test tooling. **Do not treat the current friendships / entry_photos policies as correct until 001 is done.**

## What it does
Gives Mordomia accounts (email + password + username), keeps every page behind sign-in, stores data in Supabase with
privacy rules enforced in the database (RLS), offers a server-side Google Places autocomplete that later features use
to add restaurants, serves a PWA manifest, and sets up the three test layers (pgTAP, Vitest, Playwright) every later
feature uses.

## How it works
1. **Every request:** `src/proxy.ts` (Next 16 proxy, formerly middleware) calls `updateSession()` in
   `src/lib/supabase/proxy.ts`. It refreshes the Supabase session cookie via `getClaims()` and redirects to `/login`
   when there is no session and the path does not start with `/login` or `/auth` (AC-1). The matcher skips
   `_next/static`, `_next/image`, `favicon.ico`, `manifest.webmanifest`, paths starting with `icon`/`apple-icon`
   (see gap 6), and image files.
2. **Sign up:** `/login` (client component, `useActionState`, sign-in / sign-up toggle) → `signup` server action →
   `normalizeUsername` + `isValidUsername` (`src/lib/validation/username.ts`, `^[a-z0-9_]{3,24}$` after trim +
   lowercase) → error "Username must be 3–24 characters: letters, numbers or _." (AC-2) or
   `supabase.auth.signUp` with `data: { username }` and `emailRedirectTo: {origin}/auth/confirm` → DB trigger
   `handle_new_user` inserts the lowercased `profiles` row (AC-3) → "Check your email to confirm your account."
3. **Confirm:** `/auth/confirm` accepts `token_hash` + `type` (`verifyOtp`) or `code` (`exchangeCodeForSession`) →
   redirect to `/`, else `/login?error=confirmation_failed`.
4. **Sign in / out:** `login` (`signInWithPassword`) → `/`, which reads the caller's profile and shows
   "Hi @username 👋" (AC-4); "Sign out" posts `logout` → `signOut` → `/login` (AC-5).
5. **Data access:** server code uses `await createClient()` from `src/lib/supabase/server.ts`, so every query runs as
   the signed-in user and RLS decides visibility (architecture §6; AC-6…AC-11).
6. **Places:** `GET /api/places?q=&lat=&lng=` checks `getClaims()` (401 without a session; in practice the proxy
   redirects first, AC-12), returns `{ suggestions: [] }` for `q` shorter than 2 characters without calling Google
   (AC-13), otherwise calls Places Autocomplete (New) with the server-only key, types restaurant/cafe/bar/bakery and
   an optional 20 km location bias, and maps results to `{ placeId, name, address }` (502 on Google failure).
7. **PWA:** `src/app/manifest.ts` serves `/manifest.webmanifest` with name "Mordomia" (AC-14).

## Key files
| File | Role |
|---|---|
| `src/proxy.ts`, `src/lib/supabase/proxy.ts` | session refresh + redirect to `/login` |
| `src/lib/supabase/server.ts` / `client.ts` | Supabase clients (server, per request / browser) |
| `src/lib/validation/username.ts` | `normalizeUsername`, `isValidUsername` |
| `src/app/login/page.tsx`, `src/app/login/actions.ts` | auth UI; `login`, `signup`, `logout` server actions |
| `src/app/auth/confirm/route.ts` | email confirmation link target |
| `src/app/page.tsx` | signed-in home ("Hi @username") |
| `src/app/api/places/route.ts` | Google Places autocomplete proxy |
| `src/app/manifest.ts` | PWA manifest |
| `supabase/migrations/20260929000000_init.sql` | schema, triggers, `are_friends`, RLS, storage bucket + policies |
| `supabase/config.toml` | local Supabase config (local email confirmations off, `minimum_password_length = 6`) |
| `vitest.config.ts` | Vitest: jsdom, React plugin, tsconfig paths, `src/**/*.test.{ts,tsx}` |
| `playwright.config.ts` | Playwright: `tests/e2e`, Pixel 7 (Chromium), dev server on port 3100, env from `.env.test` |
| `tests/e2e/helpers/users.ts` | `createConfirmedUser()` / `deleteUser()` via the Supabase admin API (service role key) |
| `.env.test.example` | template for the git-ignored `.env.test` |

## Rules & invariants
- "want" entries are readable only by their owner; "went" entries by the owner and accepted friends (RLS).
  **Until 001 lands, the friendships update policy lets this be bypassed (gap 1).**
- Ratings exist only on "went" entries (table check constraint).
- One friendship row per pair (unique index on least/greatest); requests are inserted as `pending` by the requester;
  only the addressee may update, and only to `accepted`.
- Photos live at `entry-photos/{user_id}/{entry_id}/{file}` and are meant to be visible only when their entry is.
  **Until 001 lands, the `entry_photos` insert policy does not bind `storage_path` to that prefix (gap 2).**
- `GOOGLE_PLACES_API_KEY` never reaches the browser; `/api/places` requires a session.
- Usernames are stored trimmed and lowercased and match `^[a-z0-9_]{3,24}$` (app check + DB check).

## Key decisions
See the Decisions log in `requirements.md`: audience and privacy (#1, #5, #6), platform (#2), Google Places (#3),
email + password (#7), stack and hosting (#8, #10), testing on local Supabase (#11), closing 000 with known gaps and
fixing them in 001 (#14–16).
Technical: username validation extracted for unit testing; Playwright uses port 3100 so it does not collide with a
dev server on 3000 (design.md, Technical decisions).

## Tests
Run everything with `npm run check` (lint → typecheck → Vitest → pgTAP → Playwright → build). Needs local Supabase
(`npx supabase start`, Docker Desktop running) and a filled-in `.env.test`.

| AC | Type | File |
|---|---|---|
| AC-1 | Playwright | `tests/e2e/auth.spec.ts` (only `/` is tested, see gap 5) |
| AC-2 | Vitest + Playwright | `src/lib/validation/username.test.ts`, `tests/e2e/auth.spec.ts` |
| AC-3 | pgTAP | `supabase/tests/profiles.test.sql` |
| AC-4, AC-5 | Playwright | `tests/e2e/auth.spec.ts` |
| AC-6, AC-7, AC-8, AC-9 | pgTAP | `supabase/tests/entries_rls.test.sql` (owner / accepted friend / pending / stranger) |
| AC-10 | pgTAP | `supabase/tests/friendships_rls.test.sql` (does not cover rewriting ids on accept, see gap 1) |
| AC-11 | pgTAP | `supabase/tests/photos_rls.test.sql` (does not cover foreign `storage_path`, see gap 2) |
| AC-12, AC-13 | Playwright | `tests/e2e/places.spec.ts` |
| AC-14 | Playwright | `tests/e2e/pwa.spec.ts` |

Tooling notes:
- pgTAP files are `supabase/tests/*.test.sql`, each in a transaction that rolls back; users are created by inserting
  into `auth.users` (fires the profile trigger) and impersonated with `set local role authenticated` +
  `set local request.jwt.claims`.
- `playwright.config.ts` loads `.env.test` with `process.loadEnvFile` and **throws if the file is missing**
  (copy `.env.test.example`, fill it from `npx supabase status`). The e2e helper needs `SUPABASE_SERVICE_ROLE_KEY`
  to create confirmed users; it is used only by tests, never by the app.
- `@types/node` is `^24` (matches Node 24 and provides `process.loadEnvFile` types); `@playwright/test` is a dev dependency.
- Git-ignored: `.env*` except the two examples, `supabase/.temp`, `supabase/.branches`, `test-results/`,
  `playwright-report/`, `blob-report/`, `playwright/.cache/`.
- On the dev Mac the `docker` CLI lives in `~/.docker/bin`; add it to `PATH` so the Supabase CLI finds it.

## Known gaps (fixed in 001)
These were found by the 000 review and accepted by the user (Decisions log #14–16). Feature 001 (security hardening)
fixes them with a **new** migration (the init migration is applied and must not be edited) plus tests.

1. **[blocker] Friendship forgery on accept.** `supabase/migrations/20260929000000_init.sql:201-204`, policy
   `friendships: addressee accepts`, only checks `addressee_id = auth.uid()` and `status = 'accepted'`. The addressee
   can change `requester_id` while accepting, creating an accepted friendship with a user who never consented, and then
   read that user's `went` entries and photos. Breaks AC-7 and AC-10.
   Fix: make `requester_id` / `addressee_id` immutable on update + pgTAP test.
2. **[major] Photo path not bound to owner/entry.** `init.sql:184-188`, policy `entry_photos: insert own` (together with
   the storage read policy at `init.sql:222-229`), does not require `storage_path` to start with
   `{auth.uid()}/{entry_id}/`. A user can register another user's orphaned or not-yet-registered file under their own
   entry, exposing it to their friends, or squat a path (`storage_path` is unique). Weakens AC-11.
   Fix: WITH CHECK on the path prefix + pgTAP test.
3. **[minor] Friend graph readable via `are_friends`.** `init.sql:128-141`: `public.are_friends(a, b)` is
   SECURITY DEFINER and executable by PUBLIC/anon for any pair. The user decided the friend graph is private (#15).
   Fix: revoke execute from `anon`/`public`, and only answer checks that involve `auth.uid()`.
4. **[minor] Password length only enforced in the browser.** `src/app/login/actions.ts:28-30` does not check
   password ≥ 8 (only `minLength={8}` on the input), and `supabase/config.toml:181` has `minimum_password_length = 6`.
   Fix: validate in the server action and raise the Supabase minimum to 8.
5. **[minor] AC-1 coverage.** `tests/e2e/auth.spec.ts:14-18` only tests `/`. Fix: also assert a non-root path redirects.
6. **[minor] Proxy matcher too broad.** `src/proxy.ts:11` excludes every path starting with `icon` or `apple-icon`
   (e.g. `/icons-anything` skips the auth redirect). Fix: exclude the exact icon routes only.
7. **[minor] Local settings tracked.** `.claude/settings.local.json` is committed. Fix: add it to `.gitignore` and
   untrack it.

## Known limitations / follow-ups
- No password reset UI (out of scope for 000).
- Signed-out calls to `/api/places` get a 307 to `/login` from the proxy rather than the route's 401.
- Local Supabase has email confirmations disabled (`[auth.email] enable_confirmations = false`), so local sign-ups
  are signed in without clicking the email link; hosted Supabase uses its own setting.
- The public-path check in `src/lib/supabase/proxy.ts` is a prefix match (`startsWith("/login")`,
  `startsWith("/auth")`), so any future route beginning with those strings (e.g. `/authors`) would be public.
  Harmless today (no such routes); scheduled for 001 (Decision #17): match `/login`, `/auth` and `/auth/*` exactly.
- Supabase free projects pause after 7 idle days.
