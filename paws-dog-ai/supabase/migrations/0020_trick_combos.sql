-- 0020_trick_combos.sql
-- Ordered trick-combo vocabulary.
--
-- Each row defines a multi-trick sequence the dog must complete in order.
-- trick_sequence is a JSONB ordered array of trick slugs from trick_vocabulary.

create table if not exists trick_combos (
  id                          uuid primary key default gen_random_uuid(),
  slug                        text not null unique,
  display_name                text not null,
  trick_sequence              jsonb not null,         -- ordered list of trick slugs
  active                      boolean not null default true,
  difficulty                  integer not null default 2 check (difficulty between 1 and 5),
  min_step_confidence         float not null default 0.65,
  min_combo_score             float not null default 0.70,
  min_segment_duration_ms     integer not null default 300,
  smooth_window_frames        integer not null default 5,
  created_at                  timestamptz not null default now()
);

comment on column trick_combos.trick_sequence is
  'Ordered JSON array of trick slugs, e.g. ["sit","spin","down"].';

comment on column trick_combos.min_step_confidence is
  'A detected step with confidence below this value is reported as low_confidence.';

comment on column trick_combos.min_combo_score is
  'Fraction of required steps that must be detected for a partial match to be reported as partial rather than failed.';

comment on column trick_combos.min_segment_duration_ms is
  'Segments shorter than this are discarded as noise.';

comment on column trick_combos.smooth_window_frames is
  'Mode-filter window (frames) applied before run-length encoding.';

-- Seed data
insert into trick_combos (slug, display_name, trick_sequence, active, difficulty)
values
  ('sit_then_down',   'Sit then Down',       '["sit","down"]',        true, 2),
  ('sit_spin_down',   'Sit, Spin, then Down','["sit","spin","down"]',  true, 3),
  ('paw_then_sit',    'Paw then Sit',        '["paw","sit"]',         true, 2),
  ('stand_spin_sit',  'Stand, Spin, then Sit','["stand","spin","sit"]',true, 4)
on conflict (slug) do nothing;

-- RLS: service role only (same pattern as trick_vocabulary)
alter table trick_combos enable row level security;

create policy "service_role_only" on trick_combos
  using (auth.role() = 'service_role');
