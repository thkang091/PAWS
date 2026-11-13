-- Number Trail joins the tournament game types. On its own, in its own migration, because a new enum value can't be
-- used in the same transaction that adds it. 20270107120000_number_trail.sql uses it.
alter type public.tournament_game add value if not exists 'number_trail';
