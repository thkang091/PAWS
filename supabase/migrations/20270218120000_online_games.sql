-- Online games: Make the Largest Country, Photo Pose Challenge and Dog Reels Battle.
--
--  * Every Monday each game opens a new public week by itself (pg_cron where available; otherwise the first player
--    to open a list that week opens it). Photo Pose takes an approved pose, Dog Reels a theme.
--  * Friend battles: a private copy of this week's game with a six-character code. Only its players see it.
--  * Dog Reels entries are 15 second clips filmed in the app, with a still frame the check looks at.

-- ---------------------------------------------------------------------------------------------------------------
-- Tournaments: automatic weeks and private friend battles
-- ---------------------------------------------------------------------------------------------------------------

alter table public.tournaments add column if not exists private boolean not null default false;
alter table public.tournaments add column if not exists invite_code text;
alter table public.tournaments add column if not exists auto_week date;
create unique index if not exists tournaments_invite_code_idx on public.tournaments (invite_code) where invite_code is not null;
create unique index if not exists tournaments_auto_week_idx on public.tournaments (game_type, auto_week) where auto_week is not null;

-- A private battle is visible only to its players and its maker.
drop policy if exists tournaments_read on public.tournaments;
create policy tournaments_read on public.tournaments for select to authenticated using (
  not private
  or created_by = auth.uid()
  or exists (select 1 from public.tournament_participants p where p.tournament_id = tournaments.id and p.user_id = auth.uid())
);

-- ---------------------------------------------------------------------------------------------------------------
-- Dog Reels themes
-- ---------------------------------------------------------------------------------------------------------------

create table if not exists public.reel_themes (
  id uuid primary key default gen_random_uuid(),
  title text not null unique check (char_length(title) between 3 and 48),
  brief text not null check (char_length(brief) between 10 and 200),
  steps text[] not null check (cardinality(steps) between 2 and 6),
  safety text[] not null default '{}',
  active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);
alter table public.reel_themes enable row level security;
drop policy if exists reel_themes_read on public.reel_themes;
create policy reel_themes_read on public.reel_themes for select to authenticated using (active);

insert into public.reel_themes (title, brief, steps, safety) values
  ('Zoomies', 'Your dog at full speed. Catch the happiest run of the week.', array['Pick a safe open space', 'Start filming before the run', 'Keep your dog in the frame'], array['Only off lead where it is allowed and safe']),
  ('The welcome home', 'The moment you walk in the door.', array['Ask someone to film, or prop the phone up', 'Walk in like any other day', 'Film the greeting'], array['Keep the door closed behind you']),
  ('One trick, slow and clean', 'Your dog''s best trick from start to reward.', array['Choose a trick your dog knows well', 'Film from the side at dog height', 'End on the reward'], array['Short session, lots of praise']),
  ('Snack time face', 'The look your dog gives when a treat appears.', array['Hold a treat just above the lens', 'Film your dog''s face up close', 'Give the treat at the end'], array['Use a treat your dog can eat']),
  ('Toy champion', 'Your dog and its favourite toy, mid play.', array['Bring out the favourite toy', 'Throw or tug gently', 'Keep the toy and the dog in frame'], array['Soft toys only, no sticks']),
  ('Dog at the window', 'What your dog watches when nobody is looking.', array['Film quietly from behind or the side', 'Let your dog watch the world', 'Hold still for the whole clip'], array['Never film from a dangerous height']),
  ('Paw high five', 'A high five, a wave or a paw shake.', array['Kneel at your dog''s level', 'Ask for the paw', 'Film the touch and the reward'], array['Stop if your dog seems unsure']),
  ('Bath time', 'Before, during or after the bath.', array['Warm water, calm voice', 'Film a few seconds of the best part', 'Finish with a towel cuddle'], array['Keep water out of eyes and ears']),
  ('Head tilt', 'The famous head tilt, on cue or by surprise.', array['Make a new sound off camera', 'Film your dog''s face', 'Reward the tilt'], array['Keep sounds gentle']),
  ('Walk with me', 'Your dog''s best walking moment this week.', array['Film at dog height on a walk', 'Show where you are walking', 'Keep the lead in hand'], array['Stay on paths, away from traffic']),
  ('Sleepy dog', 'Dreaming paws, snores or a big stretch.', array['Film quietly while your dog rests', 'Do not wake your dog', 'Catch a stretch or a twitch'], array['Let sleeping dogs lie']),
  ('Best friends', 'Your dog with its favourite person, pet or toy.', array['Choose the best friend', 'Film them together', 'End with a hug or a sniff'], array['Only friendly, calm meetings'])
