-- Account page: the display name can be changed, the username cannot.
alter table public.profiles
  add constraint profiles_display_name_length_check check (char_length(display_name) between 1 and 40);

-- Signed-in users may only update these profile columns (username and id stay fixed).
revoke update on public.profiles from authenticated, anon;
grant update (display_name, bio, avatar_path) on public.profiles to authenticated;
