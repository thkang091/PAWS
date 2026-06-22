-- Migration: 0024_activity_definitions
-- Adds the activity definition system for the Activity Verifier Compiler.
--
-- Tables
-- ------
--   activity_definitions              — one row per training activity
--   activity_data_collection_submissions — experimental submissions with missing capabilities
--   activity_training_readiness       — computed readiness for future training jobs
--
-- Lifecycle
-- ---------
--   draft → experimental → beta → certified
--                                  ↓
--                               disabled (from any state)
--
-- Safety constraints (enforced in application layer and via check constraints)
--   draft:        admin preview only; no user submissions; no rewards
--   experimental: internal testers only; data collection; no Gold Coins; no tournaments
--   beta:         selected users; XP allowed; Silver Coins optional; no Gold Coins/tournaments
--   certified:    Gold Coins only if reward_policy explicitly enables; same for tournaments
--   disabled:     reject all new submissions


-- ---------------------------------------------------------------------------
-- activity_definitions
-- ---------------------------------------------------------------------------

create table if not exists activity_definitions (
  id                          uuid primary key default gen_random_uuid(),
  slug                        text not null unique,
  display_name                text not null,
  description                 text not null,

  -- User-facing instructions for how to record the activity.
  instructions                text not null default '',

  -- Lifecycle state.
  verification_status         text not null default 'draft'
                                  check (verification_status in (
                                      'draft', 'experimental', 'beta', 'certified', 'disabled'
                                  )),

  -- JSONB strategy config.  Required keys:
  --   strategy_type                 text
  --   modules                       text[]
  --   existing_classifier_authoritative  bool  (set true only for Sit)
  --   requires_rgb_fallback         bool
  verification_strategy       jsonb not null default '{}'::jsonb,

  -- JSONB recording config.  Keys: duration_seconds, full_body_visible, etc.
  recording_config            jsonb not null default '{}'::jsonb,

  -- JSONB conditions.  Lists of structured condition objects.
  success_conditions          jsonb not null default '[]'::jsonb,
  failure_conditions          jsonb not null default '[]'::jsonb,

  -- Capability lists (populated at draft-generation time and updated on edits).
  required_capabilities       jsonb not null default '[]'::jsonb,
  missing_capabilities        jsonb not null default '[]'::jsonb,

  -- Reward policy.  Controls what is allowed by tier.
  -- Example: {"gold_coins": false, "tournaments": false, "xp": true, "silver_coins": false}
  reward_policy               jsonb not null default '{"gold_coins": false, "tournaments": false, "xp": true, "silver_coins": false}'::jsonb,

  -- Currently active verifier version (null until first publish).
  active_verifier_version     text,

  -- Candidate under shadow evaluation before promotion.
  candidate_verifier_version  text,

  -- Provenance.
  created_by                  text not null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists idx_ad_slug               on activity_definitions (slug);
create index if not exists idx_ad_verification_status on activity_definitions (verification_status);

comment on table  activity_definitions                           is 'One row per training activity; lifecycle moves from draft to certified.';
comment on column activity_definitions.verification_status       is 'draft|experimental|beta|certified|disabled. Only certified activities may be used for Gold Coins or tournaments (if reward_policy allows).';
comment on column activity_definitions.missing_capabilities      is 'Capabilities required by verification_strategy that have no available implementation.';
comment on column activity_definitions.existing_classifier_authoritative is 'Set true only for Sit while the legacy classifier remains the ground truth.';


-- ---------------------------------------------------------------------------
-- Seed: Sit activity definition (backward-compatible)
-- ---------------------------------------------------------------------------

insert into activity_definitions (
  slug,
  display_name,
  description,
  instructions,
  verification_status,
  verification_strategy,
  recording_config,
  success_conditions,
  failure_conditions,
  required_capabilities,
  missing_capabilities,
  reward_policy,
  active_verifier_version,
  created_by
) values (
  'sit',
  'Sit',
  'The dog must start standing, transition to a sitting position, and hold the sit for at least 700 ms.',
  'Record your dog before the cue is given so the starting stance is visible. Give the sit cue and capture the full transition.',
  'certified',
  '{
    "strategy_type": "pose_transition",
    "modules": [
      "video_quality_gate",
      "pose_quality_gate",
      "pose_transition_detector",
      "hold_duration_detector"
    ],
    "existing_classifier_authoritative": true,
    "requires_rgb_fallback": false
  }'::jsonb,
  '{
    "min_duration_seconds": 2,
    "max_duration_seconds": 8,
    "full_body_visible": true
  }'::jsonb,
  '[
    {"condition": "dog_started_standing", "description": "Dog must begin in a standing position"},
    {"condition": "hip_drop_detected", "description": "Hip drop ratio must reach minimum threshold"},
    {"condition": "sit_held", "description": "Sitting position held for minimum duration"}
  ]'::jsonb,
  '[
    {"condition": "dog_not_visible", "description": "Dog not detected in frame"},
    {"condition": "already_sitting", "description": "Dog was already sitting at the start"},
    {"condition": "sit_not_held", "description": "Sitting position not maintained for minimum duration"}
  ]'::jsonb,
  '["video_quality_gate", "pose_quality_gate", "pose_transition_detector", "hold_duration_detector"]'::jsonb,
  '[]'::jsonb,
  '{"gold_coins": true, "tournaments": true, "xp": true, "silver_coins": true}'::jsonb,
  'sit_rule_based_v1',
  'system'
) on conflict (slug) do nothing;


