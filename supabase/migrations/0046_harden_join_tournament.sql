-- ============================================================
-- Migration 0046 - Hardened tournament join RPC (Phase 2B)
-- ============================================================
-- The authenticated mobile client may request a tournament join only through
-- this function. It never receives direct INSERT/UPDATE access to tournament
-- or wallet tables.
--
-- Safety boundaries:
--   - Entry creation, fee deduction, and participant count update are atomic.
--   - A dog row lock serializes wallet-affecting requests for that dog.
--   - A tournament row lock prevents capacity overbooking.
--   - Repeated requests return the existing entry without charging again.
--   - Scores, ranks, settlement, and prize payouts remain backend/admin only.
-- ============================================================

create or replace function public.join_tournament(
  target_tournament_id uuid,
  target_dog_id uuid,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_user_id uuid := auth.uid();
  tournament_row public.tournament_events%rowtype;
  entry_row public.tournament_entries%rowtype;
  silver_balance integer;
  gold_balance integer;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if request_key is null or btrim(request_key) = '' then
    raise exception 'Request key is required' using errcode = '22023';
  end if;

  -- Ownership check plus per-dog serialization for wallet-affecting writes.
  perform 1
  from public.dogs as dog
  where dog.id = target_dog_id
    and dog.owner_id = request_user_id
  for update;

  if not found then
    raise exception 'Dog not found' using errcode = '42501';
  end if;

  -- A retry with the same request key returns the original result.
  select entry.*
  into entry_row
  from public.tournament_entries as entry
  where entry.idempotency_key = request_key
    and entry.tournament_id = target_tournament_id
    and entry.dog_id = target_dog_id
    and entry.owner_id = request_user_id;

  if found then
    return jsonb_build_object(
      'entry', to_jsonb(entry_row),
      'wallet', jsonb_build_object(
        'silverBalance', public.wallet_total_for_owner(target_dog_id, request_user_id, 'silver_coin'),
        'goldBalance', public.wallet_total_for_owner(target_dog_id, request_user_id, 'gold_coin')
      )
    );
  end if;

  -- Serialize capacity checks and participant_count changes per tournament.
  select event.*
  into tournament_row
  from public.tournament_events as event
  where event.id = target_tournament_id
  for update;

  if not found
    or tournament_row.status <> 'registration_open'
    or now() < tournament_row.registration_opens_at
    or now() >= tournament_row.registration_closes_at
  then
    raise exception 'Tournament registration is not open' using errcode = 'P0001';
  end if;

  -- Different request keys for an already-entered dog are also safe retries.
  select entry.*
  into entry_row
  from public.tournament_entries as entry
  where entry.tournament_id = target_tournament_id
    and entry.dog_id = target_dog_id
    and entry.owner_id = request_user_id;

  if found then
    return jsonb_build_object(
      'entry', to_jsonb(entry_row),
      'wallet', jsonb_build_object(
        'silverBalance', public.wallet_total_for_owner(target_dog_id, request_user_id, 'silver_coin'),
        'goldBalance', public.wallet_total_for_owner(target_dog_id, request_user_id, 'gold_coin')
      )
    );
  end if;

  if tournament_row.participant_count >= tournament_row.max_participants then
    raise exception 'Tournament is full' using errcode = 'P0001';
  end if;

  silver_balance := public.wallet_total_for_owner(
    target_dog_id,
    request_user_id,
    'silver_coin'
  );
  gold_balance := public.wallet_total_for_owner(
    target_dog_id,
    request_user_id,
    'gold_coin'
  );

  if tournament_row.entry_currency = 'silver_coin'
    and silver_balance < tournament_row.entry_cost
  then
    raise exception 'Insufficient Silver Coins' using errcode = 'P0001';
  elsif tournament_row.entry_currency = 'gold_coin'
    and gold_balance < tournament_row.entry_cost
  then
    raise exception 'Insufficient Gold Coins' using errcode = 'P0001';
  end if;

  insert into public.tournament_entries (
    tournament_id,
    dog_id,
    owner_id,
    idempotency_key
  )
  values (
    tournament_row.id,
    target_dog_id,
    request_user_id,
    request_key
  )
  returning * into entry_row;

  insert into public.wallet_transactions (
    owner_id,
    dog_id,
    currency,
    amount,
    reason,
    source_entity_type,
    source_entity_id,
    idempotency_key
  )
  values (
    request_user_id,
    target_dog_id,
    tournament_row.entry_currency,
    -tournament_row.entry_cost,
    'tournament_entry',
    'tournament_entry',
    entry_row.id,
    request_key || ':entry'
  );

  update public.tournament_events
  set participant_count = participant_count + 1
  where id = tournament_row.id;

  return jsonb_build_object(
    'entry', to_jsonb(entry_row),
    'wallet', jsonb_build_object(
      'silverBalance', public.wallet_total_for_owner(target_dog_id, request_user_id, 'silver_coin'),
      'goldBalance', public.wallet_total_for_owner(target_dog_id, request_user_id, 'gold_coin')
    )
  );
end;
$$;

revoke all on function public.join_tournament(uuid, uuid, text)
  from public, anon;
grant execute on function public.join_tournament(uuid, uuid, text)
  to authenticated;

comment on function public.join_tournament(uuid, uuid, text) is
  'Atomic authenticated tournament entry. Mobile cannot directly mutate tournament or wallet tables.';

notify pgrst, 'reload schema';
