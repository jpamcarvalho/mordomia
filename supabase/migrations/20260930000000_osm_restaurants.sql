-- Restaurants picked on the map come from OpenStreetMap (OpenFreeMap tiles), not Google Places.
-- A restaurant is identified by its Google place id, its OSM id, or both.
alter table public.restaurants alter column google_place_id drop not null;
alter table public.restaurants add column osm_id text unique;
alter table public.restaurants add column kind text;
alter table public.restaurants
  add constraint restaurants_has_source check (google_place_id is not null or osm_id is not null);