-- ---------------------------------------------------------------------------
-- activity_data_collection_submissions
-- ---------------------------------------------------------------------------
-- Records from experimental activities where capabilities are missing.
-- Used to accumulate labeled data for future training.
-- Verification result is always 'unsupported_data_collection_only'.

create table if not exists activity_data_collection_submissions (
  id                          uuid primary key default gen_random_uuid(),
  activity_definition_id      uuid not null references activity_definitions(id) on delete cascade,
  verification_id             uuid,  -- references activity_verifications if available
  user_id                     uuid not null,
  dog_id                      uuid not null,

  activity_slug               text not null,
  verification_status_at_time text not null,  -- snapshot of activity's status when submitted
  missing_capabilities        jsonb not null default '[]'::jsonb,

  -- Stored pose data (always saved).
  pose_sequence_saved         boolean not null default false,

  -- Video metadata (retained per existing consent policy).
  video_retained              boolean not null default false,
  video_storage_path          text,

  -- Optional ground-truth label provided by the user or a tester.
  expected_result             text check (expected_result in ('pass', 'fail', 'uncertain', null)),

  -- Recording metadata forwarded from the client.
  recording_metadata          jsonb not null default '{}'::jsonb,
  device_metadata             jsonb not null default '{}'::jsonb,

  created_at                  timestamptz not null default now()
);

create index if not exists idx_adcs_activity_def    on activity_data_collection_submissions (activity_definition_id);
create index if not exists idx_adcs_activity_slug   on activity_data_collection_submissions (activity_slug);
create index if not exists idx_adcs_created_at      on activity_data_collection_submissions (created_at desc);

comment on table activity_data_collection_submissions is 'Experimental submissions for activities with missing verifier capabilities.  Used to accumulate training data.';


-- ---------------------------------------------------------------------------
-- activity_training_readiness
-- ---------------------------------------------------------------------------
-- One row per activity definition.  Recomputed periodically.
-- Does not trigger automated training — reports readiness only.

create table if not exists activity_training_readiness (
  id                         uuid primary key default gen_random_uuid(),
  activity_definition_id     uuid not null unique references activity_definitions(id) on delete cascade,

  -- Label counts from labeled review records.
  positive_label_count       integer not null default 0,
  negative_label_count       integer not null default 0,
  ambiguous_label_count      integer not null default 0,
  invalid_recording_count    integer not null default 0,

  -- Coverage metrics.
  dog_count                  integer not null default 0,   -- distinct dogs seen
  camera_angle_coverage      double precision,             -- fraction of angle diversity 0-1
  dog_size_coverage          double precision,             -- fraction of size diversity 0-1
  breed_coverage             double precision,             -- fraction of breed diversity 0-1

  -- Capabilities that are still missing as of last computation.
  missing_capabilities       jsonb not null default '[]'::jsonb,

  -- Readiness verdict.
  ready_for_candidate_training boolean not null default false,
  readiness_reason             jsonb not null default '[]'::jsonb,  -- list of strings

  updated_at                 timestamptz not null default now()
);

comment on table activity_training_readiness is 'Computed readiness for future training jobs.  Informational only — does not trigger automated training.';
