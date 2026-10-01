-- An event's date, chosen by poll: the mordomo picks the candidate days on a calendar, members tick every day
-- that works for them, and the mordomo (only) closes the poll by confirming one of its days as the date.
-- "Vou / Não vou" only opens once the event has a date.

alter table public.group_events add column event_date date;

create table public.group_event_date_options (
  id       uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.group_events (id) on delete cascade,
  day      date not null,
  unique (event_id, day)
);

create table public.group_event_date_votes (
  option_id uuid not null references public.group_event_date_options (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  primary key (option_id, user_id)
);

-- Can the caller vote on this option? A member of the event's group, while the event has no date yet.
create function public.date_option_open(oid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_event_date_options o
    join public.group_events e on e.id = o.event_id
    join public.group_members m on m.group_id = e.group_id
    where o.id = oid and e.event_date is null and m.user_id = (select auth.uid()) and m.status = 'member'
  );
$$;

revoke execute on function public.date_option_open(uuid) from public, anon;
grant execute on function public.date_option_open(uuid) to authenticated;

alter table public.group_event_date_options enable row level security;
alter table public.group_event_date_votes   enable row level security;

-- Options are written only through create_event_date_poll below.
create policy "date options: members read" on public.group_event_date_options
  for select to authenticated using (public.in_event_group(event_id));

create policy "date votes: members read" on public.group_event_date_votes
  for select to authenticated using (
    exists (select 1 from public.group_event_date_options o where o.id = option_id and public.in_event_group(o.event_id))
  );
create policy "date votes: vote while open" on public.group_event_date_votes
  for insert to authenticated with check (user_id = (select auth.uid()) and public.date_option_open(option_id));
create policy "date votes: unvote while open" on public.group_event_date_votes
  for delete to authenticated using (user_id = (select auth.uid()) and public.date_option_open(option_id));

revoke update on public.group_event_date_votes from authenticated, anon;
revoke insert, update, delete on public.group_event_date_options from authenticated, anon;

-- The event's mordomo, while the event has no date: returns the event, or raises.
create function public.event_date_guard(eid uuid)
returns public.group_events
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
  if ev.mordomo_id is distinct from (select auth.uid()) or not public.in_group(ev.group_id, false) then
    raise exception 'only the event''s mordomo can do this' using errcode = '42501';
  end if;
  if ev.event_date is not null then
    raise exception 'the event already has a date' using errcode = '23505';
  end if;
  return ev;
end;
$$;

revoke execute on function public.event_date_guard(uuid) from public, anon, authenticated;

-- The mordomo opens the poll with 1–31 days from yesterday on (one day of slack for time zones). Once.
create function public.create_event_date_poll(eid uuid, days date[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.group_events := public.event_date_guard(eid);
  picked date[] := array(select distinct d from unnest(days) as d where d is not null order by d);
begin
  if exists (select 1 from public.group_event_date_options where event_id = eid) then
    raise exception 'the event already has a date poll' using errcode = '23505';
  end if;
  if cardinality(picked) not between 1 and 31 then
    raise exception 'choose between 1 and 31 days' using errcode = '22023';
  end if;
  if picked[1] < current_date - 1 then
    raise exception 'days must not be in the past' using errcode = '22023';
  end if;
  insert into public.group_event_date_options (event_id, day) select ev.id, d from unnest(picked) as d;
end;
$$;

-- The mordomo closes the poll: one of its days becomes the event's date (votes stay, for the record).
create function public.close_event_date_poll(eid uuid, chosen date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.group_events := public.event_date_guard(eid);
begin
  if not exists (select 1 from public.group_event_date_options where event_id = ev.id and day = chosen) then
    raise exception 'the date must be one of the poll''s days' using errcode = '22023';
  end if;
  update public.group_events set event_date = chosen where id = ev.id and event_date is null;
end;
$$;

revoke execute on function public.create_event_date_poll(uuid, date[]) from public, anon;
revoke execute on function public.close_event_date_poll(uuid, date) from public, anon;
grant execute on function public.create_event_date_poll(uuid, date[]) to authenticated;
grant execute on function public.close_event_date_poll(uuid, date) to authenticated;

-- Vou / Não vou only once the event has a date.
create function public.event_has_date(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.group_events e where e.id = eid and e.event_date is not null);
$$;

revoke execute on function public.event_has_date(uuid) from public, anon;
grant execute on function public.event_has_date(uuid) to authenticated;

drop policy "group_event_responses: answer own" on public.group_event_responses;
create policy "group_event_responses: answer own" on public.group_event_responses
  for insert to authenticated with check (
    user_id = (select auth.uid()) and public.in_event_group(event_id) and public.event_has_date(event_id)
  );
drop policy "group_event_responses: change own" on public.group_event_responses;
create policy "group_event_responses: change own" on public.group_event_responses
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.in_event_group(event_id) and public.event_has_date(event_id));
