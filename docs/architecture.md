# Mordomia — Architecture

> Source of truth for how the app is built. Owned by the `architect` agent; updated after every feature passes review.
> Last updated: 2026-10-02 (brought up to date with everything built without a spec since 2026-09-30: my list on
> the map, bottom search bar, Google Maps links, **Mordomia Social** — friends, feed, groups, group events with
> mordomo, date poll, attendance, location, realtime, rankings and the Connoisseur badge — and grade colours; see
> §11. 000 gaps 1 and 3 are closed by `20261001000000_friends_feed.sql`; gap 2 and the minor ones remain, see §6)

## 1. Product in one paragraph
A friends-only social app. Each user keeps restaurants on two lists — **"Minha lista"** (`saved`: places they have
been to, with an optional 0–10 rating and notes) and **"Quero ir!"** (`want`) — drawn on their map. Restaurants come
from the OpenStreetMap map, are **added by users** at their exact location, or are added from a **Google Maps link**
(shared with everyone). Each user has an account page with photo, name, bio, stats and a level. **Mordomia Social**
(`/social`) adds mutual friendships (request → accept), a **Feed** of friends' list activity (friends see both lists),
and **groups** (invite-only) whose members organise **events ("mordomias")**: someone is chosen as the event's
**mordomo** (organiser), who runs a **date poll**, then people say whether they are going and the restaurant is set
(or suggested). Mobile-first web app (PWA) in **European Portuguese**; a native app may come later, so logic stays
in React/TypeScript.

## 2. Stack
| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js App Router, Turbopack | 16.3 (see `node_modules/next/dist/docs/`, APIs differ from older versions) |
| UI | React, Tailwind CSS v4 | 19.2 / 4 |
| Language | TypeScript (strict) | 5 |
| DB / Auth / Storage | Supabase (Postgres, Auth email+password, Storage) | `@supabase/supabase-js` 2, `@supabase/ssr` 0.12 |
| Map | **MapLibre GL JS** with free **OpenFreeMap** vector tiles, style **Positron** (no key, no account) | `maplibre-gl` 6 |
| Restaurant search | **Photon** (`https://photon.komoot.io`, OpenStreetMap data, no key), called server-side | — |
| Places (legacy) | Google Places API (New) Autocomplete proxy `/api/places` — **no longer used by the UI** | server-side only |
| Hosting | Vercel Hobby + Supabase Free (production since 2026-09-30, §12) | |
| Runtime | Node 24 LTS (`~/.local/node` on the dev Mac; `24.x` on Vercel) | |

Google Maps (`@vis.gl/react-google-maps`, Maps key, Map ID) is gone; 003 replaced it with MapLibre.

