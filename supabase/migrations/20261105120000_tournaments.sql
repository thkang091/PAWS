-- PAWS Tournament, phase 1: shared tables for every tournament game, plus GPS sessions and territories for
-- "Make the Largest Country".
--
-- Who writes what:
--   tournaments            organizers, through create_tournament()
--   tournament_participants the player, through join_tournament()
--   gps_sessions, gps_points, territory_submissions
--                           only the `tournament` edge function (service role). The app never writes them directly,
--                           so nobody can set their own distance, area or result.
-- Raw GPS stays private to its owner. Boards are served by the edge function as summaries with no coordinates.

create extension if not exists postgis with schema extensions;

create type public.tournament_game as enum (
  'largest_country', 'follow_shape', 'photo_pose', 'match_my_dog', 'dog_reels',
  'find_mafia', 'steal_territory', 'steal_road'
);
create type public.tournament_mode as enum ('online', 'nearby');

-- People allowed to schedule tournaments. Added by an admin in the SQL editor; no app path writes here.
create table public.tournament_organizers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default timezone('utc', now())
);
alter table public.tournament_organizers enable row level security;

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  game_type public.tournament_game not null,
  mode public.tournament_mode not null,
  name text not null check (char_length(name) between 3 and 80),
  description text not null default '' check (char_length(description) <= 400),
  -- scheduled or cancelled. Upcoming, registration, active and completed follow from the dates and the server clock.
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  registration_opens_at timestamptz not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  check (registration_opens_at <= starts_at),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '62 days')
);
create index tournaments_game_time_idx on public.tournaments (game_type, ends_at desc);

create table public.tournament_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  team_id uuid,
  joined_at timestamptz not null default timezone('utc', now()),
  status text not null default 'joined' check (status in ('joined', 'withdrawn')),
  unique (tournament_id, user_id)
);
create index tournament_participants_user_idx on public.tournament_participants (user_id);

create table public.gps_sessions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active', 'paused', 'submitted', 'cancelled', 'expired')),
  total_distance_m double precision,
  elapsed_seconds integer,
  validation_status text not null default 'pending' check (validation_status in ('pending', 'valid', 'flagged', 'invalid')),
  last_seq integer not null default 0,
  last_submit_attempt_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);
-- One walk in progress per person.
create unique index gps_sessions_one_open_idx on public.gps_sessions (user_id) where status in ('active', 'paused');
create index gps_sessions_tournament_idx on public.gps_sessions (tournament_id, user_id);

create table public.gps_points (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.gps_sessions(id) on delete cascade,
  sequence_number integer not null check (sequence_number > 0),
  -- Goes up by one after every resume, so paused stretches are never joined into the route.
  segment integer not null default 0 check (segment >= 0),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_m real check (accuracy_m is null or accuracy_m >= 0),
  captured_at timestamptz not null,
  received_at timestamptz not null default timezone('utc', now()),
  -- A batch sent twice stores each point once.
  unique (session_id, sequence_number)
);
create index gps_points_received_idx on public.gps_points (session_id, received_at);

create table public.territory_submissions (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  session_id uuid not null unique references public.gps_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  polygon extensions.geography(Polygon, 4326) not null,
  -- Official area, computed by PostGIS on the sphere when the row is written.
  area_m2 double precision not null check (area_m2 > 0),
  -- What the server's own outline check measured, kept to spot disagreements.
  check_area_m2 double precision not null,
  distance_m double precision not null,
  elapsed_seconds integer not null,
  validation_status text not null check (validation_status in ('valid', 'flagged')),
  submitted_at timestamptz not null default timezone('utc', now())
);
create index territory_submissions_board_idx on public.territory_submissions (tournament_id, area_m2 desc, submitted_at asc);
create index territory_submissions_user_idx on public.territory_submissions (user_id, tournament_id);

alter table public.tournaments enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.gps_sessions enable row level security;
alter table public.gps_points enable row level security;
alter table public.territory_submissions enable row level security;

-- Tournament listings are public to signed-in players. Nobody writes them except create_tournament().
create policy tournaments_read on public.tournaments for select to authenticated using (true);

-- Everything else: you read your own rows, and no one writes directly.
create policy tournament_participants_read_own on public.tournament_participants
  for select to authenticated using (user_id = auth.uid());
create policy gps_sessions_read_own on public.gps_sessions
  for select to authenticated using (user_id = auth.uid());
