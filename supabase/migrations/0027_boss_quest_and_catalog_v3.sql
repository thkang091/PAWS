-- ============================================================
-- Migration 0027 — Boss-Quest Tables and Catalog Schema v3
-- ============================================================
-- Adds
-- ----
-- 1. New columns on training_catalog_activities:
--      ordered_visible_events   text[]
--      retry_instructions       text[]
--      master_prompt_version    text
--      activity_prompt_version  text
--
-- 2. user_id column on dog_training_video_submissions
--    (required for per-owner storage path construction and RLS).
--
-- 3. hybrid_boss_quest_configs table:
--    One row per HYBRID_BOSS_QUEST activity.
--
-- 4. hybrid_boss_quest_components table:
--    One row per component activity within a boss quest.
--
-- 5. boss_quest_component_results table:
--    One VLM result row per component clip per boss-quest attempt.
--    Aggregated after all mandatory components are reviewed.
--
-- Boss-quest runtime rule
-- -----------------------
-- Upload separate narrow clips (or clearly separated component clips).
-- Run real Gemini 2.5 Flash review for EACH component separately.
-- Store component verdicts in boss_quest_component_results.
-- Aggregate PASS only when every row with required=true has verdict='PASS'.
-- Return failed_component_ids and component-specific retry guidance.
-- ============================================================

-- ──────────────────────────────────────────────
-- training_catalog_activities — new v3 columns
-- ──────────────────────────────────────────────

alter table training_catalog_activities
  add column if not exists ordered_visible_events   text[] not null default '{}',
  add column if not exists retry_instructions       text[] not null default '{}',
  add column if not exists master_prompt_version    text   not null default '1.0.0',
  add column if not exists activity_prompt_version  text   not null default '1.0.0';

comment on column training_catalog_activities.ordered_visible_events is
  'Ordered list of visible events Gemini should detect in sequence. Used for observedEvents in the VLM response and to check actionCapturedFromStartToFinish.';

comment on column training_catalog_activities.retry_instructions is
  'Shown to the owner after a FAIL or NEEDS_REVIEW verdict. Injected into the compiled VLM prompt as RETRY GUIDANCE.';

comment on column training_catalog_activities.master_prompt_version is
  'Semver version of the shared master VLM prompt (masterPrompt.ts) that was current when this activity was last calibrated.';

comment on column training_catalog_activities.activity_prompt_version is
  'Semver version of this activity''s vlm_prompt. Increment whenever vlm_prompt is edited. Stored on each verification result for audit.';

-- ──────────────────────────────────────────────
-- dog_training_video_submissions — add user_id
-- ──────────────────────────────────────────────
-- The 0019 migration omitted user_id, making it impossible to enforce
-- per-owner storage path structure at the DB level.

alter table dog_training_video_submissions
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Backfill from dogs.owner_id for existing rows (safe if table was empty).
update dog_training_video_submissions dtvs
  set user_id = d.owner_id
  from dogs d
  where dtvs.dog_id = d.id
    and dtvs.user_id is null;

-- ──────────────────────────────────────────────
-- hybrid_boss_quest_configs
-- ──────────────────────────────────────────────

create table if not exists hybrid_boss_quest_configs (
  id                                    uuid primary key default gen_random_uuid(),
  boss_activity_id                      text not null unique
                                          references training_catalog_activities(id)
                                          on delete cascade,
  require_all_mandatory_components_pass boolean not null default true,
  created_at                            timestamptz not null default timezone('utc', now()),
  updated_at                            timestamptz not null default timezone('utc', now())
);

comment on table hybrid_boss_quest_configs is
  'One row per HYBRID_BOSS_QUEST activity. Stores the aggregation rule (require_all_mandatory_components_pass).';

comment on column hybrid_boss_quest_configs.require_all_mandatory_components_pass is
  'When true, every component with required=true must return PASS for the boss quest to PASS.';

create index if not exists idx_hbqc_boss on hybrid_boss_quest_configs(boss_activity_id);

create trigger hbqc_updated_at
  before update on hybrid_boss_quest_configs
  for each row execute function set_updated_at();

-- ──────────────────────────────────────────────
-- hybrid_boss_quest_components
-- ──────────────────────────────────────────────

