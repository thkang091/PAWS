-- ============================================================
-- Migration 0019 — Personalized Training Curriculum System
-- ============================================================

-- ──────────────────────────────────────────────
-- Enums
-- ──────────────────────────────────────────────

create type training_goal_category as enum (
  'BETTER_BEHAVIOR_AT_HOME',
  'SAFETY_AND_OBEDIENCE',
  'BETTER_WALKS',
  'COOL_TRICKS_AND_GAMES',
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'CALM_ALONE_TIME'
);

create type quest_content_type as enum (
  'AI_VERIFIED_MAIN_QUEST',
  'GUIDED_SIDE_QUEST',
  'HYBRID_QUEST'
);

create type reference_asset_type as enum (
  'DOG_PROFILE',
  'TARGET_TOY',
  'TARGET_MAT',
  'TARGET_BOWL',
  'TARGET_BASKET',
  'TARGET_CRATE',
  'TARGET_DOORWAY',
  'TARGET_PLATFORM',
  'TARGET_CONE',
  'TARGET_BOX',
  'TARGET_BUTTON',
  'TARGET_BELL',
  'TARGET_DRAWER',
  'TARGET_PERSON',
  'CUSTOM_OBJECT'
);

create type roadmap_difficulty_mode as enum (
  'LEARN',
  'REPEAT',
  'ADD_DURATION',
  'ADD_DISTANCE',
  'ADD_DISTRACTION',
  'REAL_LIFE_PROOF',
  'MAINTENANCE',
  'REGRESSION',
  'BOSS_BATTLE'
);

create type curriculum_verification_status as enum (
  'DRAFT',
  'BETA',
  'CERTIFIED',
  'DISABLED'
);

create type roadmap_day_feedback as enum (
  'TOO_HARD',
  'JUST_RIGHT',
  'TOO_EASY'
);

-- ──────────────────────────────────────────────
-- Training Catalog Activities (300 total)
-- ──────────────────────────────────────────────

create table training_catalog_activities (
  id                          text primary key,               -- e.g. BH001
  category                    training_goal_category not null,
  sequence_number             integer not null,
  level                       integer not null default 1 check (level between 1 and 5),

  title                       text not null,
  skill_family                text not null,
  quest_content_type          quest_content_type not null default 'AI_VERIFIED_MAIN_QUEST',

  lesson_goal                 text not null default '',
  why_it_matters              text not null default '',
  tutorial_steps              jsonb not null default '[]',
  visible_checkpoint          text not null default '',

  prerequisites               text[] not null default '{}',
  regression_activity_id      text references training_catalog_activities(id),
  harder_activity_id          text references training_catalog_activities(id),

  required_reference_assets   reference_asset_type[] not null default '{}',

  recommended_fps             integer not null default 30,
  min_clip_seconds            integer not null default 3,
  max_clip_seconds            integer not null default 30,

  pass_criteria               text[] not null default '{}',
  fail_criteria               text[] not null default '{}',
  needs_review_criteria       text[] not null default '{}',
  safety_notes                text[] not null default '{}',

  minimum_auto_pass_confidence  numeric(4,3) not null default 0.75,
  minimum_auto_fail_confidence  numeric(4,3) not null default 0.90,

  verification_status         curriculum_verification_status not null default 'DRAFT',

  xp_reward                   integer not null default 50,
  coin_reward                 integer not null default 10,
  stars_available             integer not null default 3,

  vlm_prompt                  text not null default '',

  created_at                  timestamptz not null default timezone('utc', now()),
  updated_at                  timestamptz not null default timezone('utc', now())
);

create index idx_tca_category on training_catalog_activities(category);
create index idx_tca_verification_status on training_catalog_activities(verification_status);
create index idx_tca_category_seq on training_catalog_activities(category, sequence_number);

-- ──────────────────────────────────────────────
-- Reference Asset Requirements per Activity
-- ──────────────────────────────────────────────

