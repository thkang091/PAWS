-- Number Trail phases P1 to P3 against real PostgreSQL + PostGIS: official course length from geometry, candidate
-- storage, private practice, and cross-city races (same number, matched distances, check-in at your own start,
-- per-player course privacy). Run as a database administrator after the migrations. Everything is rolled back.
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
-- A straight north-going street of about `m` metres from (lat, lng), as [lng, lat] pairs.
create function pg_temp.street(lat float8, lng float8, m float8) returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_array(lng, lat), jsonb_build_array(lng, lat + m / 111000.0));
$$;
-- A course for `n` near (lat, lng): one edge per digit of `d1`/`d2` metres, a connector of `c` metres (two digits),
-- and optionally one edge walked twice. raceM is set to the PostGIS length, as the engine's own measure would be.
create function pg_temp.course(n text, lat float8, lng float8, d1 float8, d2 float8 default 0, c float8 default 0, repeat_first boolean default false) returns jsonb language plpgsql as $$
declare
  v jsonb;
  digits jsonb := jsonb_build_array(jsonb_build_object('digit', substr(n, 1, 1), 'edges', jsonb_build_array(jsonb_build_object('edgeId', 'osm:w1:1-2', 'segment', 'B', 'coords', pg_temp.street(lat, lng, d1), 'lengthM', d1)),
    'corners', '[]'::jsonb, 'repeatEdgeIds', case when repeat_first then '["osm:w1:1-2"]'::jsonb else '[]'::jsonb end, 'start', jsonb_build_object('latitude', lat, 'longitude', lng)));
begin
  if length(n) = 2 then
    digits := digits || jsonb_build_array(jsonb_build_object('digit', substr(n, 2, 1), 'edges', jsonb_build_array(jsonb_build_object('edgeId', 'osm:w2:3-4', 'segment', 'B', 'coords', pg_temp.street(lat, lng + 0.01, d2), 'lengthM', d2)),
      'corners', '[]'::jsonb, 'repeatEdgeIds', '[]'::jsonb));
  end if;
  v := jsonb_build_object('number', n, 'digits', digits, 'start', jsonb_build_object('nodeId', 'osm:n1', 'latitude', lat, 'longitude', lng),
    'connector', case when length(n) = 2 then jsonb_build_array(jsonb_build_object('edgeId', 'osm:w3:5-6', 'coords', pg_temp.street(lat, lng + 0.005, c))) else '[]'::jsonb end);
  return v || jsonb_build_object('raceM', (public.number_course_official(v) ->> 'totalM')::float8);
end;
$$;
create function pg_temp.cand(course jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object('course', course, 'raceM', (course ->> 'raceM')::float8, 'approachM', 120);
$$;
create function pg_temp.shift(m uuid, secs integer) returns void language plpgsql as $$
begin
  alter table public.number_trail_matches disable trigger number_trail_matches_guard;
  update public.number_trail_matches set countdown_at = countdown_at - make_interval(secs => secs), starts_at = starts_at - make_interval(secs => secs), ends_at = ends_at - make_interval(secs => secs) where id = m;
  alter table public.number_trail_matches enable trigger number_trail_matches_guard;
end;
$$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 12));
  o jsonb;
  r jsonb;
  room uuid;
  m uuid;
  c1 uuid;
  c2 uuid;
  x jsonb;
  n integer;
  s jsonb;
  pr uuid;
