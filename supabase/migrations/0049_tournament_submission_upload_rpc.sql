-- ============================================================
-- Migration 0049 - Tournament video submission upload RPCs
-- ============================================================
-- Avoid broad dogs/profiles/submission table grants. Mobile creates and marks
-- a tournament video upload only through these ownership-checking RPCs.
-- ============================================================

revoke all on table public.dog_training_video_submissions
  from anon, authenticated;

create or replace function public.prepare_tournament_video_submission(
  target_tournament_id uuid,
  target_dog_id uuid,
  target_challenge_game_id text,
  request_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_user_id uuid := auth.uid();
  event_row public.tournament_events%rowtype;
  submission_row public.dog_training_video_submissions%rowtype;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if request_key is null or btrim(request_key) = '' then
    raise exception 'Request key is required' using errcode = '22023';
  end if;

  select submission.*
  into submission_row
  from public.dog_training_video_submissions as submission
  where submission.submission_hash = request_key
    and submission.dog_id = target_dog_id
    and submission.user_id = request_user_id
    and submission.activity_id = target_challenge_game_id;

  if found then
    return jsonb_build_object('submission', to_jsonb(submission_row));
  end if;

  perform 1
  from public.dogs as dog
  where dog.id = target_dog_id
    and dog.owner_id = request_user_id;
  if not found then
    raise exception 'Dog not found' using errcode = '42501';
  end if;

  select event.*
  into event_row
  from public.tournament_events as event
  where event.id = target_tournament_id
    and event.challenge_game_id = target_challenge_game_id;
  if not found
    or event_row.status <> 'active'
    or now() < event_row.starts_at
    or now() >= event_row.ends_at
  then
    raise exception 'Tournament is not accepting uploads' using errcode = 'P0001';
  end if;

  perform 1
  from public.tournament_entries as entry
  where entry.tournament_id = target_tournament_id
    and entry.dog_id = target_dog_id
    and entry.owner_id = request_user_id
    and entry.status in ('joined', 'active')
    and entry.attempts_used < event_row.max_attempts_per_entry;
  if not found then
    raise exception 'Tournament entry cannot submit another attempt' using errcode = 'P0001';
  end if;

  insert into public.dog_training_video_submissions (
    dog_id,
    user_id,
    activity_id,
    status,
    submission_hash
  ) values (
    target_dog_id,
    request_user_id,
    target_challenge_game_id,
    'pending',
    request_key
  )
  returning * into submission_row;

  return jsonb_build_object('submission', to_jsonb(submission_row));
end;
$$;

create or replace function public.complete_tournament_video_upload(
  target_tournament_id uuid,
  target_dog_id uuid,
  target_submission_id uuid,
  storage_path_value text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_user_id uuid := auth.uid();
  event_row public.tournament_events%rowtype;
  submission_row public.dog_training_video_submissions%rowtype;
begin
  if request_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if storage_path_value is null or btrim(storage_path_value) = '' then
    raise exception 'Storage path is required' using errcode = '22023';
  end if;

  select event.*
  into event_row
  from public.tournament_events as event
  where event.id = target_tournament_id;
  if not found
    or event_row.status <> 'active'
    or now() < event_row.starts_at
    or now() >= event_row.ends_at
  then
    raise exception 'Tournament is not accepting uploads' using errcode = 'P0001';
  end if;

  select submission.*
  into submission_row
  from public.dog_training_video_submissions as submission
  where submission.id = target_submission_id
    and submission.dog_id = target_dog_id
    and submission.user_id = request_user_id
    and submission.activity_id = event_row.challenge_game_id
  for update;

  if not found then
    raise exception 'Tournament video submission not found' using errcode = '42501';
  end if;

  if submission_row.status = 'processing'
    and submission_row.storage_path = storage_path_value
  then
    return jsonb_build_object('submission', to_jsonb(submission_row));
  end if;
  if submission_row.status <> 'pending' or submission_row.storage_path is not null then
    raise exception 'Tournament video submission cannot accept this upload' using errcode = 'P0001';
  end if;

  update public.dog_training_video_submissions
  set storage_path = storage_path_value,
      status = 'processing'
  where id = submission_row.id
  returning * into submission_row;

  return jsonb_build_object('submission', to_jsonb(submission_row));
end;
$$;

revoke all on function public.prepare_tournament_video_submission(uuid, uuid, text, text)
  from public, anon;
revoke all on function public.complete_tournament_video_upload(uuid, uuid, uuid, text)
  from public, anon;
grant execute on function public.prepare_tournament_video_submission(uuid, uuid, text, text)
  to authenticated;
grant execute on function public.complete_tournament_video_upload(uuid, uuid, uuid, text)
  to authenticated;

comment on function public.prepare_tournament_video_submission(uuid, uuid, text, text) is
  'Creates a clean pending video submission for an owned active tournament entry.';
comment on function public.complete_tournament_video_upload(uuid, uuid, uuid, text) is
  'Marks an owned tournament submission processing after its Storage upload succeeds.';

notify pgrst, 'reload schema';
