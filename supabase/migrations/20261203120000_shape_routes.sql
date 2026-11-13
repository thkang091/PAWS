-- PAWS phase 2.5A: walkable route generation for Follow the Shape.
--
-- Routes are built only from the PAWS pedestrian graph (road_nodes / road_edges from phase 3): data an organizer
-- imported under a recorded source and licence, then checked road by road. Nothing here calls Google; Google Maps
-- is only the backdrop the app draws on.
--
--   road_edges.access / foot / path_type   pedestrian tags from the import (OpenStreetMap-style values)
--   road_edges.walk_eligible               verified by a person AND not private, no-foot, or a highway (generated)
--   walk_graph_near()                      the eligible graph around a point, from published areas only
--   shape_route_*                          requests, candidates, assignments, history, algorithm versions
--
-- Privacy: a request stores the public junction the route starts from, never the phone's position. Requests,
-- candidates and assignments are readable only by their owner; nobody but the service role writes them.

-- ---------------------------------------------------------------------------------------------------------------
-- Pedestrian attributes on the shared road graph
-- ---------------------------------------------------------------------------------------------------------------

alter table public.road_edges add column if not exists access text check (access is null or char_length(access) <= 40);
alter table public.road_edges add column if not exists foot text check (foot is null or char_length(foot) <= 40);
alter table public.road_edges add column if not exists path_type text check (path_type is null or char_length(path_type) <= 40);

-- Same rule as isWalkable in supabase/functions/tournament/routes.ts. Unknown access is only eligible because a
-- person verified the road; pending, unsafe and disabled roads never are.
alter table public.road_edges add column if not exists walk_eligible boolean generated always as (
  status = 'verified'
  and coalesce(access, '') not in ('private', 'no', 'restricted', 'customers', 'delivery', 'agricultural', 'forestry', 'military')
  and coalesce(foot, '') not in ('private', 'no', 'restricted', 'customers', 'delivery', 'agricultural', 'forestry', 'military')
  and coalesce(path_type, '') not in ('motorway', 'motorway_link', 'trunk', 'trunk_link', 'construction', 'proposed', 'abandoned', 'raceway', 'bus_guideway', 'busway', 'escape')
) stored;
create index if not exists road_edges_walk_idx on public.road_edges (region_id) where walk_eligible;

create or replace function public.road_tags_prohibited(p_access text, p_foot text, p_path_type text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_access, '') in ('private', 'no', 'restricted', 'customers', 'delivery', 'agricultural', 'forestry', 'military')
    or coalesce(p_foot, '') in ('private', 'no', 'restricted', 'customers', 'delivery', 'agricultural', 'forestry', 'military')
    or coalesce(p_path_type, '') in ('motorway', 'motorway_link', 'trunk', 'trunk_link', 'construction', 'proposed', 'abandoned', 'raceway', 'bus_guideway', 'busway', 'escape');
$$;

