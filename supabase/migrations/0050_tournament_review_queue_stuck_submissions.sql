-- ============================================================
-- Migration 0050 - Surface stuck tournament submissions
-- ============================================================
-- Final rank blocks on both submitted and pending_review attempts. The admin
-- queue must expose the same set. Unverified submitted attempts may only be
-- rejected; they can never be approved without a trusted verification result.
-- ============================================================

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
  if attempt_row.status not in ('submitted', 'pending_review') then
    raise exception 'Tournament attempt is not awaiting review' using errcode = 'P0001';
  end if;
  if decision_value not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject' using errcode = '22023';
  end if;
  if attempt_row.status = 'submitted' and decision_value <> 'reject' then
    raise exception 'An unverified submitted attempt can only be rejected' using errcode = 'P0001';
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
    and attempt.status in ('submitted', 'pending_review')
  order by attempt.created_at asc, attempt.id asc;
$$;

revoke all on function public.admin_review_tournament_attempt(uuid, text, numeric, text, uuid)
  from public, anon, authenticated;
revoke all on function public.admin_list_tournament_review_queue(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_review_tournament_attempt(uuid, text, numeric, text, uuid)
  to service_role;
grant execute on function public.admin_list_tournament_review_queue(uuid)
  to service_role;

comment on function public.admin_list_tournament_review_queue(uuid) is
  'Service-role queue aligned with final-rank blockers: submitted and pending_review attempts.';

notify pgrst, 'reload schema';
