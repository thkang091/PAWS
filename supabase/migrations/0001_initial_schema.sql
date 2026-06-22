create extension if not exists pgcrypto;

create type currency_type as enum ('silver', 'gold');
create type dog_gender as enum ('male', 'female', 'unknown');
create type obedience_level as enum ('beginner', 'basic', 'intermediate', 'advanced');
create type energy_level as enum ('low', 'moderate', 'high', 'very_high');
create type quest_status as enum ('active', 'completed', 'expired');
create type care_event_type as enum ('walk', 'vet', 'grooming', 'medication', 'training', 'playtime', 'custom');
create type game_entry_status as enum ('entered', 'awaiting_submission', 'submitted', 'under_review', 'completed', 'rejected');
create type redemption_status as enum ('requested', 'processing', 'fulfilled', 'rejected');
create type plan_type as enum ('free', 'monthly', 'yearly');
create type training_category as enum ('basics', 'obedience', 'fun_tricks', 'outdoor_skills', 'social_skills');

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

create table training_skills (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category training_category not null,
  difficulty integer not null check (difficulty between 1 and 3),
  estimated_minutes integer not null check (estimated_minutes > 0),
  description text not null,
  instructions jsonb not null check (jsonb_typeof(instructions) = 'array'),
  silver_reward integer not null check (silver_reward >= 0),
  bond_xp_reward integer not null check (bond_xp_reward >= 0),
  focus_delta integer not null default 0,
  discipline_delta integer not null default 0,
  social_delta integer not null default 0,
  energy_delta integer not null default 0,
  intelligence_delta integer not null default 0,
  is_active boolean not null default true,
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

create table dog_goals (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  goal_key text not null check (goal_key in ('better_bonding', 'better_training', 'more_consistency', 'daily_memories', 'more_outdoor_time', 'better_socialization')),
  created_at timestamptz not null default timezone('utc', now()),
  unique(dog_id, goal_key)
);

create table dog_existing_skills (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  skill_id uuid not null references training_skills(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique(dog_id, skill_id)
);

create table dog_target_skills (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  skill_id uuid not null references training_skills(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique(dog_id, skill_id)
);

create table dog_behavioral_concerns (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  concern_key text not null check (concern_key in ('pulling_on_leash', 'barking', 'separation_anxiety', 'jumping_on_people', 'reactivity_around_dogs', 'recall_difficulty', 'potty_training', 'chewing', 'fearfulness', 'other')),
  custom_note text,
  created_at timestamptz not null default timezone('utc', now()),
  unique(dog_id, concern_key)
);

create table dog_training_progress (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  skill_id uuid not null references training_skills(id) on delete cascade,
  sessions_completed integer not null default 0 check (sessions_completed >= 0),
  completion_percentage integer not null default 0 check (completion_percentage between 0 and 100),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(dog_id, skill_id)
);

create table training_sessions (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  skill_id uuid not null references training_skills(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  idempotency_key text unique not null,
  completed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table quest_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text not null,
  quest_type text not null,
  silver_reward integer not null check (silver_reward >= 0),
  bond_xp_reward integer not null check (bond_xp_reward >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table daily_quests (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  template_id uuid not null references quest_templates(id) on delete cascade,
  quest_date date not null,
  status quest_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(dog_id, template_id, quest_date)
);

create table quest_completions (
  id uuid primary key default gen_random_uuid(),
  daily_quest_id uuid unique not null references daily_quests(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  idempotency_key text unique not null,
  completed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  currency currency_type not null,
  amount integer not null,
  reason text not null,
  source_entity_type text,
  source_entity_id uuid,
  idempotency_key text unique not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table bond_xp_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  amount integer not null check (amount >= 0),
  reason text not null,
  source_entity_type text,
  source_entity_id uuid,
  idempotency_key text unique not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table dog_status (
  dog_id uuid primary key references dogs(id) on delete cascade,
  focus integer not null default 0 check (focus between 0 and 100),
  discipline integer not null default 0 check (discipline between 0 and 100),
  social integer not null default 0 check (social between 0 and 100),
  energy integer not null default 0 check (energy between 0 and 100),
  intelligence integer not null default 0 check (intelligence between 0 and 100),
  updated_at timestamptz not null default timezone('utc', now())
);

create table dog_moments (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  storage_path text not null,
  caption text,
  moment_date date not null,
  reward_claimed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(dog_id, moment_date)
);

create table care_events (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  event_type care_event_type not null,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  plan_type plan_type unique not null,
  name text not null,
  description text not null,
  price_display text,
  is_paid boolean not null default false,
  is_active boolean not null default true,
  features jsonb not null check (jsonb_typeof(features) = 'array'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table user_plan_selections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  plan_id uuid not null references subscription_plans(id),
  selected_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  unique(owner_id)
);

create table game_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  silver_entry_cost integer not null check (silver_entry_cost >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table game_instances (
  id uuid primary key default gen_random_uuid(),
  game_catalog_id uuid not null references game_catalog(id),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  submission_deadline timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table game_entries (
  id uuid primary key default gen_random_uuid(),
  game_instance_id uuid not null references game_instances(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  status game_entry_status not null default 'entered',
  submission_path text,
  idempotency_key text unique not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(game_instance_id, dog_id)
);

create table game_results (
  id uuid primary key default gen_random_uuid(),
  game_entry_id uuid unique not null references game_entries(id) on delete cascade,
  placement integer,
  gold_awarded integer not null default 0 check (gold_awarded >= 0),
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table reward_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  gold_cost integer not null check (gold_cost >= 0),
  is_active boolean not null default false,
  fulfillment_type text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references reward_catalog(id),
  owner_id uuid not null references profiles(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  status redemption_status not null default 'requested',
  idempotency_key text unique not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table avatar_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  silver_cost integer not null check (silver_cost >= 0),
  asset_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table user_avatar_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  avatar_item_id uuid not null references avatar_catalog(id),
  acquired_at timestamptz not null default timezone('utc', now()),
  unique(dog_id, avatar_item_id)
);

create trigger profiles_set_updated_at before update on profiles for each row execute function set_updated_at();
create trigger training_skills_set_updated_at before update on training_skills for each row execute function set_updated_at();
create trigger dogs_set_updated_at before update on dogs for each row execute function set_updated_at();
create trigger dog_training_progress_set_updated_at before update on dog_training_progress for each row execute function set_updated_at();
create trigger quest_templates_set_updated_at before update on quest_templates for each row execute function set_updated_at();
create trigger daily_quests_set_updated_at before update on daily_quests for each row execute function set_updated_at();
create trigger dog_moments_set_updated_at before update on dog_moments for each row execute function set_updated_at();
create trigger care_events_set_updated_at before update on care_events for each row execute function set_updated_at();
create trigger subscription_plans_set_updated_at before update on subscription_plans for each row execute function set_updated_at();
create trigger game_catalog_set_updated_at before update on game_catalog for each row execute function set_updated_at();
create trigger game_instances_set_updated_at before update on game_instances for each row execute function set_updated_at();
create trigger game_entries_set_updated_at before update on game_entries for each row execute function set_updated_at();
create trigger game_results_set_updated_at before update on game_results for each row execute function set_updated_at();
create trigger reward_catalog_set_updated_at before update on reward_catalog for each row execute function set_updated_at();
create trigger reward_redemptions_set_updated_at before update on reward_redemptions for each row execute function set_updated_at();
create trigger avatar_catalog_set_updated_at before update on avatar_catalog for each row execute function set_updated_at();
