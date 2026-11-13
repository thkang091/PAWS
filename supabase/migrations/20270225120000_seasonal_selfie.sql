-- Seasonal Selfie: a theme for each month (Halloween in October, holidays in December and so on). The weekly opener
-- now also opens the month's challenge: a photo of you and your dog, entries all month, the last week to vote.

create table if not exists public.seasonal_themes (
  id uuid primary key default gen_random_uuid(),
  month integer not null unique check (month between 1 and 12),
  season text not null check (season in ('winter', 'spring', 'summer', 'autumn')),
  title text not null check (char_length(title) between 3 and 48),
  brief text not null check (char_length(brief) between 10 and 200),
  steps text[] not null check (cardinality(steps) between 2 and 6),
  check_label text not null,
  safety text[] not null default '{}',
  active boolean not null default true
);
alter table public.seasonal_themes enable row level security;
drop policy if exists seasonal_themes_read on public.seasonal_themes;
create policy seasonal_themes_read on public.seasonal_themes for select to authenticated using (active);

insert into public.seasonal_themes (month, season, title, brief, steps, check_label, safety) values
  (1, 'winter', 'Snow day selfie', 'A cold-weather selfie of you and your dog, snow or no snow.', array['Wrap up warm', 'Find some frost, snow or a winter sky', 'Get close for the selfie'], 'The person and the dog are dressed or posed for winter', array['Short outings in the cold', 'Wipe paws after salted paths']),
  (2, 'winter', 'Be my valentine', 'A loving selfie: hearts, hugs or a red scarf.', array['Add something red or a heart', 'Cuddle up close', 'Smile for the selfie'], 'The photo shows a heart, something red, or a hug', array['No chocolate near your dog']),
  (3, 'spring', 'First blossom', 'You and your dog with the first flowers of spring.', array['Find blossom or spring flowers', 'Stand or sit beside them', 'Take the selfie'], 'Flowers or blossom are in the photo', array['Some plants are toxic to dogs: look, don''t chew']),
  (4, 'spring', 'Rainy day', 'Puddles, raincoats and umbrellas.', array['Grab a raincoat or umbrella', 'Find a puddle or rain', 'Take the selfie under cover'], 'A raincoat, an umbrella or rain is in the photo', array['Dry your dog off after']),
  (5, 'spring', 'Picnic pals', 'A picnic selfie on a blanket in the sun.', array['Lay out a blanket', 'Sit together', 'Take the selfie'], 'A blanket or picnic is in the photo', array['Keep human food out of reach']),
  (6, 'summer', 'Summer shade', 'A sunny selfie, in the shade.', array['Find a shady spot', 'Bring water for both of you', 'Take the selfie'], 'The person and the dog are outdoors in summer light or shade', array['Avoid hot pavements and midday heat']),
  (7, 'summer', 'Splash', 'Water fun: a paddle, a sprinkler or a beach.', array['Find safe, shallow water', 'Let your dog splash', 'Take the selfie'], 'Water is in the photo', array['Only safe, shallow water', 'Never leave your dog in the water alone']),
  (8, 'summer', 'Golden hour', 'A sunset selfie on your evening walk.', array['Walk at sunset', 'Face the low sun', 'Take the selfie'], 'The photo has sunset or evening light', array['Bright collar or lead after dark']),
  (9, 'autumn', 'Back to routine', 'A back-to-school or back-to-work selfie.', array['Bring a backpack, book or desk', 'Pose together', 'Take the selfie'], 'A backpack, book or desk is in the photo', array['Keep it calm and quick']),
  (10, 'autumn', 'Halloween costume', 'Dress up for Halloween: a costume, a hat or a pumpkin.', array['Pick a comfy costume or a pumpkin prop', 'Pose together', 'Take the selfie'], 'A costume, a hat or a pumpkin is in the photo', array['Only costumes your dog is happy in', 'Never cover eyes, nose or mouth']),
  (11, 'autumn', 'Autumn leaves', 'You and your dog in the falling leaves.', array['Find a pile of leaves or autumn trees', 'Sit or play in them', 'Take the selfie'], 'Autumn leaves are in the photo', array['Check leaf piles for sticks first']),
  (12, 'winter', 'Holiday sweater', 'Festive jumpers, lights or a tree.', array['Wear something festive', 'Find lights or a tree', 'Take the selfie'], 'Something festive is in the photo: a sweater, lights or a tree', array['Keep cables and decorations out of reach'])
on conflict (month) do nothing;

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
  v_month date := date_trunc('month', v_now at time zone 'utc')::date;
  v_mstart timestamptz := (v_month::timestamp at time zone 'utc');
  v_mend timestamptz := ((v_month + interval '1 month')::timestamp at time zone 'utc');
  v_season seasonal_themes;
  v_t tournaments;
  v_pose photo_pose_concepts;
  v_theme reel_themes;
  v_c media_challenges;
  v_opened integer := 0;
