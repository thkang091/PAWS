create table training_curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  version_key text unique not null,
  title text not null,
  status text not null default 'candidate' check (status in ('candidate', 'published')),
  effective_date date,
  created_at timestamptz not null default timezone('utc', now())
);

create table training_sections (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references training_curriculum_versions(id) on delete cascade,
  section_number integer not null,
  slug text not null,
  title text not null,
  description text,
  source_to_product_adaptation text,
  safety_boundary text,
  sort_order integer not null,
  unique (curriculum_version_id, section_number),
  unique (curriculum_version_id, slug)
);

create table training_skills (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references training_sections(id) on delete cascade,
  skill_code text not null,
  internal_concept_id text not null,
  slug text not null,
  title text not null,
  source_label_ko text,
  one_line_goal text not null,
  product_status text,
  shared_skill_bridge_relation text,
  skill_promise text,
  boundaries jsonb not null default '[]'::jsonb check (jsonb_typeof(boundaries) = 'array'),
  authoring_state text,
  sort_order integer not null,
  unique (section_id, skill_code),
  unique (section_id, internal_concept_id)
);

create index training_skills_section_id_idx on training_skills(section_id);

create table training_levels (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references training_skills(id) on delete cascade,
  stage_type text not null check (stage_type in ('level', 'checkpoint')),
  level_number integer check (level_number between 1 and 5),
  sequence_index integer not null,
  title text not null,
  goal text,
  observable_criterion text,
  first_part text,
  next_part text,
  easier_path text,
  success_anchor text,
  entry_rule text,
  implementation_status text,
  additional_practice_allowed boolean not null default true,
  check ((stage_type = 'level' and level_number is not null) or (stage_type = 'checkpoint' and level_number is null)),
  unique (skill_id, stage_type, level_number)
);

create index training_levels_skill_id_idx on training_levels(skill_id);

create table training_media_bindings (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references training_levels(id) on delete cascade,
  demo_id text not null,
  media_url text,
  poster_url text,
  status text not null default 'not_produced',
  production_notes text,
  fallback_text text,
  unique (level_id)
);

create table training_media_scenes (
  id uuid primary key default gen_random_uuid(),
  media_binding_id uuid not null references training_media_bindings(id) on delete cascade,
  source_scene_id text not null,
  purpose text not null,
  required_sequence_beat text,
  acceptance_focus text,
  sort_order integer not null,
  unique (media_binding_id, source_scene_id)
);

create table training_ready_cards (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references training_levels(id) on delete cascade,
  materials jsonb not null default '[]'::jsonb check (jsonb_typeof(materials) = 'array'),
  safety_copy text not null,
  primary_action text not null default 'Continue',
  secondary_action text not null default 'End lesson',
  unique (level_id)
);

create table training_lesson_cards (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references training_levels(id) on delete cascade,
  card_key text not null,
  card_type text not null check (card_type in ('orient', 'demo', 'guardian', 'additional_practice', 'completion')),
  sort_order integer not null,
  title text,
  body text,
  key_action text,
  try_it text,
  harder_part text,
  finish_instruction text,
  success_copy text,
  not_yet_copy text,
  uncertainty_instruction text,
  buttons jsonb not null default '[]'::jsonb check (jsonb_typeof(buttons) = 'array'),
  media_binding_id uuid references training_media_bindings(id) on delete set null,
  exact_copy_available boolean not null default true,
  lesson_contract_version text not null default 'button-flow-v1.1',
  unique (level_id, card_key)
);

create index training_lesson_cards_level_id_idx on training_lesson_cards(level_id);

create table training_adaptive_guidance (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references training_levels(id) on delete cascade,
  observation text not null,
  observation_stage text,
  guidance_title text not null,
  guidance_text text not null,
  routing_instruction text,
  sort_order integer not null
);

create index training_adaptive_guidance_level_id_idx on training_adaptive_guidance(level_id);

create table training_checkpoint_policies (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references training_skills(id) on delete cascade,
  checkpoint_level_id uuid not null references training_levels(id) on delete cascade,
  entry_rule text not null,
  guardian_instruction text not null,
  success_copy text not null,
  not_yet_copy text not null,
  success_next_state text not null,
  not_yet_next_state text not null,
  no_immediate_retest boolean not null default true,
  maintenance_review_behavior text,
  unique (skill_id)
);

create table training_skill_relationships (
  id uuid primary key default gen_random_uuid(),
  from_skill_id uuid not null references training_skills(id) on delete cascade,
  to_skill_id uuid references training_skills(id) on delete cascade,
  relationship_type text not null check (relationship_type in ('bridge', 'shared_foundation', 'related', 'advanced_context')),
  rule_text text not null,
  hard_prerequisite boolean not null default false
);

create index training_skill_relationships_from_idx on training_skill_relationships(from_skill_id);

create table training_game_mappings (
  id uuid primary key default gen_random_uuid(),
  skill_id uuid not null references training_skills(id) on delete cascade,
  status text not null,
  is_mapped_candidate boolean not null default false,
  challenge_title text,
  bounded_criterion text,
  train_effect text,
  unique (skill_id)
);

alter table dog_training_preferences
  add constraint dog_training_preferences_preferred_section_id_fkey
  foreign key (preferred_section_id) references training_sections(id);

alter table training_curriculum_versions enable row level security;
alter table training_sections enable row level security;
alter table training_skills enable row level security;
alter table training_levels enable row level security;
alter table training_media_bindings enable row level security;
alter table training_media_scenes enable row level security;
alter table training_ready_cards enable row level security;
alter table training_lesson_cards enable row level security;
alter table training_adaptive_guidance enable row level security;
alter table training_checkpoint_policies enable row level security;
alter table training_skill_relationships enable row level security;
alter table training_game_mappings enable row level security;

create policy curriculum_versions_read on training_curriculum_versions for select using (true);
create policy sections_read on training_sections for select using (true);
create policy skills_read on training_skills for select using (true);
create policy levels_read on training_levels for select using (true);
create policy media_bindings_read on training_media_bindings for select using (true);
create policy media_scenes_read on training_media_scenes for select using (true);
create policy ready_cards_read on training_ready_cards for select using (true);
create policy lesson_cards_read on training_lesson_cards for select using (true);
create policy adaptive_guidance_read on training_adaptive_guidance for select using (true);
create policy checkpoint_policies_read on training_checkpoint_policies for select using (true);
create policy skill_relationships_read on training_skill_relationships for select using (true);
create policy game_mappings_read on training_game_mappings for select using (true);