## 3. Folder structure
```
src/
  proxy.ts                    # Next 16 "middleware": refreshes session, redirects signed-out users to /login
  lib/supabase/               # client.ts (browser), server.ts (per request), proxy.ts (updateSession)
  app/
    layout.tsx                # root layout, metadata (pt-PT tagline), <html lang="pt-PT">, viewport (light only)
    globals.css               # Tailwind v4, light colors, @theme tokens (--color-accent), keyframes
                              #   (fork-pop, fade-in, sheet-up, social-ring, badge-pop, dice-roll, confetti-fall,
                              #   smoke-rise)
    manifest.ts               # PWA manifest
    theme.test.ts             # Vitest guard: no dark mode anywhere under src/
    (home)/                   # route group: `/` only, so its loading.tsx never applies to other routes
      page.tsx                # loads username + avatar URL, the user's lists, user-added places, social pulse → <HomeMap>
      loading.tsx             # <Splash> while `/` renders
      actions.ts              # addToList, removeFromList, createRestaurant, readGoogleLink, createRestaurantFromLink
    account/
      page.tsx                # /account: profile, signed avatar URL, list stats → <AccountView>
      actions.ts              # saveDisplayName, saveBio, setAvatar (server actions)
    social/                   # Mordomia Social
      page.tsx                # /social(?tab=procurar|grupos|feed): friends, groups, feed → <SocialView>
      actions.ts              # friends (search, request, accept, remove), loadFeed, loadSocialPulse (badge counts)
      groups.ts               # every group / event server action and the Group / GroupEvent view models
      grupos/[id]/page.tsx                    # group page → <GroupPage>
      grupos/[id]/eventos/[eventId]/page.tsx  # event page → <EventPage>
      grupos/[id]/detalhes/page.tsx           # group details (rankings) → <GroupDetails>
    login/page.tsx            # sign in / sign up (tabs "Entrar" / "Registar", useActionState)
    login/actions.ts          # login, signup, logout; maps Supabase auth error codes to Portuguese
    auth/confirm/route.ts     # email confirmation link target (verifyOtp / code exchange)
    api/search/route.ts       # GET: restaurant search (user-added + Photon), optional country
    api/places/route.ts       # GET: Google Places autocomplete proxy (legacy, unused by the UI)
  components/
    spinner.tsx, splash.tsx   # shared UI
    pull-to-refresh.tsx       # touch pull-down → router.refresh() (social pages)
    home/                     # home-only client components:
      home-map.tsx            #   orchestrates the home screen state (phase, selection, lists, dialogs, toasts)
      map-view.tsx            #   MapLibre map: Positron style, food POIs + user-added layer, click → place, pin mode
      avatar-link.tsx         #   floating avatar (photo or initial) → /account
      friends-button.tsx      #   floating social button → /social, badge = requests + invites + unseen feed
      list-chips.tsx          #   top-left legend chips: show/hide "Já fui" / "Quero ir" dots on the map
      search-bar.tsx          #   bottom search bar (left of the fork menu) → opens the search
      list-fab.tsx            #   the "fork menu" (round knife-and-fork button): Pesquisar, Novo restaurante, A minha lista
      list-panel.tsx          #   full-screen "A minha lista": tabs, search, Tipo/Nota filter dropdowns
      place-dialog.tsx        #   popup for a tapped place: add to a list, rating (0–10) + notes form
      search-modal.tsx        #   restaurant search with country picker; "Não o encontras?" → new restaurant or
                              #   paste a Google Maps link; also reused (portaled) by event location pickers
      new-restaurant-modal.tsx#   name + one or more types + GPS fix
      pin-placement.tsx       #   place the pin within 50 m of the user
      flying-cutlery.tsx, toast.tsx, recenter-button.tsx, location-notice.tsx, map-error.tsx
    account/account-view.tsx  # /account UI: avatar upload, name editor, level, stats, bio, favourites, sign out
    social/
      social-view.tsx         #   /social: tabs Procurar / Grupos / Feed + bottom bar (Mapa, tabs, Perfil)
      groups-tab.tsx          #   group list + invites, GroupSheet (members, invite, edit, leave/delete) and shared
                              #   pieces: Sheet (portaled), GroupPhoto, PersonAvatar, CrownedAvatar, ConnoisseurPill
      group-page.tsx          #   group header, event cards, "Criar evento" FAB
      event-page.tsx          #   event page: mordomo picker / dice, then date, attendance, location; live updates
      date-poll.tsx           #   calendar sheet, poll card (vote, lock, change), close-poll sheet
      event-attendance.tsx    #   "Habemus data!" banner, Vou / Não vou, rejoin requests
      event-location.tsx      #   restaurant search for events, location card, suggestions
      group-details.tsx       #   stats and the two rankings
  lib/                        # pure logic, each with colocated *.test.ts
    validation/username.ts
    data-key.ts               # dataKey(): short hash of data, used as a React key so views rebuild on fresh props
    map/                      # config.ts (Porto, zooms, style URL, toMapLibreZoom), location.ts, phase.ts,
                              #   restaurants.ts (food classes, labels, emojis, kinds helpers, custom place ids),
                              #   my-places.ts (my list → map layers), place-link.ts (mapHref / placeFromSearch:
                              #   "/?lugar=…" deep links that open a place on the map)
    list/                     # types.ts (ListItem, list labels), load.ts (server loaders), details.ts (rating/notes),
                              #   search.ts (search my list), filter.ts (type/rating filters), new-restaurant.ts,
                              #   restaurant-id.ts (place → restaurants row, server), rating-color.ts (grade colours)
    search/                   # photon.ts (Photon → SearchResult, ranking), countries.ts (country picker list),
                              #   google-link.ts (find / parse Google Maps links)
    profile/                  # avatar.ts (initial), account.ts (bio/name parsing, stats, levels), load.ts (avatar URL),
                              #   square-photo.ts (crop to a square JPEG in the browser; avatars and group photos)
    social/                   # people.ts (Person, signedIn, signed URLs, friendIds), seen.ts (feed "seen" per device),
                              #   groups.ts (limits, bucket), dates.ts (pt-PT day formatting, month grid),
                              #   use-live-event.ts (Supabase Realtime hook), group-stats.ts (rankings),
                              #   connoisseur.ts (who holds the Connoisseur badge)
scripts/copy-maplibre-worker.mjs  # predev/prebuild: copies MapLibre's worker to public/maplibre/ (git-ignored)
supabase/
  config.toml                 # local Supabase config
  migrations/                 # SQL migrations (never edit an applied one; add a new file)
  tests/                      # pgTAP tests (*.test.sql)
tests/e2e/                    # Playwright specs (*.spec.ts); helpers/users.ts, helpers/auth.ts
docs/architecture.md          # this file
specs/                        # spec-driven feature folders (see CLAUDE.md)
```

## 4. Conventions
- **Server-first:** pages are Server Components; add `"use client"` only for interactivity.
- **Mutations:** Server Actions in an `actions.ts` next to the route that uses them. Forms use
  `{ error?, message? }` state (`useActionState`); the home/account actions return typed results
  (`{ ok: true, … } | { ok: false, error }`) that client components apply optimistically.
