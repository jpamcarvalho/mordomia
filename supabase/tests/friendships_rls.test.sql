-- AC-10: friendship requests are pending-only from the requester, only the addressee accepts,
-- and there is at most one friendship row per pair of users.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'alice@example.test', '{"username": "alice"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'bob@example.test',   '{"username": "bob"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'carol@example.test', '{"username": "carol"}');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

-- Requests
select throws_ok(
  $$ insert into public.friendships (requester_id, addressee_id, status)
     values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'accepted') $$,
  '42501', null,
  'a request cannot be created already accepted'
);
select throws_ok(
  $$ insert into public.friendships (requester_id, addressee_id, status)
     values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'pending') $$,
  '42501', null,
  'a request cannot be sent on behalf of another user'
);
select lives_ok(
  $$ insert into public.friendships (addressee_id)
     values ('00000000-0000-0000-0000-0000000000b1') $$,
  'a user can send a request (defaults to requester = self, pending)'
);
select is(
  (select status::text from public.friendships
   where requester_id = '00000000-0000-0000-0000-0000000000a1' and addressee_id = '00000000-0000-0000-0000-0000000000b1'),
  'pending',
  'the new request is pending'
);

-- One row per pair
select throws_ok(
  $$ insert into public.friendships (requester_id, addressee_id)
     values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1') $$,
  '23505', null,
  'the same request cannot be sent twice'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';

select throws_ok(
  $$ insert into public.friendships (requester_id, addressee_id)
     values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1') $$,
  '23505', null,
  'a reverse request for an existing pair is rejected'
);

-- Acceptance
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';

select results_eq(
  $$ with u as (update public.friendships set status = 'accepted'
                where requester_id = '00000000-0000-0000-0000-0000000000a1'
                  and addressee_id = '00000000-0000-0000-0000-0000000000b1' returning 1)
     select count(*)::int from u $$,
  $$ values (0) $$,
  'the requester cannot accept their own request'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}';

select results_eq(
  $$ with u as (update public.friendships set status = 'accepted'
                where requester_id = '00000000-0000-0000-0000-0000000000a1'
                  and addressee_id = '00000000-0000-0000-0000-0000000000b1' returning 1)
     select count(*)::int from u $$,
  $$ values (0) $$,
  'a third user cannot accept the request'
);

reset role;
select is(
  (select status::text from public.friendships
   where requester_id = '00000000-0000-0000-0000-0000000000a1' and addressee_id = '00000000-0000-0000-0000-0000000000b1'),
  'pending',
  'the request is still pending after the rejected attempts'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';

select results_eq(
  $$ with u as (update public.friendships set status = 'accepted'
                where requester_id = '00000000-0000-0000-0000-0000000000a1'
                  and addressee_id = '00000000-0000-0000-0000-0000000000b1' returning 1)
     select count(*)::int from u $$,
  $$ values (1) $$,
  'the addressee can accept the request'
);
select throws_ok(
  $$ update public.friendships set status = 'pending'
     where requester_id = '00000000-0000-0000-0000-0000000000a1'
       and addressee_id = '00000000-0000-0000-0000-0000000000b1' $$,
  '42501', null,
  'the addressee cannot set the status back to pending'
);

reset role;
select ok(
  public.are_friends('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1'),
  'after acceptance the users are friends'
);

select * from finish();
rollback;
