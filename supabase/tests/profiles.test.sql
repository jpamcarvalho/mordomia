-- AC-3: signing up with a username creates a lowercased profiles row.
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000a001', 'mixed@example.test', '{"username": "Mixed_Case1"}');

select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000a001'),
  1,
  'a profiles row is created for the new auth user'
);

select is(
  (select username from public.profiles where id = '00000000-0000-0000-0000-00000000a001'),
  'mixed_case1',
  'the username is stored lowercased'
);

insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-0000-0000-00000000a002', 'lower@example.test', '{"username": "plain_user"}');

select is(
  (select username from public.profiles where id = '00000000-0000-0000-0000-00000000a002'),
  'plain_user',
  'a lowercase username is stored as-is'
);

select * from finish();
rollback;
