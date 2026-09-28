create type public.care_event_type as enum ('walk', 'vet', 'grooming', 'medication', 'training', 'playtime', 'custom');

create table public.dog_care_profile (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null unique references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  daily_exercise_goal_minutes integer not null default 60,
  meals_per_day integer not null default 2,
  portion_grams_per_meal integer,
  food_brand text,
  treats_per_day integer not null default 4,
  water_refills_target integer not null default 2,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.dog_vaccinations (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  vaccine_key text not null,
  vaccine_name text not null,
  date_given date not null,
  next_due_date date,
  vet_name text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.dog_medications (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  medication_name text not null,
  dosage text,
  frequency text not null,
  start_date date not null,
  end_date date,
  reminder_time text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.dog_medication_logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.dog_medications(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  given_date date not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.dog_exercise_logs (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  activity_type text not null,
  duration_minutes integer not null,
  distance_miles numeric,
  walk_count integer,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.dog_grooming_logs (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  grooming_type text not null,
  done_date date not null,
  next_due_date date,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.dog_weight_logs (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  weight_value numeric not null,
  weight_unit text not null check (weight_unit in ('lb', 'kg')),
  recorded_at timestamptz not null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.dog_feeding_logs (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  log_type text not null check (log_type in ('meal', 'treat', 'water')),
  log_date date not null default (timezone('utc', now())::date),
  meal_name text,
  amount_grams integer,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.care_events (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  event_type public.care_event_type not null,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  duration_minutes integer,
  note text,
  attachment_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.dog_care_routines (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  routine_key text not null,
  title text not null,
  description text not null,
  icon_key text not null,
  silver_reward integer not null default 5 check (silver_reward between 0 and 100),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  reminder_time text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (dog_id, routine_key)
);

create table public.dog_care_routine_completions (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.dog_care_routines(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  completion_date date not null,
  silver_awarded integer not null default 0,
  idempotency_key text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  unique (routine_id, completion_date)
);

create index dog_vaccinations_dog_id_idx on public.dog_vaccinations (dog_id, date_given desc);
create index dog_medications_dog_id_active_idx on public.dog_medications (dog_id, is_active);
create index dog_medication_logs_dog_date_idx on public.dog_medication_logs (dog_id, given_date);
create index dog_exercise_logs_dog_date_idx on public.dog_exercise_logs (dog_id, log_date);
create index dog_grooming_logs_dog_id_idx on public.dog_grooming_logs (dog_id, done_date desc);
create index dog_weight_logs_dog_id_idx on public.dog_weight_logs (dog_id, recorded_at desc);
create index dog_feeding_logs_dog_date_idx on public.dog_feeding_logs (dog_id, log_date, log_type);
create index care_events_dog_id_idx on public.care_events (dog_id, start_time);
create index dog_care_routines_dog_id_idx on public.dog_care_routines (dog_id, is_active, sort_order);
create index dog_care_routine_completions_dog_date_idx on public.dog_care_routine_completions (dog_id, completion_date);

alter table public.dog_care_profile enable row level security;
alter table public.dog_vaccinations enable row level security;
alter table public.dog_medications enable row level security;
alter table public.dog_medication_logs enable row level security;
alter table public.dog_exercise_logs enable row level security;
alter table public.dog_grooming_logs enable row level security;
alter table public.dog_weight_logs enable row level security;
alter table public.dog_feeding_logs enable row level security;
alter table public.care_events enable row level security;
alter table public.dog_care_routines enable row level security;
alter table public.dog_care_routine_completions enable row level security;

create policy dog_care_profile_select_own on public.dog_care_profile for select using (owns_dog(dog_id));
create policy dog_care_profile_insert_own on public.dog_care_profile for insert with check (owns_dog(dog_id));
create policy dog_care_profile_update_own on public.dog_care_profile for update using (owns_dog(dog_id));

create policy dog_vaccinations_select_own on public.dog_vaccinations for select using (owns_dog(dog_id));
create policy dog_vaccinations_insert_own on public.dog_vaccinations for insert with check (owns_dog(dog_id));
create policy dog_vaccinations_delete_own on public.dog_vaccinations for delete using (owns_dog(dog_id));

create policy dog_medications_select_own on public.dog_medications for select using (owns_dog(dog_id));
create policy dog_medications_insert_own on public.dog_medications for insert with check (owns_dog(dog_id));
create policy dog_medications_update_own on public.dog_medications for update using (owns_dog(dog_id));

create policy dog_medication_logs_select_own on public.dog_medication_logs for select using (owns_dog(dog_id));
create policy dog_medication_logs_insert_own on public.dog_medication_logs for insert with check (owns_dog(dog_id));

create policy dog_exercise_logs_select_own on public.dog_exercise_logs for select using (owns_dog(dog_id));
create policy dog_exercise_logs_insert_own on public.dog_exercise_logs for insert with check (owns_dog(dog_id));

create policy dog_grooming_logs_select_own on public.dog_grooming_logs for select using (owns_dog(dog_id));
create policy dog_grooming_logs_insert_own on public.dog_grooming_logs for insert with check (owns_dog(dog_id));

create policy dog_weight_logs_select_own on public.dog_weight_logs for select using (owns_dog(dog_id));
create policy dog_weight_logs_insert_own on public.dog_weight_logs for insert with check (owns_dog(dog_id));

create policy dog_feeding_logs_select_own on public.dog_feeding_logs for select using (owns_dog(dog_id));
create policy dog_feeding_logs_insert_own on public.dog_feeding_logs for insert with check (owns_dog(dog_id));

create policy care_events_select_own on public.care_events for select using (owns_dog(dog_id));
create policy care_events_insert_own on public.care_events for insert with check (owns_dog(dog_id));
create policy care_events_update_own on public.care_events for update using (owns_dog(dog_id));
create policy care_events_delete_own on public.care_events for delete using (owns_dog(dog_id));

create policy dog_care_routines_select_own on public.dog_care_routines for select using (owns_dog(dog_id));
create policy dog_care_routines_insert_own on public.dog_care_routines for insert with check (owns_dog(dog_id));
create policy dog_care_routines_update_own on public.dog_care_routines for update using (owns_dog(dog_id));

create policy dog_care_routine_completions_select_own on public.dog_care_routine_completions for select using (owns_dog(dog_id));

create trigger dog_care_profile_set_updated_at before update on public.dog_care_profile
  for each row execute function set_updated_at();
create trigger care_events_set_updated_at before update on public.care_events
  for each row execute function set_updated_at();
create trigger dog_care_routines_set_updated_at before update on public.dog_care_routines
  for each row execute function set_updated_at();

create or replace function public.complete_dog_care_routine(
  target_routine_id uuid,
  completion_date_value date,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_routine dog_care_routines;
  v_owner_id uuid;
  v_existing dog_care_routine_completions;
  v_completion dog_care_routine_completions;
  v_txn wallet_transactions;
begin
  select * into v_routine from dog_care_routines where id = target_routine_id;
  if v_routine.id is null or not owns_dog(v_routine.dog_id) then
    raise exception 'Routine not found';
  end if;

  select owner_id into v_owner_id from dogs where id = v_routine.dog_id;

  select * into v_existing from dog_care_routine_completions
    where routine_id = target_routine_id and completion_date = completion_date_value;
  if v_existing.id is not null then
    return jsonb_build_object('completion', to_jsonb(v_existing), 'silver_earned', 0, 'already_completed', true);
  end if;

  begin
    insert into dog_care_routine_completions (routine_id, dog_id, owner_id, completion_date, silver_awarded, idempotency_key)
    values (target_routine_id, v_routine.dog_id, v_owner_id, completion_date_value, v_routine.silver_reward, request_key)
    returning * into v_completion;
  exception when unique_violation then
    select * into v_completion from dog_care_routine_completions where idempotency_key = request_key;
    if v_completion.id is not null then
      return jsonb_build_object('completion', to_jsonb(v_completion), 'silver_earned', 0, 'already_completed', true);
    end if;
    select * into v_completion from dog_care_routine_completions
      where routine_id = target_routine_id and completion_date = completion_date_value;
    return jsonb_build_object('completion', to_jsonb(v_completion), 'silver_earned', 0, 'already_completed', true);
  end;

  v_txn := apply_wallet_transaction(
    v_routine.dog_id, 'silver_coin', v_routine.silver_reward,
    'care_routine_completed', request_key || '-wallet',
    'dog_care_routine_completions', v_completion.id
  );

  return jsonb_build_object('completion', to_jsonb(v_completion), 'silver_earned', v_routine.silver_reward, 'already_completed', false);
end;
$$;

revoke execute on function public.complete_dog_care_routine(uuid, date, text) from anon;
