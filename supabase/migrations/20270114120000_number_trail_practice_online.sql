-- PAWS Number Trail, phases P1 to P3: any number from 1 to 99, private practice, and cross-city races with
-- server-verified equal distances. Forward only; builds on 20270107120000_number_trail.sql.
--
--   * Official course length is measured here, by PostGIS on the stored street geometry (geography length), never
--     taken from a phone: number_course_official(). Candidates whose engine length disagrees are not stored.
--   * Practice: a candidate the server found becomes a private practice session with its own GPS walk. Practice never
--     touches matches, results or standings.
--   * Online: each player searches their own streets for the same number at the same target length. The matcher
--     (edge function) proposes one course per player; number_record_online_match() checks the distances again from
--     the PostGIS lengths and refuses a ranked set outside the tolerance. Players check in at their own start (the
--     position is checked, never stored), then one server countdown starts everyone.
--   * Nobody sees another player's course or position: only the number, the target and official lengths.

-- ---------------------------------------------------------------------------------------------------------------
-- Numbers 1 to 9, new phases, online statuses and events
-- ---------------------------------------------------------------------------------------------------------------

alter table public.number_trail_matches drop constraint if exists number_trail_matches_target_number_check;
alter table public.number_trail_matches add constraint number_trail_matches_target_number_check check (target_number ~ '^[0-9]{1,2}$');
alter table public.number_trail_courses drop constraint if exists number_trail_courses_target_number_check;
alter table public.number_trail_courses add constraint number_trail_courses_target_number_check check (target_number ~ '^[0-9]{1,2}$');
alter table public.number_trail_assignments drop constraint if exists number_trail_assignments_target_number_check;
alter table public.number_trail_assignments add constraint number_trail_assignments_target_number_check check (target_number ~ '^[0-9]{1,2}$');

alter table public.number_trail_progress drop constraint if exists number_trail_progress_phase_check;
alter table public.number_trail_progress add constraint number_trail_progress_phase_check check (phase in (
  'DIGIT_1_PENDING', 'DIGIT_1_IN_PROGRESS', 'DIGIT_1_COMPLETE', 'CONNECTOR_IN_PROGRESS', 'DIGIT_2_IN_PROGRESS',
  'DIGIT_2_COMPLETE', 'NUMBER_COMPLETE', 'FINISH_IN_PROGRESS', 'FINISH_PENDING_VERIFICATION', 'VERIFIED_COMPLETE', 'INVALID_COMPLETION'));

alter table public.number_trail_matches drop constraint if exists number_trail_matches_status_check;
alter table public.number_trail_matches add constraint number_trail_matches_status_check check (status in (
  'waiting', 'course_search', 'course_matching', 'preparing_routes', 'ready', 'countdown', 'active', 'verifying', 'completed', 'cancelled'));

alter table public.number_trail_matches drop constraint if exists number_trail_matches_mode_check;
alter table public.number_trail_matches add constraint number_trail_matches_mode_check check (mode in ('nearby', 'online'));
alter table public.number_trail_matches add column if not exists ranked boolean not null default true;
-- What the host chose (canonical 1 to 99). Online only; the race keeps it whatever the streets allow.
alter table public.number_trail_matches add column if not exists requested_number text check (requested_number ~ '^([0-9]|[1-9][0-9])$');
alter table public.number_trail_matches add column if not exists distance_category text check (distance_category in ('short', 'standard', 'long'));
alter table public.number_trail_matches add column if not exists target_distance_m double precision check (target_distance_m > 0);
alter table public.number_trail_matches add column if not exists tolerance_share double precision not null default 0.02 check (tolerance_share > 0 and tolerance_share <= 0.1);
alter table public.number_trail_matches add column if not exists band_share double precision not null default 0.02 check (band_share > 0 and band_share <= 0.1);
alter table public.number_trail_matches add constraint number_trail_matches_online_check check (
  -- An online race may wait for its number: players find what they can walk first, then the host picks from that.
  mode = 'nearby' or (distance_category is not null and target_distance_m is not null and (requested_number is null or target_number = requested_number)));

alter table public.number_trail_events drop constraint if exists number_trail_events_kind_check;
alter table public.number_trail_events add constraint number_trail_events_kind_check check (kind in (
  'PLAYER_JOINED', 'PLAYER_LEFT', 'PLAYER_READY', 'SETTINGS_CHANGED', 'ROUTE_PREPARING', 'ROUTE_READY', 'ROUTE_FAILED',
  'COURSE_SEARCH_STARTED', 'PLAYER_COURSE_FOUND', 'PLAYER_COURSE_FAILED', 'COURSES_MATCHED', 'COURSES_UNMATCHED', 'PLAYER_AT_START',
  'COUNTDOWN_STARTED', 'MATCH_STARTED', 'DIGIT_1_COMPLETED', 'DIGIT_2_COMPLETED', 'FINISH_VERIFYING', 'FINISH_REJECTED',
  'PLAYER_FINISHED', 'MATCH_COMPLETED', 'RESULTS_FINAL', 'MATCH_CANCELLED'));

-- Same table as TRANSITIONS in supabase/functions/tournament/numberMatch.ts.
create or replace function public.number_can_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'waiting' then p_to in ('preparing_routes', 'course_search', 'cancelled')
    when 'course_search' then p_to in ('course_matching', 'waiting', 'cancelled')
    when 'course_matching' then p_to in ('ready', 'course_search', 'cancelled')
    when 'preparing_routes' then p_to in ('ready', 'waiting', 'cancelled')
    when 'ready' then p_to in ('preparing_routes', 'course_search', 'waiting', 'countdown', 'cancelled')
    when 'countdown' then p_to in ('active', 'cancelled')
    when 'active' then p_to in ('verifying', 'completed', 'cancelled')
    when 'verifying' then p_to in ('active', 'completed', 'cancelled')
    else false
  end;
