create table if not exists activity_reward_catalog (
  activity_id text primary key,
  xp_reward integer not null check (xp_reward >= 0),
  silver_coin_reward integer not null check (silver_coin_reward >= 0),
  gold_coin_reward integer not null default 0 check (gold_coin_reward >= 0),
  requires_manual_review_for_gold boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists activity_reward_catalog_set_updated_at on activity_reward_catalog;
create trigger activity_reward_catalog_set_updated_at
before update on activity_reward_catalog
for each row execute function set_updated_at();

alter table activity_reward_catalog enable row level security;

drop policy if exists "activity reward catalog read" on activity_reward_catalog;
create policy "activity reward catalog read"
on activity_reward_catalog for select
using (true);

insert into activity_reward_catalog(activity_id, xp_reward, silver_coin_reward, gold_coin_reward, requires_manual_review_for_gold)
values
  ('sit', 20, 10, 0, true),
  ('down', 20, 10, 0, true),
  ('stand', 20, 10, 0, true),
  ('paw', 20, 10, 0, true),
  ('stay', 25, 12, 0, true),
  ('spin', 30, 14, 0, true),
  ('roll_over', 35, 16, 0, true),
  ('recall', 30, 15, 0, true),
  ('walk', 10, 5, 0, true),
  ('feeding', 5, 2, 0, true),
  ('grooming', 8, 3, 0, true),
  ('water_refill', 5, 2, 0, true),
  ('enrichment_play', 8, 3, 0, true),
  ('bonding_time', 8, 3, 0, true),
  ('daily_dog_moment', 10, 5, 0, true)
on conflict (activity_id) do update set
  xp_reward = excluded.xp_reward,
  silver_coin_reward = excluded.silver_coin_reward,
  gold_coin_reward = excluded.gold_coin_reward,
  requires_manual_review_for_gold = excluded.requires_manual_review_for_gold,
  is_active = true;

create or replace function award_verification_reward(target_verification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  verification activity_verifications;
  reward activity_reward_catalog;
  reward_event activity_reward_events;
  reward_day date;
  max_daily_silver integer := 250;
  current_daily_silver integer;
  silver_currency currency_type := 'silver_coin';
  gold_currency currency_type := 'gold_coin';
begin
  select * into verification
  from activity_verifications
  where id = target_verification_id
  for update;

  if verification.id is null then
    raise exception 'Verification not found';
  end if;

  if verification.status <> 'passed' then
    insert into audit_logs(actor_user_id, dog_id, action_type, source_entity_type, source_entity_id, metadata)
    values (
      verification.user_id,
      verification.dog_id,
      'training_reward_rejected',
      'activity_verification',
      verification.id,
      jsonb_build_object('reason', 'verification_not_passed', 'status', verification.status)
    );
    raise exception 'Verification has not passed';
  end if;

  select * into reward
  from activity_reward_catalog
  where activity_id = verification.activity_id
    and is_active = true;

  if reward.activity_id is null then
    insert into audit_logs(actor_user_id, dog_id, action_type, source_entity_type, source_entity_id, metadata)
    values (
      verification.user_id,
      verification.dog_id,
      'training_reward_rejected',
      'activity_verification',
      verification.id,
      jsonb_build_object('reason', 'reward_catalog_missing', 'activityId', verification.activity_id)
    );
    raise exception 'Reward catalog missing for activity';
  end if;

  if exists (
    select 1
    from activity_reward_events
    where verification_id = verification.id
      and reward_reason = 'verified_activity_pass'
  ) then
    select * into reward_event
    from activity_reward_events
    where verification_id = verification.id
      and reward_reason = 'verified_activity_pass';

    return jsonb_build_object(
      'rewardEvent', to_jsonb(reward_event),
      'alreadyAwarded', true,
      'silverEarned', 0,
      'xpEarned', 0,
      'goldEarned', 0
    );
  end if;

  reward_day := coalesce(verification.completed_at, timezone('utc', now()))::date;

  insert into daily_reward_limits(owner_id, dog_id, reward_date, silver_earned)
  values (verification.user_id, verification.dog_id, reward_day, 0)
  on conflict (dog_id, reward_date) do nothing;

  select silver_earned into current_daily_silver
  from daily_reward_limits
  where dog_id = verification.dog_id
    and reward_date = reward_day
  for update;

  if current_daily_silver + reward.silver_coin_reward > max_daily_silver then
    insert into audit_logs(actor_user_id, dog_id, action_type, source_entity_type, source_entity_id, metadata)
    values (
      verification.user_id,
      verification.dog_id,
      'training_reward_rejected',
      'activity_verification',
      verification.id,
      jsonb_build_object('reason', 'daily_silver_limit')
    );
    raise exception 'Daily silver earning limit reached';
  end if;

  insert into activity_reward_events(
    verification_id,
    user_id,
    dog_id,
    xp_awarded,
    coins_awarded,
    reward_reason
  )
  values (
    verification.id,
    verification.user_id,
    verification.dog_id,
    reward.xp_reward,
    reward.silver_coin_reward,
    'verified_activity_pass'
  )
  returning * into reward_event;

  if reward.silver_coin_reward > 0 then
    insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (
      verification.user_id,
      verification.dog_id,
      silver_currency,
      reward.silver_coin_reward,
      'verified_activity_pass',
      'activity_verification',
      verification.id,
      verification.id::text || ':verified_activity_pass:silver_coin'
    )
    on conflict (idempotency_key) do nothing;

    update daily_reward_limits
    set silver_earned = silver_earned + reward.silver_coin_reward
    where dog_id = verification.dog_id
      and reward_date = reward_day;
  end if;

  if reward.xp_reward > 0 then
    insert into bond_xp_transactions(owner_id, dog_id, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (
      verification.user_id,
      verification.dog_id,
      reward.xp_reward,
      'verified_activity_pass',
      'activity_verification',
      verification.id,
      verification.id::text || ':verified_activity_pass:xp'
    )
    on conflict (idempotency_key) do nothing;
  end if;

  -- Gold remains admin/review restricted. This RPC intentionally does not
  -- mint gold for ordinary mobile verification passes.
  if reward.gold_coin_reward > 0 and reward.requires_manual_review_for_gold = false then
    insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (
      verification.user_id,
      verification.dog_id,
      gold_currency,
      reward.gold_coin_reward,
      'verified_activity_gold_pass',
      'activity_verification',
      verification.id,
      verification.id::text || ':verified_activity_pass:gold_coin'
    )
    on conflict (idempotency_key) do nothing;
  end if;

  insert into audit_logs(actor_user_id, dog_id, action_type, source_entity_type, source_entity_id, metadata)
  values (
    verification.user_id,
    verification.dog_id,
    'training_session_completed',
    'activity_verification',
    verification.id,
    jsonb_build_object(
      'activityId', verification.activity_id,
      'silver', reward.silver_coin_reward,
      'xp', reward.xp_reward,
      'gold', case when reward.requires_manual_review_for_gold then 0 else reward.gold_coin_reward end
    )
  );

  return jsonb_build_object(
    'rewardEvent', to_jsonb(reward_event),
    'alreadyAwarded', false,
    'silverEarned', reward.silver_coin_reward,
    'xpEarned', reward.xp_reward,
    'goldEarned', case when reward.requires_manual_review_for_gold then 0 else reward.gold_coin_reward end
  );
exception
  when unique_violation then
    select * into reward_event
    from activity_reward_events
    where verification_id = target_verification_id
      and reward_reason = 'verified_activity_pass';

    return jsonb_build_object(
      'rewardEvent', to_jsonb(reward_event),
      'alreadyAwarded', true,
      'silverEarned', 0,
      'xpEarned', 0,
      'goldEarned', 0
    );
end;
$$;

revoke all on function award_verification_reward(uuid) from anon, authenticated;
