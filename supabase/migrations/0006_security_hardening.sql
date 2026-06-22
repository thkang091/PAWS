create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  dog_id uuid,
  action_type text not null,
  source_entity_type text,
  source_entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table daily_reward_limits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  reward_date date not null,
  silver_earned integer not null default 0 check (silver_earned >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(dog_id, reward_date)
);

create table notification_preferences (
  owner_id uuid primary key references profiles(id) on delete cascade,
  dog_moment_reminder boolean not null default true,
  daily_quest_reminder boolean not null default true,
  training_reminder boolean not null default true,
  streak_at_risk_reminder boolean not null default true,
  care_event_reminder boolean not null default true,
  weekly_recap boolean not null default true,
  reminder_time text not null default '18:00',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger daily_reward_limits_set_updated_at before update on daily_reward_limits for each row execute function set_updated_at();
create trigger notification_preferences_set_updated_at before update on notification_preferences for each row execute function set_updated_at();

alter table audit_logs enable row level security;
alter table daily_reward_limits enable row level security;
alter table notification_preferences enable row level security;

create policy "reward limits own read" on daily_reward_limits for select using (owner_id = auth.uid());
create policy "notification prefs own all" on notification_preferences for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function write_audit_log(
  action_type_value text,
  dog_id_value uuid default null,
  source_entity_type_value text default null,
  source_entity_id_value uuid default null,
  metadata_value jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_logs(actor_user_id, dog_id, action_type, source_entity_type, source_entity_id, metadata)
  values (auth.uid(), dog_id_value, action_type_value, source_entity_type_value, source_entity_id_value, coalesce(metadata_value, '{}'::jsonb));
end;
$$;

create or replace function reserve_daily_silver(target_dog_id uuid, silver_amount integer, reward_date_value date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  max_daily_silver integer := 250;
  current_total integer;
begin
  insert into daily_reward_limits(owner_id, dog_id, reward_date, silver_earned)
  values (auth.uid(), target_dog_id, reward_date_value, 0)
  on conflict (dog_id, reward_date) do nothing;

  select silver_earned into current_total
  from daily_reward_limits
  where dog_id = target_dog_id and reward_date = reward_date_value
  for update;

  if current_total + silver_amount > max_daily_silver then
    perform write_audit_log('training_reward_rejected', target_dog_id, null, null, jsonb_build_object('reason', 'daily_silver_limit'));
    raise exception 'Daily silver earning limit reached';
  end if;

  update daily_reward_limits
  set silver_earned = silver_earned + silver_amount
  where dog_id = target_dog_id and reward_date = reward_date_value;
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
  recent_session boolean;
begin
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;
  select * into skill from training_skills where id = target_skill_id and is_active;
  if skill.id is null then raise exception 'Training skill unavailable'; end if;

  select * into session_row from training_sessions where idempotency_key = request_key;
  if session_row.id is null then
    select exists(
      select 1 from training_sessions
      where dog_id = target_dog_id and skill_id = target_skill_id and owner_id = auth.uid()
        and created_at > timezone('utc', now()) - interval '2 minutes'
    ) into recent_session;
    if recent_session then
      perform write_audit_log('training_reward_rejected', target_dog_id, 'training_skill', target_skill_id, jsonb_build_object('reason', 'cooldown'));
      raise exception 'This skill was completed too recently. Please wait before recording another session.';
    end if;

    perform reserve_daily_silver(target_dog_id, skill.silver_reward, current_date);

    insert into training_sessions(dog_id, skill_id, owner_id, idempotency_key, started_at)
    values (target_dog_id, target_skill_id, auth.uid(), request_key, timezone('utc', now()))
    returning * into session_row;

    insert into dog_training_progress(dog_id, skill_id, sessions_completed, completion_percentage, completed_at)
    values (target_dog_id, target_skill_id, 1, least(100, 25), null)
    on conflict (dog_id, skill_id) do update set
      sessions_completed = dog_training_progress.sessions_completed + 1,
      completion_percentage = least(100, dog_training_progress.completion_percentage + 25),
      completed_at = case when least(100, dog_training_progress.completion_percentage + 25) = 100 then timezone('utc', now()) else dog_training_progress.completed_at end
    returning * into progress_row;

    insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (auth.uid(), target_dog_id, 'silver', skill.silver_reward, 'training_session', 'training_session', session_row.id, request_key || ':silver');
    insert into bond_xp_transactions(owner_id, dog_id, amount, reason, source_entity_type, source_entity_id, idempotency_key)
    values (auth.uid(), target_dog_id, skill.bond_xp_reward, 'training_session', 'training_session', session_row.id, request_key || ':xp');

    update dog_status set
      focus = greatest(0, least(100, focus + skill.focus_delta)),
      discipline = greatest(0, least(100, discipline + skill.discipline_delta)),
      social = greatest(0, least(100, social + skill.social_delta)),
      energy = greatest(0, least(100, energy + skill.energy_delta)),
      intelligence = greatest(0, least(100, intelligence + skill.intelligence_delta)),
      updated_at = timezone('utc', now())
    where dog_id = target_dog_id returning * into status_row;

    perform write_audit_log('training_session_completed', target_dog_id, 'training_session', session_row.id, jsonb_build_object('silver', skill.silver_reward, 'xp', skill.bond_xp_reward));
  else
    select * into progress_row from dog_training_progress where dog_id = target_dog_id and skill_id = target_skill_id;
    select * into status_row from dog_status where dog_id = target_dog_id;
  end if;

  return jsonb_build_object('session', to_jsonb(session_row), 'progress', to_jsonb(progress_row), 'silverEarned', skill.silver_reward, 'xpEarned', skill.bond_xp_reward, 'status', to_jsonb(status_row));
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
  template quest_templates;
begin
  select * into quest from daily_quests where id = target_daily_quest_id;
  if quest.id is null or not owns_dog(quest.dog_id) then raise exception 'Quest not found'; end if;
  if quest.status = 'completed' then
    perform write_audit_log('quest_reward_rejected', quest.dog_id, 'daily_quest', quest.id, jsonb_build_object('reason', 'already_completed'));
    raise exception 'Quest already completed';
  end if;
  select * into template from quest_templates where id = quest.template_id;
  perform reserve_daily_silver(quest.dog_id, template.silver_reward, quest.quest_date);

  insert into quest_completions(daily_quest_id, dog_id, owner_id, idempotency_key)
  values (quest.id, quest.dog_id, auth.uid(), request_key);
  update daily_quests set status = 'completed' where id = quest.id returning * into quest;
  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), quest.dog_id, 'silver', template.silver_reward, 'daily_quest', 'daily_quest', quest.id, request_key || ':silver');
  insert into bond_xp_transactions(owner_id, dog_id, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), quest.dog_id, template.bond_xp_reward, 'daily_quest', 'daily_quest', quest.id, request_key || ':xp');
  perform write_audit_log('quest_completed', quest.dog_id, 'daily_quest', quest.id, jsonb_build_object('silver', template.silver_reward, 'xp', template.bond_xp_reward));
  return jsonb_build_object('quest', to_jsonb(quest), 'silverEarned', template.silver_reward, 'xpEarned', template.bond_xp_reward);
