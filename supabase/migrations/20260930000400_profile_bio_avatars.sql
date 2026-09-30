-- Account page: a short "about me" and a profile photo.
-- Both follow the profiles read policy (any signed-in user); only the owner can change them.
alter table public.profiles
  add column bio text check (char_length(bio) <= 160);

-- Profile photos live in a private bucket at {user_id}/{filename}; the app shows them through signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "avatars: read" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');
create policy "avatars: upload to own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "avatars: delete own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- avatar_path must point inside the owner's own folder (no borrowing someone else's photo).
alter table public.profiles
  add constraint profiles_avatar_path_check check (
    avatar_path is null or avatar_path like id::text || '/%'
  );
