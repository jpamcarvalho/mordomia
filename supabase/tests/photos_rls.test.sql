-- AC-11: entry photos are readable only when their entry is readable, and uploads go only
-- into the uploader's own {user_id}/ folder of the entry-photos bucket.
begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

-- Users: owner, accepted friend, stranger
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test',    '{"username": "owner"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'friend@example.test',   '{"username": "friend"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'stranger@example.test', '{"username": "stranger"}');

insert into public.friendships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'accepted');

insert into public.restaurants (id, google_place_id, name, created_by) values
  ('00000000-0000-0000-0000-00000000e001', 'place-went', 'Went Place', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000e002', 'place-want', 'Want Place', '00000000-0000-0000-0000-0000000000a1');

insert into public.entries (id, user_id, restaurant_id, status) values
  ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000e001', 'went'),
  ('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000e002', 'want'),
  ('00000000-0000-0000-0000-0000000e00f1', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000e001', 'went');

insert into public.entry_photos (entry_id, user_id, storage_path) values
  ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-0000000e0001/went.jpg'),
  ('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-0000000000a1',
   '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-0000000e0002/want.jpg');

insert into storage.objects (bucket_id, name, owner) values
  ('entry-photos', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-0000000e0001/went.jpg', '00000000-0000-0000-0000-0000000000a1'),
  ('entry-photos', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-0000000e0002/want.jpg', '00000000-0000-0000-0000-0000000000a1');

set local role authenticated;

-- ---------------------------------------------------------------------------
-- Reading entry_photos rows and storage objects
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select is((select count(*)::int from public.entry_photos), 2, 'owner reads both photo rows');
select is((select count(*)::int from storage.objects where bucket_id = 'entry-photos'), 2, 'owner reads both photo files');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated"}';

select results_eq(
  $$ select entry_id from public.entry_photos $$,
  $$ values ('00000000-0000-0000-0000-0000000e0001'::uuid) $$,
  'friend reads only the photo row of the went entry'
);
select results_eq(
  $$ select name from storage.objects where bucket_id = 'entry-photos' $$,
  $$ values ('00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-0000000e0001/went.jpg'::text) $$,
  'friend reads only the photo file of the went entry'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';

select is((select count(*)::int from public.entry_photos), 0, 'stranger reads no photo rows');
select is((select count(*)::int from storage.objects where bucket_id = 'entry-photos'), 0, 'stranger reads no photo files');

-- ---------------------------------------------------------------------------
-- Writing entry_photos rows
-- ---------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.entry_photos (entry_id, storage_path)
     values ('00000000-0000-0000-0000-0000000e0001',
             '00000000-0000-0000-0000-0000000000f1/00000000-0000-0000-0000-0000000e0001/x.jpg') $$,
  '42501', null,
  'a friend cannot attach a photo to another user''s entry'
);
select lives_ok(
  $$ insert into public.entry_photos (entry_id, storage_path)
     values ('00000000-0000-0000-0000-0000000e00f1',
             '00000000-0000-0000-0000-0000000000f1/00000000-0000-0000-0000-0000000e00f1/mine.jpg') $$,
  'a user can attach a photo to their own entry'
);
select results_eq(
  $$ with d as (delete from public.entry_photos where entry_id = '00000000-0000-0000-0000-0000000e0001' returning 1)
     select count(*)::int from d $$,
  $$ values (0) $$,
  'a friend cannot delete another user''s photo row'
);

-- ---------------------------------------------------------------------------
-- Uploading / deleting storage objects
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('entry-photos', '00000000-0000-0000-0000-0000000000f1/00000000-0000-0000-0000-0000000e00f1/mine.jpg',
             '00000000-0000-0000-0000-0000000000f1') $$,
  'a user can upload into their own folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('entry-photos', '00000000-0000-0000-0000-0000000000a1/00000000-0000-0000-0000-0000000e0001/evil.jpg',
             '00000000-0000-0000-0000-0000000000f1') $$,
  '42501', null,
  'a user cannot upload into another user''s folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('entry-photos', 'evil.jpg', '00000000-0000-0000-0000-0000000000f1') $$,
  '42501', null,
  'a user cannot upload outside a user folder'
);
-- A stranger still cannot read the friend's new photo (no friendship)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';

select is((select count(*)::int from storage.objects where bucket_id = 'entry-photos'), 0, 'stranger still reads no photo files');

-- The owner (a friend of the uploader) can read it
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select is(
  (select count(*)::int from storage.objects
   where name = '00000000-0000-0000-0000-0000000000f1/00000000-0000-0000-0000-0000000e00f1/mine.jpg'),
  1,
  'a friend can read the photo file of a went entry'
);

select * from finish();
rollback;
