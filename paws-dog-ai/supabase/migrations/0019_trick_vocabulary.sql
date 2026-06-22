-- Migration 0019: trick_vocabulary
-- Stores the canonical set of recognized tricks with per-trick thresholds.
-- The active flag controls whether the trick is exposed to end users.
-- Per-trick classifier thresholds live here so they can be updated without
-- a code deployment.

create table if not exists public.trick_vocabulary (
    id                              uuid        primary key default gen_random_uuid(),
    slug                            text        not null unique,
    display_name                    text        not null,
    category                        text        not null default 'basic',
    difficulty                      integer     not null default 1
                                    check (difficulty between 1 and 5),
    minimum_hold_ms                 integer     null,
    pass_confidence_threshold       real        not null default 0.75,
    retry_confidence_threshold      real        not null default 0.50,
    minimum_visible_joints          integer     not null default 6,
    minimum_recording_duration_ms   integer     not null default 2000,
    active                          boolean     not null default true,
    created_at                      timestamptz not null default now()
);

alter table public.trick_vocabulary enable row level security;

-- Service role only: the mobile client never reads this table directly.
create policy "service_role_only" on public.trick_vocabulary
    as restrictive using (false);

-- Seed the initial trick vocabulary.
insert into public.trick_vocabulary
    (slug, display_name, category, difficulty,
     minimum_hold_ms,
     pass_confidence_threshold, retry_confidence_threshold,
     minimum_visible_joints, minimum_recording_duration_ms,
     active)
values
    ('sit',   'Sit',   'foundation', 1, 700,  0.75, 0.50, 6, 2000, true),
    ('down',  'Down',  'foundation', 2, 700,  0.75, 0.50, 6, 2000, true),
    ('stay',  'Stay',  'duration',   3, 3000, 0.75, 0.50, 6, 4000, true),
    ('paw',   'Paw',   'contact',    2, null, 0.75, 0.50, 6, 2000, true),
    ('stand', 'Stand', 'foundation', 1, null, 0.75, 0.50, 6, 2000, true),
    ('spin',  'Spin',  'movement',   3, null, 0.72, 0.48, 5, 3000, true)
on conflict (slug) do nothing;

-- Index for fast slug lookup.
create index if not exists trick_vocabulary_slug_idx
    on public.trick_vocabulary (slug);

create index if not exists trick_vocabulary_active_idx
    on public.trick_vocabulary (active);
