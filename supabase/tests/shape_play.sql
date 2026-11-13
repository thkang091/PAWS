-- Follow the Shape gameplay (phase 2.5B) against real PostGIS: linking a walk to a picked route, reading the route
-- back, recording a tiered route score, and who can do what. Run as a database administrator after the migrations.
-- Everything is rolled back.
begin;

create function pg_temp.raises(stmt text, expected text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  if position(expected in sqlerrm) = 0 then raise notice 'expected %, got %', expected, sqlerrm; return false; end if;
  return true;
end;
$$;

do $$
declare
  L constant float8 := -122.47;
  B constant float8 := 37.73;
  D constant float8 := 0.001;
  org uuid := gen_random_uuid();
  alice uuid := gen_random_uuid();
  bob uuid := gen_random_uuid();
  region uuid;
  e uuid[];
  t1 uuid;
  t2 uuid;
  r jsonb;
  cand uuid;
  bob_cand uuid;
  a uuid;
  s_alice uuid;
  s_other uuid;
  route jsonb;
  sub public.shape_submissions;
begin
  insert into auth.users (id, email) values (org, 'org2@test.paws'), (alice, 'alice2@test.paws'), (bob, 'bob2@test.paws');
  insert into public.profiles (id) values (org), (alice), (bob) on conflict do nothing;
  insert into public.tournament_organizers (user_id) values (org);

  -- One published block: four verified streets around it.
  perform set_config('request.jwt.claim.sub', org::text, true);
  region := (public.create_competition_region('Play block', B, L, 'PAWS test fixture', 'Test data, not a real street', '')).id;
  perform public.import_road_graph(region,
    jsonb_build_array(
      jsonb_build_object('key', 'a', 'latitude', B, 'longitude', L), jsonb_build_object('key', 'b', 'latitude', B, 'longitude', L + D),
      jsonb_build_object('key', 'c', 'latitude', B + D, 'longitude', L + D), jsonb_build_object('key', 'd', 'latitude', B + D, 'longitude', L)),
    jsonb_build_array(
      jsonb_build_object('startKey', 'a', 'endKey', 'b', 'name', 'S1', 'coords', jsonb_build_array(jsonb_build_array(L, B), jsonb_build_array(L + D, B))),
      jsonb_build_object('startKey', 'b', 'endKey', 'c', 'name', 'S2', 'coords', jsonb_build_array(jsonb_build_array(L + D, B), jsonb_build_array(L + D, B + D))),
      jsonb_build_object('startKey', 'c', 'endKey', 'd', 'name', 'S3', 'coords', jsonb_build_array(jsonb_build_array(L + D, B + D), jsonb_build_array(L, B + D))),
      jsonb_build_object('startKey', 'd', 'endKey', 'a', 'name', 'S4', 'coords', jsonb_build_array(jsonb_build_array(L, B + D), jsonb_build_array(L, B)))));
  e := array(select id from public.road_edges where region_id = region order by name);
  for i in 1..4 loop perform public.set_road_edge_status(e[i], 'verified', ''); end loop;
  perform public.publish_competition_region(region);

  -- Two running Follow the Shape tournaments with their featured challenge; Alice and Bob joined the first.
  insert into public.tournaments (game_type, mode, name, registration_opens_at, starts_at, ends_at)
  values ('follow_shape', 'online', 'Shapes A', now() - interval '2 days', now() - interval '1 day', now() + interval '1 day') returning id into t1;
  insert into public.tournaments (game_type, mode, name, registration_opens_at, starts_at, ends_at)
  values ('follow_shape', 'online', 'Shapes B', now() - interval '2 days', now() - interval '1 day', now() + interval '1 day') returning id into t2;
  perform public.create_shape_challenge(t1, 'square');
  perform public.create_shape_challenge(t2, 'heart');

  -- Alice's square route around the block, made for tournament A; Bob has his own.
  r := public.record_shape_route_request(alice, t1, 'square', 15, null, 'ok', 'shape-route-v1', jsonb_build_array(jsonb_build_object(
    'edgeIds', to_jsonb(e), 'forward', '[true, true, true, true]'::jsonb, 'lengthM', 400, 'minutes', 6, 'loop', true, 'shapeScore', 100, 'backtrack', 0, 'recentOverlap', 0)));
  cand := (r -> 'candidateIds' ->> 0)::uuid;
  r := public.record_shape_route_request(bob, t1, 'square', 15, null, 'ok', 'shape-route-v1', jsonb_build_array(jsonb_build_object(
    'edgeIds', to_jsonb(e), 'forward', '[false, false, false, false]'::jsonb, 'lengthM', 400, 'minutes', 6, 'loop', true, 'shapeScore', 100, 'backtrack', 0, 'recentOverlap', 0)));
  bob_cand := (r -> 'candidateIds' ->> 0)::uuid;

  perform set_config('request.jwt.claim.sub', alice::text, true);
  a := public.assign_shape_route(cand);

  -- The route reads back in walking order, each step turned the way it's walked, for its owner only.
  route := public.assignment_route(a);
  if route ->> 'shapeKey' <> 'square' or jsonb_array_length(route -> 'legs') <> 4 then raise exception 'Route read back wrong: %', route; end if;
  if (route -> 'legs' -> 1 ->> 'edgeId')::uuid <> e[2] then raise exception 'Legs out of order'; end if;
  if (route -> 'legs' -> 0 -> 'coords' -> 0 ->> 0)::float8 <> L then raise exception 'First leg not walked from its start'; end if;
  perform set_config('request.jwt.claim.sub', bob::text, true);
  if not pg_temp.raises(format('select public.assignment_route(%L)', a), 'not_your_route') then raise exception 'Bob read Alice''s route'; end if;
  perform set_config('request.jwt.claim.sub', '', true);

  -- A walk links only to its owner's route, in the route's tournament, once.
  insert into public.gps_sessions (tournament_id, user_id) values (t1, alice) returning id into s_alice;
  -- One open walk per player, so the walk in the other tournament is a closed one.
  insert into public.gps_sessions (tournament_id, user_id, status) values (t2, alice, 'cancelled') returning id into s_other;
  if not pg_temp.raises(format('select public.link_route_session(%L, %L, %L)', a, s_alice, bob), 'not_your_route') then raise exception 'Bob linked Alice''s route'; end if;
  if not pg_temp.raises(format('select public.link_route_session(%L, %L, %L)', a, s_other, alice), 'wrong_tournament') then raise exception 'Route used in another tournament'; end if;
  perform public.link_route_session(a, s_alice, alice);
  if (select status from public.shape_route_assignments where id = a) <> 'walking' then raise exception 'Assignment not walking'; end if;
  insert into public.gps_sessions (tournament_id, user_id, status) values (t1, alice, 'cancelled') returning id into s_other;
  if not pg_temp.raises(format('select public.link_route_session(%L, %L, %L)', a, s_other, alice), 'route_in_use') then raise exception 'One route linked to two walks'; end if;

  -- Scoring needs the linked route; the record carries shape, tier and the score's parts.
  sub := public.record_shape_route_submission(s_alice, 90, 0.95, 1, 91.5, 0.1, '[[0,0],[1,1]]'::jsonb, '[[0,0],[1,1]]'::jsonb, 420, 360, 'shape-route-score-v1');
  if sub.tier <> 'easy' or sub.shape_key <> 'square' or sub.assignment_id <> a or sub.score <> 91.5 or sub.similarity <> 90 or sub.route_completion <> 0.95 then
    raise exception 'Submission wrong: %', row_to_json(sub);
  end if;
  if (select status from public.shape_route_assignments where id = a) <> 'completed' then raise exception 'Assignment not completed'; end if;
  if (select status from public.gps_sessions where id = s_alice) <> 'submitted' then raise exception 'Session not closed'; end if;
  -- Repeating returns the same record.
  if (public.record_shape_route_submission(s_alice, 10, 0.5, 1, 10, 0.9, '[]'::jsonb, '[]'::jsonb, 1, 1, 'x')).id <> sub.id then raise exception 'Repeat made a second score'; end if;
  -- A new walk with no picked route can't be scored.
  insert into public.gps_sessions (tournament_id, user_id) values (t1, alice) returning id into s_other;
  if not pg_temp.raises(format('select public.record_shape_route_submission(%L, 90, 0.95, 1, 92.5, 0.1, %L, %L, 420, 360, %L)', s_other, '[]', '[]', 'shape-route-score-v1'), 'route_required') then
    raise exception 'Scored a walk with no route';
  end if;
  -- The walked route feeds the novelty check.
  if public.recent_route_edges(alice, 10) -> 0 ->> 0 <> e[1]::text then raise exception 'Completed route not in history'; end if;

  -- Clients can't call the scoring or linking functions.
  if has_function_privilege('authenticated', 'public.record_shape_route_submission(uuid, numeric, numeric, numeric, numeric, double precision, jsonb, jsonb, double precision, integer, text)', 'execute')
    or has_function_privilege('authenticated', 'public.link_route_session(uuid, uuid, uuid)', 'execute') then
    raise exception 'A client can score or link';
  end if;

  -- Bob's pick is his alone.
  perform set_config('request.jwt.claim.sub', alice::text, true);
  if not pg_temp.raises(format('select public.assign_shape_route(%L)', bob_cand), 'not_your_route') then raise exception 'Alice picked Bob''s route'; end if;

  raise notice 'shape_play: all checks passed';
end;
$$;
rollback;
