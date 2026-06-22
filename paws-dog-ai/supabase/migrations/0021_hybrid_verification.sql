-- Migration: 0021_hybrid_verification
-- Adds the audit table and tier-policy table for hybrid verification.

-- ---------------------------------------------------------------------------
-- hybrid_verification_audits
-- ---------------------------------------------------------------------------
-- One row per attempt that passed through the hybrid or direct_manual_review
-- path.  Standard daily attempts that stay on the fast_pose path are NOT
-- recorded here (to avoid inflating table size), but high-stakes tiers always
-- produce an audit row regardless of path.

create table if not exists hybrid_verification_audits (
  id                      uuid primary key default gen_random_uuid(),
  verification_id         uuid not null references activity_verifications(id) on delete cascade,
  user_id                 uuid not null,
  dog_id                  uuid not null,

  -- Routing
  tier                    text not null,
  routing_path            text not null check (routing_path in ('fast_pose', 'hybrid', 'direct_manual_review')),
  routing_reasons         jsonb not null default '[]'::jsonb,

  -- Model provenance
  pose_model_version      text not null,
  rgb_provider            text,
  rgb_model_version       text,

  -- Scores
  pose_score              double precision not null,
  rgb_score               double precision,
  quality_score           double precision not null,
  anomaly_score           double precision not null,
  fused_confidence        double precision not null,
  anomaly_flags           jsonb not null default '[]'::jsonb,

  -- Decision
  final_status            text not null check (final_status in ('passed', 'failed', 'retry', 'manual_review')),
  tier_policy_applied     text,

  -- Consent / data governance
  consent_video_retained  boolean not null default false,

  created_at              timestamptz not null default now()
);

create index if not exists idx_hva_verification_id on hybrid_verification_audits (verification_id);
create index if not exists idx_hva_user_id         on hybrid_verification_audits (user_id);
create index if not exists idx_hva_tier            on hybrid_verification_audits (tier);
create index if not exists idx_hva_final_status    on hybrid_verification_audits (final_status);
create index if not exists idx_hva_created_at      on hybrid_verification_audits (created_at desc);

comment on table  hybrid_verification_audits                  is 'Immutable audit trail for hybrid and high-stakes verification attempts.';
comment on column hybrid_verification_audits.routing_path     is 'fast_pose | hybrid | direct_manual_review';
comment on column hybrid_verification_audits.fused_confidence is 'Weighted combination of pose, RGB, and quality scores after anomaly discount.';
comment on column hybrid_verification_audits.tier_policy_applied is 'Human-readable description of the stricter policy rule that fired, if any.';
comment on column hybrid_verification_audits.consent_video_retained is 'Whether raw video was kept under the active retention config at decision time.';

-- ---------------------------------------------------------------------------
-- verification_tier_policies
-- ---------------------------------------------------------------------------
-- Operator-controlled per-tier overrides.  Not used by application code at
-- runtime (thresholds live in config.py), but available for ops tooling and
-- future dynamic policy loading.

create table if not exists verification_tier_policies (
  id                              uuid primary key default gen_random_uuid(),
  tier                            text not null unique,
  pass_threshold                  double precision not null,
  manual_review_threshold         double precision,    -- null = no borderline zone
  rgb_required                    boolean not null default false,
  anomaly_threshold               double precision not null default 0.40,
  direct_review_anomaly_threshold double precision not null default 0.75,
  active                          boolean not null default true,
  notes                           text,
  updated_at                      timestamptz not null default now()
);

insert into verification_tier_policies
  (tier, pass_threshold, manual_review_threshold, rgb_required, notes)
values
  ('standard_daily',    0.72, null, false, 'Default tier for everyday training.'),
  ('premium_challenge', 0.75, null, false, 'Higher bar; no strict borderline zone.'),
  ('gold_coin_reward',  0.80, 0.88, true,  'Gold Coin attempts must pass RGB and audit trail is mandatory.'),
  ('tournament',        0.82, 0.90, true,  'Tournament ranking may be affected; borderline attempts go to manual review.')
on conflict (tier) do nothing;
