#!/usr/bin/env bash
# Creates the four demo friends (Ana, Miguel, Inês, Rui) with illustrated avatars, gives the test account its
# "Tiago Martins" avatar, and seeds the demo data (friends, feed, group "Os Comilões" and its events).
# Local Supabase only. Undo with cleanup.sh.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$HOME/.local/node/bin:$HOME/.docker/bin:$PATH"
OUT="${OUT:-/tmp/mordomia-demo}"; mkdir -p "$OUT/av"
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
auth=(-H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY")
TESTE=c8fe7ba8-b653-4e48-bfe2-16cdfbf4687a

avatar() { # seed, user id
  curl -sf "https://api.dicebear.com/9.x/notionists/png?size=256&seed=$1" -o "$OUT/av/$2.png"
  curl -s -X POST "$API_URL/storage/v1/object/avatars/$2/demo.png" "${auth[@]}" -H "Content-Type: image/png" -H "x-upsert: true" \
    --data-binary "@$OUT/av/$2.png" >/dev/null
}

i=1
for u in "ana_ribeiro|Ana Ribeiro|Ana&backgroundColor=ffd5dc" "miguel_sousa|Miguel Sousa|Miguel&backgroundColor=c0aede" \
         "ines_costa|Inês Costa|Ines&backgroundColor=b6e3f4" "rui_almeida|Rui Almeida|Rui&backgroundColor=d1f4d9"; do
  IFS='|' read -r name disp seed <<<"$u"
  uid="e0000000-0000-4000-8000-00000000000$i"
  curl -s -X POST "$API_URL/auth/v1/admin/users" "${auth[@]}" -H "Content-Type: application/json" \
    -d "{\"id\":\"$uid\",\"email\":\"$name@demo.mordomia.local\",\"password\":\"demo-$RANDOM$RANDOM\",\"email_confirm\":true,\"user_metadata\":{\"username\":\"$name\",\"display_name\":\"$disp\"}}" >/dev/null
  avatar "$seed" "$uid"
  docker exec supabase_db_mordomia psql -U postgres -qtAc "update profiles set avatar_path='$uid/demo.png' where id='$uid'"
  i=$((i + 1))
done
avatar "Tiago&backgroundColor=ffdfbf" "$TESTE"

docker exec -i supabase_db_mordomia psql -U postgres -q < scripts/demo-video/reset.sql
docker exec -i supabase_db_mordomia psql -U postgres -q -v ON_ERROR_STOP=1 < scripts/demo-video/seed.sql
echo "Demo data ready."
