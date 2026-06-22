-- Migration: 0023_monitoring
-- Adds tables for model registry, per-verification metric events,
-- and on-device telemetry.
--
-- Design notes
-- ------------
-- model_registry       — one row per registered model version; admin-managed.
-- metric_events        — append-only row per verification; used for windowed
--                        aggregations and trend queries.
-- device_metric_events — on-device pose extraction telemetry; one row per
--                        attempt that used on-device inference.
-- alert_log            — immutable record of every alert that fired.


-- ---------------------------------------------------------------------------
-- model_registry
-- ---------------------------------------------------------------------------
-- Tracks every model version the service has used or can use.  The 'active'
-- flag determines whether the version is in service.  Only one version per
-- component_type should be active at a time (enforced by the promote RPC).
-- rollback_version points to the version that will be restored if a rollback
-- is triggered; it is set automatically when a new version is promoted.

create table if not exists model_registry (
  id                     uuid primary key default gen_random_uuid(),
  model_version          text not null,
  component_type         text not null check (component_type in (
                             'pose_classifier',
                             'learned_sit_classifier',
                             'rgb_verifier',
                             'trick_classifier',
                             'combo_classifier',
                             'on_device_pose'
                         )),

  artifact_path          text not null,
  training_dataset_hash  text,       -- SHA-256 of the dataset manifest used for training

  active                 boolean not null default false,
  rollout_percentage     double precision not null default 100.0
                             check (rollout_percentage >= 0 and rollout_percentage <= 100),
  rollback_version       text,       -- version to activate on rollback; null = no fallback known

  deployed_at            timestamptz not null default now(),
  promoted_by            text,
  notes                  text,

  -- Inline metrics summary (filled by periodic flush from in-memory counters)
  metrics_total          integer not null default 0,
  metrics_pass_rate      double precision,
  metrics_error_rate     double precision,
  metrics_avg_latency_ms double precision,
  metrics_p95_latency_ms double precision,
  metrics_updated_at     timestamptz,

  created_at             timestamptz not null default now(),

  unique (model_version, component_type)
);

create index if not exists idx_mr_component_type on model_registry (component_type);
create index if not exists idx_mr_active         on model_registry (active) where active = true;

comment on table  model_registry                       is 'Registry of all model versions; admin-managed.';
comment on column model_registry.active                is 'True when this version is currently serving traffic.';
comment on column model_registry.rollout_percentage    is '0-100. Controls what fraction of users reach this model.';
comment on column model_registry.rollback_version      is 'Version that was active before this one was promoted.';
comment on column model_registry.training_dataset_hash is 'SHA-256 of the dataset manifest used to train this version.';


-- ---------------------------------------------------------------------------
-- metric_events
-- ---------------------------------------------------------------------------
-- Append-only table; one row per completed verification attempt.
-- Supports time-windowed aggregation by model_version, activity_id, tier.

create table if not exists metric_events (
  id                   uuid primary key default gen_random_uuid(),
  verification_id      uuid,            -- may be null in tests
  model_version        text not null,
  activity_id          text not null,
  tier                 text not null,

  -- Outcome
  status               text not null,   -- passed | failed_* | retry_* | error | low_quality | ...
  confidence_score     double precision,
  inference_latency_ms integer,

  -- Flags
  is_error             boolean not null default false,
  is_fallback          boolean not null default false,
  is_low_quality       boolean not null default false,
  is_manual_review     boolean not null default false,
  is_fraud_review      boolean not null default false,
  disagreed            boolean not null default false,

  -- On-device path
  used_on_device_pose  boolean not null default false,
  fell_back_to_video   boolean not null default false,

  created_at           timestamptz not null default now()
);

create index if not exists idx_me_model_version on metric_events (model_version);
create index if not exists idx_me_activity_id   on metric_events (activity_id);
create index if not exists idx_me_created_at    on metric_events (created_at desc);
create index if not exists idx_me_status        on metric_events (status);

comment on table metric_events is 'One row per verification; used for aggregated metrics and trend queries.';


-- ---------------------------------------------------------------------------
-- device_metric_events
-- ---------------------------------------------------------------------------
-- Telemetry from on-device pose extraction.  One row per attempt that used
-- on-device inference.  Enables per-device-model and per-app-version analysis.

create table if not exists device_metric_events (
  id                         uuid primary key default gen_random_uuid(),
  verification_id            uuid,
  user_id                    uuid,

  iphone_model               text,
  ios_version                text,
  app_version                text,
  on_device_pose_version     text,

  frame_inference_latency_ms double precision,
  dropped_frame_rate         double precision,  -- 0.0-1.0
  payload_size_bytes         integer,
  fell_back_to_video         boolean not null default false,

  created_at                 timestamptz not null default now()
);

create index if not exists idx_dme_iphone_model          on device_metric_events (iphone_model);
create index if not exists idx_dme_on_device_pose_version on device_metric_events (on_device_pose_version);
create index if not exists idx_dme_created_at            on device_metric_events (created_at desc);

comment on table device_metric_events is 'On-device pose extraction telemetry; one row per on-device attempt.';


-- ---------------------------------------------------------------------------
-- alert_log
-- ---------------------------------------------------------------------------
-- Immutable record of every alert that fired.  Used to suppress re-firing and
-- to build an audit trail of service health events.

create table if not exists alert_log (
  id             uuid primary key default gen_random_uuid(),
  alert_type     text not null,
  level          text not null check (level in ('warning', 'critical')),
  model_version  text,
  metric_name    text not null,
  observed_value double precision not null,
  threshold      double precision not null,
  message        text not null,
  resolved       boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists idx_al_alert_type on alert_log (alert_type);
create index if not exists idx_al_resolved   on alert_log (resolved) where resolved = false;
create index if not exists idx_al_created_at on alert_log (created_at desc);

comment on table alert_log is 'Immutable record of alert firings; used for suppression and audit.';