on conflict (title) do nothing;

-- ---------------------------------------------------------------------------------------------------------------
-- Starter poses, so Photo Pose has a week to open before organizers add their own (approved, no example photo)
-- ---------------------------------------------------------------------------------------------------------------

insert into public.photo_pose_concepts (title, description, category, difficulty, setup_minutes, owner_position, dog_position, camera_angle, framing, instructions, objective_criteria, safety_notes, fingerprint, review_status, approved_at)
select v.title, v.description, v.category, v.difficulty, v.minutes, v.owner_position, v.dog_position, v.camera, v.framing, v.steps,
       jsonb_build_array(jsonb_build_object('id', 'pose', 'label', v.pose_label, 'kind', 'pose')), v.safety, 'starter:' || lower(replace(v.title, ' ', '-')), 'approved', timezone('utc', now())
from (values
  ('Matching tilt', 'You and your dog tilt your heads the same way at the camera.', 'funny', 'easy', 3, 'Kneeling, head tilted', 'Sitting, head tilted', 'Eye level', 'Both faces', array['Kneel next to your dog', 'Make a soft sound to get a tilt', 'Tilt your head the same way', 'Take the photo on the tilt'], 'The person and the dog tilt their heads the same way', array['Keep it short and fun']),
  ('Nose to nose', 'A gentle nose boop between you and your dog.', 'cute', 'easy', 2, 'Face close to the dog', 'Sitting or lying', 'Side view', 'Both faces in profile', array['Sit with your dog', 'Lean in slowly', 'Touch noses gently', 'Photo from the side'], 'The person''s nose and the dog''s nose touch or nearly touch', array['Only with a dog that enjoys closeness']),
  ('Paw in hand', 'Your dog rests a paw in your open hand.', 'cute', 'easy', 2, 'Hand held out, palm up', 'Paw on the hand', 'Close up', 'Hand and paw, both faces if you can', array['Ask for a paw', 'Hold your hand open', 'Wait for the paw to rest', 'Take the photo'], 'A dog paw rests on a person''s hand', array['Reward every paw']),
  ('Same pose', 'You copy your dog''s favourite lying pose.', 'funny', 'medium', 5, 'Lying like the dog', 'Lying down', 'Low, at floor level', 'Both whole bodies', array['Wait for your dog to lie down', 'Lie down the same way next to it', 'Phone low on the floor', 'Use a timer or a helper'], 'The person lies down in the same position as the dog', array['A soft floor or grass']),
  ('Hug from behind', 'You hug your dog from behind, both facing the camera.', 'cute', 'easy', 2, 'Kneeling behind the dog', 'Sitting, facing the camera', 'Eye level', 'Both faces', array['Sit your dog facing the camera', 'Kneel behind it', 'Wrap your arms gently', 'Smile together'], 'The person hugs the dog from behind and both face the camera', array['Gentle, short hugs only']),
  ('Look up together', 'You and your dog look up at the same thing.', 'creative', 'medium', 4, 'Looking up', 'Looking up', 'From above', 'Both faces from above', array['Hold a treat above the camera', 'Both look up at it', 'Shoot from above', 'Reward right after'], 'The person and the dog both look upward', array['Hold the phone firmly']),
  ('Peekaboo', 'Your dog peeks out from behind your legs.', 'funny', 'medium', 4, 'Standing, legs apart', 'Head between the legs', 'Front, low', 'Legs and dog face', array['Stand with legs apart', 'Call your dog from behind', 'Let its head peek through', 'Photo from the front'], 'The dog''s head is visible between or beside the person''s legs', array['Stand still while your dog moves']),
  ('Sit side by side', 'You and your dog sit next to each other, facing the same view.', 'creative', 'easy', 3, 'Sitting, seen from behind', 'Sitting next to you', 'From behind', 'Both backs and the view', array['Find a nice view', 'Sit down next to your dog', 'Ask a helper to shoot from behind', 'Both face the view'], 'The person and the dog sit side by side seen from behind', array['Away from edges and traffic'])
) as v(title, description, category, difficulty, minutes, owner_position, dog_position, camera, framing, steps, pose_label, safety)
where not exists (select 1 from public.photo_pose_concepts c where c.fingerprint = 'starter:' || lower(replace(v.title, ' ', '-')));

