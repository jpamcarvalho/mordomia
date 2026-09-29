# Mordomia

Log the restaurants you went to and the ones you want to try, and see where your friends have been.

**Stack:** Next.js 16 (React, TypeScript, Tailwind) · Supabase (Postgres, Auth, Storage) · Google Places + Maps · Vercel

## Privacy model

- **I went**: visible to you and your accepted friends
- **I want to go**: visible only to you
- Friendships are mutual (request → accept)

The database enforces these rules with row-level security (`supabase/migrations/`), not the UI.

## Setup

1. **Supabase**: create a project at supabase.com, then:
   ```sh
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push          # applies supabase/migrations
   npm run db:types              # generates src/lib/database.types.ts
   ```
   In the dashboard → Authentication → URL Configuration, add `http://localhost:3000/auth/confirm`
   (and your production URL) to the redirect URLs.
2. **Google Cloud**: enable *Places API (New)* and *Maps JavaScript API*. Create two keys:
   a server key for Places and a browser key for Maps, restricted to your domains. Set a budget alert.
3. **Env**: `cp .env.example .env.local` and fill it in.
4. **Run**: `npm run dev` → http://localhost:3000

## Structure

```
src/
  proxy.ts                 session refresh + redirect to /login (Next 16 "middleware")
  lib/supabase/            browser, server and proxy clients
  app/login/               sign in / sign up (email + password)
  app/auth/confirm/        email confirmation link target
  app/api/places/          Google Places autocomplete proxy (keeps key server-side)
  app/manifest.ts          PWA manifest (add to home screen)
supabase/migrations/       schema, RLS policies, storage bucket
```

## How we build features

Spec-driven, with agents that never assume. See `CLAUDE.md`.

```
/spec <idea>          grill-me Q&A → specs/NNN-slug/requirements.md → architect → design.md + tasks.md
/implement NNN-slug   implementer agent codes tasks.md, one commit per task
/review NNN-slug      reviewer agent verifies; architect writes the feature README.md
```
Feature index: `specs/README.md` · Architecture: `docs/architecture.md`
