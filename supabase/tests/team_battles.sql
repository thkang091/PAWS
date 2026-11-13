-- Team battles (phase 3 and 3A) against real PostGIS: territory ownership, road capture and scoring, deadlines,
-- idempotency, event order, row level security with several identities, and road area publishing.
-- Run as a database administrator after the migrations. Everything is rolled back.
-- Concurrency (separate sessions at the same time) is in supabase/tests/local/concurrency.sh.
begin;

-- Test helpers, gone at the end of the session.
create function pg_temp.sq(x0 float8, y0 float8, dx float8, dy float8) returns text language sql immutable as $$
  select json_build_object('type', 'Polygon', 'coordinates', json_build_array(json_build_array(
    json_build_array(x0, y0), json_build_array(x0 + dx, y0), json_build_array(x0 + dx, y0 + dy), json_build_array(x0, y0 + dy), json_build_array(x0, y0))))::text;
$$;
create function pg_temp.near(actual float8, expected float8, tolerance float8) returns boolean language sql immutable as $$
  select abs(actual - expected) <= abs(expected) * tolerance;
$$;
create function pg_temp.raises(stmt text, expected text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  if sqlerrm <> expected and sqlerrm not like '%' || expected || '%' then raise notice 'expected %, got %', expected, sqlerrm; return false; end if;
  return true;
end;
$$;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true), set_config('request.jwt.claim.role', 'authenticated', true);
$$;
-- Every pair of team territories must be disjoint (shared edges allowed): no ground belongs to two teams at once.
create function pg_temp.overlap_m2(m uuid) returns float8 language sql stable as $$
  select coalesce(extensions.st_area(extensions.st_intersection(b.geom, o.geom)::extensions.geography, true), 0)
  from public.territory_ownership b, public.territory_ownership o
  where b.match_id = m and o.match_id = m and b.team = 'blue' and o.team = 'orange' and b.geom is not null and o.geom is not null
  union all select 0 limit 1;
$$;

do $$
declare
  L constant float8 := -122.42;
  B constant float8 := 37.77;
  -- Reference areas from @turf/area (a different implementation from PostGIS); the two agree within 0.5%.
  SQUARE constant float8 := 9773.65;
  HALF constant float8 := 4886.83;
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 12));
  r jsonb;
  v_room uuid;
  v_code text;
  m uuid;
  k text;
  c1 jsonb;
  c2 jsonb;
  n integer;
  va float8;
  vb float8;
  v_seq bigint;
  region uuid;
  draft_region uuid;
  e uuid[];
  other_edge uuid;
  road_room uuid;
  rm uuid;
  base float8;
  st jsonb;