-- Phase 3's import, now also keeping the pedestrian tags each road arrived with.
create or replace function public.import_road_graph(p_region_id uuid, p_nodes jsonb, p_edges jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_region competition_regions;
  v_node jsonb;
  v_edge jsonb;
  v_count integer := 0;
  v_geom extensions.geometry;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  select * into v_region from competition_regions where id = p_region_id;
  if v_region.id is null then raise exception 'region_not_found'; end if;
  if v_region.status <> 'draft' then raise exception 'region_not_draft'; end if;
  if jsonb_array_length(p_edges) > 2000 then raise exception 'too_many_roads'; end if;

  for v_node in select * from jsonb_array_elements(p_nodes) loop
    insert into road_nodes (region_id, key, geom)
    values (p_region_id, v_node ->> 'key', st_setsrid(st_makepoint((v_node ->> 'longitude')::float8, (v_node ->> 'latitude')::float8), 4326))
    on conflict (region_id, key) do nothing;
  end loop;

  for v_edge in select * from jsonb_array_elements(p_edges) loop
    v_geom := st_setsrid(st_geomfromgeojson(jsonb_build_object('type', 'LineString', 'coordinates', v_edge -> 'coords')::text), 4326);
    if not st_isvalid(v_geom) or st_npoints(v_geom) < 2 then continue; end if;
    insert into road_edges (region_id, start_node_id, end_node_id, name, geom, length_m, access, foot, path_type)
    select p_region_id, s.id, e.id, nullif(left(v_edge ->> 'name', 80), ''), v_geom, st_length(v_geom::geography),
      nullif(lower(left(v_edge ->> 'access', 40)), ''), nullif(lower(left(v_edge ->> 'foot', 40)), ''), nullif(lower(left(v_edge ->> 'pathType', 40)), '')
    from road_nodes s, road_nodes e
    where s.region_id = p_region_id and s.key = v_edge ->> 'startKey' and e.region_id = p_region_id and e.key = v_edge ->> 'endKey';
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('imported', v_count);
end;
$$;

-- Phase 3's review, now refusing to verify a road whose own tags say it is private, no-foot or a highway.
create or replace function public.set_road_edge_status(p_edge_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  if p_status not in ('pending', 'verified', 'unsafe', 'disabled') then raise exception 'bad_status'; end if;
  if p_status = 'verified' and exists (select 1 from road_edges where id = p_edge_id and road_tags_prohibited(access, foot, path_type)) then
    raise exception 'prohibited_road';
  end if;
  update road_edges set status = p_status, review_note = left(coalesce(p_note, ''), 300), reviewed_by = auth.uid(), reviewed_at = timezone('utc', now())
  where id = p_edge_id
    and exists (select 1 from competition_regions r where r.id = region_id and r.status = 'draft');
  if not found then raise exception 'edge_not_editable'; end if;
end;
$$;

-- The eligible graph within a radius of a point, from published areas only, for the route generator. Edges come
-- with both ends so the generator can join them; nothing about any player is returned.
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
    join competition_regions g on g.id = e.region_id and g.status = 'published'
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

-- ---------------------------------------------------------------------------------------------------------------
-- Diamond joins the shape presets (taller than wide, so it never matches a turned square)
-- ---------------------------------------------------------------------------------------------------------------

insert into public.shape_presets (key, name, difficulty, closed, min_distance_m, points)
values ('diamond', 'Diamond', 'easy', true, 300, '[[0, 1], [0.6, 0], [0, -1], [-0.6, 0]]'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------------------------------------------
-- Route generation records
-- ---------------------------------------------------------------------------------------------------------------

create table public.shape_route_algorithms (
  version text primary key,
  params jsonb not null,
  created_at timestamptz not null default timezone('utc', now())
);
insert into public.shape_route_algorithms (version, params) values ('shape-route-v1', '{
  "walkMps": 1.1, "lengthTolerance": 0.25, "maxStartSnapM": 120, "connectorM": 150,
  "maxOptionOverlap": 0.4, "maxRecentOverlap": 0.6, "maxBacktrack": 0.25, "sameWalkM": 35,
  "minScore": {"triangle": 75, "square": 80, "diamond": 80, "heart": 75, "star": 70, "lightning": 70, "letter_s": 70},
  "shapeScoring": "frechet-v1"
}'::jsonb);

create table public.shape_route_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete set null,
  shape_key text not null references public.shape_presets(key),
  minutes integer not null check (minutes in (15, 25, 40)),
  -- The public junction the routes start from, never the phone's position.
  start_node_id uuid references public.road_nodes(id) on delete set null,
  outcome text not null check (outcome in ('ok', 'no_network', 'no_public_start', 'no_feasible_route', 'shape_not_possible')),
  algorithm_version text not null references public.shape_route_algorithms(version),
  created_at timestamptz not null default timezone('utc', now())
);
create index shape_route_requests_user_idx on public.shape_route_requests (user_id, created_at desc);

-- Candidates keep edge ids and measurements only. The geometry is the PAWS graph's own and is rebuilt from it.
create table public.shape_route_candidates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.shape_route_requests(id) on delete cascade,
  rank smallint not null check (rank between 1 and 3),
  edge_ids uuid[] not null check (cardinality(edge_ids) > 0),
  -- Walking direction of each edge, same order as edge_ids.
  forward boolean[] not null,
  length_m double precision not null check (length_m > 0),
  minutes integer not null,
  loop boolean not null,
  shape_score numeric(5, 1) not null,
  backtrack numeric(5, 3) not null,
  recent_overlap numeric(5, 3) not null,
  unique (request_id, rank),
  check (cardinality(forward) = cardinality(edge_ids))
);

create table public.shape_route_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.shape_route_candidates(id) on delete cascade,
  tournament_id uuid references public.tournaments(id) on delete set null,
  session_id uuid references public.gps_sessions(id) on delete set null,
  status text not null default 'assigned' check (status in ('assigned', 'walking', 'completed', 'abandoned')),
  assigned_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);
create unique index shape_route_assignments_one_open_idx on public.shape_route_assignments (user_id) where status in ('assigned', 'walking');
create index shape_route_assignments_history_idx on public.shape_route_assignments (user_id, completed_at desc) where status = 'completed';

alter table public.shape_route_algorithms enable row level security;
alter table public.shape_route_requests enable row level security;
alter table public.shape_route_candidates enable row level security;
alter table public.shape_route_assignments enable row level security;
create policy shape_route_algorithms_read on public.shape_route_algorithms for select to authenticated using (true);
create policy shape_route_requests_own on public.shape_route_requests for select to authenticated using (user_id = auth.uid());
create policy shape_route_candidates_own on public.shape_route_candidates for select to authenticated
  using (exists (select 1 from shape_route_requests r where r.id = request_id and r.user_id = auth.uid()));
