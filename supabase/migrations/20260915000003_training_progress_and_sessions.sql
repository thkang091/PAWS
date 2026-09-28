create table dog_training_skill_progress (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  skill_id uuid not null references training_skills(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  current_level_number integer not null default 1 check (current_level_number between 1 and 5),
  checkpoint_status text not null default 'not_eligible' check (checkpoint_status in ('not_eligible', 'eligible', 'passed', 'needs_review')),
  latest_result text check (latest_result in ('success', 'not_yet')),
  review_soon boolean not null default false,
  level5_completed_at timestamptz,
  checkpoint_retry_not_before date,
  last_practiced_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (dog_id, skill_id)
);

create index dog_training_skill_progress_dog_id_idx on dog_training_skill_progress(dog_id);

create table dog_training_level_progress (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  level_id uuid not null references training_levels(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  latest_result text check (latest_result in ('success', 'not_yet')),
  successful_at timestamptz,
  attempt_count integer not null default 0,
  last_practiced_at timestamptz,
  review_soon boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (dog_id, level_id)
);

create index dog_training_level_progress_dog_id_idx on dog_training_level_progress(dog_id);

create table training_sessions (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  skill_id uuid not null references training_skills(id) on delete cascade,
  level_id uuid not null references training_levels(id) on delete cascade,
  session_type text not null default 'normal' check (session_type in ('normal', 'review', 'bridge', 'checkpoint')),
  lesson_contract_version text not null default 'button-flow-v1.1',
  status text not null default 'active' check (status in ('active', 'completed', 'ended')),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  ended_at timestamptz,
  energy_consumed boolean not null default false,
  retry_used boolean not null default false,
  final_result text check (final_result in ('success', 'not_yet', 'ended')),
  safety_disposition text,
  current_card_key text,
  effective_local_day date not null,
  idempotency_key text unique not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index training_sessions_dog_id_idx on training_sessions(dog_id);
create index training_sessions_dog_skill_active_idx on training_sessions(dog_id, skill_id) where status = 'active';

create table training_attempt_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references training_sessions(id) on delete cascade,
  level_id uuid not null references training_levels(id) on delete cascade,
  card_id uuid references training_lesson_cards(id) on delete set null,
  attempt_number integer not null,
  is_additional_practice boolean not null default false,
  adaptive_guidance_id uuid references training_adaptive_guidance(id) on delete set null,
  result text not null check (result in ('success', 'not_yet', 'uncertain')),
  original_criterion_met boolean not null default false,
  reported_at timestamptz not null default timezone('utc', now())
);

create index training_attempt_reports_session_id_idx on training_attempt_reports(session_id);

create table training_review_assignments (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  skill_id uuid not null references training_skills(id) on delete cascade,
  level_id uuid not null references training_levels(id) on delete cascade,
  review_type text not null check (review_type in ('easier_review', 'bridge', 'targeted_level_review', 'maintenance_review')),
  source_session_id uuid references training_sessions(id) on delete set null,
  due_at timestamptz,
  eligible_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'active', 'completed', 'cancelled')),
  reason text,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create index training_review_assignments_dog_id_idx on training_review_assignments(dog_id) where status in ('pending', 'active');

create table training_energy_ledger (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references dogs(id) on delete cascade,
  effective_local_day date not null,
  delta integer not null,
  reason text not null,
  session_id uuid references training_sessions(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index training_energy_ledger_dog_day_idx on training_energy_ledger(dog_id, effective_local_day);

create trigger dog_training_skill_progress_set_updated_at before update on dog_training_skill_progress for each row execute function set_updated_at();
create trigger dog_training_level_progress_set_updated_at before update on dog_training_level_progress for each row execute function set_updated_at();
create trigger training_sessions_set_updated_at before update on training_sessions for each row execute function set_updated_at();

alter table dog_training_skill_progress enable row level security;
alter table dog_training_level_progress enable row level security;
alter table training_sessions enable row level security;
alter table training_attempt_reports enable row level security;
alter table training_review_assignments enable row level security;
alter table training_energy_ledger enable row level security;

create policy skill_progress_select_own on dog_training_skill_progress for select using (owns_dog(dog_id));
create policy level_progress_select_own on dog_training_level_progress for select using (owns_dog(dog_id));
create policy sessions_select_own on training_sessions for select using (owns_dog(dog_id));
create policy attempt_reports_select_own on training_attempt_reports for select using (
  exists (select 1 from training_sessions s where s.id = session_id and owns_dog(s.dog_id))
);
create policy review_assignments_select_own on training_review_assignments for select using (owns_dog(dog_id));
create policy energy_ledger_select_own on training_energy_ledger for select using (owns_dog(dog_id));
