create table public.dog_goals (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  goal_key text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (dog_id, goal_key)
);

create table public.dog_existing_skills (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  skill_id uuid not null references public.training_skills(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (dog_id, skill_id)
);

create table public.dog_target_skills (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  skill_id uuid not null references public.training_skills(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (dog_id, skill_id)
);

create table public.dog_behavioral_concerns (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  concern_key text not null,
  custom_note text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (dog_id, concern_key)
);

create index dog_goals_dog_id_idx on public.dog_goals (dog_id);
create index dog_existing_skills_dog_id_idx on public.dog_existing_skills (dog_id);
create index dog_target_skills_dog_id_idx on public.dog_target_skills (dog_id);
create index dog_behavioral_concerns_dog_id_idx on public.dog_behavioral_concerns (dog_id);

alter table public.dog_goals enable row level security;
alter table public.dog_existing_skills enable row level security;
alter table public.dog_target_skills enable row level security;
alter table public.dog_behavioral_concerns enable row level security;

create policy dog_goals_select_own on public.dog_goals for select using (owns_dog(dog_id));
create policy dog_goals_insert_own on public.dog_goals for insert with check (owns_dog(dog_id));
create policy dog_goals_delete_own on public.dog_goals for delete using (owns_dog(dog_id));

create policy dog_existing_skills_select_own on public.dog_existing_skills for select using (owns_dog(dog_id));
create policy dog_existing_skills_insert_own on public.dog_existing_skills for insert with check (owns_dog(dog_id));
create policy dog_existing_skills_delete_own on public.dog_existing_skills for delete using (owns_dog(dog_id));

create policy dog_target_skills_select_own on public.dog_target_skills for select using (owns_dog(dog_id));
create policy dog_target_skills_insert_own on public.dog_target_skills for insert with check (owns_dog(dog_id));
create policy dog_target_skills_delete_own on public.dog_target_skills for delete using (owns_dog(dog_id));

create policy dog_behavioral_concerns_select_own on public.dog_behavioral_concerns for select using (owns_dog(dog_id));
create policy dog_behavioral_concerns_insert_own on public.dog_behavioral_concerns for insert with check (owns_dog(dog_id));
create policy dog_behavioral_concerns_delete_own on public.dog_behavioral_concerns for delete using (owns_dog(dog_id));

create or replace function public.get_profile_dashboard(target_dog_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_dog dogs;
  v_wallet record;
  v_completed_skills integer;
  v_active_skills integer;
  v_routine_completions integer;
  v_exercise_days_7d integer;
  v_activities_passed integer;
  v_bond_xp integer;
  v_streak integer;
begin
  if not owns_dog(target_dog_id) then
    raise exception 'Dog not found';
  end if;

  select * into v_dog from dogs where id = target_dog_id;
  select silver_balance, gold_balance into v_wallet from get_wallet_summary(target_dog_id);

  select count(*) into v_completed_skills from dog_training_skill_progress
    where dog_id = target_dog_id and status = 'completed';
  select count(*) into v_active_skills from dog_training_skill_progress
    where dog_id = target_dog_id and status = 'in_progress';
  select count(*) into v_routine_completions from dog_care_routine_completions
    where dog_id = target_dog_id;
  select count(distinct log_date) into v_exercise_days_7d from dog_exercise_logs
    where dog_id = target_dog_id and log_date >= current_date - interval '6 days';
  select count(*) into v_activities_passed from dog_training_reward_log
    where dog_id = target_dog_id and source = 'activity_pass';

  v_bond_xp := coalesce(v_routine_completions, 0) * 5
    + (select count(*) from dog_training_level_progress where dog_id = target_dog_id and status = 'completed') * 10;

  declare
    v_cursor date := current_date;
    v_has_today boolean;
  begin
    select exists(
      select 1 from dog_care_routine_completions where dog_id = target_dog_id and completion_date = current_date
      union
      select 1 from training_sessions where dog_id = target_dog_id and status = 'completed' and effective_local_day = current_date
    ) into v_has_today;

    if not v_has_today then
      v_cursor := current_date - 1;
    end if;

    v_streak := 0;
    loop
      exit when not exists(
        select 1 from dog_care_routine_completions where dog_id = target_dog_id and completion_date = v_cursor
        union
        select 1 from training_sessions where dog_id = target_dog_id and status = 'completed' and effective_local_day = v_cursor
      );
      v_streak := v_streak + 1;
      v_cursor := v_cursor - 1;
      exit when v_streak >= 365;
    end loop;
  end;

  return jsonb_build_object(
    'dog', to_jsonb(v_dog),
    'wallet', jsonb_build_object('silverBalance', coalesce(v_wallet.silver_balance, 0), 'goldBalance', coalesce(v_wallet.gold_balance, 0)),
    'bondXp', v_bond_xp,
    'level', greatest(1, (v_bond_xp / 100) + 1),
    'status', jsonb_build_object(
      'focus', least(100, v_active_skills * 10),
      'discipline', least(100, v_completed_skills * 10),
      'social', least(100, v_routine_completions * 5),
      'energy', least(100, v_exercise_days_7d * 15),
      'intelligence', least(100, v_activities_passed * 20)
    ),
    'streak', v_streak,
    'trainingSummary', jsonb_build_object('completedSkills', v_completed_skills, 'activeSkills', v_active_skills)
  );
end;
$$;

revoke execute on function public.get_profile_dashboard(uuid) from anon;