create table training_reference_asset_requirements (
  id            uuid primary key default gen_random_uuid(),
  activity_id   text not null references training_catalog_activities(id) on delete cascade,
  asset_type    reference_asset_type not null,
  is_required   boolean not null default true,
  description   text not null default '',
  created_at    timestamptz not null default timezone('utc', now())
);

create index idx_trar_activity on training_reference_asset_requirements(activity_id);

-- ──────────────────────────────────────────────
-- Dog Selected Training Goals
-- ──────────────────────────────────────────────

create table dog_selected_training_goals (
  id            uuid primary key default gen_random_uuid(),
  dog_id        uuid not null references dogs(id) on delete cascade,
  goal          training_goal_category not null,
  priority_rank integer not null check (priority_rank between 1 and 6),
  selected_at   timestamptz not null default timezone('utc', now()),
  unique (dog_id, goal)
);

create index idx_dstg_dog on dog_selected_training_goals(dog_id);

-- ──────────────────────────────────────────────
-- Dog Training Pain Points
-- ──────────────────────────────────────────────

create table dog_training_pain_points (
  id              uuid primary key default gen_random_uuid(),
  dog_id          uuid not null references dogs(id) on delete cascade,
  goal            training_goal_category not null,
  pain_point_key  text not null,
  created_at      timestamptz not null default timezone('utc', now()),
  unique (dog_id, goal, pain_point_key)
);

create index idx_dtpp_dog on dog_training_pain_points(dog_id);

-- ──────────────────────────────────────────────
-- Personalized Roadmaps
-- ──────────────────────────────────────────────

create table dog_personalized_roadmaps (
  id                            uuid primary key default gen_random_uuid(),
  dog_id                        uuid not null references dogs(id) on delete cascade,
  curriculum_version            text not null default '1.0.0',
  personalization_engine_version text not null default '1.0.0',
  selected_goals                jsonb not null default '[]',
  generated_at                  timestamptz not null default timezone('utc', now()),
  is_active                     boolean not null default true,
  generation_notes              text
);

create index idx_dpr_dog_active on dog_personalized_roadmaps(dog_id, is_active);

-- ──────────────────────────────────────────────
-- Roadmap Days (100 per roadmap)
-- ──────────────────────────────────────────────

create table dog_personalized_roadmap_days (
  id                      uuid primary key default gen_random_uuid(),
  roadmap_id              uuid not null references dog_personalized_roadmaps(id) on delete cascade,
  day_number              integer not null check (day_number between 1 and 300),
  primary_activity_id     text not null references training_catalog_activities(id),
  optional_side_quest_id  text references training_catalog_activities(id),
  optional_bond_quest_id  text references training_catalog_activities(id),
  reason_selected         text not null default '',
  difficulty_mode         roadmap_difficulty_mode not null default 'LEARN',
  completed_at            timestamptz,
  feedback                roadmap_day_feedback,
  unique (roadmap_id, day_number)
);

create index idx_dprd_roadmap on dog_personalized_roadmap_days(roadmap_id);
create index idx_dprd_roadmap_day on dog_personalized_roadmap_days(roadmap_id, day_number);

-- ──────────────────────────────────────────────
-- Dog Training Reference Assets
-- ──────────────────────────────────────────────

