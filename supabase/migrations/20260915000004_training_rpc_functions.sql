create or replace function resolve_skill_session(p_dog_id uuid, p_skill_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  active_session training_sessions;
  review_row training_review_assignments;
  skill_progress dog_training_skill_progress;
  target_level training_levels;
  checkpoint_eligible boolean := false;
begin
  if not owns_dog(p_dog_id) then raise exception 'Dog not found'; end if;

  select * into active_session from training_sessions
    where dog_id = p_dog_id and skill_id = p_skill_id and status = 'active'
    order by started_at desc limit 1;
  if active_session.id is not null then
    return jsonb_build_object(
      'resolution', 'resume',
      'sessionId', active_session.id,
      'levelId', active_session.level_id,
      'sessionType', active_session.session_type
    );
  end if;

  select * into review_row from training_review_assignments
    where dog_id = p_dog_id and skill_id = p_skill_id and status in ('pending', 'active')
      and (eligible_at is null or eligible_at <= timezone('utc', now()))
    order by created_at asc limit 1;
  if review_row.id is not null then
    select * into target_level from training_levels where id = review_row.level_id;
    return jsonb_build_object(
      'resolution', 'review',
      'reviewAssignmentId', review_row.id,
      'levelId', review_row.level_id,
      'sessionType', case when review_row.review_type = 'bridge' then 'bridge' else 'review' end,
      'reviewType', review_row.review_type,
      'levelNumber', target_level.level_number
    );
  end if;

  select * into skill_progress from dog_training_skill_progress where dog_id = p_dog_id and skill_id = p_skill_id;

  if skill_progress.id is not null and skill_progress.level5_completed_at is not null
     and current_date > (skill_progress.level5_completed_at at time zone 'utc')::date
     and (skill_progress.checkpoint_retry_not_before is null or current_date >= skill_progress.checkpoint_retry_not_before)
     and skill_progress.checkpoint_status <> 'passed'
  then
    checkpoint_eligible := true;
  end if;

  if checkpoint_eligible then
    select * into target_level from training_levels where skill_id = p_skill_id and stage_type = 'checkpoint';
    return jsonb_build_object(
      'resolution', 'checkpoint',
      'levelId', target_level.id,
      'sessionType', 'checkpoint',
      'levelNumber', null
    );
  end if;

  select * into target_level from training_levels
    where skill_id = p_skill_id and stage_type = 'level'
      and level_number = coalesce(skill_progress.current_level_number, 1);

  return jsonb_build_object(
    'resolution', 'level',
    'levelId', target_level.id,
    'sessionType', 'normal',
    'levelNumber', target_level.level_number
  );
end;
$$;

create or replace function get_training_energy(p_dog_id uuid, p_local_date date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'base', 3,
    'consumed', least(3, coalesce((
      select sum(-delta) from training_energy_ledger
      where dog_id = p_dog_id and effective_local_day = p_local_date and delta < 0
    ), 0)),
    'remaining', greatest(0, 3 - coalesce((
      select sum(-delta) from training_energy_ledger
      where dog_id = p_dog_id and effective_local_day = p_local_date and delta < 0
    ), 0))
  )
  where owns_dog(p_dog_id);
$$;

create or replace function start_training_session(p_dog_id uuid, p_skill_id uuid, p_local_date date, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing training_sessions;
  active_session training_sessions;
  resolution jsonb;
  consumed integer;
  new_session training_sessions;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not owns_dog(p_dog_id) then raise exception 'Dog not found'; end if;

  select * into existing from training_sessions where idempotency_key = p_idempotency_key;
  if existing.id is not null then
    return jsonb_build_object(
      'session', to_jsonb(existing),
      'remainingEnergy', (get_training_energy(p_dog_id, existing.effective_local_day)->>'remaining')::integer,
      'chargedEnergy', false
    );
  end if;

  select * into active_session from training_sessions
    where dog_id = p_dog_id and skill_id = p_skill_id and status = 'active'
    order by started_at desc limit 1;
  if active_session.id is not null then
    return jsonb_build_object(
      'session', to_jsonb(active_session),
      'remainingEnergy', (get_training_energy(p_dog_id, p_local_date)->>'remaining')::integer,
      'chargedEnergy', false
    );
  end if;

  resolution := resolve_skill_session(p_dog_id, p_skill_id);
  if (resolution->>'levelId') is null then
    raise exception 'No training level resolved for this skill';
  end if;

  consumed := coalesce((select sum(-delta) from training_energy_ledger
    where dog_id = p_dog_id and effective_local_day = p_local_date and delta < 0), 0);
  if consumed >= 3 then
    raise exception 'insufficient_training_energy';
  end if;

  begin
    insert into training_sessions (dog_id, skill_id, level_id, session_type, status, energy_consumed, effective_local_day, idempotency_key)
    values (
      p_dog_id, p_skill_id, (resolution->>'levelId')::uuid,
      coalesce(resolution->>'sessionType', 'normal'),
      'active', true, p_local_date, p_idempotency_key
    )
    returning * into new_session;
  exception when unique_violation then
    select * into new_session from training_sessions where idempotency_key = p_idempotency_key;
    return jsonb_build_object(
      'session', to_jsonb(new_session),
      'remainingEnergy', (get_training_energy(p_dog_id, new_session.effective_local_day)->>'remaining')::integer,
      'chargedEnergy', false
    );
  end;

  insert into training_energy_ledger (dog_id, effective_local_day, delta, reason, session_id)
  values (p_dog_id, p_local_date, -1, 'session_start', new_session.id);

  insert into dog_training_skill_progress (dog_id, skill_id, status, current_level_number)
  values (p_dog_id, p_skill_id, 'in_progress', 1)
  on conflict (dog_id, skill_id) do update set
    status = case when dog_training_skill_progress.status = 'not_started' then 'in_progress' else dog_training_skill_progress.status end;

  insert into dog_training_level_progress (dog_id, level_id, status)
  values (p_dog_id, new_session.level_id, 'in_progress')
  on conflict (dog_id, level_id) do update set
    status = case when dog_training_level_progress.status = 'not_started' then 'in_progress' else dog_training_level_progress.status end;

  if resolution ? 'reviewAssignmentId' then
    update training_review_assignments set status = 'active'
      where id = (resolution->>'reviewAssignmentId')::uuid and status = 'pending';
  end if;

  return jsonb_build_object(
    'session', to_jsonb(new_session),
    'remainingEnergy', 3 - (consumed + 1),
    'chargedEnergy', true
  );
end;
$$;

create or replace function set_session_card_position(p_session_id uuid, p_card_key text)
returns void
language sql
security definer
set search_path = public
as $$
  update training_sessions set current_card_key = p_card_key
  where id = p_session_id and owns_dog(dog_id) and status = 'active';
$$;

create or replace function report_training_result(p_session_id uuid, p_result text, p_card_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row training_sessions;
  level_row training_levels;
  attempt_number integer;
  is_additional boolean;
  settle boolean;
  pending_review training_review_assignments;
begin
  if p_result not in ('success', 'not_yet') then raise exception 'invalid_result'; end if;

  select * into session_row from training_sessions where id = p_session_id;
  if session_row.id is null or not owns_dog(session_row.dog_id) then raise exception 'Session not found'; end if;
  if session_row.status <> 'active' then raise exception 'session_not_active'; end if;

  select * into level_row from training_levels where id = session_row.level_id;

  select count(*) into attempt_number from training_attempt_reports where session_id = p_session_id;
  attempt_number := attempt_number + 1;
  is_additional := attempt_number > 1;

  insert into training_attempt_reports (session_id, level_id, card_id, attempt_number, is_additional_practice, result, original_criterion_met)
  values (p_session_id, session_row.level_id, p_card_id, attempt_number, is_additional, p_result, p_result = 'success');

  settle := not (attempt_number = 1 and p_result = 'not_yet' and level_row.additional_practice_allowed);

  if not settle then
    update training_sessions set current_card_key = 'additional_practice' where id = p_session_id;
    return jsonb_build_object('settled', false, 'allowAdditionalPractice', true, 'session', to_jsonb(session_row));
  end if;

  update training_sessions set
    status = 'completed',
    completed_at = timezone('utc', now()),
    final_result = p_result,
    retry_used = is_additional
  where id = p_session_id
  returning * into session_row;

  insert into dog_training_level_progress (dog_id, level_id, status, latest_result, successful_at, attempt_count, last_practiced_at, review_soon)
  values (
    session_row.dog_id, session_row.level_id,
    case when p_result = 'success' then 'completed' else 'in_progress' end,
    p_result,
    case when p_result = 'success' then timezone('utc', now()) else null end,
    1, timezone('utc', now()), p_result = 'not_yet'
  )
  on conflict (dog_id, level_id) do update set
    status = case when p_result = 'success' then 'completed' else dog_training_level_progress.status end,
    latest_result = p_result,
    successful_at = case when p_result = 'success' then timezone('utc', now()) else dog_training_level_progress.successful_at end,
    attempt_count = dog_training_level_progress.attempt_count + 1,
    last_practiced_at = timezone('utc', now()),
    review_soon = (p_result = 'not_yet');

  if p_result = 'success' then
    if level_row.stage_type = 'level' and level_row.level_number < 5 then
      update dog_training_skill_progress set
        current_level_number = level_row.level_number + 1,
        latest_result = 'success', review_soon = false, last_practiced_at = timezone('utc', now())
      where dog_id = session_row.dog_id and skill_id = session_row.skill_id;
    elsif level_row.stage_type = 'level' and level_row.level_number = 5 then
      update dog_training_skill_progress set
        level5_completed_at = timezone('utc', now()),
        latest_result = 'success', review_soon = false, last_practiced_at = timezone('utc', now())
      where dog_id = session_row.dog_id and skill_id = session_row.skill_id;
    elsif level_row.stage_type = 'checkpoint' then
      update dog_training_skill_progress set
        checkpoint_status = 'passed', status = 'completed', completed_at = timezone('utc', now()),
        latest_result = 'success', review_soon = false, last_practiced_at = timezone('utc', now())
      where dog_id = session_row.dog_id and skill_id = session_row.skill_id;
      insert into training_review_assignments (dog_id, skill_id, level_id, review_type, source_session_id, status, due_at, reason)
      values (session_row.dog_id, session_row.skill_id, session_row.level_id, 'maintenance_review', session_row.id, 'pending', timezone('utc', now()) + interval '30 days', 'Checkpoint passed; maintenance review scheduled.');
    end if;
  else
    update dog_training_skill_progress set
      latest_result = 'not_yet', review_soon = true, last_practiced_at = timezone('utc', now())
    where dog_id = session_row.dog_id and skill_id = session_row.skill_id;

    if level_row.stage_type = 'checkpoint' then
      update dog_training_skill_progress set
        checkpoint_status = 'needs_review',
        checkpoint_retry_not_before = (current_date + interval '3 days')::date
      where dog_id = session_row.dog_id and skill_id = session_row.skill_id;
      insert into training_review_assignments (dog_id, skill_id, level_id, review_type, source_session_id, status, reason)
      values (session_row.dog_id, session_row.skill_id, session_row.level_id, 'targeted_level_review', session_row.id, 'pending', 'Checkpoint not yet; targeted review scheduled. No immediate Checkpoint retest.');
    else
      insert into training_review_assignments (dog_id, skill_id, level_id, review_type, source_session_id, status, reason)
      values (session_row.dog_id, session_row.skill_id, session_row.level_id, case when session_row.session_type = 'bridge' then 'bridge' else 'easier_review' end, session_row.id, 'pending', 'Not yet; easier review scheduled.');
    end if;
  end if;

  select * into pending_review from training_review_assignments
    where dog_id = session_row.dog_id and skill_id = session_row.skill_id and level_id = session_row.level_id
      and status in ('pending', 'active')
    order by created_at asc limit 1;
  if pending_review.id is not null and session_row.session_type in ('review', 'bridge', 'checkpoint') then
    update training_review_assignments set status = 'completed', completed_at = timezone('utc', now()) where id = pending_review.id;
  end if;

  return jsonb_build_object('settled', true, 'result', p_result, 'session', to_jsonb(session_row));
end;
$$;

create or replace function end_training_session(p_session_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  session_row training_sessions;
begin
  select * into session_row from training_sessions where id = p_session_id;
  if session_row.id is null or not owns_dog(session_row.dog_id) then raise exception 'Session not found'; end if;

  if session_row.status = 'active' then
    update training_sessions set
      status = 'ended', ended_at = timezone('utc', now()), safety_disposition = p_reason
    where id = p_session_id
    returning * into session_row;
  end if;

  return jsonb_build_object('session', to_jsonb(session_row));
end;
$$;

create unique index if not exists training_levels_one_checkpoint_per_skill on training_levels(skill_id) where stage_type = 'checkpoint';
