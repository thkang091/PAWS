-- Stores per-verification pose sequences for ML training data collection.
-- Phase 0: instrumentation only — no classifier depends on this table.

create table if not exists public.pose_sequences (
    id                  uuid primary key default gen_random_uuid(),
    verification_id     uuid not null references public.activity_verifications(id) on delete cascade,
    dog_id              uuid not null references public.dogs(id) on delete cascade,
    pose_model_version  text not null,
    avg_confidence      real not null,
    frame_count         integer not null,
    inference_latency_ms integer,
    -- frames is a JSONB array: [{frame_index, timestamp_ms, keypoints: {name: {x,y,confidence}}, confidence}]
    frames              jsonb not null default '[]'::jsonb,
    created_at          timestamptz not null default now()
);

create index if not exists pose_sequences_verification_id_idx on public.pose_sequences(verification_id);
create index if not exists pose_sequences_dog_id_idx on public.pose_sequences(dog_id);
create index if not exists pose_sequences_created_at_idx on public.pose_sequences(created_at);

-- Only the service role may write; no client-side access.
alter table public.pose_sequences enable row level security;

create policy "service_role_only" on public.pose_sequences
    as restrictive
    using (false);
