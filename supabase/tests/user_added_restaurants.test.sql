-- User-added restaurants: shared with every signed-in user, insert-only, need coordinates and a type.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'adder@example.test', '{"username": "adder"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'other@example.test', '{"username": "other"}');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.restaurants (id, name, kind, lat, lng, user_added)
     values ('00000000-0000-0000-0000-0000000ad001', 'Tasca Nova', 'restaurant', 41.15, -8.61, true) $$,
  'a signed-in user can add a restaurant at a position'
);

select throws_ok(
  $$ insert into public.restaurants (name, kind, user_added) values ('No Coords', 'cafe', true) $$,
  '23514', null,
  'a user-added restaurant without coordinates is rejected'
);

select throws_ok(
  $$ insert into public.restaurants (name, lat, lng, user_added) values ('No Kind', 41.1, -8.6, true) $$,
  '23514', null,
  'a user-added restaurant without a type is rejected'
);

select throws_ok(
  $$ insert into public.restaurants (name, kind, lat, lng, user_added) values ('   ', 'cafe', 41.1, -8.6, true) $$,
  '23514', null,
  'a blank name is rejected'
);

select throws_ok(
  $$ insert into public.restaurants (name, kind, lat, lng, user_added, created_by)
     values ('Spoof', 'cafe', 41.1, -8.6, true, '00000000-0000-0000-0000-0000000000c1') $$,
  '42501', null,
  'a restaurant cannot be added in someone else''s name'
);

-- Another user sees it but cannot change it.
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';

select is(
  (select name from public.restaurants where id = '00000000-0000-0000-0000-0000000ad001'),
  'Tasca Nova',
  'every signed-in user can see a user-added restaurant'
);

update public.restaurants set name = 'Hacked' where id = '00000000-0000-0000-0000-0000000ad001';
select is(
  (select name from public.restaurants where id = '00000000-0000-0000-0000-0000000ad001'),
  'Tasca Nova',
  'other users cannot rename it'
);

select * from finish();
rollback;
