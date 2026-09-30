# 002 · Home map, light theme, login polish — Requirements

> Status: specced
> Written by: main session via grill-me · Approved by user on: 2026-09-30

## Summary
The signed-in home (`/`) is a placeholder and the app turns black when the device is in dark mode. The user wants a
friendlier app: always white, a full-screen Google map centered on the user's location as the home page, and a
polished login/sign-up page. No data or database changes: this feature is UI only.

## User stories
- As a user, I want the app to always look light and clean, whatever my device theme is.
- As a signed-in user, I want the home page to open a map around where I am, so I can see what's near me.
- As a user who denies location, I still want a useful map (Porto) and to know why it isn't showing where I am.
- As a new or returning user, I want a clearer sign-in / sign-up page.

## Acceptance criteria

### Theme
- **AC-1** — THE SYSTEM SHALL render every page with a white background and dark text regardless of the OS color
  scheme (no dark mode).
- **AC-2** — THE SYSTEM SHALL use terracotta `#C2410C` (Tailwind `orange-700`) as the accent color for primary
  buttons, the active tab and spinners.

### Home (`/`, signed-in)
- **AC-3** — WHEN a signed-in user opens `/` THE SYSTEM SHALL show a white splash screen with "Mordomia" centered, a
  terracotta spinner and the text "Finding your location…" until the map is ready. The splash also covers the
  transition right after signing in.
- **AC-4** — WHEN the home page loads THE SYSTEM SHALL request the browser geolocation once (single reading, no live
  tracking) with a 10-second timeout.
- **AC-5** — WHEN the location resolves THE SYSTEM SHALL show a full-screen map centered on it at zoom 15, with a blue
  "you are here" dot at the user's position.
- **AC-6** — IF the location is denied, unavailable or times out THEN THE SYSTEM SHALL center the map on Porto,
  Portugal at zoom 13 and show a dismissible notice (✕): "Location is off — showing Porto. Enable location to see
  what's near you." The notice is shown on every visit where location is unavailable; the dismissal is not stored.
- **AC-7** — THE SYSTEM SHALL show a floating recenter button. WHEN tapped THE SYSTEM SHALL request a fresh location
  reading (asking for permission again if needed), move the blue dot there and recenter the map. IF that reading
  fails THEN THE SYSTEM SHALL show the AC-6 notice.
- **AC-8** — THE SYSTEM SHALL hide all default Google Maps controls (zoom, map type, Street View, fullscreen); the map
  is moved with gestures only.
- **AC-9** — THE SYSTEM SHALL use a clean light map style that hides non-restaurant points of interest (shops,
  transit, other businesses).
- **AC-10** — THE SYSTEM SHALL NOT show a top bar. A floating round avatar button showing the user's initial SHALL open
  a menu with `@username` and "Sign out"; "Sign out" signs the user out.
- **AC-11** — IF the Google map fails to load (network error, missing or invalid API key) THEN THE SYSTEM SHALL show
  the centered text "We couldn't load the map." with a "Try again" button that reloads the page; the avatar menu stays
  available.
- **AC-12** — THE SYSTEM SHALL NOT show restaurant markers in this version.

### Login / sign-up (`/login`)
- **AC-13** — THE SYSTEM SHALL show the tagline "The restaurants you went to and the ones you want to try, with
  friends." under the "Mordomia" heading.
- **AC-14** — THE SYSTEM SHALL show a visible label above each field: "Username" (sign-up only), "Email", "Password".
- **AC-15** — THE SYSTEM SHALL switch between modes with two tabs, "Sign in" and "Sign up", at the top of the form,
  replacing the current link at the bottom. The active tab uses the accent color.
- **AC-16** — THE SYSTEM SHALL provide a show/hide toggle on the password field.
- **AC-17** — Existing login/sign-up behavior (validation, error and success messages, redirect to `/`) SHALL stay
  unchanged.

## Privacy & permissions
- No new tables, columns or RLS policies. The home page reads only the signed-in user's own `username` (existing
  `profiles` read policy).
