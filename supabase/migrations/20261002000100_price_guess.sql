-- "Preço certo": the mordomo of a dated event opens it; everyone going guesses the final price per person; the
-- mordomo closes the guesses (and may reopen them), then types the bill (total and number of people) and reveals
-- it. The winner is the highest guess not above total / people (ties: the earliest guess). Guesses are secret
-- until the reveal; the reveal is final.

alter table public.group_events
  add column price_opened_at timestamptz,
  add column price_closed_at timestamptz,
  -- Who guessed is visible before the reveal (not how much). Each guess touches this so live pages refresh.
  add column price_guessed_at timestamptz;

create table public.group_event_price_guesses (
  event_id   uuid not null references public.group_events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     numeric(8, 2) not null check (amount > 0 and amount <= 10000),
  -- When the current guess was made (changing it starts over): breaks ties.
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.group_event_bills (
  event_id    uuid primary key references public.group_events (id) on delete cascade,
  total       numeric(10, 2) not null check (total > 0 and total <= 1000000),
  people      integer not null check (people between 1 and 500),
  revealed_by uuid references public.profiles (id) on delete set null,
  revealed_at timestamptz not null default now()
);

alter table public.group_event_price_guesses enable row level security;
alter table public.group_event_bills enable row level security;

-- My own guess always; everyone's once the bill is revealed.
create policy "price guesses: own or revealed" on public.group_event_price_guesses
  for select to authenticated using (
    user_id = (select auth.uid())
    or (public.in_event_group(event_id) and exists (select 1 from public.group_event_bills b where b.event_id = group_event_price_guesses.event_id))
  );
create policy "event bills: members read" on public.group_event_bills
  for select to authenticated using (public.in_event_group(event_id));

-- Written only through the functions below.
revoke insert, update, delete on public.group_event_price_guesses from authenticated, anon;
revoke insert, update, delete on public.group_event_bills from authenticated, anon;

-- Who has guessed (no amounts) in these events; only the events of my groups.
create function public.event_price_guessers(eids uuid[])
returns table (event_id uuid, user_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select g.event_id, g.user_id, g.created_at
  from public.group_event_price_guesses g
  where g.event_id = any(eids) and public.in_event_group(g.event_id);
$$;

-- The mordomo of a dated event opens (or reopens) the guesses, or closes them; not after the reveal.
create function public.set_event_price_game(eid uuid, open boolean)
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
    raise exception 'only the mordomo of a dated event opens or closes the Preço certo' using errcode = '42501';
  end if;
  if exists (select 1 from public.group_event_bills b where b.event_id = eid) then
    raise exception 'the bill is already revealed' using errcode = '22023';
  end if;
  if open then
    update public.group_events set price_opened_at = coalesce(price_opened_at, now()), price_closed_at = null where id = eid;
  else
    update public.group_events set price_closed_at = now() where id = eid and price_opened_at is not null and price_closed_at is null;
    if not found then
      raise exception 'the Preço certo is not open' using errcode = '22023';
    end if;
  end if;
end;
$$;

-- I guess (or change my guess) while I am going and the guesses are open.
create function public.guess_event_price(eid uuid, guess numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_going_to_event(eid) then
    raise exception 'only who is going guesses' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.group_events e where e.id = eid and e.price_opened_at is not null and e.price_closed_at is null
  ) or exists (select 1 from public.group_event_bills b where b.event_id = eid) then
    raise exception 'the guesses are not open' using errcode = '22023';
  end if;
  if guess is null or guess <= 0 or guess > 10000 then
    raise exception 'invalid guess' using errcode = '22023';
  end if;
  insert into public.group_event_price_guesses (event_id, user_id, amount)
  values (eid, (select auth.uid()), round(guess, 2))
  on conflict (event_id, user_id) do update set amount = excluded.amount, created_at = now()
  where public.group_event_price_guesses.amount <> excluded.amount;
  update public.group_events set price_guessed_at = now() where id = eid;
end;
$$;

-- The mordomo of a dated event reveals the bill, once, after closing the guesses.
create function public.reveal_event_bill(eid uuid, bill_total numeric, bill_people integer)
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
    raise exception 'only the mordomo of a dated event reveals the bill' using errcode = '42501';
  end if;
  if not exists (select 1 from public.group_events e where e.id = eid and e.price_closed_at is not null) then
    raise exception 'close the guesses first' using errcode = '22023';
  end if;
  if bill_total is null or bill_total <= 0 or bill_total > 1000000 or bill_people is null or bill_people not between 1 and 500 then
    raise exception 'invalid bill' using errcode = '22023';
  end if;
  insert into public.group_event_bills (event_id, total, people, revealed_by)
  values (eid, round(bill_total, 2), bill_people, (select auth.uid()));
end;
$$;

revoke execute on function public.event_price_guessers(uuid[]) from public, anon;
revoke execute on function public.set_event_price_game(uuid, boolean) from public, anon;
revoke execute on function public.guess_event_price(uuid, numeric) from public, anon;
revoke execute on function public.reveal_event_bill(uuid, numeric, integer) from public, anon;
grant execute on function public.event_price_guessers(uuid[]) to authenticated;
grant execute on function public.set_event_price_game(uuid, boolean) to authenticated;
grant execute on function public.guess_event_price(uuid, numeric) to authenticated;
grant execute on function public.reveal_event_bill(uuid, numeric, integer) to authenticated;

-- Live: the reveal and my own guesses arrive on open event pages (others' guesses come through price_guessed_at).
alter publication supabase_realtime add table public.group_event_price_guesses, public.group_event_bills;
