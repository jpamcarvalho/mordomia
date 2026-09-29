-- Mordomia initial schema
-- Privacy model:
--   * "went" entries are visible to the owner and their accepted friends
--   * "want" entries are visible only to the owner
--   * friendships are mutual (request -> accept)

create type public.entry_status as enum ('want', 'went');
create type public.friendship_status as enum ('pending', 'accepted');

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique
               check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text,
  avatar_path  text,
  created_at   timestamptz not null default now()
);

-- Create a profile automatically when a user signs up.
-- The signup form passes `username` in the user metadata.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'username')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Restaurants (shared, deduplicated by Google place id)
-- ---------------------------------------------------------------------------
create table public.restaurants (
  id              uuid primary key default gen_random_uuid(),
  google_place_id text not null unique,
  name            text not null,
  address         text,
  lat             double precision,
  lng             double precision,
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Entries: a user's relationship with a restaurant
-- ---------------------------------------------------------------------------
create table public.entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  status        public.entry_status not null,
  rating        smallint check (rating between 1 and 5),
  notes         text,
  visited_at    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, restaurant_id),
  -- Ratings only make sense once you've been there
  check (status = 'went' or rating is null)
);

create index entries_user_id_idx on public.entries (user_id);
create index entries_restaurant_id_idx on public.entries (restaurant_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Entry photos (files live in the `entry-photos` storage bucket)
-- Path convention: {user_id}/{entry_id}/{filename}
-- ---------------------------------------------------------------------------
create table public.entry_photos (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references public.entries (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  storage_path text not null unique,
  created_at   timestamptz not null default now()
);

create index entry_photos_entry_id_idx on public.entry_photos (entry_id);

-- ---------------------------------------------------------------------------
-- Friendships (mutual; one row per pair)
-- ---------------------------------------------------------------------------
create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status       public.friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- Prevent A->B and B->A both existing
create unique index friendships_pair_idx on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);
create index friendships_addressee_idx on public.friendships (addressee_id);

create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.restaurants  enable row level security;
alter table public.entries      enable row level security;
alter table public.entry_photos enable row level security;
alter table public.friendships  enable row level security;

-- Profiles: any signed-in user can look people up (to send friend requests)
create policy "profiles: read" on public.profiles
  for select to authenticated using (true);
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Restaurants: shared catalogue
create policy "restaurants: read" on public.restaurants
  for select to authenticated using (true);
create policy "restaurants: insert" on public.restaurants
  for insert to authenticated with check (created_by = (select auth.uid()));

-- Entries: own everything; friends see only "went"
create policy "entries: read own or friends' went" on public.entries
  for select to authenticated using (
    user_id = (select auth.uid())
    or (status = 'went' and public.are_friends((select auth.uid()), user_id))
  );
create policy "entries: insert own" on public.entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "entries: update own" on public.entries
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "entries: delete own" on public.entries
  for delete to authenticated using (user_id = (select auth.uid()));

-- Photos: visible whenever the parent entry is visible (entries RLS applies)
create policy "entry_photos: read if entry visible" on public.entry_photos
  for select to authenticated using (
    exists (select 1 from public.entries e where e.id = entry_id)
  );
create policy "entry_photos: insert own" on public.entry_photos
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.entries e where e.id = entry_id and e.user_id = (select auth.uid()))
  );
create policy "entry_photos: delete own" on public.entry_photos
  for delete to authenticated using (user_id = (select auth.uid()));

-- Friendships
create policy "friendships: read own" on public.friendships
  for select to authenticated using (
    (select auth.uid()) in (requester_id, addressee_id)
  );
create policy "friendships: send request" on public.friendships
  for insert to authenticated with check (
    requester_id = (select auth.uid()) and status = 'pending'
  );
create policy "friendships: addressee accepts" on public.friendships
  for update to authenticated
  using (addressee_id = (select auth.uid()))
  with check (addressee_id = (select auth.uid()) and status = 'accepted');
create policy "friendships: either side removes" on public.friendships
  for delete to authenticated using (
    (select auth.uid()) in (requester_id, addressee_id)
  );

-- ---------------------------------------------------------------------------
-- Storage: private bucket for entry photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('entry-photos', 'entry-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

create policy "entry-photos: upload to own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'entry-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "entry-photos: read own or visible entry" on storage.objects
  for select to authenticated using (
    bucket_id = 'entry-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.entry_photos p where p.storage_path = name)
    )
  );
create policy "entry-photos: delete own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'entry-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
