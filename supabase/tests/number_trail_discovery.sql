-- Number Trail, location first (phases L1 to L4) against real PostgreSQL + PostGIS: the discovery cache, an online race
-- that waits for its number, each player's walkable numbers (no position), the common set and the host's checked
-- choice, a shared course for players in one area, and the number 0. Run after the migrations. Everything is rolled
-- back.
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
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 6));
  r jsonb;
  room uuid;
  m uuid;
  c uuid;
  x jsonb;
  disc jsonb;
  n integer;
begin
  for i in 1..6 loop insert into auth.users (id, email) values (u[i], 'd' || i || '@test.paws'); end loop;

  -- ===== Discovery cache: public network data only, a day =====
  assert public.number_discovery_get('number-discovery-v1:fp:osm:n1:1000') is null, 'nothing cached yet';
  perform public.number_discovery_put('number-discovery-v1:fp:osm:n1:1000', '{"available": ["0", "23"]}', false);
  assert public.number_discovery_get('number-discovery-v1:fp:osm:n1:1000') -> 'result' -> 'available' = '["0", "23"]'::jsonb, 'cached';
  update public.number_discovery_cache set expires_at = now() - interval '1 minute';
  assert public.number_discovery_get('number-discovery-v1:fp:osm:n1:1000') is null, 'expired answers are not served';
  execute 'set local role authenticated';
  perform pg_temp.as_user(u[1]);
  assert pg_temp.raises('select public.number_discovery_get(''number-discovery-v1:fp:osm:n1:1000'')', 'permission denied'), 'players cannot read the cache directly';
  assert (select count(*) from public.number_discovery_cache) = 0, 'RLS: cache rows invisible to players';
  execute 'reset role';
  raise notice 'pass  discovery cache: keyed by network, expires, service only';

  -- ===== An online race that waits for its number =====
  perform pg_temp.as_user(u[1]);
  r := public.create_room('number_trail', 'Find a number', 10, false, 10, true, null, 'Ari');
  room := (r ->> 'roomId')::uuid;
  perform pg_temp.as_user(u[2]);
  perform public.join_room(r ->> 'code', null, null, 'Bo');
  perform pg_temp.as_user(u[1]);
  m := (public.number_create_online_match(room, null, 'standard') ->> 'matchId')::uuid;
  assert (select requested_number is null and target_number is null and status = 'waiting' from public.number_trail_matches where id = m), 'no number yet';
  assert pg_temp.raises(format('select public.number_online_start_search(%L)', m), 'match_not_ready'), 'no search before a number';

  -- Each player's walkable numbers: statuses only.
  disc := jsonb_build_object('radiusM', 1000, 'checkedRadiusM', 900, 'numbers', jsonb_build_array(
    jsonb_build_object('number', '0', 'status', 'AVAILABLE'), jsonb_build_object('number', '7', 'status', 'AVAILABLE'),
    jsonb_build_object('number', '23', 'status', 'AVAILABLE'), jsonb_build_object('number', '42', 'status', 'NOT_FOUND_IN_CHECKED_AREA'),
    jsonb_build_object('number', '88', 'status', 'NOT_YET_CHECKED')));
  perform public.number_online_store_availability(m, u[1], disc, false);
  assert pg_temp.raises(format('select public.number_online_store_availability(%L, %L, %L, false)', m, u[5], disc), 'not_in_room'), 'members only';
  x := public.number_online_common(m);
  assert x -> 'common' = '[]'::jsonb and not (x ->> 'everyoneChecked')::boolean, 'nothing common until everyone has checked';
  perform public.number_online_store_availability(m, u[2], jsonb_build_object('radiusM', 1000, 'checkedRadiusM', 1000, 'numbers', jsonb_build_array(
    jsonb_build_object('number', '7', 'status', 'AVAILABLE'), jsonb_build_object('number', '23', 'status', 'AVAILABLE'),
    jsonb_build_object('number', '0', 'status', 'NOT_FOUND_IN_CHECKED_AREA'), jsonb_build_object('number', '42', 'status', 'AVAILABLE'))), true);
  perform pg_temp.as_user(u[2]);
  x := public.number_online_common(m);
  assert x -> 'common' = '["7", "23"]'::jsonb, 'common: walkable for everyone (0 and 42 are not)';
  assert x -> 'pending' ? '88' and not (x -> 'pending' ? '42'), 'pending: unchecked by someone and ruled out by nobody';
  assert (x ->> 'everyoneChecked')::boolean, 'everyone checked';
  assert x::text !~ 'latitude|longitude|"available": \[', 'no positions, no other player''s list: counts only';
  assert (select count(*) from jsonb_array_elements(x -> 'players') p where (p ->> 'manual')::boolean) = 1, 'a manual spot is labelled';
  perform pg_temp.as_user(u[5]);
  assert pg_temp.raises(format('select public.number_online_common(%L)', m), 'not_in_match'), 'outsiders see nothing';
  raise notice 'pass  each player''s walkable numbers, the common set, no positions';

  -- ===== The host picks from the common set; the database checks =====
  perform pg_temp.as_user(u[2]);
  assert pg_temp.raises(format('select public.number_online_choose_number(%L, %L)', m, '23'), 'not_the_host'), 'host only';
  perform pg_temp.as_user(u[1]);
  assert pg_temp.raises(format('select public.number_online_choose_number(%L, %L)', m, '42'), 'number_not_common'), 'not walkable for everyone: refused';
  assert pg_temp.raises(format('select public.number_online_choose_number(%L, %L)', m, '07'), 'bad_number'), 'canonical only';
  perform public.number_online_choose_number(m, '23');
  assert (select requested_number = '23' and target_number = '23' from public.number_trail_matches where id = m), 'number set';
  assert pg_temp.raises(format('select public.number_online_store_availability(%L, %L, %L, false)', m, u[1], disc), 'match_not_editable'), 'availability fixed once the number is chosen';
  assert exists (select 1 from public.number_trail_events where match_id = m and kind = 'NUMBER_CHOSEN'), 'event recorded';
  raise notice 'pass  host picks a common number; the database refuses others';

  -- ===== A shared course for players in one area =====
  x := public.number_store_candidates(u[1], 'practice', null, '23', jsonb_build_array(pg_temp.cand(pg_temp.course('23', 45.46, -122.65, 500, 600, 150)) || '{"routeKey": "23-abc1234"}'::jsonb), 1000, 'osm', '[]');
  c := (x -> 'candidates' -> 0 ->> 'id')::uuid;
  assert x -> 'candidates' -> 0 ->> 'routeKey' = '23-abc1234', 'route key kept';
  perform pg_temp.as_user(u[2]);
  assert pg_temp.raises(format('select public.number_online_share_course(%L, %L)', m, c), 'not_the_host'), 'host shares';
  perform pg_temp.as_user(u[1]);
  x := public.number_store_candidates(u[2], 'practice', null, '23', jsonb_build_array(pg_temp.cand(pg_temp.course('23', 45.46, -122.65, 500, 600, 150))), 1000, 'osm', '[]');
  assert pg_temp.raises(format('select public.number_online_share_course(%L, %L)', m, (x -> 'candidates' -> 0 ->> 'id')::uuid), 'not_found'), 'only the host''s own route';
  x := public.number_store_candidates(u[1], 'practice', null, '7', jsonb_build_array(pg_temp.cand(pg_temp.course('7', 45.46, -122.65, 500))), 1000, 'osm', '[]');
  assert pg_temp.raises(format('select public.number_online_share_course(%L, %L)', m, (x -> 'candidates' -> 0 ->> 'id')::uuid), 'bad_number'), 'a route for another number refused';
  perform public.number_online_share_course(m, c);
  assert (select status from public.number_trail_matches where id = m) = 'ready', 'ready';
  assert (select count(distinct course::text) from public.number_trail_player_courses where match_id = m) = 1
    and (select count(*) from public.number_trail_player_courses where match_id = m) = 2, 'one course for both players';
  assert (select status = 'matched' and spread_m = 0 and version = 'shared-course-v1' from public.number_course_equivalence where match_id = m), 'identical course: matched, nothing to compare';
  assert pg_temp.raises(format('select public.number_start(%L)', m), 'not_everyone_at_start'), 'everyone must still be at the start';
  perform public.number_online_checkin(m, u[1], 45.46, -122.65, 6);
  perform public.number_online_checkin(m, u[2], 45.4601, -122.65, 8);
  x := public.number_start(m);
  assert (select status from public.number_trail_matches where id = m) = 'countdown', 'one server countdown';
  assert (select count(distinct course_digest) from public.number_trail_assignments where match_id = m) = 1, 'the same course for both';
  raise notice 'pass  shared course: one route for everyone, check-in at its start, one countdown';

  -- ===== 0 is a number =====
  x := public.number_store_candidates(u[3], 'practice', null, '0', jsonb_build_array(pg_temp.cand(pg_temp.course('0', 45.46, -122.65, 600))), 1000, 'osm', '[]');
  assert jsonb_array_length(x -> 'candidates') = 1, '0 stored';
  assert pg_temp.raises(format('select public.number_store_candidates(%L, %L, null, %L, %L, 1000, %L, %L)', u[3], 'practice', '00', '[]', 'osm', '[]'), 'bad_number'), '00 refused';
  raise notice 'pass  0 is a single-digit number; 00 is refused';
end;
$$;

rollback;