- **Route Handlers** (`app/api/**/route.ts`) only for things that need an HTTP endpoint (e.g. search while typing).
- **Supabase client:** always `await createClient()` from `@/lib/supabase/server` on the server (new per request);
  `createClient()` from `@/lib/supabase/client` in the browser, only for Storage uploads (avatars, group photos) and
  Realtime subscriptions.
- **`"use server"` files export only async functions.** Shared types/constants/helpers for server actions live in
  `src/lib/**` (e.g. `lib/social/people.ts`, `lib/list/restaurant-id.ts`); types may be re-exported.
- **Rule-heavy writes go through Postgres functions (RPC).** When a write depends on state (who may pick the
  mordomo, closing a poll, attendance, setting the location), the table has no insert/update grant for
  `authenticated` and a `security definer` function checks the rules and writes. Server actions call
  `supabase.rpc(…)` and map failures to `{ ok: false }`.
- **Private images** (avatars, group photos, profile photos of other people) are shown through short-lived signed URLs
  created on the server (`signedUrls` in `lib/social/people.ts`).
- **Auth check:** `supabase.auth.getClaims()`; `claims.sub` is the user id. Every Server Action / Route Handler that
  touches user data checks it (the proxy is only a first line).
- **Validate on the server** with the pure parsers in `src/lib/**` (`parseDetails`, `parseNewRestaurant`,
  `parseKinds`, `parseBio`, `parseDisplayName`, `isOwnAvatarPath`); DB constraints are the last line.
- **Async request APIs (Next 16):** `await cookies()`, `await headers()`, `await params`, `await searchParams`.
- **Imports:** `@/*` → `src/*`.
- **Language:** all **UI copy is European Portuguese with "tu"** (e.g. "Adiciona à minha lista", "Não o encontras?",
  "Terminar sessão"); `<html lang="pt-PT">`. Code, comments, docs, specs and test names stay in **English**. There is
  no i18n library and no language switch. Supabase Auth errors are mapped by `error.code` to Portuguese in
  `login/actions.ts` (unknown codes → "Algo correu mal. Tenta outra vez.").
- **Emojis** are part of the copy (place types, buttons, level, stats). Decorative emojis are wrapped in
  `aria-hidden="true"` so accessible names stay clean.
- **Styling:** Tailwind utility classes; mobile-first. **Always light, no dark mode**: never use `dark:` variants or
  `prefers-color-scheme: dark` (guarded by `src/app/theme.test.ts`); root viewport `colorScheme: "only light"`,
  `themeColor: "#ffffff"`. Background `#ffffff`, foreground `#171717`.
- **Accent color:** the theme token `--color-accent: #c2410c` (terracotta) → `bg-accent`, `text-accent`, … Use it
  for primary buttons, active tabs/chips and spinners; never hard-code the hex (MapLibre paint colors are the one
  exception, they cannot read CSS tokens) or use Tailwind `orange-700`. Soft warm tints use `orange-50/100`.
- **Motion:** entrance/pop animations use the `globals.css` keyframes with `motion-safe:`; JS animations (count-up)
  check `prefers-reduced-motion`.
- **Components:** shared UI in `src/components/`, feature components in `src/components/<area>/`; decision logic stays
  pure in `src/lib/**` and components get plain props.
- **Full-screen screens / floating UI:** page root `fixed inset-0` (map) or `min-h-dvh` (account); floating controls
  inset with `env(safe-area-inset-*)` (root viewport has `viewportFit: "cover"`).
- **Dropdowns / popovers:** close on outside `pointerdown` and on Escape; options use `role="menu"` +
  `menuitemcheckbox` / `menuitemradio`.
- **Per-device preferences** (e.g. the search country) may use `localStorage`, always inside `try/catch`, and the UI
  must work when storage is unavailable. Anything that must follow the user across devices goes in the DB.
- **Images:** plain `<img>` for signed Supabase URLs / blob previews (with an eslint-disable comment for
  `@next/next/no-img-element`).
- **Route-level loading UI:** put `loading.tsx` inside a route group that covers only the intended route.
- **Refreshing server data:** social pages wrap their view in `<PullToRefresh>` (calls `router.refresh()`) and give
  the view `key={dataKey(data)}` so it rebuilds from fresh props. Client views that refresh themselves (event page)
  keep a request counter and drop stale results.
- **Live updates:** only the event page is live (`useLiveEvent`, Supabase Realtime `postgres_changes`). Tables must be
  in the `supabase_realtime` publication, and the browser client must call `supabase.realtime.setAuth(token)` before
  subscribing, otherwise RLS delivers nothing. A change just triggers a debounced reload of the page's data.
- **Sheets / modals over animated content** are rendered with `createPortal(…, document.body)`: the entrance
  animations create stacking contexts that would otherwise cover them.
