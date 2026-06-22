-- Allow personalized roadmap schedules to span all six 50-activity categories.

alter table public.dog_personalized_roadmap_days
  drop constraint if exists dog_personalized_roadmap_days_day_number_check;

alter table public.dog_personalized_roadmap_days
  add constraint dog_personalized_roadmap_days_day_number_check
  check (day_number between 1 and 300);
