#!/usr/bin/env bash
# Records the tour (needs the dev server on :3000 and setup.sh done) and encodes a 60 s MP4.
# A recording changes the data (guess, reveal, close…): run reset.sql + seed.sql (or setup.sh) before each take.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$HOME/.local/node/bin:$HOME/.docker/bin:$PATH"
OUT="${OUT:-/tmp/mordomia-demo}"; LENGTH="${LENGTH:-60}"; export OUT
docker exec -i supabase_db_mordomia psql -U postgres -q < scripts/demo-video/reset.sql
docker exec -i supabase_db_mordomia psql -U postgres -q -v ON_ERROR_STOP=1 < scripts/demo-video/seed.sql
rm -rf "$OUT/frames"; mkdir -p "$OUT/frames"
# Run from the repo so Node finds Playwright.
cp scripts/demo-video/record.mjs .demo-record.mjs
node .demo-record.mjs | tee "$OUT/record.log"; rm -f .demo-record.mjs

# A full ffmpeg (Playwright's only writes VP8) from pip, once.
[ -d "$OUT/pyff" ] || python3 -m pip install -q --target "$OUT/pyff" imageio-ffmpeg
FF=$(ls "$OUT"/pyff/imageio_ffmpeg/binaries/ffmpeg-*)
SPAN=$(grep -o 'span [0-9.]*' "$OUT/record.log" | cut -d' ' -f2)
FACTOR=$(python3 -c "print(min(1, ($LENGTH - 0.2) / $SPAN))")
"$FF" -hide_banner -loglevel error -y -f concat -safe 0 -i "$OUT/frames.txt" \
  -vf "setpts=PTS*$FACTOR,scale=824:1678:flags=lanczos,fps=30,format=yuv420p" -t "$LENGTH" \
  -c:v libx264 -preset slow -crf 19 -movflags +faststart "$OUT/mordomia-demo.mp4"
echo "Video: $OUT/mordomia-demo.mp4"
