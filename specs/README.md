# Specs

One folder per feature: `NNN-slug/` with `requirements.md` → `design.md` → `tasks.md` → `README.md` (after review).
Templates: `_templates/`. Workflow: see `CLAUDE.md` (`/spec`, `/implement`, `/review`).

Status: `draft` → `specced` → `implementing` → `review` → `done`

| ID | Feature | Status | Notes |
|---|---|---|---|
| [000](000-foundation/) | Foundation: scaffold, auth, schema, RLS, Places proxy, test tooling | done | closed with known RLS gaps (see README), fixed in 001 |
| [001](001-security-hardening/) | Security hardening: RLS fixes from 000 review (friendship forge, photo path binding, private friend graph) + minor findings + proxy path matching | specced | design + 9 tasks approved 2026-09-29 |
| [002](002-home-map/) | Home map, light theme, login polish: full-screen geolocated map home, no dark mode, friendlier login | done | closed 2026-09-30 without round-2 review (Decision #32); map engine replaced in 003 |
| [003](003-maplibre-map/) | Free map: replace Google Maps with MapLibre + OpenFreeMap (no key), same home behavior as 002 | draft | built without finishing the spec; see `docs/architecture.md` §11 |

Built outside the spec flow (user's choice, 2026-09-30), documented only in `docs/architecture.md` §11–12:
lists and place popup, fork menu, new restaurants (several types), Portuguese UI, account page, list filters
(type, rating), search country picker, production deploy.