begin
  for i in 1..12 loop
    insert into auth.users (id, email) values (u[i], u[i] || '@test.paws');
    insert into public.profiles (id) values (u[i]) on conflict do nothing;
  end loop;
  insert into public.tournament_organizers (user_id) values (u[12]);

  -- =========================================================================================================
  -- Steal Your Territory
  -- =========================================================================================================
  perform pg_temp.as_user(u[1]);
  r := public.create_room('steal_territory', 'Territory test', 10, true, 0, true, null, 'Ana');
  v_room := (r ->> 'roomId')::uuid;
  v_code := r ->> 'code';
  for i in 2..5 loop
    perform pg_temp.as_user(u[i]);
    perform public.join_room(v_code, null, null, 'Player ' || i);
    perform public.set_room_ready(v_room, true);
  end loop;

  -- Only the host sets teams, and only while the room is open.
  perform pg_temp.as_user(u[2]);
  if not pg_temp.raises(format('select public.set_member_team(%L, %L, %L)', v_room, u[2], 'blue'), 'not_the_host') then raise exception 'A player switched teams'; end if;
  perform pg_temp.as_user(u[1]);
  if not pg_temp.raises(format('select public.start_battle(%L)', v_room), 'teams_not_set') then raise exception 'Started without teams'; end if;
  perform public.balance_room_teams(v_room);
  if exists (select 1 from public.room_members where room_id = v_room and team is null)
    or abs((select count(*) from public.room_members where room_id = v_room and team = 'blue') - (select count(*) from public.room_members where room_id = v_room and team = 'orange')) > 1 then
    raise exception 'Balance left teams uneven or unset';
  end if;
  -- Every join in this test shares one transaction time, so set teams explicitly: odd players blue, even orange.
  for i in 1..5 loop
    perform public.set_member_team(v_room, u[i], case when i % 2 = 1 then 'blue' else 'orange' end);
  end loop;
  -- Player 5 leaves before the start.
  perform pg_temp.as_user(u[5]);
  perform public.leave_room(v_room);
  perform pg_temp.as_user(u[1]);
  m := public.start_battle(v_room);
  if (select status from public.battle_matches where id = m) <> 'countdown' then raise exception 'Match did not enter countdown'; end if;
  if (select count(*) from public.battle_team_members where match_id = m) <> 4 then raise exception 'Team copy wrong'; end if;
  if not pg_temp.raises(format('select public.set_member_team(%L, %L, %L)', v_room, u[2], 'blue'), 'not_the_host') then raise exception 'Team changed during a match'; end if;

  -- Claims before the start are refused by the server clock.
  if not pg_temp.raises(format('select public.commit_territory_claim(%L, %L, %L, %L, %L)', m, u[1], pg_temp.sq(L, B, 0.001, 0.001), 'early-key-1', 'early-hash'), 'match_not_started') then
    raise exception 'Claimed during the countdown';
  end if;

  -- The countdown passes (the clock is moved, not waited for), then any player nudges it on.
  update public.battle_matches set starts_at = now() - interval '1 second', ends_at = now() + interval '15 minutes' where id = m;
  perform pg_temp.as_user(u[2]);
  if public.battle_advance(m) <> 'active' then raise exception 'Did not go active'; end if;
  if public.battle_advance(m) <> 'active' then raise exception 'Advance is not idempotent'; end if;

  -- 1. Non-overlapping claims, measured on the spheroid.
  c1 := public.commit_territory_claim(m, u[1], pg_temp.sq(L, B, 0.001, 0.001), 'blue-key-0001', 'h1');
  c2 := public.commit_territory_claim(m, u[2], pg_temp.sq(L + 0.002, B, 0.001, 0.001), 'orange-key-01', 'h2');
  select area_m2 into va from public.territory_ownership where match_id = m and team = 'blue';
  select area_m2 into vb from public.territory_ownership where match_id = m and team = 'orange';
  if not pg_temp.near(va, SQUARE, 0.005) or not pg_temp.near(vb, SQUARE, 0.005) then raise exception 'Areas off: blue %, orange %', va, vb; end if;
  if (c1 ->> 'capturedM2')::float8 <> 0 or (c2 ->> 'capturedM2')::float8 <> 0 then raise exception 'Captured from nothing'; end if;
  if (select score from public.battle_teams where match_id = m and team = 'blue') <> va then raise exception 'Score is not the owned area'; end if;

  -- 2. Partial overlap: orange's loop takes the half of blue's square it covers.
  c2 := public.commit_territory_claim(m, u[2], pg_temp.sq(L + 0.0005, B, 0.001, 0.001), 'orange-key-02', 'h3');
  if not pg_temp.near((c2 ->> 'capturedM2')::float8, HALF, 0.005) then raise exception 'Captured %, expected half', c2 ->> 'capturedM2'; end if;
  select area_m2 into va from public.territory_ownership where match_id = m and team = 'blue';
  if not pg_temp.near(va, HALF, 0.005) then raise exception 'Blue kept %, expected half', va; end if;
  if pg_temp.overlap_m2(m) > 0.01 then raise exception 'Teams overlap by % m2', pg_temp.overlap_m2(m); end if;

  -- 3. Orange now holds two separate pieces: a MultiPolygon.
  if (select extensions.geometrytype(geom) from public.territory_ownership where match_id = m and team = 'orange') <> 'MULTIPOLYGON' then raise exception 'Not stored as MultiPolygon'; end if;
  if (select extensions.st_numgeometries(geom) from public.territory_ownership where match_id = m and team = 'orange') <> 2 then raise exception 'Expected two orange pieces'; end if;

  -- 4. Same-team union: overlapping your own ground only adds the new part.
  c2 := public.commit_territory_claim(m, u[4], pg_temp.sq(L + 0.0025, B, 0.001, 0.001), 'orange-key-03', 'h4');
  if not pg_temp.near((c2 ->> 'gainedM2')::float8, HALF, 0.005) or (c2 ->> 'capturedM2')::float8 <> 0 then raise exception 'Own overlap counted twice: %', c2; end if;

  -- 5. A hole: orange takes a small square from the middle of a fresh blue area.
  c1 := public.commit_territory_claim(m, u[3], pg_temp.sq(L, B + 0.002, 0.001, 0.001), 'blue-key-0002', 'h5');
  c2 := public.commit_territory_claim(m, u[2], pg_temp.sq(L + 0.0003, B + 0.0023, 0.0004, 0.0004), 'orange-key-04', 'h6');
  if (select extensions.st_nrings(extensions.st_geometryn(geom, 2)) + extensions.st_nrings(extensions.st_geometryn(geom, 1)) from public.territory_ownership where match_id = m and team = 'blue') < 3 then
    raise exception 'Blue area has no hole';
  end if;
  if pg_temp.overlap_m2(m) > 0.01 then raise exception 'Teams overlap after the hole'; end if;

  -- 6. Entire enemy capture: one big orange loop swallows every blue piece.
  c2 := public.commit_territory_claim(m, u[4], pg_temp.sq(L - 0.0002, B - 0.0002, 0.0014, 0.0034), 'orange-key-05', 'h7');
  if (select area_m2 from public.territory_ownership where match_id = m and team = 'blue') <> 0
    or (select geom from public.territory_ownership where match_id = m and team = 'blue') is not null then
    raise exception 'Blue still owns ground after a full capture';
  end if;

  -- 7. Reclaiming lost ground.
  c1 := public.commit_territory_claim(m, u[1], pg_temp.sq(L, B, 0.001, 0.001), 'blue-key-0003', 'h8');
  if not pg_temp.near((c1 ->> 'capturedM2')::float8, SQUARE, 0.005) or not pg_temp.near((c1 ->> 'gainedM2')::float8, SQUARE, 0.005) then raise exception 'Reclaim wrong: %', c1; end if;
  if pg_temp.overlap_m2(m) > 0.01 then raise exception 'Teams overlap after the reclaim'; end if;

  -- 8. Duplicates: the same request key is the same claim; the same walk under a new key is refused.
  v_seq := (select seq from public.battle_matches where id = m);
  c2 := public.commit_territory_claim(m, u[1], pg_temp.sq(L, B, 0.001, 0.001), 'blue-key-0003', 'h8');
  if not (c2 ->> 'repeated')::boolean or c2 ->> 'claimId' <> c1 ->> 'claimId' then raise exception 'Repeat made a new claim'; end if;
  if (select seq from public.battle_matches where id = m) <> v_seq then raise exception 'Repeat moved the sequence'; end if;
  if not pg_temp.raises(format('select public.commit_territory_claim(%L, %L, %L, %L, %L)', m, u[1], pg_temp.sq(L, B, 0.001, 0.001), 'blue-key-0004', 'h8'), 'duplicate_loop') then raise exception 'Same walk claimed twice'; end if;

  -- 9. Degenerate and invalid shapes.
  if not pg_temp.raises(format('select public.commit_territory_claim(%L, %L, %L, %L, %L)', m, u[1],
    '{"type":"Polygon","coordinates":[[[-122.42,37.77],[-122.419,37.771],[-122.42,37.771],[-122.419,37.77],[-122.42,37.77]]]}', 'bowtie-key-1', 'h9'), 'invalid_polygon') then
    raise exception 'Self-crossing loop accepted';
  end if;
  if not pg_temp.raises(format('select public.commit_territory_claim(%L, %L, %L, %L, %L)', m, u[1],
    '{"type":"Polygon","coordinates":[[[-122.42,37.77],[-122.419,37.77],[-122.418,37.77],[-122.42,37.77]]]}', 'flat-key-001', 'h10'), 'invalid_polygon') then
    raise exception 'Zero-area loop accepted';
  end if;
  if not pg_temp.raises(format('select public.commit_territory_claim(%L, %L, %L, %L, %L)', m, u[1], '{"type":"Point","coordinates":[-122.42,37.77]}', 'point-key-01', 'h11'), 'invalid_polygon') then
    raise exception 'A point was accepted as a loop';
  end if;
  if not pg_temp.raises(format('select public.commit_territory_claim(%L, %L, %L, %L, %L)', m, u[1], pg_temp.sq(L + 0.01, B, 0.00005, 0.00005), 'tiny-key-001', 'h12'), 'empty_polygon') then
    raise exception 'A 24 m2 loop was accepted';
  end if;

  -- 10. Who may claim: not a player who never joined, not one who left, never a client directly.
  if not pg_temp.raises(format('select public.commit_territory_claim(%L, %L, %L, %L, %L)', m, u[6], pg_temp.sq(L + 0.01, B, 0.001, 0.001), 'stranger-key', 'h13'), 'not_on_a_team') then raise exception 'Stranger claimed'; end if;
  if not pg_temp.raises(format('select public.commit_territory_claim(%L, %L, %L, %L, %L)', m, u[5], pg_temp.sq(L + 0.01, B, 0.001, 0.001), 'leaver-key-1', 'h14'), 'not_on_a_team') then raise exception 'A player who left claimed'; end if;
  if has_function_privilege('authenticated', 'public.commit_territory_claim(uuid, uuid, text, text, text)', 'execute')
    or has_function_privilege('anon', 'public.commit_road_capture(uuid, uuid, uuid, numeric, text)', 'execute')
    or has_function_privilege('authenticated', 'public.battle_transition(uuid, text, jsonb)', 'execute') then
    raise exception 'A client can call a service-only commit';
  end if;
  if not has_function_privilege('service_role', 'public.commit_territory_claim(uuid, uuid, text, text, text)', 'execute') then raise exception 'Service role lost the commit'; end if;

  -- 11. Row level security as real identities.
  perform pg_temp.as_user(u[2]);
  execute 'set local role authenticated';
  if (select count(*) from public.battle_matches where id = m) <> 1 then raise exception 'Member cannot see the match'; end if;
  if (select count(*) from public.territory_claims where match_id = m and user_id <> u[2]) <> 0 then raise exception 'Member sees other players'' walked loops'; end if;
  if (select count(*) from public.territory_claims where match_id = m and user_id = u[2]) = 0 then raise exception 'Member cannot see own claims'; end if;
  update public.battle_teams set score = 1e9 where match_id = m;
  update public.territory_ownership set area_m2 = 1e9 where match_id = m;
  delete from public.battle_match_events where match_id = m;
  begin
    insert into public.territory_ownership (match_id, team) values (m, 'blue');
    raise exception 'insert allowed';
  exception when others then
    if sqlerrm = 'insert allowed' then raise exception 'Client inserted ownership'; end if;
  end;
  begin
    perform public.commit_territory_claim(m, u[2], pg_temp.sq(L + 0.01, B, 0.001, 0.001), 'client-key-1', 'h15');
    raise exception 'commit allowed';
  exception when others then
    if sqlerrm = 'commit allowed' then raise exception 'Client called the commit'; end if;
  end;
  st := public.battle_state(m);
  if exists (select 1 from jsonb_array_elements(st -> 'members') x where x ?| array['latitude', 'longitude', 'points', 'position']) then raise exception 'battle_state exposes positions'; end if;
  execute 'reset role';
  if (select score from public.battle_teams where match_id = m and team = 'orange') >= 1e9 or (select area_m2 from public.territory_ownership where match_id = m and team = 'blue') >= 1e9 then
    raise exception 'A client changed an official score';
  end if;
  if (select count(*) from public.battle_match_events where match_id = m) = 0 then raise exception 'A client deleted events'; end if;

  perform pg_temp.as_user(u[6]);
  execute 'set local role authenticated';
  if (select count(*) from public.battle_matches where id = m) + (select count(*) from public.territory_ownership where match_id = m)
     + (select count(*) from public.battle_match_events where match_id = m) + (select count(*) from public.battle_team_members where match_id = m) <> 0 then
    raise exception 'A stranger can read the match';
  end if;
  if not pg_temp.raises(format('select public.battle_state(%L)', m), 'not_in_match') then raise exception 'A stranger read battle_state'; end if;
  if not pg_temp.raises(format('select public.battle_advance(%L)', m), 'not_in_match') then raise exception 'A stranger advanced the match'; end if;
  if (select count(*) from realtime.messages where topic = 'room:' || v_room) <> 0 then raise exception 'A stranger can read the room channel'; end if;
  execute 'reset role';
  if (select count(*) from realtime.messages where topic = 'room:' || v_room) = 0 then raise exception 'Nothing was broadcast'; end if;

  -- 12. Event order: one event per committed change, numbered 1..n with no gaps, matching the match sequence.
  select count(*), max(seq) into n, v_seq from public.battle_match_events where match_id = m;
  if n <> v_seq or v_seq <> (select seq from public.battle_matches where id = m) or (select min(seq) from public.battle_match_events where match_id = m) <> 1 then
    raise exception 'Events out of order: % events, max %, match %', n, v_seq, (select seq from public.battle_matches where id = m);
  end if;

  -- 13. The deadline is exact and judged by the server clock.
  update public.battle_matches set ends_at = now() + interval '1 millisecond' where id = m;
  c1 := public.commit_territory_claim(m, u[3], pg_temp.sq(L, B + 0.006, 0.001, 0.001), 'blue-key-0005', 'h16');
  update public.battle_matches set ends_at = now() where id = m;
  if not pg_temp.raises(format('select public.commit_territory_claim(%L, %L, %L, %L, %L)', m, u[3], pg_temp.sq(L, B + 0.008, 0.001, 0.001), 'blue-key-0006', 'h17'), 'match_over') then
    raise exception 'Claim accepted at the deadline';
  end if;

  -- 14. The match completes with the scores the server holds.
  perform pg_temp.as_user(u[3]);
  if public.battle_advance(m) <> 'completed' then raise exception 'Did not complete'; end if;
  select result into r from public.battle_matches where id = m;
  va := (select score from public.battle_teams where match_id = m and team = 'blue');
  vb := (select score from public.battle_teams where match_id = m and team = 'orange');
  if (r -> 'scores' ->> 'blue')::float8 <> va or (r -> 'scores' ->> 'orange')::float8 <> vb then raise exception 'Result differs from held scores'; end if;
  if r ->> 'winner' <> (case when va > vb then 'blue' else 'orange' end) then raise exception 'Wrong winner %', r ->> 'winner'; end if;
  if (select status from public.multiplayer_rooms where id = v_room) <> 'finished' then raise exception 'Room not finished'; end if;
  if not pg_temp.raises(format('select public.commit_territory_claim(%L, %L, %L, %L, %L)', m, u[3], pg_temp.sq(L, B + 0.01, 0.001, 0.001), 'late-key-001', 'h18'), 'match_over') then raise exception 'Claim after completion'; end if;

  -- =========================================================================================================
  -- Road areas: organizers only, and publishing checks
  -- =========================================================================================================
  perform pg_temp.as_user(u[7]);
  if not pg_temp.raises(format('select public.create_competition_region(%L, %s, %s, %L, %L, %L)', 'Not mine', B, L, 'x', 'y', 'z'), 'not_an_organizer') then raise exception 'Non-organizer created a region'; end if;
  if not pg_temp.raises('select public.organizer_regions()', 'not_an_organizer') then raise exception 'Non-organizer listed regions'; end if;

  perform pg_temp.as_user(u[12]);
  region := (public.create_competition_region('Test grid', B + 0.02, L, 'PAWS test fixture', '', 'PAWS test')).id;
  -- A chain n1-n2-n3-n4-n5 along one street (about 88 m per block), a side road n2-n6 and a link n5-n6.
  perform public.import_road_graph(region,
    jsonb_build_array(
      jsonb_build_object('key', 'n1', 'latitude', B + 0.02, 'longitude', L),
      jsonb_build_object('key', 'n2', 'latitude', B + 0.02, 'longitude', L + 0.001),
      jsonb_build_object('key', 'n3', 'latitude', B + 0.02, 'longitude', L + 0.002),
      jsonb_build_object('key', 'n4', 'latitude', B + 0.02, 'longitude', L + 0.003),
      jsonb_build_object('key', 'n5', 'latitude', B + 0.02, 'longitude', L + 0.004),
      jsonb_build_object('key', 'n6', 'latitude', B + 0.021, 'longitude', L + 0.001)),
    jsonb_build_array(
      jsonb_build_object('startKey', 'n1', 'endKey', 'n2', 'name', 'E1', 'coords', jsonb_build_array(jsonb_build_array(L, B + 0.02), jsonb_build_array(L + 0.001, B + 0.02))),
      jsonb_build_object('startKey', 'n2', 'endKey', 'n3', 'name', 'E2', 'coords', jsonb_build_array(jsonb_build_array(L + 0.001, B + 0.02), jsonb_build_array(L + 0.002, B + 0.02))),
      jsonb_build_object('startKey', 'n3', 'endKey', 'n4', 'name', 'E3', 'coords', jsonb_build_array(jsonb_build_array(L + 0.002, B + 0.02), jsonb_build_array(L + 0.003, B + 0.02))),
      jsonb_build_object('startKey', 'n4', 'endKey', 'n5', 'name', 'E4', 'coords', jsonb_build_array(jsonb_build_array(L + 0.003, B + 0.02), jsonb_build_array(L + 0.004, B + 0.02))),
      jsonb_build_object('startKey', 'n2', 'endKey', 'n6', 'name', 'E5', 'coords', jsonb_build_array(jsonb_build_array(L + 0.001, B + 0.02), jsonb_build_array(L + 0.001, B + 0.021))),
      jsonb_build_object('startKey', 'n5', 'endKey', 'n6', 'name', 'E6', 'coords', jsonb_build_array(jsonb_build_array(L + 0.004, B + 0.02), jsonb_build_array(L + 0.001, B + 0.021)))));
  e := array(select id from public.road_edges where region_id = region order by name);
  if array_length(e, 1) <> 6 then raise exception 'Import made % roads', array_length(e, 1); end if;
  if exists (select 1 from public.road_edges where region_id = region and status <> 'pending') then raise exception 'Imported roads are not all pending'; end if;
  if not pg_temp.near((select length_m from public.road_edges where id = e[1]), 88.0, 0.01) then raise exception 'E1 length %', (select length_m from public.road_edges where id = e[1]); end if;

  -- Publishing refuses until source, licence and every review are in place.
  if not pg_temp.raises(format('select public.publish_competition_region(%L)', region), 'source_and_license_required') then raise exception 'Published without a licence'; end if;
  perform public.update_competition_region(region, 'Test grid', 'PAWS test fixture', 'Test data, not a real street', 'PAWS test', '');
  if not pg_temp.raises(format('select public.publish_competition_region(%L)', region), 'roads_not_reviewed') then raise exception 'Published with pending roads'; end if;
  perform public.set_road_edge_status(e[1], 'verified', '');
  perform public.set_road_edge_status(e[2], 'verified', '');
  perform public.set_road_edge_status(e[3], 'verified', '');
  perform public.set_road_edge_status(e[5], 'unsafe', 'No pavement');
  perform public.set_road_edge_status(e[6], 'disabled', '');
  perform public.set_road_edge_status(e[4], 'pending', '');
  if not pg_temp.raises(format('select public.publish_competition_region(%L)', region), 'roads_not_reviewed') then raise exception 'Published with a pending road'; end if;
  perform public.set_road_edge_status(e[4], 'verified', '');

  -- A player can't review or publish, even knowing the ids.
  perform pg_temp.as_user(u[7]);
  if not pg_temp.raises(format('select public.set_road_edge_status(%L, %L, %L)', e[5], 'verified', ''), 'not_an_organizer') then raise exception 'Player reviewed a road'; end if;
  if not pg_temp.raises(format('select public.publish_competition_region(%L)', region), 'not_an_organizer') then raise exception 'Player published'; end if;
  execute 'set local role authenticated';
  update public.road_edges set status = 'verified' where id = e[5];
  update public.competition_regions set status = 'published' where id = region;
  if (select count(*) from public.competition_regions where id = region) <> 0 then raise exception 'Player sees a draft region'; end if;
  execute 'reset role';
  if (select status from public.road_edges where id = e[5]) <> 'unsafe' or (select status from public.competition_regions where id = region) <> 'draft' then raise exception 'Player changed review data directly'; end if;

  -- Blocking graph errors: a duplicate of a verified road refuses publishing.
  perform pg_temp.as_user(u[12]);
  perform public.import_road_graph(region, '[]'::jsonb,
    jsonb_build_array(jsonb_build_object('startKey', 'n2', 'endKey', 'n1', 'name', 'E1 again', 'coords', jsonb_build_array(jsonb_build_array(L, B + 0.02), jsonb_build_array(L + 0.001, B + 0.02)))));
  other_edge := (select id from public.road_edges where region_id = region and name = 'E1 again');
  perform public.set_road_edge_status(other_edge, 'verified', '');
  if not pg_temp.raises(format('select public.publish_competition_region(%L)', region), 'duplicate_roads') then raise exception 'Published a duplicate road'; end if;
  perform public.set_road_edge_status(other_edge, 'disabled', 'Duplicate');
  perform public.publish_competition_region(region);
  if (select status from public.competition_regions where id = region) <> 'published' or (select boundary from public.competition_regions where id = region) is null then raise exception 'Publish incomplete'; end if;
  if not pg_temp.raises(format('select public.set_road_edge_status(%L, %L, %L)', e[5], 'verified', ''), 'edge_not_editable') then raise exception 'Edited a published road'; end if;
  if not pg_temp.raises(format('select public.publish_competition_region(%L)', region), 'region_not_draft') then raise exception 'Published twice'; end if;

  -- Players see only verified roads of published areas.
  perform pg_temp.as_user(u[7]);
  if jsonb_array_length(public.region_roads(region)) <> 4 then raise exception 'Players see % roads, expected 4 verified', jsonb_array_length(public.region_roads(region)); end if;
  if not exists (select 1 from jsonb_array_elements(public.published_regions()) x where (x ->> 'id')::uuid = region and (x ->> 'roads')::int = 4) then raise exception 'Not listed as published'; end if;

  -- A second, draft region: its roads are never playable.
  perform pg_temp.as_user(u[12]);
  draft_region := (public.create_competition_region('Draft area', B + 0.03, L, 'PAWS test fixture', 'Test', '')).id;
  perform public.import_road_graph(draft_region,
    jsonb_build_array(jsonb_build_object('key', 'a', 'latitude', B + 0.03, 'longitude', L), jsonb_build_object('key', 'b', 'latitude', B + 0.03, 'longitude', L + 0.001)),
    jsonb_build_array(jsonb_build_object('startKey', 'a', 'endKey', 'b', 'coords', jsonb_build_array(jsonb_build_array(L, B + 0.03), jsonb_build_array(L + 0.001, B + 0.03)))));

  -- =========================================================================================================
  -- Steal Your Road
  -- =========================================================================================================
  perform pg_temp.as_user(u[7]);
  r := public.create_room('steal_road', 'Road test', 10, true, 0, true, null, 'Gus');
  road_room := (r ->> 'roomId')::uuid;
  if not pg_temp.raises(format('select public.set_battle_settings(%L, 15, %L)', road_room, draft_region), 'region_not_published') then raise exception 'Picked a draft region'; end if;
  for i in 8..10 loop
    perform pg_temp.as_user(u[i]);
    perform public.join_room(r ->> 'code', null, null, 'Player ' || i);
    perform public.set_room_ready(road_room, true);
  end loop;
  perform pg_temp.as_user(u[7]);
  for i in 7..10 loop
    perform public.set_member_team(road_room, u[i], case when i % 2 = 1 then 'blue' else 'orange' end);
  end loop;
  if not pg_temp.raises(format('select public.start_battle(%L)', road_room), 'region_required') then raise exception 'Road match without a region'; end if;
  perform public.set_battle_settings(road_room, 15, region);
  rm := public.start_battle(road_room);
  update public.battle_matches set starts_at = now() - interval '1 second', ends_at = now() + interval '15 minutes' where id = rm;
  perform public.battle_advance(rm);
  -- Blue: players 7 and 9. Orange: 8 and 10.

  -- Disabling a region while a match is played on it is refused.
  perform pg_temp.as_user(u[12]);
  if not pg_temp.raises(format('select public.disable_competition_region(%L)', region), 'region_in_use') then raise exception 'Disabled a region mid-match'; end if;

  -- Coverage threshold: 69.99% is not enough, 70% is.
  c1 := public.commit_road_capture(rm, u[7], e[1], 0.6999, 'road-key-0001');
  if c1 ->> 'status' <> 'rejected' or c1 ->> 'reason' <> 'not_enough' then raise exception '69%% accepted: %', c1; end if;
  if exists (select 1 from public.road_edge_ownership where match_id = rm) then raise exception 'Rejected attempt took the road'; end if;
  c1 := public.commit_road_capture(rm, u[7], e[1], 0.7000, 'road-key-0002');
  base := (select length_m from public.road_edges where id = e[1]) / 10;
  if c1 ->> 'status' <> 'accepted' or not pg_temp.near((c1 ->> 'points')::float8, base, 1e-9) then raise exception '70%% capture wrong: %', c1; end if;

  -- Duplicate request: same answer, nothing new.
  v_seq := (select seq from public.battle_matches where id = rm);
  c2 := public.commit_road_capture(rm, u[7], e[1], 0.7000, 'road-key-0002');
  if not (c2 ->> 'repeated')::boolean or (select seq from public.battle_matches where id = rm) <> v_seq then raise exception 'Repeated capture changed state'; end if;
  -- Your own road earns nothing again.
  c2 := public.commit_road_capture(rm, u[9], e[1], 1, 'road-key-0003');
  if c2 ->> 'reason' <> 'already_yours' then raise exception 'Re-took own road: %', c2; end if;

  -- Only verified roads of this match's area count.
  if not pg_temp.raises(format('select public.commit_road_capture(%L, %L, %L, 1, %L)', rm, u[7], e[5], 'road-key-unsafe'), 'road_not_in_game') then raise exception 'Unsafe road captured'; end if;
  if not pg_temp.raises(format('select public.commit_road_capture(%L, %L, %L, 1, %L)', rm, u[7], e[6], 'road-key-disab'), 'road_not_in_game') then raise exception 'Disabled road captured'; end if;
  if not pg_temp.raises(format('select public.commit_road_capture(%L, %L, %L, 1, %L)', rm, u[7], (select id from public.road_edges where region_id = draft_region limit 1), 'road-key-draft'), 'road_not_in_game') then
    raise exception 'Road from a draft area captured';
  end if;

  -- Network bonus: three connected roads add 20% of the network's points.
  perform public.commit_road_capture(rm, u[7], e[2], 0.9, 'road-key-0004');
  perform public.commit_road_capture(rm, u[9], e[3], 0.8, 'road-key-0005');
  base := (select sum(length_m) from public.road_edges where id in (e[1], e[2], e[3])) / 10;
  va := (select score from public.battle_teams where match_id = rm and team = 'blue');
  if not pg_temp.near(va, base * 1.2, 1e-9) then raise exception 'Blue score %, expected % with bonus', va, base * 1.2; end if;
  if ((select detail from public.battle_teams where match_id = rm and team = 'blue') ->> 'largestEdges')::int <> 3 then raise exception 'Network size wrong'; end if;

  -- Recapture cooldown: 119 seconds after the capture is too soon, 121 is not.
  update public.road_edge_ownership set captured_at = now() - interval '119 seconds' where match_id = rm and edge_id = e[2];
  c2 := public.commit_road_capture(rm, u[8], e[2], 1, 'road-key-0006');
  if c2 ->> 'reason' <> 'cooldown' then raise exception 'Cooldown not enforced: %', c2; end if;
  update public.road_edge_ownership set captured_at = now() - interval '121 seconds' where match_id = rm and edge_id = e[2];
  c2 := public.commit_road_capture(rm, u[8], e[2], 1, 'road-key-0007');
  if c2 ->> 'status' <> 'accepted' then raise exception 'Steal after cooldown refused: %', c2; end if;

  -- Losing the connecting road splits blue's network and removes its bonus; orange's score follows.
  va := (select score from public.battle_teams where match_id = rm and team = 'blue');
  base := (select sum(length_m) from public.road_edges where id in (e[1], e[3])) / 10;
  if not pg_temp.near(va, base, 1e-9) then raise exception 'Blue keeps a bonus after losing the link: % vs %', va, base; end if;
  if ((select detail from public.battle_teams where match_id = rm and team = 'blue') ->> 'components')::int <> 2 then raise exception 'Blue should have two pieces'; end if;
  if not pg_temp.near((select score from public.battle_teams where match_id = rm and team = 'orange'), (select length_m from public.road_edges where id = e[2]) / 10, 1e-9) then raise exception 'Orange score wrong'; end if;
  if (select count(*) from public.road_edge_ownership where match_id = rm and edge_id = e[2]) <> 1 then raise exception 'Road owned twice'; end if;

  -- Players who never joined, and the client, can't capture.
  if not pg_temp.raises(format('select public.commit_road_capture(%L, %L, %L, 1, %L)', rm, u[1], e[4], 'road-key-strng'), 'not_on_a_team') then raise exception 'Stranger captured'; end if;
  perform pg_temp.as_user(u[8]);
  execute 'set local role authenticated';
  if (select count(*) from public.road_capture_attempts where match_id = rm and user_id <> u[8]) <> 0 then raise exception 'Player sees others'' attempts'; end if;
  update public.road_edge_ownership set team = 'orange' where match_id = rm;
  execute 'reset role';
  if (select team from public.road_edge_ownership where match_id = rm and edge_id = e[1]) <> 'blue' then raise exception 'Client rewrote road ownership'; end if;

  -- Deadline by the server clock, then the final result.
  update public.battle_matches set ends_at = now() where id = rm;
  if not pg_temp.raises(format('select public.commit_road_capture(%L, %L, %L, 1, %L)', rm, u[8], e[4], 'road-key-late1'), 'match_over') then raise exception 'Capture at the deadline'; end if;
  perform pg_temp.as_user(u[10]);
  if public.battle_advance(rm) <> 'completed' then raise exception 'Road match did not complete'; end if;
  select result into r from public.battle_matches where id = rm;
  if r ->> 'winner' <> 'blue' or (r ->> 'claims')::int <> 4 then raise exception 'Road result wrong: %', r; end if;
  select count(*), max(seq) into n, v_seq from public.battle_match_events where match_id = rm;
  if n <> v_seq or v_seq <> (select seq from public.battle_matches where id = rm) then raise exception 'Road events out of order'; end if;

  -- Cancelled matches accept nothing.
  perform pg_temp.as_user(u[7]);
  perform public.reopen_room(road_room);
  perform public.set_room_ready(road_room, true);
  for i in 8..10 loop
    perform pg_temp.as_user(u[i]);
    perform public.set_room_ready(road_room, true);
  end loop;
  perform pg_temp.as_user(u[8]);
  if not pg_temp.raises(format('select public.cancel_battle(%L)', rm), 'not_the_host') then raise exception 'Non-host cancelled'; end if;

  -- With the match over, the region can be disabled and reopened; open rooms lose the pick.
  perform pg_temp.as_user(u[12]);
  perform public.disable_competition_region(region);
  if (select region_id from public.multiplayer_rooms where id = road_room) is not null then raise exception 'Open room kept a disabled region'; end if;
  perform pg_temp.as_user(u[7]);
  if jsonb_array_length(public.region_roads(region)) <> 0 then raise exception 'Disabled region still playable'; end if;
  perform pg_temp.as_user(u[12]);
  perform public.reopen_competition_region(region);
  if (select status from public.competition_regions where id = region) <> 'draft' then raise exception 'Reopen failed'; end if;
  if (select jsonb_array_length(public.organizer_regions())) < 2 then raise exception 'Organizer list incomplete'; end if;

  raise notice 'team_battles: all checks passed';
end;
$$;
rollback;
