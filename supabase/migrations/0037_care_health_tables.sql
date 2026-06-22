create table if not exists dog_care_profile (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null unique references dogs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  daily_exercise_goal_minutes integer not null default 60,
  meals_per_day integer not null default 2,
  portion_grams_per_meal integer,
  food_brand text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table dog_care_profile enable row level security;
create policy "owners manage care profile" on dog_care_profile
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists dog_vaccinations (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  vaccine_key text not null,
  vaccine_name text not null,
  date_given date not null,
  next_due_date date,
  vet_name text,
  notes text,
  created_at timestamptz not null default now()
);
alter table dog_vaccinations enable row level security;
create policy "owners manage vaccinations" on dog_vaccinations
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists dog_medications (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  medication_name text not null,
  dosage text,
  frequency text not null default 'daily',
  start_date date not null,
  end_date date,
  reminder_time text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
alter table dog_medications enable row level security;
create policy "owners manage medications" on dog_medications
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists dog_medication_logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references dog_medications(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  given_date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);
alter table dog_medication_logs enable row level security;
create policy "owners manage medication logs" on dog_medication_logs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists dog_exercise_logs (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  activity_type text not null default 'walk',
  duration_minutes integer not null,
  distance_miles numeric(5,2),
  notes text,
  created_at timestamptz not null default now()
);
alter table dog_exercise_logs enable row level security;
create policy "owners manage exercise logs" on dog_exercise_logs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table if not exists dog_grooming_logs (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  grooming_type text not null,
  done_date date not null default current_date,
  next_due_date date,
  notes text,
  created_at timestamptz not null default now()
);
alter table dog_grooming_logs enable row level security;
create policy "owners manage grooming logs" on dog_grooming_logs
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
