-- AC-6, AC-7, AC-8, AC-9: entries visibility and ownership.
begin;
create extension if not exists pgtap with schema extensions;

select plan(22);

-- Users: owner, accepted friend, pending friend, stranger
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.test',    '{"username": "owner"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'friend@example.test',   '{"username": "friend"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'pending@example.test',  '{"username": "pending"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'stranger@example.test', '{"username": "stranger"}');

insert into public.friendships (requester_id, addressee_id, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'accepted'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'pending');

insert into public.restaurants (id, google_place_id, name, created_by) values
  ('00000000-0000-0000-0000-00000000e001', 'place-went', 'Went Place', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000e002', 'place-want', 'Want Place', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000e003', 'place-free', 'Free Place', '00000000-0000-0000-0000-0000000000a1');

insert into public.entries (id, user_id, restaurant_id, status, rating, notes) values
  ('00000000-0000-0000-0000-0000000e0001', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000e001', 'went', 4, 'original'),
  ('00000000-0000-0000-0000-0000000e0002', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000e002', 'want', null, 'original');

-- ---------------------------------------------------------------------------
-- AC-6 / AC-7: visibility
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select is((select count(*)::int from public.entries where status = 'want'), 1, 'owner reads own want entry');
select is((select count(*)::int from public.entries where status = 'went'), 1, 'owner reads own went entry');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated"}';

select is((select count(*)::int from public.entries where status = 'went'), 1, 'accepted friend reads went entry');
select is((select count(*)::int from public.entries where status = 'want'), 0, 'accepted friend cannot read want entry');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';

select is((select count(*)::int from public.entries where status = 'went'), 0, 'pending friend cannot read went entry');
select is((select count(*)::int from public.entries where status = 'want'), 0, 'pending friend cannot read want entry');

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';

select is((select count(*)::int from public.entries where status = 'went'), 0, 'stranger cannot read went entry');
select is((select count(*)::int from public.entries where status = 'want'), 0, 'stranger cannot read want entry');

-- ---------------------------------------------------------------------------
-- AC-8: only the owner writes their entries
-- ---------------------------------------------------------------------------
-- Stranger
select throws_ok(
  $$ insert into public.entries (user_id, restaurant_id, status)
     values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000e003', 'want') $$,
  '42501', null,
  'stranger cannot insert an entry for another user'
);
select results_eq(
  $$ with u as (update public.entries set notes = 'hacked' where user_id = '00000000-0000-0000-0000-0000000000a1' returning 1)
     select count(*)::int from u $$,
  $$ values (0) $$,
  'stranger cannot update another user''s entries'
);
select results_eq(
  $$ with d as (delete from public.entries where user_id = '00000000-0000-0000-0000-0000000000a1' returning 1)
     select count(*)::int from d $$,
  $$ values (0) $$,
  'stranger cannot delete another user''s entries'
);

-- Accepted friend (can read the went entry, but not write it)
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.entries (user_id, restaurant_id, status)
     values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000e003', 'want') $$,
  '42501', null,
  'friend cannot insert an entry for another user'
);
select results_eq(
  $$ with u as (update public.entries set notes = 'hacked' where id = '00000000-0000-0000-0000-0000000e0001' returning 1)
     select count(*)::int from u $$,
  $$ values (0) $$,
  'friend cannot update a visible went entry of another user'
);
select results_eq(
  $$ with d as (delete from public.entries where id = '00000000-0000-0000-0000-0000000e0001' returning 1)
     select count(*)::int from d $$,
  $$ values (0) $$,
  'friend cannot delete a visible went entry of another user'
);

-- Nothing changed
reset role;
select is(
  (select count(*)::int from public.entries where user_id = '00000000-0000-0000-0000-0000000000a1' and notes = 'original'),
  2,
  'owner entries are unchanged after the attempts by others'
);

-- Owner can write their own entries
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.entries (id, restaurant_id, status)
     values ('00000000-0000-0000-0000-0000000e0003', '00000000-0000-0000-0000-00000000e003', 'want') $$,
  'owner can insert own entry'
);
select results_eq(
  $$ with u as (update public.entries set notes = 'mine' where id = '00000000-0000-0000-0000-0000000e0003' returning 1)
     select count(*)::int from u $$,
  $$ values (1) $$,
  'owner can update own entry'
);
select results_eq(
  $$ with d as (delete from public.entries where id = '00000000-0000-0000-0000-0000000e0003' returning 1)
     select count(*)::int from d $$,
  $$ values (1) $$,
  'owner can delete own entry'
);

-- ---------------------------------------------------------------------------
-- AC-9: no rating on a want entry
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.entries (restaurant_id, status, rating)
     values ('00000000-0000-0000-0000-00000000e003', 'want', 3) $$,
  '23514', null,
  'inserting a want entry with a rating is rejected'
);
select throws_ok(
  $$ update public.entries set rating = 5 where id = '00000000-0000-0000-0000-0000000e0002' $$,
  '23514', null,
  'rating a want entry is rejected'
);
select throws_ok(
  $$ update public.entries set status = 'want' where id = '00000000-0000-0000-0000-0000000e0001' $$,
  '23514', null,
  'turning a rated went entry into want without clearing the rating is rejected'
);
select lives_ok(
  $$ insert into public.entries (restaurant_id, status, rating)
     values ('00000000-0000-0000-0000-00000000e003', 'went', 5) $$,
  'a went entry may have a rating'
);

select * from finish();
rollback;
