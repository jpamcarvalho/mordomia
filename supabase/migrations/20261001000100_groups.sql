-- Mordomia Social groups: a name, an optional description and photo, and members who joined by accepting an
-- invite. Only a group's members, and the people invited to it, can see the group and who is in it.
--
--   * The creator (owner) becomes a member automatically and is the only one who edits or deletes the group.
--   * Any member can invite their own friends; the invite only becomes membership when the invitee accepts.
--   * Members leave (and invitees decline) by deleting their own row; the owner can remove anyone but
--     cannot leave (deleting the group removes everyone).

create type public.group_member_status as enum ('invited', 'member');

create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  name        text not null check (char_length(name) between 1 and 40),
  description text check (char_length(description) <= 300),
  -- Photo in the private "group-photos" bucket, always inside the owner's folder.
  photo_path  text check (photo_path is null or photo_path like owner_id::text || '/%'),
  created_at  timestamptz not null default now()
);

create table public.group_members (
  group_id   uuid not null references public.groups (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  status     public.group_member_status not null default 'invited',
  invited_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

-- Is the caller in this group? With `invited_ok`, an invite counts too. Security definer so the
-- group_members policies can use it without recursing into themselves.
create function public.in_group(gid uuid, invited_ok boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = gid
      and m.user_id = (select auth.uid())
      and (m.status = 'member' or invited_ok)
  );
$$;

create function public.owns_group(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.groups g where g.id = gid and g.owner_id = (select auth.uid()));
$$;

revoke execute on function public.in_group(uuid, boolean) from public, anon;
revoke execute on function public.owns_group(uuid) from public, anon;
grant execute on function public.in_group(uuid, boolean) to authenticated;
grant execute on function public.owns_group(uuid) to authenticated;

-- The owner is a member from the start.
create function public.groups_add_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, status, invited_by)
  values (new.id, new.owner_id, 'member', new.owner_id);
  return new;
end;
$$;

create trigger groups_add_owner
  after insert on public.groups
  for each row execute function public.groups_add_owner();

-- Membership rows: only the status may change, and only from invited to member.
create function public.group_members_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.group_id is distinct from old.group_id
     or new.user_id is distinct from old.user_id
     or new.invited_by is distinct from old.invited_by
     or new.created_at is distinct from old.created_at then
    raise exception 'group_members: only status can change' using errcode = '42501';
  end if;
  if new.status is distinct from old.status and not (old.status = 'invited' and new.status = 'member') then
    raise exception 'group_members: status can only change from invited to member' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger group_members_guard_update
  before update on public.group_members
  for each row execute function public.group_members_guard_update();

-- The owner cannot leave their own group (it is deleted instead, which removes every row).
create function public.group_members_guard_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.groups g where g.id = old.group_id and g.owner_id = old.user_id) then
    raise exception 'group_members: the owner cannot leave; delete the group' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger group_members_guard_delete
  before delete on public.group_members
  for each row execute function public.group_members_guard_delete();

alter table public.groups        enable row level security;
alter table public.group_members enable row level security;

-- Groups: seen by members and invitees; created by anyone for themselves; changed only by the owner.
create policy "groups: read if member or invited" on public.groups
  for select to authenticated using (public.in_group(id, true));
create policy "groups: create own" on public.groups
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "groups: owner updates" on public.groups
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "groups: owner deletes" on public.groups
  for delete to authenticated using (owner_id = (select auth.uid()));

revoke update on public.groups from authenticated, anon;
grant update (name, description, photo_path) on public.groups to authenticated;

-- Members: the list is seen by members and invitees of that group.
create policy "group_members: read if member or invited" on public.group_members
  for select to authenticated using (public.in_group(group_id, true));
-- A member invites one of their friends.
create policy "group_members: member invites a friend" on public.group_members
  for insert to authenticated with check (
    status = 'invited'
    and invited_by = (select auth.uid())
    and public.in_group(group_id, false)
    and public.are_friends((select auth.uid()), user_id)
  );
-- The invitee accepts.
create policy "group_members: invitee accepts" on public.group_members
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'invited')
  with check (user_id = (select auth.uid()) and status = 'member');
-- Leave / decline your own; the owner removes anyone; whoever invited can cancel a pending invite.
create policy "group_members: leave, remove or cancel" on public.group_members
  for delete to authenticated using (
    user_id = (select auth.uid())
    or public.owns_group(group_id)
    or (status = 'invited' and invited_by = (select auth.uid()))
  );

revoke update on public.group_members from authenticated, anon;
grant update (status) on public.group_members to authenticated;

-- Group photos: private bucket at {owner_id}/{filename}; readable when the group pointing at it is visible.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-photos', 'group-photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

create policy "group-photos: upload to own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'group-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "group-photos: read own or visible group" on storage.objects
  for select to authenticated using (
    bucket_id = 'group-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      -- objects.name, qualified: groups has its own name column.
      or exists (select 1 from public.groups g where g.photo_path = objects.name)
    )
  );
create policy "group-photos: delete own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'group-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
