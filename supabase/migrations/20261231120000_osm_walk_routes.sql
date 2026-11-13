-- PAWS: Follow the Shape routes on real OpenStreetMap pedestrian networks, where no PAWS organizer has prepared an area.
--
--   osm_walk_areas    each fetch of the network around a point: where, how far, when, rules version, what was dropped
--   osm_walk_edges    the walkable pieces of OpenStreetMap ways (supabase/functions/tournament/osm.ts, "osm-walk-v1")
--
-- OpenStreetMap data is © OpenStreetMap contributors, under the Open Database Licence. Routes built from it credit it.
-- Only the `tournament` edge function writes here. A route candidate now names its source: the PAWS graph (organizer
-- verified, edge_ids) or OpenStreetMap (edge_keys). Areas an organizer has published always win over OpenStreetMap.

create table public.osm_walk_areas (
  id uuid primary key default gen_random_uuid(),
  center extensions.geography(Point, 4326) not null,
  radius_m integer not null check (radius_m between 100 and 3000),
  version text not null,
  edge_count integer not null,
  dropped jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default timezone('utc', now())
);
create index osm_walk_areas_center_idx on public.osm_walk_areas using gist (center);

create table public.osm_walk_edges (
  id text primary key check (id ~ '^osm:w[0-9]+:[0-9]+-[0-9]+$'),
  way_id bigint not null,
  a text not null check (a ~ '^osm:n[0-9]+$'),
  b text not null check (b ~ '^osm:n[0-9]+$'),
  geom extensions.geography(LineString, 4326) not null,
  length_m double precision not null check (length_m > 0),
  path_type text,
  access text,
  foot text,
  name text,
  warnings text[] not null default '{}',
  version text not null,
  fetched_at timestamptz not null default timezone('utc', now())
);
create index osm_walk_edges_geom_idx on public.osm_walk_edges using gist (geom);

alter table public.osm_walk_areas enable row level security;
alter table public.osm_walk_edges enable row level security;
-- No policies: players never read these tables directly. Routes reach them through assignment_route.

-- Candidates name their source; OpenStreetMap candidates keep edge keys, warnings and the estimated shape match.
alter table public.shape_route_candidates drop constraint if exists shape_route_candidates_edge_ids_check;
alter table public.shape_route_candidates drop constraint if exists shape_route_candidates_check;
alter table public.shape_route_candidates alter column edge_ids set default '{}';
alter table public.shape_route_candidates add column if not exists source text not null default 'paws' check (source in ('paws', 'osm'));
alter table public.shape_route_candidates add column if not exists edge_keys text[] not null default '{}';
alter table public.shape_route_candidates add column if not exists warnings text[] not null default '{}';
alter table public.shape_route_candidates add column if not exists estimate numeric(5, 1);
alter table public.shape_route_candidates add constraint shape_route_candidates_edges_check check (
  (source = 'paws' and cardinality(edge_ids) > 0 and cardinality(forward) = cardinality(edge_ids) and cardinality(edge_keys) = 0)
  or (source = 'osm' and cardinality(edge_keys) > 0 and cardinality(forward) = cardinality(edge_keys) and cardinality(edge_ids) = 0)
);
alter table public.shape_route_requests add column if not exists source text check (source is null or source in ('paws', 'osm'));

