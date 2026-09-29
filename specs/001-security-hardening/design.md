# 001 · Security hardening — Design

> Written by: architect · Based on: requirements.md (approved 2026-09-29) · Approved by user on: YYYY-MM-DD

## Overview
Closes the seven 000 known gaps (`specs/000-foundation/README.md` → "Known gaps") without adding product behavior.

- **Database (gaps 1–3):** three **new** migrations, one per gap, applied after
  `supabase/migrations/20260929000000_init.sql` (which is never edited):
  a `BEFORE UPDATE` trigger that freezes friendship ids / `created_at` and only allows `pending → accepted`;
  a replaced `entry_photos` insert policy that binds `storage_path` to `{auth.uid()}/{entry_id}/{filename}`;
  and a replaced `are_friends` that only answers about pairs including the caller, with `EXECUTE` revoked from
  `anon`/`PUBLIC`. Each migration ships with its own pgTAP file.
- **App (gaps 4–6 + Decision #17):** a pure password validator used by the `signup` server action; Supabase local
  `minimum_password_length = 8`; a pure `isPublicPath()` helper replacing the prefix match in
  `src/lib/supabase/proxy.ts`; exact exclusions in the `src/proxy.ts` matcher.
- **Repo (gap 7):** ignore and untrack `.claude/settings.local.json`.

Relies on architecture §4 (conventions: validation on the server, pure logic in `src/lib/**`), §6 (RLS model),
§7 (auth flow / proxy) and §10 (test patterns).

## Data model
No tables, columns, enums or indexes change. New files (timestamps sort after the init migration):

| Migration | Gap | Content |
|---|---|---|
| `supabase/migrations/20260929100000_friendships_update_guard.sql` | 1 | function `public.friendships_guard_update()` + trigger `friendships_guard_update` |
| `supabase/migrations/20260929100100_entry_photos_path_binding.sql` | 2 | drop + recreate policy `entry_photos: insert own` |
| `supabase/migrations/20260929100200_are_friends_private.sql` | 3 | `create or replace function public.are_friends` + grants |

### `20260929100000_friendships_update_guard.sql` (AC-1, AC-2, AC-4)
```sql
create function public.friendships_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.requester_id is distinct from old.requester_id
     or new.addressee_id is distinct from old.addressee_id
     or new.created_at is distinct from old.created_at then
    raise exception 'friendships: requester_id, addressee_id and created_at cannot be changed'
      using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and not (old.status = 'pending' and new.status = 'accepted') then
    raise exception 'friendships: status can only change from pending to accepted'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger friendships_guard_update
  before update on public.friendships
  for each row execute function public.friendships_guard_update();
```
- `SECURITY INVOKER` (default): the trigger reads only `old`/`new`.
- Applies to every role (authenticated, service_role, postgres), matching "immutable for everyone".
- The existing policy `friendships: addressee accepts` stays as is: it still restricts updates to the addressee
  (AC-3) and requires the new status to be `accepted`.

### `20260929100100_entry_photos_path_binding.sql` (AC-5, AC-6)
```sql
drop policy "entry_photos: insert own" on public.entry_photos;

create policy "entry_photos: insert own" on public.entry_photos
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid()))
    and storage_path ~ ('^' || (select auth.uid())::text || '/' || entry_id::text || '/[^/]+$')
  );
```
- uuids render as `[0-9a-f-]`, so concatenating them into the regex needs no escaping.
- `[^/]+$` enforces a non-empty filename with no further `/`.
- Read / delete policies on `entry_photos` and all `storage.objects` policies are unchanged (AC-7, Decision #7).

### `20260929100200_are_friends_private.sql` (AC-8, AC-9, AC-10)
```sql
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.uid()) in (a, b), false)
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = a and f.addressee_id = b)
          or (f.requester_id = b and f.addressee_id = a))
    );
$$;

revoke execute on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
```
- Same signature, so `create or replace` keeps the entries policy (`are_friends((select auth.uid()), user_id))`)
  working unchanged (AC-10).
- `coalesce(..., false)` makes the function return `false` (never `null`) when there is no `auth.uid()`.
- Supabase's default privileges grant `EXECUTE` on new public functions to `anon` explicitly, so `anon` is revoked
  by name as well as `PUBLIC`. `service_role` keeps its default grant (see Technical decisions).

## Row-level security
| Object | Change | AC |
|---|---|---|
| `friendships` | New `BEFORE UPDATE` trigger `friendships_guard_update`: ids and `created_at` immutable; status only `pending → accepted`. Policy `friendships: addressee accepts` unchanged (only the addressee updates). | AC-1, AC-2, AC-3, AC-4 |
| `entry_photos` | Policy `entry_photos: insert own` recreated with the `storage_path` regex check. Read/delete unchanged. | AC-5, AC-6 |
| `storage.objects` (`entry-photos`) | Unchanged (upload/delete in own folder; read own folder or path in a readable `entry_photos` row). Re-tested. | AC-7 |
| `public.are_friends` | Answers only pairs containing `auth.uid()`, else `false`; `EXECUTE` revoked from `anon`/`PUBLIC`, granted to `authenticated`. | AC-8, AC-9, AC-10 |

All violations raise SQLSTATE `42501`, so tests use `throws_ok(…, '42501', …)` as in 000.

## Server

### Password validation (AC-11)
- New `src/lib/validation/password.ts`:
  ```ts
  export const MIN_PASSWORD_LENGTH = 8;
  export function isValidPassword(password: string): boolean; // password.length >= MIN_PASSWORD_LENGTH
  ```
- `src/app/login/actions.ts` → `signup`: after the existing username check and **before** `createClient()` /
  `signUp`, read `String(formData.get("password"))`; if `!isValidPassword(password)` return
  `{ error: "Password must be at least 8 characters." }`. No Supabase call is made, so no account is created.
  The same `password` variable is then passed to `signUp`.
- `login` is unchanged (existing accounts sign in with whatever Supabase accepts).

### Supabase auth config (AC-12)
- `supabase/config.toml` `[auth]`: `minimum_password_length = 8` (was 6). Needs `npx supabase stop && npx supabase start`
  to take effect locally.

### Proxy public paths (AC-13, AC-14)
- New `src/lib/auth/public-paths.ts`:
  ```ts
  // Paths reachable without a session: exactly /login, exactly /auth, and anything under /auth/.
  export function isPublicPath(pathname: string): boolean {
    return pathname === "/login" || pathname === "/auth" || pathname.startsWith("/auth/");
  }
  ```
- `src/lib/supabase/proxy.ts`: remove `PUBLIC_PATHS` and the `startsWith` loop; use `isPublicPath(pathname)`.
  Nothing else in `updateSession` changes (the `getClaims()` ordering comment still applies).

### Proxy matcher (AC-15)
The only icon/PWA routes that exist are:
- `/favicon.ico` (`src/app/favicon.ico`, also the icon listed in `src/app/manifest.ts`);
- `/manifest.webmanifest` (`src/app/manifest.ts`).

There is no `src/app/icon.*`, `src/app/apple-icon.*` or icon file in `public/` (which only holds `file.svg`,
`globe.svg`, `next.svg`, `vercel.svg`, `window.svg`). The new matcher in `src/proxy.ts`:
```ts
"/((?!_next/static|_next/image|favicon\\.ico$|manifest\\.webmanifest$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
```
- Removes the `icon` and `apple-icon` prefixes entirely (no such routes exist).
- Anchors `favicon.ico` and `manifest.webmanifest` with `$` and escapes the dot, so e.g. `/favicon.icox` or
  `/manifest.webmanifest-x` go through the proxy.
- `_next/static`, `_next/image` and the image-extension rule are unchanged.
- Update the comment above the matcher to list what is excluded. If an icon route is added later
  (`app/icon.*`, `app/apple-icon.*`), it must be added to the matcher as an exact entry.

## UI
- `src/app/login/page.tsx`: replace the literal `minLength={8}` with `minLength={MIN_PASSWORD_LENGTH}` imported from
  `@/lib/validation/password` (same value; single source). No visual change.
- The new error string "Password must be at least 8 characters." is shown through the existing `state.error`
  rendering of the sign-up form.
- No new routes or components.

## Repository hygiene (AC-16)
- `.gitignore`: add `/.claude/settings.local.json` (under a `# claude code local settings` comment).
- `git rm --cached .claude/settings.local.json` (the file stays on disk).

## Test plan
IDs below are **001** AC ids. New pgTAP files are named after the fix (not `*_rls`) so their AC ids are not confused
with the 000 ids used in the existing files. Existing 000 test files are **not** modified and must keep passing.

| AC | Test type | File | What it proves |
|---|---|---|---|
| AC-1 | pgTAP | `supabase/tests/friendships_update_guard.test.sql` | As the addressee: changing `requester_id`, `addressee_id` or `created_at` (alone or together with `status = 'accepted'`) throws `42501`. As superuser (`reset role`): changing `requester_id` also throws `42501` (trigger applies to everyone). Row is unchanged afterwards. |
| AC-2 | pgTAP | `supabase/tests/friendships_update_guard.test.sql` | Addressee `pending → accepted` updates 1 row; addressee `accepted → pending` throws `42501`; superuser `accepted → pending` throws `42501`. |
| AC-3 | pgTAP | `supabase/tests/friendships_update_guard.test.sql` | Requester and a third user updating the row (status only) affect 0 rows (`results_eq` on `returning` CTE); status still `pending`. Existing `friendships_rls.test.sql` also still passes. |
| AC-4 | pgTAP | `supabase/tests/friendships_update_guard.test.sql` | Users B (addressee), C (requester), V (victim with a `went` entry, an `entry_photos` row and a storage object). As B: `update … set status='accepted', requester_id=V where requester_id=C and addressee_id=B` throws `42501`; as superuser no friendship row involves V and the C–B row is still `pending`; as B: 0 of V's entries, 0 of V's photo rows, 0 of V's storage objects, `are_friends(B, V)` is false. B can then accept C normally (1 row) and still reads nothing of V. |
| AC-5 | pgTAP | `supabase/tests/photos_path_binding.test.sql` | As M: `M/eM/photo.jpg` on entry eM lives. Rejected with `42501`: `M/eM2/x.jpg` on entry eM (other own entry id), `M/eM/` (empty filename), `M/eM` (no filename), `M/eM/sub/x.jpg` (extra `/`), `prefix/M/eM/x.jpg` (not at start). |
| AC-6 | pgTAP | `supabase/tests/photos_path_binding.test.sql` | Victim A has storage object `A/eA/orphan.jpg` with no `entry_photos` row. As M (N is M's accepted friend): inserting `storage_path = 'A/eA/orphan.jpg'` or `'A/eM/orphan.jpg'` on entry eM throws `42501`. As N and as M: `storage.objects` with that name → 0 rows. As A: registering `A/eA/orphan.jpg` on eA still lives (path not squatted). |
| AC-7 | pgTAP | `supabase/tests/photos_path_binding.test.sql` | As M: storage upload to `M/anything.jpg` and `M/a/b/c.jpg` lives; upload to `A/x.jpg` throws `42501`. Existing `photos_rls.test.sql` also still passes. |
| AC-8 | pgTAP | `supabase/tests/are_friends_privacy.test.sql` | `set local role anon`: `select public.are_friends(…)` throws `42501`. `has_function_privilege('anon', 'public.are_friends(uuid, uuid)', 'execute')` is false; no `EXECUTE` ACL entry for PUBLIC (`aclexplode(proacl)` grantee `0`); `authenticated` has `EXECUTE`. |
| AC-9 | pgTAP | `supabase/tests/are_friends_privacy.test.sql` | A–F accepted. As stranger S: `are_friends(A, F)` and `are_friends(F, A)` return `false` (not null). |
| AC-10 | pgTAP | `supabase/tests/are_friends_privacy.test.sql` | As A: `are_friends(A, F)` and `are_friends(F, A)` true; `are_friends(A, P)` (pending) and `are_friends(A, S)` false. As F: `are_friends(A, F)` true and F reads A's `went` entry (1 row) but not A's `want` entry. Existing `entries_rls.test.sql` and `photos_rls.test.sql` still pass unchanged. |
| AC-11 | Vitest | `src/lib/validation/password.test.ts` | `isValidPassword`: accepts 8 and more characters; rejects `""`, 1 and 7 characters. `MIN_PASSWORD_LENGTH` is 8. |
| AC-11 | Playwright | `tests/e2e/auth.spec.ts` | "AC-11 (001)": on the sign-up form, remove the password input's `minlength` attribute, submit a valid unique username/email and a 7-character password → "Password must be at least 8 characters." is visible; `findUserByEmail(email)` returns `null` (no account). |
| AC-12 | Playwright | `tests/e2e/auth.spec.ts` | "AC-12 (001)": directly against local Supabase Auth (`createClient(URL, PUBLISHABLE_KEY).auth.signUp`, with valid `data.username`): a 7-character password returns an error with `code === "weak_password"`; an 8-character password succeeds (user deleted with `deleteUser`). |
| AC-13 | Playwright | `tests/e2e/proxy.spec.ts` | Signed out: `page.goto("/anything")` ends on `/login`; `request.get` with `maxRedirects: 0` on `/anything` and `/some/nested/path` → 3xx with `location` pathname `/login`. |
| AC-14 | Vitest | `src/lib/auth/public-paths.test.ts` | `isPublicPath` true for `/login`, `/auth`, `/auth/`, `/auth/confirm`; false for `/`, `/login-help`, `/login/x`, `/authors`, `/auth-x`, `/LOGIN`, `/anything`. |
| AC-14 | Playwright | `tests/e2e/proxy.spec.ts` | Signed out: `/login-help`, `/authors`, `/login/x` → 3xx to `/login`; `/login` → 200; `/auth/confirm` → 3xx whose `location` contains `error=confirmation_failed` (the route ran, so the proxy let it through); `/auth` → not a redirect to `/login` (404, no page exists). |
| AC-15 | Vitest | `src/proxy.test.ts` | `unstable_doesMiddlewareMatch({ config, url })` from `next/experimental/testing/server` is **false** for `/favicon.ico`, `/manifest.webmanifest`, `/_next/static/x.js`, `/next.svg`; **true** for `/`, `/icon`, `/iconic`, `/icons/a`, `/apple-icon`, `/apple-icon-x`, `/favicon.icox`, `/manifest.webmanifest-x`. |
| AC-15 | Playwright | `tests/e2e/proxy.spec.ts` | Signed out: `/iconic`, `/icon`, `/apple-icon`, `/favicon.icox` → 3xx to `/login`; `/favicon.ico` and `/manifest.webmanifest` → 200. |
| AC-16 | Command check (reviewer) | `tasks.md` Task 8 "Done when" | `git ls-files .claude/settings.local.json` prints nothing; `git check-ignore .claude/settings.local.json` prints the path; the file still exists on disk. |

Test helper additions:
- `tests/e2e/helpers/users.ts`: `findUserByEmail(email: string): Promise<{ id: string } | null>` using
  `adminClient().auth.admin.listUsers()` and filtering by email (local DB is small; one page of up to 1000 users).

## Documentation plan (Mode B, after review PASS — not an implementation task)
- `docs/architecture.md`:
  - §6: remove the "Warning: known security gaps" block; rewrite the table rows for `entry_photos` (path bound to
    `{auth.uid()}/{entry_id}/{filename}`) and `friendships` (ids/`created_at` immutable, `pending → accepted` only,
    enforced by trigger); restore the plain "went only to accepted friends" invariant.
  - §5: `are_friends` note → only pairs including `auth.uid()`, not executable by `anon`; list the three new migrations
    and the `friendships_guard_update` trigger.
  - §7: server-side password ≥ 8 and `minimum_password_length = 8`; public paths are exactly `/login`, `/auth`,
    `/auth/*` via `isPublicPath`; matcher excludes only `favicon.ico` and `manifest.webmanifest` exactly; new icon
    routes must be added explicitly.
  - §3: add `src/lib/auth/public-paths.ts`, `src/lib/validation/password.ts`, `src/proxy.test.ts`.
  - §10: remove "Known coverage gaps" and the `.claude/settings.local.json` note; add the proxy-matcher Vitest
    pattern (`unstable_doesMiddlewareMatch`, `@vitest-environment node`) and the `findUserByEmail` helper.
  - §11: add 001; header "Last updated".
- `specs/001-security-hardening/README.md` from the template, as built.
- `specs/000-foundation/README.md`: add a one-line note at the top of "Known gaps" that they were fixed by 001
  (keep the list for history).
- `specs/README.md`: status → `done`.

## Technical decisions
1. **Trigger, not column grants, for friendship immutability.** A `BEFORE UPDATE` trigger covers both AC-1 (ids,
   `created_at`) and AC-2 (status transition) in one place, applies to every role including `service_role`, and raises
   `42501` like the existing policy denials. Column-level `GRANT UPDATE (status)` would cover AC-1 only and would need
   the status rule elsewhere anyway.
2. **Three migrations (one per gap)** instead of one combined file, so each task commits a migration with its own
   pgTAP test and no applied migration is ever edited between tasks.
3. **Photo path check in the insert policy (regex)**, not a table `CHECK` constraint. It mirrors the requirement
   ("on insert"), reuses the existing policy name, and needs no validation of existing rows. `entry_photos` has no
   update policy, so paths cannot be changed afterwards.
4. **`are_friends` without a caller returns `false`.** Requests with no `auth.uid()` (e.g. `service_role` without a
   user JWT) get `false`; `service_role` keeps `EXECUTE` (Supabase default). No app code calls it outside RLS.
5. **Error ordering in `signup`:** the existing username error is checked first, then the password error, so only one
   message is shown at a time.
6. **Password length counted with `String.length`** (UTF-16 units), identical to the browser's `minLength`.
7. **Pure helpers for testability:** `isValidPassword` in `src/lib/validation/password.ts` and `isPublicPath` in
   `src/lib/auth/public-paths.ts`, each with a colocated Vitest file (architecture §10 pattern).
8. **Matcher unit test** uses `unstable_doesMiddlewareMatch` from `next/experimental/testing/server`. The Next 16.3.7
   docs (`proxy.md`) name it `unstable_doesProxyMatch`, but the installed package only exports
   `unstable_doesMiddlewareMatch` (verified in `node_modules/next/dist/experimental/testing/server/`). The test file
   uses `// @vitest-environment node`.
9. **AC-16 verified by a command check** in the task's "Done when" and by the reviewer, not by a Vitest/Playwright
   test (it is a repository property, not app behavior).
10. **New pgTAP file names** (`friendships_update_guard`, `photos_path_binding`, `are_friends_privacy`) instead of
    extending the 000 `*_rls` files, to keep 000 and 001 AC ids apart and leave the 000 tests untouched.

## Risks & notes
- `supabase/config.toml` changes need `npx supabase stop && npx supabase start`; `npx supabase db reset` (or
  `start` on a fresh DB) applies the new migrations. `npm run test:db` runs against the migrated local DB.
- A hosted Supabase project (none exists yet, Decision #3) must set the minimum password length to 8 in its dashboard;
  `config.toml` only affects local.
- `friendships_rls.test.sql` line ~110 calls `are_friends(a1, b1)` after `reset role`: it keeps working because
  `request.jwt.claims` (sub = b1) is still set in the transaction, so the caller is part of the pair.
- The AC-12 direct `signUp` must pass a valid `data.username`; otherwise the `handle_new_user` trigger fails and
  Auth returns a 500 instead of `weak_password`.
- The image-extension exclusion (`.*\.(svg|png|jpg|jpeg|gif|webp)$`) remains: any path ending in those extensions
  skips the proxy. Unchanged from 000 and outside AC-15 (which is about icon/PWA prefixes); a future route handler
  serving such paths would need its own auth check.
- `/login/…` subpaths are **not** public (AC-14 literal); if login ever gets subroutes they must be added to
  `isPublicPath` (spec change).