- **Grade colours:** any 0–10 grade uses `ratingColor()` / `RATING_GRADIENT` from `lib/list/rating-color.ts`
  (red 0 → yellow 5 → green 10), never the accent colour.
- **Secrets:** only `NEXT_PUBLIC_*` vars reach the browser. `GOOGLE_PLACES_API_KEY` is server-only.

## 5. Data model
Migrations (in order): `20260929000000_init.sql`, `20260930000000_osm_restaurants.sql`,
`20260930000100_saved_status.sql`, `20260930000200_rating_0_10.sql`, `20260930000300_user_added_restaurants.sql`,
`20260930000400_profile_bio_avatars.sql`, `20260930000500_display_name_editable.sql`,
`20260930000600_restaurant_kinds.sql`, `20261001000000_friends_feed.sql`, `20261001000100_groups.sql`,
`20261001000200_group_events.sql`, `20261001000300_event_mordomo.sql`, `20261001000400_event_date_poll.sql`,
`20261001000500_event_attendance.sql`, `20261001000600_event_realtime.sql`, `20261001000700_event_location.sql`.

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `id` (= auth.users.id), `username` unique `^[a-z0-9_]{3,24}$`, `display_name` (1–40), `bio` (≤ 160), `avatar_path` | created by trigger `handle_new_user` from signup metadata `username`. `avatar_path` must start with `{id}/`. Signed-in users may update **only** `display_name`, `bio`, `avatar_path` (column-level grants): the username never changes |
| `restaurants` | `id`, `google_place_id` unique (nullable), `osm_id` unique, `name` (1–100), `kind`, `kinds text[]`, `lat`, `lng`, `user_added`, `created_by` | shared catalogue. Source check: a Google id, an OSM id, or `user_added` with lat/lng/kind. `kind` = main type (map icon); `kinds` = all types, main first (1–7 valid food classes, `kinds[1] = kind`; null for OSM rows) |
| `entries` | `id`, `user_id`, `restaurant_id`, `status` (`want`/`went`/`saved`), `rating` 0–10, `notes` (≤ 2000), `visited_at` | unique (`user_id`, `restaurant_id`); rating only on `went`/`saved`; `updated_at` trigger |
| `entry_photos` | `id`, `entry_id`, `user_id`, `storage_path` unique | file in bucket `entry-photos` at `{user_id}/{entry_id}/{filename}` (no UI yet) |
| `friendships` | `requester_id`, `addressee_id`, `status` (`pending`/`accepted`) | one row per pair (unique on least/greatest). Trigger `friendships_guard_update`: ids and `created_at` frozen, status only `pending → accepted` |
| `groups` | `id`, `owner_id` (default `auth.uid()`), `name` (1–40), `description` (≤ 300), `photo_path` (`{owner_id}/…`) | trigger `groups_add_owner` inserts the owner as a `member` |
| `group_members` | (`group_id`, `user_id`), `status` (`invited`/`member`), `invited_by` | an invite is a row with `invited`; accepting sets `member`. Guards: only `invited → member` by the invitee; the owner can't leave |
| `group_events` | `id`, `group_id`, `title` (1–60), `created_by`, `mordomo_id`, `event_date` (date, no time), `location_restaurant_id` | no update grant: mordomo, date and location change only through RPCs |
| `group_event_date_options` | `id`, `event_id`, `day` | the poll's days (1–31, from yesterday on); unique (`event_id`, `day`); created by RPC |
| `group_event_date_votes` | (`option_id`, `user_id`) | members vote / unvote directly while the poll is open (`date_option_open`) |
| `group_event_attendance` | (`event_id`, `user_id`), `going`, `rejoin_requested_at` | explicit answers only (voters of the chosen day and the mordomo are going implicitly). Written only by RPCs |
| `group_event_location_suggestions` | `id`, `event_id`, `restaurant_id`, `suggested_by` | unique (`event_id`, `restaurant_id`); only while the event has no location |

Food classes (`src/lib/map/restaurants.ts`, same as the OpenMapTiles `poi` classes): `restaurant`, `fast_food`,
`cafe`, `bar`, `beer` (pub), `ice_cream`, `bakery`, with Portuguese labels and emojis.

Place ids in the app: OSM places use the OpenMapTiles feature id (OSM id × 10 + element type digit) so search results
match map features; user-added places use `custom:<restaurants.id>`.

