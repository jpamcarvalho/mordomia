\set T '''c8fe7ba8-b653-4e48-bfe2-16cdfbf4687a'''
\set A '''e0000000-0000-4000-8000-000000000001'''
\set M '''e0000000-0000-4000-8000-000000000002'''
\set I '''e0000000-0000-4000-8000-000000000003'''
\set R '''e0000000-0000-4000-8000-000000000004'''
\set G '''d0000000-0000-4000-8000-000000000001'''
-- The test account plays "Tiago Martins" (restored afterwards).
update profiles set username = 'tiago_martins', display_name = 'Tiago Martins', avatar_path = :T || '/demo.png', bio = 'Sempre à procura da próxima mordomia 🍽️' where id = :T;
update profiles set bio = 'Bitoque é religião 🥩' where id = :A;
update profiles set bio = 'Francesinha só com molho a sério' where id = :M;
update profiles set bio = 'Ramen, sushi e tudo o que leve picante 🌶️' where id = :I;
update profiles set bio = 'Pizza ao domingo, sempre.' where id = :R;
-- Friends with everyone.
insert into friendships (requester_id, addressee_id, status) values
 (:T, :A, 'accepted'), (:T, :M, 'accepted'), (:T, :I, 'accepted'), (:T, :R, 'accepted'),
 (:A, :M, 'accepted'), (:A, :I, 'accepted'), (:M, :R, 'accepted'), (:I, :R, 'accepted') on conflict do nothing;
-- Their restaurants (the Feed).
insert into entries (user_id, restaurant_id, status, rating, notes, created_at) values
 (:A, 'd0141ba1-a75c-4d0e-8100-fc680626d20b', 'saved', 9, 'O bitoque é de outro mundo 🤤', now() - interval '25 min'),
 (:I, '2dc8ded6-4259-4730-964e-2a40fa761d62', 'saved', 9, 'Ramen incrível, voltava amanhã 🍜', now() - interval '2 hour'),
 (:M, '25bcfcd2-2ece-4131-b0d6-033315275b8a', 'saved', 8, 'Francesinha top, molho perfeito', now() - interval '5 hour'),
 (:R, 'af44cf20-c0d7-4b03-9941-0b86096e6645', 'want', null, null, now() - interval '9 hour'),
 (:A, '3168b625-10ae-4221-a49a-ecb3e29c2ca0', 'want', null, null, now() - interval '1 day'),
 (:M, '113fabb0-ca69-4653-ba7c-4ef4faf041e6', 'saved', 8, 'Marisco fresquinho', now() - interval '1 day 3 hour'),
 (:R, '2ae1f9b1-8ecc-4a22-b48c-6224e3d4b7e7', 'saved', 7, 'Prato do dia muito bem servido', now() - interval '2 day'),
 (:I, '69fe0fe4-5598-4f5d-8697-ab994a33ea26', 'want', null, null, now() - interval '2 day 4 hour');
-- The group.
insert into groups (id, owner_id, name, description) values (:G, :T, 'Os Comilões', 'Jantares de sexta e boa disposição');
insert into group_members (group_id, user_id, status) values (:G, :T, 'member') on conflict do nothing;
insert into group_members (group_id, user_id, status, invited_by) values (:G, :A, 'member', :T), (:G, :M, 'member', :T), (:G, :I, 'member', :T), (:G, :R, 'member', :T) on conflict do nothing;
-- D1: no mordomo yet (the dice).
insert into group_events (id, group_id, title, created_by, created_at) values ('d0000000-0000-4000-8000-0000000000d1', :G, 'Sushi de sábado 🍣', :T, now());
-- D2: date poll.
insert into group_events (id, group_id, title, created_by, mordomo_id, created_at) values ('d0000000-0000-4000-8000-0000000000d2', :G, 'Pizza night 🍕', :T, :T, now() - interval '1 hour');
insert into group_event_date_options (id, event_id, day) values
 ('d0000000-0000-4000-8000-0000000000a1','d0000000-0000-4000-8000-0000000000d2','2026-10-16'),
 ('d0000000-0000-4000-8000-0000000000a2','d0000000-0000-4000-8000-0000000000d2','2026-10-17'),
 ('d0000000-0000-4000-8000-0000000000a3','d0000000-0000-4000-8000-0000000000d2','2026-10-23');
