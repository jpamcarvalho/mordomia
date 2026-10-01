-- Live event pages: changes to an event, its date poll, the votes and who is going are pushed to everyone who
-- has the event open (Supabase Realtime). Realtime applies each table's RLS, so only the group's members get them.

alter publication supabase_realtime add table
  public.group_events,
  public.group_event_date_options,
  public.group_event_date_votes,
  public.group_event_attendance;