-- Stores one fetch of the network. Service role only.
create or replace function public.store_osm_walk_area(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer,
  p_version text,
  p_edges jsonb,
  p_dropped jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  e jsonb;
begin
  for e in select * from jsonb_array_elements(coalesce(p_edges, '[]'::jsonb)) loop
    insert into osm_walk_edges (id, way_id, a, b, geom, length_m, path_type, access, foot, name, warnings, version, fetched_at)
    values (e ->> 'id', (e ->> 'wayId')::bigint, e ->> 'a', e ->> 'b',
      st_geomfromgeojson(jsonb_build_object('type', 'LineString', 'coordinates', e -> 'coords')::text)::geography,
      (e ->> 'lengthM')::float8, e ->> 'pathType', e ->> 'access', e ->> 'foot', e ->> 'name',
      array(select jsonb_array_elements_text(coalesce(e -> 'warnings', '[]'))), p_version, timezone('utc', now()))
    on conflict (id) do update set geom = excluded.geom, length_m = excluded.length_m, path_type = excluded.path_type, access = excluded.access,
      foot = excluded.foot, name = excluded.name, warnings = excluded.warnings, version = excluded.version, fetched_at = excluded.fetched_at;
  end loop;
  insert into osm_walk_areas (center, radius_m, version, edge_count, dropped)
  values (st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography, p_radius_m, p_version, jsonb_array_length(coalesce(p_edges, '[]'::jsonb)), coalesce(p_dropped, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.store_osm_walk_area(double precision, double precision, integer, text, jsonb, jsonb) from public, anon, authenticated;

-- The stored network around a point, if a recent fetch covered the whole circle; otherwise null and the edge
-- function fetches it again. Only edges refreshed by that covering fetch are returned, so a way deleted from
-- OpenStreetMap since an older fetch is never used. Service role only.
create or replace function public.osm_walk_graph_near(p_latitude double precision, p_longitude double precision, p_radius_m integer, p_version text, p_max_age_days integer default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_point geography := st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography;
  v_area osm_walk_areas;
begin
  select * into v_area from osm_walk_areas a
  where a.version = p_version
    and a.fetched_at > timezone('utc', now()) - make_interval(days => greatest(p_max_age_days, 1))
    and a.radius_m >= p_radius_m
    and st_dwithin(a.center, v_point, a.radius_m - p_radius_m)
  order by a.fetched_at desc limit 1;
  if v_area.id is null then return null; end if;
  return (
    with e as (
      select * from osm_walk_edges
      where st_dwithin(geom, v_point, p_radius_m) and fetched_at >= v_area.fetched_at - interval '5 minutes' and version = p_version
    )
    select jsonb_build_object(
      'areaId', v_area.id,
      'fetchedAt', v_area.fetched_at,
      'edges', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'a', e.a, 'b', e.b, 'wayId', e.way_id, 'lengthM', e.length_m, 'walkable', true,
        'pathType', e.path_type, 'access', e.access, 'foot', e.foot, 'name', e.name, 'warnings', to_jsonb(e.warnings),
        'coords', (st_asgeojson(e.geom::geometry, 7)::jsonb) -> 'coordinates')) from e), '[]'::jsonb),
      'nodes', coalesce((select jsonb_agg(distinct jsonb_build_object('id', n.id, 'latitude', n.lat, 'longitude', n.lng)) from (
          select e.a as id, st_y(st_startpoint(e.geom::geometry)) as lat, st_x(st_startpoint(e.geom::geometry)) as lng from e
          union
          select e.b, st_y(st_endpoint(e.geom::geometry)), st_x(st_endpoint(e.geom::geometry)) from e
        ) n), '[]'::jsonb)
    )
  );
end;
$$;
revoke execute on function public.osm_walk_graph_near(double precision, double precision, integer, text, integer) from public, anon, authenticated;

