# Mordomia — Architecture

> Source of truth for how the app is built. Owned by the `architect` agent; updated after every feature passes review.
> Last updated: 2026-09-29 (000-foundation)

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
| Maps | Google Maps JavaScript API via `@vis.gl/react-google-maps` | installed, not yet used |
| Hosting | Vercel Hobby + Supabase Free + Google $200/mo credit | |
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
    layout.tsx                # root layout, metadata, viewport, PWA meta
    manifest.ts               # PWA manifest
    page.tsx                  # home (signed-in)
    login/page.tsx            # sign in / sign up (client component, useActionState)
    login/actions.ts          # login, signup, logout server actions
    auth/confirm/route.ts     # email confirmation link target (verifyOtp / code exchange)
    api/places/route.ts       # GET: Google Places autocomplete proxy (auth required)
supabase/
  config.toml                 # local Supabase config
  migrations/                 # SQL migrations (never edit an applied one; add a new file)
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
- **Styling:** Tailwind utility classes; mobile-first; supports dark mode via `dark:` variants.
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

## 6. Privacy model (RLS, all tables enabled)
| Table | Read | Write |
|---|---|---|
| profiles | any signed-in user | update own |
| restaurants | any signed-in user | insert (created_by = self) |
| entries | own; or `status='went'` AND `are_friends(me, owner)` | insert/update/delete own |
| entry_photos | if the parent entry is readable | insert own (on own entry) / delete own |
| friendships | rows where I'm requester or addressee | insert as requester with `pending`; addressee updates to `accepted`; either side deletes |
| storage `entry-photos` (private, 5 MB, jpeg/png/webp/heic) | own folder, or path listed in a readable `entry_photos` row | upload/delete in own folder |

**Invariant:** "want to go" entries are never readable by anyone but their owner.

## 7. Auth flow
Sign up (email, password ≥ 8, username) → Supabase sends a confirmation email → link hits `/auth/confirm` → session
cookie set → `/`. `src/proxy.ts` runs on every non-static request: refreshes the session via `getClaims()` and
redirects to `/login` when signed out (public paths: `/login`, `/auth`).

## 8. External APIs
- **Places Autocomplete:** `GET /api/places?q=<text>&lat=&lng=` → `{ suggestions: [{ placeId, name, address }] }`.
  Restricted to types restaurant, cafe, bar, bakery; optional 20 km location bias. Requires a session (401 otherwise).
- Place details (lat/lng, photos) not implemented yet.

## 9. Environment variables (`.env.example`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GOOGLE_PLACES_API_KEY` (server),
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser, referrer-restricted).

## 10. Testing (being set up in 000-foundation tasks)
| Kind | Tool | Location | Script |
|---|---|---|---|
| DB / RLS | pgTAP via `supabase test db` | `supabase/tests/*.sql` | `npm run test:db` |
| Unit / component | Vitest + Testing Library | `src/**/*.test.ts(x)` | `npm test` |
| End-to-end | Playwright (Chromium, mobile viewport) | `tests/e2e/*.spec.ts` | `npm run test:e2e` |
| All | lint + typecheck + all tests + build | | `npm run check` |
Tests run against **local Supabase** (`npx supabase start`, Docker Desktop).

## 11. Features
See `specs/README.md`.