$$;

-- Courses (shared or per player) may change only before the countdown.
create or replace function public.trg_number_course_guard()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from number_trail_matches where id = coalesce(old.match_id, new.match_id);
  if v_status is null then return coalesce(new, old); end if;
  if v_status not in ('waiting', 'course_search', 'course_matching', 'preparing_routes', 'ready') then raise exception 'assignment_locked'; end if;
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Official course length (PostGIS)
-- ---------------------------------------------------------------------------------------------------------------

-- The required traversal of a stored course, in metres, from its own street geometry: every stroke edge once, the
-- edges walked a second time again, the connector and the finish stretch (exact-length courses). Geography length on
-- WGS 84, the same method everywhere.
create or replace function public.number_course_official(p_course jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  v_digit jsonb;
  v_edge jsonb;
  v_lengths jsonb := '{}'::jsonb;
  v_digits double precision[] := '{}';
  v_repeated double precision := 0;
  v_connector double precision := 0;
  v_finish double precision := 0;
  v_m double precision;
  v_d double precision;
  v_id text;
begin
  -- Each edge's length, once.
  for v_digit in select * from jsonb_array_elements(coalesce(p_course -> 'digits', '[]'::jsonb)) loop
    v_d := 0;
    for v_edge in select * from jsonb_array_elements(coalesce(v_digit -> 'edges', '[]'::jsonb)) loop
      v_m := st_length(st_setsrid(st_geomfromgeojson(jsonb_build_object('type', 'LineString', 'coordinates', v_edge -> 'coords')::text), 4326)::geography);
      v_lengths := v_lengths || jsonb_build_object(v_edge ->> 'edgeId', v_m);
      v_d := v_d + v_m;
    end loop;
    for v_id in select * from jsonb_array_elements_text(coalesce(v_digit -> 'repeatEdgeIds', '[]'::jsonb)) loop
      v_m := (v_lengths ->> v_id)::double precision;
      if v_m is null then raise exception 'bad_course'; end if;
      v_d := v_d + v_m;
      v_repeated := v_repeated + v_m;
    end loop;
    v_digits := v_digits || v_d;
  end loop;
  for v_edge in select * from jsonb_array_elements(coalesce(p_course -> 'connector', '[]'::jsonb)) loop
    v_connector := v_connector + st_length(st_setsrid(st_geomfromgeojson(jsonb_build_object('type', 'LineString', 'coordinates', v_edge -> 'coords')::text), 4326)::geography);
  end loop;
  for v_edge in select * from jsonb_array_elements(coalesce(p_course -> 'finish', '[]'::jsonb)) loop
    v_finish := v_finish + st_length(st_setsrid(st_geomfromgeojson(jsonb_build_object('type', 'LineString', 'coordinates', v_edge -> 'coords')::text), 4326)::geography);
  end loop;
  return jsonb_build_object(
    'totalM', coalesce((select sum(x) from unnest(v_digits) x), 0) + v_connector + v_finish,
    'digitM', to_jsonb(v_digits), 'connectorM', v_connector, 'finishM', v_finish, 'repeatedM', v_repeated,
    'method', 'postgis-geography-length-v1');
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Candidates found by the server, practice sessions, online preparation and matching
-- ---------------------------------------------------------------------------------------------------------------

-- Courses the server found for one player and one number. Kept a day. The player chooses among them by id; the
-- phone never sends geometry.
create table public.number_course_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('practice', 'online')),
  match_id uuid references public.number_trail_matches(id) on delete cascade,
  number text not null check (number ~ '^([0-9]|[1-9][0-9])$'),
  course jsonb not null check (course ->> 'number' = number),
  -- The route's stable identity (number plus the streets its digits are drawn on), from numberDiscovery.routeIdOf.
  route_key text,
  official_total_m double precision not null check (official_total_m > 0),
  digit_m double precision[] not null,
  connector_m double precision not null default 0,
  finish_m double precision not null default 0,
  repeated_m double precision not null default 0,
  official_method text not null,
  engine_race_m double precision not null,
  approach_m double precision not null,
  rank integer not null,
  search_radius_m integer not null,
  source text not null check (source in ('paws', 'osm')),
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '1 day',
  check ((purpose = 'online') = (match_id is not null))
);
create index number_course_candidates_owner_idx on public.number_course_candidates (user_id, created_at desc);
create index number_course_candidates_match_idx on public.number_course_candidates (match_id, user_id) where match_id is not null;

create table public.number_practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid references public.number_course_candidates(id) on delete set null,
  number text not null check (number ~ '^([1-9]|[1-9][0-9])$'),
  course jsonb not null,
  official_total_m double precision not null,
  status text not null default 'walking' check (status in ('walking', 'finished', 'abandoned')),
  started_at timestamptz not null default clock_timestamp(),
  finished_at timestamptz,
  verified boolean,
  result jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index number_practice_sessions_user_idx on public.number_practice_sessions (user_id, created_at desc);
create unique index number_practice_one_walking_idx on public.number_practice_sessions (user_id) where status = 'walking';

-- A walk belongs to exactly one of: a tournament, a Number Trail match, a practice session.
alter table public.gps_sessions add column if not exists number_practice_id uuid references public.number_practice_sessions(id) on delete cascade;
alter table public.gps_sessions drop constraint if exists gps_sessions_owner_check;
alter table public.gps_sessions add constraint gps_sessions_owner_check check (num_nonnulls(tournament_id, number_match_id, number_practice_id) = 1);
create unique index gps_sessions_one_per_practice_idx on public.gps_sessions (number_practice_id) where number_practice_id is not null;

-- How each online player's search went. No location.
create table public.number_online_preparation (
  match_id uuid not null references public.number_trail_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('searching', 'found', 'none', 'error')),
  reason text,
  candidates integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (match_id, user_id)
);