-- Candidates from either source. Every edge must exist and be eligible now; OpenStreetMap edges must be in the store.
create or replace function public.record_shape_route_request(
  p_user_id uuid, p_tournament_id uuid, p_shape_key text, p_minutes integer, p_start_node_id uuid,
  p_outcome text, p_algorithm text, p_candidates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request uuid;
  v_ids jsonb := '[]'::jsonb;
  v_cand jsonb;
  v_rank integer := 0;
  v_id uuid;
  v_source text;
  v_first text;
begin
  if jsonb_array_length(coalesce(p_candidates, '[]'::jsonb)) > 3 then raise exception 'too_many_candidates'; end if;
  if p_outcome = 'ok' and jsonb_array_length(coalesce(p_candidates, '[]'::jsonb)) = 0 then raise exception 'no_candidates'; end if;
  v_first := coalesce(p_candidates -> 0 ->> 'source', 'paws');
  insert into shape_route_requests (user_id, tournament_id, shape_key, minutes, start_node_id, outcome, algorithm_version, source)
  values (p_user_id, p_tournament_id, p_shape_key, p_minutes, case when v_first = 'paws' then p_start_node_id end, p_outcome, p_algorithm,
    case when jsonb_array_length(coalesce(p_candidates, '[]'::jsonb)) > 0 then v_first end)
  returning id into v_request;
  for v_cand in select * from jsonb_array_elements(coalesce(p_candidates, '[]'::jsonb)) loop
    v_rank := v_rank + 1;
    v_source := coalesce(v_cand ->> 'source', 'paws');
    if v_source <> v_first then raise exception 'mixed_sources'; end if;
    if v_source = 'paws' then
      if exists (
        select 1 from jsonb_array_elements_text(v_cand -> 'edgeIds') x(id)
        left join road_edges e on e.id = x.id::uuid
        where e.id is null or not e.walk_eligible
      ) then raise exception 'ineligible_edge'; end if;
      insert into shape_route_candidates (request_id, rank, source, edge_ids, forward, length_m, minutes, loop, shape_score, estimate, backtrack, recent_overlap, warnings)
      values (v_request, v_rank, 'paws',
        array(select x::uuid from jsonb_array_elements_text(v_cand -> 'edgeIds') x),
        array(select x::boolean from jsonb_array_elements_text(v_cand -> 'forward') x),
        (v_cand ->> 'lengthM')::float8, (v_cand ->> 'minutes')::int, (v_cand ->> 'loop')::boolean,
        (v_cand ->> 'shapeScore')::numeric, (v_cand ->> 'estimate')::numeric, (v_cand ->> 'backtrack')::numeric, (v_cand ->> 'recentOverlap')::numeric,
        array(select jsonb_array_elements_text(coalesce(v_cand -> 'warnings', '[]'))))
      returning id into v_id;
    elsif v_source = 'osm' then
      if exists (
        select 1 from jsonb_array_elements_text(v_cand -> 'edgeIds') x(id)
        left join osm_walk_edges e on e.id = x.id
        where e.id is null
      ) then raise exception 'ineligible_edge'; end if;
      insert into shape_route_candidates (request_id, rank, source, edge_keys, forward, length_m, minutes, loop, shape_score, estimate, backtrack, recent_overlap, warnings)
      values (v_request, v_rank, 'osm',
        array(select jsonb_array_elements_text(v_cand -> 'edgeIds')),
        array(select x::boolean from jsonb_array_elements_text(v_cand -> 'forward') x),
        (v_cand ->> 'lengthM')::float8, (v_cand ->> 'minutes')::int, (v_cand ->> 'loop')::boolean,
        (v_cand ->> 'shapeScore')::numeric, (v_cand ->> 'estimate')::numeric, (v_cand ->> 'backtrack')::numeric, (v_cand ->> 'recentOverlap')::numeric,
        array(select jsonb_array_elements_text(coalesce(v_cand -> 'warnings', '[]'))))
      returning id into v_id;
    else
      raise exception 'unknown_source';
    end if;
    v_ids := v_ids || to_jsonb(v_id);
  end loop;
  return jsonb_build_object('requestId', v_request, 'candidateIds', v_ids);
end;
$$;
revoke execute on function public.record_shape_route_request(uuid, uuid, text, integer, uuid, text, text, jsonb) from public, anon, authenticated;

-- The route of an assignment, from whichever network it came from, in walking order.
create or replace function public.assignment_route(p_assignment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_a shape_route_assignments;
  v_c shape_route_candidates;
  v_r shape_route_requests;
  v_legs jsonb;
begin
  select * into v_a from shape_route_assignments where id = p_assignment_id;
  if v_a.id is null then raise exception 'route_not_found'; end if;
  if auth.uid() is not null and v_a.user_id <> auth.uid() then raise exception 'not_your_route'; end if;
  select * into v_c from shape_route_candidates where id = v_a.candidate_id;
  select * into v_r from shape_route_requests where id = v_c.request_id;
  if v_c.source = 'osm' then
    select coalesce(jsonb_agg(jsonb_build_object(
        'edgeId', e.id, 'lengthM', e.length_m,
        'coords', (st_asgeojson(case when s.fwd then e.geom::geometry else st_reverse(e.geom::geometry) end, 7)::jsonb) -> 'coordinates') order by s.ord), '[]'::jsonb)
      into v_legs
    from unnest(v_c.edge_keys, v_c.forward) with ordinality as s(edge_key, fwd, ord)
    join osm_walk_edges e on e.id = s.edge_key;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
        'edgeId', e.id, 'lengthM', e.length_m,
        'coords', (st_asgeojson(case when s.fwd then e.geom else st_reverse(e.geom) end, 7)::jsonb) -> 'coordinates') order by s.ord), '[]'::jsonb)
      into v_legs
    from unnest(v_c.edge_ids, v_c.forward) with ordinality as s(edge_id, fwd, ord)
    join road_edges e on e.id = s.edge_id;
  end if;
  return jsonb_build_object(
    'assignmentId', v_a.id, 'status', v_a.status, 'tournamentId', v_a.tournament_id, 'sessionId', v_a.session_id,
    'shapeKey', v_r.shape_key, 'minutes', v_c.minutes, 'lengthM', v_c.length_m, 'loop', v_c."loop", 'shapeScore', v_c.shape_score,
    'estimate', v_c.estimate, 'source', v_c.source, 'warnings', to_jsonb(v_c.warnings), 'legs', v_legs
  );
