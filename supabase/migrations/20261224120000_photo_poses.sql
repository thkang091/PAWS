-- PAWS: Photo Pose discovery, on top of the phase 4A media tournaments.
--
--   photo_pose_batches    one Gemini brainstorm an organizer asked for (theme, difficulty, model, schema version)
--   photo_pose_concepts   each idea: suggested -> approved or rejected -> published -> retired
--
-- Gemini only ever suggests. Nothing reaches players until an organizer approves the idea and its reference image,
-- and publishing copies the instructions into the challenge (media_challenges.instructions), so later edits to an
-- idea never change a running challenge. Players can read published ideas only.

create table public.photo_pose_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  theme text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'mixed')),
  requested integer not null check (requested between 1 and 10),
  model text,
  schema_version text not null,
  prompt_version text not null,
  status text not null default 'done' check (status in ('done', 'failed')),
  accepted integer not null default 0,
  rejected jsonb not null default '[]'::jsonb,
  error text,
  created_at timestamptz not null default timezone('utc', now())
);
create index photo_pose_batches_recent_idx on public.photo_pose_batches (created_by, created_at desc);

create table public.photo_pose_concepts (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references public.photo_pose_batches(id) on delete set null,
  title text not null check (char_length(title) between 3 and 48),
  description text not null check (char_length(description) between 10 and 200),
  category text not null check (category in ('funny', 'cute', 'matching', 'creative', 'trick')),
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  setup_minutes integer not null check (setup_minutes between 1 and 30),
  -- People in the photo besides the dog. Always the owner; ideas that need more people are rejected.
  participants integer not null default 1 check (participants = 1),
  required_objects text[] not null default '{}',
  dog_requirements text[] not null default '{}',
  owner_position text not null default '',
  dog_position text not null default '',
  camera_angle text not null default '',
  framing text not null default '',
  instructions text[] not null check (cardinality(instructions) between 2 and 8),
  -- [{ "id": "dog_visible", "label": "...", "kind": "dog_visible|owner_visible|same_frame|pose" }]
  objective_criteria jsonb not null default '[]'::jsonb,
  safety_notes text[] not null default '{}',
  -- Words the safety screen found, for the organizer to look at before approving.
  safety_flags text[] not null default '{}',
  visual_reference_prompt text not null default '',
  shareability text not null default '',
  -- Only from an authorized trend source with evidence. Gemini's ideas are "viral-inspired", never "trending".
  trend_source text,
  trend_verified_at timestamptz,
  fingerprint text not null,
  review_status text not null default 'suggested' check (review_status in ('suggested', 'approved', 'rejected', 'published', 'retired')),
  rejection_reason text,
  reference_media_path text,
  reference_source text check (reference_source is null or reference_source in ('generated', 'uploaded')),
  reference_license text,
  reference_status text not null default 'none' check (reference_status in ('none', 'pending', 'approved', 'rejected')),
  reference_check jsonb,
  ai_model text,
  generation_metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  published_at timestamptz,
  check (trend_source is null or trend_verified_at is not null),
  check (reference_source <> 'uploaded' or coalesce(reference_license, '') <> '')
);
create index photo_pose_concepts_status_idx on public.photo_pose_concepts (review_status, created_at desc);
create index photo_pose_concepts_fingerprint_idx on public.photo_pose_concepts (fingerprint);

-- A challenge made from an idea points back at it, for pose history and recommendations.
alter table public.media_challenges add column if not exists pose_concept_id uuid references public.photo_pose_concepts(id) on delete set null;
create index if not exists media_challenges_pose_idx on public.media_challenges (pose_concept_id);

alter table public.photo_pose_batches enable row level security;
alter table public.photo_pose_concepts enable row level security;

create policy photo_pose_batches_organizers on public.photo_pose_batches for select to authenticated using (public.is_tournament_organizer());
create policy photo_pose_concepts_organizers on public.photo_pose_concepts for select to authenticated using (public.is_tournament_organizer());
create policy photo_pose_concepts_published on public.photo_pose_concepts for select to authenticated using (review_status = 'published');