-- Each online player's own course for the race, copied from a verified candidate. Frozen from the countdown on.
create table public.number_trail_player_courses (
  match_id uuid not null references public.number_trail_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid references public.number_course_candidates(id) on delete set null,
  course jsonb not null,
  official_total_m double precision not null,
  digit_m double precision[] not null,
  connector_m double precision not null,
  finish_m double precision not null default 0,
  repeated_m double precision not null,
  start_point extensions.geography(Point, 4326) not null,
  checked_in_at timestamptz,
  primary key (match_id, user_id)
);
create trigger number_trail_player_courses_guard before update of course, official_total_m, digit_m, connector_m, finish_m, repeated_m, start_point or delete
  on public.number_trail_player_courses for each row execute function public.trg_number_course_guard();

-- The fairness verdict for an online race: what was compared and how far apart it was.
create table public.number_course_equivalence (
  match_id uuid primary key references public.number_trail_matches(id) on delete cascade,
  status text not null check (status in ('matched', 'number_mismatch', 'distance_mismatch', 'structure_mismatch', 'readability_mismatch', 'missing_player', 'no_common_window', 'unranked')),
  target_m double precision not null,
  spread_m double precision,
  tolerance_m double precision not null,
  checks jsonb not null default '[]'::jsonb,
  unknown text[] not null default '{}',
  version text not null,
  created_at timestamptz not null default timezone('utc', now())
);
create trigger number_course_equivalence_guard before update or delete on public.number_course_equivalence for each row execute function public.trg_number_course_guard();

alter table public.number_course_candidates enable row level security;
alter table public.number_practice_sessions enable row level security;
alter table public.number_online_preparation enable row level security;
alter table public.number_trail_player_courses enable row level security;
alter table public.number_course_equivalence enable row level security;

create policy number_candidates_own on public.number_course_candidates for select to authenticated using (user_id = auth.uid());
create policy number_practice_own on public.number_practice_sessions for select to authenticated using (user_id = auth.uid());
create policy number_preparation_members on public.number_online_preparation for select to authenticated using (is_number_member(match_id));
create policy number_player_course_own on public.number_trail_player_courses for select to authenticated using (user_id = auth.uid());
create policy number_equivalence_members on public.number_course_equivalence for select to authenticated using (is_number_member(match_id));

-- ---------------------------------------------------------------------------------------------------------------
-- Storing candidates (service role)
-- ---------------------------------------------------------------------------------------------------------------

