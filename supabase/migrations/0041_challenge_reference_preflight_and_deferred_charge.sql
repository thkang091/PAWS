alter table challenge_games
  add column if not exists required_reference_assets reference_asset_type[] not null default array['DOG_PROFILE']::reference_asset_type[];

alter table challenge_game_attempts
  alter column charged_at drop not null,
  alter column charged_at drop default;

create or replace function derive_challenge_required_reference_assets(
  setup_values jsonb,
  prompt_value text
)
returns reference_asset_type[]
language plpgsql
immutable
set search_path = public
as $$
declare
  combined text := upper(coalesce(setup_values::text, '') || ' ' || coalesce(prompt_value, ''));
  refs reference_asset_type[] := array['DOG_PROFILE']::reference_asset_type[];
begin
  if combined like '%TARGET_MAT%' then refs := array_append(refs, 'TARGET_MAT'::reference_asset_type); end if;
  if combined like '%TARGET_TOY%' then refs := array_append(refs, 'TARGET_TOY'::reference_asset_type); end if;
  if combined like '%TARGET_BOWL%' then refs := array_append(refs, 'TARGET_BOWL'::reference_asset_type); end if;
  if combined like '%TARGET_BASKET%' then refs := array_append(refs, 'TARGET_BASKET'::reference_asset_type); end if;
  if combined like '%TARGET_CRATE%' then refs := array_append(refs, 'TARGET_CRATE'::reference_asset_type); end if;
  if combined like '%TARGET_DOORWAY%' then refs := array_append(refs, 'TARGET_DOORWAY'::reference_asset_type); end if;
  if combined like '%TARGET_PLATFORM%' then refs := array_append(refs, 'TARGET_PLATFORM'::reference_asset_type); end if;
  if combined like '%TARGET_CONE%' then refs := array_append(refs, 'TARGET_CONE'::reference_asset_type); end if;
  if combined like '%TARGET_BOX%' then refs := array_append(refs, 'TARGET_BOX'::reference_asset_type); end if;
  if combined like '%TARGET_BUTTON%' then refs := array_append(refs, 'TARGET_BUTTON'::reference_asset_type); end if;
  if combined like '%TARGET_BELL%' then refs := array_append(refs, 'TARGET_BELL'::reference_asset_type); end if;
  if combined like '%TARGET_DRAWER%' then refs := array_append(refs, 'TARGET_DRAWER'::reference_asset_type); end if;
  if combined like '%TARGET_PERSON%' then refs := array_append(refs, 'TARGET_PERSON'::reference_asset_type); end if;
  if combined like '%CUSTOM_OBJECT%' then refs := array_append(refs, 'CUSTOM_OBJECT'::reference_asset_type); end if;

  return array(select distinct unnest(refs));
end;
$$;

update challenge_games
set required_reference_assets = derive_challenge_required_reference_assets(recording_setup, verifier_prompt)
where required_reference_assets = array['DOG_PROFILE']::reference_asset_type[]
   or required_reference_assets is null;

