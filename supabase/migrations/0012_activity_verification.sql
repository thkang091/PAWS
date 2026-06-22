create table activity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  activity_id text not null,
  activity_category text not null check (activity_category in ('STATIC_POSE', 'TRANSITION', 'DURATION', 'REPETITION', 'DISTANCE_OR_MOVEMENT', 'DAILY_ROUTINE', 'GAME')),
  verification_mode text not null check (verification_mode in ('POSE_TEMPORAL', 'OBJECT_AND_POSE', 'TIMER_AND_POSE', 'MOTION_TRACKING', 'PHOTO_CONFIRMATION', 'USER_CONFIRMATION', 'OPTIONAL_VIDEO_CONFIRMATION', 'MANUAL_REVIEW_REQUIRED_FOR_TOP_SCORE')),
  trust_level text not null check (trust_level in ('VERIFIED_AI', 'VERIFIED_SENSOR', 'VERIFIED_PHOTO', 'USER_CONFIRMED', 'MANUAL_REVIEWED')),
  context_type text not null check (context_type in ('training', 'daily_quest', 'routine', 'game', 'tournament')),
  related_quest_id uuid null references daily_quests(id) on delete set null,
  related_training_lesson_id uuid null references training_skills(id) on delete set null,
  related_game_session_id uuid null,
  related_tournament_id uuid null,
  source_type text not null check (source_type in ('in_app_video', 'in_app_photo', 'sensor_session', 'user_confirmation', 'backend_import')),
  storage_path text null,
  thumbnail_path text null,
  status text not null default 'pending' check (status in (
    'pending',
    'uploading',
    'analyzing',
    'passed',
    'user_confirmed',
    'retry_camera_angle',
    'retry_dog_not_visible',
    'retry_multiple_dogs',
    'retry_object_not_visible',
    'retry_low_confidence',
    'retry_incomplete_activity',
    'retry_wrong_starting_pose',
    'failed_no_valid_activity',
    'suspicious',
    'manual_review',
    'error'
  )),
  confidence_score numeric null check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  model_name text null,
  started_at timestamptz null,
  completed_at timestamptz null,
  analyzed_at timestamptz null,
  duration_ms integer null check (duration_ms is null or duration_ms >= 0),
  fps numeric null check (fps is null or fps > 0),
  sensor_metadata jsonb null,
  pose_summary jsonb null,
  analysis_summary jsonb null,
  failure_reason text null,
  retry_guidance text null,
  camera_quality_metadata jsonb null,
  user_retry_count integer not null default 0 check (user_retry_count >= 0),
  manual_label text null,
  correct_result boolean null,
  incorrect_result boolean null,
  needs_labeling boolean not null default false,
  labeled_activity text null,
  reviewer_notes text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table activity_reward_events (
  id uuid primary key default gen_random_uuid(),
  verification_id uuid not null references activity_verifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  xp_awarded integer not null default 0 check (xp_awarded >= 0),
  coins_awarded integer not null default 0 check (coins_awarded >= 0),
  reward_reason text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique(verification_id, reward_reason)
);

create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null,
  game_type text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  opponent_user_id uuid null references auth.users(id) on delete set null,
  status text not null default 'created' check (status in ('created', 'countdown', 'recording', 'analyzing', 'completed', 'manual_review', 'rejected', 'error')),
  started_at timestamptz null,
  completed_at timestamptz null,
  score_value numeric null,
  score_unit text null,
  verification_id uuid null references activity_verifications(id) on delete set null,
  rank_eligible boolean not null default false,
  suspicious boolean not null default false,
  challenge_token_hash text null,
  created_at timestamptz not null default timezone('utc', now())
);

create table daily_routine_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid not null references dogs(id) on delete cascade,
  routine_type text not null,
  verification_id uuid null references activity_verifications(id) on delete set null,
  completion_method text not null check (completion_method in ('USER_CONFIRMATION', 'VERIFIED_SENSOR', 'VERIFIED_PHOTO', 'OPTIONAL_VIDEO_CONFIRMATION')),
  completed_at timestamptz not null default timezone('utc', now()),
  notes text null,
  metadata jsonb null
);

create index activity_verifications_owner_idx on activity_verifications(user_id, dog_id, created_at desc);
create index activity_verifications_activity_idx on activity_verifications(activity_id, status);
create index daily_routine_logs_owner_idx on daily_routine_logs(user_id, dog_id, completed_at desc);
create index game_sessions_owner_idx on game_sessions(user_id, dog_id, created_at desc);

create trigger activity_verifications_updated_at before update on activity_verifications
for each row execute function set_updated_at();

alter table activity_verifications enable row level security;
alter table activity_reward_events enable row level security;
alter table game_sessions enable row level security;
alter table daily_routine_logs enable row level security;

create policy "activity verifications own read"
on activity_verifications for select
using (user_id = auth.uid());

create policy "activity verifications own insert"
on activity_verifications for insert
with check (
  user_id = auth.uid()
  and owns_dog(dog_id)
  and status in ('pending', 'uploading')
);

create policy "activity verifications own safe update"
on activity_verifications for update
using (user_id = auth.uid() and status in ('pending', 'uploading', 'error'))
with check (
  user_id = auth.uid()
  and owns_dog(dog_id)
  and status in ('pending', 'uploading', 'analyzing', 'error')
  and confidence_score is null
  and model_name is null
  and pose_summary is null
  and analysis_summary is null
);

