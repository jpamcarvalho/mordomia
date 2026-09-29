# 000 · Foundation

> Explanation of the foundation **as built** (2026-09-29). Test sections will be completed after /review.
> Agents: read this before touching auth, the Supabase clients, the proxy, the schema/RLS or the Places route.

## What it does
Gives Mordomia accounts (email + password + username), protects every page behind sign-in, stores data in Supabase
with privacy rules in the database, and offers a server-side Google Places search that later features use to add restaurants.

## How it works
1. **Request:** every non-static request passes through `src/proxy.ts` → `updateSession()` (`src/lib/supabase/proxy.ts`),
   which refreshes the Supabase session cookie with `getClaims()` and redirects signed-out users to `/login`.
2. **Sign up:** `/login` (client component) calls the `signup` server action → validates the username →
   `supabase.auth.signUp` with `data: { username }` → the DB trigger `handle_new_user` creates the `profiles` row →
   Supabase emails a link to `/auth/confirm` → `verifyOtp` sets the session → `/`.
3. **Sign in / out:** `login` server action (`signInWithPassword`) → `/`; `logout` → `signOut` → `/login`.
4. **Data access:** server code uses `await createClient()` from `src/lib/supabase/server.ts`; every query runs as the
   signed-in user, so RLS decides what is visible (see architecture §6).
5. **Places search:** `GET /api/places?q=` checks the session, calls Google Places Autocomplete (New) with the
   server-only key, and returns `{ suggestions: [{ placeId, name, address }] }`.

## Key files
| File | Role |
|---|---|
| `src/proxy.ts`, `src/lib/supabase/proxy.ts` | session refresh + auth redirect |
| `src/lib/supabase/server.ts` / `client.ts` | Supabase clients (server per request / browser) |
| `src/app/login/page.tsx`, `actions.ts` | auth UI and server actions |
| `src/app/auth/confirm/route.ts` | email confirmation |
| `src/app/api/places/route.ts` | Google Places autocomplete proxy |
| `supabase/migrations/20260929000000_init.sql` | schema, triggers, RLS, storage bucket + policies |

## Rules & invariants
- "want" entries are readable only by their owner, and "went" entries only by the owner and accepted friends, enforced by RLS.
- Ratings exist only on "went" entries (DB check).
- One friendship row per pair; only the addressee can accept.
- Photos live at `entry-photos/{user_id}/{entry_id}/{file}` and are visible only when their entry is.
- `GOOGLE_PLACES_API_KEY` never reaches the browser.

## Key decisions
See the Decisions log in `requirements.md` (audience, platform, Google Places, privacy, auth, stack).

## Tests
Pending: see `tasks.md` (pgTAP, Vitest, Playwright).

## Known limitations / follow-ups
- No password reset UI yet.
- `/api/places` redirects (307) instead of returning 401 when signed out, because the proxy catches it first.
- Supabase free projects pause after 7 idle days.