Storage buckets: `entry-photos` (private, 5 MB, jpeg/png/webp/heic), **`avatars`** (private, 2 MB,
jpeg/png/webp; path `{user_id}/{timestamp}.jpg`; shown through signed URLs created on the server) and
**`group-photos`** (private; path `{owner_id}/…`; readable by the group's members and invitees).

Helpers (all `security definer`, `search_path = ''`):
- `are_friends(a, b)` → accepted friendship; answers only when the caller is `a` or `b`; not executable by anon.
- `in_group(gid, invited_ok)`, `owns_group(gid)`, `in_event_group(eid)`, `date_option_open(oid)`,
  `is_going_to_event(eid)` — used by policies.
- RPCs (callable by `authenticated`): `set_event_mordomo(eid, uid)` (event creator or group owner),
  `roll_event_mordomo(eid)` (event creator only, random member), `create_event_date_poll(eid, days[])` and
  `close_event_date_poll(eid, day)` (mordomo), `answer_group_event(eid, going)`, `request_group_event_rejoin(eid)`,
  `answer_group_event_rejoin(eid, uid, accept)` (mordomo), `set_event_location(eid, rid | null)` (mordomo, dated event).

Realtime publication `supabase_realtime`: `group_events`, `group_event_date_options`, `group_event_date_votes`,
`group_event_attendance`, `group_event_location_suggestions`.

## 6. Privacy model (RLS, all tables enabled)

> **Security gaps from the 000 review.** Gaps **1** (forged friendship on accept) and **3** (`are_friends` callable
> by anon / for any pair) were **closed by `20261001000000_friends_feed.sql`** before friends could read each other's
> lists. Still open until 001 (details in `specs/000-foundation/README.md` → "Known gaps"):
> 2. **[major]** `entry_photos: insert own` (init.sql:184-188, with the storage read policy at 222-229) does not require
>    `storage_path` to start with `{auth.uid()}/{entry_id}/` → can expose another user's orphaned/pending files or
>    squat paths (no photo UI exists yet).
> - The minor 000 gaps 4–7 (§7, §10). The Supabase security advisor also flags `handle_new_user` as executable via
>   RPC and leaked-password protection as disabled.
> - **Realtime DELETE events** carry the deleted row's primary key to every subscriber of the table regardless of RLS;
>   for `group_event_date_votes` that is (`option_id`, `user_id`). Accepted by the user.

| Table | Read | Write |
|---|---|---|
| profiles | any signed-in user (incl. `bio`, `avatar_path`) | update own; **only** `display_name`, `bio`, `avatar_path` (column grants) |
| restaurants | any signed-in user | insert (created_by = self); no update/delete — nobody can change or remove a shared restaurant |
| entries | own; or `are_friends(me, owner)` (**all statuses**: friends see Minha lista and Quero ir!, with rating and notes) | insert/update/delete own |
| entry_photos | if the parent entry is readable | insert own (on own entry; path prefix **not** checked, gap 2) / delete own |
| friendships | rows where I'm requester or addressee | insert as requester with `pending`; addressee updates to `accepted` (ids frozen by trigger); either side deletes |
| groups | members and invitees | create own; owner updates / deletes |
| group_members | members and invitees of the group | a member invites an **accepted friend**; the invitee accepts; delete = leave (not the owner), owner removes, or the inviter cancels an invite |
| group_events | group members | members create; creator or group owner deletes; other changes only via RPCs |
| date options / votes | group members | options via RPC; members vote / unvote their own while the poll is open |
| group_event_attendance | group members | RPCs only |
| location suggestions | group members | insert when **going** and the event has no location yet; delete own |
| storage `group-photos` | the group's members and invitees (path = `groups.photo_path`), or own folder | upload/delete in own folder |
| storage `entry-photos` | own folder, or path listed in a readable `entry_photos` row | upload/delete in own folder |
| storage `avatars` | any signed-in user | upload/delete in own folder (`{auth.uid()}/…`) |

**Invariant (changed 2026-10-01, by the user's choice):** a user's entries (both lists, with rating and notes) are
readable by their **accepted friends** and nobody else. Strangers see nothing.

**Invariant (groups):** a group, its members, photo and events are visible only to its members (invitees see the group
and member list so they can decide). Being in a group never exposes anyone's lists; that still needs a friendship.
Only friends can be invited.

**Invariant (002):** the user's geolocation stays in the browser, with one exception: when **adding a restaurant**,
the GPS fix and the pin are sent to `createRestaurant`, which checks the pin is within 50 m of the fix; only the pin
(the restaurant's position) is stored. The map tile/search providers see the viewed area and the search bias position.

## 7. Auth flow
Sign up (email, password, username) → `signup` server action validates the username (`src/lib/validation/username.ts`)
→ `signUp` with `data.username` and `emailRedirectTo: <origin>/auth/confirm` → trigger creates the profile →
Supabase sends a confirmation email → link hits `/auth/confirm` → session cookie set → `/`.
Sign out: the floating avatar on the map opens **`/account`**, whose "Terminar sessão" button submits the `logout`
server action (there is no avatar dropdown any more). `/login` has "Entrar" / "Registar" tabs. `src/proxy.ts` runs on
every non-static request: refreshes the session via `getClaims()` and redirects to `/login` when signed out (public
paths: prefix match on `/login`, `/auth`).
- Password ≥ 8 is currently enforced **only in the browser** (`minLength`); the server action does not check it and
  `supabase/config.toml` has `minimum_password_length = 6` (000 gap 4, fixed in 001).
- The proxy matcher excludes any path starting with `icon`/`apple-icon` (000 gap 6, fixed in 001: exact exclusions).
- Local Supabase has email confirmations disabled; **production has them enabled** (Site URL and redirect URLs must
  point at the Vercel domain, §12).

## 8. External APIs
- **Map (003):** MapLibre GL JS loads the OpenFreeMap **Positron** style (`MAP_STYLE_URL` in
  `src/lib/map/config.ts`) and its vector tiles in the browser; no key. Only food POIs (the classes above) are shown,
  plus a GeoJSON layer of user-added restaurants; tapping one opens the place popup. Rotation/tilt disabled; compact
  OSM/OpenFreeMap attribution is the only control. App zooms are on the 256-px scale (located 15, Porto fallback 13)
  and converted with `toMapLibreZoom` (−1). MapLibre's worker is served from `public/maplibre/` (copied by
  `scripts/copy-maplibre-worker.mjs` on predev/prebuild).
- **Restaurant search:** `GET /api/search?q=<text>&lat=&lng=&country=` (session required) →
  `{ results: SearchResult[] }` (`SelectedPlace & { address }`). Merges user-added restaurants (`ilike` on name) with
  Photon results for the food OSM tags (`osm_tag=amenity:restaurant…`, `limit=40`, biased to `lat`/`lng`), ranks exact
  → prefix → word matches, returns 10. `q` < 2 chars → `[]`; Photon down and no user-added match → 502.
  **Country** (`src/lib/search/countries.ts`, 12 countries): Photon gets `countrycode=<code>`; user-added restaurants
  (no country stored) are kept by a rough bounding box, so neighbouring boxes can overlap. The picker's choice is
  remembered per device in `localStorage` (`mordomia.searchCountry`).
- **Google Maps links:** "Não o encontras?" accepts a pasted Google Maps share (`readGoogleLink`). The server follows
  short-link redirects **only on Google Maps hosts**, reads the name and position (`lib/search/google-link.ts`); when
  the link has no position, Photon geocodes the address for a starting pin and the user places it.
  `createRestaurantFromLink` re-reads the link, so name/position come from Google, not the browser. `share.google`
  links (no position) get a message asking to share from Google Maps.
- **Supabase Realtime:** event pages subscribe to `postgres_changes` (see §4 "Live updates").
- **Places Autocomplete (legacy):** `GET /api/places` (Google, `GOOGLE_PLACES_API_KEY`) still exists but no UI calls it.
- **Browser geolocation (002):** `requestLocation()` in `src/lib/map/location.ts` makes one `getCurrentPosition` call
  (`enableHighAccuracy: false`, `timeout: 10000`, `maximumAge: 0`), never `watchPosition`, and caps the whole request
  at 10 s with its own timer; a success after the cap is delivered via `onLateSuccess`. Fallback: Porto
  (`41.1579, -8.6291`). Adding a restaurant asks for a separate high-accuracy fix.

## 9. Environment variables (`.env.example`)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `GOOGLE_PLACES_API_KEY` (server, optional now:
only the legacy `/api/places` needs it). No map keys.

Tests use `.env.test` (git-ignored; template `.env.test.example`, values from `npx supabase status`):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (e2e helpers only,
never used by the app), `GOOGLE_PLACES_API_KEY` (optional).

To run the dev server against the **production** database (e.g. when Docker is not available), override the two
Supabase vars on the command line; they take precedence over `.env.local`. This reads and writes real data.

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
- **Vitest:** `vitest.config.ts` (jsdom, `@vitejs/plugin-react`, `vite-tsconfig-paths` for `@/`). Pure logic lives in
  `src/lib/**` with colocated `*.test.ts` (106 tests as of this update: map, location, phase, restaurants/kinds,
  Photon, countries, list details/search/filter/new-restaurant, profile/account, username). Source-scanning guards
  use `// @vitest-environment node` (e.g. `src/app/theme.test.ts`). There are no component tests for the MapLibre UI.
- **Playwright:** `playwright.config.ts` loads `.env.test` with `process.loadEnvFile` and **throws if it is missing**;
  starts `npm run dev` on **port 3100** (reuses an existing server outside CI). Signed-in tests create a confirmed
  user with `createConfirmedUser()`, sign in with `signIn()` and delete the user in `afterEach`. Name tests with their
  AC ids. Selectors use the **Portuguese** UI text: `getByLabel("Email" | "Palavra-passe", { exact: true })` (non-exact
  also matches the "Mostrar palavra-passe" toggle), buttons "Entrar" / "Criar conta", tab "Registar", link
  "A minha conta", button "Terminar sessão".
- **Next 16 dev lock:** only one `next dev` can run per project folder; stop a running dev server before
  `npm run test:e2e` / `npm run check`.
- **No automated tests for the 2026-10-01/02 work** (friends, feed, groups, events, realtime, rankings, grade colours):
  the user asked not to write tests for now. RLS was verified by hand with role-switched SQL in rolled-back
  transactions, and the flows with throwaway Playwright scripts against local Supabase (not committed).
- **Known coverage gaps:** e2e and pgTAP were not run for the post-002 work (no Docker during that session); there
  are no pgTAP tests yet for the new constraints/grants (username lock, `avatars` policies, `kinds` check) — they
  were verified by hand on the production DB. 000 gaps 5 and 1–3 tests come with 001; 002 gaps: no e2e for the
  home map, no automated test for the 10 s cap.
- **Dev deps of note:** `@types/node` `^24`, `@playwright/test`, `vitest`, `jsdom`, `@testing-library/react`,
  `@testing-library/dom`, `supabase` CLI.
- **Git-ignored:** `.env*` except the two templates, `supabase/.temp`, `supabase/.branches`, `public/maplibre/`,
  `test-results/`, `playwright-report/`, `blob-report/`, `playwright/.cache/`, `coverage/`.
  `.claude/settings.local.json` is currently tracked and should not be (000 gap 7, fixed in 001).
- **Dev Mac:** Node in `~/.local/node/bin`, Docker CLI in `~/.docker/bin`; both must be on `PATH` for
  `npm run check` / `npx supabase …`: `export PATH="$HOME/.local/node/bin:$HOME/.docker/bin:$PATH"`.

## 11. Features
See `specs/README.md` for status. Built so far:
- **000 Foundation** (`specs/000-foundation/README.md`): scaffold, auth, schema + RLS, Places proxy, PWA manifest,
  test tooling. Closed with 7 known gaps (1 blocker, 1 major, 5 minor) scheduled for **001 security hardening**.
- **002 Home map, light theme, login polish** (`specs/002-home-map/README.md`): always-light theme + accent token,
  full-screen geolocated home (Porto fallback + notice, recenter, blue dot, splash, map-error state), login tabs,
  labels, tagline, password toggle.

Built **without a spec** (the user chose to skip the spec flow for these; there are no `specs/NNN` folders or
READMEs — this section is their only documentation):
- **Free map (003 scope, spec still `draft`):** Google Maps replaced by MapLibre + OpenFreeMap Positron (§8).
- **Lists:** tapping a food place opens `PlaceDialog` → "⭐ Adiciona à minha lista" (form: optional 0–10 rating + notes)
  or "🤤 Quero ir!". Stored as `entries` (`saved` / `want`) via `addToList`; OSM places get a `restaurants` row on
  first use. A knife-and-fork animation (`FlyingCutlery`) flies into the fork menu and a toast confirms.
- **Fork menu** (`ListFab`, bottom-right knife-and-fork button): Pesquisar, Novo restaurante, A minha lista (count
  badge). The former "Adicionar" option was removed.
- **"A minha lista"** (`ListPanel`, full screen): tabs "Minha lista" / "Quero ir!" with counts, search across both
  lists (accent- and case-insensitive), remove, "Ver no mapa". **Filters:** one row with two dropdown buttons —
  **🍽️ Tipo** (multi-select, any-of, counts place with several types under each) and **⭐ Nota** (single choice:
  one "at least N" option per rating the user actually gave, best first, plus "Sem nota"; results sorted best first).
  Options come only from the restaurants on the current tab/search; a chosen value that is not present there is
  ignored. The Nota filter never applies to "Quero ir!". Logic in `src/lib/list/filter.ts`.
- **My list on the map:** the user's own entries are drawn on the home map (`MapView` layers `my-places-dots` /
  `my-places-labels`, all zooms, names from zoom 12) as dots colored by list — **⭐ Já fui** (`saved`) `#c2410c`,
  **🤤 Quero ir** (`want`) `#7c3aed` — above every other pin; the regular OSM / user-added pin of a listed place is
  hidden so each place shows once (a place on both lists shows as Já fui). Two top-left chips (`ListChips`, shown when
  the list is not empty) are the legend and show/hide each list; the choice is remembered on the device
  (`localStorage` `mordomia.mapLists`). Tapping a dot opens `PlaceDialog`. Hidden while placing a new restaurant.
  Logic in `src/lib/map/my-places.ts`. Data is the already-loaded own list (no new query, no RLS change).