create table dog_training_reference_assets (
  id            uuid primary key default gen_random_uuid(),
  dog_id        uuid not null references dogs(id) on delete cascade,
  asset_type    reference_asset_type not null,
  label         text not null default '',
  storage_path  text not null,
  thumbnail_url text,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create index idx_dtra_dog on dog_training_reference_assets(dog_id);
create index idx_dtra_dog_type on dog_training_reference_assets(dog_id, asset_type);

-- ──────────────────────────────────────────────
-- Training Video Submissions
-- ──────────────────────────────────────────────

create table dog_training_video_submissions (
  id              uuid primary key default gen_random_uuid(),
  dog_id          uuid not null references dogs(id) on delete cascade,
  roadmap_day_id  uuid references dog_personalized_roadmap_days(id),
  activity_id     text not null references training_catalog_activities(id),
  storage_path    text,
  submitted_at    timestamptz not null default timezone('utc', now()),
  vlm_verdict     text check (vlm_verdict in ('pass', 'fail', 'needs_review', 'error')),
  vlm_confidence  numeric(5,4),
  vlm_reasoning   text,
  vlm_latency_ms  integer,
  xp_awarded      integer not null default 0,
  coins_awarded   integer not null default 0,
  status          text not null default 'pending'
    check (status in ('pending', 'processing', 'passed', 'failed', 'needs_review', 'error'))
);

create index idx_dtvs_dog on dog_training_video_submissions(dog_id);
create index idx_dtvs_day on dog_training_video_submissions(roadmap_day_id);

-- ──────────────────────────────────────────────
-- Admin Audit Log
-- ──────────────────────────────────────────────

create table training_admin_audit_log (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid not null references auth.users(id),
  action        text not null,
  activity_id   text references training_catalog_activities(id),
  before_state  jsonb,
  after_state   jsonb,
  created_at    timestamptz not null default timezone('utc', now())
);

create index idx_taal_admin on training_admin_audit_log(admin_id);
create index idx_taal_activity on training_admin_audit_log(activity_id);

-- ──────────────────────────────────────────────
-- Trigger: updated_at
-- ──────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger tca_updated_at
  before update on training_catalog_activities
  for each row execute function set_updated_at();

create trigger dtra_updated_at
  before update on dog_training_reference_assets
  for each row execute function set_updated_at();

-- ──────────────────────────────────────────────
-- RLS Policies
-- ──────────────────────────────────────────────

-- Admin policies below depend on profiles.is_admin.
alter table profiles add column if not exists is_admin boolean not null default false;

alter table training_catalog_activities enable row level security;
alter table training_reference_asset_requirements enable row level security;
alter table dog_selected_training_goals enable row level security;
alter table dog_training_pain_points enable row level security;
alter table dog_personalized_roadmaps enable row level security;
alter table dog_personalized_roadmap_days enable row level security;
alter table dog_training_reference_assets enable row level security;
alter table dog_training_video_submissions enable row level security;
alter table training_admin_audit_log enable row level security;

-- Catalog readable by all authenticated users
create policy "catalog_read" on training_catalog_activities
  for select to authenticated using (true);

-- Catalog writable only by admins (via is_admin flag on profiles)
create policy "catalog_admin_write" on training_catalog_activities
  for all to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- Reference asset requirements readable by all authenticated users
create policy "asset_req_read" on training_reference_asset_requirements
  for select to authenticated using (true);

-- Dog-scoped tables: owner access only (via dogs.owner_id)
create policy "dstg_owner" on dog_selected_training_goals
  for all to authenticated
  using (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()))
  with check (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()));

create policy "dtpp_owner" on dog_training_pain_points
  for all to authenticated
  using (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()))
  with check (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()));

create policy "dpr_owner" on dog_personalized_roadmaps
  for all to authenticated
  using (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()))
  with check (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()));

create policy "dprd_owner" on dog_personalized_roadmap_days
  for all to authenticated
  using (exists (
    select 1 from dog_personalized_roadmaps r
    join dogs d on d.id = r.dog_id
    where r.id = roadmap_id and d.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from dog_personalized_roadmaps r
    join dogs d on d.id = r.dog_id
    where r.id = roadmap_id and d.owner_id = auth.uid()
  ));

create policy "dtra_owner" on dog_training_reference_assets
  for all to authenticated
  using (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()))
  with check (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()));

create policy "dtvs_owner" on dog_training_video_submissions
  for all to authenticated
  using (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()))
  with check (exists (select 1 from dogs where id = dog_id and owner_id = auth.uid()));

-- Audit log: admins only
create policy "taal_admin" on training_admin_audit_log
  for all to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_admin = true));
