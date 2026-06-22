-- ============================================================
-- Migration 0023 — Catalog Schema v2
-- ============================================================
-- Extends the training catalog tables that were created in 0019
-- and 0021 with the fields required for the VLM verification
-- contract and the richer recording-requirements spec.
--
-- Changes
-- -------
-- training_catalog_activities
--   + start_state_criteria   text[]  — what the dog/owner must
--                                      demonstrate before recording begins
--   + out_of_scope_claims    text[]  — claims the VLM must never make
--   + recording_requirements jsonb   — RecordingRequirements object
--
-- training_reference_asset_requirements
--   + minimum_photos         integer
--   + maximum_photos         integer
--   + reusable_across_activities boolean
--   + instructions           text[]
--
-- New table
--   dog_training_verification_results — structured VLM output per
--   submission, keyed to dog_training_video_submissions
-- ============================================================

-- ──────────────────────────────────────────────
-- training_catalog_activities — new columns
-- ──────────────────────────────────────────────

alter table training_catalog_activities
  add column if not exists start_state_criteria   text[]  not null default '{}',
  add column if not exists out_of_scope_claims     text[]  not null default '{}',
  add column if not exists recording_requirements  jsonb   not null default '{}';

-- ──────────────────────────────────────────────
-- training_reference_asset_requirements — new columns
-- ──────────────────────────────────────────────

alter table training_reference_asset_requirements
  add column if not exists minimum_photos              integer not null default 1,
  add column if not exists maximum_photos              integer not null default 3,
  add column if not exists reusable_across_activities  boolean not null default true,
  add column if not exists instructions                text[]  not null default '{}';

-- ──────────────────────────────────────────────
-- dog_training_verification_results
-- ──────────────────────────────────────────────
-- Stores the structured VLM verdict for each video submission.
-- One row per submission attempt (1:1 with video_submissions for
-- successfully processed clips; absent for pending/errored rows).

create table if not exists dog_training_verification_results (
  id                           uuid primary key default gen_random_uuid(),

  -- Source submission
  submission_id                uuid not null
                                 references dog_training_video_submissions(id)
                                 on delete cascade,
  dog_id                       uuid not null
                                 references dogs(id)
                                 on delete cascade,
  activity_id                  text not null
                                 references training_catalog_activities(id),

  -- Top-level verdict
  verdict                      text not null
                                 check (verdict in ('PASS','FAIL','NEEDS_REVIEW','UNSUPPORTED')),
  confidence                   numeric(5,4) not null
                                 check (confidence between 0 and 1),
  scorable                     boolean not null default true,

  -- Clip quality flags (stored as jsonb matching ClipQuality shape)
  clip_quality                 jsonb not null default '{}',

  -- Observed timeline events
  observed_events              jsonb not null default '[]',

  -- Criteria outcomes
  satisfied_criteria           text[] not null default '{}',
  failed_criteria              text[] not null default '{}',
  missing_evidence             text[] not null default '{}',

  -- Reference-asset matching results
  matched_reference_assets     jsonb not null default '[]',

  -- Visible action window
  visible_start_timestamp_sec  numeric(8,3),
  visible_end_timestamp_sec    numeric(8,3),

  -- Human-readable reasons
  pass_reason                  text,
  fail_reason                  text,

  -- Review flags
  needs_human_review           boolean not null default false,
  suggested_retry_instruction  text,

  -- Provider metadata
  model_used                   text,
  vlm_latency_ms               integer,

  created_at                   timestamptz not null default timezone('utc', now()),

  -- At most one result per submission
  unique (submission_id)
);

create index if not exists idx_dtvr_dog        on dog_training_verification_results(dog_id);
create index if not exists idx_dtvr_activity   on dog_training_verification_results(activity_id);
create index if not exists idx_dtvr_verdict    on dog_training_verification_results(verdict);
create index if not exists idx_dtvr_submission on dog_training_verification_results(submission_id);

-- ──────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────

alter table dog_training_verification_results enable row level security;

-- Users may read their own dog's results.
create policy "dtvr_owner_read" on dog_training_verification_results
  for select to authenticated
  using (
    exists (
      select 1 from dogs where id = dog_id and owner_id = auth.uid()
    )
  );

-- Users may NOT insert or update directly; results are written by
-- the edge function / service-role only.

-- Admins may read all results for QA and calibration.
create policy "dtvr_admin_all" on dog_training_verification_results
  for all to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
