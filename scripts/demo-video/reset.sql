-- Back to before the demo run (keeps the four demo users; see cleanup.sql).
delete from entries where user_id = 'c8fe7ba8-b653-4e48-bfe2-16cdfbf4687a' and created_at > '2026-10-02 23:20+00';
delete from entries where user_id::text like 'e0000000-0000-4000-8000-%';
delete from friendships where requester_id::text like 'e0000000-0000-4000-8000-%' or addressee_id::text like 'e0000000-0000-4000-8000-%';
delete from groups where id = 'd0000000-0000-4000-8000-000000000001';
delete from restaurants r where r.created_at > '2026-10-02 23:20+00'
  and not exists (select 1 from entries e where e.restaurant_id = r.id)
  and not exists (select 1 from group_events g where g.location_restaurant_id = r.id);
update profiles set username = 'teste', display_name = 'Conta Teste', avatar_path = null, bio = 'Conta de teste local 🧪' where id = 'c8fe7ba8-b653-4e48-bfe2-16cdfbf4687a';
