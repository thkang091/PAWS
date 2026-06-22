-- ============================================================
-- Migration 0034 — Remove prerequisite mastery check from
--                  start_challenge_game_attempt
-- ============================================================
-- The required_mastered_activity_ids check is bypassed so that
-- challenge games can be entered and tested without needing to
-- complete prerequisite training activities first.

create or replace function start_challenge_game_attempt(target_dog_id uuid, target_challenge_game_id text, request_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  game challenge_games;
  attempt challenge_game_attempts;
  silver integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;

  select * into game from challenge_games where id = target_challenge_game_id and is_active;
  if game.id is null then raise exception 'Challenge Game unavailable'; end if;

  select * into attempt from challenge_game_attempts where idempotency_key = request_key and owner_id = auth.uid();
  if attempt.id is not null then
    return jsonb_build_object(
      'attempt', to_jsonb(attempt),
      'wallet', jsonb_build_object(
        'silverBalance', wallet_total(target_dog_id, 'silver_coin'),
        'goldBalance', wallet_total(target_dog_id, 'gold_coin')
      )
    );
  end if;

  silver := wallet_total(target_dog_id, 'silver_coin');
  if silver < game.silver_coin_entry_cost then raise exception 'Insufficient Silver Coins'; end if;

  insert into challenge_game_attempts(
    challenge_game_id,
    dog_id,
    owner_id,
    status,
    silver_coin_entry_cost,
    gold_coin_pass_reward,
    bonus_xp,
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
    request_key
  )
  returning * into attempt;

  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 'silver_coin', -game.silver_coin_entry_cost, 'challenge_game_entry', 'challenge_game_attempt', attempt.id, request_key || ':entry:silver_coin')
  on conflict do nothing;

  return jsonb_build_object(
    'attempt', to_jsonb(attempt),
    'wallet', jsonb_build_object(
      'silverBalance', silver - game.silver_coin_entry_cost,
      'goldBalance', wallet_total(target_dog_id, 'gold_coin')
    )
  );
end;
$$;
