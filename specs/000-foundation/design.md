# 000 · Foundation — Design

> Written by: main session (documents the existing scaffold) · Approved by user on: 2026-09-29

## Overview
Already built: see `docs/architecture.md` §3–§9 for structure, conventions, data model, RLS, auth flow and the
Places proxy. What remains is the **test tooling** and the **foundation tests** that prove AC-1…AC-14.

## Data model / RLS / Server / UI
Implemented in `supabase/migrations/20260929000000_init.sql`, `src/proxy.ts`, `src/lib/supabase/*`,
`src/app/login/*`, `src/app/auth/confirm/route.ts`, `src/app/api/places/route.ts`, `src/app/page.tsx`,
`src/app/manifest.ts`. No changes are planned, except extracting username validation so it can be unit tested (Task 3).

## Test tooling
- **pgTAP:** `supabase/tests/*.test.sql`, run by `npx supabase test db` (local Supabase). Tests impersonate users with
  `set local role authenticated` + `set local request.jwt.claims` (sub = user id), inside a transaction that rolls back.
  Users are created by inserting into `auth.users` with `raw_user_meta_data` `{"username": …}` (fires the profile trigger).
- **Vitest:** `vitest.config.ts` (environment `jsdom`, plugin `@vitejs/plugin-react`, `@/` alias, include
  `src/**/*.test.{ts,tsx}`). Deps: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`,
  `@testing-library/dom`, `vite-tsconfig-paths`.
- **Playwright:** `playwright.config.ts`, `testDir: tests/e2e`, one project using the `Pixel 7` device on Chromium,
  `webServer: npm run dev` on port 3100 with env from `.env.test`. Sign-in tests create a confirmed user through the
  local Supabase admin API (service role key from `npx supabase status`), in a helper `tests/e2e/helpers/users.ts`.
- **Env:** `.env.test` (git-ignored) holds the local Supabase URL/keys; `.env.test.example` is committed.
  Local Supabase auth: email confirmations may stay enabled; e2e users are created already confirmed via the admin API.
- **Scripts:** `typecheck` = `tsc --noEmit`; `test` = `vitest run`; `test:db` = `supabase test db`;
  `test:e2e` = `playwright test`; `check` = lint → typecheck → test → test:db → test:e2e → build.

## Test plan
| AC | Type | File | Proves |
|---|---|---|---|
| AC-1 | Playwright | `tests/e2e/auth.spec.ts` | `/` redirects to `/login` when signed out |
| AC-2 | Vitest | `src/lib/validation/username.test.ts` | invalid usernames rejected, valid accepted (case/trim) |
| AC-2 | Playwright | `tests/e2e/auth.spec.ts` | sign-up form shows the error message |
| AC-3 | pgTAP | `supabase/tests/profiles.test.sql` | inserting auth user creates lowercase profile |
| AC-4, AC-5 | Playwright | `tests/e2e/auth.spec.ts` | sign in → "Hi @user", sign out → /login |
| AC-6, AC-7 | pgTAP | `supabase/tests/entries_rls.test.sql` | owner / accepted friend / pending friend / stranger visibility of want & went |
| AC-8 | pgTAP | `supabase/tests/entries_rls.test.sql` | cannot insert/update/delete another user's entry |
| AC-9 | pgTAP | `supabase/tests/entries_rls.test.sql` | rating on `want` violates check constraint |
| AC-10 | pgTAP | `supabase/tests/friendships_rls.test.sql` | pending-only insert, addressee-only accept, no duplicate pair |
| AC-11 | pgTAP | `supabase/tests/photos_rls.test.sql` | entry_photos & storage.objects visibility and own-folder upload |
| AC-12 | Playwright | `tests/e2e/places.spec.ts` | signed-out request does not get suggestions |
| AC-13 | Playwright | `tests/e2e/places.spec.ts` | signed-in, `q=a` → `{ suggestions: [] }` |
| AC-14 | Playwright | `tests/e2e/pwa.spec.ts` | manifest served with name "Mordomia" |

## Technical decisions
- Username validation moves to `src/lib/validation/username.ts` (`normalizeUsername`, `isValidUsername`), used by
  `src/app/login/actions.ts`; behavior unchanged.
- Playwright port 3100 so it doesn't collide with a running `npm run dev` on 3000.

## Risks & notes
- Requires Docker Desktop running and git (Xcode Command Line Tools) before implementation.
