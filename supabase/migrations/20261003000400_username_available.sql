-- Sign-up ("Registar") asks whether a username is free before creating the account, so a taken one gets a clear
-- message (the profile trigger's unique violation only reaches the app as a generic auth error). Answers yes/no for
-- one username; reveals nothing else. Callable signed out, since the person has no account yet.

create function public.username_available(u text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles p where p.username = lower(u));
$$;

revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;
