-- "Adiciona à minha lista": a private saved list, next to "want" (Quero ir!) and "went".
-- Friends only ever see "went" entries (entries RLS), so "saved" stays private.
alter type public.entry_status add value 'saved';