create policy shape_route_assignments_own on public.shape_route_assignments for select to authenticated using (user_id = auth.uid());

-- Stores one generation run and its options. Service role only: the edge function runs the generator.
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
begin
  if jsonb_array_length(coalesce(p_candidates, '[]'::jsonb)) > 3 then raise exception 'too_many_candidates'; end if;
  if p_outcome = 'ok' and jsonb_array_length(coalesce(p_candidates, '[]'::jsonb)) = 0 then raise exception 'no_candidates'; end if;
  insert into shape_route_requests (user_id, tournament_id, shape_key, minutes, start_node_id, outcome, algorithm_version)
  values (p_user_id, p_tournament_id, p_shape_key, p_minutes, p_start_node_id, p_outcome, p_algorithm)
  returning id into v_request;
  for v_cand in select * from jsonb_array_elements(coalesce(p_candidates, '[]'::jsonb)) loop
    v_rank := v_rank + 1;
    -- Every edge must be eligible right now: a candidate can never reference a private or unreviewed road.
    if exists (
      select 1 from jsonb_array_elements_text(v_cand -> 'edgeIds') x(id)
      left join road_edges e on e.id = x.id::uuid
      where e.id is null or not e.walk_eligible
    ) then raise exception 'ineligible_edge'; end if;
    insert into shape_route_candidates (request_id, rank, edge_ids, forward, length_m, minutes, loop, shape_score, backtrack, recent_overlap)
    values (v_request, v_rank,
      array(select x::uuid from jsonb_array_elements_text(v_cand -> 'edgeIds') x),
      array(select x::boolean from jsonb_array_elements_text(v_cand -> 'forward') x),
      (v_cand ->> 'lengthM')::float8, (v_cand ->> 'minutes')::int, (v_cand ->> 'loop')::boolean,
      (v_cand ->> 'shapeScore')::numeric, (v_cand ->> 'backtrack')::numeric, (v_cand ->> 'recentOverlap')::numeric)
    returning id into v_id;
    v_ids := v_ids || to_jsonb(v_id);
  end loop;
  return jsonb_build_object('requestId', v_request, 'candidateIds', v_ids);
end;
$$;
revoke execute on function public.record_shape_route_request(uuid, uuid, text, integer, uuid, text, text, jsonb) from public, anon, authenticated;

-- A player picks one of their own options. Any earlier open assignment is abandoned.
create or replace function public.assign_shape_route(p_candidate_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req shape_route_requests;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  select r.* into v_req from shape_route_candidates c join shape_route_requests r on r.id = c.request_id where c.id = p_candidate_id;
  if v_req.id is null or v_req.user_id <> auth.uid() then raise exception 'not_your_route'; end if;
  if v_req.created_at < timezone('utc', now()) - interval '24 hours' then raise exception 'route_expired'; end if;
  update shape_route_assignments set status = 'abandoned' where user_id = auth.uid() and status in ('assigned', 'walking');
  insert into shape_route_assignments (user_id, candidate_id, tournament_id) values (auth.uid(), p_candidate_id, v_req.tournament_id)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.assign_shape_route(uuid) from anon;

-- The player's own recent completed routes, newest first, as edge id lists for the generator's novelty check.
create or replace function public.recent_route_edges(p_user_id uuid, p_limit integer default 10)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(x.edge_ids) order by x.completed_at desc), '[]'::jsonb)
  from (
    select c.edge_ids, a.completed_at from shape_route_assignments a join shape_route_candidates c on c.id = a.candidate_id
    where a.user_id = p_user_id and a.status = 'completed'
    order by a.completed_at desc limit least(greatest(p_limit, 1), 20)
  ) x;
$$;
revoke execute on function public.recent_route_edges(uuid, integer) from public, anon, authenticated;

-- Retention: options nobody picked are deleted after 30 days; picked routes stay with the player's history.
-- Schedule daily with pg_cron where available:
--   select cron.schedule('purge-shape-routes', '30 3 * * *', $$select public.purge_shape_routes(30)$$);
create or replace function public.purge_shape_routes(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from shape_route_requests r
  where r.created_at < timezone('utc', now()) - make_interval(days => greatest(p_days, 1))
    and not exists (select 1 from shape_route_candidates c join shape_route_assignments a on a.candidate_id = c.id where c.request_id = r.id);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.purge_shape_routes(integer) from public, anon, authenticated;
revoke execute on function public.walk_graph_near(double precision, double precision, integer) from anon;
