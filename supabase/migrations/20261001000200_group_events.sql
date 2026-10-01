-- Group events: a title, an optional "mordomo" (the event's admin) and each member's answer (Vou / Não vou).
-- Only the group's members (not pending invitees) see its events and answers.
--
--   * Any member creates events; the creator may name themselves mordomo (naming someone else comes later).
--   * The event's creator or the group owner deletes it.
--   * Each member answers for themselves only.

create table public.group_events (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 60),
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  mordomo_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index group_events_group_idx on public.group_events (group_id, created_at desc);

create table public.group_event_responses (
  event_id   uuid not null references public.group_events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  going      boolean not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Is the caller a member of the group this event belongs to?
create function public.in_event_group(eid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_events e
    join public.group_members m on m.group_id = e.group_id
    where e.id = eid and m.user_id = (select auth.uid()) and m.status = 'member'
  );
$$;

revoke execute on function public.in_event_group(uuid) from public, anon;
grant execute on function public.in_event_group(uuid) to authenticated;

alter table public.group_events          enable row level security;
alter table public.group_event_responses enable row level security;

create policy "group_events: members read" on public.group_events
  for select to authenticated using (public.in_group(group_id, false));
create policy "group_events: members create" on public.group_events
  for insert to authenticated with check (
    public.in_group(group_id, false)
    and created_by = (select auth.uid())
    and (mordomo_id is null or mordomo_id = (select auth.uid()))
  );
create policy "group_events: creator or owner deletes" on public.group_events
  for delete to authenticated using (
    created_by = (select auth.uid()) or public.owns_group(group_id)
  );

-- No edits yet (choosing a mordomo later will add them).
revoke update on public.group_events from authenticated, anon;

create policy "group_event_responses: members read" on public.group_event_responses
  for select to authenticated using (public.in_event_group(event_id));
create policy "group_event_responses: answer own" on public.group_event_responses
  for insert to authenticated with check (user_id = (select auth.uid()) and public.in_event_group(event_id));
create policy "group_event_responses: change own" on public.group_event_responses
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.in_event_group(event_id));
create policy "group_event_responses: remove own" on public.group_event_responses
  for delete to authenticated using (user_id = (select auth.uid()));

revoke update on public.group_event_responses from authenticated, anon;
grant update (going, updated_at) on public.group_event_responses to authenticated;