create policy gps_points_read_own on public.gps_points
  for select to authenticated using (exists (select 1 from public.gps_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy territory_submissions_read_own on public.territory_submissions
  for select to authenticated using (user_id = auth.uid());

-- Upcoming, registration, active, completed or cancelled, on the server clock.
create or replace function public.tournament_phase(t public.tournaments)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when t.status = 'cancelled' then 'cancelled'
    when now() < t.registration_opens_at then 'upcoming'
    when now() < t.starts_at then 'registration'
    when now() < t.ends_at then 'active'
    else 'completed'
  end;
$$;

create or replace function public.is_tournament_organizer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from tournament_organizers where user_id = auth.uid());
$$;

-- Join with your dog while registration is open or the tournament is running. Joining twice keeps one row.
create or replace function public.join_tournament(p_tournament_id uuid, p_dog_id uuid)
returns public.tournament_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t tournaments;
  v_row tournament_participants;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_dog_id is not null and not owns_dog(p_dog_id) then raise exception 'not_your_dog'; end if;
  select * into v_t from tournaments where id = p_tournament_id;
  if v_t.id is null then raise exception 'tournament_not_found'; end if;
  if tournament_phase(v_t) not in ('registration', 'active') then raise exception 'registration_closed'; end if;

  insert into tournament_participants (tournament_id, user_id, dog_id)
  values (p_tournament_id, auth.uid(), p_dog_id)
  on conflict (tournament_id, user_id) do update set status = 'joined', dog_id = coalesce(excluded.dog_id, tournament_participants.dog_id)
  returning * into v_row;
  return v_row;
end;
$$;

-- Organizers schedule a tournament period. Dates are checked here and by the table.
create or replace function public.create_tournament(
  p_game public.tournament_game,
  p_mode public.tournament_mode,
  p_name text,
  p_description text,
  p_registration_opens_at timestamptz,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns public.tournaments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row tournaments;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  if p_ends_at <= now() then raise exception 'ends_in_the_past'; end if;
  insert into tournaments (game_type, mode, name, description, registration_opens_at, starts_at, ends_at, created_by)
  values (p_game, p_mode, p_name, coalesce(p_description, ''), p_registration_opens_at, p_starts_at, p_ends_at, auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.cancel_tournament(p_tournament_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  update tournaments set status = 'cancelled' where id = p_tournament_id;
end;
$$;

-- Called only by the edge function after its own check passes. PostGIS validates the outline again and measures
-- the official area on the sphere; a large disagreement with the function's check is kept but flagged.
create or replace function public.record_territory(
  p_session_id uuid,
  p_ring_geojson text,
  p_check_area_m2 double precision,
  p_distance_m double precision,
  p_elapsed_seconds integer
)
returns public.territory_submissions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_session gps_sessions;
  v_existing territory_submissions;
  v_geom extensions.geometry;
  v_area double precision;
  v_row territory_submissions;
begin
  select * into v_existing from territory_submissions where session_id = p_session_id;
  if v_existing.id is not null then return v_existing; end if;

  select * into v_session from gps_sessions where id = p_session_id for update;
  if v_session.id is null then raise exception 'session_not_found'; end if;
  if v_session.status not in ('active', 'paused') then raise exception 'session_closed'; end if;

  v_geom := extensions.st_setsrid(extensions.st_geomfromgeojson(p_ring_geojson), 4326);
  if extensions.geometrytype(v_geom) <> 'POLYGON' then raise exception 'not_a_polygon'; end if;
  if not extensions.st_isvalid(v_geom) then raise exception 'invalid_polygon'; end if;
  v_area := extensions.st_area(v_geom::extensions.geography, true);
  if v_area <= 0 then raise exception 'empty_polygon'; end if;

  insert into territory_submissions (tournament_id, session_id, user_id, dog_id, polygon, area_m2, check_area_m2, distance_m, elapsed_seconds, validation_status)
  values (
    v_session.tournament_id, v_session.id, v_session.user_id, v_session.dog_id, v_geom::extensions.geography, v_area,
    p_check_area_m2, p_distance_m, p_elapsed_seconds,
    case when abs(v_area - p_check_area_m2) > greatest(50, v_area * 0.03) then 'flagged' else 'valid' end
  )
  returning * into v_row;

  update gps_sessions set
    status = 'submitted',
    ended_at = timezone('utc', now()),
    total_distance_m = p_distance_m,
    elapsed_seconds = p_elapsed_seconds,
    validation_status = v_row.validation_status
  where id = v_session.id;
  return v_row;
end;
$$;

revoke execute on function public.record_territory(uuid, text, double precision, double precision, integer) from public, anon, authenticated;

-- Your own territory, with its outline as GeoJSON, for the result screen. Nobody else's outline is ever returned.
create or replace function public.territory_detail(p_submission_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'id', s.id,
    'tournamentId', s.tournament_id,
    'areaM2', s.area_m2,
    'distanceM', s.distance_m,
    'elapsedSeconds', s.elapsed_seconds,
    'validationStatus', s.validation_status,
    'submittedAt', s.submitted_at,
    'outline', extensions.st_asgeojson(s.polygon::extensions.geometry)::jsonb,
    'personalBest', not exists (
      select 1 from territory_submissions o
      join tournaments ot on ot.id = o.tournament_id
      where o.user_id = s.user_id and o.id <> s.id and o.validation_status = 'valid'
        and ot.game_type = 'largest_country' and o.area_m2 > s.area_m2
    )
  )
  from territory_submissions s
  where s.id = p_submission_id and s.user_id = auth.uid();
$$;

revoke execute on function public.territory_detail(uuid) from anon;

-- Retention: raw GPS points are deleted 30 days after a tournament ends, and right away for cancelled or expired
-- walks older than a day. Territories (the scored outline) stay with the result and go when the account is deleted.
-- Schedule daily with pg_cron where available:
--   select cron.schedule('purge-tournament-gps', '15 3 * * *', $$select public.purge_tournament_gps(30)$$);
create or replace function public.purge_tournament_gps(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with gone as (
    delete from gps_points p
    using gps_sessions s, tournaments t
    where p.session_id = s.id and s.tournament_id = t.id
      and (
        t.ends_at < now() - make_interval(days => greatest(p_days, 1))
        or (s.status in ('cancelled', 'expired') and s.started_at < now() - interval '1 day')
      )
    returning 1
  )
  select count(*) into v_count from gone;
  return v_count;
end;
$$;

revoke execute on function public.purge_tournament_gps(integer) from public, anon, authenticated;
revoke execute on function public.create_tournament(public.tournament_game, public.tournament_mode, text, text, timestamptz, timestamptz, timestamptz) from anon;
revoke execute on function public.cancel_tournament(uuid) from anon;
revoke execute on function public.join_tournament(uuid, uuid) from anon;