begin
  for i in 1..12 loop insert into auth.users (id, email) values (u[i], 'p' || i || '@test.paws'); end loop;

  -- ===== Official length (PostGIS) =====
  o := public.number_course_official(pg_temp.course('42', 37.77, -122.42, 600, 700, 200));
  assert abs((o ->> 'totalM')::float8 - 1500) < 15, 'official total near 1.5 km';
  assert jsonb_array_length(o -> 'digitM') = 2 and abs((o -> 'digitM' ->> 0)::float8 - 600) < 6 and abs((o ->> 'connectorM')::float8 - 200) < 2, 'digit and connector lengths';
  o := public.number_course_official(pg_temp.course('3', 37.77, -122.42, 500, 0, 0, true));
  assert jsonb_array_length(o -> 'digitM') = 1 and (o ->> 'connectorM')::float8 = 0, 'single digit: no second digit, no connector';
  assert abs((o ->> 'repeatedM')::float8 - (o -> 'digitM' ->> 0)::float8 / 2) < 1 and abs((o ->> 'totalM')::float8 - 2 * 500) < 10, 'a repeated stroke counts twice';
  assert o ->> 'method' = 'postgis-geography-length-v1', 'method recorded';
  -- An exact-length course: the finish stretch after the last digit counts, and only once.
  o := public.number_course_official(pg_temp.course('42', 37.77, -122.42, 500, 600, 200)
    || jsonb_build_object('finish', jsonb_build_array(jsonb_build_object('edgeId', 'osm:w9:1-2', 'coords', pg_temp.street(37.78, -122.41, 200)))));
  assert abs((o ->> 'finishM')::float8 - 200) < 2 and abs((o ->> 'totalM')::float8 - 1500) < 15, 'finish stretch included in the official length';
  assert (public.number_course_official(pg_temp.course('42', 37.77, -122.42, 600, 700, 200)) ->> 'finishM')::float8 = 0, 'no finish stretch: 0';
  raise notice 'pass  official course length from geometry, repeats, connector and finish stretch included';

  -- ===== Practice =====
  x := public.number_store_candidates(u[1], 'practice', null, '7', jsonb_build_array(pg_temp.cand(pg_temp.course('7', 37.77, -122.42, 900)),
    jsonb_set(pg_temp.cand(pg_temp.course('7', 37.77, -122.42, 900)), '{raceM}', '300')), 1000, 'osm', '[]');
  assert jsonb_array_length(x -> 'candidates') = 1 and (x ->> 'skipped')::int = 1, 'a candidate whose length disagrees with PostGIS is not stored';
  c1 := (x -> 'candidates' -> 0 ->> 'id')::uuid;
  assert pg_temp.raises(format('select public.number_store_candidates(%L, %L, null, %L, %L, 1000, %L, %L)', u[1], 'practice', '07', '[]', 'osm', '[]'), 'bad_number'), 'non-canonical number refused';
  assert pg_temp.raises(format('select public.number_store_candidates(%L, %L, null, %L, %L, 1000, %L, %L)', u[1], 'practice', '8', jsonb_build_array(pg_temp.cand(pg_temp.course('7', 37.77, -122.42, 900))), 'osm', '[]'), 'bad_number'), 'a course for another number refused';
  assert pg_temp.raises(format('select public.number_practice_begin(%L, %L)', u[2], c1), 'not_found'), 'someone else''s candidate';
  x := public.number_practice_begin(u[1], c1);
  pr := (x ->> 'practiceId')::uuid;
  assert (select count(*) from public.gps_sessions where number_practice_id = pr and user_id = u[1] and status = 'active') = 1, 'practice walk opened';
  assert public.number_practice_context(pr, u[2]) is null, 'another player has no practice context';
  perform public.number_store_points((x ->> 'sessionId')::uuid, '[{"seq": 1, "segment": 0, "latitude": 37.77, "longitude": -122.42, "accuracyM": 5, "capturedAt": 1800000000000}]'::jsonb);
  assert jsonb_array_length(public.number_practice_points(pr, u[1])) = 1 and jsonb_array_length(public.number_practice_points(pr, u[2])) = 0, 'points private';
  x := public.number_practice_finish(pr, u[1], true, '{"coverage": 0.95}');
  assert x ->> 'status' = 'finished' and (x ->> 'verified')::boolean, 'finished, verified';
  x := public.number_practice_finish(pr, u[1], false, '{"coverage": 0}');
  assert (x ->> 'verified')::boolean and x -> 'result' ->> 'coverage' = '0.95', 'a finished practice keeps its first result';
  assert (select count(*) from public.number_trail_results where user_id = u[1]) = 0 and (select count(*) from public.number_trail_assignments where user_id = u[1]) = 0
    and (select count(*) from public.number_trail_matches where created_by = u[1]) = 0, 'practice touches no race or result';
  assert pg_temp.raises(format('insert into public.gps_sessions (user_id, number_practice_id, number_match_id) values (%L, %L, %L)', u[1], pr, gen_random_uuid()), 'gps_sessions_owner_check|foreign key'), 'a walk has one owner';
  execute 'set local role authenticated';
  perform pg_temp.as_user(u[2]);
  assert (select count(*) from public.number_practice_sessions) = 0 and (select count(*) from public.number_course_candidates) = 0, 'RLS: others'' practice and candidates are invisible';
  perform pg_temp.as_user(u[1]);
  assert (select count(*) from public.number_practice_sessions) = 1, 'RLS: own practice visible';
  update public.number_practice_sessions set verified = false;
  get diagnostics n = row_count;
  assert n = 0, 'players cannot edit practice results';
  update public.number_course_candidates set official_total_m = 1;
  get diagnostics n = row_count;
  assert n = 0, 'players cannot forge official lengths';
  execute 'reset role';
  raise notice 'pass  practice: own candidates only, PostGIS lengths, private points, idempotent result, no standings';

  -- ===== Online: Test A, matched within tolerance =====
  perform pg_temp.as_user(u[3]);
  r := public.create_room('number_trail', 'Cross-city 42', 10, false, 10, true, null, 'Virginia');
  room := (r ->> 'roomId')::uuid;
  perform pg_temp.as_user(u[4]);
  perform public.join_room(r ->> 'code', null, null, 'California');
  perform pg_temp.as_user(u[3]);
  assert pg_temp.raises(format('select public.number_create_online_match(%L, %L, %L)', room, '042', 'standard'), 'bad_number'), 'online number must be canonical';
  assert pg_temp.raises(format('select public.number_create_online_match(%L, %L, %L)', room, '42', 'marathon'), 'bad_category'), 'known category only';
  perform pg_temp.as_user(u[4]);
  assert pg_temp.raises(format('select public.number_create_online_match(%L, %L, %L)', room, '42', 'standard'), 'not_your_turn_to_start'), 'only the room''s starter makes the race';
  perform pg_temp.as_user(u[3]);
  m := (public.number_create_online_match(room, '42', 'standard') ->> 'matchId')::uuid;
  assert (select mode = 'online' and target_number = '42' and requested_number = '42' and target_distance_m = 1500 and minutes = 25 from public.number_trail_matches where id = m), 'online match with the host''s number';
  assert pg_temp.raises(format('select public.number_store_candidates(%L, %L, %L, %L, %L, 1000, %L, %L)', u[3], 'online', m, '42', '[]', 'osm', '[]'), 'match_not_editable'), 'no candidates before the search starts';
  perform public.number_online_start_search(m);
  assert (select status from public.number_trail_matches where id = m) = 'course_search', 'searching';
  assert pg_temp.raises(format('select public.number_store_candidates(%L, %L, %L, %L, %L, 1000, %L, %L)', u[3], 'online', m, '27', '[]', 'osm', '[]'), 'bad_number'), 'only the race''s number';
  assert pg_temp.raises(format('select public.number_store_candidates(%L, %L, %L, %L, %L, 1000, %L, %L)', u[9], 'online', m, '42', '[]', 'osm', '[]'), 'not_in_room'), 'members only';
  x := public.number_store_candidates(u[3], 'online', m, '42', jsonb_build_array(pg_temp.cand(pg_temp.course('42', 38.9, -77.0, 600, 700, 200))), 1000, 'osm', '[]');
  c1 := (x -> 'candidates' -> 0 ->> 'id')::uuid;
  x := public.number_store_candidates(u[4], 'online', m, '42', jsonb_build_array(pg_temp.cand(pg_temp.course('42', 34.0, -118.3, 595, 697, 195))), 1000, 'osm', '[]');
  c2 := (x -> 'candidates' -> 0 ->> 'id')::uuid;
  assert (select count(*) from public.number_online_preparation where match_id = m and status = 'found') = 2, 'both searches found courses';
  -- The matcher can't smuggle someone else's candidate in.
  x := public.number_record_online_match(m, jsonb_build_array(jsonb_build_object('userId', u[3], 'candidateId', c2), jsonb_build_object('userId', u[4], 'candidateId', c2)), '{"status": "matched"}');
  assert not (x ->> 'matched')::boolean and x ->> 'status' = 'missing_player', 'a candidate counts only for its owner';
  delete from public.number_course_equivalence where match_id = m;
  x := public.number_record_online_match(m, jsonb_build_array(jsonb_build_object('userId', u[3], 'candidateId', c1), jsonb_build_object('userId', u[4], 'candidateId', c2)),
    '{"status": "matched", "version": "number-equivalence-v1", "checks": [], "unknown": ["street crossings", "elevation", "surface"]}');
  assert (x ->> 'matched')::boolean and (x ->> 'spreadM')::float8 <= 30, 'Test A: 42 at about 1500 m and 1490 m matched (spread within 30 m)';
  assert (select status from public.number_trail_matches where id = m) = 'ready', 'ready at start';
  assert (select unknown from public.number_course_equivalence where match_id = m) = array['street crossings', 'elevation', 'surface'], 'unknown attributes recorded as unknown';
  raise notice 'pass  Test A: same number, 1.5 km vs about 1.49 km, matched and assigned';

  -- Check-in at your own start; position not stored.
  x := public.number_online_checkin(m, u[3], 38.95, -77.0, 8);
  assert not (x ->> 'atStart')::boolean and x ->> 'reason' = 'not_at_start', 'far from my start';
  x := public.number_online_checkin(m, u[3], 38.9001, -77.0, 45);
  assert x ->> 'reason' = 'gps_weak', 'weak GPS does not check in';
  x := public.number_online_checkin(m, u[3], 38.9001, -77.0, 8);
  assert (x ->> 'atStart')::boolean, 'at my start (about 11 m)';
  perform pg_temp.as_user(u[3]);
  assert pg_temp.raises(format('select public.number_start(%L)', m), 'not_everyone_at_start'), 'nobody starts while someone is still travelling';
  perform public.number_online_checkin(m, u[4], 34.0, -118.3, 6);
  perform pg_temp.as_user(u[3]);
  x := public.number_start(m);
  assert (select status from public.number_trail_matches where id = m) = 'countdown', 'one server countdown for both cities';
  assert (select count(distinct course_digest) from public.number_trail_assignments where match_id = m) = 2, 'each player has their own course';
  assert (public.number_course(m, u[3]) -> 'course' -> 'start' ->> 'latitude')::float8 = 38.9 and (public.number_course(m, u[4]) -> 'course' -> 'start' ->> 'latitude')::float8 = 34.0, 'each is judged on their own course';
  perform pg_temp.as_user(u[4]);
  s := public.number_race_state(m, 0, null);
  assert (s -> 'course' -> 'start' ->> 'latitude')::float8 = 34.0, 'state shows my own course';
  assert s::text not like '%38.9%', 'never the other player''s course or start';
  assert jsonb_array_length(s -> 'online' -> 'players') = 2 and (s -> 'online' -> 'equivalence' ->> 'status') = 'matched', 'online summary: players and verdict';
  assert pg_temp.raises(format('update public.number_trail_player_courses set official_total_m = 1 where match_id = %L', m), 'assignment_locked'), 'courses locked after the countdown';
  assert pg_temp.raises(format('delete from public.number_course_equivalence where match_id = %L', m), 'assignment_locked'), 'verdict locked after the countdown';
  execute 'set local role authenticated';
  perform pg_temp.as_user(u[4]);
  assert (select count(*) from public.number_trail_player_courses where match_id = m) = 1, 'RLS: only my own course row';
  assert pg_temp.raises(format('insert into public.number_course_equivalence (match_id, status, target_m, tolerance_m, version) values (%L, %L, 1500, 30, %L)', gen_random_uuid(), 'matched', 'x'), 'row-level security|violates'), 'players cannot certify fairness';
  assert pg_temp.raises(format('select public.number_record_online_match(%L, %L, %L)', m, '[]', '{}'), 'permission denied'), 'players cannot call the matcher''s function';
  execute 'reset role';
  raise notice 'pass  check-in at your own start, synchronized start, per-player courses, privacy, locks, RLS';

  -- ===== Test B: 800 m against 1500 m is refused; Test D: a player with no route =====
  perform pg_temp.as_user(u[5]);
  r := public.create_room('number_trail', 'Mismatch', 10, false, 10, true, null, 'A');
  room := (r ->> 'roomId')::uuid;
  perform pg_temp.as_user(u[6]);
  perform public.join_room(r ->> 'code', null, null, 'B');
  perform pg_temp.as_user(u[5]);
  m := (public.number_create_online_match(room, '42', 'standard') ->> 'matchId')::uuid;
  perform public.number_online_start_search(m);
  c1 := (public.number_store_candidates(u[5], 'online', m, '42', jsonb_build_array(pg_temp.cand(pg_temp.course('42', 40.0, -74.0, 300, 350, 150))), 1000, 'osm', '[]') -> 'candidates' -> 0 ->> 'id')::uuid;
  c2 := (public.number_store_candidates(u[6], 'online', m, '42', jsonb_build_array(pg_temp.cand(pg_temp.course('42', 45.5, -122.6, 600, 700, 200))), 1000, 'osm', '[]') -> 'candidates' -> 0 ->> 'id')::uuid;
  -- Even if the matcher claimed a match, the database's own distance check refuses it.
  x := public.number_record_online_match(m, jsonb_build_array(jsonb_build_object('userId', u[5], 'candidateId', c1), jsonb_build_object('userId', u[6], 'candidateId', c2)), '{"status": "matched"}');
  assert not (x ->> 'matched')::boolean and x ->> 'status' = 'distance_mismatch', 'Test B: 800 m vs 1500 m refused';
  assert (select status from public.number_trail_matches where id = m) = 'course_search', 'back to searching, nothing assigned';
  assert (select count(*) from public.number_trail_player_courses where match_id = m) = 0, 'no assignment';
  perform pg_temp.as_user(u[5]);
  assert pg_temp.raises(format('select public.number_start(%L)', m), 'match_not_ready'), 'a mismatched ranked race never starts';
  perform public.number_online_search_failed(m, u[6], 'no_number_routes');
  assert (select status from public.number_online_preparation where match_id = m and user_id = u[6]) = 'none', 'Test D: a player with no route is recorded honestly';
  raise notice 'pass  Test B: 800 m vs 1.5 km refused by the database; Test D: no route recorded, nothing invented';

  -- ===== Unranked: allowed, labelled =====
  perform pg_temp.as_user(u[7]);
  r := public.create_room('number_trail', 'Casual', 10, false, 10, true, null, 'C');
  room := (r ->> 'roomId')::uuid;
  perform pg_temp.as_user(u[8]);
  perform public.join_room(r ->> 'code', null, null, 'D');
  perform pg_temp.as_user(u[7]);
  m := (public.number_create_online_match(room, '7', 'short', false) ->> 'matchId')::uuid;
  perform public.number_online_start_search(m);
  c1 := (public.number_store_candidates(u[7], 'online', m, '7', jsonb_build_array(pg_temp.cand(pg_temp.course('7', 40.0, -74.0, 700))), 1000, 'osm', '[]') -> 'candidates' -> 0 ->> 'id')::uuid;
  c2 := (public.number_store_candidates(u[8], 'online', m, '7', jsonb_build_array(pg_temp.cand(pg_temp.course('7', 45.5, -122.6, 1000))), 1000, 'osm', '[]') -> 'candidates' -> 0 ->> 'id')::uuid;
  x := public.number_record_online_match(m, jsonb_build_array(jsonb_build_object('userId', u[7], 'candidateId', c1), jsonb_build_object('userId', u[8], 'candidateId', c2)), '{"status": "distance_mismatch"}');
  assert (x ->> 'matched')::boolean and x ->> 'status' = 'unranked', 'unranked challenge allowed and labelled unranked, never "matched"';
  raise notice 'pass  unranked: allowed, never certified as fair';
end;
$$;

rollback;
