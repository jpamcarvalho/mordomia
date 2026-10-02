-- The mordomo closes ("encerra") a dated event once it is over. A closed event is frozen: nothing about it changes
-- any more (attendance, location, Preço certo, the event row itself); it can still be deleted. A Preço certo that
-- was opened must be revealed first, so it is never left without a result.

alter table public.group_events add column closed_at timestamptz;

create function public.close_group_event(eid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ev public.group_events;
begin
  select * into ev from public.group_events where id = eid;
  if ev.id is null or ev.mordomo_id is distinct from (select auth.uid()) or ev.event_date is null
     or not public.in_event_group(eid) then
    raise exception 'only the mordomo of a dated event closes it' using errcode = '42501';
  end if;
  if ev.closed_at is not null then
    raise exception 'the event is already closed' using errcode = '22023';
  end if;
  if ev.price_opened_at is not null and not exists (select 1 from public.group_event_bills b where b.event_id = eid) then
    raise exception 'reveal the Preço certo first' using errcode = '22023';
  end if;
  update public.group_events set closed_at = now() where id = eid;
end;
$$;

revoke execute on function public.close_group_event(uuid) from public, anon;
grant execute on function public.close_group_event(uuid) to authenticated;

-- Freezes a closed event: its row no longer changes (a person or restaurant being deleted may still clear a link).
create function public.group_event_frozen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.closed_at is not null and (
    (new.title, new.event_date, new.closed_at, new.price_opened_at, new.price_closed_at, new.price_guessed_at)
      is distinct from (old.title, old.event_date, old.closed_at, old.price_opened_at, old.price_closed_at, old.price_guessed_at)
    or (new.mordomo_id is not null and new.mordomo_id is distinct from old.mordomo_id)
    or (new.location_restaurant_id is not null and new.location_restaurant_id is distinct from old.location_restaurant_id)
  ) then
    raise exception 'the event is closed' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger group_events_frozen before update on public.group_events
  for each row execute function public.group_event_frozen();

-- ...and no new rows hanging off it, nor changed answers or guesses.
create function public.group_event_child_frozen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.group_events e where e.id = new.event_id and e.closed_at is not null) then
    raise exception 'the event is closed' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger group_event_attendance_frozen before insert or update on public.group_event_attendance
  for each row execute function public.group_event_child_frozen();
create trigger group_event_location_suggestions_frozen before insert on public.group_event_location_suggestions
  for each row execute function public.group_event_child_frozen();
create trigger group_event_price_guesses_frozen before insert or update on public.group_event_price_guesses
  for each row execute function public.group_event_child_frozen();
create trigger group_event_bills_frozen before insert on public.group_event_bills
  for each row execute function public.group_event_child_frozen();
create trigger group_event_date_options_frozen before insert on public.group_event_date_options
  for each row execute function public.group_event_child_frozen();
