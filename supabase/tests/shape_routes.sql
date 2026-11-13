-- Follow the Shape walking routes (phase 2.5A) against real PostGIS: pedestrian tags, the walk_eligible rule, the
-- graph the generator sees, candidate checks, ownership and privacy. Run as a database administrator after the
-- migrations. Everything is rolled back.
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
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', u::text, true), set_config('request.jwt.claim.role', 'authenticated', true);
$$;

do $$
declare
  L constant float8 := -122.45;
  B constant float8 := 37.75;
  D constant float8 := 0.001;
  org uuid := gen_random_uuid();
  alice uuid := gen_random_uuid();
  bob uuid := gen_random_uuid();
  region uuid;
  draft uuid;
  nodes jsonb := '[]'::jsonb;
  edges jsonb := '[]'::jsonb;
  g jsonb;
  ids uuid[];
  priv uuid;
  mway uuid;
  r jsonb;
  cand uuid;
  n integer;
begin
  insert into auth.users (id, email) values (org, 'org@test.paws'), (alice, 'alice@test.paws'), (bob, 'bob@test.paws');
  insert into public.profiles (id) values (org), (alice), (bob) on conflict do nothing;
  insert into public.tournament_organizers (user_id) values (org);

  -- Diamond is a preset.
  if not exists (select 1 from public.shape_presets where key = 'diamond' and closed) then raise exception 'Diamond preset missing'; end if;

  -- A 4 x 4 grid of public streets, a private drive across it, and a motorway along one side.
  for c in 0..3 loop for rr in 0..3 loop
    nodes := nodes || jsonb_build_object('key', c || '_' || rr, 'latitude', B + rr * D, 'longitude', L + c * D);
  end loop; end loop;
  for c in 0..3 loop for rr in 0..3 loop
    if c < 3 then edges := edges || jsonb_build_object('startKey', c || '_' || rr, 'endKey', (c + 1) || '_' || rr, 'pathType', 'residential',
      'coords', jsonb_build_array(jsonb_build_array(L + c * D, B + rr * D), jsonb_build_array(L + (c + 1) * D, B + rr * D))); end if;
    if rr < 3 then edges := edges || jsonb_build_object('startKey', c || '_' || rr, 'endKey', c || '_' || (rr + 1), 'pathType', 'footway',
      'coords', jsonb_build_array(jsonb_build_array(L + c * D, B + rr * D), jsonb_build_array(L + c * D, B + (rr + 1) * D))); end if;
  end loop; end loop;
  edges := edges
    || jsonb_build_object('startKey', '0_0', 'endKey', '3_3', 'name', 'Private drive', 'access', 'PRIVATE', 'pathType', 'service',
         'coords', jsonb_build_array(jsonb_build_array(L, B), jsonb_build_array(L + 3 * D, B + 3 * D)))
    || jsonb_build_object('startKey', '0_3', 'endKey', '3_0', 'name', 'Motorway', 'pathType', 'motorway',
         'coords', jsonb_build_array(jsonb_build_array(L, B + 3 * D), jsonb_build_array(L + 3 * D, B)));

  perform pg_temp.as_user(org);
  region := (public.create_competition_region('Route grid', B, L, 'PAWS test fixture', 'Test data, not a real street', '')).id;
  perform public.import_road_graph(region, nodes, edges);
  select id into priv from public.road_edges where region_id = region and name = 'Private drive';
  select id into mway from public.road_edges where region_id = region and name = 'Motorway';
  if (select access from public.road_edges where id = priv) <> 'private' or (select path_type from public.road_edges where id = mway) <> 'motorway' then
    raise exception 'Import lost the pedestrian tags';
  end if;
  if (select count(*) from public.road_edges where region_id = region and path_type = 'footway') <> 12 then raise exception 'Footway tags missing'; end if;

  -- Nothing is eligible until a person verifies it.
  if exists (select 1 from public.road_edges where region_id = region and walk_eligible) then raise exception 'Unreviewed roads are walkable'; end if;

  -- Tagged private or highway roads can't be verified at all.
  if not pg_temp.raises(format('select public.set_road_edge_status(%L, %L, %L)', priv, 'verified', ''), 'prohibited_road') then raise exception 'Verified a private road'; end if;
  if not pg_temp.raises(format('select public.set_road_edge_status(%L, %L, %L)', mway, 'verified', ''), 'prohibited_road') then raise exception 'Verified a motorway'; end if;
  perform public.set_road_edge_status(priv, 'unsafe', 'Private');
  perform public.set_road_edge_status(mway, 'unsafe', 'Motorway');
  ids := array(select id from public.road_edges where region_id = region and name is null order by id);
  for i in 1..array_length(ids, 1) loop
    perform public.set_road_edge_status(ids[i], case when i = 1 then 'unsafe' else 'verified' end, '');
  end loop;

  -- The generated rule matches: verified and not prohibited.
  if (select count(*) from public.road_edges where region_id = region and walk_eligible) <> array_length(ids, 1) - 1 then raise exception 'walk_eligible count wrong'; end if;
  -- Even a forced status can't make a prohibited road eligible.
  update public.road_edges set status = 'verified' where id = priv;
  if (select walk_eligible from public.road_edges where id = priv) then raise exception 'A private road became walkable'; end if;
  update public.road_edges set status = 'unsafe' where id = priv;

  -- Drafts are never routed on.
  g := public.walk_graph_near(B + 1.5 * D, L + 1.5 * D, 2500);
  if jsonb_array_length(g -> 'edges') <> 0 then raise exception 'Draft area served to the generator'; end if;
  perform public.publish_competition_region(region);
  g := public.walk_graph_near(B + 1.5 * D, L + 1.5 * D, 2500);
  if jsonb_array_length(g -> 'edges') <> array_length(ids, 1) - 1 then raise exception 'Graph has % edges', jsonb_array_length(g -> 'edges'); end if;
  if exists (select 1 from jsonb_array_elements(g -> 'edges') e where (e ->> 'id')::uuid in (priv, mway, ids[1])) then raise exception 'Ineligible edge served'; end if;
  if jsonb_array_length(g -> 'nodes') <> 16 then raise exception 'Graph has % nodes', jsonb_array_length(g -> 'nodes'); end if;
  if (g -> 'sources' -> 0 ->> 'license') <> 'Test data, not a real street' then raise exception 'Licence not returned with the graph'; end if;
  -- Far away there is nothing.
  if jsonb_array_length(public.walk_graph_near(B + 1, L, 2500) -> 'edges') <> 0 then raise exception 'Graph returned far away'; end if;

  -- Candidates are re-checked: an ineligible edge is refused, an eligible route is stored.
  if not pg_temp.raises(format('select public.record_shape_route_request(%L, null, %L, 15, null, %L, %L, %L::jsonb)', alice, 'square', 'ok', 'shape-route-v1',
      jsonb_build_array(jsonb_build_object('edgeIds', jsonb_build_array(ids[2], priv), 'forward', '[true, true]'::jsonb, 'lengthM', 400, 'minutes', 6, 'loop', true, 'shapeScore', 90, 'backtrack', 0, 'recentOverlap', 0))),
      'ineligible_edge') then raise exception 'Stored a route over a private road'; end if;
  r := public.record_shape_route_request(alice, null, 'square', 15, null, 'ok', 'shape-route-v1',
      jsonb_build_array(jsonb_build_object('edgeIds', jsonb_build_array(ids[2], ids[3]), 'forward', '[true, false]'::jsonb, 'lengthM', 400, 'minutes', 6, 'loop', true, 'shapeScore', 90, 'backtrack', 0, 'recentOverlap', 0)));
  cand := (r -> 'candidateIds' ->> 0)::uuid;
  if not pg_temp.raises(format('select public.record_shape_route_request(%L, null, %L, 15, null, %L, %L, %L::jsonb)', alice, 'square', 'ok', 'shape-route-v1', '[]'), 'no_candidates') then
    raise exception 'An ok request without routes was stored';
  end if;
  perform public.record_shape_route_request(alice, null, 'star', 15, null, 'shape_not_possible', 'shape-route-v1', '[]'::jsonb);
  if has_function_privilege('authenticated', 'public.record_shape_route_request(uuid, uuid, text, integer, uuid, text, text, jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.recent_route_edges(uuid, integer)', 'execute') then
    raise exception 'A client can write route records or read anyone''s history';
  end if;

  -- Only the owner can pick, see or build history from a route.
  perform pg_temp.as_user(bob);
  if not pg_temp.raises(format('select public.assign_shape_route(%L)', cand), 'not_your_route') then raise exception 'Bob picked Alice''s route'; end if;
  execute 'set local role authenticated';
  select count(*) into n from public.shape_route_candidates where id = cand;
  if n <> 0 or exists (select 1 from public.shape_route_requests where user_id = alice) then raise exception 'Bob can see Alice''s routes'; end if;
  begin
    insert into public.shape_route_assignments (user_id, candidate_id) values (bob, cand);
    raise exception 'insert allowed';
  exception when others then
    if sqlerrm = 'insert allowed' then raise exception 'Client wrote an assignment'; end if;
  end;
  execute 'reset role';

  perform pg_temp.as_user(alice);
  execute 'set local role authenticated';
  if (select count(*) from public.shape_route_requests) <> 2 or (select count(*) from public.shape_route_candidates) <> 1 then raise exception 'Alice can''t see her own routes'; end if;
  -- Requests hold a start junction, never a phone position.
  if exists (select 1 from information_schema.columns where table_name = 'shape_route_requests' and column_name in ('latitude', 'longitude', 'start_geom', 'position')) then
    raise exception 'Requests store a position';
  end if;
  execute 'reset role';
  perform public.assign_shape_route(cand);
  perform public.assign_shape_route(cand);
  if (select count(*) from public.shape_route_assignments where user_id = alice and status = 'assigned') <> 1 then raise exception 'More than one open assignment'; end if;
  update public.shape_route_assignments set status = 'completed', completed_at = now() where user_id = alice and status = 'assigned';
  if public.recent_route_edges(alice, 10) -> 0 ->> 0 <> ids[2]::text then raise exception 'History missing the walked route'; end if;
  if jsonb_array_length(public.recent_route_edges(bob, 10)) <> 0 then raise exception 'Bob has Alice''s history'; end if;

  -- Old unpicked options are purged; picked ones stay with the history.
  update public.shape_route_requests set created_at = now() - interval '40 days' where user_id = alice;
  n := public.purge_shape_routes(30);
  if n <> 1 or not exists (select 1 from public.shape_route_candidates where id = cand) then raise exception 'Purge removed % requests, or the walked route', n; end if;

  raise notice 'shape_routes: all checks passed';
end;
$$;
rollback;
