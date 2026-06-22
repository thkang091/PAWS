-- ============================================================
-- Migration 0021 — Extended Training Infrastructure
-- ============================================================
-- Adds: activity version history, evaluation clips/runs,
-- per-dog skill progress, goal skill levels, reward log,
-- streak tracking, saved training items.
-- ============================================================

-- ──────────────────────────────────────────────
-- Activity Version History (AI Lab rollback)
-- ──────────────────────────────────────────────

create table training_activity_versions (
  id                           uuid primary key default gen_random_uuid(),
  activity_id                  text not null references training_catalog_activities(id) on delete cascade,
  version_number               integer not null,
  changed_by                   uuid not null references auth.users(id),
  vlm_prompt_before            text,
  vlm_prompt_after             text,
  pass_criteria_before         text[],
  pass_criteria_after          text[],
  fail_criteria_before         text[],
  fail_criteria_after          text[],
  needs_review_criteria_before text[],
  needs_review_criteria_after  text[],
  verification_status_before   curriculum_verification_status,
  verification_status_after    curriculum_verification_status,
  change_reason                text,
  created_at                   timestamptz not null default timezone('utc', now()),
  unique (activity_id, version_number)
);

create index idx_tav_activity on training_activity_versions(activity_id);
create index idx_tav_changed_by on training_activity_versions(changed_by);

-- ──────────────────────────────────────────────
-- Admin Evaluation Clips
-- ──────────────────────────────────────────────

create table training_evaluation_clips (
  id               uuid primary key default gen_random_uuid(),
  activity_id      text not null references training_catalog_activities(id) on delete cascade,
  storage_path     text not null,
  expected_verdict text not null check (expected_verdict in ('pass', 'fail', 'needs_review')),
  uploaded_by      uuid not null references auth.users(id),
  notes            text,
  created_at       timestamptz not null default timezone('utc', now())
);

create index idx_tec_activity on training_evaluation_clips(activity_id);

-- ──────────────────────────────────────────────
-- Evaluation Run Results
-- ──────────────────────────────────────────────

create table training_evaluation_runs (
  id              uuid primary key default gen_random_uuid(),
  activity_id     text not null references training_catalog_activities(id),
  clip_id         uuid not null references training_evaluation_clips(id),
  vlm_verdict     text check (vlm_verdict in ('pass', 'fail', 'needs_review', 'error')),
  vlm_confidence  numeric(5,4),
  vlm_reasoning   text,
  vlm_latency_ms  integer,
  model_used      text,
  was_correct     boolean,
  prompt_version  integer,
  run_at          timestamptz not null default timezone('utc', now())
);

create index idx_ter_activity on training_evaluation_runs(activity_id);
create index idx_ter_clip on training_evaluation_runs(clip_id);

-- ──────────────────────────────────────────────
-- Per-Dog Activity Progress
-- ──────────────────────────────────────────────

create table dog_training_skill_progress (
  id                uuid primary key default gen_random_uuid(),
  dog_id            uuid not null references dogs(id) on delete cascade,
  activity_id       text not null references training_catalog_activities(id),
  attempts          integer not null default 0,
  passes            integer not null default 0,
  last_attempt_at   timestamptz,
  last_pass_at      timestamptz,
  best_confidence   numeric(5,4),
  is_mastered       boolean not null default false,
  created_at        timestamptz not null default timezone('utc', now()),
  updated_at        timestamptz not null default timezone('utc', now()),
  unique (dog_id, activity_id)
);

create index idx_dtsp_dog on dog_training_skill_progress(dog_id);
create index idx_dtsp_activity on dog_training_skill_progress(activity_id);

-- ──────────────────────────────────────────────
-- Per-Dog Per-Goal Skill Level
-- ──────────────────────────────────────────────

create table dog_goal_skill_levels (
  id          uuid primary key default gen_random_uuid(),
  dog_id      uuid not null references dogs(id) on delete cascade,
  goal        training_goal_category not null,
  skill_level integer not null default 1 check (skill_level between 1 and 5),
  updated_at  timestamptz not null default timezone('utc', now()),
  unique (dog_id, goal)
);

