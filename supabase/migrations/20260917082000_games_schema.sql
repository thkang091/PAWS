create type public.challenge_game_difficulty as enum ('easy', 'medium', 'hard', 'featured');
create type public.game_entry_status as enum ('entered', 'awaiting_submission', 'submitted', 'under_review', 'completed', 'rejected');
create type public.challenge_attempt_status as enum ('started', 'awaiting_submission', 'submitted', 'under_review', 'passed', 'failed', 'needs_review', 'refunded', 'error');
create type public.submission_status as enum ('pending', 'processing', 'under_review', 'passed', 'failed');

create table public.game_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  silver_entry_cost integer not null default 0 check (silver_entry_cost >= 0),
  difficulty public.challenge_game_difficulty,
  gold_coin_pass_reward integer default 0,
  bonus_xp integer default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.challenge_games (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  subtitle text not null,
  description text not null,
  difficulty public.challenge_game_difficulty not null,
  recording_setup jsonb not null default '[]'::jsonb,
  user_instructions jsonb not null default '[]'::jsonb,
  min_clip_seconds integer not null default 5,
  max_clip_seconds integer not null default 30,
  required_mastered_activity_ids jsonb not null default '[]'::jsonb,
  verifier_prompt text not null default '',
  silver_coin_entry_cost integer not null default 0 check (silver_coin_entry_cost >= 0),
  gold_coin_pass_reward integer not null default 0 check (gold_coin_pass_reward >= 0),
  bonus_xp integer not null default 0,
  max_stars integer not null default 3,
  safety_notes jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.game_instances (
  id uuid primary key default gen_random_uuid(),
  game_catalog_id uuid not null references public.game_catalog(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  submission_deadline timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.game_entries (
  id uuid primary key default gen_random_uuid(),
  game_instance_id uuid not null references public.game_instances(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status public.game_entry_status not null default 'entered',
  submission_path text,
  idempotency_key text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.challenge_game_attempts (
  id uuid primary key default gen_random_uuid(),
  challenge_game_id uuid not null references public.challenge_games(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status public.challenge_attempt_status not null default 'started',
  silver_coin_entry_cost integer not null,
  gold_coin_pass_reward integer not null,
  bonus_xp integer not null,
  free_resubmissions_remaining integer not null default 1,
  charged_at timestamptz not null default timezone('utc', now()),
  refunded_at timestamptz,
  rewarded_at timestamptz,
  idempotency_key text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.dog_training_reward_log (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  activity_id text not null,
  source text not null,
  silver_awarded integer not null default 0,
  gold_awarded integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.dog_training_video_submissions (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.challenge_games(id) on delete cascade,
  challenge_attempt_id uuid references public.challenge_game_attempts(id) on delete set null,
  status public.submission_status not null default 'pending',
  submission_hash text not null unique,
  storage_path text,
  verdict text check (verdict in ('PASS', 'FAIL', 'NEEDS_REVIEW')),
  reviewer_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index game_instances_active_window_idx on public.game_instances (is_active, starts_at, ends_at);
create index game_entries_dog_id_idx on public.game_entries (dog_id, created_at desc);
create index challenge_game_attempts_dog_id_idx on public.challenge_game_attempts (dog_id, created_at desc);
create index dog_training_reward_log_dog_activity_idx on public.dog_training_reward_log (dog_id, activity_id, source);
create index dog_training_video_submissions_dog_id_idx on public.dog_training_video_submissions (dog_id, created_at desc);
create index dog_training_video_submissions_status_idx on public.dog_training_video_submissions (status);

alter table public.game_catalog enable row level security;
alter table public.challenge_games enable row level security;
alter table public.game_instances enable row level security;
alter table public.game_entries enable row level security;
alter table public.challenge_game_attempts enable row level security;
alter table public.dog_training_reward_log enable row level security;
alter table public.dog_training_video_submissions enable row level security;

create policy game_catalog_read on public.game_catalog for select using (true);
create policy challenge_games_read on public.challenge_games for select using (true);
create policy game_instances_read on public.game_instances for select using (true);

create policy game_entries_select_own on public.game_entries for select using (owns_dog(dog_id));
create policy challenge_game_attempts_select_own on public.challenge_game_attempts for select using (owns_dog(dog_id));
create policy dog_training_reward_log_select_own on public.dog_training_reward_log for select using (owns_dog(dog_id));

create policy dog_training_video_submissions_select_own on public.dog_training_video_submissions for select using (owns_dog(dog_id));
create policy dog_training_video_submissions_insert_own on public.dog_training_video_submissions for insert with check (owns_dog(dog_id) and user_id = auth.uid());
create policy dog_training_video_submissions_update_own on public.dog_training_video_submissions for update
  using (owns_dog(dog_id))
  with check (owns_dog(dog_id) and verdict is null);

create trigger game_catalog_set_updated_at before update on public.game_catalog for each row execute function set_updated_at();
create trigger challenge_games_set_updated_at before update on public.challenge_games for each row execute function set_updated_at();
create trigger game_instances_set_updated_at before update on public.game_instances for each row execute function set_updated_at();
create trigger game_entries_set_updated_at before update on public.game_entries for each row execute function set_updated_at();
create trigger challenge_game_attempts_set_updated_at before update on public.challenge_game_attempts for each row execute function set_updated_at();
create trigger dog_training_video_submissions_set_updated_at before update on public.dog_training_video_submissions for each row execute function set_updated_at();

create or replace function public.enter_game(
  target_dog_id uuid,
  target_game_instance_id uuid,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_instance game_instances;
  v_catalog game_catalog;
  v_owner_id uuid;
  v_existing game_entries;
  v_entry game_entries;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;

  select * into v_existing from game_entries where idempotency_key = request_key;
  if v_existing.id is not null then
    return jsonb_build_object(
      'entry', to_jsonb(v_existing),
      'wallet', (select jsonb_build_object('silverBalance', silver_balance, 'goldBalance', gold_balance) from get_wallet_summary(target_dog_id))
    );
  end if;

  select * into v_instance from game_instances where id = target_game_instance_id and is_active;
  if v_instance.id is null then raise exception 'Game instance not found or inactive'; end if;
  select * into v_catalog from game_catalog where id = v_instance.game_catalog_id;

  select owner_id into v_owner_id from dogs where id = target_dog_id;

  if v_catalog.silver_entry_cost > 0 then
    perform apply_wallet_transaction(
      target_dog_id, 'silver_coin', -v_catalog.silver_entry_cost,
      'game_entry_fee', request_key || '-wallet',
      'game_instances', target_game_instance_id
    );
  end if;

  begin
    insert into game_entries (game_instance_id, dog_id, owner_id, status, idempotency_key)
    values (target_game_instance_id, target_dog_id, v_owner_id, 'entered', request_key)
    returning * into v_entry;
  exception when unique_violation then
    select * into v_entry from game_entries where idempotency_key = request_key;
  end;

  return jsonb_build_object(
    'entry', to_jsonb(v_entry),
    'wallet', (select jsonb_build_object('silverBalance', silver_balance, 'goldBalance', gold_balance) from get_wallet_summary(target_dog_id))
  );
end;
$$;

revoke execute on function public.enter_game(uuid, uuid, text) from anon;

create or replace function public.start_challenge_game_attempt(
  target_dog_id uuid,
  target_challenge_game_id uuid,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_game challenge_games;
  v_owner_id uuid;
  v_existing challenge_game_attempts;
  v_attempt challenge_game_attempts;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not owns_dog(target_dog_id) then raise exception 'Dog not found'; end if;

  select * into v_existing from challenge_game_attempts where idempotency_key = request_key;
  if v_existing.id is not null then
    return jsonb_build_object(
      'attempt', to_jsonb(v_existing),
      'wallet', (select jsonb_build_object('silverBalance', silver_balance, 'goldBalance', gold_balance) from get_wallet_summary(target_dog_id))
    );
  end if;

  select * into v_game from challenge_games where id = target_challenge_game_id and is_active;
  if v_game.id is null then raise exception 'Challenge game not found or inactive'; end if;

  select owner_id into v_owner_id from dogs where id = target_dog_id;

  if v_game.silver_coin_entry_cost > 0 then
    perform apply_wallet_transaction(
      target_dog_id, 'silver_coin', -v_game.silver_coin_entry_cost,
      'challenge_game_entry_fee', request_key || '-wallet',
      'challenge_games', target_challenge_game_id
    );
  end if;

  begin
    insert into challenge_game_attempts (
      challenge_game_id, dog_id, owner_id, status,
      silver_coin_entry_cost, gold_coin_pass_reward, bonus_xp, idempotency_key
    ) values (
      target_challenge_game_id, target_dog_id, v_owner_id, 'started',
      v_game.silver_coin_entry_cost, v_game.gold_coin_pass_reward, v_game.bonus_xp, request_key
    )
    returning * into v_attempt;
  exception when unique_violation then
    select * into v_attempt from challenge_game_attempts where idempotency_key = request_key;
  end;

  return jsonb_build_object(
    'attempt', to_jsonb(v_attempt),
    'wallet', (select jsonb_build_object('silverBalance', silver_balance, 'goldBalance', gold_balance) from get_wallet_summary(target_dog_id))
  );
end;
$$;

revoke execute on function public.start_challenge_game_attempt(uuid, uuid, text) from anon;

create or replace function public.approve_challenge_submission(
  target_submission_id uuid,
  verdict_value text,
  reviewer_note_value text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_submission dog_training_video_submissions;
  v_attempt challenge_game_attempts;
begin
  if verdict_value not in ('PASS', 'FAIL', 'NEEDS_REVIEW') then
    raise exception 'invalid_verdict';
  end if;

  select * into v_submission from dog_training_video_submissions where id = target_submission_id;
  if v_submission.id is null then raise exception 'Submission not found'; end if;

  update dog_training_video_submissions
    set status = case verdict_value when 'PASS' then 'passed' when 'FAIL' then 'failed' else 'under_review' end,
        verdict = verdict_value,
        reviewer_note = reviewer_note_value
    where id = target_submission_id;

  if v_submission.challenge_attempt_id is not null then
    select * into v_attempt from challenge_game_attempts where id = v_submission.challenge_attempt_id;

    update challenge_game_attempts
      set status = case verdict_value when 'PASS' then 'passed' when 'FAIL' then 'failed' else 'needs_review' end,
          rewarded_at = case when verdict_value = 'PASS' then timezone('utc', now()) else rewarded_at end
      where id = v_submission.challenge_attempt_id;

    if verdict_value = 'PASS' and v_attempt.gold_coin_pass_reward > 0 then
      perform apply_wallet_transaction(
        v_attempt.dog_id, 'gold_coin', v_attempt.gold_coin_pass_reward,
        'challenge_game_passed', 'approve-' || target_submission_id::text,
        'challenge_game_attempts', v_attempt.id
      );
      insert into dog_training_reward_log (dog_id, owner_id, activity_id, source, gold_awarded)
      values (v_attempt.dog_id, v_attempt.owner_id, v_attempt.challenge_game_id::text, 'activity_pass', v_attempt.gold_coin_pass_reward);
    end if;
  end if;

  return jsonb_build_object('submissionId', target_submission_id, 'verdict', verdict_value);
end;
$$;

revoke all on function public.approve_challenge_submission(uuid, text, text) from anon, authenticated;