begin
  if exists (select 1 from tournaments where auto_week = v_week and game_type = 'largest_country')
     and exists (select 1 from tournaments where auto_week = v_week and game_type = 'photo_pose')
     and exists (select 1 from tournaments where auto_week = v_week and game_type = 'dog_reels')
     and exists (select 1 from tournaments where auto_week = v_month and game_type = 'seasonal_selfie') then
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
  -- This month's Seasonal Selfie: photos all month, the last week to vote.
  if not exists (select 1 from tournaments where auto_week = v_month and game_type = 'seasonal_selfie') then
    select * into v_season from seasonal_themes where month = extract(month from v_month)::integer and active;
    if v_season.id is not null then
      insert into tournaments (game_type, mode, name, description, registration_opens_at, starts_at, ends_at, auto_week)
      values ('seasonal_selfie', 'online', 'Seasonal Selfie', v_season.brief, v_mstart, v_mstart, v_mend, v_month) returning * into v_t;
      insert into media_challenges (tournament_id, media_kind, title, brief, instructions, requires_owner, entries_close_at)
      values (v_t.id, 'photo', v_season.title, v_season.brief,
        jsonb_build_object('seasonId', v_season.id, 'season', v_season.season, 'steps', to_jsonb(v_season.steps), 'safety', to_jsonb(v_season.safety),
          'framing', 'You and your dog together', 'criteria', jsonb_build_array(jsonb_build_object('id', 'season', 'label', v_season.check_label, 'kind', 'pose'))),
        true, v_mend - interval '7 days');
      v_opened := v_opened + 1;
    end if;
  end if;
  return v_opened;
end;
$$;

-- Best of the week names each photo or reel game by its own type (it used to count every media entry as Photo Pose).
create or replace function public.games_of_the_week(p_since timestamptz default null, p_limit integer default 5)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_since timestamptz := coalesce(p_since, date_trunc('week', now()));
  v_sql text;
  v_out jsonb;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  -- No reaching back further than a month: this is a weekly board, not a history.
  if v_since < now() - interval '35 days' then v_since := now() - interval '35 days'; end if;

  v_sql := $q$
    select 'challenge:' || a.challenge_game_id::text as game, a.owner_id as user_id, null::numeric as minutes
      from challenge_game_attempts a where a.created_at >= $1
    union all
    select t.game_type::text, s.user_id,
           coalesce(s.elapsed_seconds, extract(epoch from (s.ended_at - s.started_at)))::numeric / 60
      from gps_sessions s join tournaments t on t.id = s.tournament_id
      where s.started_at >= $1 and s.status <> 'cancelled'
    union all
    select m.game_type, tm.user_id, m.duration_minutes::numeric
      from battle_matches m join battle_team_members tm on tm.match_id = m.id
      where m.starts_at >= $1 and m.status <> 'cancelled'
    union all
    select 'find_mafia', ra.user_id, extract(epoch from (coalesce(r.finished_at, r.voting_ends_at) - r.started_at))::numeric / 60
      from mafia_rounds r join mafia_role_assignments ra on ra.round_id = r.id
      where r.started_at >= $1 and r.status <> 'cancelled'
    union all
    select 'number_trail', na.user_id, extract(epoch from (coalesce(nm.completed_at, nm.ends_at) - nm.starts_at))::numeric / 60
      from number_trail_matches nm join number_trail_assignments na on na.match_id = nm.id
      where nm.starts_at >= $1 and nm.status <> 'cancelled'
    union all
    select mt.game_type::text, ms.user_id, null::numeric
      from media_submissions ms join tournaments mt on mt.id = ms.tournament_id where ms.submitted_at >= $1
  $q$;
  if to_regclass('public.arena_attempts') is not null then
    v_sql := v_sql || $q$
      union all
      select aa.game::text, aa.owner_id, aa.clip_ms::numeric / 60000
        from arena_attempts aa where aa.created_at >= $1
    $q$;
  end if;

  execute format($f$
    with plays as (%s),
    per_player as (select game, user_id, count(*) as n from plays group by game, user_id),
    ranked as (
      select p.game,
             count(*) as plays,
             count(distinct p.user_id) as players,
             round(coalesce(sum(greatest(p.minutes, 0)), 0))::integer as minutes,
             (select count(*) from per_player pp where pp.game = p.game and pp.n >= 2) as returning_players
        from plays p group by p.game
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'game', r.game,
             'title', cg.title,
             'plays', r.plays,
             'players', r.players,
             'minutes', r.minutes,
             'returningPlayers', r.returning_players
           ) order by r.plays desc, r.minutes desc, r.returning_players desc, r.game), '[]'::jsonb)
      from (select * from ranked order by plays desc, minutes desc, returning_players desc, game limit $2) r
      left join challenge_games cg on r.game = 'challenge:' || cg.id::text
  $f$, v_sql) into v_out using v_since, least(greatest(coalesce(p_limit, 5), 1), 20);

  return jsonb_build_object('since', v_since, 'games', v_out);
end;
$$;
