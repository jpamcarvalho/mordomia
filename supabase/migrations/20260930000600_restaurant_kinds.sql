-- A user-added restaurant can have several types (e.g. café and bakery).
-- `kinds` lists them all, main type first; `kind` stays the main type (map icon, search, filters).
alter table public.restaurants add column kinds text[];

update public.restaurants set kinds = array[kind] where user_added and kind is not null;

alter table public.restaurants
  add constraint restaurants_kinds_check check (
    kinds is null
    or (
      cardinality(kinds) between 1 and 7
      and kinds[1] = kind
      and kinds <@ array['restaurant', 'fast_food', 'cafe', 'bar', 'beer', 'ice_cream', 'bakery']
    )
  );