- The user's location stays in the browser; it is never sent to or stored by the Mordomia server or database.
- The Google Maps key is a browser key (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`), HTTP-referrer restricted, Maps
  JavaScript API only. It is separate from the server-only `GOOGLE_PLACES_API_KEY`.

## UI & copy
- Splash: "Mordomia" · spinner · "Finding your location…"
- Fallback notice: "Location is off — showing Porto. Enable location to see what's near you." + ✕
- Map error: "We couldn't load the map." + button "Try again"
- Avatar menu: `@username` · "Sign out"
- Login: heading "Mordomia", tagline (AC-13), tabs "Sign in" / "Sign up", labels "Username" / "Email" / "Password",
  buttons "Sign in" / "Create account" (unchanged).
- Colors: white background, dark text, accent `#C2410C`.

## Out of scope
- Restaurant markers, lists, bottom sheet, search on the map.
- Live location tracking.
- Dark mode (removed).
- Remembering the dismissal of the location notice.
- Restyling any page other than `/` and `/login`.

## Decisions log
| # | Question | Answer | Date |
|---|---|---|---|
| 1 | How should "white background" work? | Always white, app-wide; remove dark mode | 2026-09-30 |
| 2 | Map layout on home | Full-screen map | 2026-09-30 |
| 3 | Center when location is unavailable | Porto, Portugal | 2026-09-30 |
| 4 | Tell the user about the fallback? | Small dismissible notice | 2026-09-30 |
| 5 | What to show at the user's position | Blue dot + recenter button | 2026-09-30 |
| 6 | Live tracking or single reading | One-time reading | 2026-09-30 |
| 7 | Recenter button behavior | Fresh location reading + recenter (re-asks permission) | 2026-09-30 |
| 8 | Restaurant markers in this version | None | 2026-09-30 |
| 9 | Top bar contents | No bar; floating avatar button with menu (@username, Sign out) | 2026-09-30 |
| 10 | Default Google map controls | None, gestures only | 2026-09-30 |
| 11 | Map style | Clean light style, non-restaurant POIs hidden | 2026-09-30 |
| 12 | Initial zoom | 15 when located, 13 on Porto fallback | 2026-09-30 |
| 13 | While waiting for location | Loading spinner, 10 s timeout | 2026-09-30 |
| 14 | Map fails to load | "We couldn't load the map." + "Try again" (reload) | 2026-09-30 |
| 15 | Scope | Home + login polish | 2026-09-30 |
| 16 | Login improvements | Visible labels + tagline, Sign in / Sign up tabs, show/hide password; plus a loading screen when entering the home page | 2026-09-30 |
| 17 | Loading screen look | Logo splash ("Mordomia") + spinner + "Finding your location…" | 2026-09-30 |
| 18 | Accent color | Warm terracotta #C2410C (orange-700) | 2026-09-30 |
| 19 | Fallback notice copy | "Location is off — showing Porto. Enable location to see what's near you." | 2026-09-30 |
| 20 | Notice frequency after dismissal | Every visit (nothing stored) | 2026-09-30 |
| 21 | Google Maps browser key | User will create and provide `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; build proceeds without it (map shows AC-11 error until set) | 2026-09-30 |
| 22 | Feature slug | 002-home-map | 2026-09-30 |
| 23 | (architect OQ-1) Clean map style: cloud Map ID or in-code `styles`? | Cloud Map ID + style created by the user in Google Cloud; new env var `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`; without it the map shows the AC-11 error | 2026-09-30 |
| 24 | (architect OQ-2) Tapping Google's own place icons | Disabled (`clickableIcons={false}`) | 2026-09-30 |
| 25 | (architect OQ-3) Recenter reading fails | Keep map and dot at the last successful location if there was one; move to Porto zoom 13 only if there never was one; the AC-6 notice shows in both cases | 2026-09-30 |
| 26 | (architect OQ-4) Accessible names | Avatar "Account menu", recenter "Recenter map", notice ✕ "Dismiss", password toggle visible "Show"/"Hide" with aria-labels "Show password"/"Hide password" | 2026-09-30 |
