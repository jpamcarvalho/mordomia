# 000 · Foundation — Tasks

> Executed by: implementer. Tick each box and commit after finishing a task.
> Prerequisites: Docker Desktop running, git available (`xcode-select --install`), `npx supabase start` works.

- [x] **Task 1 — git baseline**
  - Files: repository root
  - AC: none (infrastructure)
  - Done when: `git init -b main`; everything currently in the folder committed as `chore: initial scaffold and spec workflow`; `.env*` (except `.env.example`, `.env.test.example`) not tracked.
- [x] **Task 2 — test tooling**
  - Files: `package.json`, `vitest.config.ts`, `playwright.config.ts`, `.env.test.example`, `.gitignore`, `supabase/tests/.gitkeep`, `tests/e2e/helpers/users.ts`
  - AC: none (infrastructure)
  - Done when: deps from design.md installed, `npx playwright install chromium` done, scripts `typecheck`, `test`, `test:db`, `test:e2e`, `check` exist, and each runner starts (it may report "no tests").
- [ ] **Task 3 — username validation + unit tests**
  - Files: `src/lib/validation/username.ts`, `src/lib/validation/username.test.ts`, `src/app/login/actions.ts`
  - AC: AC-2
  - Done when: `npm test` passes; signup uses the helper; behavior unchanged.
- [ ] **Task 4 — pgTAP: profiles + entries RLS**
  - Files: `supabase/tests/profiles.test.sql`, `supabase/tests/entries_rls.test.sql`
  - AC: AC-3, AC-6, AC-7, AC-8, AC-9
  - Done when: `npm run test:db` passes.
- [ ] **Task 5 — pgTAP: friendships + photos RLS**
  - Files: `supabase/tests/friendships_rls.test.sql`, `supabase/tests/photos_rls.test.sql`
  - AC: AC-10, AC-11
  - Done when: `npm run test:db` passes.
- [ ] **Task 6 — Playwright: auth, places, PWA**
  - Files: `tests/e2e/auth.spec.ts`, `tests/e2e/places.spec.ts`, `tests/e2e/pwa.spec.ts`
  - AC: AC-1, AC-2, AC-4, AC-5, AC-12, AC-13, AC-14
  - Done when: `npm run test:e2e` passes.
- [ ] **Task 7 — full check**
  - Files: none new
  - AC: all
  - Done when: `npm run check` passes end to end.
