alter table dog_training_preferences
  add column if not exists daily_energy_base integer not null default 3
    check (daily_energy_base between 0 and 99);

create or replace function public.training_energy_base(p_dog_id uuid)
returns integer
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (select daily_energy_base from dog_training_preferences where dog_id = p_dog_id),
    3
  );
$$;

revoke execute on function public.training_energy_base(uuid) from anon, authenticated;

create or replace function public.get_training_energy(p_dog_id uuid, p_local_date date)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $function$
  select jsonb_build_object(
    'base', training_energy_base(p_dog_id),
    'consumed', least(training_energy_base(p_dog_id), coalesce((
      select sum(-delta) from training_energy_ledger
      where dog_id = p_dog_id and effective_local_day = p_local_date and delta < 0
    ), 0)),
    'remaining', greatest(0, training_energy_base(p_dog_id) - coalesce((
      select sum(-delta) from training_energy_ledger
      where dog_id = p_dog_id and effective_local_day = p_local_date and delta < 0
    ), 0))
  )
  where owns_dog(p_dog_id);
$function$;

create or replace function public.start_training_session(
  p_dog_id uuid,
  p_skill_id uuid,
  p_local_date date,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  existing training_sessions;
  active_session training_sessions;
  resolution jsonb;
  consumed integer;
  allowance integer;
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

  allowance := training_energy_base(p_dog_id);
  consumed := coalesce((select sum(-delta) from training_energy_ledger
    where dog_id = p_dog_id and effective_local_day = p_local_date and delta < 0), 0);
  if consumed >= allowance then
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
    'remainingEnergy', allowance - (consumed + 1),
    'chargedEnergy', true
  );
end;
$function$;
