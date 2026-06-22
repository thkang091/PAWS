-- ============================================================
-- Migration 0026 — Gemini Verification Corrections
-- ============================================================
-- Purpose
-- -------
-- 1. Fix the RLS bypass risk on dog_training_video_submissions:
--    the previous "for all" owner policy let any authenticated
--    owner directly INSERT or UPDATE vlm_verdict / status,
--    bypassing the real Gemini review.  Replace with separate
--    per-operation policies that restrict what clients may set.
--
-- 2. Add the Gemini audit-trail columns required by the
--    verification contract to both:
--      • dog_training_video_submissions
--      • dog_training_verification_results
--
-- 3. Lock down dog_training_verification_results so that
--    only service_role (i.e. the edge function) can write
--    verdict rows.  Users and admins may read only.
--
-- Required columns (per spec)
-- ---------------------------
--   submission_hash              – SHA-256 of the uploaded video
--                                  bytes; used for deduplication.
--   prompt_version               – The integer version of
--                                  vlm_prompt active at submission
--                                  time (sourced from
--                                  training_activity_versions).
--   model_identifier             – Configured Gemini model string,
--                                  e.g. "gemini-2.5-flash".
--   reference_asset_storage_paths – Storage paths of the reference
--                                  photos actually sent to Gemini.
--   raw_gemini_response          – Verbatim JSON response body from
--                                  the Gemini API.
--   reward_granted               – Whether XP / coins have been
--                                  issued for this verified PASS.
--
-- Progression rule (enforced by RLS + edge function)
-- ---------------------------------------------------
--   PASS   → edge function may set reward_granted = true and
--             insert into dog_training_reward_log.
--   FAIL / NEEDS_REVIEW / UNSUPPORTED → reward_granted stays false;
--             no progression unlocked.
--   Owner confirmation must NOT override any non-PASS verdict.
-- ============================================================

-- ──────────────────────────────────────────────
-- dog_training_video_submissions — new columns
-- ──────────────────────────────────────────────

alter table dog_training_video_submissions
  add column if not exists submission_hash               text unique,
  add column if not exists prompt_version                integer,
  add column if not exists model_identifier              text,
  add column if not exists reference_asset_storage_paths text[] not null default '{}',
  add column if not exists raw_gemini_response           jsonb,
  add column if not exists reward_granted                boolean not null default false;

comment on column dog_training_video_submissions.submission_hash is
  'SHA-256 hex digest of the uploaded video bytes. Used to deduplicate re-submissions of the same file.';

comment on column dog_training_video_submissions.prompt_version is
  'Integer version of training_catalog_activities.vlm_prompt that was active when this submission was sent to Gemini. Sourced from training_activity_versions.version_number.';

comment on column dog_training_video_submissions.model_identifier is
  'Configured Gemini model string used for this verification, e.g. "gemini-2.5-flash". Set by the edge function from the GEMINI_MODEL secret.';

comment on column dog_training_video_submissions.reference_asset_storage_paths is
  'Storage paths of the dog_training_reference_assets rows actually sent to Gemini as reference photos for this submission.';

comment on column dog_training_video_submissions.raw_gemini_response is
  'Verbatim JSON response body from the Gemini API. Stored for audit, replay, and calibration. Never exposed to mobile clients.';

comment on column dog_training_video_submissions.reward_granted is
  'True only after the edge function confirms verdict=PASS and idempotently inserts a dog_training_reward_log row. Clients may read this field; only service_role may set it.';

-- ──────────────────────────────────────────────
-- dog_training_video_submissions — RLS fix
-- ──────────────────────────────────────────────
-- The previous "for all" policy allowed authenticated owners to
-- INSERT rows with pre-set vlm_verdict, status, and confidence,
-- effectively bypassing real Gemini review.  Replace it with
-- three separate, narrowly-scoped policies.

drop policy if exists "dtvs_owner" on dog_training_video_submissions;

-- SELECT: owner may read their own dog's submissions.
create policy "dtvs_owner_select"
  on dog_training_video_submissions
  for select
  to authenticated
  using (
    exists (
      select 1 from dogs
      where id = dog_id and owner_id = auth.uid()
    )
  );

-- INSERT: owner may create a new submission but only in the
-- initial pending state.  All Gemini-written fields must be null
-- or default at insert time — the edge function fills them in.
create policy "dtvs_owner_insert"
  on dog_training_video_submissions
  for insert
  to authenticated
  with check (
    exists (
      select 1 from dogs
      where id = dog_id and owner_id = auth.uid()
    )
    -- Clients must not pre-set any verdict or result field.
    and status     = 'pending'
    and vlm_verdict            is null
    and vlm_confidence         is null
    and model_identifier       is null
    and raw_gemini_response    is null
    and reward_granted         = false
    and submission_hash        is not null   -- hash must be provided by the client
  );

-- UPDATE: clients may only update storage_path and transition
-- status from 'pending' → 'processing' (i.e. once the upload
-- is done).  They may never touch any Gemini result field.
create policy "dtvs_owner_update_upload"
  on dog_training_video_submissions
  for update
  to authenticated
  using (
    exists (
      select 1 from dogs
      where id = dog_id and owner_id = auth.uid()
    )
    and status = 'pending'
  )
  with check (
    exists (
      select 1 from dogs
      where id = dog_id and owner_id = auth.uid()
    )
    and status in ('pending', 'processing')
    -- Gemini result columns must remain null / default.
    and vlm_verdict          is null
    and vlm_confidence       is null
    and model_identifier     is null
    and raw_gemini_response  is null
    and reward_granted       = false
  );

