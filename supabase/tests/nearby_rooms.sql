-- Nearby rooms, room first, against real PostgreSQL: a room made before its game, QR versus remote (code) invites,
-- picking and changing the game, and the start rule (host, first place, last place) driven by recorded wins.
-- Run after the migrations. Everything is rolled back.
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
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 5));
  r jsonb;
  room uuid;
  m uuid;
begin
  for i in 1..5 loop insert into auth.users (id, email) values (u[i], 'n' || i || '@test.paws'); end loop;

  -- ===== A room before its game =====
  perform pg_temp.as_user(u[1]);
  r := public.create_room(null, 'Park crew', 10, false, 10, true, null, 'Ari');
  room := (r ->> 'roomId')::uuid;
  assert (select game_type is null and start_permission = 'host' and remote_invite from public.multiplayer_rooms where id = room), 'no game yet, host starts, the code works';
  perform public.set_room_options(room, null, false);
  assert r ? 'token' and r ? 'code', 'QR token and code issued';

  -- ===== QR always, code only with remote invite =====
  perform pg_temp.as_user(u[2]);
  assert pg_temp.raises(format('select public.join_room(%L, null, null, %L)', r ->> 'code', 'Bo'), 'remote_invite_off'), 'code join refused while remote invite is off';
  perform public.join_room(null, r ->> 'token', null, 'Bo');
  assert (select count(*) from public.room_members where room_id = room and left_at is null) = 2, 'QR join works';
  perform pg_temp.as_user(u[2]);
  assert pg_temp.raises(format('select public.set_room_options(%L, %L, true)', room, 'host'), 'not_the_host'), 'only the host changes options';
  perform pg_temp.as_user(u[1]);
  perform public.set_room_options(room, null, true);
  perform pg_temp.as_user(u[3]);
  perform public.join_room(r ->> 'code', null, null, 'Cy');
  assert (select count(*) from public.room_members where room_id = room and left_at is null) = 3, 'code join works with remote invite on';
  raise notice 'pass  QR join always; code join only while the host allows remote invites';

  -- ===== Picking and changing the game =====
  perform pg_temp.as_user(u[2]);
  perform public.set_room_ready(room, true);
  assert pg_temp.raises(format('select public.set_room_game(%L, %L)', room, 'steal_territory'), 'not_the_host'), 'host picks the game';
  perform pg_temp.as_user(u[1]);
  perform public.set_room_game(room, 'steal_territory');
  assert (select game_type::text from public.multiplayer_rooms where id = room) = 'steal_territory', 'game set';
  assert not (select ready from public.room_members where room_id = room and user_id = u[2]), 'a new game asks everyone to be ready again';
  perform public.set_room_game(room, 'find_mafia');
  assert (select max_players >= 4 from public.multiplayer_rooms where id = room), 'Find the Mafia keeps room for four';
  perform public.set_room_game(room, 'number_trail');
  m := (public.number_create_match(room, 25, null) ->> 'matchId')::uuid;
  perform public.set_room_game(room, 'steal_road');
  assert (select status from public.number_trail_matches where id = m) = 'cancelled', 'an unprepared Number Trail race is dropped when the game changes';
  perform public.set_room_game(room, 'number_trail');
  m := (public.number_create_match(room, 25, null) ->> 'matchId')::uuid;
  perform public.set_room_game(room, null);
  assert (select game_type from public.multiplayer_rooms where id = room) is null, 'the host can put the room back to picking';
  assert (select status from public.number_trail_matches where id = m) = 'cancelled', 'and the unprepared race is dropped';
  perform public.set_room_game(room, 'steal_territory');
  raise notice 'pass  host picks and changes the game while nothing runs';

  -- ===== Who starts: host, first place, last place, from recorded wins =====
  assert public.room_starter(room) = u[1], 'host starts by default';
  perform public.set_room_options(room, 'first', null);
  assert public.room_starter(room) = u[1], 'everyone tied at 0: the host is in the tie';
  -- A finished battle in this room that Bo's team won.
  insert into public.battle_matches (id, room_id, game_type, status, duration_minutes) values (gen_random_uuid(), room, 'steal_territory', 'completed', 10) returning id into m;
  insert into public.battle_teams (match_id, team, score) values (m, 'blue', 900), (m, 'orange', 300);
  insert into public.battle_team_members (match_id, user_id, team, display_name) values (m, u[2], 'blue', 'Bo'), (m, u[1], 'orange', 'Ari'), (m, u[3], 'orange', 'Cy');
  assert (public.room_scores(room) ->> u[2]::text)::int = 1 and (public.room_scores(room) ->> u[1]::text)::int = 0, 'scores from the recorded result';
  assert public.room_starter(room) = u[2], 'first place starts';
  perform public.set_room_options(room, 'last', null);
  assert public.room_starter(room) = u[1], 'last place: tied at 0, the host is in the tie';
  perform pg_temp.as_user(u[3]);
  assert pg_temp.raises(format('select public.start_battle(%L)', room), 'not_your_turn_to_start'), 'someone else can''t start';
  perform pg_temp.as_user(u[1]);
  perform public.set_room_options(room, 'first', null);
  assert pg_temp.raises(format('select public.start_battle(%L)', room), 'not_your_turn_to_start'), 'the host can''t start when first place starts';
  perform pg_temp.as_user(u[2]);
  assert pg_temp.raises(format('select public.start_battle(%L)', room), 'teams_not_set'), 'first place may start (here stopped by the teams rule, after the start check)';
  raise notice 'pass  start rule: host, first place, last place, from recorded wins';

  -- ===== Online rooms: Number Trail only, joined by code, the race made by the starter with the room's settings =====
  perform pg_temp.as_user(u[4]);
  r := public.create_room(null, 'Anywhere crew', 10, false, 10, true, null, 'Di', 'online');
  room := (r ->> 'roomId')::uuid;
  assert (select play_mode = 'online' and game_type = 'number_trail' and remote_invite from public.multiplayer_rooms where id = room), 'online room: Number Trail, code joins on';
  assert pg_temp.raises(format('select public.set_room_game(%L, %L)', room, 'steal_road'), 'online_number_only'), 'online rooms play Number Trail only';
  assert pg_temp.raises(format('select public.set_room_game(%L, null)', room), 'online_number_only'), 'and keep it';
  assert pg_temp.raises(format('select public.create_room(null, %L, 10, false, 10, true, null, %L, %L)', 'x', 'Di', 'space'), 'bad_request|already_in_room'), 'known modes only';
  perform pg_temp.as_user(u[5]);
  perform public.join_room(r ->> 'code', null, null, 'Ed');
  perform pg_temp.as_user(u[4]);
  perform public.set_room_options(room, null, null, 'long', false);
  assert pg_temp.raises(format('select public.set_room_options(%L, null, null, %L, null)', room, 'marathon'), 'bad_category'), 'known distances only';
  perform pg_temp.as_user(u[5]);
  assert pg_temp.raises(format('select public.number_create_online_match(%L, null, null)', room), 'not_your_turn_to_start'), 'only the starter makes the race';
  perform pg_temp.as_user(u[4]);
  m := (public.number_create_online_match(room, null, null) ->> 'matchId')::uuid;
  assert (select mode = 'online' and distance_category = 'long' and target_distance_m = 2500 and not ranked and requested_number is null from public.number_trail_matches where id = m), 'race made with the room''s distance and ranking, number picked later';
  raise notice 'pass  online rooms: Number Trail only, code join, starter makes the race with the room settings';
end;
$$;

rollback;
