-- ============================================================
-- Migration 0045 - Tournament read API and scoped permissions
-- ============================================================
-- Phase 2A keeps every tournament mutation disabled for the
-- authenticated mobile role while exposing only the reads needed
-- by the Tournament UI.
--
-- This migration intentionally does not change permissions or RLS
-- policies for dogs, profiles, training tables, or wallet tables.
-- ============================================================

-- Explicitly remove table access that the mobile app does not need.
-- RLS remains enabled and is still the row-level authorization layer.
revoke all on table public.tournament_events from anon, authenticated;
revoke all on table public.tournament_entries from anon, authenticated;
revoke all on table public.tournament_attempts from anon, authenticated;

-- Phase 2A read surface:
--   - visible events are filtered by the existing event RLS policy
--   - entries are filtered to the owner by the existing own-entry policy
grant select on table public.tournament_events to authenticated;
grant select on table public.tournament_entries to authenticated;

-- Ranked entries previously exposed owner_id and dog_id directly through
-- the Data API. The leaderboard now goes through a field-limited RPC.
drop policy if exists "tournament entries leaderboard read"
  on public.tournament_entries;

-- Keep all tournament write functions unavailable to the mobile app during
-- Phase 2A. PostgreSQL functions are executable by PUBLIC by default, so the
-- PUBLIC grant must be revoked explicitly as well as anon/authenticated.
revoke all on function public.join_tournament(uuid, uuid, text)
  from public, anon, authenticated;

revoke all on function public.admin_settle_tournament(uuid)
  from public, anon, authenticated;

-- Public leaderboard projection.
--
-- The function bypasses dogs/tournament_attempts RLS only to return the
-- minimal display fields below. It does not expose owner IDs, dog tags,
-- wallet data, attempt verdict details, or unranked entries.
create or replace function public.list_tournament_leaderboard(
  target_tournament_id uuid
)
returns table (
  rank integer,
  entry_id uuid,
  dog_id uuid,
  dog_name text,
  score numeric,
  submitted_at timestamptz,
  is_current_user boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  request_user_id uuid := auth.uid();
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  return query
  select
    entry.current_rank as rank,
    entry.id as entry_id,
    entry.dog_id as dog_id,
    dog.name as dog_name,
    entry.best_score as score,
    coalesce(best_attempt.created_at, entry.joined_at) as submitted_at,
    entry.owner_id = request_user_id as is_current_user
  from public.tournament_entries as entry
  inner join public.tournament_events as event
    on event.id = entry.tournament_id
  inner join public.dogs as dog
    on dog.id = entry.dog_id
  left join lateral (
    select attempt.created_at
    from public.tournament_attempts as attempt
    where attempt.entry_id = entry.id
      and attempt.score = entry.best_score
      and attempt.verdict = 'PASS'
    order by
      attempt.reviewed_at desc nulls last,
      attempt.created_at asc
    limit 1
  ) as best_attempt on true
  where entry.tournament_id = target_tournament_id
    and event.status in ('active', 'reviewing', 'settled')
    and entry.current_rank is not null
    and entry.best_score is not null
  order by entry.current_rank asc, entry.id asc;
end;
$$;

revoke all on function public.list_tournament_leaderboard(uuid)
  from public, anon;
grant execute on function public.list_tournament_leaderboard(uuid)
  to authenticated;

comment on function public.list_tournament_leaderboard(uuid) is
  'Authenticated, read-only tournament leaderboard projection. Ranking and scoring remain backend/admin controlled.';

-- Ensure PostgREST discovers the newly created function immediately after
-- this migration is deployed.
notify pgrst, 'reload schema';
