-- Follow the Shape on OpenStreetMap networks against real PostGIS: storing a fetched network, serving it back only
-- when a recent fetch covered the whole circle, recording OpenStreetMap route candidates, rebuilding a picked
-- route's legs, history for the novelty check, and who may call what. Everything is rolled back.
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
  L constant float8 := -122.45;
  B constant float8 := 37.75;
  D constant float8 := 0.0022;
  alice uuid := gen_random_uuid();
  edges jsonb;
  g jsonb;
  r jsonb;
  cand uuid;
  a uuid;
  route jsonb;
begin
  insert into auth.users (id, email) values (alice, 'alice@osm.test');
  insert into public.profiles (id) values (alice) on conflict do nothing;

  -- A block of four OpenStreetMap street pieces around (B, L).
  edges := jsonb_build_array(
    jsonb_build_object('id', 'osm:w1:1-2', 'wayId', 1, 'a', 'osm:n1', 'b', 'osm:n2', 'coords', jsonb_build_array(jsonb_build_array(L, B), jsonb_build_array(L + D, B)), 'lengthM', 193.6, 'pathType', 'residential', 'warnings', '["no_sidewalk_mapped"]'::jsonb),
    jsonb_build_object('id', 'osm:w2:2-3', 'wayId', 2, 'a', 'osm:n2', 'b', 'osm:n3', 'coords', jsonb_build_array(jsonb_build_array(L + D, B), jsonb_build_array(L + D, B + D)), 'lengthM', 244.6, 'pathType', 'footway', 'warnings', '[]'::jsonb),
    jsonb_build_object('id', 'osm:w3:3-4', 'wayId', 3, 'a', 'osm:n3', 'b', 'osm:n4', 'coords', jsonb_build_array(jsonb_build_array(L + D, B + D), jsonb_build_array(L, B + D)), 'lengthM', 193.6, 'pathType', 'residential', 'warnings', '[]'::jsonb),
    jsonb_build_object('id', 'osm:w4:4-1', 'wayId', 4, 'a', 'osm:n4', 'b', 'osm:n1', 'coords', jsonb_build_array(jsonb_build_array(L, B + D), jsonb_build_array(L, B)), 'lengthM', 244.6, 'pathType', 'residential', 'warnings', '[]'::jsonb));

  -- Nothing stored yet: the function must fetch.
  if public.osm_walk_graph_near(B, L, 600, 'osm-walk-v1') is not null then raise exception 'Served a network never fetched'; end if;

  perform public.store_osm_walk_area(B, L, 900, 'osm-walk-v1', edges, '{"building": 2}'::jsonb);
  g := public.osm_walk_graph_near(B, L, 600, 'osm-walk-v1');
  if jsonb_array_length(g -> 'edges') <> 4 or jsonb_array_length(g -> 'nodes') <> 4 then raise exception 'Stored network wrong: %', g; end if;
  if (g -> 'edges' -> 0 ->> 'walkable')::boolean is not true then raise exception 'Edges not marked walkable'; end if;
  -- The geometry comes back exactly as stored.
  if (select count(*) from jsonb_array_elements(g -> 'edges') e where e ->> 'id' = 'osm:w2:2-3' and (e -> 'coords' -> 1 ->> 1)::float8 = B + D) <> 1 then raise exception 'Geometry changed'; end if;

  -- Not served when the stored circle doesn't cover the request, the rules version differs, or it's too old.
  if public.osm_walk_graph_near(B + 0.006, L, 600, 'osm-walk-v1') is not null then raise exception 'Served beyond the fetched circle'; end if;
  if public.osm_walk_graph_near(B, L, 1200, 'osm-walk-v1') is not null then raise exception 'Served a bigger circle than fetched'; end if;
  if public.osm_walk_graph_near(B, L, 600, 'osm-walk-v2') is not null then raise exception 'Served under different rules'; end if;
  update public.osm_walk_areas set fetched_at = now() - interval '30 days';
  if public.osm_walk_graph_near(B, L, 600, 'osm-walk-v1') is not null then raise exception 'Served a stale network'; end if;
  -- A newer fetch serves only what it refreshed: an edge the newer fetch didn't include (deleted from the map) is gone.
  update public.osm_walk_edges set fetched_at = now() - interval '30 days';
  perform public.store_osm_walk_area(B, L, 900, 'osm-walk-v1', edges - 3, '{}'::jsonb);
  if jsonb_array_length(public.osm_walk_graph_near(B, L, 600, 'osm-walk-v1') -> 'edges') <> 3 then raise exception 'Served an edge the latest fetch dropped'; end if;
  perform public.store_osm_walk_area(B, L, 900, 'osm-walk-v1', edges, '{}'::jsonb);

  -- OpenStreetMap candidates: every edge must be in the store; sources can't be mixed.
  if not pg_temp.raises(format('select public.record_shape_route_request(%L, null, %L, 15, null, %L, %L, %L::jsonb)', alice, 'square', 'ok', 'shape-route-v2+osm-walk-v1',
      jsonb_build_array(jsonb_build_object('source', 'osm', 'edgeIds', '["osm:w1:1-2", "osm:w777:9-8"]'::jsonb, 'forward', '[true, true]'::jsonb, 'lengthM', 400, 'minutes', 6, 'loop', true, 'shapeScore', 90, 'estimate', 80, 'backtrack', 0, 'recentOverlap', 0))), 'ineligible_edge') then
    raise exception 'Accepted an edge that is not in the store';
  end if;
  if not pg_temp.raises(format('select public.record_shape_route_request(%L, null, %L, 15, null, %L, %L, %L::jsonb)', alice, 'square', 'ok', 'shape-route-v2+osm-walk-v1',
      jsonb_build_array(
        jsonb_build_object('source', 'osm', 'edgeIds', '["osm:w1:1-2"]'::jsonb, 'forward', '[true]'::jsonb, 'lengthM', 194, 'minutes', 3, 'loop', false, 'shapeScore', 90, 'estimate', 80, 'backtrack', 0, 'recentOverlap', 0),
        jsonb_build_object('source', 'paws', 'edgeIds', jsonb_build_array(gen_random_uuid()), 'forward', '[true]'::jsonb, 'lengthM', 194, 'minutes', 3, 'loop', false, 'shapeScore', 90, 'estimate', 80, 'backtrack', 0, 'recentOverlap', 0))), 'mixed_sources') then
    raise exception 'Mixed networks in one request';
  end if;
  r := public.record_shape_route_request(alice, null, 'square', 15, null, 'ok', 'shape-route-v2+osm-walk-v1', jsonb_build_array(jsonb_build_object(
    'source', 'osm', 'edgeIds', '["osm:w1:1-2", "osm:w2:2-3", "osm:w3:3-4", "osm:w4:4-1"]'::jsonb, 'forward', '[true, true, true, true]'::jsonb,
    'lengthM', 876.4, 'minutes', 13, 'loop', true, 'shapeScore', 100, 'estimate', 94.5, 'backtrack', 0, 'recentOverlap', 0, 'warnings', '["no_sidewalk_mapped"]'::jsonb)));
  cand := (r -> 'candidateIds' ->> 0)::uuid;
  if (select source from public.shape_route_candidates where id = cand) <> 'osm' or (select cardinality(edge_ids) from public.shape_route_candidates where id = cand) <> 0 then raise exception 'Candidate stored wrong'; end if;
  if (select source from public.shape_route_requests where id = (r ->> 'requestId')::uuid) <> 'osm' then raise exception 'Request source missing'; end if;
  -- The table itself refuses a candidate with neither kind of edge.
  if not pg_temp.raises(format('insert into public.shape_route_candidates (request_id, rank, source, edge_ids, forward, length_m, minutes, loop, shape_score, backtrack, recent_overlap) values (%L, 2, %L, %L, %L, 1, 1, true, 1, 0, 0)', (r ->> 'requestId')::uuid, 'osm', '{}', '{}'), 'shape_route_candidates_edges_check') then
    raise exception 'Empty candidate stored';
  end if;

  -- The picked route reads back from the OpenStreetMap store, in order and direction, with its warnings and estimate.
  perform set_config('request.jwt.claim.sub', alice::text, true);
  a := public.assign_shape_route(cand);
  route := public.assignment_route(a);
  if route ->> 'source' <> 'osm' or jsonb_array_length(route -> 'legs') <> 4 or (route ->> 'estimate')::numeric <> 94.5 or route -> 'warnings' ->> 0 <> 'no_sidewalk_mapped' then raise exception 'Route read back wrong: %', route; end if;
  if route -> 'legs' -> 2 ->> 'edgeId' <> 'osm:w3:3-4' then raise exception 'Legs out of order'; end if;
  perform set_config('request.jwt.claim.sub', '', true);

  -- Walked routes feed the novelty check with their OpenStreetMap keys.
  update public.shape_route_assignments set status = 'completed', completed_at = now() where id = a;
  if public.recent_route_edges(alice, 5) -> 0 ->> 0 <> 'osm:w1:1-2' then raise exception 'History lost the keys'; end if;
  -- A purge keeps edges a picked route still uses.
  update public.osm_walk_edges set fetched_at = now() - interval '90 days';
  perform public.purge_osm_walk(60);
  if (select count(*) from public.osm_walk_edges where id like 'osm:w_:%') <> 4 then raise exception 'Purged edges of a walked route'; end if;

  -- Only the edge function stores or reads networks; players can't read the tables.
  if has_function_privilege('authenticated', 'public.store_osm_walk_area(double precision, double precision, integer, text, jsonb, jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.osm_walk_graph_near(double precision, double precision, integer, text, integer)', 'execute') then
    raise exception 'A client can store or read networks';
  end if;
  perform set_config('request.jwt.claim.sub', alice::text, true);
  execute 'set local role authenticated';
  if (select count(*) from public.osm_walk_edges) <> 0 then raise exception 'Players read the network table'; end if;
  execute 'reset role';

  raise notice 'osm_walk_routes: all checks passed';
end;
$$;
rollback;