create or replace function missing_challenge_reference_assets(
  target_dog_id uuid,
  target_challenge_game_id text
)
returns reference_asset_type[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  game challenge_games;
begin
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;

  select * into game
  from challenge_games
  where id = target_challenge_game_id
    and is_active;

  if game.id is null then raise exception 'Challenge Game unavailable'; end if;

  return array(
    select required_type
    from unnest(game.required_reference_assets) as required_type
    where not exists (
      select 1
      from dog_training_reference_assets asset
      where asset.dog_id = target_dog_id
        and asset.asset_type = required_type
    )
  );
end;
$$;

create or replace function prepare_challenge_game_attempt(
  target_dog_id uuid,
  target_challenge_game_id text,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  game challenge_games;
  attempt challenge_game_attempts;
  missing_refs reference_asset_type[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;

  select * into game
  from challenge_games
  where id = target_challenge_game_id
    and is_active;

  if game.id is null then raise exception 'Challenge Game unavailable'; end if;

  missing_refs := missing_challenge_reference_assets(target_dog_id, target_challenge_game_id);
  if coalesce(array_length(missing_refs, 1), 0) > 0 then
    raise exception 'Required reference photos missing: %', array_to_string(missing_refs::text[], ', ');
  end if;

  select * into attempt
  from challenge_game_attempts
  where idempotency_key = request_key
    and owner_id = auth.uid();

  if attempt.id is not null then
    return jsonb_build_object(
      'attempt', to_jsonb(attempt),
      'wallet', jsonb_build_object(
        'silverBalance', wallet_total(target_dog_id, 'silver_coin'),
        'goldBalance', wallet_total(target_dog_id, 'gold_coin')
      )
    );
  end if;

  insert into challenge_game_attempts(
    challenge_game_id,
    dog_id,
    owner_id,
    status,
    silver_coin_entry_cost,
    gold_coin_pass_reward,
    bonus_xp,
    charged_at,
    idempotency_key
  )
  values (
    game.id,
    target_dog_id,
    auth.uid(),
    'awaiting_submission',
    game.silver_coin_entry_cost,
    game.gold_coin_pass_reward,
    game.bonus_xp,
    null,
    request_key
  )
  returning * into attempt;

  return jsonb_build_object(
    'attempt', to_jsonb(attempt),
    'wallet', jsonb_build_object(
      'silverBalance', wallet_total(target_dog_id, 'silver_coin'),
      'goldBalance', wallet_total(target_dog_id, 'gold_coin')
    )
  );
end;
$$;

create or replace function submit_challenge_game_attempt(
  target_attempt_id uuid,
  target_submission_id uuid,
  storage_path_value text,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt challenge_game_attempts;
  submission dog_training_video_submissions;
  silver integer;
  missing_refs reference_asset_type[];
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into attempt
  from challenge_game_attempts
  where id = target_attempt_id
    and owner_id = auth.uid()
  for update;

  if attempt.id is null then raise exception 'Challenge attempt not found'; end if;
  if attempt.status not in ('awaiting_submission', 'needs_review', 'submitted') then
    raise exception 'Challenge attempt cannot accept a submission';
  end if;

  select * into submission
  from dog_training_video_submissions
  where id = target_submission_id
    and dog_id = attempt.dog_id
    and user_id = auth.uid()
    and storage_path = storage_path_value;

  if submission.id is null then
    raise exception 'Challenge video submission record not found';
  end if;

  missing_refs := missing_challenge_reference_assets(attempt.dog_id, attempt.challenge_game_id);
  if coalesce(array_length(missing_refs, 1), 0) > 0 then
    raise exception 'Required reference photos missing: %', array_to_string(missing_refs::text[], ', ');
  end if;

  if attempt.charged_at is null then
    silver := wallet_total(attempt.dog_id, 'silver_coin');
    if silver < attempt.silver_coin_entry_cost then raise exception 'Insufficient Silver Coins'; end if;

    insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (auth.uid(), attempt.dog_id, 'silver_coin', -attempt.silver_coin_entry_cost, 'challenge_game_entry', 'challenge_game_attempt', attempt.id, request_key || ':entry:silver_coin')
    on conflict do nothing;
  end if;

  update challenge_game_attempts
  set status = 'submitted',
      charged_at = coalesce(charged_at, timezone('utc', now()))
  where id = attempt.id
  returning * into attempt;

  return jsonb_build_object(
    'attempt', to_jsonb(attempt),
    'wallet', jsonb_build_object(
      'silverBalance', wallet_total(attempt.dog_id, 'silver_coin'),
      'goldBalance', wallet_total(attempt.dog_id, 'gold_coin')
    )
  );
end;
$$;

create or replace function settle_challenge_game_attempt(
  target_attempt_id uuid,
  storage_path_value text,
  verification_result_value jsonb,
  technical_failure_value boolean,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt challenge_game_attempts;
  submission challenge_game_attempt_submissions;
  result_verdict text;
  result_confidence numeric;
begin
  select * into attempt from challenge_game_attempts where id = target_attempt_id for update;
  if attempt.id is null then raise exception 'Challenge attempt not found'; end if;

  result_verdict := verification_result_value->>'verdict';
  result_confidence := nullif(verification_result_value->>'confidence', '')::numeric;

  if technical_failure_value then
    result_verdict := null;
    result_confidence := null;
  elsif result_verdict not in ('PASS', 'FAIL', 'NEEDS_REVIEW') then
    raise exception 'Invalid challenge verification verdict';
  end if;

  insert into challenge_game_attempt_submissions(
    attempt_id,
    dog_id,
    owner_id,
    storage_path,
    verdict,
    confidence,
    verification_result,
    technical_failure,
    idempotency_key
  )
  values (
    attempt.id,
    attempt.dog_id,
    attempt.owner_id,
    storage_path_value,
    result_verdict,
    result_confidence,
    verification_result_value,
    technical_failure_value,
    request_key
  )
  on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
  returning * into submission;

  if technical_failure_value and attempt.refunded_at is null and attempt.charged_at is not null then
    insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (attempt.owner_id, attempt.dog_id, 'silver_coin', attempt.silver_coin_entry_cost, 'challenge_game_refund', 'challenge_game_attempt', attempt.id, request_key || ':refund:silver_coin')
    on conflict do nothing;

    update challenge_game_attempts
      set status = 'refunded', refunded_at = timezone('utc', now())
      where id = attempt.id
      returning * into attempt;
  elsif technical_failure_value then
    update challenge_game_attempts
      set status = 'error'
      where id = attempt.id
      returning * into attempt;
  elsif result_verdict = 'PASS' and attempt.rewarded_at is null then
    insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (attempt.owner_id, attempt.dog_id, 'gold_coin', attempt.gold_coin_pass_reward, 'challenge_game_pass_reward', 'challenge_game_attempt', attempt.id, request_key || ':pass:gold_coin')
    on conflict do nothing;

    insert into bond_xp_transactions(owner_id, dog_id, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (attempt.owner_id, attempt.dog_id, attempt.bonus_xp, 'challenge_game_pass_reward', 'challenge_game_attempt', attempt.id, request_key || ':pass:xp')
    on conflict do nothing;

    update challenge_game_attempts
      set status = 'passed', rewarded_at = timezone('utc', now())
      where id = attempt.id
      returning * into attempt;
  elsif result_verdict = 'FAIL' then
    update challenge_game_attempts
      set status = 'failed'
      where id = attempt.id
      returning * into attempt;
  elsif result_verdict = 'NEEDS_REVIEW' then
    update challenge_game_attempts
      set status = 'needs_review',
          free_resubmissions_remaining = greatest(0, free_resubmissions_remaining - 1)
      where id = attempt.id
      returning * into attempt;
  end if;

  return jsonb_build_object(
    'attempt', to_jsonb(attempt),
    'submission', to_jsonb(submission),
    'wallet', jsonb_build_object(
      'silverBalance', wallet_total_for_owner(attempt.dog_id, attempt.owner_id, 'silver_coin'),
      'goldBalance', wallet_total_for_owner(attempt.dog_id, attempt.owner_id, 'gold_coin')
    )
  );
end;
$$;

revoke all on function derive_challenge_required_reference_assets(jsonb, text) from anon, authenticated;
revoke all on function missing_challenge_reference_assets(uuid, text) from anon, authenticated;
revoke all on function prepare_challenge_game_attempt(uuid, text, text) from anon, authenticated;
revoke all on function submit_challenge_game_attempt(uuid, uuid, text, text) from anon, authenticated;
revoke all on function settle_challenge_game_attempt(uuid, text, jsonb, boolean, text) from anon, authenticated;
