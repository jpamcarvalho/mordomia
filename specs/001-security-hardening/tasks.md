# 001 · Security hardening — Tasks

> Written by: architect · Executed by: implementer (tick each box and commit after finishing a task)
> Each task: small, independently verifiable, lists files and the AC ids it satisfies.
> Commit message per task: `feat(001): task N - <summary>`.
> Prerequisites: Docker Desktop running, `npx supabase start`, filled-in `.env.test`; `PATH` includes
> `~/.local/node/bin` and `~/.docker/bin` (architecture §10).
> Never edit `supabase/migrations/20260929000000_init.sql` or the existing 000 test files.

- [ ] **Task 1 — Friendship update guard (migration + pgTAP)**
  - Files: `supabase/migrations/20260929100000_friendships_update_guard.sql`,
    `supabase/tests/friendships_update_guard.test.sql`
  - AC: AC-1, AC-2, AC-3, AC-4
  - Do: create `public.friendships_guard_update()` and the `BEFORE UPDATE` trigger exactly as in design.md → Data model;
    write the pgTAP file covering every AC-1…AC-4 row of the design test plan (header comment lists the 001 AC ids).
  - Done when: `npx supabase db reset` applies the migration without errors, and `npm run test:db` passes, including the
    new file and the unchanged `friendships_rls.test.sql`, `entries_rls.test.sql`, `photos_rls.test.sql`,
    `profiles.test.sql`.

- [ ] **Task 2 — Bind `entry_photos.storage_path` to owner and entry (migration + pgTAP)**
  - Files: `supabase/migrations/20260929100100_entry_photos_path_binding.sql`,
    `supabase/tests/photos_path_binding.test.sql`
  - AC: AC-5, AC-6, AC-7
  - Do: drop and recreate policy `entry_photos: insert own` as in design.md; write the pgTAP file covering the AC-5,
    AC-6, AC-7 rows of the test plan (valid path, each invalid path shape, foreign-folder paths, no read leak to the
    attacker's friend, victim can still register the path, own-folder uploads anywhere, foreign upload rejected).
  - Done when: `npx supabase db reset` succeeds and `npm run test:db` passes (new file + all existing files).

- [ ] **Task 3 — Private `are_friends` (migration + pgTAP)**
  - Files: `supabase/migrations/20260929100200_are_friends_private.sql`,
    `supabase/tests/are_friends_privacy.test.sql`
  - AC: AC-8, AC-9, AC-10
  - Do: `create or replace` `public.are_friends` and revoke/grant `EXECUTE` as in design.md; write the pgTAP file
    covering the AC-8, AC-9, AC-10 rows (anon denied + ACL checks, stranger gets `false` not `null`, caller-involved
    pairs return the real result, friend still reads `went` but not `want`).
  - Done when: `npx supabase db reset` succeeds and `npm run test:db` passes (new file + all existing files, in
    particular `entries_rls.test.sql` and `photos_rls.test.sql` unchanged).

- [ ] **Task 4 — Server-side password length check**
  - Files: `src/lib/validation/password.ts`, `src/lib/validation/password.test.ts`, `src/app/login/actions.ts`,
    `src/app/login/page.tsx`, `tests/e2e/helpers/users.ts`, `tests/e2e/auth.spec.ts`
  - AC: AC-11
  - Do: add `MIN_PASSWORD_LENGTH` / `isValidPassword`; in `signup` return
    `{ error: "Password must be at least 8 characters." }` after the username check and before any Supabase call;
    use `MIN_PASSWORD_LENGTH` for the input's `minLength`; add `findUserByEmail` to the e2e helper; add the Vitest file
    and the Playwright test "AC-11 (001): …" (removes `minlength`, submits a 7-character password, sees the message,
    `findUserByEmail` returns `null`; deletes the user in cleanup if one was unexpectedly created).
  - Done when: `npm test`, `npm run typecheck`, `npm run lint` pass, and `npx playwright test tests/e2e/auth.spec.ts`
    passes (new test and the existing AC-1/2/4/5 tests).

- [ ] **Task 5 — Supabase minimum password length 8**
  - Files: `supabase/config.toml`, `tests/e2e/auth.spec.ts`
  - AC: AC-12
  - Do: set `[auth] minimum_password_length = 8`; restart local Supabase (`npx supabase stop && npx supabase start`);
    add the Playwright test "AC-12 (001): …" that calls `auth.signUp` directly with the publishable key and a valid
    `data.username`: 7 characters → `error.code === "weak_password"`; 8 characters → success, then `deleteUser`.
  - Done when: `npx playwright test tests/e2e/auth.spec.ts` passes after the restart.

- [ ] **Task 6 — Exact public paths in the proxy + non-root redirect coverage**
  - Files: `src/lib/auth/public-paths.ts`, `src/lib/auth/public-paths.test.ts`, `src/lib/supabase/proxy.ts`,
    `tests/e2e/proxy.spec.ts`
  - AC: AC-13, AC-14
  - Do: add `isPublicPath` as in design.md and use it in `updateSession` (remove `PUBLIC_PATHS`); add the Vitest file;
    create `tests/e2e/proxy.spec.ts` with the AC-13 and AC-14 signed-out tests (small local helper asserting
    "3xx with `location` pathname `/login`").
  - Done when: `npm test`, `npm run typecheck`, `npm run lint` pass, and `npx playwright test tests/e2e/proxy.spec.ts`
    passes.

- [ ] **Task 7 — Exact icon/PWA exclusions in the proxy matcher**
  - Files: `src/proxy.ts`, `src/proxy.test.ts`, `tests/e2e/proxy.spec.ts`
  - AC: AC-15
  - Do: replace the matcher with the one in design.md → Proxy matcher and update its comment; add `src/proxy.test.ts`
    (`// @vitest-environment node`, `unstable_doesMiddlewareMatch` with the imported `config`) with the true/false
    cases from the test plan; add the AC-15 signed-out Playwright tests to `tests/e2e/proxy.spec.ts`.
  - Done when: `npm test`, `npm run typecheck`, `npm run lint` pass, and `npx playwright test tests/e2e/proxy.spec.ts
    tests/e2e/pwa.spec.ts` passes.

- [ ] **Task 8 — Stop tracking local Claude settings**
  - Files: `.gitignore`, `.claude/settings.local.json` (untracked only, not deleted)
  - AC: AC-16
  - Do: add `/.claude/settings.local.json` to `.gitignore`; run `git rm --cached .claude/settings.local.json`.
  - Done when: `git ls-files .claude/settings.local.json` prints nothing, `git check-ignore .claude/settings.local.json`
    prints the path, and `test -f .claude/settings.local.json` succeeds.

- [ ] **Task 9 — Full check**
  - Files: none (fix anything that fails in the task that introduced it, then re-run)
  - AC: AC-1 … AC-16
  - Do: `npx supabase db reset` (fresh DB with all migrations), then `npm run check`.
  - Done when: `npm run check` (lint → typecheck → Vitest → pgTAP → Playwright → build) passes end to end with no
    skipped tests, and the Task 8 git checks still hold. Commit only if something changed.