exception
  when unique_violation then
    raise exception 'Quest already completed';
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
  if split_part(storage_path_value, '/', 1) <> auth.uid()::text then
    raise exception 'Upload path must belong to the current user';
  end if;
  perform reserve_daily_silver(target_dog_id, 15, local_date);
  insert into dog_moments(dog_id, owner_id, storage_path, caption, moment_date, reward_claimed)
  values (target_dog_id, auth.uid(), storage_path_value, caption_value, local_date, true)
  returning * into moment;
  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 'silver', 15, 'dog_moment', 'dog_moment', moment.id, request_key || ':silver');
  insert into bond_xp_transactions(owner_id, dog_id, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 10, 'dog_moment', 'dog_moment', moment.id, request_key || ':xp');
  perform write_audit_log('dog_moment_uploaded', target_dog_id, 'dog_moment', moment.id, '{}'::jsonb);
  return jsonb_build_object('moment', to_jsonb(moment), 'streak', current_streak(target_dog_id));
exception
  when unique_violation then
    perform write_audit_log('dog_moment_duplicate_rejected', target_dog_id, 'dog_moment', null, jsonb_build_object('date', local_date));
    raise exception 'Dog Moment already uploaded today';
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
  if instance.id is null then
    perform write_audit_log('game_entry_rejected', target_dog_id, 'game_instance', target_game_instance_id, jsonb_build_object('reason', 'unavailable'));
    raise exception 'Game challenge unavailable';
  end if;
  select * into game from game_catalog where id = instance.game_catalog_id;
  silver := wallet_total(target_dog_id, 'silver');
  if silver < game.silver_entry_cost then
    perform write_audit_log('game_entry_rejected', target_dog_id, 'game_instance', target_game_instance_id, jsonb_build_object('reason', 'insufficient_silver'));
    raise exception 'Insufficient silver balance';
  end if;
  insert into game_entries(game_instance_id, dog_id, owner_id, idempotency_key)
  values (target_game_instance_id, target_dog_id, auth.uid(), request_key)
  returning * into entry;
  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 'silver', -game.silver_entry_cost, 'game_entry', 'game_entry', entry.id, request_key || ':silver');
  perform write_audit_log('game_entered', target_dog_id, 'game_entry', entry.id, jsonb_build_object('silverCost', game.silver_entry_cost));
  return jsonb_build_object('entry', to_jsonb(entry), 'wallet', jsonb_build_object('silverBalance', silver - game.silver_entry_cost, 'goldBalance', wallet_total(target_dog_id, 'gold')));
exception
  when unique_violation then
    perform write_audit_log('game_entry_rejected', target_dog_id, 'game_instance', target_game_instance_id, jsonb_build_object('reason', 'duplicate'));
    raise exception 'Game entry already exists';
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
  if reward.id is null then
    perform write_audit_log('reward_redemption_rejected', target_dog_id, 'reward', target_reward_id, jsonb_build_object('reason', 'unavailable'));
    raise exception 'Reward unavailable';
  end if;
  gold := wallet_total(target_dog_id, 'gold');
  if gold < reward.gold_cost then
    perform write_audit_log('reward_redemption_rejected', target_dog_id, 'reward', target_reward_id, jsonb_build_object('reason', 'insufficient_gold'));
    raise exception 'Insufficient gold balance';
  end if;
  insert into reward_redemptions(reward_id, owner_id, dog_id, idempotency_key)
  values (target_reward_id, auth.uid(), target_dog_id, request_key)
  returning * into redemption;
  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 'gold', -reward.gold_cost, 'reward_redemption', 'reward_redemption', redemption.id, request_key || ':gold');
  perform write_audit_log('reward_redemption_requested', target_dog_id, 'reward_redemption', redemption.id, jsonb_build_object('goldCost', reward.gold_cost));
  return jsonb_build_object('redemption', to_jsonb(redemption), 'wallet', jsonb_build_object('silverBalance', wallet_total(target_dog_id, 'silver'), 'goldBalance', gold - reward.gold_cost));
exception
  when unique_violation then
    raise exception 'Redemption already submitted';
end;
$$;
