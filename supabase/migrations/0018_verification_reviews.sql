-- Internal labeling and review queue for verification attempts.
-- Kept separate from activity_verifications so review state never affects
-- the user-visible verification result.

create table if not exists public.verification_reviews (
    id                  uuid primary key default gen_random_uuid(),
    verification_id     uuid not null references public.activity_verifications(id) on delete cascade,

    -- Review state machine:
    --   pending_review -> reviewed | skipped | disputed
    --   disputed       -> reviewed | needs_relabeling
    --   needs_relabeling -> reviewed
    --   reviewed (terminal unless disputed)
    --   skipped  (terminal)
    review_state        text not null default 'pending_review' check (review_state in (
        'pending_review', 'reviewed', 'skipped', 'disputed', 'needs_relabeling'
    )),

    -- Why this item was queued.
    enqueue_reason      text not null check (enqueue_reason in (
        'shadow_disagreement', 'low_confidence', 'retry', 'quality_flag', 'manual'
    )),

    -- Shadow-mode context at queue time.
    rule_based_status   text null,
    learned_prediction  text null,
    learned_confidence  numeric null,

    -- Label fields (populated by reviewer).
    ground_truth_trick      text null,
    trick_completed         boolean null,
    attempt_quality         text null check (attempt_quality is null or attempt_quality in (
        'clean', 'partial', 'failed', 'ambiguous', 'invalid_recording'
    )),
    start_timestamp_ms      integer null,
    end_timestamp_ms        integer null,
    failure_reason          text null,
    reviewer_notes          text null,
    reviewed_by             text null,
    reviewed_at             timestamptz null,
    is_hard_negative        boolean not null default false,

    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

create index if not exists verification_reviews_verification_id_idx
    on public.verification_reviews(verification_id);

create index if not exists verification_reviews_state_idx
    on public.verification_reviews(review_state);

create index if not exists verification_reviews_created_at_idx
    on public.verification_reviews(created_at desc);

-- Service role only. No client or authenticated access.
alter table public.verification_reviews enable row level security;

create policy "service_role_only" on public.verification_reviews
    as restrictive
    using (false);
