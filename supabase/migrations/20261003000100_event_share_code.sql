-- A short code per event for shared links (/e/<code>, e.g. on WhatsApp). The code is not a secret: opening it still
-- needs a login and membership of the event's group (RLS on group_events), like the full event URL.

create function public.new_event_share_code()
returns text
language plpgsql
security definer -- sees every event's code, not only those RLS shows the person creating the event
set search_path = ''
as $$
declare
  alphabet constant text := 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.group_events where share_code = code);
  end loop;
  return code;
end;
$$;

revoke execute on function public.new_event_share_code() from public, anon;
grant execute on function public.new_event_share_code() to authenticated;

-- Added in steps: the code function reads group_events, which it can't while the table is rewritten.
alter table public.group_events add column share_code text;
update public.group_events set share_code = public.new_event_share_code();
alter table public.group_events
  alter column share_code set default public.new_event_share_code(),
  alter column share_code set not null,
  add constraint group_events_share_code_key unique (share_code);
