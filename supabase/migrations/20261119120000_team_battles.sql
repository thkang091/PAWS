-- PAWS Tournament, phase 3: team battles in nearby rooms. Steal Your Territory (PostGIS polygon ownership) and Steal
-- Your Road (captures on an organizer-verified walkable road graph).
--
-- Trust model, as in phases 1 and 2: clients never write ownership, scores or match status.
--   * Match lifecycle moves only through battle_transition(), which checks the allowed transitions and server time.
--   * Territory claims and road captures are validated by the `rooms` edge function (GPS rules, map matching) and
--     committed by commit_territory_claim() / commit_road_capture(), service role only.
--   * Every commit for a match takes the same transaction-scoped advisory lock, so claims are applied one at a time in
--     server commit order. The last committed claim owns any overlap; device time never decides ownership.
--   * Each commit bumps the match's sequence number, writes an event with that number, and pings the room's private
--     Realtime channel. Clients reload state and ignore anything older than what they have.

-- ---------------------------------------------------------------------------------------------------------------
-- Competition regions and the walkable road graph
-- ---------------------------------------------------------------------------------------------------------------

-- An area organizers have prepared for road games. Its roads come from a source the organizer names, under a licence
-- the organizer records, and every road is checked by hand before the region can be published.
create table public.competition_regions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  center_lat double precision not null check (center_lat between -90 and 90),
  center_lng double precision not null check (center_lng between -180 and 180),
  boundary extensions.geometry(Polygon, 4326),
  status text not null default 'draft' check (status in ('draft', 'published', 'disabled')),
  source text not null default '' check (char_length(source) <= 300),
  license text not null default '' check (char_length(license) <= 200),
  attribution text not null default '' check (char_length(attribution) <= 300),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz
);
create index competition_regions_boundary_idx on public.competition_regions using gist (boundary);

create table public.road_nodes (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.competition_regions(id) on delete cascade,
  key text not null,
  geom extensions.geometry(Point, 4326) not null,
  unique (region_id, key)
);
create index road_nodes_geom_idx on public.road_nodes using gist (geom);

create table public.road_edges (
  id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.competition_regions(id) on delete cascade,
  start_node_id uuid not null references public.road_nodes(id) on delete cascade,
  end_node_id uuid not null references public.road_nodes(id) on delete cascade,
  name text,
  geom extensions.geometry(LineString, 4326) not null,
  length_m double precision not null check (length_m > 0),
  -- Imported roads start as pending. Only verified roads can be played; unsafe and disabled ones never appear in games.
  status text not null default 'pending' check (status in ('pending', 'verified', 'unsafe', 'disabled')),
  allowed_for_game boolean generated always as (status = 'verified') stored,
  review_note text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);
create index road_edges_geom_idx on public.road_edges using gist (geom);
create index road_edges_region_idx on public.road_edges (region_id, status);

alter table public.competition_regions enable row level security;
alter table public.road_nodes enable row level security;
alter table public.road_edges enable row level security;
create policy competition_regions_read on public.competition_regions for select to authenticated using (status = 'published' or is_tournament_organizer());
create policy road_nodes_read on public.road_nodes for select to authenticated
  using (exists (select 1 from competition_regions r where r.id = region_id and (r.status = 'published' or is_tournament_organizer())));
create policy road_edges_read on public.road_edges for select to authenticated
  using ((allowed_for_game and exists (select 1 from competition_regions r where r.id = region_id and r.status = 'published')) or is_tournament_organizer());

