-- Migration: 0022_anti_cheat
-- Adds tables for duplicate detection, anti-cheat audits, account risk
-- profiles, and restriction log.

-- ---------------------------------------------------------------------------
-- submission_hashes
-- ---------------------------------------------------------------------------
-- One row per verification attempt.  Stores all hash types so subsequent
-- submissions can be compared against the full historical set.

create table if not exists submission_hashes (
  id                  uuid primary key default gen_random_uuid(),
  verification_id     uuid not null unique references activity_verifications(id) on delete cascade,
  user_id             uuid not null,
  dog_id              uuid not null,
  activity_id         text not null,

  -- Exact video hash (SHA-256 of raw bytes).  Null when raw video not retained.
  video_sha256        text,

  -- Average-hash array for selected RGB frames.  Each element is a 16-char
  -- hex string representing a 64-bit hash.
  frame_hashes        jsonb not null default '[]'::jsonb,

  -- Pose sequence hashes.
  pose_exact_hash     text,       -- SHA-256 of quantized pose JSON
  pose_simhash        text,       -- 16-char hex SimHash (64-bit)

  created_at          timestamptz not null default now()
);

create index if not exists idx_sh_user_id        on submission_hashes (user_id);
create index if not exists idx_sh_activity_id    on submission_hashes (activity_id);
create index if not exists idx_sh_video_sha256   on submission_hashes (video_sha256) where video_sha256 is not null;
create index if not exists idx_sh_pose_exact     on submission_hashes (pose_exact_hash) where pose_exact_hash is not null;
create index if not exists idx_sh_pose_simhash   on submission_hashes (pose_simhash) where pose_simhash is not null;
create index if not exists idx_sh_created_at     on submission_hashes (created_at desc);

comment on table  submission_hashes              is 'Content hashes for every verification attempt, used for duplicate detection.';
comment on column submission_hashes.video_sha256 is 'SHA-256 of raw video bytes. Null when retain_raw_video=false.';
comment on column submission_hashes.pose_simhash is '64-bit SimHash of normalized pose sequence for near-duplicate matching.';


-- ---------------------------------------------------------------------------
-- anti_cheat_audits
-- ---------------------------------------------------------------------------
-- Immutable audit trail.  One row per attempt that went through anti-cheat
-- checks.  Admin review fields (reviewed_by, admin_action, etc.) are filled
-- in by the review workflow and are the only mutable columns.

create table if not exists anti_cheat_audits (
  id                    uuid primary key default gen_random_uuid(),
  verification_id       uuid not null references activity_verifications(id) on delete cascade,
  user_id               uuid not null,
  dog_id                uuid not null,
  tier                  text not null,

  -- Risk assessment
  risk_score            double precision not null,
  signals               jsonb not null default '[]'::jsonb,
  duplicate_match       jsonb,       -- DuplicateMatch or null

  -- Decision
  decision              text not null check (decision in ('proceed', 'review', 'block_reward')),
  reward_eligible       boolean not null,
  anti_cheat_version    text not null,

  -- Admin review (filled after creation)
  reviewed_by           text,
  reviewed_at           timestamptz,
  admin_action          text check (admin_action in (
                            'approve', 'reject', 'warn', 'restrict',
                            'block', 'clear_false_positive'
                        )),
  admin_notes           text,

  created_at            timestamptz not null default now()
);

create index if not exists idx_aca_verification_id on anti_cheat_audits (verification_id);
create index if not exists idx_aca_user_id         on anti_cheat_audits (user_id);
create index if not exists idx_aca_decision        on anti_cheat_audits (decision);
create index if not exists idx_aca_reviewed_at     on anti_cheat_audits (reviewed_at) where reviewed_at is null;
create index if not exists idx_aca_created_at      on anti_cheat_audits (created_at desc);

comment on table  anti_cheat_audits          is 'Anti-cheat decision records with full signal and duplicate-match detail.';
comment on column anti_cheat_audits.decision is 'proceed = reward eligible; review = manual review required; block_reward = reward blocked.';


-- ---------------------------------------------------------------------------
-- account_risk_profiles
-- ---------------------------------------------------------------------------
-- One row per user, upserted by anti_cheat_service after each high-stakes
-- attempt.  Tracks rolling risk state and admin-set restriction.

create table if not exists account_risk_profiles (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null unique,

  risk_score              double precision not null default 0.0,
  risk_flags              jsonb not null default '[]'::jsonb,
  restriction_state       text not null default 'none' check (
                              restriction_state in ('none', 'warned', 'restricted', 'blocked')
                          ),
  restriction_expires_at  timestamptz,   -- null = permanent or no restriction

  -- Counters
  total_flags             integer not null default 0,
  consecutive_suspicious  integer not null default 0,

  updated_at              timestamptz not null default now()
);

create index if not exists idx_arp_user_id           on account_risk_profiles (user_id);
create index if not exists idx_arp_restriction_state on account_risk_profiles (restriction_state);

comment on table  account_risk_profiles                       is 'Per-user rolling risk state, updated after each anti-cheat run.';
comment on column account_risk_profiles.restriction_state     is 'none | warned | restricted | blocked. Only admin can set restricted/blocked.';
comment on column account_risk_profiles.restriction_expires_at is 'Null when restriction is permanent or when state is none/warned.';


-- ---------------------------------------------------------------------------
-- account_restriction_log
-- ---------------------------------------------------------------------------
-- Immutable history of every admin action taken on an account.

create table if not exists account_restriction_log (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null,
  action                    text not null,
  reason                    text,
  restriction_duration_days integer,
  restriction_expires_at    timestamptz,
  reviewed_by               text not null,
  created_at                timestamptz not null default now()
);

create index if not exists idx_arl_user_id    on account_restriction_log (user_id);
create index if not exists idx_arl_created_at on account_restriction_log (created_at desc);

comment on table account_restriction_log is 'Immutable log of every admin restriction / clearance action.';
