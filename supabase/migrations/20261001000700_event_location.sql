-- An event's location: a restaurant (the same shared rows the map uses). The mordomo may set it when closing the
-- date poll, or later, and may change it any time. While it is not set, everyone going (voted for the chosen day,
-- the mordomo, or said "Vou") may suggest restaurants; the mordomo picks one of them or any other.

alter table public.group_events
  add column location_restaurant_id uuid references public.restaurants (id) on delete set null;

-- Is the caller going to this event (and is it dated)?
create function public.is_going_to_event(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_events e
    join public.group_members m on m.group_id = e.group_id and m.user_id = (select auth.uid()) and m.status = 'member'
    where e.id = eid
      and e.event_date is not null
      and (
        e.mordomo_id = (select auth.uid())
        or exists (
          select 1 from public.group_event_date_votes v
          join public.group_event_date_options o on o.id = v.option_id
          where o.event_id = e.id and o.day = e.event_date and v.user_id = (select auth.uid())
        )
        or exists (
          select 1 from public.group_event_attendance a
          where a.event_id = e.id and a.user_id = (select auth.uid()) and a.going
        )
      )
  );
$$;

revoke execute on function public.is_going_to_event(uuid) from public, anon;
grant execute on function public.is_going_to_event(uuid) to authenticated;

create table public.group_event_location_suggestions (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.group_events (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  suggested_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  unique (event_id, restaurant_id)
);

alter table public.group_event_location_suggestions enable row level security;

create policy "location suggestions: members read" on public.group_event_location_suggestions
  for select to authenticated using (public.in_event_group(event_id));
-- Who is going suggests, while the event has no location.
create policy "location suggestions: going suggest" on public.group_event_location_suggestions
  for insert to authenticated with check (
    suggested_by = (select auth.uid())
    and public.is_going_to_event(event_id)
    and not exists (
      select 1 from public.group_events e where e.id = event_id and e.location_restaurant_id is not null
    )
  );
create policy "location suggestions: withdraw own" on public.group_event_location_suggestions
  for delete to authenticated using (suggested_by = (select auth.uid()));

revoke update on public.group_event_location_suggestions from authenticated, anon;

-- The mordomo sets (or changes, or clears with null) the location of a dated event.
create function public.set_event_location(eid uuid, rid uuid)
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
    raise exception 'only the mordomo of a dated event sets its location' using errcode = '42501';
  end if;
  if rid is not null and not exists (select 1 from public.restaurants r where r.id = rid) then
    raise exception 'restaurant not found' using errcode = 'P0002';
  end if;
  update public.group_events set location_restaurant_id = rid where id = eid;
end;
$$;

revoke execute on function public.set_event_location(uuid, uuid) from public, anon;
grant execute on function public.set_event_location(uuid, uuid) to authenticated;

-- Live event pages see suggestions arrive.
alter publication supabase_realtime add table public.group_event_location_suggestions;
