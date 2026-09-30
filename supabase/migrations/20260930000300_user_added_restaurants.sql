-- Restaurants that are not on the map can be added by any signed-in user, pinned at their current
-- location. They join the shared catalogue: every signed-in user sees them on the map and in search
-- (existing "restaurants: read" policy). Only inserting is allowed (existing insert policy); there is
-- no update or delete policy, so nobody can change or remove someone else's restaurant.
alter table public.restaurants add column user_added boolean not null default false;

alter table public.restaurants drop constraint restaurants_has_source;
alter table public.restaurants
  add constraint restaurants_has_source check (
    google_place_id is not null
    or osm_id is not null
    or (user_added and lat is not null and lng is not null and kind is not null)
  );

alter table public.restaurants
  add constraint restaurants_name_length_check check (char_length(btrim(name)) between 1 and 100),
  add constraint restaurants_lat_check check (lat between -90 and 90),
  add constraint restaurants_lng_check check (lng between -180 and 180);

create index restaurants_user_added_idx on public.restaurants (user_added) where user_added;
