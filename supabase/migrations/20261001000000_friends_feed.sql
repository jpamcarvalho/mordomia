-- Mordomia Social feed: accepted friends can read each other's entries on both lists ("saved" = Minha lista,
-- "want" = Quero ir!), with rating and notes. Strangers still see nothing.
--
-- Because friendship now opens a user's lists, two 001 gaps are closed here first:
--   1. friendships: ids and created_at are frozen; status only goes pending → accepted (no forged friendships).
--   2. are_friends(): only answers about pairs that include the caller; not callable by anon.

-- 1. Friendship update guard -------------------------------------------------------------------------------
create function public.friendships_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.requester_id is distinct from old.requester_id
     or new.addressee_id is distinct from old.addressee_id
     or new.created_at is distinct from old.created_at then
    raise exception 'friendships: requester_id, addressee_id and created_at cannot be changed'
      using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and not (old.status = 'pending' and new.status = 'accepted') then
    raise exception 'friendships: status can only change from pending to accepted'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger friendships_guard_update
  before update on public.friendships
  for each row execute function public.friendships_guard_update();

-- 2. are_friends only about the caller's own pairs --------------------------------------------------------
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.uid()) in (a, b), false)
    and exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = a and f.addressee_id = b)
          or (f.requester_id = b and f.addressee_id = a))
    );
$$;

revoke execute on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- 3. Friends read each other's entries (all statuses) -----------------------------------------------------
drop policy "entries: read own or friends' went" on public.entries;
create policy "entries: read own or friends'" on public.entries
  for select to authenticated using (
    user_id = (select auth.uid())
    or public.are_friends((select auth.uid()), user_id)
  );
