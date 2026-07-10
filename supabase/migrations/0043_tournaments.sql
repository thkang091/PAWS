-- ============================================================
-- Migration 0041 — Tournaments
-- ============================================================
-- Tournament events with operator-controlled registration,
-- entry via secure RPC, and backend-admin prize settlement.
--
-- The mobile app may:
--   - read visible/published tournament events
--   - read own entries and public leaderboard rows
--   - join a tournament via join_tournament RPC (idempotent,
--     ledger-backed entry fee deduction)
--
-- The mobile app must never:
--   - settle tournament results
--   - award prizes
--   - mutate final placement or score
--   - directly deduct entry fees without the RPC
--
-- All prize payout and settlement functions are granted
-- to service_role only.
-- ============================================================

do $$
begin
  create type tournament_status as enum (
    'draft',
    'scheduled',
    'registration_open',
    'registration_closed',
    'active',
    'reviewing',
    'settled',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type tournament_entry_status as enum (
    'joined',
    'active',
    'disqualified',
    'withdrawn'
  );
exception
  when duplicate_object then null;
end $$;

-- ── Tournament events ─────────────────────────────────────────

create table if not exists tournament_events (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text not null,
  status          tournament_status not null default 'draft',
  challenge_game_id text references challenge_games(id) on delete restrict,
  registration_opens_at timestamptz not null,
  registration_closes_at timestamptz not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  entry_currency  currency_type not null default 'silver_coin',
  entry_cost      integer not null check (entry_cost >= 0),
  max_participants integer not null check (max_participants > 0),
  participant_count integer not null default 0 check (participant_count >= 0),
  max_attempts_per_entry integer not null default 3 check (max_attempts_per_entry > 0),
  prize_first     text not null,
  prize_second    text not null,
  prize_third     text not null,
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now()),
  check (registration_opens_at < registration_closes_at),
  check (registration_closes_at <= starts_at),
  check (starts_at < ends_at),
  check (participant_count <= max_participants)
);

create table if not exists tournament_entries (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournament_events(id) on delete cascade,
  dog_id          uuid not null references dogs(id) on delete cascade,
  owner_id        uuid not null references profiles(id) on delete cascade,
  status          tournament_entry_status not null default 'joined',
  joined_at       timestamptz not null default timezone('utc', now()),
  attempts_used   integer not null default 0 check (attempts_used >= 0),
  best_score      numeric(8,2),
  current_rank    integer,
  idempotency_key text unique not null,
  created_at      timestamptz not null default timezone('utc', now()),
  unique (tournament_id, dog_id)
);

create table if not exists tournament_attempts (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references tournament_entries(id) on delete cascade,
  tournament_id   uuid not null references tournament_events(id) on delete cascade,
  dog_id          uuid not null references dogs(id) on delete cascade,
  owner_id        uuid not null references profiles(id) on delete cascade,
  submission_id   uuid references dog_training_video_submissions(id) on delete set null,
  score           numeric(8,2),
  verdict         text check (verdict in ('PASS', 'FAIL', 'NEEDS_REVIEW')),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default timezone('utc', now())
);

-- ── Indexes ───────────────────────────────────────────────────

create index if not exists tournament_events_status_idx on tournament_events(status, created_at desc);
create index if not exists tournament_entries_tournament_idx on tournament_entries(tournament_id, current_rank);
create index if not exists tournament_entries_dog_idx on tournament_entries(dog_id);
create index if not exists tournament_attempts_entry_idx on tournament_attempts(entry_id, created_at desc);

-- ── Triggers ──────────────────────────────────────────────────

create trigger tournament_events_set_updated_at before update on tournament_events
for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

alter table tournament_events enable row level security;
alter table tournament_entries enable row level security;
alter table tournament_attempts enable row level security;

-- Everyone can see published tournaments
drop policy if exists "tournament events visible read" on tournament_events;
create policy "tournament events visible read" on tournament_events
for select to authenticated
using (status in ('registration_open', 'registration_closed', 'active', 'reviewing', 'settled'));

-- Users see their own entries
drop policy if exists "tournament entries own read" on tournament_entries;
create policy "tournament entries own read" on tournament_entries
for select to authenticated
using (owner_id = auth.uid());

-- Users see their own attempts
drop policy if exists "tournament attempts own read" on tournament_attempts;
create policy "tournament attempts own read" on tournament_attempts
for select to authenticated
using (owner_id = auth.uid());

-- Anyone can read the leaderboard (entries with rank)
drop policy if exists "tournament entries leaderboard read" on tournament_entries;
create policy "tournament entries leaderboard read" on tournament_entries
for select to authenticated
using (current_rank is not null);

-- ── Secure RPC: join_tournament ───────────────────────────────

create or replace function join_tournament(
  target_tournament_id uuid,
  target_dog_id uuid,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  event tournament_events;
  entry tournament_entries;
  silver integer;
  gold integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;

  select * into event from tournament_events
  where id = target_tournament_id and status = 'registration_open';
  if event.id is null then raise exception 'Tournament registration is not open'; end if;

  if event.participant_count >= event.max_participants then
    raise exception 'Tournament is full';
  end if;

  -- Check not already joined
  if exists (select 1 from tournament_entries
    where tournament_id = target_tournament_id and dog_id = target_dog_id)
  then
    raise exception 'Already joined this tournament';
  end if;

  -- Deduct entry fee
  if event.entry_currency = 'silver_coin' then
    silver := wallet_total(target_dog_id, 'silver_coin');
    if silver < event.entry_cost then raise exception 'Insufficient Silver Coins'; end if;
  elsif event.entry_currency = 'gold_coin' then
    gold := wallet_total(target_dog_id, 'gold_coin');
    if gold < event.entry_cost then raise exception 'Insufficient Gold Coins'; end if;
  end if;

  insert into tournament_entries(tournament_id, dog_id, owner_id, idempotency_key)
  values (event.id, target_dog_id, auth.uid(), request_key)
  returning * into entry;

  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, event.entry_currency, -event.entry_cost, 'challenge_game_entry', 'tournament_entry', entry.id, request_key || ':entry')
  on conflict do nothing;

  update tournament_events
    set participant_count = participant_count + 1
    where id = event.id;

  return jsonb_build_object(
    'entry', to_jsonb(entry),
    'wallet', jsonb_build_object(
      'silverBalance', wallet_total(target_dog_id, 'silver_coin'),
      'goldBalance', wallet_total(target_dog_id, 'gold_coin')
    )
  );
end;
$$;

-- ── Admin / service-role-only functions (stubs) ───────────────

create or replace function admin_settle_tournament(
  target_tournament_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- TODO: Implement prize payout and rank finalization.
  -- This function must be service_role only.
  raise notice 'settle_tournament called for %', target_tournament_id;
end;
$$;

revoke all on function admin_settle_tournament(uuid) from anon, authenticated;