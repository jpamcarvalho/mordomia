-- Choosing an event's mordomo (its admin) after creation: the event's creator (or the group owner) names a
-- member, or the event's creator (only) rolls the dice and the database picks a random member. Only while the
-- event has no mordomo yet.
-- The table keeps no update grant: these two functions are the only way to set it.

-- Can the caller choose this event's mordomo? The event's creator always; the group owner too when
-- `owner_ok`. Returns the event's group, or raises.
create function public.event_mordomo_guard(eid uuid, owner_ok boolean)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ev public.group_events;
begin
  select * into ev from public.group_events where id = eid;
  if ev.id is null then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if ev.mordomo_id is not null then
    raise exception 'event already has a mordomo' using errcode = '23505';
  end if;
  if not (
    public.in_group(ev.group_id, false)
    and (ev.created_by = (select auth.uid()) or (owner_ok and public.owns_group(ev.group_id)))
  ) then
    raise exception 'not allowed to choose this event''s mordomo' using errcode = '42501';
  end if;
  return ev.group_id;
end;
$$;

revoke execute on function public.event_mordomo_guard(uuid, boolean) from public, anon, authenticated;

-- Names a member of the group as the mordomo (event creator or group owner).
create function public.set_event_mordomo(eid uuid, uid uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid := public.event_mordomo_guard(eid, true);
begin
  if not exists (
    select 1 from public.group_members m where m.group_id = gid and m.user_id = uid and m.status = 'member'
  ) then
    raise exception 'the mordomo must be a member of the group' using errcode = '42501';
  end if;
  update public.group_events set mordomo_id = uid where id = eid and mordomo_id is null;
  if not found then
    raise exception 'event already has a mordomo' using errcode = '23505';
  end if;
  return uid;
end;
$$;

-- The dice (event creator only): a random member of the group becomes the mordomo.
create function public.roll_event_mordomo(eid uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid := public.event_mordomo_guard(eid, false);
  picked uuid;
begin
  select m.user_id into picked
  from public.group_members m
  where m.group_id = gid and m.status = 'member'
  order by random()
  limit 1;
  update public.group_events set mordomo_id = picked where id = eid and mordomo_id is null;
  if not found then
    raise exception 'event already has a mordomo' using errcode = '23505';
  end if;
  return picked;
end;
$$;

revoke execute on function public.set_event_mordomo(uuid, uuid) from public, anon;
revoke execute on function public.roll_event_mordomo(uuid) from public, anon;
grant execute on function public.set_event_mordomo(uuid, uuid) to authenticated;
grant execute on function public.roll_event_mordomo(uuid) to authenticated;
