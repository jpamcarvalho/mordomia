-- Ratings are whole numbers from 0 to 10, optional, and can be given on "went" and on the private
-- "saved" list (Adiciona à minha lista). "want" (Quero ir!) still has no rating.
alter table public.entries drop constraint entries_rating_check;
alter table public.entries add constraint entries_rating_check check (rating between 0 and 10);

alter table public.entries drop constraint entries_check;
alter table public.entries
  add constraint entries_rating_status_check check (status in ('went', 'saved') or rating is null);

alter table public.entries
  add constraint entries_notes_length_check check (char_length(notes) <= 2000);
