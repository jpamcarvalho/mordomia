# Specs

One folder per feature: `NNN-slug/` with `requirements.md` → `design.md` → `tasks.md` → `README.md` (after review).
Templates: `_templates/`. Workflow: see `CLAUDE.md` (`/spec`, `/implement`, `/review`).

Status: `draft` → `specced` → `implementing` → `review` → `done`

| ID | Feature | Status | Notes |
|---|---|---|---|
| [000](000-foundation/) | Foundation: scaffold, auth, schema, RLS, Places proxy, test tooling | done | closed with known RLS gaps (see README), fixed in 001 |
| [001](001-security-hardening/) | Security hardening: RLS fixes from 000 review (friendship forge, photo path binding, private friend graph) + minor findings + proxy path matching | specced | design + 9 tasks approved 2026-09-29 |
| [002](002-home-map/) | Home map, light theme, login polish: full-screen geolocated map home, no dark mode, friendlier login | implementing | design + 7 tasks approved 2026-09-30; needs user's Maps key + Map ID for the manual check |
