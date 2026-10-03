-- 001 security hardening, gap 2: an entry_photos row may only point at the uploader's own file for that entry,
-- {auth.uid()}/{entry_id}/{filename}. Before, any path was accepted, so someone could register another person's
-- photo path on their own entry and expose that file to their own friends (storage reads follow entry_photos rows).
drop policy "entry_photos: insert own" on public.entry_photos;

create policy "entry_photos: insert own" on public.entry_photos
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid()))
    -- uuids are [0-9a-f-] only, so they need no regex escaping; the filename is non-empty with no further "/".
    and storage_path ~ ('^' || (select auth.uid())::text || '/' || entry_id::text || '/[^/]+$')
  );
