-- ============================================================
-- Migration 0047 - Tournament attempts, ranking, and review
-- ============================================================
-- Mobile may create an attempt only through submit_tournament_attempt.
-- AI verification may be recorded only by service_role.
-- Review and final rank functions are service_role/admin-server only.
-- This migration does not award prizes or settle tournaments.
-- ============================================================

alter table public.tournament_events
  add column if not exists ranks_finalized_at timestamptz;

alter table public.tournament_attempts
  add column if not exists status text not null default 'submitted',
  add column if not exists confidence numeric(5,4),
  add column if not exists provisional_score numeric(8,2),
  add column if not exists final_score numeric(8,2),
  add column if not exists verification_result jsonb,
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid,
  add column if not exists idempotency_key text,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.tournament_attempts
  drop constraint if exists tournament_attempts_status_check;
alter table public.tournament_attempts
  add constraint tournament_attempts_status_check
  check (status in ('submitted', 'pending_review', 'approved', 'rejected', 'error'));

alter table public.tournament_attempts
  drop constraint if exists tournament_attempts_confidence_check;
alter table public.tournament_attempts
  add constraint tournament_attempts_confidence_check
  check (confidence is null or confidence between 0 and 1);

alter table public.tournament_attempts
  drop constraint if exists tournament_attempts_provisional_score_check;
alter table public.tournament_attempts
  add constraint tournament_attempts_provisional_score_check
  check (provisional_score is null or provisional_score between 0 and 100);

alter table public.tournament_attempts
  drop constraint if exists tournament_attempts_final_score_check;
alter table public.tournament_attempts
  add constraint tournament_attempts_final_score_check
  check (final_score is null or final_score between 0 and 100);

create unique index if not exists tournament_attempts_idempotency_idx
  on public.tournament_attempts(idempotency_key)
  where idempotency_key is not null;

create unique index if not exists tournament_attempts_submission_idx
  on public.tournament_attempts(submission_id)
  where submission_id is not null;

create index if not exists tournament_attempts_review_queue_idx
  on public.tournament_attempts(tournament_id, status, created_at);

drop trigger if exists tournament_attempts_set_updated_at
  on public.tournament_attempts;
create trigger tournament_attempts_set_updated_at
before update on public.tournament_attempts
for each row execute function public.set_updated_at();

