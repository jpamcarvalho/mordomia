-- An event's start time (optional): once the restaurant is chosen, the mordomo may set it, change it or clear it
-- until the event is closed. A plain time of day ("20:30") on the event's date; no time zone.

alter table public.group_events add column start_time time;

-- New events never start with a time (it comes after the date and the restaurant).
drop policy "group_events: members create" on public.group_events;
create policy "group_events: members create" on public.group_events
  for insert to authenticated with check (
    public.in_group(group_id, false)
    and created_by = (select auth.uid())
    and (mordomo_id is null or mordomo_id = (select auth.uid()))
    and start_time is null
  );

-- The mordomo sets (or changes, or clears with null) the start time of a dated event with a restaurant.
create function public.set_event_start_time(eid uuid, t time)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.group_events e
    where e.id = eid and e.mordomo_id = (select auth.uid()) and e.event_date is not null
  ) or not public.in_event_group(eid) then
    raise exception 'only the mordomo of a dated event sets its start time' using errcode = '42501';
  end if;
  if exists (select 1 from public.group_events e where e.id = eid and e.closed_at is not null) then
    raise exception 'the event is closed' using errcode = '22023';
  end if;
  if t is not null and not exists (
    select 1 from public.group_events e where e.id = eid and e.location_restaurant_id is not null
  ) then
    raise exception 'choose the restaurant first' using errcode = '22023';
  end if;
  update public.group_events set start_time = t where id = eid;
end;
$$;

revoke execute on function public.set_event_start_time(uuid, time) from public, anon;
grant execute on function public.set_event_start_time(uuid, time) to authenticated;

-- A closed event's start time is frozen too.
create or replace function public.group_event_frozen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.closed_at is not null and (
    (new.title, new.event_date, new.start_time, new.closed_at, new.price_opened_at, new.price_closed_at, new.price_guessed_at)
      is distinct from (old.title, old.event_date, old.start_time, old.closed_at, old.price_opened_at, old.price_closed_at, old.price_guessed_at)
    or (new.mordomo_id is not null and new.mordomo_id is distinct from old.mordomo_id)
    or (new.location_restaurant_id is not null and new.location_restaurant_id is distinct from old.location_restaurant_id)
  ) then
    raise exception 'the event is closed' using errcode = '22023';
  end if;
  return new;
end;
$$;