create index idx_dgsl_dog on dog_goal_skill_levels(dog_id);

-- ──────────────────────────────────────────────
-- Reward Transaction Log
-- ──────────────────────────────────────────────

create table dog_training_reward_log (
  id               uuid primary key default gen_random_uuid(),
  dog_id           uuid not null references dogs(id) on delete cascade,
  roadmap_day_id   uuid references dog_personalized_roadmap_days(id),
  activity_id      text not null references training_catalog_activities(id),
  xp_awarded       integer not null default 0,
  coins_awarded    integer not null default 0,
  stars_awarded    integer not null default 0,
  source           text not null check (source in ('activity_pass', 'streak_bonus', 'boss_bonus', 'admin')),
  idempotency_key  text unique,
  created_at       timestamptz not null default timezone('utc', now())
);

create index idx_dtrl_dog on dog_training_reward_log(dog_id);
create index idx_dtrl_activity on dog_training_reward_log(activity_id);
create index idx_dtrl_idem on dog_training_reward_log(idempotency_key);

-- ──────────────────────────────────────────────
-- Streak Tracking
-- ──────────────────────────────────────────────

create table dog_training_streaks (
  id                  uuid primary key default gen_random_uuid(),
  dog_id              uuid not null references dogs(id) on delete cascade,
  current_streak      integer not null default 0,
  longest_streak      integer not null default 0,
  last_activity_date  date,
  updated_at          timestamptz not null default timezone('utc', now()),
  unique (dog_id)
);

create index idx_dts_dog on dog_training_streaks(dog_id);

-- ──────────────────────────────────────────────
-- Saved Training Items (named reference objects)
-- ──────────────────────────────────────────────

create table dog_saved_training_items (
  id                 uuid primary key default gen_random_uuid(),
  dog_id             uuid not null references dogs(id) on delete cascade,
  asset_type         reference_asset_type not null,
  friendly_name      text not null default '',
  reference_asset_id uuid references dog_training_reference_assets(id) on delete set null,
  is_default         boolean not null default false,
  created_at         timestamptz not null default timezone('utc', now())
);

create index idx_dsti_dog on dog_saved_training_items(dog_id);
create index idx_dsti_dog_type on dog_saved_training_items(dog_id, asset_type);

-- ──────────────────────────────────────────────
-- Triggers
-- ──────────────────────────────────────────────

create trigger dtsp_updated_at
  before update on dog_training_skill_progress
  for each row execute function set_updated_at();

create trigger dgsl_updated_at
  before update on dog_goal_skill_levels
  for each row execute function set_updated_at();

create trigger dts_updated_at
  before update on dog_training_streaks
  for each row execute function set_updated_at();

-- ──────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────

alter table training_activity_versions  enable row level security;
alter table training_evaluation_clips   enable row level security;
alter table training_evaluation_runs    enable row level security;
alter table dog_training_skill_progress enable row level security;
alter table dog_goal_skill_levels       enable row level security;
alter table dog_training_reward_log     enable row level security;
alter table dog_training_streaks        enable row level security;
alter table dog_saved_training_items    enable row level security;

-- Admin-only tables
create policy "tav_admin" on training_activity_versions
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

create policy "tec_admin" on training_evaluation_clips
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

create policy "ter_admin" on training_evaluation_runs
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- Dog-scoped tables
create policy "dtsp_owner" on dog_training_skill_progress
  for all to authenticated
  using   (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()))
  with check (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()));

create policy "dgsl_owner" on dog_goal_skill_levels
  for all to authenticated
  using   (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()))
  with check (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()));

create policy "dtrl_owner" on dog_training_reward_log
  for all to authenticated
  using   (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()))
  with check (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()));

create policy "dts_owner" on dog_training_streaks
  for all to authenticated
  using   (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()))
  with check (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()));

create policy "dsti_owner" on dog_saved_training_items
  for all to authenticated
  using   (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()))
  with check (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()));
