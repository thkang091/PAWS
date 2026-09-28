create extension if not exists pgcrypto;

create type dog_gender as enum ('male', 'female', 'unknown');
create type obedience_level as enum ('beginner', 'basic', 'intermediate', 'advanced');
create type energy_level as enum ('low', 'moderate', 'high', 'very_high');

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  onboarding_completed boolean not null default false,
  tutorial_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table dogs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  gender dog_gender not null,
  birthday date,
  age_years numeric,
  breed text not null,
  owned_since date,
  adoption_date date,
  obedience_level obedience_level not null,
  energy_level energy_level not null,
  dog_tag text unique not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (birthday is not null or age_years is not null)
);

create index dogs_owner_id_idx on dogs(owner_id);

create table dog_selected_training_goals (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  goal text not null,
  priority_rank integer not null check (priority_rank between 1 and 6),
  created_at timestamptz not null default timezone('utc', now()),
  unique (dog_id, goal)
);

create table dog_training_pain_points (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  goal text not null,
  pain_point_key text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (dog_id, goal, pain_point_key)
);

create table dog_training_preferences (
  dog_id uuid primary key references dogs(id) on delete cascade,
  preferred_section_id uuid, -- fk added in the curriculum-content migration
  training_experience text,
  daily_minutes integer,
  delivery_style text,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function owns_dog(target_dog_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from dogs where id = target_dog_id and owner_id = auth.uid());
$$;

create or replace function generate_dog_tag()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := 'PAWS-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
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
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if dog_birthday is null and dog_age_years is null then raise exception 'Birthday or approximate age is required'; end if;
  if exists(select 1 from dogs where owner_id = auth.uid()) then raise exception 'A dog profile already exists for this MVP account'; end if;

  insert into profiles(id) values (auth.uid()) on conflict (id) do nothing;

  insert into dogs(owner_id, name, gender, birthday, age_years, breed, owned_since, adoption_date, obedience_level, energy_level, dog_tag)
  values (auth.uid(), trim(dog_name), dog_gender_value, dog_birthday, dog_age_years, trim(dog_breed), dog_owned_since, dog_adoption_date, dog_obedience_level, dog_energy_level, generate_dog_tag())
  returning * into dog_result;

  update profiles set onboarding_completed = true where id = auth.uid();

  return dog_result;
end;
$$;

create trigger profiles_set_updated_at before update on profiles for each row execute function set_updated_at();
create trigger dogs_set_updated_at before update on dogs for each row execute function set_updated_at();
create trigger dog_training_preferences_set_updated_at before update on dog_training_preferences for each row execute function set_updated_at();

alter table profiles enable row level security;
alter table dogs enable row level security;
alter table dog_selected_training_goals enable row level security;
alter table dog_training_pain_points enable row level security;
alter table dog_training_preferences enable row level security;

create policy profiles_select_own on profiles for select using (id = auth.uid());
create policy profiles_update_own on profiles for update using (id = auth.uid());

create policy dogs_select_own on dogs for select using (owner_id = auth.uid());
create policy dogs_update_own on dogs for update using (owner_id = auth.uid());

create policy dog_goals_select_own on dog_selected_training_goals for select using (owns_dog(dog_id));
create policy dog_goals_write_own on dog_selected_training_goals for insert with check (owns_dog(dog_id));
create policy dog_goals_delete_own on dog_selected_training_goals for delete using (owns_dog(dog_id));

create policy dog_pain_points_select_own on dog_training_pain_points for select using (owns_dog(dog_id));
create policy dog_pain_points_write_own on dog_training_pain_points for insert with check (owns_dog(dog_id));
create policy dog_pain_points_delete_own on dog_training_pain_points for delete using (owns_dog(dog_id));

create policy dog_training_prefs_select_own on dog_training_preferences for select using (owns_dog(dog_id));
create policy dog_training_prefs_write_own on dog_training_preferences for insert with check (owns_dog(dog_id));
create policy dog_training_prefs_update_own on dog_training_preferences for update using (owns_dog(dog_id));
