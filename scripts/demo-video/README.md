# Demo video

A scripted 60 s phone-portrait tour of the app, recorded from the local dev server with realistic demo data.

1. `npx supabase start` and `npm run dev` (port 3000).
2. `scripts/demo-video/setup.sh` — demo friends (Ana Ribeiro, Miguel Sousa, Inês Costa, Rui Almeida) with
   illustrated avatars; the test account plays "Tiago Martins"; group "Os Comilões" with its events.
3. `scripts/demo-video/record.sh` — resets the seed, records, encodes `$OUT/mordomia-demo.mp4`
   (`OUT` defaults to `/tmp/mordomia-demo`, `LENGTH` to 60). Each take re-seeds, so it can be re-run.
4. `scripts/demo-video/cleanup.sh` — removes everything and restores "Conta Teste".

Scenes and captions live in `record.mjs`; the data in `seed.sql` (`reset.sql` undoes it).
New scene: seed what it needs in `seed.sql`, add a step in `record.mjs` that waits for the page's content
(`ready(...)`) before its caption, then check frames (`ffmpeg -vf "fps=1/2.5,scale=160:-1,tile=12x2"`).

Notes:
- Chromium runs headed (window off-screen): headless screencasts come out at 412×839, headed at 2× (824×1678).
- Frames come from the CDP screencast with timestamps and are joined with ffmpeg's concat demuxer.
- `reset.sql` also deletes test-account entries created after 2026-10-02 23:20 (the demo's own saves).
