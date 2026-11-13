-- Steal Your Road without an organizer: when no published road area is near the players, the `rooms` edge function
-- builds one from the OpenStreetMap streets around the host (supabase/functions/rooms/autoSetup.ts) and stores it here.
--
--   * Its roads come only from OpenStreetMap, with the same walkability rule as everywhere else. Busy roads, streets
--     without sidewalks, rail crossings, private and prohibited ways never become roads (checked again below).
--   * These areas are kept apart from organizers' areas: origin = 'osm'. They are never part of the walking network
--     other games read (walk_graph_near), so an organizer's area keeps winning wherever it exists, and they don't
--     appear in the organizer's review list.
--   * A room near an area made earlier reuses it (road_area_near), so areas don't pile up street by street.

alter table public.competition_regions add column if not exists origin text not null default 'organizer' check (origin in ('organizer', 'osm'));

-- A published area with enough playable roads close to a point: an organizer's first, then the nearest.
create or replace function public.road_area_near(p_latitude double precision, p_longitude double precision, p_radius_m integer default 400)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  with here as (select st_setsrid(st_makepoint(p_longitude, p_latitude), 4326) as pt, least(greatest(p_radius_m, 50), 2000) as r)
  select r.id
  from competition_regions r
  cross join here h
  cross join lateral (
    select min(st_distance(e.geom::geography, h.pt::geography)) as near_m, count(*) as roads
    from road_edges e
    where e.region_id = r.id and e.allowed_for_game
  ) x
  where r.status = 'published' and x.roads >= 6 and x.near_m <= h.r
  order by (r.origin = 'organizer') desc, x.near_m, r.id
  limit 1;
$$;