create or replace function public.create_competition_region(p_name text, p_center_lat double precision, p_center_lng double precision, p_source text, p_license text, p_attribution text)
returns public.competition_regions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row competition_regions;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  insert into competition_regions (name, center_lat, center_lng, source, license, attribution, created_by)
  values (btrim(p_name), p_center_lat, p_center_lng, coalesce(p_source, ''), coalesce(p_license, ''), coalesce(p_attribution, ''), auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

-- Adds roads to a draft region. Nodes are matched by key within the region, so importing in several parts works.
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
    insert into road_edges (region_id, start_node_id, end_node_id, name, geom, length_m)
    select p_region_id, s.id, e.id, nullif(left(v_edge ->> 'name', 80), ''), v_geom, st_length(v_geom::geography)
    from road_nodes s, road_nodes e
    where s.region_id = p_region_id and s.key = v_edge ->> 'startKey' and e.region_id = p_region_id and e.key = v_edge ->> 'endKey';
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('imported', v_count);
end;
$$;

create or replace function public.set_road_edge_status(p_edge_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  if p_status not in ('pending', 'verified', 'unsafe', 'disabled') then raise exception 'bad_status'; end if;
  update road_edges set status = p_status, review_note = left(coalesce(p_note, ''), 300), reviewed_by = auth.uid(), reviewed_at = timezone('utc', now())
  where id = p_edge_id
    and exists (select 1 from competition_regions r where r.id = region_id and r.status = 'draft');
  if not found then raise exception 'edge_not_editable'; end if;
end;
$$;

-- A region goes live only once every road has been looked at, enough are verified, and its source is recorded.
create or replace function public.publish_competition_region(p_region_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_region competition_regions;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  select * into v_region from competition_regions where id = p_region_id for update;
  if v_region.id is null then raise exception 'region_not_found'; end if;
  if btrim(v_region.source) = '' or btrim(v_region.license) = '' then raise exception 'source_and_license_required'; end if;
  if exists (select 1 from road_edges where region_id = p_region_id and status = 'pending') then raise exception 'roads_not_reviewed'; end if;
  if (select count(*) from road_edges where region_id = p_region_id and status = 'verified') < 3 then raise exception 'too_few_verified_roads'; end if;
  update competition_regions set status = 'published', published_at = timezone('utc', now()),
    boundary = coalesce(boundary, (select st_convexhull(st_buffer(st_collect(geom)::geography, 50)::extensions.geometry) from road_edges where region_id = p_region_id and status = 'verified'))
  where id = p_region_id;
end;
$$;

-- Roads of a region as GeoJSON, for drawing. Organizers see every road and its review state; players see verified
-- roads of published regions only.
create or replace function public.region_roads(p_region_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'name', e.name, 'status', e.status, 'lengthM', e.length_m, 'note', e.review_note,
    'startNodeId', e.start_node_id, 'endNodeId', e.end_node_id,
    'coords', (st_asgeojson(e.geom)::jsonb) -> 'coordinates'
  ) order by e.created_at), '[]'::jsonb)
  from road_edges e join competition_regions r on r.id = e.region_id
  where e.region_id = p_region_id
    and (is_tournament_organizer() or (r.status = 'published' and e.allowed_for_game));
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Teams and matches
-- ---------------------------------------------------------------------------------------------------------------

alter table public.room_members add column team text check (team in ('blue', 'orange'));
alter table public.multiplayer_rooms add column battle_minutes integer not null default 15 check (battle_minutes between 10 and 30);
alter table public.multiplayer_rooms add column region_id uuid references public.competition_regions(id) on delete set null;

create table public.battle_matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.multiplayer_rooms(id) on delete cascade,
  game_type text not null check (game_type in ('steal_territory', 'steal_road')),
  status text not null default 'preparing' check (status in ('preparing', 'countdown', 'active', 'finalizing', 'completed', 'cancelled')),
  region_id uuid references public.competition_regions(id) on delete set null,
  duration_minutes integer not null check (duration_minutes between 10 and 30),
  starts_at timestamptz,
  ends_at timestamptz,
  finished_at timestamptz,
  -- Increases by one with every committed change, so clients can order and de-duplicate updates.
  seq bigint not null default 0,
  result jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create unique index battle_matches_one_live_idx on public.battle_matches (room_id) where status in ('preparing', 'countdown', 'active', 'finalizing');

create table public.battle_teams (
  match_id uuid not null references public.battle_matches(id) on delete cascade,
  team text not null check (team in ('blue', 'orange')),
  score double precision not null default 0,
  detail jsonb not null default '{}'::jsonb,
  primary key (match_id, team)
);

-- Teams are copied here when the match starts and never change after.
create table public.battle_team_members (
  match_id uuid not null references public.battle_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team text not null check (team in ('blue', 'orange')),
  display_name text not null,
  primary key (match_id, user_id)
);

create table public.territory_ownership (
  match_id uuid not null references public.battle_matches(id) on delete cascade,
  team text not null check (team in ('blue', 'orange')),
  geom extensions.geometry(MultiPolygon, 4326),
  area_m2 double precision not null default 0,
  primary key (match_id, team)
);
create index territory_ownership_geom_idx on public.territory_ownership using gist (geom);

create table public.territory_claims (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.battle_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team text not null check (team in ('blue', 'orange')),
  request_key text not null,
  -- The same walked loop can never be claimed twice.
  points_hash text not null,
  polygon extensions.geometry(Polygon, 4326) not null,
  claimed_m2 double precision not null,
  captured_m2 double precision not null,
  gained_m2 double precision not null,
  seq bigint not null,
  accepted_at timestamptz not null default timezone('utc', now()),
  unique (match_id, request_key),
  unique (match_id, points_hash)
);
create index territory_claims_geom_idx on public.territory_claims using gist (polygon);

create table public.road_edge_ownership (
  match_id uuid not null references public.battle_matches(id) on delete cascade,
  edge_id uuid not null references public.road_edges(id) on delete cascade,
  team text not null check (team in ('blue', 'orange')),
  captured_by uuid references auth.users(id) on delete set null,
  captured_at timestamptz not null,
  seq bigint not null,
  primary key (match_id, edge_id)
);

create table public.road_capture_attempts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.battle_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  edge_id uuid not null references public.road_edges(id) on delete cascade,
  team text not null check (team in ('blue', 'orange')),
  coverage numeric(5, 4) not null,
  request_key text not null,
  status text not null check (status in ('accepted', 'rejected')),
  reason text,
  points double precision not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (match_id, request_key)
);