insert into group_event_date_votes (option_id, user_id) values
 ('d0000000-0000-4000-8000-0000000000a1', :A), ('d0000000-0000-4000-8000-0000000000a2', :A), ('d0000000-0000-4000-8000-0000000000a2', :M),
 ('d0000000-0000-4000-8000-0000000000a2', :I), ('d0000000-0000-4000-8000-0000000000a3', :I), ('d0000000-0000-4000-8000-0000000000a1', :R);
-- D3: dated, at Il Pizzaiolo, Preço certo open with three guesses.
insert into group_events (id, group_id, title, created_by, mordomo_id, event_date, location_restaurant_id, price_opened_at, created_at)
 values ('d0000000-0000-4000-8000-0000000000d3', :G, 'Jantar de anos da Ana 🎂', :T, :T, '2026-10-09', 'af44cf20-c0d7-4b03-9941-0b86096e6645', now(), now() - interval '2 hour');
insert into group_event_date_options (id, event_id, day) values ('d0000000-0000-4000-8000-0000000000a4','d0000000-0000-4000-8000-0000000000d3','2026-10-09');
insert into group_event_date_votes (option_id, user_id) values ('d0000000-0000-4000-8000-0000000000a4', :A), ('d0000000-0000-4000-8000-0000000000a4', :M);
insert into group_event_attendance (event_id, user_id, going) values ('d0000000-0000-4000-8000-0000000000d3', :I, true);
insert into group_event_price_guesses (event_id, user_id, amount, created_at) values
 ('d0000000-0000-4000-8000-0000000000d3', :A, 33, now() - interval '50 min'),
 ('d0000000-0000-4000-8000-0000000000d3', :M, 28.5, now() - interval '40 min'),
 ('d0000000-0000-4000-8000-0000000000d3', :I, 31, now() - interval '30 min');
-- D4: past, Rui won.
insert into group_events (id, group_id, title, created_by, mordomo_id, event_date, location_restaurant_id, price_opened_at, price_closed_at, created_at)
 values ('d0000000-0000-4000-8000-0000000000d4', :G, 'Francesinhas no Fase 🥪', :M, :M, '2026-09-25', '25bcfcd2-2ece-4131-b0d6-033315275b8a', now(), now(), now() - interval '9 day');
insert into group_event_attendance (event_id, user_id, going) values ('d0000000-0000-4000-8000-0000000000d4', :T, true), ('d0000000-0000-4000-8000-0000000000d4', :A, true), ('d0000000-0000-4000-8000-0000000000d4', :R, true);
insert into group_event_price_guesses (event_id, user_id, amount) values ('d0000000-0000-4000-8000-0000000000d4', :T, 16), ('d0000000-0000-4000-8000-0000000000d4', :A, 19), ('d0000000-0000-4000-8000-0000000000d4', :R, 17.5);
insert into group_event_bills (event_id, total, people, revealed_by) values ('d0000000-0000-4000-8000-0000000000d4', 72, 4, :M);
-- D5: past, Inês won.
insert into group_events (id, group_id, title, created_by, mordomo_id, event_date, location_restaurant_id, price_opened_at, price_closed_at, created_at)
 values ('d0000000-0000-4000-8000-0000000000d5', :G, 'Sushi na Foz 🍱', :A, :A, '2026-09-12', '3168b625-10ae-4221-a49a-ecb3e29c2ca0', now(), now(), now() - interval '22 day');
insert into group_event_attendance (event_id, user_id, going) values ('d0000000-0000-4000-8000-0000000000d5', :T, true), ('d0000000-0000-4000-8000-0000000000d5', :I, true), ('d0000000-0000-4000-8000-0000000000d5', :M, true);
insert into group_event_price_guesses (event_id, user_id, amount) values ('d0000000-0000-4000-8000-0000000000d5', :I, 34), ('d0000000-0000-4000-8000-0000000000d5', :M, 30), ('d0000000-0000-4000-8000-0000000000d5', :T, 36);
insert into group_event_bills (event_id, total, people, revealed_by) values ('d0000000-0000-4000-8000-0000000000d5', 140, 4, :A);
update group_events set closed_at = now() where id in ('d0000000-0000-4000-8000-0000000000d4', 'd0000000-0000-4000-8000-0000000000d5');