- **Search** (`SearchModal` → `/api/search`): Photon + user-added, with the **country picker** (§8); "Não o
  encontras?" starts a new restaurant with the typed name.
- **New restaurant:** name, **one or more types** (first chosen = main type/icon), a fresh GPS fix, then
  `PinPlacement` (pin must stay within `PIN_RANGE_M` = 50 m of the fix). `createRestaurant` validates, reuses a
  user-added place with the same normalized name within 75 m, else inserts (`user_added = true`). Visible to everyone.
- **Portuguese UI:** every user-facing string in European Portuguese ("tu"), including Supabase auth errors.
- **Map polish:** a bottom **search bar** (left of the fork menu) opens the search; the search can be cleared; links
  `/?lugar=…&nome=…&lat=…&lng=…` (`mapHref`) open a place on the map (used by event locations).
- **Grade colours:** every 0–10 grade (list pills, favourites, feed, place popup) is coloured red → yellow → green;
  the rating form shows the colour per button and a gradient legend.
- **Account page `/account`:** photo (cropped to a 512 px square JPEG in the browser, uploaded to `avatars`, old file
  deleted), editable display name (username locked), "Sobre mim" bio (160 chars, emoji shortcuts), level by places
  been to (🌱 A começar 0 → 🍴 Provador 5 → 🧭 Explorador 15 → 🏅 Gourmet 30 → 👑 Mordomo-mor 60) with a progress
  bar, stats (Onde já fui = `saved` count, Quero ir, Nota média), top-3 favourites, sign out. The map's floating
  avatar shows the photo and links here.

