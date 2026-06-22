create or replace function wallet_total(target_dog_id uuid, target_currency currency_type)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::integer
  from wallet_transactions
  where dog_id = target_dog_id and owner_id = auth.uid() and currency = target_currency;
$$;

create or replace function current_streak(target_dog_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  day_cursor date := current_date;
  streak integer := 0;
begin
  while exists(select 1 from dog_moments where dog_id = target_dog_id and moment_date = day_cursor) loop
    streak := streak + 1;
    day_cursor := day_cursor - interval '1 day';
  end loop;
  return streak;
end;
$$;

create or replace function bootstrap_user_profile()
returns profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  result profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into profiles(id) values (auth.uid())
  on conflict (id) do nothing;

  select * into result from profiles where id = auth.uid();
  return result;
end;
$$;

create or replace function generate_dog_tag()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := 'PAWS-' || upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
    exit when not exists(select 1 from dogs where dog_tag = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function create_dog_profile(
  dog_name text,
  dog_gender_value dog_gender,
  dog_birthday date,
  dog_age_years numeric,
  dog_breed text,
  dog_owned_since date,
  dog_adoption_date date,
  dog_obedience_level obedience_level,
  dog_energy_level energy_level,
  goal_keys text[],
  existing_skill_ids uuid[],
  target_skill_ids uuid[],
  concern_keys text[],
  concern_other_note text
)
returns dogs
language plpgsql
security definer
set search_path = public
as $$
declare
  dog_result dogs;
  key text;
  skill uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if dog_birthday is null and dog_age_years is null then raise exception 'Birthday or approximate age is required'; end if;
  if exists(select 1 from dogs where owner_id = auth.uid()) then raise exception 'A dog profile already exists for this MVP account'; end if;

  perform bootstrap_user_profile();

  insert into dogs(owner_id, name, gender, birthday, age_years, breed, owned_since, adoption_date, obedience_level, energy_level, dog_tag)
  values (auth.uid(), trim(dog_name), dog_gender_value, dog_birthday, dog_age_years, trim(dog_breed), dog_owned_since, dog_adoption_date, dog_obedience_level, dog_energy_level, generate_dog_tag())
  returning * into dog_result;

  foreach key in array coalesce(goal_keys, array[]::text[]) loop
    insert into dog_goals(dog_id, goal_key) values (dog_result.id, key) on conflict do nothing;
  end loop;
  foreach skill in array coalesce(existing_skill_ids, array[]::uuid[]) loop
    insert into dog_existing_skills(dog_id, skill_id) values (dog_result.id, skill) on conflict do nothing;
  end loop;
  foreach skill in array coalesce(target_skill_ids, array[]::uuid[]) loop
    insert into dog_target_skills(dog_id, skill_id) values (dog_result.id, skill) on conflict do nothing;
  end loop;
  foreach key in array coalesce(concern_keys, array[]::text[]) loop
    insert into dog_behavioral_concerns(dog_id, concern_key, custom_note)
    values (dog_result.id, key, case when key = 'other' then nullif(trim(concern_other_note), '') else null end)
    on conflict do nothing;
  end loop;

  insert into dog_status(dog_id) values (dog_result.id);
  update profiles set onboarding_completed = true where id = auth.uid();

  return dog_result;
end;
$$;

create or replace function initialize_daily_quests(target_dog_id uuid, requested_date date)
returns setof daily_quests
language plpgsql
security definer
set search_path = public
as $$
declare
  template_ids uuid[];
begin
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;

  select array_remove(array[
    (select id from quest_templates where slug = 'daily-dog-moment' and is_active limit 1),
    (select id from quest_templates where slug = 'five-minute-training' and is_active limit 1),
    (select qt.id from quest_templates qt
      where qt.is_active and qt.slug in (
        case when exists(select 1 from dog_goals where dog_id = target_dog_id and goal_key = 'more_outdoor_time') then 'go-on-a-walk' else 'focused-bonding-time' end
      )
      limit 1)
  ], null) into template_ids;

  insert into daily_quests(dog_id, template_id, quest_date)
  select target_dog_id, unnest(template_ids), requested_date
  on conflict do nothing;

  return query select * from daily_quests where dog_id = target_dog_id and quest_date = requested_date order by created_at;
end;
$$;

create or replace function get_wallet_summary(target_dog_id uuid)
returns table(silver_balance integer, gold_balance integer)
language sql
stable
security definer
set search_path = public
as $$
  select wallet_total(target_dog_id, 'silver'), wallet_total(target_dog_id, 'gold')
  where owns_dog(target_dog_id);
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
begin
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;
  select * into skill from training_skills where id = target_skill_id and is_active;
  if skill.id is null then raise exception 'Training skill unavailable'; end if;

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
  if quest.status = 'completed' then raise exception 'Quest already completed'; end if;
  select * into template from quest_templates where id = quest.template_id;

  insert into quest_completions(daily_quest_id, dog_id, owner_id, idempotency_key)
  values (quest.id, quest.dog_id, auth.uid(), request_key)
  on conflict do nothing;
  update daily_quests set status = 'completed' where id = quest.id returning * into quest;
  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), quest.dog_id, 'silver', template.silver_reward, 'daily_quest', 'daily_quest', quest.id, request_key || ':silver')
  on conflict do nothing;
  insert into bond_xp_transactions(owner_id, dog_id, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), quest.dog_id, template.bond_xp_reward, 'daily_quest', 'daily_quest', quest.id, request_key || ':xp')
  on conflict do nothing;
  return jsonb_build_object('quest', to_jsonb(quest), 'silverEarned', template.silver_reward, 'xpEarned', template.bond_xp_reward);
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
  values (auth.uid(), target_dog_id, 'silver', 15, 'dog_moment', 'dog_moment', moment.id, request_key || ':silver');
  insert into bond_xp_transactions(owner_id, dog_id, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 10, 'dog_moment', 'dog_moment', moment.id, request_key || ':xp');
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
  silver := wallet_total(target_dog_id, 'silver');
  if silver < game.silver_entry_cost then raise exception 'Insufficient silver balance'; end if;
  insert into game_entries(game_instance_id, dog_id, owner_id, idempotency_key)
  values (target_game_instance_id, target_dog_id, auth.uid(), request_key)
  returning * into entry;
  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 'silver', -game.silver_entry_cost, 'game_entry', 'game_entry', entry.id, request_key || ':silver');
  return jsonb_build_object('entry', to_jsonb(entry), 'wallet', jsonb_build_object('silverBalance', silver - game.silver_entry_cost, 'goldBalance', wallet_total(target_dog_id, 'gold')));
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
  gold := wallet_total(target_dog_id, 'gold');
  if gold < reward.gold_cost then raise exception 'Insufficient gold balance'; end if;
  insert into reward_redemptions(reward_id, owner_id, dog_id, idempotency_key)
  values (target_reward_id, auth.uid(), target_dog_id, request_key)
  returning * into redemption;
  insert into wallet_transactions(owner_id, dog_id, currency, amount, reason, source_entity_type, source_entity_id, idempotency_key)
  values (auth.uid(), target_dog_id, 'gold', -reward.gold_cost, 'reward_redemption', 'reward_redemption', redemption.id, request_key || ':gold');
  return jsonb_build_object('redemption', to_jsonb(redemption), 'wallet', jsonb_build_object('silverBalance', wallet_total(target_dog_id, 'silver'), 'goldBalance', gold - reward.gold_cost));
exception
  when unique_violation then raise exception 'Redemption already submitted';
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
    'wallet', jsonb_build_object('silverBalance', wallet_total(target_dog_id, 'silver'), 'goldBalance', wallet_total(target_dog_id, 'gold')),
    'bondXp', xp_total,
    'level', floor(xp_total / 100) + 1,
    'status', to_jsonb(status_row),
    'streak', current_streak(target_dog_id),
    'trainingSummary', (select jsonb_build_object('completedSkills', count(*) filter (where completion_percentage = 100), 'activeSkills', count(*)) from dog_training_progress where dog_id = target_dog_id)
  );
end;
$$;
