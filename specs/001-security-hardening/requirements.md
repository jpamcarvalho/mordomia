# 001 · Security hardening — Requirements

> Status: draft
> Written by: main session via grill-me · Approved by user on: 2026-09-29

## Summary
The 000-foundation review found privacy holes in the database rules and a few smaller security/test gaps
(000 README → "Known gaps", 000 Decisions log #14–17). The user closed 000 with those gaps and scheduled every fix here.
This feature closes them with a **new** migration (the applied init migration is never edited), server-side validation,
tighter proxy path matching, and tests that prove each fix. No new screens or product behavior.

## User stories
- As a user, I want only people I actually accepted to be my friends, so that nobody can read my "went" entries
  without my consent.
- As a user, I want my photo files to be exposed only through my own entries, so that no one can publish my files to
  their friends or block my photo paths.
- As a user, I want who I'm friends with to stay private, so that others can't map my friend graph.
- As a user, I want sign-up to reject weak passwords even if the browser check is bypassed.
- As the developer, I want pages to require sign-in by default, so that new routes can't become public by accident.

## Acceptance criteria

### Friendships (000 gap 1)
- **AC-1** — WHEN any user updates a `friendships` row THE SYSTEM SHALL reject the update if it changes
  `requester_id`, `addressee_id` or `created_at`.
- **AC-2** — WHEN the addressee updates a `friendships` row THE SYSTEM SHALL only allow `status` to change from
  `pending` to `accepted`; any other status change SHALL be rejected.
- **AC-3** — IF a user who is not the addressee tries to update a `friendships` row THEN THE SYSTEM SHALL reject it
  (unchanged from 000, re-tested).
- **AC-4** — WHEN an addressee accepts a request from C while also trying to set `requester_id` to another user V
  THE SYSTEM SHALL reject it, and the addressee SHALL still be unable to read V's `went` entries and photos.

### Photo paths (000 gap 2)
- **AC-5** — WHEN a user inserts an `entry_photos` row THE SYSTEM SHALL require `storage_path` to be exactly
  `{auth.uid()}/{entry_id}/{filename}`, where `entry_id` is the row's own `entry_id`, and `filename` is non-empty and
  contains no `/`; otherwise the insert SHALL be rejected.
- **AC-6** — IF a user inserts an `entry_photos` row whose `storage_path` lies in another user's folder THEN THE SYSTEM
  SHALL reject it, and that user's friends SHALL NOT gain read access to the file.
- **AC-7** — Storage uploads SHALL keep the 000 rule: allowed anywhere under the uploader's own folder `{uid}/…`
  (unchanged, re-tested).

### Friend graph privacy (000 gap 3)
- **AC-8** — IF an unauthenticated (`anon`) caller invokes `are_friends` THEN THE SYSTEM SHALL deny execution.
- **AC-9** — WHEN a signed-in user invokes `are_friends(a, b)` where neither `a` nor `b` is `auth.uid()` THE SYSTEM
  SHALL return `false`, regardless of the real friendship.
- **AC-10** — WHEN a signed-in user invokes `are_friends(a, b)` where `a` or `b` is `auth.uid()` THE SYSTEM SHALL return
  the real accepted-friendship result, and all 000 read rules (entries/photos for accepted friends) SHALL keep working.

### Password (000 gap 4)
- **AC-11** — IF sign-up is submitted with a password shorter than 8 characters THEN THE SYSTEM SHALL reject it on the
  server with the message "Password must be at least 8 characters." and not create an account.
- **AC-12** — THE SYSTEM SHALL configure local Supabase auth with a minimum password length of 8.

### Proxy / auth redirect (000 gaps 5, 6 and Decision #17)
- **AC-13** — WHEN a signed-out user requests a non-root app path (e.g. `/anything`) THE SYSTEM SHALL redirect to
  `/login` (extends 000 AC-1 test coverage).
- **AC-14** — THE SYSTEM SHALL treat as public only `/login`, `/auth` and paths under `/auth/`; paths that merely start
  with those strings (e.g. `/login-help`, `/authors`) SHALL require sign-in.
- **AC-15** — THE SYSTEM SHALL exclude from the proxy only the exact icon/PWA routes that exist; paths that merely
  start with `icon` or `apple-icon` (e.g. `/iconic`) SHALL require sign-in.

### Repository hygiene (000 gap 7)
- **AC-16** — `.claude/settings.local.json` SHALL be listed in `.gitignore` and removed from git tracking (the local
  file stays on disk).

## Privacy & permissions
- `friendships`: only the addressee may update, only `status`, only `pending → accepted`; ids and `created_at` are
  immutable for everyone. Insert/delete rules unchanged from 000.
- `entry_photos`: insert only on own entry with path `{auth.uid()}/{entry_id}/{filename}`. Read/delete unchanged.
- `are_friends`: not executable by `anon`/`public`; for signed-in users answers only about pairs that include the
  caller, otherwise `false`.
- Storage `entry-photos`: unchanged (own-folder upload/delete; read own folder or path in a readable `entry_photos` row).
- All enforced in the database (new migration), never only in the UI.

## UI & copy
- No new screens. Only new copy: sign-up error **"Password must be at least 8 characters."**

## Out of scope
- Cleaning up existing violating data (nothing is deployed; local only).
- Tightening storage uploads to require an existing own entry.
- Vitest config warnings (CommonJS config load; `vite-tsconfig-paths` → `resolve.tsconfigPaths`).
- Password reset, any new product feature.

## Decisions log
| # | Question | Answer | Date |
|---|---|---|---|
| 1 | Scope origin | All 000 known gaps 1–7 plus proxy public-path prefix match (000 Decisions #14–17) | 2026-09-29 |
| 2 | Feature id / slug | `001-security-hardening` | 2026-09-29 |
| 3 | Is there a hosted Supabase project with real data? | No, local only — migration adds rules, no data cleanup | 2026-09-29 |
| 4 | What may the addressee change when accepting? | Only `status`, only `pending → accepted`; `requester_id`, `addressee_id`, `created_at` immutable on every update | 2026-09-29 |
| 5 | `are_friends(a, b)` called by a signed-in user when neither arg is themselves | Return `false`; `anon` loses execute entirely | 2026-09-29 |
| 6 | Exact `entry_photos.storage_path` format on insert | `{auth.uid()}/{entry_id}/{filename}`, non-empty filename, no further `/` | 2026-09-29 |
| 7 | Tighten storage upload rule too? | No — keep own-folder rule | 2026-09-29 |
| 8 | Server-side short-password error text | "Password must be at least 8 characters." | 2026-09-29 |
| 9 | Include Vitest config warnings? | Out of scope | 2026-09-29 |