-- Stores the courses a search found, after measuring each one with PostGIS. A course whose official length doesn't
-- agree with the engine (more than 1%, or 3 m) is not stored. Online: only for a member, while the race is searching.
create or replace function public.number_store_candidates(
  p_user_id uuid,
  p_purpose text,
  p_match_id uuid,
  p_number text,
  p_candidates jsonb,
  p_radius_m integer,
  p_source text,
  p_sources jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_c jsonb;
  v_o jsonb;
  v_total double precision;
  v_engine double precision;
  v_out jsonb := '[]'::jsonb;
  v_rank integer := 0;
  v_skipped integer := 0;
  v_id uuid;
  v_match number_trail_matches;
  v_i integer := -1;
begin
  if p_number !~ '^([0-9]|[1-9][0-9])$' then raise exception 'bad_number'; end if;
  if p_purpose = 'online' then
    select * into v_match from number_trail_matches where id = p_match_id for update;
    if v_match.id is null then raise exception 'match_not_found'; end if;
    if v_match.mode <> 'online' then raise exception 'wrong_game'; end if;
    if v_match.status <> 'course_search' then raise exception 'match_not_editable'; end if;
    if p_number <> v_match.target_number then raise exception 'bad_number'; end if;
    if not exists (select 1 from room_members where room_id = v_match.room_id and user_id = p_user_id and left_at is null and not removed) then raise exception 'not_in_room'; end if;
    delete from number_course_candidates where match_id = p_match_id and user_id = p_user_id;
  elsif p_purpose <> 'practice' then
    raise exception 'bad_request';
  end if;
  for v_c in select * from jsonb_array_elements(coalesce(p_candidates, '[]'::jsonb)) loop
    v_i := v_i + 1;
    if v_c -> 'course' ->> 'number' is distinct from p_number then raise exception 'bad_number'; end if;
    v_o := number_course_official(v_c -> 'course');
    v_total := (v_o ->> 'totalM')::double precision;
    v_engine := (v_c ->> 'raceM')::double precision;
    if abs(v_total - v_engine) > greatest(3, 0.01 * v_engine) then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    v_rank := v_rank + 1;
    insert into number_course_candidates (user_id, purpose, match_id, number, course, route_key, official_total_m, digit_m, connector_m, finish_m, repeated_m, official_method,
      engine_race_m, approach_m, rank, search_radius_m, source, sources)
    values (p_user_id, p_purpose, case when p_purpose = 'online' then p_match_id end, p_number, v_c -> 'course', v_c ->> 'routeKey', v_total,
      array(select jsonb_array_elements_text(v_o -> 'digitM')::double precision), (v_o ->> 'connectorM')::double precision,
      (v_o ->> 'finishM')::double precision, (v_o ->> 'repeatedM')::double precision, v_o ->> 'method', v_engine, coalesce((v_c ->> 'approachM')::double precision, 0), v_rank,
      p_radius_m, p_source, coalesce(p_sources, '[]'::jsonb))
    returning id into v_id;
    v_out := v_out || jsonb_build_object('id', v_id, 'index', v_i, 'routeKey', v_c ->> 'routeKey', 'officialM', v_total, 'digitM', v_o -> 'digitM', 'connectorM', v_o -> 'connectorM',
      'finishM', v_o -> 'finishM', 'repeatedM', v_o -> 'repeatedM');
  end loop;
  if p_purpose = 'online' then
    insert into number_online_preparation (match_id, user_id, status, reason, candidates, updated_at)
    values (p_match_id, p_user_id, case when v_rank > 0 then 'found' else 'none' end, case when v_rank > 0 then null else 'no_number_routes' end, v_rank, timezone('utc', now()))
    on conflict (match_id, user_id) do update set status = excluded.status, reason = excluded.reason, candidates = excluded.candidates, updated_at = excluded.updated_at;
    perform number_event(p_match_id, case when v_rank > 0 then 'PLAYER_COURSE_FOUND' else 'PLAYER_COURSE_FAILED' end, p_user_id, jsonb_build_object('candidates', v_rank));
  end if;
  return jsonb_build_object('candidates', v_out, 'skipped', v_skipped);
end;
$$;

-- An online player's search found nothing (or failed): recorded for everyone to see, without any location.
create or replace function public.number_online_search_failed(p_match_id uuid, p_user_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform 1 from number_trail_matches where id = p_match_id and mode = 'online' and status = 'course_search' for update;
  if not found then raise exception 'match_not_editable'; end if;
  insert into number_online_preparation (match_id, user_id, status, reason, candidates, updated_at)
  values (p_match_id, p_user_id, case when p_reason in ('no_number_routes', 'no_public_start', 'no_network') then 'none' else 'error' end, left(p_reason, 60), 0, timezone('utc', now()))
  on conflict (match_id, user_id) do update set status = excluded.status, reason = excluded.reason, candidates = 0, updated_at = excluded.updated_at;
  perform number_event(p_match_id, 'PLAYER_COURSE_FAILED', p_user_id, jsonb_build_object('reason', left(p_reason, 60)));
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Practice (service role)
-- ---------------------------------------------------------------------------------------------------------------

-- Starts a practice walk on a candidate the server found for this player. Any other open walk of theirs is closed.
create or replace function public.number_practice_begin(p_user_id uuid, p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_c number_course_candidates;
  v_p number_practice_sessions;
  v_s gps_sessions;
begin
  select * into v_c from number_course_candidates where id = p_candidate_id;
  if v_c.id is null or v_c.user_id <> p_user_id or v_c.purpose <> 'practice' then raise exception 'not_found'; end if;
  if v_c.expires_at <= now() then raise exception 'candidate_expired'; end if;
  update number_practice_sessions set status = 'abandoned', finished_at = clock_timestamp() where user_id = p_user_id and status = 'walking';
  update gps_sessions set status = 'expired', ended_at = timezone('utc', now()) where user_id = p_user_id and status in ('active', 'paused');
  insert into number_practice_sessions (user_id, candidate_id, number, course, official_total_m) values (p_user_id, v_c.id, v_c.number, v_c.course, v_c.official_total_m) returning * into v_p;
  -- The walk starts when the practice does (both timestamps the same, so no point falls before the window).
  insert into gps_sessions (number_practice_id, user_id, started_at) values (v_p.id, p_user_id, v_p.started_at) returning * into v_s;
  return jsonb_build_object('practiceId', v_p.id, 'sessionId', v_s.id, 'startedAt', v_p.started_at, 'number', v_p.number, 'course', v_p.course, 'officialM', v_p.official_total_m);
end;
$$;

-- Everything the edge function needs to take points and judge a practice walk.
create or replace function public.number_practice_context(p_practice_id uuid, p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'practice', jsonb_build_object('id', p.id, 'status', p.status, 'startedAt', p.started_at, 'number', p.number, 'officialM', p.official_total_m, 'result', p.result),
    'course', p.course,
    'session', (select jsonb_build_object('id', s.id, 'user_id', s.user_id, 'tournament_id', s.number_practice_id, 'status', s.status, 'started_at', s.started_at, 'last_seq', s.last_seq, 'last_submit_attempt_at', s.last_submit_attempt_at)
      from gps_sessions s where s.number_practice_id = p.id),
    'receivedLastMinute', (select count(*) from gps_points gp join gps_sessions s on s.id = gp.session_id where s.number_practice_id = p.id and gp.received_at >= timezone('utc', now()) - interval '1 minute'))
  from number_practice_sessions p where p.id = p_practice_id and p.user_id = p_user_id;
$$;

create or replace function public.number_practice_points(p_practice_id uuid, p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('seq', gp.sequence_number, 'segment', gp.segment, 'latitude', gp.latitude, 'longitude', gp.longitude,
    'accuracyM', gp.accuracy_m, 'capturedAt', (extract(epoch from gp.captured_at) * 1000)::bigint) order by gp.sequence_number), '[]'::jsonb)
  from gps_points gp join gps_sessions s on s.id = gp.session_id join number_practice_sessions p on p.id = s.number_practice_id
  where p.id = p_practice_id and p.user_id = p_user_id;
$$;

-- Records the server's check of a practice walk. Idempotent: a finished practice keeps its first result.
create or replace function public.number_practice_finish(p_practice_id uuid, p_user_id uuid, p_verified boolean, p_result jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p number_practice_sessions;
begin
  select * into v_p from number_practice_sessions where id = p_practice_id and user_id = p_user_id for update;
  if v_p.id is null then raise exception 'not_found'; end if;
  if v_p.status = 'walking' then
    update number_practice_sessions set status = 'finished', finished_at = clock_timestamp(), verified = coalesce(p_verified, false), result = p_result
    where id = p_practice_id returning * into v_p;
    update gps_sessions set status = 'submitted', ended_at = timezone('utc', now()) where number_practice_id = p_practice_id and status in ('active', 'paused');
  end if;
  return jsonb_build_object('practiceId', v_p.id, 'status', v_p.status, 'verified', v_p.verified, 'result', v_p.result, 'startedAt', v_p.started_at, 'finishedAt', v_p.finished_at);
end;
$$;

-- The player gives up a practice walk: nothing is kept but the session.
create or replace function public.number_practice_abandon(p_practice_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update number_practice_sessions set status = 'abandoned', finished_at = clock_timestamp() where id = p_practice_id and user_id = auth.uid() and status = 'walking';
  update gps_sessions set status = 'cancelled', ended_at = timezone('utc', now()) where number_practice_id = p_practice_id and user_id = auth.uid() and status in ('active', 'paused');
  delete from gps_points p using gps_sessions s where p.session_id = s.id and s.number_practice_id = p_practice_id and s.user_id = auth.uid();
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Online races
-- ---------------------------------------------------------------------------------------------------------------

-- A cross-city race in the host's room: the host's number (1 to 99), a distance category, ranked or not.
create or replace function public.number_create_online_match(p_room_id uuid, p_number text, p_category text, p_ranked boolean default true, p_countdown_s integer default 10)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room multiplayer_rooms;
  v_match number_trail_matches;
  v_target double precision;
  v_minutes integer;
begin
  v_room := number_room_host(p_room_id, auth.uid());
  perform 1 from multiplayer_rooms where id = p_room_id for update;
  if v_room.status <> 'open' or v_room.expires_at <= now() then raise exception 'room_closed'; end if;
  -- No number yet is fine: players check what they can walk, then the host picks one everyone can.
  if p_number is not null and p_number !~ '^([0-9]|[1-9][0-9])$' then raise exception 'bad_number'; end if;
  select case p_category when 'short' then 1000 when 'standard' then 1500 when 'long' then 2500 end,
         case p_category when 'short' then 15 when 'standard' then 25 when 'long' then 40 end into v_target, v_minutes;
  if v_target is null then raise exception 'bad_category'; end if;
  select * into v_match from number_trail_matches where room_id = p_room_id and status not in ('completed', 'cancelled');
  if v_match.id is not null then
    -- A lobby match nobody has prepared yet becomes this race; anything further along is kept.
    if v_match.status <> 'waiting' then raise exception 'match_exists'; end if;
    update number_trail_matches set status = 'cancelled', completed_at = clock_timestamp() where id = v_match.id;
  end if;
  insert into number_trail_matches (room_id, mode, ranked, requested_number, target_number, distance_category, target_distance_m, minutes, countdown_s, created_by)
  values (p_room_id, 'online', coalesce(p_ranked, true), p_number, p_number, p_category, v_target, v_minutes, least(120, greatest(5, coalesce(p_countdown_s, 10))), auth.uid())
  returning * into v_match;
  perform room_changed(p_room_id, 'number_match');
  return jsonb_build_object('matchId', v_match.id);
end;
$$;

-- Host: everyone searches their own streets now (again after a failed match or a settings change).
create or replace function public.number_online_start_search(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  perform number_room_host(v_match.room_id, auth.uid());
  if v_match.mode <> 'online' then raise exception 'wrong_game'; end if;
  if v_match.status not in ('waiting', 'ready') then raise exception 'match_not_editable'; end if;
  if v_match.requested_number is null then raise exception 'match_not_ready'; end if;
  delete from number_trail_player_courses where match_id = p_match_id;
  delete from number_course_equivalence where match_id = p_match_id;
  delete from number_online_preparation where match_id = p_match_id;
  if v_match.status = 'ready' then perform number_transition(p_match_id, 'course_search'); else perform number_transition(p_match_id, 'course_search'); end if;
  perform number_event(p_match_id, 'COURSE_SEARCH_STARTED', auth.uid(), jsonb_build_object('number', v_match.target_number, 'targetM', v_match.target_distance_m));
end;
$$;

-- The matcher's choice, checked again here: one stored candidate per player in the room, all for this number, and
-- (ranked) official lengths within the band and the spread tolerance, from PostGIS. A failure is recorded and the
-- race goes back to searching; only a verified set is ever assigned.
create or replace function public.number_record_online_match(p_match_id uuid, p_picks jsonb, p_equivalence jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_match number_trail_matches;
  v_room uuid;
  v_n integer;
  v_picked integer;
  v_min double precision;
  v_max double precision;
  v_band_ok boolean;
  v_status text := coalesce(p_equivalence ->> 'status', 'missing_player');
  v_tol double precision;
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  if v_match.mode <> 'online' or v_match.status <> 'course_search' then raise exception 'match_not_editable'; end if;
  perform number_transition(p_match_id, 'course_matching');
  v_room := v_match.room_id;
  v_tol := v_match.tolerance_share * v_match.target_distance_m;

  create temporary table if not exists pg_temp.nt_picks (user_id uuid, candidate_id uuid) on commit drop;
  delete from pg_temp.nt_picks;
  insert into pg_temp.nt_picks select (x ->> 'userId')::uuid, (x ->> 'candidateId')::uuid from jsonb_array_elements(coalesce(p_picks, '[]'::jsonb)) x;
  select count(*) into v_n from room_members where room_id = v_room and left_at is null and not removed;
  select count(*), min(c.official_total_m), max(c.official_total_m),
    bool_and(abs(c.official_total_m - v_match.target_distance_m) <= v_match.band_share * v_match.target_distance_m)
  into v_picked, v_min, v_max, v_band_ok
  from pg_temp.nt_picks p
  join number_course_candidates c on c.id = p.candidate_id and c.user_id = p.user_id and c.match_id = p_match_id and c.number = v_match.target_number
  join room_members m on m.room_id = v_room and m.user_id = p.user_id and m.left_at is null and not m.removed;

  -- The database's own distance check, from the PostGIS lengths.
  if v_picked <> v_n or v_picked < 2 or (select count(distinct user_id) from pg_temp.nt_picks) <> v_picked then
    v_status := 'missing_player';
  elsif v_match.ranked and (v_max - v_min > v_tol or not v_band_ok) then
    v_status := 'distance_mismatch';
  elsif not v_match.ranked and v_status <> 'matched' then
    v_status := 'unranked';
  end if;

  insert into number_course_equivalence (match_id, status, target_m, spread_m, tolerance_m, checks, unknown, version)
  values (p_match_id, v_status, v_match.target_distance_m, v_max - v_min, v_tol, coalesce(p_equivalence -> 'checks', '[]'::jsonb),
    array(select jsonb_array_elements_text(coalesce(p_equivalence -> 'unknown', '[]'::jsonb))), coalesce(p_equivalence ->> 'version', 'unknown'));

  if v_status not in ('matched', 'unranked') then
    perform number_transition(p_match_id, 'course_search');
    perform number_event(p_match_id, 'COURSES_UNMATCHED', null, jsonb_build_object('reason', v_status, 'spreadM', v_max - v_min, 'toleranceM', v_tol));
    return jsonb_build_object('matched', false, 'status', v_status, 'spreadM', v_max - v_min, 'toleranceM', v_tol);
  end if;

  insert into number_trail_player_courses (match_id, user_id, candidate_id, course, official_total_m, digit_m, connector_m, finish_m, repeated_m, start_point)
  select p_match_id, c.user_id, c.id, c.course, c.official_total_m, c.digit_m, c.connector_m, c.finish_m, c.repeated_m,
    st_setsrid(st_makepoint((c.course -> 'start' ->> 'longitude')::float8, (c.course -> 'start' ->> 'latitude')::float8), 4326)::geography
  from pg_temp.nt_picks p join number_course_candidates c on c.id = p.candidate_id and c.user_id = p.user_id;
  perform number_transition(p_match_id, 'ready');
  perform number_event(p_match_id, 'COURSES_MATCHED', null, jsonb_build_object('status', v_status, 'targetM', v_match.target_distance_m, 'spreadM', v_max - v_min, 'toleranceM', v_tol));
  return jsonb_build_object('matched', true, 'status', v_status, 'spreadM', v_max - v_min, 'toleranceM', v_tol);
end;
$$;

-- Every present player's stored candidates for an online race, for the matcher (service role only).
create or replace function public.number_online_candidates(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'players', coalesce((select jsonb_agg(m.user_id order by m.joined_at) from number_trail_matches x join room_members m on m.room_id = x.room_id
      where x.id = p_match_id and m.left_at is null and not m.removed), '[]'::jsonb),
    'candidates', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'userId', c.user_id, 'course', c.course, 'officialM', c.official_total_m,
      'digitM', to_jsonb(c.digit_m), 'connectorM', c.connector_m, 'finishM', c.finish_m, 'repeatedM', c.repeated_m) order by c.user_id, c.rank)
      from number_course_candidates c where c.match_id = p_match_id), '[]'::jsonb));
$$;

-- A player is at their own start: their position is compared with their course's start and not stored.
create or replace function public.number_online_checkin(p_match_id uuid, p_user_id uuid, p_latitude double precision, p_longitude double precision, p_accuracy_m double precision)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_match number_trail_matches;
  v_pc number_trail_player_courses;
  v_d double precision;
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  if v_match.mode <> 'online' or v_match.status <> 'ready' then raise exception 'match_not_ready'; end if;
  select * into v_pc from number_trail_player_courses where match_id = p_match_id and user_id = p_user_id;
  if v_pc.user_id is null then raise exception 'not_in_match'; end if;
  if p_accuracy_m is null or p_accuracy_m > 30 then return jsonb_build_object('atStart', false, 'reason', 'gps_weak'); end if;
  v_d := st_distance(v_pc.start_point, st_setsrid(st_makepoint(p_longitude, p_latitude), 4326)::geography);
  if v_d > 60 then return jsonb_build_object('atStart', false, 'reason', 'not_at_start', 'distanceM', round(v_d::numeric)); end if;
  if v_pc.checked_in_at is null then
    update number_trail_player_courses set checked_in_at = clock_timestamp() where match_id = p_match_id and user_id = p_user_id;
    update room_members set ready = true where room_id = v_match.room_id and user_id = p_user_id;
    perform number_event(p_match_id, 'PLAYER_AT_START', p_user_id, '{}'::jsonb);
  end if;
  return jsonb_build_object('atStart', true);
end;
$$;

-- Start: nearby as before; online only with a verified set of courses and everyone checked in at their own start.
create or replace function public.number_start(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
  v_room multiplayer_rooms;
  v_course number_trail_courses;
  v_eq number_course_equivalence;
  v_n integer;
  v_at timestamptz := clock_timestamp();
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  -- Whoever the room's start rule names (host, first or last place: room_starter in 20270128120000_nearby_rooms).
  perform room_assert_can_start(v_match.room_id, auth.uid());
  select * into v_room from multiplayer_rooms where id = v_match.room_id for update;
  if v_match.status in ('countdown', 'active', 'verifying') then raise exception 'already_started'; end if;
  if v_match.status <> 'ready' then raise exception 'match_not_ready'; end if;
  if v_room.status <> 'open' or v_room.expires_at <= now() then raise exception 'room_closed'; end if;
  select count(*) into v_n from room_members where room_id = v_room.id and left_at is null;
  if v_n < 2 then raise exception 'not_enough_players'; end if;
  if v_n > least(10, v_room.max_players) then raise exception 'match_full'; end if;

  if v_match.mode = 'online' then
    select * into v_eq from number_course_equivalence where match_id = p_match_id;
    if v_eq.match_id is null or (v_match.ranked and v_eq.status <> 'matched') then raise exception 'courses_not_matched'; end if;
    if exists (select 1 from room_members m where m.room_id = v_room.id and m.left_at is null
      and not exists (select 1 from number_trail_player_courses pc where pc.match_id = p_match_id and pc.user_id = m.user_id)) then
      raise exception 'courses_not_matched';
    end if;
    if exists (select 1 from number_trail_player_courses pc join room_members m on m.room_id = v_room.id and m.user_id = pc.user_id and m.left_at is null
      where pc.match_id = p_match_id and pc.checked_in_at is null) then
      raise exception 'not_everyone_at_start';
    end if;
    insert into number_trail_assignments (match_id, user_id, display_name, target_number, course_digest)
    select p_match_id, m.user_id, m.display_name, v_match.target_number, md5(pc.course::text)
    from room_members m join number_trail_player_courses pc on pc.match_id = p_match_id and pc.user_id = m.user_id
    where m.room_id = v_room.id and m.left_at is null;
  else
    select * into v_course from number_trail_courses where match_id = p_match_id;
    if v_course.match_id is null then raise exception 'match_not_ready'; end if;
    if exists (select 1 from room_members where room_id = v_room.id and left_at is null and not ready and user_id not in (v_room.host_id, auth.uid())) then
      raise exception 'not_everyone_ready';
    end if;
    insert into number_trail_assignments (match_id, user_id, display_name, target_number, course_digest)
    select p_match_id, m.user_id, m.display_name, v_course.target_number, md5(v_course.course::text)
    from room_members m where m.room_id = v_room.id and m.left_at is null;
  end if;
  insert into number_trail_progress (match_id, user_id) select p_match_id, user_id from number_trail_assignments where match_id = p_match_id;

  update number_trail_matches set countdown_at = v_at, starts_at = v_at + make_interval(secs => countdown_s),
    ends_at = v_at + make_interval(secs => countdown_s) + make_interval(mins => minutes * 2 + 15)
  where id = p_match_id;
  perform number_transition(p_match_id, 'countdown');
  update multiplayer_rooms set status = 'playing' where id = v_room.id;
  select * into v_match from number_trail_matches where id = p_match_id;
  perform number_event(p_match_id, 'COUNTDOWN_STARTED', auth.uid(),
    jsonb_build_object('startsAt', v_match.starts_at, 'endsAt', v_match.ends_at, 'countdownS', v_match.countdown_s, 'players', v_n));
  return jsonb_build_object('matchId', p_match_id, 'startsAt', v_match.starts_at, 'endsAt', v_match.ends_at, 'serverNow', clock_timestamp());
end;
$$;

-- The course a player is judged on: their own online, the shared one nearby.
drop function if exists public.number_course(uuid);
create or replace function public.number_course(p_match_id uuid, p_user_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('course', coalesce(pc.course, c.course), 'startsAt', m.starts_at, 'endsAt', m.ends_at, 'status', m.status)
  from number_trail_matches m
  left join number_trail_courses c on c.match_id = m.id
  left join number_trail_player_courses pc on pc.match_id = m.id and pc.user_id = p_user_id
  where m.id = p_match_id and coalesce(pc.course, c.course) is not null;
$$;

create or replace function public.number_race_state(p_match_id uuid, p_after_seq bigint default 0, p_user_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := coalesce(auth.uid(), p_user_id);
  v_match number_trail_matches;
  v_room multiplayer_rooms;
  v_revealed boolean;
begin
  if p_user_id is not null and auth.uid() is not null and p_user_id <> auth.uid() then raise exception 'not_in_match'; end if;
  select * into v_match from number_trail_matches where id = p_match_id;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  -- A player reads as themselves; the service role reads on behalf of the verified caller it names.
  if not number_member_of(p_match_id, v_me) then raise exception 'not_in_match'; end if;
  select * into v_room from multiplayer_rooms where id = v_match.room_id;
  -- A nearby number is drawn at random and hidden until it is ready; an online number is the host's open choice.
  v_revealed := v_match.mode = 'online' or v_match.status in ('ready', 'countdown', 'active', 'verifying', 'completed') or (v_match.status = 'cancelled' and v_match.starts_at is not null);
  return jsonb_build_object(
    'serverNow', clock_timestamp(),
    'match', jsonb_build_object(
      'id', v_match.id, 'roomId', v_match.room_id, 'mode', v_match.mode, 'status', v_match.status, 'minutes', v_match.minutes,
      'difficulty', v_match.difficulty, 'countdownS', v_match.countdown_s, 'number', case when v_revealed then v_match.target_number end,
      'countdownAt', v_match.countdown_at, 'startsAt', v_match.starts_at, 'endsAt', v_match.ends_at, 'seq', v_match.seq,
      'preparing', v_match.status = 'preparing_routes', 'prepareError', v_match.prepare_error,
      'winnerUserId', v_match.winner_user_id, 'outcome', v_match.outcome, 'completedAt', v_match.completed_at,
      'finalized', v_match.finalized_at is not null, 'result', v_match.result,
      'algorithm', v_match.algorithm, 'raceVersion', v_match.race_version),
    'room', jsonb_build_object('id', v_room.id, 'name', v_room.name, 'code', v_room.code, 'hostId', v_room.host_id, 'maxPlayers', v_room.max_players, 'status', v_room.status),
    -- Your own course: the shared one nearby, your own streets online. Never anyone else's.
    'course', case when v_revealed then coalesce((select pc.course from number_trail_player_courses pc where pc.match_id = p_match_id and pc.user_id = v_me),
      (select c.course from number_trail_courses c where c.match_id = p_match_id)) end,
    'summary', case when v_revealed then (select c.summary || jsonb_build_object('feasible', c.feasible_count) from number_trail_courses c where c.match_id = p_match_id) end,
    'sources', coalesce((select c.sources from number_trail_courses c where c.match_id = p_match_id), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'userId', x.user_id, 'name', x.name, 'isHost', x.user_id = v_room.host_id, 'ready', x.ready, 'inRoom', x.in_room,
        'status', a.status, 'phase', p.phase, 'digitsDone', coalesce(p.digits_done, 0), 'progress', p.public_progress,
        'placement', r.placement, 'finished', coalesce(r.finished, false), 'isWinner', coalesce(r.is_winner, false), 'elapsedMs', r.elapsed_ms
      ) order by r.placement nulls last, x.joined_at)
      from (
        select m.user_id, m.display_name as name, m.ready, m.left_at is null as in_room, m.joined_at from room_members m
        where m.room_id = v_room.id and not m.removed and (m.left_at is null or exists (select 1 from number_trail_assignments a2 where a2.match_id = p_match_id and a2.user_id = m.user_id))
      ) x
      left join number_trail_assignments a on a.match_id = p_match_id and a.user_id = x.user_id
      left join number_trail_progress p on p.match_id = p_match_id and p.user_id = x.user_id
      left join number_trail_results r on r.match_id = p_match_id and r.user_id = x.user_id
    ), '[]'::jsonb),
    'me', jsonb_build_object(
      'userId', v_me,
      'isHost', v_room.host_id = v_me,
      'assignment', (select jsonb_build_object('status', a.status, 'sessionId', a.session_id, 'courseDigest', a.course_digest) from number_trail_assignments a where a.match_id = p_match_id and a.user_id = v_me),
      'progress', (select p.own_progress || jsonb_build_object('phase', p.phase, 'version', p.version, 'verifiedAt', p.verified_at) from number_trail_progress p where p.match_id = p_match_id and p.user_id = v_me),
      'lastAttempt', (select jsonb_build_object('status', t.status, 'reason', t.reason, 'receiptSeq', t.receipt_seq, 'receivedAt', t.received_at, 'finishOrder', t.finish_order, 'requestKey', t.request_key)
        from number_trail_finish_attempts t where t.match_id = p_match_id and t.user_id = v_me order by t.receipt_seq desc limit 1),
      'result', (select to_jsonb(r) - 'match_id' from number_trail_results r where r.match_id = p_match_id and r.user_id = v_me)),
    'results', coalesce((select jsonb_agg(jsonb_build_object('userId', r.user_id, 'placement', r.placement, 'finishOrder', r.finish_order, 'finished', r.finished,
      'isWinner', r.is_winner, 'elapsedMs', r.elapsed_ms, 'digitsDone', r.digits_done, 'coverage', r.coverage) order by r.placement, r.user_id)
      from number_trail_results r where r.match_id = p_match_id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(jsonb_build_object('seq', e.seq, 'kind', e.kind, 'userId', e.user_id, 'payload', e.payload, 'at', e.created_at) order by e.seq)
      from (select * from number_trail_events where match_id = p_match_id and seq > coalesce(p_after_seq, 0) order by seq limit 50) e), '[]'::jsonb),
    'online', case when v_match.mode = 'online' then jsonb_build_object(
      'ranked', v_match.ranked, 'requestedNumber', v_match.requested_number, 'category', v_match.distance_category,
      'targetM', v_match.target_distance_m, 'spreadShare', v_match.tolerance_share, 'bandShare', v_match.band_share,
      'equivalence', (select to_jsonb(e) - 'match_id' from number_course_equivalence e where e.match_id = p_match_id),
      -- Per player: how their search went and their official course length. No geometry, no start point.
      'players', coalesce((select jsonb_agg(jsonb_build_object(
          'userId', m.user_id,
          'search', (select jsonb_build_object('status', o.status, 'reason', o.reason, 'candidates', o.candidates) from number_online_preparation o where o.match_id = p_match_id and o.user_id = m.user_id),
          'officialM', (select round(pc.official_total_m::numeric, 1) from number_trail_player_courses pc where pc.match_id = p_match_id and pc.user_id = m.user_id),
          'atStart', (select pc.checked_in_at is not null from number_trail_player_courses pc where pc.match_id = p_match_id and pc.user_id = m.user_id))
        order by m.joined_at)
        from room_members m where m.room_id = v_room.id and m.left_at is null and not m.removed), '[]'::jsonb)) end,
    'lastSeq', v_match.seq
  );
end;
$$;

-- Practice points go with the rest after 30 days; expired candidates go daily.
create or replace function public.purge_number_trail(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_more integer;
begin
  with gone as (
    delete from gps_points p using gps_sessions s, number_trail_matches m
    where p.session_id = s.id and s.number_match_id = m.id and m.status in ('completed', 'cancelled')
      and m.completed_at < now() - make_interval(days => greatest(p_days, 1))
    returning 1
  )
  select count(*) into v_count from gone;
  with gone as (
    delete from gps_points p using gps_sessions s, number_practice_sessions ps
    where p.session_id = s.id and s.number_practice_id = ps.id and ps.created_at < now() - make_interval(days => greatest(p_days, 1))
    returning 1
  )
  select count(*) into v_more from gone;
  delete from number_trail_plan_cache where expires_at < now();
  delete from number_course_candidates where expires_at < now() - interval '1 day' and purpose = 'practice';
  return v_count + v_more;
end;
$$;

revoke execute on function public.number_course(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.number_store_candidates(uuid, text, uuid, text, jsonb, integer, text, jsonb) from public, anon, authenticated;
revoke execute on function public.number_online_search_failed(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.number_practice_begin(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.number_practice_context(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.number_practice_points(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.number_practice_finish(uuid, uuid, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.number_record_online_match(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.number_online_checkin(uuid, uuid, double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.number_online_candidates(uuid) from public, anon, authenticated;
revoke execute on function public.number_practice_abandon(uuid) from anon;
revoke execute on function public.number_create_online_match(uuid, text, text, boolean, integer) from anon;
revoke execute on function public.number_online_start_search(uuid) from anon;