- **Mordomia Social (`/social`):** opened from the floating social button on the map (badge = friend requests +
  group invites + feed items not seen on this device; the icon rings while there is any). Bottom bar:
  **Mapa** · **Procurar** · **Grupos** · **Feed** · **Perfil**; the tab is in `?tab=`.
  - **Procurar:** search people by name or @username, send / accept / cancel requests, list and remove friends.
  - **Feed:** friends' latest additions to either list (50 newest), "Novo" on items newer than the last visit
    (`localStorage` `mordomia.feedSeenAt`, marked when leaving the Feed). Consecutive items from the same person are
    grouped like a conversation (one avatar and name, one bubble per restaurant).
  - Pull-to-refresh on every social page.
- **Groups:** name (≤ 40), description (≤ 300) and an optional square photo. Created with friends to invite; members
  invite more friends; invitees see the group first under Grupos and accept ("Entrar no grupo"). `GroupSheet`:
  members, invite, edit (owner), leave / delete. The member who has been **mordomo most often** holds the
  **Connoisseur** badge (👑 crown on their avatar, "Connoisseur" pill on the group card, group page and member list;
  ties stay with whoever got there first).
- **Group page** (`/social/grupos/[id]`): photo, name, member count, Connoisseur pill, "🏆 Detalhes do grupo", and the
  group's events as cards (mordomo missing, "Habemus data" with who is going, 📍 location or number of suggestions).
  Floating **"Criar evento"** button: title + "Sou o mordomo" switch, then opens the new event.