-- Recompute either provisional ranks or administrator-approved final ranks.
-- Confidence is used only as a temporary technical score for verified PASS
-- attempts. The admin may replace it with final_score during review.
create or replace function public.refresh_tournament_ranks(
  target_tournament_id uuid,
  use_final_scores boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tournament_entries
  set best_score = null,
      current_rank = null
  where tournament_id = target_tournament_id;

  with eligible_attempts as (
    select
      attempt.entry_id,
      case
        when use_final_scores then attempt.final_score
        else attempt.provisional_score
      end as score,
      attempt.created_at
    from public.tournament_attempts as attempt
    where attempt.tournament_id = target_tournament_id
      and (
        (use_final_scores and attempt.status = 'approved' and attempt.final_score is not null)
        or
        (not use_final_scores
          and attempt.verdict = 'PASS'
          and attempt.status in ('pending_review', 'approved')
          and attempt.provisional_score is not null)
      )
  ),
  best as (
    select distinct on (entry_id)
      entry_id,
      score,
      created_at
    from eligible_attempts
    order by entry_id, score desc, created_at asc
  ),
  ranked as (
    select
      entry_id,
      score,
      row_number() over (
        order by score desc, created_at asc, entry_id asc
      )::integer as rank
    from best
  )
  update public.tournament_entries as entry
  set best_score = ranked.score,
      current_rank = ranked.rank
  from ranked
  where entry.id = ranked.entry_id;
end;
$$;

-- Mobile boundary: associate one uploaded, owned submission with an active
-- tournament entry. Attempts_used is incremented atomically under an entry
-- row lock. There is no additional wallet charge here.
create or replace function public.submit_tournament_attempt(
  target_tournament_id uuid,
  target_dog_id uuid,
  target_submission_id uuid,
  storage_path_value text,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_user_id uuid := auth.uid();
  event_row public.tournament_events%rowtype;
  entry_row public.tournament_entries%rowtype;
  submission_row public.dog_training_video_submissions%rowtype;
  attempt_row public.tournament_attempts%rowtype;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if request_key is null or btrim(request_key) = '' then
    raise exception 'Request key is required' using errcode = '22023';
  end if;

  select attempt.*
  into attempt_row
  from public.tournament_attempts as attempt
  where attempt.idempotency_key = request_key
    and attempt.tournament_id = target_tournament_id
    and attempt.dog_id = target_dog_id
    and attempt.owner_id = request_user_id;

  if found then
    return jsonb_build_object('attempt', to_jsonb(attempt_row));
  end if;

  select event.*
  into event_row
  from public.tournament_events as event
  where event.id = target_tournament_id;

  if not found
    or event_row.status <> 'active'
    or now() < event_row.starts_at
    or now() >= event_row.ends_at
  then
    raise exception 'Tournament is not accepting attempts' using errcode = 'P0001';
  end if;

  select entry.*
  into entry_row
  from public.tournament_entries as entry
  where entry.tournament_id = target_tournament_id
    and entry.dog_id = target_dog_id
    and entry.owner_id = request_user_id
    and entry.status in ('joined', 'active')
  for update;

  if not found then
    raise exception 'Tournament entry not found' using errcode = '42501';
  end if;

  if entry_row.attempts_used >= event_row.max_attempts_per_entry then
    raise exception 'No tournament attempts remaining' using errcode = 'P0001';
  end if;

  select submission.*
  into submission_row
  from public.dog_training_video_submissions as submission
  where submission.id = target_submission_id
    and submission.dog_id = target_dog_id
    and submission.user_id = request_user_id
    and submission.activity_id = event_row.challenge_game_id
    and submission.storage_path = storage_path_value
    and submission.status in ('pending', 'processing');

  if not found then
    raise exception 'Tournament video submission not found' using errcode = '42501';
  end if;

  insert into public.tournament_attempts (
    entry_id,
    tournament_id,
    dog_id,
    owner_id,
    submission_id,
    status,
    idempotency_key
  )
  values (
    entry_row.id,
    event_row.id,
    target_dog_id,
    request_user_id,
    submission_row.id,
    'submitted',
    request_key
  )
  returning * into attempt_row;

  update public.tournament_entries
  set attempts_used = attempts_used + 1,
      status = 'active'
  where id = entry_row.id;

  return jsonb_build_object('attempt', to_jsonb(attempt_row));
end;
$$;

-- Trusted verification boundary. Every result enters pending_review; no AI
-- result is allowed to become a final score by itself.
create or replace function public.record_tournament_verification(
  target_attempt_id uuid,
  target_submission_id uuid,
  verification_result_value jsonb,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.tournament_attempts%rowtype;
  result_verdict text;
  result_confidence numeric;
  technical_score numeric(8,2);
begin
  select attempt.*
  into attempt_row
  from public.tournament_attempts as attempt
  where attempt.id = target_attempt_id
    and attempt.submission_id = target_submission_id
  for update;

  if not found then
    raise exception 'Tournament attempt not found' using errcode = 'P0002';
  end if;

  if attempt_row.status in ('pending_review', 'approved', 'rejected')
    and attempt_row.verification_result is not null
  then
    return jsonb_build_object('attempt', to_jsonb(attempt_row));
  end if;

  result_verdict := verification_result_value->>'verdict';
  result_confidence := nullif(verification_result_value->>'confidence', '')::numeric;

  if result_verdict not in ('PASS', 'FAIL', 'NEEDS_REVIEW') then
    raise exception 'Invalid tournament verification verdict' using errcode = '22023';
  end if;
  if result_confidence is null or result_confidence < 0 or result_confidence > 1 then
    raise exception 'Invalid tournament verification confidence' using errcode = '22023';
  end if;

  technical_score := case
    when result_verdict = 'PASS' then round(result_confidence * 100, 2)
    else null
  end;

  update public.tournament_attempts
  set status = 'pending_review',
      verdict = result_verdict,
      confidence = result_confidence,
      provisional_score = technical_score,
      score = technical_score,
      verification_result = verification_result_value,
      reviewed_at = null
  where id = attempt_row.id
  returning * into attempt_row;

  perform public.refresh_tournament_ranks(attempt_row.tournament_id, false);

  return jsonb_build_object('attempt', to_jsonb(attempt_row));
end;
$$;

-- Admin/server review decision. Approval requires an explicit 0..100 score;
-- rejection removes the attempt from final ranking eligibility.
create or replace function public.admin_review_tournament_attempt(
  target_attempt_id uuid,
  decision_value text,
  final_score_value numeric,
  notes_value text default null,
  reviewer_id_value uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.tournament_attempts%rowtype;
  before_state jsonb;
begin
  select attempt.*
  into attempt_row
  from public.tournament_attempts as attempt
  where attempt.id = target_attempt_id
  for update;

  if not found then
    raise exception 'Tournament attempt not found' using errcode = 'P0002';
  end if;
  if attempt_row.status <> 'pending_review' then
    raise exception 'Tournament attempt is not pending review' using errcode = 'P0001';
  end if;
  if decision_value not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject' using errcode = '22023';
  end if;
  if decision_value = 'approve'
    and (final_score_value is null or final_score_value < 0 or final_score_value > 100)
  then
    raise exception 'Approved score must be between 0 and 100' using errcode = '22023';
  end if;

  before_state := to_jsonb(attempt_row);

  update public.tournament_attempts
  set status = case when decision_value = 'approve' then 'approved' else 'rejected' end,
      final_score = case when decision_value = 'approve' then round(final_score_value, 2) else null end,
      score = case when decision_value = 'approve' then round(final_score_value, 2) else score end,
      review_notes = nullif(btrim(coalesce(notes_value, '')), ''),
      reviewed_by = reviewer_id_value,
      reviewed_at = timezone('utc', now())
  where id = target_attempt_id
  returning * into attempt_row;

  insert into public.audit_logs (
    actor_user_id,
    dog_id,
    action_type,
    source_entity_type,
    source_entity_id,
    metadata
  ) values (
    reviewer_id_value,
    attempt_row.dog_id,
    'tournament_attempt_reviewed',
    'tournament_attempt',
    attempt_row.id,
    jsonb_build_object(
      'decision', decision_value,
      'before', before_state,
      'after', to_jsonb(attempt_row)
    )
  );

  perform public.refresh_tournament_ranks(attempt_row.tournament_id, false);
  return jsonb_build_object('attempt', to_jsonb(attempt_row));
end;
$$;

-- Final ranking can only be produced in reviewing status and only after every
-- attempt has received an admin decision. Prize payout remains separate.
create or replace function public.admin_finalize_tournament_ranks(
  target_tournament_id uuid,
  reviewer_id_value uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.tournament_events%rowtype;
  pending_count integer;
begin
  select event.*
  into event_row
  from public.tournament_events as event
  where event.id = target_tournament_id
  for update;

  if not found then
    raise exception 'Tournament not found' using errcode = 'P0002';
  end if;
  if event_row.status <> 'reviewing' then
    raise exception 'Tournament must be reviewing before final ranks' using errcode = 'P0001';
  end if;

  select count(*)::integer
  into pending_count
  from public.tournament_attempts
  where tournament_id = target_tournament_id
    and status in ('submitted', 'pending_review');

  if pending_count > 0 then
    raise exception 'Tournament still has % unreviewed attempts', pending_count using errcode = 'P0001';
  end if;

  perform public.refresh_tournament_ranks(target_tournament_id, true);

  update public.tournament_events
  set ranks_finalized_at = timezone('utc', now())
  where id = target_tournament_id;

  insert into public.audit_logs (
    actor_user_id,
    action_type,
    source_entity_type,
    source_entity_id,
    metadata
  ) values (
    reviewer_id_value,
    'tournament_ranks_finalized',
    'tournament_event',
    target_tournament_id,
    jsonb_build_object('pending_attempts', pending_count)
  );

  return jsonb_build_object(
    'tournamentId', target_tournament_id,
    'ranksFinalizedAt', timezone('utc', now())
  );
end;
$$;

create or replace function public.admin_list_tournament_review_queue(
  target_tournament_id uuid
)
returns table (
  attempt_id uuid,
  entry_id uuid,
  dog_id uuid,
  dog_name text,
  submission_id uuid,
  verdict text,
  confidence numeric,
  provisional_score numeric,
  status text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    attempt.id,
    attempt.entry_id,
    attempt.dog_id,
    dog.name,
    attempt.submission_id,
    attempt.verdict,
    attempt.confidence,
    attempt.provisional_score,
    attempt.status,
    attempt.created_at
  from public.tournament_attempts as attempt
  join public.dogs as dog on dog.id = attempt.dog_id
  where attempt.tournament_id = target_tournament_id
    and attempt.status = 'pending_review'
  order by attempt.created_at asc, attempt.id asc;
$$;

-- Keep table writes blocked. Owners may read their own attempts through RLS.
revoke all on table public.tournament_attempts from anon, authenticated;
grant select on table public.tournament_attempts to authenticated;

revoke all on function public.submit_tournament_attempt(uuid, uuid, uuid, text, text)
  from public, anon;
grant execute on function public.submit_tournament_attempt(uuid, uuid, uuid, text, text)
  to authenticated;

revoke all on function public.refresh_tournament_ranks(uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.record_tournament_verification(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.admin_review_tournament_attempt(uuid, text, numeric, text, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_finalize_tournament_ranks(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_list_tournament_review_queue(uuid)
  from public, anon, authenticated;

grant execute on function public.refresh_tournament_ranks(uuid, boolean) to service_role;
grant execute on function public.record_tournament_verification(uuid, uuid, jsonb, text) to service_role;
grant execute on function public.admin_review_tournament_attempt(uuid, text, numeric, text, uuid) to service_role;
grant execute on function public.admin_finalize_tournament_ranks(uuid, uuid) to service_role;
grant execute on function public.admin_list_tournament_review_queue(uuid) to service_role;

comment on function public.submit_tournament_attempt(uuid, uuid, uuid, text, text) is
  'Authenticated atomic tournament attempt creation after a successful owned video upload.';
comment on function public.record_tournament_verification(uuid, uuid, jsonb, text) is
  'Service-role-only AI verification ingestion. Always routes tournament attempts to admin review.';
comment on function public.admin_finalize_tournament_ranks(uuid, uuid) is
  'Service-role-only final rank calculation. Does not settle the tournament or pay prizes.';

notify pgrst, 'reload schema';