create table if not exists hybrid_boss_quest_components (
  id                    uuid primary key default gen_random_uuid(),
  config_id             uuid not null
                          references hybrid_boss_quest_configs(id)
                          on delete cascade,
  component_activity_id text not null
                          references training_catalog_activities(id),
  display_order         integer not null check (display_order >= 1),
  required              boolean not null default true,
  created_at            timestamptz not null default timezone('utc', now()),
  unique (config_id, component_activity_id),
  unique (config_id, display_order)
);

comment on table hybrid_boss_quest_components is
  'One row per component activity within a HYBRID_BOSS_QUEST. Each component gets its own Gemini review.';

comment on column hybrid_boss_quest_components.required is
  'True = this component must PASS for the boss quest to PASS. False = optional bonus evidence.';

create index if not exists idx_hbqcomp_config on hybrid_boss_quest_components(config_id);
create index if not exists idx_hbqcomp_activity on hybrid_boss_quest_components(component_activity_id);

-- ──────────────────────────────────────────────
-- boss_quest_component_results
-- ──────────────────────────────────────────────
-- One row per component clip per boss-quest verification attempt.
-- The edge function writes one row after each component Gemini call,
-- then aggregates when all mandatory components have results.

create table if not exists boss_quest_component_results (
  id                    uuid primary key default gen_random_uuid(),

  -- The boss-quest submission this result belongs to
  boss_submission_id    uuid not null
                          references dog_training_video_submissions(id)
                          on delete cascade,
  -- The component activity that was reviewed
  component_activity_id text not null
                          references training_catalog_activities(id),
  -- The component's own submission (separate narrow clip)
  component_submission_id uuid
                          references dog_training_video_submissions(id)
                          on delete set null,

  dog_id                uuid not null references dogs(id) on delete cascade,

  -- Whether this component is mandatory for the boss to PASS
  required              boolean not null default true,

  -- Normalized verdict for this component
  verdict               text not null
                          check (verdict in ('PASS','FAIL','NEEDS_REVIEW','UNSUPPORTED')),
  confidence            numeric(5,4) not null check (confidence between 0 and 1),

  -- Gemini audit fields (mirrors dog_training_verification_results)
  model_identifier      text,
  prompt_version        integer,
  raw_gemini_response   jsonb,

  retry_guidance        text,

  created_at            timestamptz not null default timezone('utc', now()),

  unique (boss_submission_id, component_activity_id)
);

comment on table boss_quest_component_results is
  'One VLM result row per component per boss-quest attempt. The edge function aggregates these into the boss verdict.';

create index if not exists idx_bqcr_boss on boss_quest_component_results(boss_submission_id);
create index if not exists idx_bqcr_component on boss_quest_component_results(component_activity_id);
create index if not exists idx_bqcr_dog on boss_quest_component_results(dog_id);

-- ──────────────────────────────────────────────
-- RLS — new tables
-- ──────────────────────────────────────────────

alter table hybrid_boss_quest_configs   enable row level security;
alter table hybrid_boss_quest_components enable row level security;
alter table boss_quest_component_results enable row level security;

-- Boss quest config: readable by all authenticated users (catalog metadata).
create policy "hbqc_read" on hybrid_boss_quest_configs
  for select to authenticated using (true);

create policy "hbqc_admin_write" on hybrid_boss_quest_configs
  for all to authenticated
  using   (exists (select 1 from profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- Boss quest components: readable by all authenticated users.
create policy "hbqcomp_read" on hybrid_boss_quest_components
  for select to authenticated using (true);

create policy "hbqcomp_admin_write" on hybrid_boss_quest_components
  for all to authenticated
  using   (exists (select 1 from profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin = true));

-- Boss quest component results: owner may read their own dog's results.
-- INSERT/UPDATE/DELETE is service_role only (edge function bypasses RLS).
create policy "bqcr_owner_read" on boss_quest_component_results
  for select to authenticated
  using (
    exists (
      select 1 from dogs where id = dog_id and owner_id = auth.uid()
    )
  );

create policy "bqcr_admin_read" on boss_quest_component_results
  for select to authenticated
  using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );
