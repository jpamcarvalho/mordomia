# 003 · Free map: MapLibre + OpenFreeMap — Requirements

> Status: draft
> Written by: main session via grill-me · Approved by user on: 2026-09-30

## Summary
002 built the home map on the Google Maps JavaScript API, which needs a key, a Map ID and a billing card. The user
does not want a paid/card-backed map, so 003 replaces the map engine with **MapLibre GL JS** and free
**OpenFreeMap** vector tiles (OpenStreetMap data, no key, no sign-up). Everything else on the home page behaves exactly
as specified in 002 (`specs/002-home-map/requirements.md` AC-3…AC-12, AC-18, Decisions #1–32). All Google **Maps**
code, dependencies and env vars are removed. Google **Places** search (server-side `/api/places`) is not touched.

## User stories
- As the owner, I want the home map to work without a Google key or billing card, so the app costs nothing to run.
- As a user, I want the same home map experience as in 002, on a clean light map that highlights food places.

## Acceptance criteria

### Map engine
- **AC-1** — THE SYSTEM SHALL render the home map with MapLibre GL JS using OpenFreeMap vector tiles, with no API key,
  account or billing.
- **AC-2** — THE SYSTEM SHALL use OpenFreeMap's **Positron** (clean light) style, showing only food-place points of
  interest (restaurants, cafés, bars); all other point-of-interest labels/icons are hidden. Replaces 002 AC-9 and
  002 Decision #23 (cloud Map ID).
- **AC-3** — THE SYSTEM SHALL show the required OpenStreetMap / OpenFreeMap credit as MapLibre's compact attribution
  control: a small ⓘ in a corner that expands to the credit text on tap. This is the only map control shown
  (002 AC-8 otherwise unchanged: no zoom, fullscreen or other controls).
- **AC-4** — THE SYSTEM SHALL disable map rotation and tilt (north always up, flat map); users can pan and
  pinch/scroll-zoom only.

### Unchanged home behavior
- **AC-5** — THE SYSTEM SHALL keep every home-page behavior and copy from 002 unchanged with the new engine: splash
  on `/` only (002 AC-3), single location reading with the overall 10 s cap and late success (002 AC-4, AC-18),
  located view at zoom 15 with the blue dot (002 AC-5), Porto zoom 13 fallback + notice copy and every-visit rule
  (002 AC-6), recenter rules (002 AC-7, Decision #25), no restaurant markers (002 AC-12), tapping map icons does
  nothing (002 Decision #24), floating avatar menu (002 AC-10) and accessible names (002 Decision #26). "Zoom 15"
  and "zoom 13" mean the same visible area as in 002 (the architect maps them to MapLibre's zoom scale).
- **AC-6** — IF the map style or tiles fail to load (network error, OpenFreeMap unavailable) THEN THE SYSTEM SHALL show
  the 002 AC-11 error state: "We couldn't load the map." + "Try again" (reload), with the avatar menu available.

### Removal
- **AC-7** — THE SYSTEM SHALL no longer depend on `@vis.gl/react-google-maps`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` or
  `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`: package, code, env templates and docs references (incl. the Map ID setup steps)
  are removed. `GOOGLE_PLACES_API_KEY` and `/api/places` stay unchanged.

## Privacy & permissions
- No data, table or RLS changes.
- The user's location still stays in the browser. The browser now fetches map style and tiles from OpenFreeMap
  (tile requests reveal the viewed area and the user's IP to OpenFreeMap, as they did to Google in 002).

## UI & copy
- Same as 002 (splash, notice, error, avatar menu, recenter). New: compact ⓘ attribution control.

## Out of scope
- Restaurant markers, lists, search on the map.
- Replacing Google Places search.
- Self-hosting tiles.
- Tests: none written or rewritten (Decision #6); Google-specific tests are deleted.
- Implementation: this round covers the spec, design and architecture only (Decision #8).

## Decisions log
| # | Question | Answer | Date |
|---|---|---|---|
| 1 | Where should the switch to MapLibre live? | New feature 003; close 002 first (002 closed without a round-2 review, 002 Decision #32) | 2026-09-30 |
| 2 | Tile source | OpenFreeMap (free OSM vector tiles, no key) | 2026-09-30 |
| 3 | Map look | Positron, with points of interest limited to food places (restaurants, cafés, bars) | 2026-09-30 |
| 4 | OSM attribution vs. "no controls" | MapLibre compact attribution (ⓘ, expands on tap) | 2026-09-30 |
| 5 | Other home behavior | Identical to 002 | 2026-09-30 |
| 6 | Tests | No tests: delete the Google-specific tests, don't replace them | 2026-09-30 |
| 7 | Rotate / tilt | Disabled (north up, flat) | 2026-09-30 |
| 8 | Scope of this round | Spec + design/architecture only ("update only the architecture"); implementation later | 2026-09-30 |
| 9 | Google Maps code, package, env vars | Remove all of it; Google Places stays | 2026-09-30 |
| 10 | Feature slug | 003-maplibre-map | 2026-09-30 |