-- Stores an area built from OpenStreetMap and publishes it. Service role only (the `rooms` function has checked that
-- the caller hosts an open Steal Your Road room).
create or replace function public.create_osm_road_area(p_user_id uuid, p_name text, p_center_lat double precision, p_center_lng double precision, p_nodes jsonb, p_edges jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_node jsonb;
  v_edge jsonb;
  v_geom extensions.geometry;
  v_count integer := 0;
begin
  if jsonb_typeof(p_nodes) <> 'array' or jsonb_typeof(p_edges) <> 'array' or jsonb_array_length(p_edges) > 200 then raise exception 'bad_road_area'; end if;
  insert into competition_regions (name, center_lat, center_lng, status, source, license, attribution, notes, created_by, origin, published_at)
  values (left(coalesce(nullif(btrim(p_name), ''), 'Streets near you'), 60), p_center_lat, p_center_lng, 'published',
    'OpenStreetMap', 'ODbL 1.0', '© OpenStreetMap contributors',
    'Made for a nearby room from OpenStreetMap. Busy roads, streets without sidewalks, rail crossings and private ways are left out.',
    p_user_id, 'osm', timezone('utc', now()))
  returning id into v_id;

  for v_node in select * from jsonb_array_elements(p_nodes) loop
    insert into road_nodes (region_id, key, geom)
    values (v_id, left(v_node ->> 'key', 120), st_setsrid(st_makepoint((v_node ->> 'longitude')::float8, (v_node ->> 'latitude')::float8), 4326))
    on conflict (region_id, key) do nothing;
  end loop;

  for v_edge in select * from jsonb_array_elements(p_edges) loop
    -- Defence in depth: the function never sends these, and they are never stored as playable.
    if road_tags_prohibited(v_edge ->> 'access', v_edge ->> 'foot', v_edge ->> 'pathType') then continue; end if;
    v_geom := st_setsrid(st_geomfromgeojson(jsonb_build_object('type', 'LineString', 'coordinates', v_edge -> 'coords')::text), 4326);
    if st_npoints(v_geom) < 2 or st_length(v_geom::geography) < 20 then continue; end if;
    insert into road_edges (region_id, start_node_id, end_node_id, name, geom, length_m, status, path_type, access, foot, review_note, reviewed_at)
    select v_id, s.id, e.id, nullif(left(v_edge ->> 'name', 80), ''), v_geom, st_length(v_geom::geography), 'verified',
      nullif(left(v_edge ->> 'pathType', 40), ''), nullif(left(v_edge ->> 'access', 40), ''), nullif(left(v_edge ->> 'foot', 40), ''),
      'Checked automatically from OpenStreetMap tags', timezone('utc', now())
    from road_nodes s, road_nodes e
    where s.region_id = v_id and s.key = v_edge ->> 'startKey' and e.region_id = v_id and e.key = v_edge ->> 'endKey';
    if found then v_count := v_count + 1; end if;
  end loop;
  if v_count < 6 then raise exception 'no_roads_here'; end if;

  update competition_regions set boundary = (
    select st_convexhull(st_buffer(st_collect(geom)::geography, 50)::extensions.geometry) from road_edges where region_id = v_id and status = 'verified'
  ) where id = v_id;
  return v_id;
end;
$$;

revoke execute on function public.road_area_near(double precision, double precision, integer) from public, anon, authenticated;
revoke execute on function public.create_osm_road_area(uuid, text, double precision, double precision, jsonb, jsonb) from public, anon, authenticated;

-- Other games' walking network reads organizers' areas only (as before this migration, when they were the only kind).
create or replace function public.walk_graph_near(p_latitude double precision, p_longitude double precision, p_radius_m integer default 2500)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  with here as (select st_setsrid(st_makepoint(p_longitude, p_latitude), 4326) as pt, least(greatest(p_radius_m, 200), 4000) as r),
  picked as (
    select e.* from road_edges e
    join competition_regions g on g.id = e.region_id and g.status = 'published' and g.origin = 'organizer'
    cross join here h
    where e.walk_eligible
      and e.geom && st_expand(h.pt, h.r / 80000.0)
      and st_dwithin(e.geom::geography, h.pt::geography, h.r)
  )
  select jsonb_build_object(
    'edges', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'a', p.start_node_id, 'b', p.end_node_id, 'lengthM', p.length_m, 'walkable', true,
      'access', p.access, 'foot', p.foot, 'pathType', p.path_type, 'regionId', p.region_id,
      'coords', (st_asgeojson(p.geom, 7)::jsonb) -> 'coordinates') order by p.id) from picked p), '[]'::jsonb),
    'nodes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'latitude', st_y(n.geom), 'longitude', st_x(n.geom)) order by n.id)
      from road_nodes n where n.id in (select start_node_id from picked union select end_node_id from picked)), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(distinct jsonb_build_object('regionId', g.id, 'name', g.name, 'source', g.source, 'license', g.license, 'attribution', g.attribution))
      from competition_regions g where g.id in (select region_id from picked)), '[]'::jsonb)
  );
$$;

-- The organizer's review list shows organizers' areas only.
create or replace function public.organizer_regions()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  return (
    select coalesce(jsonb_agg(row_to_json(x)::jsonb order by x."updatedAt" desc), '[]'::jsonb)
    from (
      select r.id, r.name, r.status, r.source, r.license, r.attribution, r.notes,
        r.center_lat as latitude, r.center_lng as longitude,
        r.created_at as "createdAt", r.updated_at as "updatedAt", r.published_at as "publishedAt",
        jsonb_build_object(
          'total', count(e.id),
          'pending', count(e.id) filter (where e.status = 'pending'),
          'verified', count(e.id) filter (where e.status = 'verified'),
          'unsafe', count(e.id) filter (where e.status = 'unsafe'),
          'disabled', count(e.id) filter (where e.status = 'disabled')
        ) as roads
      from competition_regions r
      left join road_edges e on e.region_id = r.id
      where r.origin = 'organizer'
      group by r.id
    ) x
  );
end;
$$;
revoke execute on function public.organizer_regions() from anon;