- **Event page** (`/social/grupos/[id]/eventos/[eventId]`), live for everyone on it ("Ao vivo"):
  1. **Mordomo first:** nothing else until one is chosen — picked by hand (event creator or group owner) or by a
     **dice roll** (event creator only; random member, animated).
  2. **Date poll:** the mordomo picks 1–31 days on a calendar; members tick every day they can and **Confirmar**;
     votes then show locked (green, padlock) until "Mudar votos". Voters are shown as avatars only. The mordomo
     **closes** the poll by confirming a day (most voted preselected) and optionally a restaurant.
  3. **"Habemus data!"**: festive design with confetti. Voters of the chosen day and the mordomo are going; everyone
     else answers **Vou / Não vou**. "Não vou" removes them from the event (not the group); to come back they ask the
     mordomo, who accepts or declines.
  4. **Location:** a restaurant from the map search. Without one, people going suggest restaurants; the mordomo picks
     a suggestion or any restaurant, and can change or clear it. "Ver no mapa" opens it on the home map.
- **Group details** (`/social/grupos/[id]/detalhes`, members only): number of dated events and of all events, and two
  rankings over current members — **most mordomias** (dated events they are going to, future ones included) and
  **most times mordomo** — with medals, shared places on ties and the Connoisseur crowned.

Upcoming: **001 security hardening** (specced; gaps 1 and 3 already closed), entry photos.

## 12. Production
Live since 2026-09-30, used by the owner only until 001 lands.
- **App:** https://mordomia-two.vercel.app — Vercel project `mordomia` (`prj_xao8RzBYZhcfxAgXiyWRxyQfaocd`, personal
  Hobby account), linked to GitHub `jpamcarvalho/mordomia`: **every push to `main` deploys to production**. Functions
  run in `cdg1` (Paris), next to the database. Vercel env: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`GOOGLE_PLACES_API_KEY` not set).
- **Database:** Supabase project `mordomia` (`legpqwvizknhuwuhrrlo`, `eu-west-3` Paris, Free plan). All migrations up
  to `20261001000700_event_location` are applied (2026-10-01). **Migrations are not applied by the deploy**: apply every new migration to
  production (Supabase MCP `apply_migration` or `supabase db push`) before or together with pushing code that needs it.
- **Auth settings (dashboard):** email confirmation on; Site URL `https://mordomia-two.vercel.app`, redirect URL
  `https://mordomia-two.vercel.app/**`. The built-in email sender is rate-limited (a few emails per hour).