-- Organizers can read every reference, players only those of published ideas (and of challenges, from phase 4A).
create policy challenge_references_published_poses on storage.objects for select to authenticated
  using (bucket_id = 'challenge-references' and exists (
    select 1 from public.photo_pose_concepts p where p.reference_media_path = name and p.review_status = 'published' and p.reference_status = 'approved'
  ));

-- Gemini batches, after the edge function has validated and screened every idea. Service role only.
create or replace function public.record_pose_batch(
  p_user_id uuid,
  p_theme text,
  p_difficulty text,
  p_requested integer,
  p_model text,
  p_schema_version text,
  p_prompt_version text,
  p_concepts jsonb,
  p_rejected jsonb,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch photo_pose_batches;
  v_ids uuid[] := '{}';
  v_id uuid;
  c jsonb;
begin
  insert into photo_pose_batches (created_by, theme, difficulty, requested, model, schema_version, prompt_version, status, accepted, rejected, error)
  values (p_user_id, p_theme, p_difficulty, p_requested, p_model, p_schema_version, p_prompt_version,
    case when p_error is null then 'done' else 'failed' end, jsonb_array_length(coalesce(p_concepts, '[]')), coalesce(p_rejected, '[]'), p_error)
  returning * into v_batch;
  for c in select * from jsonb_array_elements(coalesce(p_concepts, '[]')) loop
    insert into photo_pose_concepts (batch_id, title, description, category, difficulty, setup_minutes, participants, required_objects,
      dog_requirements, owner_position, dog_position, camera_angle, framing, instructions, objective_criteria, safety_notes, safety_flags,
      visual_reference_prompt, shareability, fingerprint, ai_model, generation_metadata, created_by)
    values (v_batch.id, c ->> 'title', c ->> 'description', c ->> 'category', c ->> 'difficulty', (c ->> 'setupMinutes')::integer,
      (c ->> 'participants')::integer,
      array(select jsonb_array_elements_text(c -> 'requiredObjects')), array(select jsonb_array_elements_text(c -> 'dogRequirements')),
      c ->> 'ownerPosition', c ->> 'dogPosition', c ->> 'cameraAngle', c ->> 'framing',
      array(select jsonb_array_elements_text(c -> 'instructions')), c -> 'criteria',
      array(select jsonb_array_elements_text(c -> 'safetyNotes')), array(select jsonb_array_elements_text(c -> 'safetyFlags')),
      c ->> 'visualReferencePrompt', c ->> 'shareability', c ->> 'fingerprint', p_model,
      jsonb_build_object('schemaVersion', p_schema_version, 'promptVersion', p_prompt_version, 'theme', p_theme, 'sourceId', c ->> 'sourceId'),
      p_user_id)
    returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  return jsonb_build_object('batchId', v_batch.id, 'conceptIds', to_jsonb(v_ids));
end;
$$;
revoke execute on function public.record_pose_batch(uuid, text, text, integer, text, text, text, jsonb, jsonb, text) from public, anon, authenticated;

-- An idea written by hand, for when Gemini is unavailable or the organizer has their own. Same shape as above.
create or replace function public.create_pose_concept(p_concept jsonb)
returns public.photo_pose_concepts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row photo_pose_concepts;
  c jsonb := p_concept;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  insert into photo_pose_concepts (title, description, category, difficulty, setup_minutes, participants, required_objects, dog_requirements,
    owner_position, dog_position, camera_angle, framing, instructions, objective_criteria, safety_notes, safety_flags,
    visual_reference_prompt, shareability, fingerprint, created_by)
  values (c ->> 'title', c ->> 'description', c ->> 'category', c ->> 'difficulty', (c ->> 'setupMinutes')::integer, coalesce((c ->> 'participants')::integer, 1),
    array(select jsonb_array_elements_text(coalesce(c -> 'requiredObjects', '[]'))), array(select jsonb_array_elements_text(coalesce(c -> 'dogRequirements', '[]'))),
    coalesce(c ->> 'ownerPosition', ''), coalesce(c ->> 'dogPosition', ''), coalesce(c ->> 'cameraAngle', ''), coalesce(c ->> 'framing', ''),
    array(select jsonb_array_elements_text(c -> 'instructions')), coalesce(c -> 'criteria', '[]'),
    array(select jsonb_array_elements_text(coalesce(c -> 'safetyNotes', '[]'))), array(select jsonb_array_elements_text(coalesce(c -> 'safetyFlags', '[]'))),
    coalesce(c ->> 'visualReferencePrompt', ''), coalesce(c ->> 'shareability', ''), c ->> 'fingerprint', auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.create_pose_concept(jsonb) from anon;

-- Organizers revise an idea's words before publishing. Published ideas are locked; their challenge keeps its copy.
create or replace function public.update_pose_concept(p_concept_id uuid, p_patch jsonb)
returns public.photo_pose_concepts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row photo_pose_concepts;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  select * into v_row from photo_pose_concepts where id = p_concept_id for update;
  if v_row.id is null then raise exception 'pose_not_found'; end if;
  if v_row.review_status not in ('suggested', 'approved') then raise exception 'pose_locked'; end if;
  update photo_pose_concepts set
    title = coalesce(p_patch ->> 'title', title),
    description = coalesce(p_patch ->> 'description', description),
    framing = coalesce(p_patch ->> 'framing', framing),
    camera_angle = coalesce(p_patch ->> 'cameraAngle', camera_angle),
    instructions = case when p_patch ? 'instructions' then array(select jsonb_array_elements_text(p_patch -> 'instructions')) else instructions end,
    safety_notes = case when p_patch ? 'safetyNotes' then array(select jsonb_array_elements_text(p_patch -> 'safetyNotes')) else safety_notes end,
    required_objects = case when p_patch ? 'requiredObjects' then array(select jsonb_array_elements_text(p_patch -> 'requiredObjects')) else required_objects end,
    fingerprint = coalesce(p_patch ->> 'fingerprint', fingerprint),
    updated_at = timezone('utc', now())
  where id = v_row.id returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.update_pose_concept(uuid, jsonb) from anon;

-- Approve or reject an idea. An idea the safety screen flagged needs the organizer to confirm they read the flags.
create or replace function public.review_pose_concept(p_concept_id uuid, p_decision text, p_reason text default null, p_safety_checked boolean default false)
returns public.photo_pose_concepts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row photo_pose_concepts;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  select * into v_row from photo_pose_concepts where id = p_concept_id for update;
  if v_row.id is null then raise exception 'pose_not_found'; end if;
  if v_row.review_status in ('published', 'retired') then raise exception 'pose_locked'; end if;
  if p_decision = 'approve' then
    if cardinality(v_row.safety_flags) > 0 and not coalesce(p_safety_checked, false) then raise exception 'safety_unchecked'; end if;
    update photo_pose_concepts set review_status = 'approved', rejection_reason = null, reviewed_by = auth.uid(), approved_at = timezone('utc', now()),
      updated_at = timezone('utc', now()) where id = v_row.id returning * into v_row;
  elsif p_decision = 'reject' then
    update photo_pose_concepts set review_status = 'rejected', rejection_reason = nullif(trim(p_reason), ''), reviewed_by = auth.uid(),
      updated_at = timezone('utc', now()) where id = v_row.id returning * into v_row;
  else
    raise exception 'invalid_decision';
  end if;
  return v_row;
end;
$$;
revoke execute on function public.review_pose_concept(uuid, text, text, boolean) from anon;

-- A reference image, generated or uploaded, after the edge function stored it. Service role only. It waits for the
-- organizer's review; a replaced image goes back to pending.
create or replace function public.set_pose_reference(p_concept_id uuid, p_path text, p_source text, p_license text, p_check jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  select reference_media_path into v_old from photo_pose_concepts where id = p_concept_id and review_status in ('suggested', 'approved') for update;
  if not found then raise exception 'pose_locked'; end if;
  update photo_pose_concepts set reference_media_path = p_path, reference_source = p_source, reference_license = nullif(trim(p_license), ''),
    reference_status = 'pending', reference_check = p_check, updated_at = timezone('utc', now())
  where id = p_concept_id;
  return jsonb_build_object('replacedPath', v_old);
end;
$$;
revoke execute on function public.set_pose_reference(uuid, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.review_pose_reference(p_concept_id uuid, p_approve boolean)
returns public.photo_pose_concepts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row photo_pose_concepts;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  select * into v_row from photo_pose_concepts where id = p_concept_id for update;
  if v_row.id is null then raise exception 'pose_not_found'; end if;
  if v_row.reference_media_path is null then raise exception 'no_reference'; end if;
  if v_row.review_status not in ('suggested', 'approved') then raise exception 'pose_locked'; end if;
  update photo_pose_concepts set reference_status = case when p_approve then 'approved' else 'rejected' end, updated_at = timezone('utc', now())
  where id = v_row.id returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.review_pose_reference(uuid, boolean) from anon;

-- Publish an approved idea with an approved reference as a Photo Pose Challenge tournament. The instructions are
-- copied into the challenge, so this exact text is what every entry is judged against.
create or replace function public.publish_pose_challenge(
  p_concept_id uuid,
  p_name text,
  p_registration_opens_at timestamptz,
  p_starts_at timestamptz,
  p_entries_close_at timestamptz,
  p_ends_at timestamptz
)
returns public.media_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p photo_pose_concepts;
  v_t tournaments;
  v_c media_challenges;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  select * into v_p from photo_pose_concepts where id = p_concept_id for update;
  if v_p.id is null then raise exception 'pose_not_found'; end if;
  if v_p.review_status <> 'approved' then raise exception 'pose_not_approved'; end if;
  if v_p.reference_status <> 'approved' or v_p.reference_media_path is null then raise exception 'reference_not_approved'; end if;

  v_t := create_tournament('photo_pose', 'online', p_name, v_p.description, p_registration_opens_at, p_starts_at, p_ends_at);
  v_c := create_media_challenge(v_t.id, v_p.title, v_p.description,
    jsonb_build_object(
      'conceptId', v_p.id, 'category', v_p.category, 'difficulty', v_p.difficulty, 'setupMinutes', v_p.setup_minutes,
      'requiredObjects', to_jsonb(v_p.required_objects), 'dogRequirements', to_jsonb(v_p.dog_requirements),
      'ownerPosition', v_p.owner_position, 'dogPosition', v_p.dog_position, 'cameraAngle', v_p.camera_angle, 'framing', v_p.framing,
      'steps', to_jsonb(v_p.instructions), 'criteria', v_p.objective_criteria, 'safety', to_jsonb(v_p.safety_notes)),
    p_entries_close_at, true, v_p.reference_media_path);
  update media_challenges set pose_concept_id = v_p.id where id = v_c.id returning * into v_c;
  update photo_pose_concepts set review_status = 'published', published_at = timezone('utc', now()), updated_at = timezone('utc', now()) where id = v_p.id;
  return v_c;
end;
$$;
revoke execute on function public.publish_pose_challenge(uuid, text, timestamptz, timestamptz, timestamptz, timestamptz) from anon;

create or replace function public.retire_pose_concept(p_concept_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  update photo_pose_concepts set review_status = 'retired', updated_at = timezone('utc', now()) where id = p_concept_id and review_status = 'published';
end;
$$;
revoke execute on function public.retire_pose_concept(uuid) from anon;

-- Published poses for recommendations: what each needs, when it last ran, and whether you have entered it before.
create or replace function public.pose_library()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'title', p.title, 'description', p.description, 'category', p.category, 'difficulty', p.difficulty,
    'setupMinutes', p.setup_minutes, 'requiredObjects', to_jsonb(p.required_objects), 'referencePath', p.reference_media_path,
    'publishedAt', p.published_at,
    'entered', exists (
      select 1 from media_submissions s join media_challenges c on c.id = s.challenge_id
      where c.pose_concept_id = p.id and s.user_id = auth.uid() and s.status in ('approved', 'pending_review', 'held', 'checking')
    )
  ) order by p.published_at desc), '[]'::jsonb)
  from photo_pose_concepts p
  where p.review_status = 'published' and auth.uid() is not null;
$$;
revoke execute on function public.pose_library() from anon;
