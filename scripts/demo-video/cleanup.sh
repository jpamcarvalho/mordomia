#!/usr/bin/env bash
# Removes all demo data: the group, the four demo users and their avatars; restores the test account.
set -euo pipefail
cd "$(dirname "$0")/../.."
export PATH="$HOME/.local/node/bin:$HOME/.docker/bin:$PATH"
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"
auth=(-H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY")
docker exec -i supabase_db_mordomia psql -U postgres -q < scripts/demo-video/reset.sql
for uid in e0000000-0000-4000-8000-00000000000{1,2,3,4} c8fe7ba8-b653-4e48-bfe2-16cdfbf4687a; do
  curl -s -X DELETE "$API_URL/storage/v1/object/avatars/$uid/demo.png" "${auth[@]}" >/dev/null
done
for i in 1 2 3 4; do
  curl -s -o /dev/null -X DELETE "$API_URL/auth/v1/admin/users/e0000000-0000-4000-8000-00000000000$i" "${auth[@]}"
done
echo "Demo data removed."
