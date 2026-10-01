-- One charge at course entry. A successful Level can continue to the next
-- server-resolved Level without consuming another Energy.
create schema if not exists training_private;
revoke all on schema training_private from public, anon;
grant usage on schema training_private to authenticated;

create or replace function training_private.continue_training_session(
  p_completed_session_id uuid,
  p_local_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  previous public.training_sessions;
  next_session public.training_sessions;
  resolution jsonb;
  continuation_key text := 'course-next-' || p_completed_session_id::text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_local_date is null then raise exception 'Local date required'; end if;
  select * into previous from public.training_sessions where id = p_completed_session_id;
  if previous.id is null or not public.owns_dog(previous.dog_id) then
    raise exception 'Session not found';
  end if;
  -- Serialize continuation requests for this dog, including retries with a
  -- different request payload. The successor key is generated only here.
  perform 1 from public.dogs where id = previous.dog_id for update;
  select * into previous from public.training_sessions where id = p_completed_session_id for update;
  if previous.status <> 'completed' or previous.final_result is distinct from 'success' then
    raise exception 'Complete the current Level before continuing';
  end if;

  select * into next_session from public.training_sessions where idempotency_key = continuation_key;
  if next_session.id is not null then
    if next_session.dog_id <> previous.dog_id or next_session.skill_id <> previous.skill_id then
      raise exception 'Continuation conflict';
    end if;
    return jsonb_build_object('session', to_jsonb(next_session),
      'remainingEnergy', (public.get_training_energy(previous.dog_id, p_local_date)->>'remaining')::integer,
      'chargedEnergy', false);
  end if;

  resolution := public.resolve_skill_session(previous.dog_id, previous.skill_id);
  if (resolution->>'levelId') is null then raise exception 'No next Level'; end if;
  if resolution->>'resolution' = 'resume' then
    select * into next_session from public.training_sessions where id = (resolution->>'sessionId')::uuid
      and dog_id = previous.dog_id and skill_id = previous.skill_id and status = 'active';
    if next_session.id is null then raise exception 'Active session not found'; end if;
  else
    -- Targets come from the server resolver; callers cannot choose an unlocked
    -- Level or another skill. A completed checkpoint is a separate future visit.
    if exists (select 1 from public.training_levels where id = previous.level_id and stage_type = 'checkpoint')
      or (resolution->>'levelId')::uuid = previous.level_id then
      raise exception 'This course has no next Level';
    end if;
    insert into public.training_sessions (
      dog_id, skill_id, level_id, session_type, status, energy_consumed,
      effective_local_day, idempotency_key
    ) values (
      previous.dog_id, previous.skill_id, (resolution->>'levelId')::uuid,
      coalesce(resolution->>'sessionType', 'normal'), 'active', false,
      p_local_date, continuation_key
    ) returning * into next_session;

    insert into public.dog_training_level_progress (dog_id, level_id, status)
    values (previous.dog_id, next_session.level_id, 'in_progress')
    on conflict (dog_id, level_id) do update set status =
      case when dog_training_level_progress.status = 'not_started' then 'in_progress'
        else dog_training_level_progress.status end;

    if resolution ? 'reviewAssignmentId' then
      update public.training_review_assignments set status = 'active'
      where id = (resolution->>'reviewAssignmentId')::uuid and status = 'pending';
    end if;
  end if;

  return jsonb_build_object('session', to_jsonb(next_session),
    'remainingEnergy', (public.get_training_energy(previous.dog_id, p_local_date)->>'remaining')::integer,
    'chargedEnergy', false);
end;
$function$;

revoke all on function training_private.continue_training_session(uuid, date) from public, anon;
grant execute on function training_private.continue_training_session(uuid, date) to authenticated;

create or replace function public.continue_training_session(p_completed_session_id uuid, p_local_date date)
returns jsonb language sql security invoker set search_path = ''
as $function$
  select training_private.continue_training_session(p_completed_session_id, p_local_date);
$function$;
revoke all on function public.continue_training_session(uuid, date) from public, anon;
grant execute on function public.continue_training_session(uuid, date) to authenticated;
