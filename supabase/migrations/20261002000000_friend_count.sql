-- Profile pages show how many friends a person has. Friendships stay private (each user reads only their own rows),
-- so the count comes from this function: it reveals the number, never who the friends are.

create function public.friend_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.friendships f
  where (select auth.uid()) is not null
    and f.status = 'accepted'
    and (f.requester_id = uid or f.addressee_id = uid);
$$;

revoke execute on function public.friend_count(uuid) from public, anon;
grant execute on function public.friend_count(uuid) to authenticated;

-- A person's friends, for the friends list on their profile. Only the person themselves and their friends may see
-- it (same rule as their lists); anyone else gets no rows.
create function public.friends_of(uid uuid)
returns table (id uuid, username text, display_name text, avatar_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path
  from public.friendships f
  join public.profiles p on p.id = case when f.requester_id = uid then f.addressee_id else f.requester_id end
  where f.status = 'accepted'
    and (f.requester_id = uid or f.addressee_id = uid)
    and ((select auth.uid()) = uid or public.are_friends((select auth.uid()), uid))
  order by p.display_name;
$$;

revoke execute on function public.friends_of(uuid) from public, anon;
grant execute on function public.friends_of(uuid) to authenticated;
