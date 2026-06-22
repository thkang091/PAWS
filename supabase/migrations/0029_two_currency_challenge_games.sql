-- ============================================================
-- Migration 0029 — Two-currency economy + challenge games
-- ============================================================
-- Silver Coins are earned from training and spent to enter
-- Challenge Games. Gold Coins are earned only from PASS game
-- results and spent in the Coupon Shop.
--
-- Legacy migration logic:
-- Existing wallet_transactions rows using currency_type values
-- 'silver' and 'gold' are preserved by renaming the enum labels
-- in place to 'silver_coin' and 'gold_coin'. Because PostgreSQL
-- enum renames preserve stored values by oid, historical balances
-- continue to sum correctly with no row rewrite or balance loss.

do $$
begin
  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'currency_type' and e.enumlabel = 'silver'
  ) and not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'currency_type' and e.enumlabel = 'silver_coin'
  ) then
    alter type currency_type rename value 'silver' to 'silver_coin';
  end if;

  if exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'currency_type' and e.enumlabel = 'gold'
  ) and not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'currency_type' and e.enumlabel = 'gold_coin'
  ) then
    alter type currency_type rename value 'gold' to 'gold_coin';
  end if;
end $$;

do $$
begin
  create type challenge_game_difficulty as enum ('easy', 'medium', 'hard', 'featured');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type challenge_attempt_status as enum (
    'started',
    'awaiting_submission',
    'submitted',
    'under_review',
    'passed',
    'failed',
    'needs_review',
    'refunded',
    'error'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type coupon_status as enum ('active', 'inactive', 'sold_out');
exception
  when duplicate_object then null;
end $$;

-- Existing lightweight game catalog can expose economy values without
-- seeding new category-specific game catalogs in this migration.
alter table game_catalog
  add column if not exists difficulty challenge_game_difficulty not null default 'easy',
  add column if not exists gold_coin_pass_reward integer not null default 2 check (gold_coin_pass_reward >= 0),
  add column if not exists bonus_xp integer not null default 10 check (bonus_xp >= 0);

-- Canonical challenge game catalog. This remains empty until a later
-- seed prompt adds concrete games.
create table if not exists challenge_games (
  id text primary key,
  category training_goal_category not null,
  title text not null,
  subtitle text not null,
  description text not null,
  difficulty challenge_game_difficulty not null,
  recording_setup jsonb not null default '[]'::jsonb check (jsonb_typeof(recording_setup) = 'array'),
  user_instructions jsonb not null default '[]'::jsonb check (jsonb_typeof(user_instructions) = 'array'),
  min_clip_seconds integer not null check (min_clip_seconds > 0),
  max_clip_seconds integer not null check (max_clip_seconds >= min_clip_seconds),
  required_mastered_activity_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(required_mastered_activity_ids) = 'array'),
  verifier_prompt text not null check (length(trim(verifier_prompt)) > 0),
  silver_coin_entry_cost integer not null check (silver_coin_entry_cost >= 0),
  gold_coin_pass_reward integer not null check (gold_coin_pass_reward >= 0),
  bonus_xp integer not null default 0 check (bonus_xp >= 0),
  max_stars integer not null default 3 check (max_stars = 3),
  safety_notes jsonb not null default '[]'::jsonb check (jsonb_typeof(safety_notes) = 'array'),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists challenge_game_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_game_id text not null references challenge_games(id) on delete restrict,
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  status challenge_attempt_status not null default 'started',
  silver_coin_entry_cost integer not null check (silver_coin_entry_cost >= 0),
  gold_coin_pass_reward integer not null check (gold_coin_pass_reward >= 0),
  bonus_xp integer not null default 0 check (bonus_xp >= 0),
  free_resubmissions_remaining integer not null default 1 check (free_resubmissions_remaining between 0 and 1),
  charged_at timestamptz not null default timezone('utc', now()),
  refunded_at timestamptz,
  rewarded_at timestamptz,
  idempotency_key text unique not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists challenge_game_attempt_submissions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references challenge_game_attempts(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  storage_path text,
  verdict text check (verdict in ('PASS', 'FAIL', 'NEEDS_REVIEW')),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  verification_result jsonb,
  technical_failure boolean not null default false,
  idempotency_key text unique not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  gold_coin_cost integer not null check (gold_coin_cost >= 0),
  status coupon_status not null default 'inactive',
  redemption_instructions text not null default '',
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists coupon_purchases (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons(id) on delete restrict,
  owner_id uuid not null references profiles(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  gold_coin_cost integer not null check (gold_coin_cost >= 0),
  status text not null default 'purchased' check (status in ('purchased', 'redeemed', 'cancelled')),
  idempotency_key text unique not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (coupon_id, dog_id, idempotency_key)
);

create index if not exists challenge_games_active_idx on challenge_games(is_active, difficulty);
create index if not exists challenge_attempts_dog_idx on challenge_game_attempts(dog_id, created_at desc);
create index if not exists challenge_attempt_submissions_attempt_idx on challenge_game_attempt_submissions(attempt_id, created_at desc);
create index if not exists coupons_status_idx on coupons(status, expires_at);
create index if not exists coupon_purchases_dog_idx on coupon_purchases(dog_id, created_at desc);

create trigger challenge_games_set_updated_at before update on challenge_games
for each row execute function set_updated_at();

create trigger challenge_game_attempts_set_updated_at before update on challenge_game_attempts
for each row execute function set_updated_at();

create trigger coupons_set_updated_at before update on coupons
for each row execute function set_updated_at();

alter table challenge_games enable row level security;
alter table challenge_game_attempts enable row level security;
alter table challenge_game_attempt_submissions enable row level security;
alter table coupons enable row level security;
alter table coupon_purchases enable row level security;

drop policy if exists "challenge games active read" on challenge_games;
create policy "challenge games active read" on challenge_games
for select to authenticated
using (is_active = true);

drop policy if exists "challenge attempts own read" on challenge_game_attempts;
create policy "challenge attempts own read" on challenge_game_attempts
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists "challenge attempt submissions own read" on challenge_game_attempt_submissions;
create policy "challenge attempt submissions own read" on challenge_game_attempt_submissions
for select to authenticated
using (owner_id = auth.uid());

drop policy if exists "coupons active read" on coupons;
create policy "coupons active read" on coupons
for select to authenticated
using (status = 'active' and (expires_at is null or expires_at > timezone('utc', now())));

drop policy if exists "coupon purchases own read" on coupon_purchases;
create policy "coupon purchases own read" on coupon_purchases
for select to authenticated
using (owner_id = auth.uid());

create or replace function wallet_total_for_owner(target_dog_id uuid, target_owner_id uuid, target_currency currency_type)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::integer
  from wallet_transactions
  where dog_id = target_dog_id and owner_id = target_owner_id and currency = target_currency;
$$;

create or replace function wallet_total(target_dog_id uuid, target_currency currency_type)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select wallet_total_for_owner(target_dog_id, auth.uid(), target_currency);
$$;

create or replace function get_wallet_summary(target_dog_id uuid)
returns table(silver_balance integer, gold_balance integer)
language sql
stable
security definer
set search_path = public
as $$
  select wallet_total(target_dog_id, 'silver_coin'), wallet_total(target_dog_id, 'gold_coin')
  where owns_dog(target_dog_id);
$$;

create or replace function training_reward_for_level(activity_level integer)
returns table(silver_coins integer, xp integer)
language sql
immutable
set search_path = public
as $$
  select
    case
      when activity_level <= 1 then 5
      when activity_level <= 3 then 8
      else 12
    end as silver_coins,
    case
      when activity_level <= 1 then 10
      when activity_level <= 3 then 18
      else 28
    end as xp;
$$;

create or replace function challenge_economy_for_difficulty(challenge_difficulty challenge_game_difficulty)
returns table(silver_entry_cost integer, gold_pass_reward integer, bonus_xp integer)
language sql
immutable
set search_path = public
as $$
  select
    case challenge_difficulty
      when 'easy' then 10
      when 'medium' then 20
      when 'hard' then 35
      when 'featured' then 50
    end,
    case challenge_difficulty
      when 'easy' then 2
      when 'medium' then 5
      when 'hard' then 10
      when 'featured' then 20
    end,
    case challenge_difficulty
      when 'easy' then 10
      when 'medium' then 20
      when 'hard' then 35
      when 'featured' then 50
    end;
$$;

create or replace function complete_daily_quest(target_daily_quest_id uuid, request_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  quest daily_quests;
  silver_reward constant integer := 20;
  xp_reward constant integer := 35;
begin
  select * into quest from daily_quests where id = target_daily_quest_id;
  if quest.id is null or not owns_dog(quest.dog_id) then raise exception 'Quest not found'; end if;
  if quest.status = 'completed' then raise exception 'Quest already completed'; end if;

  insert into quest_completions(daily_quest_id, dog_id, owner_id, idempotency_key)
  values (quest.id, quest.dog_id, auth.uid(), request_key)
  on conflict do nothing;

  update daily_quests set status = 'completed' where id = quest.id returning * into quest;

  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), quest.dog_id, 'silver_coin', silver_reward, 'daily_quest_completion', 'daily_quest', quest.id, request_key || ':silver_coin')
  on conflict do nothing;

  insert into bond_xp_transactions(owner_id, dog_id, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), quest.dog_id, xp_reward, 'daily_quest_completion', 'daily_quest', quest.id, request_key || ':xp')
  on conflict do nothing;

  return jsonb_build_object('quest', to_jsonb(quest), 'silverEarned', silver_reward, 'xpEarned', xp_reward);
end;
$$;

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
  missing_required text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;

  select * into game from challenge_games where id = target_challenge_game_id and is_active;
  if game.id is null then raise exception 'Challenge Game unavailable'; end if;

  select value::text into missing_required
  from jsonb_array_elements_text(game.required_mastered_activity_ids) as value
  where not exists (
    select 1
    from dog_training_reward_log log
    where log.dog_id = target_dog_id
      and log.activity_id = value
      and log.source = 'activity_pass'
  )
  limit 1;

  if missing_required is not null then
    raise exception 'Required training activity is incomplete';
  end if;

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
  select * into attempt from challenge_game_attempts where id = target_attempt_id;
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

  if technical_failure_value and attempt.refunded_at is null then
    insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (attempt.owner_id, attempt.dog_id, 'silver_coin', attempt.silver_coin_entry_cost, 'challenge_game_refund', 'challenge_game_attempt', attempt.id, request_key || ':refund:silver_coin')
    on conflict do nothing;

    update challenge_game_attempts
      set status = 'refunded', refunded_at = timezone('utc', now())
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

create or replace function purchase_coupon(target_dog_id uuid, target_coupon_id uuid, request_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  coupon coupons;
  purchase coupon_purchases;
  gold integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;

  select * into coupon
  from coupons
  where id = target_coupon_id
    and status = 'active'
    and (expires_at is null or expires_at > timezone('utc', now()));

  if coupon.id is null then raise exception 'Coupon unavailable'; end if;

  select * into purchase from coupon_purchases where idempotency_key = request_key and owner_id = auth.uid();
  if purchase.id is not null then
    return jsonb_build_object(
      'purchase', to_jsonb(purchase),
      'wallet', jsonb_build_object(
        'silverBalance', wallet_total(target_dog_id, 'silver_coin'),
        'goldBalance', wallet_total(target_dog_id, 'gold_coin')
      )
    );
  end if;

  gold := wallet_total(target_dog_id, 'gold_coin');
  if gold < coupon.gold_coin_cost then raise exception 'Insufficient Gold Coins'; end if;

  insert into coupon_purchases(coupon_id, owner_id, dog_id, gold_coin_cost, idempotency_key)
  values (coupon.id, auth.uid(), target_dog_id, coupon.gold_coin_cost, request_key)
  returning * into purchase;

  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 'gold_coin', -coupon.gold_coin_cost, 'coupon_purchase', 'coupon', coupon.id, request_key || ':coupon:gold_coin')
  on conflict do nothing;

  return jsonb_build_object(
    'purchase', to_jsonb(purchase),
    'wallet', jsonb_build_object(
      'silverBalance', wallet_total(target_dog_id, 'silver_coin'),
      'goldBalance', gold - coupon.gold_coin_cost
    )
  );
end;
$$;

create or replace function get_profile_dashboard(target_dog_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  dog_row dogs;
  status_row dog_status;
  xp_total integer;
begin
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;
  select * into dog_row from dogs where id = target_dog_id;
  select * into status_row from dog_status where dog_id = target_dog_id;
  select coalesce(sum(amount), 0)::integer into xp_total from bond_xp_transactions where dog_id = target_dog_id and owner_id = auth.uid();
  return jsonb_build_object(
    'dog', to_jsonb(dog_row),
    'wallet', jsonb_build_object('silverBalance', wallet_total(target_dog_id, 'silver_coin'), 'goldBalance', wallet_total(target_dog_id, 'gold_coin')),
    'bondXp', xp_total,
    'level', floor(xp_total / 100) + 1,
    'status', to_jsonb(status_row),
    'streak', current_streak(target_dog_id),
    'trainingSummary', (select jsonb_build_object('completedSkills', count(*) filter (where completion_percentage = 100), 'activeSkills', count(*)) from dog_training_progress where dog_id = target_dog_id)
  );
end;
$$;

create or replace function complete_training_session(target_dog_id uuid, target_skill_id uuid, request_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  skill training_skills;
  session_row training_sessions;
  progress_row dog_training_progress;
  status_row dog_status;
  reward record;
begin
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;
  select * into skill from training_skills where id = target_skill_id and is_active;
  if skill.id is null then raise exception 'Training skill unavailable'; end if;

  select * into reward from training_reward_for_level(skill.difficulty);
  select * into session_row from training_sessions where idempotency_key = request_key;
  if session_row.id is null then
    insert into training_sessions(dog_id, skill_id, owner_id, idempotency_key)
    values (target_dog_id, target_skill_id, auth.uid(), request_key)
    returning * into session_row;

    insert into dog_training_progress(dog_id, skill_id, sessions_completed, completion_percentage, completed_at)
    values (target_dog_id, target_skill_id, 1, least(100, 25), null)
    on conflict (dog_id, skill_id) do update set
      sessions_completed = dog_training_progress.sessions_completed + 1,
      completion_percentage = least(100, dog_training_progress.completion_percentage + 25),
      completed_at = case when least(100, dog_training_progress.completion_percentage + 25) = 100 then timezone('utc', now()) else dog_training_progress.completed_at end
    returning * into progress_row;

    insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (auth.uid(), target_dog_id, 'silver_coin', reward.silver_coins, 'training_activity_completion', 'training_session', session_row.id, request_key || ':silver_coin')
    on conflict do nothing;

    insert into bond_xp_transactions(owner_id, dog_id, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (auth.uid(), target_dog_id, reward.xp, 'training_activity_completion', 'training_session', session_row.id, request_key || ':xp')
    on conflict do nothing;

    update dog_status set
      focus = greatest(0, least(100, focus + skill.focus_delta)),
      discipline = greatest(0, least(100, discipline + skill.discipline_delta)),
      social = greatest(0, least(100, social + skill.social_delta)),
      energy = greatest(0, least(100, energy + skill.energy_delta)),
      intelligence = greatest(0, least(100, intelligence + skill.intelligence_delta)),
      updated_at = timezone('utc', now())
    where dog_id = target_dog_id returning * into status_row;
  else
    select * into progress_row from dog_training_progress where dog_id = target_dog_id and skill_id = target_skill_id;
    select * into status_row from dog_status where dog_id = target_dog_id;
  end if;

  return jsonb_build_object('session', to_jsonb(session_row), 'progress', to_jsonb(progress_row), 'silverEarned', reward.silver_coins, 'xpEarned', reward.xp, 'status', to_jsonb(status_row));
end;
$$;

create or replace function submit_daily_dog_moment(target_dog_id uuid, storage_path_value text, caption_value text, local_date date, request_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  moment dog_moments;
begin
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;
  insert into dog_moments(dog_id, owner_id, storage_path, caption, moment_date, reward_claimed)
  values (target_dog_id, auth.uid(), storage_path_value, caption_value, local_date, true)
  returning * into moment;
  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 'silver_coin', 15, 'dog_moment', 'dog_moment', moment.id, request_key || ':silver_coin')
  on conflict do nothing;
  insert into bond_xp_transactions(owner_id, dog_id, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 10, 'dog_moment', 'dog_moment', moment.id, request_key || ':xp')
  on conflict do nothing;
  return jsonb_build_object('moment', to_jsonb(moment), 'streak', current_streak(target_dog_id));
exception
  when unique_violation then raise exception 'Dog Moment already uploaded today';
end;
$$;

create or replace function enter_game(target_dog_id uuid, target_game_instance_id uuid, request_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  instance game_instances;
  game game_catalog;
  entry game_entries;
  silver integer;
begin
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;
  select * into instance from game_instances where id = target_game_instance_id and is_active and now() between starts_at and ends_at;
  if instance.id is null then raise exception 'Game challenge unavailable'; end if;
  select * into game from game_catalog where id = instance.game_catalog_id;
  silver := wallet_total(target_dog_id, 'silver_coin');
  if silver < game.silver_entry_cost then raise exception 'Insufficient Silver Coins'; end if;
  insert into game_entries(game_instance_id, dog_id, owner_id, idempotency_key)
  values (target_game_instance_id, target_dog_id, auth.uid(), request_key)
  returning * into entry;
  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 'silver_coin', -game.silver_entry_cost, 'challenge_game_entry', 'game_entry', entry.id, request_key || ':silver_coin')
  on conflict do nothing;
  return jsonb_build_object('entry', to_jsonb(entry), 'wallet', jsonb_build_object('silverBalance', silver - game.silver_entry_cost, 'goldBalance', wallet_total(target_dog_id, 'gold_coin')));
exception
  when unique_violation then raise exception 'Game entry already exists';
end;
$$;

create or replace function redeem_reward(target_dog_id uuid, target_reward_id uuid, request_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  reward reward_catalog;
  redemption reward_redemptions;
  gold integer;
begin
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;
  select * into reward from reward_catalog where id = target_reward_id and is_active;
  if reward.id is null then raise exception 'Reward unavailable'; end if;
  gold := wallet_total(target_dog_id, 'gold_coin');
  if gold < reward.gold_cost then raise exception 'Insufficient Gold Coins'; end if;
  insert into reward_redemptions(reward_id, owner_id, dog_id, idempotency_key)
  values (target_reward_id, auth.uid(), target_dog_id, request_key)
  returning * into redemption;
  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 'gold_coin', -reward.gold_cost, 'coupon_purchase', 'reward_redemption', redemption.id, request_key || ':gold_coin')
  on conflict do nothing;
  return jsonb_build_object('redemption', to_jsonb(redemption), 'wallet', jsonb_build_object('silverBalance', wallet_total(target_dog_id, 'silver_coin'), 'goldBalance', gold - reward.gold_cost));
exception
  when unique_violation then raise exception 'Redemption already submitted';
end;
$$;

create or replace function purchase_avatar_item(target_dog_id uuid, target_avatar_item_id uuid, request_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item avatar_catalog;
  owned user_avatar_items;
  silver integer;
begin
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;
  select * into item from avatar_catalog where id = target_avatar_item_id and is_active;
  if item.id is null then raise exception 'Avatar item unavailable'; end if;
  if exists(select 1 from user_avatar_items where dog_id = target_dog_id and avatar_item_id = item.id) then
    raise exception 'Avatar item already owned';
  end if;
  silver := wallet_total(target_dog_id, 'silver_coin');
  if silver < item.silver_cost then raise exception 'Insufficient Silver Coins'; end if;
  insert into user_avatar_items(owner_id, dog_id, avatar_item_id)
  values (auth.uid(), target_dog_id, item.id)
  returning * into owned;
  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 'silver_coin', -item.silver_cost, 'avatar_purchase', 'avatar_item', item.id, request_key || ':silver_coin')
  on conflict do nothing;
  perform write_audit_log('avatar_item_purchased', target_dog_id, 'avatar_item', item.id, jsonb_build_object('silverCost', item.silver_cost));
  return jsonb_build_object('item', to_jsonb(owned), 'wallet', jsonb_build_object('silverBalance', silver - item.silver_cost, 'goldBalance', wallet_total(target_dog_id, 'gold_coin')));
exception
  when unique_violation then raise exception 'Avatar item already owned';
end;
$$;

create or replace function grant_training_pass_reward(
  p_submission_id   uuid,
  p_dog_id          uuid,
  p_activity_id     text,
  p_roadmap_day_id  uuid,
  p_xp              integer,
  p_coins           integer,
  p_stars           integer,
  p_idempotency_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_row training_catalog_activities;
  reward record;
  dog_owner uuid;
begin
  if not exists (
    select 1
    from dog_training_verification_results
    where submission_id = p_submission_id
      and verdict = 'PASS'
  ) then
    raise exception 'grant_training_pass_reward: submission % does not have a confirmed PASS verdict', p_submission_id;
  end if;

  select * into activity_row from training_catalog_activities where id = p_activity_id;
  if activity_row.id is null then raise exception 'Training activity not found'; end if;

  select owner_id into dog_owner from dogs where id = p_dog_id;
  if dog_owner is null then raise exception 'Dog not found'; end if;

  select * into reward from training_reward_for_level(activity_row.level);

  insert into dog_training_reward_log (
    dog_id, roadmap_day_id, activity_id,
    xp_awarded, coins_awarded, stars_awarded,
    source, idempotency_key
  )
  values (
    p_dog_id, p_roadmap_day_id, p_activity_id,
    reward.xp, reward.silver_coins, p_stars,
    'activity_pass', p_idempotency_key
  )
  on conflict (idempotency_key) do nothing;

  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (dog_owner, p_dog_id, 'silver_coin', reward.silver_coins, 'training_activity_completion', 'dog_training_video_submission', p_submission_id, p_idempotency_key || ':silver_coin')
  on conflict do nothing;

  insert into bond_xp_transactions(owner_id, dog_id, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (dog_owner, p_dog_id, reward.xp, 'training_activity_completion', 'dog_training_video_submission', p_submission_id, p_idempotency_key || ':xp')
  on conflict do nothing;

  update dog_training_video_submissions
    set reward_granted = true
    where id = p_submission_id;

  update dog_training_verification_results
    set reward_granted = true
    where submission_id = p_submission_id;
end;
$$;

revoke all on function settle_challenge_game_attempt(uuid, text, jsonb, boolean, text) from anon, authenticated;
revoke all on function grant_training_pass_reward(uuid, uuid, text, uuid, integer, integer, integer, text) from anon, authenticated;