create table public.battle_match_events (
  match_id uuid not null references public.battle_matches(id) on delete cascade,
  seq bigint not null,
  kind text not null,
  team text,
  user_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (match_id, seq)
);

alter table public.battle_matches enable row level security;
alter table public.battle_teams enable row level security;
alter table public.battle_team_members enable row level security;
alter table public.territory_ownership enable row level security;
alter table public.territory_claims enable row level security;
alter table public.road_edge_ownership enable row level security;
alter table public.road_capture_attempts enable row level security;
alter table public.battle_match_events enable row level security;

create or replace function public.is_match_member(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from battle_matches m join room_members r on r.room_id = m.room_id
    where m.id = p_match_id and r.user_id = auth.uid() and not r.removed);
$$;

-- Ownership and scores are shared game state for everyone in the match. Claims and attempts (which trace a walk)
-- are visible only to the player who made them. No table here has insert, update or delete policies.
create policy battle_matches_members on public.battle_matches for select to authenticated using (is_match_member(id));
create policy battle_teams_members on public.battle_teams for select to authenticated using (is_match_member(match_id));
create policy battle_team_members_members on public.battle_team_members for select to authenticated using (is_match_member(match_id));
create policy territory_ownership_members on public.territory_ownership for select to authenticated using (is_match_member(match_id));
create policy road_edge_ownership_members on public.road_edge_ownership for select to authenticated using (is_match_member(match_id));
create policy battle_events_members on public.battle_match_events for select to authenticated using (is_match_member(match_id));
create policy territory_claims_own on public.territory_claims for select to authenticated using (user_id = auth.uid());
create policy road_attempts_own on public.road_capture_attempts for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------------------------------------------
-- Lobby: teams and settings (host only, while the room is open)
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.set_member_team(p_room_id uuid, p_user_id uuid, p_team text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from multiplayer_rooms where id = p_room_id and host_id = auth.uid() and status = 'open' and game_type in ('steal_territory', 'steal_road')) then
    raise exception 'not_the_host';
  end if;
  if p_team is not null and p_team not in ('blue', 'orange') then raise exception 'bad_team'; end if;
  update room_members set team = p_team where room_id = p_room_id and user_id = p_user_id and left_at is null;
  if not found then raise exception 'not_in_room'; end if;
end;
$$;

-- Even teams by join order. Matches battle.ts balanceTeams.
create or replace function public.balance_room_teams(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from multiplayer_rooms where id = p_room_id and host_id = auth.uid() and status = 'open' and game_type in ('steal_territory', 'steal_road')) then
    raise exception 'not_the_host';
  end if;
  update room_members m set team = case when o.n % 2 = 1 then 'blue' else 'orange' end
  from (select user_id, row_number() over (order by joined_at, user_id) as n from room_members where room_id = p_room_id and left_at is null) o
  where m.room_id = p_room_id and m.user_id = o.user_id;
end;
$$;

create or replace function public.set_battle_settings(p_room_id uuid, p_minutes integer, p_region_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from multiplayer_rooms where id = p_room_id and host_id = auth.uid() and status = 'open' and game_type in ('steal_territory', 'steal_road')) then
    raise exception 'not_the_host';
  end if;
  if p_region_id is not null and not exists (select 1 from competition_regions where id = p_region_id and status = 'published') then
    raise exception 'region_not_published';
  end if;
  update multiplayer_rooms set battle_minutes = p_minutes, region_id = p_region_id where id = p_room_id;
  perform room_changed(p_room_id, 'settings');
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Match lifecycle
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.battle_can_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'preparing' then p_to in ('countdown', 'cancelled')
    when 'countdown' then p_to in ('active', 'cancelled')
    when 'active' then p_to in ('finalizing', 'cancelled')
    when 'finalizing' then p_to = 'completed'
    else false
  end;
