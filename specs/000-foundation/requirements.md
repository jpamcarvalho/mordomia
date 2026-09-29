# 000 · Foundation — Requirements

> Status: implementing (code scaffolded 2026-09-29; test tooling + tests pending)
> Written by: main session from the 2026-09-29 grill-me sessions · Approved by user on: 2026-09-29

## Summary
The base every feature builds on: a mobile-first Next.js web app, Supabase accounts with email + password, the
database schema with privacy enforced by row-level security, a server-side Google Places search, and the test tooling
that every later feature uses.

## User stories
- As a new user, I want to create an account with email, password and a username so my friends can find me.
- As a user, I want to sign in and out.
- As a user, I want my "want to go" list to stay private while friends can see where I went.
- As the developer, I want automated tests (DB, unit, e2e) so agents can prove features work.

## Acceptance criteria
- **AC-1**: WHEN a signed-out visitor requests any app page other than `/login` or `/auth/*`, THE SYSTEM SHALL redirect them to `/login`.
- **AC-2**: WHEN a user submits sign-up with a username not matching `^[a-z0-9_]{3,24}$` (after lowercasing and trimming), THE SYSTEM SHALL reject it with the message "Username must be 3–24 characters: letters, numbers or _."
- **AC-3**: WHEN a user signs up with a valid username, THE SYSTEM SHALL create a `profiles` row with that username (lowercased).
- **AC-4**: WHEN a user signs in with valid credentials, THE SYSTEM SHALL take them to `/`, which greets them by `@username`.
- **AC-5**: WHEN a signed-in user presses "Sign out", THE SYSTEM SHALL end the session and show `/login`.
- **AC-6**: THE SYSTEM SHALL let only the owner read their `want` entries.
- **AC-7**: THE SYSTEM SHALL let the owner and accepted friends (not pending, not strangers) read `went` entries.
- **AC-8**: THE SYSTEM SHALL let users create, update and delete only their own entries.
- **AC-9**: THE SYSTEM SHALL reject a rating on an entry whose status is `want`.
- **AC-10**: THE SYSTEM SHALL allow a friendship request only as `pending` from the requester, acceptance only by the addressee, and at most one friendship row per pair of users.
- **AC-11**: THE SYSTEM SHALL let a user read an entry photo only if they can read its entry, and upload only into their own `{user_id}/` storage folder.
- **AC-12**: IF `/api/places` is called without a session THEN THE SYSTEM SHALL not return Google results (redirect or 401).
- **AC-13**: WHEN `/api/places` is called with a query shorter than 2 characters, THE SYSTEM SHALL return `{ suggestions: [] }` without calling Google.
- **AC-14**: THE SYSTEM SHALL serve a PWA manifest named "Mordomia" at `/manifest.webmanifest`.

## Privacy & permissions
See AC-6 to AC-11 and `docs/architecture.md` §6.

## UI & copy
- `/login`: title "Mordomia"; sign-in / sign-up toggle ("No account? Sign up" / "Have an account? Sign in");
  sign-up success message "Check your email to confirm your account."
- `/`: "Hi @username 👋" and a "Sign out" link.

## Out of scope
Adding restaurants, lists, map, friends UI, photos UI, profile editing, password reset UI. These come in later features.

## Decisions log
| # | Question | Answer | Date |
|---|---|---|---|
| 1 | Who uses v1? | Me and invited friends (not public) | 2026-09-29 |
| 2 | Platform | Mobile-first web app; maybe App Store later | 2026-09-29 |
| 3 | Restaurant data source | Google Places search | 2026-09-29 |
| 4 | Entry contents | Rating, notes, optional photos, status "I want to go" / "I went" | 2026-09-29 |
| 5 | What friends see | Friends see "went" only; "want to go" hidden | 2026-09-29 |
| 6 | Friendship model | Request + accept (mutual) | 2026-09-29 |
| 7 | Sign-in | Email + password | 2026-09-29 |
| 8 | Stack | Next.js + Supabase | 2026-09-29 |
| 9 | Views | List + map | 2026-09-29 |
| 10 | Hosting | Free tiers (Vercel, Supabase, Google credit) | 2026-09-29 |
| 11 | Testing | Vitest + Playwright + RLS tests on local Supabase (Docker Desktop) | 2026-09-29 |
| 12 | Git | Commit per task directly to main | 2026-09-29 |
| 13 | Language | English everywhere | 2026-09-29 |
| 14 | Review found RLS holes (addressee can rewrite `requester_id` on accept; `entry_photos.storage_path` not bound to `{auth.uid()}/{entry_id}/`) but the design freezes the migration. Fix in 000 or separately? | Close 000 with known gaps; fix in a separate security-hardening feature 001 | 2026-09-29 |
| 15 | Should the friendship graph be private (`are_friends()` callable by anon for any pair)? | Private: only checks involving the caller; fix in 001 | 2026-09-29 |
| 16 | Minor review findings (server-side password ≥ 8, AC-1 test on a non-root path, proxy `icon` matcher prefix, `.claude/settings.local.json` tracked) | All go into 001 | 2026-09-29 |
| 17 | Public-path prefix match in `src/lib/supabase/proxy.ts:41` (`/authors` would be public) — found by architect in Mode B | Add to 001: match `/login`, `/auth` and `/auth/*` exactly | 2026-09-29 |
