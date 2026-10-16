-- Adaptive reinforcement can select [4,1,2], whose highest level is 4.
-- end_level records the highest planned level; practice_cursor and
-- practice_level_ids determine completion, not the old fixed 3/5 boundary.
-- Retain historical level-2 rounds and every existing record unchanged.
alter table public.training_rounds
  drop constraint training_rounds_end_level_check,
  add constraint training_rounds_end_level_check check (end_level between 1 and 5);