$$;

-- The only way a match changes status. Writes an event and pings the room.
create or replace function public.battle_transition(p_match_id uuid, p_to text, p_result jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match battle_matches;
begin
  select * into v_match from battle_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  if not battle_can_transition(v_match.status, p_to) then raise exception 'bad_transition'; end if;
  update battle_matches set status = p_to, seq = seq + 1,
    finished_at = case when p_to in ('completed', 'cancelled') then timezone('utc', now()) else finished_at end,
    result = coalesce(p_result, result)
  where id = p_match_id;
  insert into battle_match_events (match_id, seq, kind, payload) values (p_match_id, v_match.seq + 1, 'status', jsonb_build_object('status', p_to));
  if p_to in ('completed', 'cancelled') then
    update multiplayer_rooms set status = 'finished' where id = v_match.room_id and status = 'playing';
  end if;
  perform room_changed(v_match.room_id, 'battle');
end;
$$;
revoke execute on function public.battle_transition(uuid, text, jsonb) from public, anon, authenticated;

-- Road score for one team from current ownership: 1 point per 10 m, plus 20% of the largest connected network's
-- points when it has at least 3 roads. Matches battle.ts roadScore.
create or replace function public.road_team_score(p_match_id uuid, p_team text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with recursive owned as (
    select e.id, e.start_node_id as a, e.end_node_id as b, e.length_m
    from road_edge_ownership o join road_edges e on e.id = o.edge_id
    where o.match_id = p_match_id and o.team = p_team
  ),
  reach (root, edge) as (
    select id, id from owned
    union
    select r.root, o2.id from reach r
    join owned o1 on o1.id = r.edge
    join owned o2 on o2.a in (o1.a, o1.b) or o2.b in (o1.a, o1.b)
  ),
  comp as (select edge, min(root::text) as cid from reach group by edge),
  sizes as (select c.cid, sum(o.length_m) as m, count(*) as n from comp c join owned o on o.id = c.edge group by c.cid),
  largest as (select m, n from sizes order by m desc, n desc limit 1),
  totals as (select coalesce(sum(length_m), 0) as m from owned)
  select jsonb_build_object(
    'lengthM', t.m,
    'base', t.m / 10.0,
    'largestM', coalesce(l.m, 0),
    'largestEdges', coalesce(l.n, 0),
    'components', (select count(*) from sizes),
    'bonus', case when coalesce(l.n, 0) >= 3 then l.m / 10.0 * 0.2 else 0 end,
    'total', t.m / 10.0 + case when coalesce(l.n, 0) >= 3 then l.m / 10.0 * 0.2 else 0 end
  )
  from totals t left join largest l on true;
$$;

-- Final scores, winner and contributions, written once when the match completes.
create or replace function public.battle_final_result(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_match battle_matches;
  v_blue double precision;
  v_orange double precision;
  v_tol double precision;
  v_winner text;
begin
  select * into v_match from battle_matches where id = p_match_id;
  select score into v_blue from battle_teams where match_id = p_match_id and team = 'blue';
  select score into v_orange from battle_teams where match_id = p_match_id and team = 'orange';
  v_tol := case when v_match.game_type = 'steal_territory' then greatest(1, greatest(v_blue, v_orange) * 0.001) else 0.05 end;
  v_winner := case when abs(v_blue - v_orange) <= v_tol then 'tie' when v_blue > v_orange then 'blue' else 'orange' end;
  return jsonb_build_object(
    'winner', v_winner,
    'scores', jsonb_build_object('blue', v_blue, 'orange', v_orange),
    'unit', case when v_match.game_type = 'steal_territory' then 'm2' else 'points' end,
    'claims', (select count(*) from territory_claims where match_id = p_match_id) + (select count(*) from road_capture_attempts where match_id = p_match_id and status = 'accepted'),
    'capturedM2', (select coalesce(sum(captured_m2), 0) from territory_claims where match_id = p_match_id),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', m.user_id, 'name', m.display_name, 'team', m.team,
        'claims', (select count(*) from territory_claims c where c.match_id = p_match_id and c.user_id = m.user_id),
        'gainedM2', (select coalesce(sum(gained_m2), 0) from territory_claims c where c.match_id = p_match_id and c.user_id = m.user_id),
        'capturedM2', (select coalesce(sum(captured_m2), 0) from territory_claims c where c.match_id = p_match_id and c.user_id = m.user_id),
        'roads', (select count(*) from road_capture_attempts a where a.match_id = p_match_id and a.user_id = m.user_id and a.status = 'accepted'),
        'roadPoints', (select coalesce(sum(points), 0) from road_capture_attempts a where a.match_id = p_match_id and a.user_id = m.user_id and a.status = 'accepted')
      ) order by m.team, m.display_name)
      from battle_team_members m where m.match_id = p_match_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Host starts a match from the lobby: checks players, teams and region, copies the teams (locked from here on), and
-- sets the server start and end times.
create or replace function public.start_battle(p_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room multiplayer_rooms;
  v_match uuid;
  v_n integer;
begin
  select * into v_room from multiplayer_rooms where id = p_room_id for update;
  if v_room.id is null or v_room.host_id <> auth.uid() then raise exception 'not_the_host'; end if;
  if v_room.status <> 'open' or v_room.game_type not in ('steal_territory', 'steal_road') then raise exception 'room_closed'; end if;
  select count(*) into v_n from room_members where room_id = p_room_id and left_at is null;
  if v_n < 2 then raise exception 'not_enough_players'; end if;
  if v_n > least(10, v_room.max_players) then raise exception 'room_full'; end if;
  if exists (select 1 from room_members where room_id = p_room_id and left_at is null and team is null) then raise exception 'teams_not_set'; end if;
  if (select count(distinct team) from room_members where room_id = p_room_id and left_at is null) < 2 then raise exception 'teams_not_set'; end if;
  if exists (select 1 from room_members where room_id = p_room_id and left_at is null and not ready and user_id <> v_room.host_id) then raise exception 'not_everyone_ready'; end if;
  if v_room.game_type = 'steal_road' and (
    v_room.region_id is null
    or not exists (select 1 from competition_regions where id = v_room.region_id and status = 'published')
    or (select count(*) from road_edges where region_id = v_room.region_id and allowed_for_game) < 3
  ) then raise exception 'region_required'; end if;

  insert into battle_matches (room_id, game_type, status, region_id, duration_minutes)
  values (p_room_id, v_room.game_type, 'preparing', v_room.region_id, v_room.battle_minutes)
  returning id into v_match;
  insert into battle_teams (match_id, team) values (v_match, 'blue'), (v_match, 'orange');
  insert into battle_team_members (match_id, user_id, team, display_name)
  select v_match, user_id, team, display_name from room_members where room_id = p_room_id and left_at is null;
  insert into territory_ownership (match_id, team) values (v_match, 'blue'), (v_match, 'orange');

  update battle_matches set
    starts_at = timezone('utc', now()) + make_interval(secs => greatest(5, v_room.start_delay_s)),
    ends_at = timezone('utc', now()) + make_interval(secs => greatest(5, v_room.start_delay_s)) + make_interval(mins => v_room.battle_minutes)
  where id = v_match;
  update multiplayer_rooms set status = 'playing' where id = p_room_id;
  perform battle_transition(v_match, 'countdown');
  return v_match;
end;
$$;
revoke execute on function public.start_battle(uuid) from anon;

-- Moves a match on by the server clock: countdown to active at the start time, active to finalizing at the end
-- time, then completed with the final result. Any player may call it; repeats do nothing.
create or replace function public.battle_advance(p_match_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match battle_matches;
begin
  if not is_match_member(p_match_id) and auth.role() <> 'service_role' then raise exception 'not_in_match'; end if;
  perform pg_advisory_xact_lock(hashtextextended('battle:' || p_match_id::text, 0));
  select * into v_match from battle_matches where id = p_match_id for update;
  if v_match.status = 'countdown' and now() >= v_match.starts_at then
    perform battle_transition(p_match_id, 'active');
    v_match.status := 'active';
  end if;
  if v_match.status = 'active' and now() >= v_match.ends_at then
    perform battle_transition(p_match_id, 'finalizing');
    v_match.status := 'finalizing';
  end if;
  if v_match.status = 'finalizing' then
    perform battle_transition(p_match_id, 'completed', battle_final_result(p_match_id));
    v_match.status := 'completed';
  end if;
  return v_match.status;
end;
$$;
revoke execute on function public.battle_advance(uuid) from anon;

create or replace function public.cancel_battle(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from battle_matches m join multiplayer_rooms r on r.id = m.room_id where m.id = p_match_id and r.host_id = auth.uid()) then
    raise exception 'not_the_host';
  end if;
  perform battle_transition(p_match_id, 'cancelled');
end;
$$;
revoke execute on function public.cancel_battle(uuid) from anon;

-- ---------------------------------------------------------------------------------------------------------------
-- Commits (service role only, after the edge function has validated the walk)
-- ---------------------------------------------------------------------------------------------------------------

-- Checks shared by both games: the match is live by the server clock and the player is on a team.
create or replace function public.battle_commit_guard(p_match battle_matches, p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_team text;
begin
  if p_match.id is null then raise exception 'match_not_found'; end if;
  if p_match.status in ('completed', 'cancelled', 'finalizing') or now() >= p_match.ends_at then raise exception 'match_over'; end if;
  if p_match.starts_at is null or now() < p_match.starts_at then raise exception 'match_not_started'; end if;
  select team into v_team from battle_team_members where match_id = p_match.id and user_id = p_user_id;
  if v_team is null then raise exception 'not_on_a_team'; end if;
  if exists (select 1 from room_members where room_id = p_match.room_id and user_id = p_user_id and (left_at is not null or removed)) then raise exception 'not_in_room'; end if;
  return v_team;
end;
$$;
revoke execute on function public.battle_commit_guard(battle_matches, uuid) from public, anon, authenticated;

-- Steal Your Territory. The new loop takes any enemy area it covers and joins the team's own; both teams' areas are
-- measured again on the sphere. Overlap with the team's own ground is never counted twice.
create or replace function public.commit_territory_claim(p_match_id uuid, p_user_id uuid, p_ring_geojson text, p_request_key text, p_points_hash text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_match battle_matches;
  v_team text;
  v_enemy text;
  v_poly extensions.geometry;
  v_own extensions.geometry;
  v_their extensions.geometry;
  v_own_before double precision;
  v_their_before double precision;
  v_own_after double precision;
  v_their_after double precision;
  v_claimed double precision;
  v_captured double precision;
  v_seq bigint;
  v_existing territory_claims;
  v_region extensions.geometry;
begin
  perform pg_advisory_xact_lock(hashtextextended('battle:' || p_match_id::text, 0));
  select * into v_existing from territory_claims where match_id = p_match_id and request_key = p_request_key;
  if v_existing.id is not null then
    return jsonb_build_object('claimId', v_existing.id, 'gainedM2', v_existing.gained_m2, 'capturedM2', v_existing.captured_m2, 'seq', v_existing.seq, 'repeated', true);
  end if;
  select * into v_match from battle_matches where id = p_match_id for update;
  if v_match.game_type <> 'steal_territory' then raise exception 'wrong_game'; end if;
  v_team := battle_commit_guard(v_match, p_user_id);
  v_enemy := case when v_team = 'blue' then 'orange' else 'blue' end;
  if exists (select 1 from territory_claims where match_id = p_match_id and points_hash = p_points_hash) then raise exception 'duplicate_loop'; end if;

  v_poly := st_setsrid(st_geomfromgeojson(p_ring_geojson), 4326);
  if geometrytype(v_poly) <> 'POLYGON' or not st_isvalid(v_poly) then raise exception 'invalid_polygon'; end if;
  v_claimed := st_area(v_poly::geography, true);
  if v_claimed < 50 then raise exception 'empty_polygon'; end if;
  if v_match.region_id is not null then
    select boundary into v_region from competition_regions where id = v_match.region_id;
    if v_region is not null and not st_within(v_poly, v_region) then raise exception 'outside_region'; end if;
  end if;

  select geom, area_m2 into v_own, v_own_before from territory_ownership where match_id = p_match_id and team = v_team for update;
  select geom, area_m2 into v_their, v_their_before from territory_ownership where match_id = p_match_id and team = v_enemy for update;

  v_captured := case when v_their is null then 0 else coalesce(st_area(st_intersection(v_their, v_poly)::geography, true), 0) end;
  if v_their is not null then
    v_their := st_multi(st_collectionextract(st_makevalid(st_difference(v_their, v_poly)), 3));
    if st_isempty(v_their) then v_their := null; end if;
  end if;
  v_own := st_multi(st_collectionextract(st_makevalid(case when v_own is null then v_poly else st_union(v_own, v_poly) end), 3));
  v_own_after := coalesce(st_area(v_own::geography, true), 0);
  v_their_after := case when v_their is null then 0 else coalesce(st_area(v_their::geography, true), 0) end;

  update battle_matches set seq = seq + 1 where id = p_match_id returning seq into v_seq;
  update territory_ownership set geom = v_own, area_m2 = v_own_after where match_id = p_match_id and team = v_team;
  update territory_ownership set geom = v_their, area_m2 = v_their_after where match_id = p_match_id and team = v_enemy;
  update battle_teams set score = v_own_after where match_id = p_match_id and team = v_team;
  update battle_teams set score = v_their_after where match_id = p_match_id and team = v_enemy;
  insert into territory_claims (match_id, user_id, team, request_key, points_hash, polygon, claimed_m2, captured_m2, gained_m2, seq)
  values (p_match_id, p_user_id, v_team, p_request_key, p_points_hash, v_poly, v_claimed, v_captured, v_own_after - v_own_before, v_seq)
  returning * into v_existing;
  insert into battle_match_events (match_id, seq, kind, team, user_id, payload)
  values (p_match_id, v_seq, 'territory', v_team, p_user_id, jsonb_build_object(
    'gainedM2', v_own_after - v_own_before, 'capturedM2', v_captured, 'claimedM2', v_claimed,
    'scores', jsonb_build_object(v_team, v_own_after, v_enemy, v_their_after)));
  perform room_changed(v_match.room_id, 'battle');
  return jsonb_build_object('claimId', v_existing.id, 'gainedM2', v_own_after - v_own_before, 'capturedM2', v_captured, 'seq', v_seq, 'repeated', false);
end;
$$;
revoke execute on function public.commit_territory_claim(uuid, uuid, text, text, text) from public, anon, authenticated;

-- Steal Your Road. One road per call, after the edge function has matched the walk to it. Recapture waits out the
-- cooldown; a road your team already holds earns nothing again.
create or replace function public.commit_road_capture(p_match_id uuid, p_user_id uuid, p_edge_id uuid, p_coverage numeric, p_request_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match battle_matches;
  v_team text;
  v_owner road_edge_ownership;
  v_attempt road_capture_attempts;
  v_seq bigint;
  v_before jsonb;
  v_after jsonb;
  v_enemy_after jsonb;
  v_reason text;
  v_cooldown integer := 120;
begin
  perform pg_advisory_xact_lock(hashtextextended('battle:' || p_match_id::text, 0));
  select * into v_attempt from road_capture_attempts where match_id = p_match_id and request_key = p_request_key;
  if v_attempt.id is not null then
    return jsonb_build_object('status', v_attempt.status, 'reason', v_attempt.reason, 'points', v_attempt.points, 'repeated', true);
  end if;
  select * into v_match from battle_matches where id = p_match_id for update;
  if v_match.game_type <> 'steal_road' then raise exception 'wrong_game'; end if;
  v_team := battle_commit_guard(v_match, p_user_id);
  if not exists (select 1 from road_edges where id = p_edge_id and region_id = v_match.region_id and allowed_for_game) then raise exception 'road_not_in_game'; end if;

  select * into v_owner from road_edge_ownership where match_id = p_match_id and edge_id = p_edge_id for update;
  if p_coverage < 0.7 then v_reason := 'not_enough';
  elsif v_owner.edge_id is not null and v_owner.team = v_team then v_reason := 'already_yours';
  elsif v_owner.edge_id is not null and v_owner.captured_at > now() - make_interval(secs => v_cooldown) then v_reason := 'cooldown';
  end if;
  if v_reason is not null then
    insert into road_capture_attempts (match_id, user_id, edge_id, team, coverage, request_key, status, reason)
    values (p_match_id, p_user_id, p_edge_id, v_team, p_coverage, p_request_key, 'rejected', v_reason);
    return jsonb_build_object('status', 'rejected', 'reason', v_reason, 'points', 0, 'repeated', false);
  end if;

  v_before := road_team_score(p_match_id, v_team);
  update battle_matches set seq = seq + 1 where id = p_match_id returning seq into v_seq;
  insert into road_edge_ownership (match_id, edge_id, team, captured_by, captured_at, seq)
  values (p_match_id, p_edge_id, v_team, p_user_id, timezone('utc', now()), v_seq)
  on conflict (match_id, edge_id) do update set team = excluded.team, captured_by = excluded.captured_by, captured_at = excluded.captured_at, seq = excluded.seq;
  v_after := road_team_score(p_match_id, v_team);
  v_enemy_after := road_team_score(p_match_id, case when v_team = 'blue' then 'orange' else 'blue' end);
  update battle_teams set score = (v_after ->> 'total')::float8, detail = v_after where match_id = p_match_id and team = v_team;
  update battle_teams set score = (v_enemy_after ->> 'total')::float8, detail = v_enemy_after where match_id = p_match_id and team <> v_team;
  insert into road_capture_attempts (match_id, user_id, edge_id, team, coverage, request_key, status, points)
  values (p_match_id, p_user_id, p_edge_id, v_team, p_coverage, p_request_key, 'accepted', (v_after ->> 'total')::float8 - (v_before ->> 'total')::float8);
  insert into battle_match_events (match_id, seq, kind, team, user_id, payload)
  values (p_match_id, v_seq, 'road', v_team, p_user_id, jsonb_build_object(
    'edgeId', p_edge_id, 'stolenFrom', v_owner.team, 'points', (v_after ->> 'total')::float8 - (v_before ->> 'total')::float8));
  perform room_changed(v_match.room_id, 'battle');
  return jsonb_build_object('status', 'accepted', 'points', (v_after ->> 'total')::float8 - (v_before ->> 'total')::float8, 'seq', v_seq, 'repeated', false);
end;
$$;
revoke execute on function public.commit_road_capture(uuid, uuid, uuid, numeric, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- What players see
-- ---------------------------------------------------------------------------------------------------------------

-- The whole match as a player may see it: status and times, teams and scores, territory per team (lightly simplified
-- for drawing), road ownership, and recent events. Never another player's position or route.
create or replace function public.battle_state(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_match battle_matches;
begin
  if not is_match_member(p_match_id) then raise exception 'not_in_match'; end if;
  select * into v_match from battle_matches where id = p_match_id;
  return jsonb_build_object(
    'serverNow', timezone('utc', now()),
    'match', jsonb_build_object('id', v_match.id, 'roomId', v_match.room_id, 'gameType', v_match.game_type, 'status', v_match.status,
      'regionId', v_match.region_id, 'durationMinutes', v_match.duration_minutes, 'startsAt', v_match.starts_at, 'endsAt', v_match.ends_at,
      'seq', v_match.seq, 'result', v_match.result),
    'myTeam', (select team from battle_team_members where match_id = p_match_id and user_id = auth.uid()),
    'teams', (select jsonb_object_agg(team, jsonb_build_object('score', score, 'detail', detail)) from battle_teams where match_id = p_match_id),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('userId', user_id, 'name', display_name, 'team', team) order by team, display_name), '[]'::jsonb) from battle_team_members where match_id = p_match_id),
    'territory', (select coalesce(jsonb_object_agg(team, jsonb_build_object('areaM2', area_m2,
      'geojson', case when geom is null then null else st_asgeojson(st_simplifypreservetopology(geom, 0.000005), 6)::jsonb end)), '{}'::jsonb)
      from territory_ownership where match_id = p_match_id),
    'roads', (select coalesce(jsonb_agg(jsonb_build_object('edgeId', edge_id, 'team', team, 'capturedAt', captured_at, 'seq', seq)), '[]'::jsonb) from road_edge_ownership where match_id = p_match_id),
    'events', (select coalesce(jsonb_agg(e order by e.seq desc), '[]'::jsonb) from (
      select seq, kind, team, user_id as "userId", payload, created_at as "at" from battle_match_events where match_id = p_match_id order by seq desc limit 20) e),
    'myClaims', (select count(*) from territory_claims where match_id = p_match_id and user_id = auth.uid())
  );
end;
$$;
revoke execute on function public.battle_state(uuid) from anon;

-- Published regions players can pick for a road match.
create or replace function public.published_regions()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'latitude', r.center_lat, 'longitude', r.center_lng,
    'roads', (select count(*) from road_edges e where e.region_id = r.id and e.allowed_for_game),
    'attribution', r.attribution) order by r.name), '[]'::jsonb)
  from competition_regions r where r.status = 'published';
$$;

revoke execute on function public.create_competition_region(text, double precision, double precision, text, text, text) from anon;
revoke execute on function public.import_road_graph(uuid, jsonb, jsonb) from anon;
revoke execute on function public.set_road_edge_status(uuid, text, text) from anon;
revoke execute on function public.publish_competition_region(uuid) from anon;
revoke execute on function public.set_member_team(uuid, uuid, text) from anon;
revoke execute on function public.balance_room_teams(uuid) from anon;
revoke execute on function public.set_battle_settings(uuid, integer, uuid) from anon;