create policy "activity reward events own read"
on activity_reward_events for select
using (user_id = auth.uid());

create policy "game sessions own read"
on game_sessions for select
using (user_id = auth.uid() or opponent_user_id = auth.uid());

create policy "game sessions own insert"
on game_sessions for insert
with check (user_id = auth.uid() and owns_dog(dog_id) and status = 'created');

create policy "daily routine logs own read"
on daily_routine_logs for select
using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('dog-activity-videos', 'dog-activity-videos', false, 104857600, array['video/mp4', 'video/quicktime']),
  ('dog-activity-photos', 'dog-activity-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic']),
  ('dog-moment-photos', 'dog-moment-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "activity video upload owner folder"
on storage.objects for insert
with check (
  bucket_id = 'dog-activity-videos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "activity video read owner folder"
on storage.objects for select
using (
  bucket_id = 'dog-activity-videos'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "activity photo upload owner folder"
on storage.objects for insert
with check (
  bucket_id in ('dog-activity-photos', 'dog-moment-photos')
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "activity photo read owner folder"
on storage.objects for select
using (
  bucket_id in ('dog-activity-photos', 'dog-moment-photos')
  and auth.uid()::text = (storage.foldername(name))[1]
);

create or replace function submit_user_confirmed_routine(
  target_dog_id uuid,
  routine_activity_id text,
  routine_notes text,
  routine_metadata jsonb default '{}'::jsonb
)
returns activity_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  verification activity_verifications;
begin
  if not owns_dog(target_dog_id) then
    raise exception 'Dog not found';
  end if;

  insert into activity_verifications(
    user_id,
    dog_id,
    activity_id,
    activity_category,
    verification_mode,
    trust_level,
    context_type,
    source_type,
    status,
    completed_at,
    analysis_summary
  )
  values (
    auth.uid(),
    target_dog_id,
    routine_activity_id,
    'DAILY_ROUTINE',
    'USER_CONFIRMATION',
    'USER_CONFIRMED',
    'routine',
    'user_confirmation',
    'user_confirmed',
    timezone('utc', now()),
    jsonb_build_object('method', 'owner_confirmation')
  )
  returning * into verification;

  insert into daily_routine_logs(user_id, dog_id, routine_type, verification_id, completion_method, notes, metadata)
  values (auth.uid(), target_dog_id, routine_activity_id, verification.id, 'USER_CONFIRMATION', nullif(trim(routine_notes), ''), coalesce(routine_metadata, '{}'::jsonb));

  return verification;
end;
$$;

create or replace function submit_photo_confirmed_routine(
  target_dog_id uuid,
  routine_activity_id text,
  storage_path_value text,
  routine_notes text,
  routine_metadata jsonb default '{}'::jsonb
)
returns activity_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  verification activity_verifications;
begin
  if not owns_dog(target_dog_id) then
    raise exception 'Dog not found';
  end if;

  if storage_path_value is null or split_part(storage_path_value, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid activity photo path';
  end if;

  insert into activity_verifications(
    user_id,
    dog_id,
    activity_id,
    activity_category,
    verification_mode,
    trust_level,
    context_type,
    source_type,
    storage_path,
    status,
    completed_at,
    analysis_summary
  )
  values (
    auth.uid(),
    target_dog_id,
    routine_activity_id,
    'DAILY_ROUTINE',
    'PHOTO_CONFIRMATION',
    'VERIFIED_PHOTO',
    'routine',
    'in_app_photo',
    storage_path_value,
    'passed',
    timezone('utc', now()),
    jsonb_build_object('method', 'photo_confirmation')
  )
  returning * into verification;

  insert into daily_routine_logs(user_id, dog_id, routine_type, verification_id, completion_method, notes, metadata)
  values (auth.uid(), target_dog_id, routine_activity_id, verification.id, 'VERIFIED_PHOTO', nullif(trim(routine_notes), ''), coalesce(routine_metadata, '{}'::jsonb));

  return verification;
end;
$$;

create or replace function finalize_activity_verification(
  target_verification_id uuid,
  final_status text,
  confidence numeric,
  model text,
  pose jsonb,
  summary jsonb,
  failure text,
  guidance text
)
returns activity_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  verification activity_verifications;
begin
  update activity_verifications
  set
    status = final_status,
    confidence_score = confidence,
    model_name = model,
    pose_summary = pose,
    analysis_summary = summary,
    failure_reason = failure,
    retry_guidance = guidance,
    analyzed_at = timezone('utc', now()),
    completed_at = case when final_status in ('passed', 'manual_review', 'suspicious') then timezone('utc', now()) else completed_at end,
    needs_labeling = final_status not in ('passed', 'user_confirmed')
  where id = target_verification_id
  returning * into verification;

  if verification.id is null then
    raise exception 'Verification not found';
  end if;

  return verification;
end;
$$;

revoke all on function finalize_activity_verification(uuid, text, numeric, text, jsonb, jsonb, text, text) from anon, authenticated;
grant execute on function finalize_activity_verification(uuid, text, numeric, text, jsonb, jsonb, text, text) to service_role;
