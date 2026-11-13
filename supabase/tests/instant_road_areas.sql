-- Steal Your Road without an organizer (migration 20270311120000): a road area built from OpenStreetMap for a room,
-- published, reused nearby, played, and kept out of other games' walking network and the organizer's review list.
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
-- A street grid of `n` x `n` junctions, 100 m apart, south-west corner at (lng, lat), as the edge function sends it.
create function pg_temp.grid(lng float8, lat float8, n integer, extra jsonb default '[]') returns jsonb language sql immutable as $$
  with pts as (
    select i, j, lng + i * 100 / (111320 * cos(radians(lat))) as x, lat + j * 100 / 110540.0 as y from generate_series(0, n - 1) i, generate_series(0, n - 1) j
  )
  select jsonb_build_object(
    'nodes', (select jsonb_agg(jsonb_build_object('key', i || '_' || j, 'latitude', y, 'longitude', x)) from pts),
    'edges', (select jsonb_agg(e) from (
      select jsonb_build_object('startKey', a.i || '_' || a.j, 'endKey', b.i || '_' || b.j, 'name', 'Street ' || a.j, 'pathType', 'residential',
        'coords', jsonb_build_array(jsonb_build_array(a.x, a.y), jsonb_build_array(b.x, b.y))) as e
      from pts a join pts b on (b.i = a.i + 1 and b.j = a.j) or (b.j = a.j + 1 and b.i = a.i)
    ) s) || extra
  );
$$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 4));
  g jsonb;
  area uuid;
  r jsonb;
  room uuid;
  m uuid;
  n integer;
begin
  for i in 1..4 loop insert into auth.users (id, email) values (u[i], 'r' || i || '@test.paws'); end loop;
  insert into public.tournament_organizers (user_id) values (u[4]);

  -- ===== Building one (service role: the rooms function) =====
  -- 4 x 4 junctions: 24 streets. Plus a motorway the function would never send: the database refuses it as well.
  g := pg_temp.grid(-122.42, 37.77, 4, '[{"startKey": "0_0", "endKey": "3_3", "name": "Freeway", "pathType": "motorway", "coords": [[-122.42, 37.77], [-122.4166, 37.7727]]}]');
  area := public.create_osm_road_area(u[1], 'Streets around Street 1', 37.7713, -122.4183, g -> 'nodes', g -> 'edges');
  assert (select status = 'published' and origin = 'osm' and source = 'OpenStreetMap' and license = 'ODbL 1.0' and boundary is not null from public.competition_regions where id = area), 'published, marked as OpenStreetMap, with a boundary';
  assert (select count(*) from public.road_edges where region_id = area and allowed_for_game) = 24, 'every street playable';
  assert not exists (select 1 from public.road_edges where region_id = area and name = 'Freeway'), 'a motorway is never stored';
  assert pg_temp.raises(format('select public.create_osm_road_area(%L, %L, 37.77, -122.42, %L, %L)', u[1], 'Tiny', (pg_temp.grid(-122.43, 37.77, 2)) -> 'nodes', (pg_temp.grid(-122.43, 37.77, 2)) -> 'edges'), 'no_roads_here'),
    'four streets are not a game';
  raise notice 'pass  an area from OpenStreetMap is stored, published, and only with walkable streets';

  -- ===== Found again nearby, not elsewhere =====
  assert public.road_area_near(37.7712, -122.4180, 400) = area, 'a room nearby reuses it';
  assert public.road_area_near(37.80, -122.42, 400) is null, 'three kilometres away it is not offered';
  raise notice 'pass  areas are reused nearby';

  -- ===== Players can't make or look for areas themselves =====
  perform pg_temp.as_user(u[2]);
  execute 'set local role authenticated';
  assert pg_temp.raises(format('select public.create_osm_road_area(%L, %L, 37.77, -122.42, %L, %L)', u[2], 'Mine', g -> 'nodes', g -> 'edges'), 'permission denied'), 'players cannot store areas';
  assert pg_temp.raises('select public.road_area_near(37.77, -122.42, 400)', 'permission denied'), 'players cannot search areas directly';
  -- But they read the published roads they play on.
  assert jsonb_array_length(public.region_roads(area)) = 24, 'players see the playable roads';
  execute 'reset role';
  raise notice 'pass  only the server makes areas; players read them';

  -- ===== Played: a Steal Your Road room starts on it =====
  perform pg_temp.as_user(u[1]);
  r := public.create_room('steal_road', 'Road crew', 10, false, 10, true, null, 'Ari');
  room := (r ->> 'roomId')::uuid;
  perform pg_temp.as_user(u[2]);
  perform public.join_room(r ->> 'code', null, null, 'Bo');
  perform public.set_room_ready(room, true);
  perform pg_temp.as_user(u[1]);
  perform public.set_battle_settings(room, 15, area);
  perform public.set_member_team(room, u[1], 'blue');
  perform public.set_member_team(room, u[2], 'orange');
  m := public.start_battle(room);
  assert (select region_id = area and status = 'countdown' from public.battle_matches where id = m), 'the match plays the area';
  raise notice 'pass  a room starts Steal Your Road on an area made for it';

  -- ===== Kept apart from organizers' areas =====
  assert jsonb_array_length(public.walk_graph_near(37.7712, -122.4180, 1000) -> 'edges') = 0, 'other games never read it as an organizer''s network';
  perform pg_temp.as_user(u[4]);
  select count(*) into n from jsonb_array_elements(public.organizer_regions()) x where (x ->> 'id')::uuid = area;
  assert n = 0, 'not in the organizer''s review list';
  raise notice 'pass  OpenStreetMap areas stay out of the walking network and the review list';
end;
$$;

rollback;