end;
$$;
revoke execute on function public.assignment_route(uuid) from anon;

-- Recent completed routes as edge id lists (either network), for the novelty check.
create or replace function public.recent_route_edges(p_user_id uuid, p_limit integer default 10)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(x.ids order by x.completed_at desc), '[]'::jsonb)
  from (
    select case when c.source = 'osm' then to_jsonb(c.edge_keys) else to_jsonb(c.edge_ids) end as ids, a.completed_at
    from shape_route_assignments a join shape_route_candidates c on c.id = a.candidate_id
    where a.user_id = p_user_id and a.status = 'completed'
    order by a.completed_at desc limit least(greatest(p_limit, 1), 20)
  ) x;
$$;
revoke execute on function public.recent_route_edges(uuid, integer) from public, anon, authenticated;

-- Fetched networks older than 60 days are removed unless a picked route still uses them.
create or replace function public.purge_osm_walk(p_days integer default 60)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from osm_walk_areas where fetched_at < timezone('utc', now()) - make_interval(days => greatest(p_days, 1));
  with gone as (
    delete from osm_walk_edges e
    where e.fetched_at < timezone('utc', now()) - make_interval(days => greatest(p_days, 1))
      and not exists (
        select 1 from shape_route_assignments a join shape_route_candidates c on c.id = a.candidate_id
        where c.source = 'osm' and e.id = any (c.edge_keys)
      )
    returning 1
  )
  select count(*) into v_count from gone;
  return v_count;
end;
$$;
revoke execute on function public.purge_osm_walk(integer) from public, anon, authenticated;

-- shape-route-v2: the same rules as v1, but options are compared on the whole route (start streets included) and ranked
-- by the estimated shape match (route-estimate-v1, perfect at 0.02 instead of 0.12). The "+osm-walk-v1" version marks
-- routes built on OpenStreetMap with the rules in osm.ts.
insert into public.shape_route_algorithms (version, params)
select v, (select params from public.shape_route_algorithms where version = 'shape-route-v1')
  || jsonb_build_object('optionOverlap', 'whole route', 'estimate', 'route-estimate-v1', 'network', case when v like '%osm%' then 'osm-walk-v1' else 'paws' end)
from unnest(array['shape-route-v2', 'shape-route-v2+osm-walk-v1']) v
on conflict (version) do nothing;
