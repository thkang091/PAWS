-- Online games against real PostgreSQL: weekly weeks open once per game, friend battles are private copies joined by
-- code, challenge lists show your own battles only, clips record their still frame. Everything is rolled back.
begin;

create function pg_temp.raises(stmt text, expected text) returns boolean language plpgsql as $$
begin
  execute stmt;
  raise notice 'expected %, got no error', expected;
  return false;
exception when others then
  if sqlerrm !~ expected then raise notice 'expected %, got %', expected, sqlerrm; return false; end if;
  return true;
end;
$$;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(u::text, ''), true), set_config('request.jwt.claim.role', case when u is null then '' else 'authenticated' end, true);
$$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 3));
  wk date := date_trunc('week', timestamptz '2031-03-05 12:00+00' at time zone 'utc')::date;
  n integer;
  b jsonb;
  j jsonb;
  t uuid;
  c uuid;
  list jsonb;
  v jsonb;
begin
  for i in 1..3 loop insert into auth.users (id, email) values (u[i], 'og' || i || '@test.paws'); end loop;

  -- ===== The weekly opener =====
  n := public.open_weekly_challenges(timestamptz '2031-03-05 12:00+00');
  assert n = 4, 'a new week opens all three games (and a new month its Seasonal Selfie)';
  assert public.open_weekly_challenges(timestamptz '2031-03-06 09:00+00') = 0, 'and only once';
  assert (select count(*) from public.tournaments where auto_week = wk) = 3, 'one week per game';
  select c2.id into c from public.media_challenges c2 join public.tournaments t2 on t2.id = c2.tournament_id where t2.auto_week = wk and t2.game_type = 'photo_pose';
  assert c is not null and (select jsonb_array_length(instructions -> 'steps') >= 2 from public.media_challenges where id = c), 'Photo Pose opens with a pose and its steps';
  assert (select media_kind = 'video' and not requires_owner and entries_close_at = (wk::timestamp at time zone 'utc') + interval '4 days'
          from public.media_challenges c2 join public.tournaments t2 on t2.id = c2.tournament_id where t2.auto_week = wk and t2.game_type = 'dog_reels'),
    'Dog Reels opens a clip challenge, entries until Friday';
  assert (select starts_at = wk::timestamp at time zone 'utc' and ends_at = (wk::timestamp at time zone 'utc') + interval '7 days'
          from public.tournaments where auto_week = wk and game_type = 'largest_country'), 'Largest Country runs Monday to Monday';
  raise notice 'pass  weekly opener: three games, once a week';

  -- ===== Friend battles =====
  perform pg_temp.as_user(u[1]);
  b := public.create_friend_battle('photo_pose', null);
  t := (b ->> 'tournamentId')::uuid;
  assert length(b ->> 'code') = 6 and (b ->> 'challengeId') is not null, 'a battle has a code and its own challenge';
  assert (select private and invite_code = b ->> 'code' and ends_at - starts_at = interval '3 days' from public.tournaments where id = t), 'private, three days';
  assert (select m.title = src.title from public.media_challenges m, public.media_challenges src join public.tournaments st on st.id = src.tournament_id
          where m.id = (b ->> 'challengeId')::uuid and st.game_type = 'photo_pose' and st.auto_week = date_trunc('week', now() at time zone 'utc')::date),
    'the same pose as this week';
  assert pg_temp.raises(format('select public.create_friend_battle(%L, null)', 'steal_road'), 'bad_request'), 'online games only';

  -- An outsider can't see it, in lists or by reading the table.
  perform pg_temp.as_user(u[2]);
  list := public.media_challenge_list('photo_pose');
  assert not exists (select 1 from jsonb_array_elements(list) e where (e ->> 'tournamentId')::uuid = t), 'not in an outsider''s list';
  set local role authenticated;
  assert (select count(*) from public.tournaments where id = t) = 0, 'not readable by an outsider';
  reset role;
  perform pg_temp.as_user(u[2]);
  assert pg_temp.raises(format('select public.join_friend_battle(%L, null)', 'ZZZZZZ'), 'code_not_found'), 'a wrong code is refused';
  assert pg_temp.raises(format('select public.join_tournament(%L, null)', t), 'code_needed'), 'no joining a battle by its id';
  j := public.join_friend_battle(lower(b ->> 'code'), null);
  assert (j ->> 'tournamentId')::uuid = t and j ->> 'gameType' = 'photo_pose', 'joined with the code, any case';
  list := public.media_challenge_list('photo_pose');
  select e into v from jsonb_array_elements(list) e where (e ->> 'tournamentId')::uuid = t;
  assert (v ->> 'private')::boolean and v ->> 'inviteCode' = b ->> 'code' and (v ->> 'players')::int = 2 and (v ->> 'joined')::boolean, 'in the list once joined, with its code';
  set local role authenticated;
  assert (select count(*) from public.tournaments where id = t) = 1, 'readable once joined';
  reset role;
  perform pg_temp.as_user(u[2]);
  perform public.join_friend_battle(b ->> 'code', null);
  assert (select count(*) from public.tournament_participants where tournament_id = t) = 2, 'joining twice keeps one place';

  perform pg_temp.as_user(u[1]);
  b := public.create_friend_battle('largest_country', null);
  assert (b ->> 'challengeId') is null and (select private from public.tournaments where id = (b ->> 'tournamentId')::uuid), 'Largest Country battles have no media challenge';
  raise notice 'pass  friend battles: private, joined by code, listed for players only';

  -- ===== Clips =====
  b := public.create_friend_battle('dog_reels', null);
  c := (b ->> 'challengeId')::uuid;
  assert (select media_kind = 'video' from public.media_challenges where id = c), 'a reels battle takes clips';
  j := public.record_media_video(c, u[1], null, u[1] || '/' || c || '/clip.mp4', u[1] || '/' || c || '/clip.jpg', 720, 1280, 2000000, 14800);
  assert (select poster_path like '%clip.jpg' and duration_ms = 14800 from public.media_submissions where id = (j -> 'submission' ->> 'id')::uuid), 'still frame and length recorded';
  assert pg_temp.raises(format('select public.record_media_video(%L, %L, null, %L, %L, 1, 1, 1, 1)', c, u[1], u[1] || '/x.mp4', u[2] || '/x.jpg'), 'not_your_file'), 'only your own files';
  raise notice 'pass  clips: still frame recorded, own files only';
end;
$$;

rollback;