-- Admins may read all submissions for QA.
create policy "dtvs_admin_read"
  on dog_training_video_submissions
  for select
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- ──────────────────────────────────────────────
-- dog_training_verification_results — new columns
-- ──────────────────────────────────────────────

alter table dog_training_verification_results
  add column if not exists prompt_version                integer,
  add column if not exists model_identifier              text,
  add column if not exists reference_asset_storage_paths text[] not null default '{}',
  add column if not exists raw_gemini_response           jsonb,
  add column if not exists reward_granted                boolean not null default false;

comment on column dog_training_verification_results.prompt_version is
  'Integer version of vlm_prompt active when Gemini was called. Matches submission.prompt_version.';

comment on column dog_training_verification_results.model_identifier is
  'Configured Gemini model string, e.g. "gemini-2.5-flash". Set by the edge function from the GEMINI_MODEL secret.';

comment on column dog_training_verification_results.reference_asset_storage_paths is
  'Storage paths of the reference photos that were sent to Gemini alongside the training video.';

comment on column dog_training_verification_results.raw_gemini_response is
  'Verbatim JSON response body from the Gemini API before normalization. Stored for audit, replay, and calibration.';

comment on column dog_training_verification_results.reward_granted is
  'True after the edge function confirms verdict=PASS and issues XP/coins idempotently. Only service_role may set this.';

-- ──────────────────────────────────────────────
-- dog_training_verification_results — lock RLS
-- ──────────────────────────────────────────────
-- The 0023 migration created RLS policies but omitted an explicit
-- INSERT/UPDATE deny for authenticated users (RLS deny-by-default
-- covers this, but an explicit comment clarifies intent).
-- Only service_role (the edge function) may write results.
-- Re-issue the owner read policy to be safe in case it was
-- missing from 0023 on some environments.

drop policy if exists "dtvr_owner_read"  on dog_training_verification_results;
drop policy if exists "dtvr_admin_all"   on dog_training_verification_results;

-- Owner may read results for their own dogs.
create policy "dtvr_owner_read"
  on dog_training_verification_results
  for select
  to authenticated
  using (
    exists (
      select 1 from dogs
      where id = dog_id and owner_id = auth.uid()
    )
  );

-- Admins may read all results for QA and calibration.
create policy "dtvr_admin_read"
  on dog_training_verification_results
  for select
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- Admins may update (correct) results for QA — but not insert.
create policy "dtvr_admin_update"
  on dog_training_verification_results
  for update
  to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- INSERT and DELETE are intentionally not granted to any
-- authenticated role.  Only service_role (the edge function,
-- which bypasses RLS) may insert or delete result rows.

-- ──────────────────────────────────────────────
-- Progression rule helper function
-- ──────────────────────────────────────────────
-- Called by the edge function (service_role) after writing a
-- PASS verdict.  Inserts a reward log row idempotently and
-- marks reward_granted on both tables.
--
-- The function is restricted to service_role so no client can
-- call it directly from a mobile app.

create or replace function grant_training_pass_reward(
  p_submission_id   uuid,
  p_dog_id          uuid,
  p_activity_id     text,
  p_roadmap_day_id  uuid,
  p_xp              integer,
  p_coins           integer,
  p_stars           integer,
  p_idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Confirm the submission exists and has a PASS verdict.
  -- (Normalised verdict is stored in dog_training_verification_results;
  --  raw submission status in dog_training_video_submissions.)
  if not exists (
    select 1
    from dog_training_verification_results
    where submission_id = p_submission_id
      and verdict = 'PASS'
  ) then
    raise exception 'grant_training_pass_reward: submission % does not have a confirmed PASS verdict', p_submission_id;
  end if;

  -- Idempotently insert the reward log row.
  insert into dog_training_reward_log (
    dog_id, roadmap_day_id, activity_id,
    xp_awarded, coins_awarded, stars_awarded,
    source, idempotency_key
  )
  values (
    p_dog_id, p_roadmap_day_id, p_activity_id,
    p_xp, p_coins, p_stars,
    'activity_pass', p_idempotency_key
  )
  on conflict (idempotency_key) do nothing;

  -- Mark both records so the client can display the reward state.
  update dog_training_video_submissions
    set reward_granted = true
    where id = p_submission_id;

  update dog_training_verification_results
    set reward_granted = true
    where submission_id = p_submission_id;
end;
$$;

-- Revoke from all roles — only service_role (bypasses RLS) calls this.
revoke all on function grant_training_pass_reward(uuid, uuid, text, uuid, integer, integer, integer, text)
  from anon, authenticated;

-- ──────────────────────────────────────────────
-- Index additions
-- ──────────────────────────────────────────────

create index if not exists idx_dtvs_submission_hash
  on dog_training_video_submissions(submission_hash)
  where submission_hash is not null;

create index if not exists idx_dtvs_reward_granted
  on dog_training_video_submissions(dog_id, reward_granted);

create index if not exists idx_dtvr_reward_granted
  on dog_training_verification_results(dog_id, reward_granted);
