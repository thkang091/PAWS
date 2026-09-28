create or replace function public.report_training_result(
  p_session_id uuid,
  p_result text,
  p_card_id uuid default null::uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  session_row training_sessions;
  level_row training_levels;
  attempt_number integer;
  is_additional boolean;
  settle boolean;
  serving_review training_review_assignments;
begin
  if p_result not in ('success', 'not_yet') then raise exception 'invalid_result'; end if;

  select * into session_row from training_sessions where id = p_session_id;
  if session_row.id is null or not owns_dog(session_row.dog_id) then raise exception 'Session not found'; end if;
  if session_row.status <> 'active' then raise exception 'session_not_active'; end if;

  select * into level_row from training_levels where id = session_row.level_id;

  select * into serving_review from training_review_assignments
    where dog_id = session_row.dog_id and skill_id = session_row.skill_id
      and level_id = session_row.level_id and status in ('pending', 'active')
    order by created_at asc limit 1;

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

  if serving_review.id is not null and session_row.session_type in ('review', 'bridge', 'checkpoint') then
    update training_review_assignments set status = 'completed', completed_at = timezone('utc', now())
    where id = serving_review.id;
  end if;

  return jsonb_build_object('settled', true, 'result', p_result, 'session', to_jsonb(session_row));
end;
$function$;