-- ---------------------------------------------------------------------------------------------------------------
-- Video entries: a still frame for the gallery and the check
-- ---------------------------------------------------------------------------------------------------------------

alter table public.media_submissions add column if not exists poster_path text;
alter table public.media_submissions add column if not exists duration_ms integer check (duration_ms is null or duration_ms between 1 and 16000);

-- Records an entry after the edge function checked and cleaned it. Service role only (as before), now with the
-- still frame and length of a clip.
create or replace function public.record_media_video(
  p_challenge_id uuid, p_user_id uuid, p_dog_id uuid, p_media_path text, p_poster_path text,
  p_width integer, p_height integer, p_bytes integer, p_duration_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_out jsonb;
  v_c media_challenges;
begin
  select * into v_c from media_challenges where id = p_challenge_id;
  if v_c.id is null then raise exception 'challenge_not_found'; end if;
  if v_c.media_kind <> 'video' then raise exception 'not_a_video_challenge'; end if;
  if split_part(p_poster_path, '/', 1) <> p_user_id::text then raise exception 'not_your_file'; end if;
  v_out := record_media_submission(p_challenge_id, p_user_id, p_dog_id, p_media_path, p_width, p_height, p_bytes);
  update media_submissions set poster_path = p_poster_path, duration_ms = p_duration_ms where id = (v_out -> 'submission' ->> 'id')::uuid;
  -- The replaced entry's still frame goes with its clip.
  return v_out || jsonb_build_object('replacedPoster',
    (select s.poster_path from media_submissions s where s.media_path = v_out ->> 'replacedPath'));
end;
$$;
revoke execute on function public.record_media_video(uuid, uuid, uuid, text, text, integer, integer, integer, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- The weekly opener
-- ---------------------------------------------------------------------------------------------------------------

-- Opens this week's public Largest Country, Photo Pose and Dog Reels if they aren't open yet. Safe to call any number
-- of times: one week per game, enforced by a unique index. Weeks run Monday to Monday (UTC); entries for the photo and
-- reel games close on Friday, then everyone votes until Monday.
create or replace function public.open_weekly_challenges(p_now timestamptz default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := coalesce(p_now, now());
  v_week date := date_trunc('week', v_now at time zone 'utc')::date;
  v_start timestamptz := (v_week::timestamp at time zone 'utc');
  v_end timestamptz := v_start + interval '7 days';
  v_close timestamptz := v_start + interval '4 days';
  v_t tournaments;
  v_pose photo_pose_concepts;
  v_theme reel_themes;
  v_c media_challenges;
  v_opened integer := 0;
begin
  if exists (select 1 from tournaments where auto_week = v_week and game_type = 'largest_country')
     and exists (select 1 from tournaments where auto_week = v_week and game_type = 'photo_pose')
     and exists (select 1 from tournaments where auto_week = v_week and game_type = 'dog_reels') then
    return 0;
  end if;
  -- One opener at a time.
  perform pg_advisory_xact_lock(hashtext('paws-weekly-' || v_week::text));

  if not exists (select 1 from tournaments where auto_week = v_week and game_type = 'largest_country') then
    insert into tournaments (game_type, mode, name, description, registration_opens_at, starts_at, ends_at, auto_week)
    values ('largest_country', 'online', 'Make the Largest Country', 'Walk one loop on your own streets. The biggest territory this week wins.', v_start, v_start, v_end, v_week);
    v_opened := v_opened + 1;
  end if;

  if not exists (select 1 from tournaments where auto_week = v_week and game_type = 'photo_pose') then
    select * into v_pose from photo_pose_concepts
     where review_status in ('approved', 'published') and (reference_status in ('approved', 'none'))
     order by (review_status = 'approved') desc, published_at nulls first, random() limit 1;
    if v_pose.id is not null then
      insert into tournaments (game_type, mode, name, description, registration_opens_at, starts_at, ends_at, auto_week)
      values ('photo_pose', 'online', 'Photo Pose Challenge', v_pose.description, v_start, v_start, v_end, v_week) returning * into v_t;
      insert into media_challenges (tournament_id, media_kind, title, brief, instructions, requires_owner, reference_path, entries_close_at, pose_concept_id)
      values (v_t.id, 'photo', v_pose.title, v_pose.description,
        jsonb_build_object(
          'conceptId', v_pose.id, 'category', v_pose.category, 'difficulty', v_pose.difficulty, 'setupMinutes', v_pose.setup_minutes,
          'requiredObjects', to_jsonb(v_pose.required_objects), 'dogRequirements', to_jsonb(v_pose.dog_requirements),
          'ownerPosition', v_pose.owner_position, 'dogPosition', v_pose.dog_position, 'cameraAngle', v_pose.camera_angle, 'framing', v_pose.framing,
          'steps', to_jsonb(v_pose.instructions), 'criteria', v_pose.objective_criteria, 'safety', to_jsonb(v_pose.safety_notes)),
        true, case when v_pose.reference_status = 'approved' then v_pose.reference_media_path end, v_close, v_pose.id);
      update photo_pose_concepts set review_status = 'published', published_at = timezone('utc', now()), updated_at = timezone('utc', now()) where id = v_pose.id;
      v_opened := v_opened + 1;
    end if;
  end if;

  if not exists (select 1 from tournaments where auto_week = v_week and game_type = 'dog_reels') then
    select * into v_theme from reel_themes where active order by last_used_at nulls first, random() limit 1;
    if v_theme.id is not null then
      insert into tournaments (game_type, mode, name, description, registration_opens_at, starts_at, ends_at, auto_week)
      values ('dog_reels', 'online', 'Dog Reels Battle', v_theme.brief, v_start, v_start, v_end, v_week) returning * into v_t;
      insert into media_challenges (tournament_id, media_kind, title, brief, instructions, requires_owner, entries_close_at)
      values (v_t.id, 'video', v_theme.title, v_theme.brief,
        jsonb_build_object('themeId', v_theme.id, 'steps', to_jsonb(v_theme.steps), 'safety', to_jsonb(v_theme.safety),
          'criteria', jsonb_build_array(jsonb_build_object('id', 'dog_visible', 'label', 'A dog is clearly visible', 'kind', 'dog_visible'))),
        false, v_close);
      update reel_themes set last_used_at = timezone('utc', now()) where id = v_theme.id;
      v_opened := v_opened + 1;
    end if;
  end if;
  return v_opened;
end;
$$;
revoke execute on function public.open_weekly_challenges(timestamptz) from public, anon, authenticated;

-- The app's fallback for projects without pg_cron: any signed-in player opening a list opens the week.
create or replace function public.ensure_weekly_challenges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  return open_weekly_challenges(now());
end;
$$;
revoke execute on function public.ensure_weekly_challenges() from public, anon;
grant execute on function public.ensure_weekly_challenges() to authenticated;

-- Every Monday just after midnight (UTC), where pg_cron is available.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron not available here: weeks open on first use';
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'paws-weekly-challenges';
    perform cron.schedule('paws-weekly-challenges', '5 0 * * 1', 'select public.open_weekly_challenges()');
  end if;
exception when others then
  raise notice 'weekly schedule not set: %', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Friend battles
-- ---------------------------------------------------------------------------------------------------------------

-- A private copy of this week's game: same pose or theme, three days (entries for two, then a day to vote).
create or replace function public.create_friend_battle(p_game public.tournament_game, p_dog_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_week date := date_trunc('week', now() at time zone 'utc')::date;
  v_src tournaments;
  v_src_c media_challenges;
  v_t tournaments;
  v_c media_challenges;
  v_code text;
  v_name text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_game not in ('largest_country', 'photo_pose', 'dog_reels') then raise exception 'bad_request'; end if;
  if p_dog_id is not null and not owns_dog(p_dog_id) then raise exception 'not_your_dog'; end if;
  if (select count(*) from tournaments where private and created_by = auth.uid() and ends_at > now()) >= 5 then raise exception 'too_many_battles'; end if;

  perform open_weekly_challenges(now());
  select * into v_src from tournaments where auto_week = v_week and game_type = p_game;
  if p_game <> 'largest_country' then
    select * into v_src_c from media_challenges where tournament_id = v_src.id;
    if v_src_c.id is null then raise exception 'challenge_not_found'; end if;
  end if;

  v_name := case p_game when 'largest_country' then 'Largest Country with friends' when 'photo_pose' then 'Photo Pose with friends' else 'Dog Reels with friends' end;
  for i in 1..8 loop
    v_code := make_room_code();
    begin
      insert into tournaments (game_type, mode, name, description, registration_opens_at, starts_at, ends_at, created_by, private, invite_code)
      values (p_game, 'online', v_name, coalesce(v_src.description, ''), now(), now(), now() + interval '3 days', auth.uid(), true, v_code)
      returning * into v_t;
      exit;
    exception when unique_violation then
      v_t := null;
    end;
  end loop;
  if v_t.id is null then raise exception 'code_unavailable'; end if;

  if v_src_c.id is not null then
    insert into media_challenges (tournament_id, media_kind, title, brief, instructions, requires_owner, reference_path, entries_close_at, pose_concept_id, created_by)
    values (v_t.id, v_src_c.media_kind, v_src_c.title, v_src_c.brief, v_src_c.instructions, v_src_c.requires_owner, v_src_c.reference_path, now() + interval '2 days', v_src_c.pose_concept_id, auth.uid())
    returning * into v_c;
  end if;

  insert into tournament_participants (tournament_id, user_id, dog_id) values (v_t.id, auth.uid(), p_dog_id);
  return jsonb_build_object('tournamentId', v_t.id, 'code', v_t.invite_code, 'gameType', v_t.game_type, 'challengeId', v_c.id, 'endsAt', v_t.ends_at);
end;
$$;
revoke execute on function public.create_friend_battle(public.tournament_game, uuid) from public, anon;
grant execute on function public.create_friend_battle(public.tournament_game, uuid) to authenticated;

-- Join a friend battle with its code while it runs. Up to 20 players.
create or replace function public.join_friend_battle(p_code text, p_dog_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t tournaments;
  v_c media_challenges;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_dog_id is not null and not owns_dog(p_dog_id) then raise exception 'not_your_dog'; end if;
  select * into v_t from tournaments where private and invite_code = upper(btrim(coalesce(p_code, '')));
  if v_t.id is null then raise exception 'code_not_found'; end if;
  if tournament_phase(v_t) not in ('registration', 'active') then raise exception 'battle_over'; end if;
  if not exists (select 1 from tournament_participants where tournament_id = v_t.id and user_id = auth.uid())
     and (select count(*) from tournament_participants where tournament_id = v_t.id and status = 'joined') >= 20 then
    raise exception 'battle_full';
  end if;
  insert into tournament_participants (tournament_id, user_id, dog_id) values (v_t.id, auth.uid(), p_dog_id)
  on conflict (tournament_id, user_id) do update set status = 'joined', dog_id = coalesce(excluded.dog_id, tournament_participants.dog_id);
  select * into v_c from media_challenges where tournament_id = v_t.id;
  return jsonb_build_object('tournamentId', v_t.id, 'code', v_t.invite_code, 'gameType', v_t.game_type, 'challengeId', v_c.id, 'endsAt', v_t.ends_at);
end;
$$;
revoke execute on function public.join_friend_battle(text, uuid) from public, anon;
grant execute on function public.join_friend_battle(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Challenge lists: public weeks plus your own friend battles; opens the week if it isn't open yet
-- ---------------------------------------------------------------------------------------------------------------

drop function if exists public.media_challenge_list(public.tournament_game);
create function public.media_challenge_list(p_game public.tournament_game)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  if auth.uid() is not null then perform open_weekly_challenges(now()); end if;
  select coalesce(jsonb_agg(row order by (row ->> 'startsAt')), '[]'::jsonb) into v_out
  from (
    select jsonb_build_object(
      'challengeId', c.id, 'tournamentId', t.id, 'name', t.name, 'title', c.title, 'brief', c.brief, 'instructions', c.instructions,
      'mediaKind', c.media_kind, 'private', t.private, 'inviteCode', case when t.private then t.invite_code end,
      'players', (select count(*) from tournament_participants p where p.tournament_id = t.id and p.status = 'joined'),
      'requiresOwner', c.requires_owner, 'referencePath', c.reference_path, 'phase', media_phase(c.id),
      'registrationOpensAt', t.registration_opens_at, 'startsAt', t.starts_at, 'entriesCloseAt', c.entries_close_at, 'endsAt', t.ends_at,
      'joined', exists (select 1 from tournament_participants p where p.tournament_id = t.id and p.user_id = auth.uid() and p.status = 'joined'),
      'entries', (select count(*) from media_submissions s where s.challenge_id = c.id and s.status = 'approved' and not s.hidden_by_reports),
      'myEntry', (select jsonb_build_object('id', s.id, 'status', s.status, 'heldReason', s.held_reason, 'mediaPath', s.media_path, 'posterPath', s.poster_path,
          'reviewRequested', s.review_requested_at is not null, 'rejectionReason', s.rejection_reason, 'hiddenByReports', s.hidden_by_reports)
        from media_submissions s where s.challenge_id = c.id and s.user_id = auth.uid() and s.status <> 'withdrawn'
        order by s.submitted_at desc limit 1),
      'myVote', (select v.submission_id from media_votes v where v.challenge_id = c.id and v.voter_id = auth.uid()),
      'serverNow', now()
    ) as row
    from media_challenges c join tournaments t on t.id = c.tournament_id
    where t.game_type = p_game and t.ends_at > now() - interval '30 days'
      and (not t.private or exists (select 1 from tournament_participants p where p.tournament_id = t.id and p.user_id = auth.uid()))
  ) list;
  return v_out;
end;
$$;
revoke execute on function public.media_challenge_list(public.tournament_game) from public, anon;
grant execute on function public.media_challenge_list(public.tournament_game) to authenticated;

-- A friend battle's gallery and results are its players' business only (public weeks: anyone who joined, as before).

-- Joining by id stays for public tournaments; a friend battle needs its code (join_friend_battle).
create or replace function public.join_tournament(p_tournament_id uuid, p_dog_id uuid)
returns public.tournament_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t tournaments;
  v_row tournament_participants;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_dog_id is not null and not owns_dog(p_dog_id) then raise exception 'not_your_dog'; end if;
  select * into v_t from tournaments where id = p_tournament_id;
  if v_t.id is null then raise exception 'tournament_not_found'; end if;
  if v_t.private and not exists (select 1 from tournament_participants where tournament_id = v_t.id and user_id = auth.uid()) then
    raise exception 'code_needed';
  end if;
  if tournament_phase(v_t) not in ('registration', 'active') then raise exception 'registration_closed'; end if;

  insert into tournament_participants (tournament_id, user_id, dog_id)
  values (p_tournament_id, auth.uid(), p_dog_id)
  on conflict (tournament_id, user_id) do update set status = 'joined', dog_id = coalesce(excluded.dog_id, tournament_participants.dog_id)
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.join_tournament(uuid, uuid) from anon;

-- Clips share the entries bucket: up to 40 MB, MP4 or QuickTime (iPhone records QuickTime; the app names it .mp4).
update storage.buckets
   set file_size_limit = 41943040, allowed_mime_types = array['image/jpeg', 'video/mp4', 'video/quicktime']
 where id = 'media-entries';
