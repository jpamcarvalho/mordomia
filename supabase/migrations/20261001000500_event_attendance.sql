-- Attendance once an event has a date ("Habemus data"):
--   * who voted for the chosen day, and the mordomo, are going (locked in);
--   * every other member of the group answers "Vou" or "Não vou"; "Não vou" takes them out of the event
--     (not out of the group), and coming back needs the mordomo: they ask, the mordomo accepts or declines.
-- This replaces the old "Vou / Não vou" (group_event_responses), which did not depend on the date poll.

drop table public.group_event_responses;
drop function public.event_has_date(uuid);

create table public.group_event_attendance (
  event_id            uuid not null references public.group_events (id) on delete cascade,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  going               boolean not null,
  -- Set while someone who said "Não vou" asks the mordomo to come back.
  rejoin_requested_at timestamptz,
  updated_at          timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.group_event_attendance enable row level security;

-- Read by the group's members; written only through the functions below.
create policy "event attendance: members read" on public.group_event_attendance
  for select to authenticated using (public.in_event_group(event_id));

revoke insert, update, delete on public.group_event_attendance from authenticated, anon;

-- I answer "Vou" / "Não vou": the event has a date, I am a member, not its mordomo, did not vote for the chosen
-- day, and have not said "Não vou" already (coming back goes through the mordomo).
create function public.answer_group_event(eid uuid, going boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.group_events;
  me uuid := (select auth.uid());
begin
  select * into ev from public.group_events where id = eid;
  if ev.id is null or not public.in_group(ev.group_id, false) then
    raise exception 'event not found' using errcode = 'P0002';
  end if;
  if ev.event_date is null then
    raise exception 'the event has no date yet' using errcode = '22023';
  end if;
  if ev.mordomo_id = me or exists (
    select 1 from public.group_event_date_votes v
    join public.group_event_date_options o on o.id = v.option_id
    where o.event_id = eid and o.day = ev.event_date and v.user_id = me
  ) then
    raise exception 'already going: voted for the chosen day or is the mordomo' using errcode = '42501';
  end if;
  if exists (select 1 from public.group_event_attendance a where a.event_id = eid and a.user_id = me and not a.going) then
    raise exception 'said "Não vou": ask the mordomo to come back' using errcode = '42501';
  end if;
  insert into public.group_event_attendance (event_id, user_id, going) values (eid, me, going)
  on conflict (event_id, user_id) do update set going = excluded.going, updated_at = now();
end;
$$;

-- After "Não vou": ask the mordomo to come back.
create function public.request_group_event_rejoin(eid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.group_event_attendance
  set rejoin_requested_at = now(), updated_at = now()
  where event_id = eid and user_id = (select auth.uid()) and not going and public.in_event_group(eid);
  if not found then
    raise exception 'you did not leave this event' using errcode = 'P0002';
  end if;
end;
$$;

-- The mordomo accepts (back in, going) or declines (stays out) a request to come back.
create function public.answer_group_event_rejoin(eid uuid, uid uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.group_events e where e.id = eid and e.mordomo_id = (select auth.uid())
  ) or not public.in_event_group(eid) then
    raise exception 'only the event''s mordomo answers' using errcode = '42501';
  end if;
  update public.group_event_attendance
  set going = accept, rejoin_requested_at = null, updated_at = now()
  where event_id = eid and user_id = uid and not going and rejoin_requested_at is not null;
  if not found then
    raise exception 'no request to answer' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.answer_group_event(uuid, boolean) from public, anon;
revoke execute on function public.request_group_event_rejoin(uuid) from public, anon;
revoke execute on function public.answer_group_event_rejoin(uuid, uuid, boolean) from public, anon;
grant execute on function public.answer_group_event(uuid, boolean) to authenticated;
grant execute on function public.request_group_event_rejoin(uuid) to authenticated;
grant execute on function public.answer_group_event_rejoin(uuid, uuid, boolean) to authenticated;
