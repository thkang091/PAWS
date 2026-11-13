-- Number Trail, location first (phases L1 to L4).
--
--   * Discovery: which numbers from 0 to 99 can be walked near a player. The edge function computes it from the real
--     pedestrian network (numberDiscovery.ts) and caches the answer here by public network data only: the network's
--     fingerprint, the public start junction and the radius. Never the player's coordinates.
--   * Online races may wait for their number. Each player checks what they can walk near them; the database keeps,
--     per player, only which numbers were available, not found or unchecked (no position). The host then picks a
--     number every present player can walk, checked again here.
--   * A shared course: players in the same area race one course the host chose from their routes. Identical course,
--     so it is recorded as a matched race with nothing to compare.

-- ---------------------------------------------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------------------------------------------

alter table public.number_trail_events drop constraint if exists number_trail_events_kind_check;
alter table public.number_trail_events add constraint number_trail_events_kind_check check (kind in (
  'PLAYER_JOINED', 'PLAYER_LEFT', 'PLAYER_READY', 'SETTINGS_CHANGED', 'ROUTE_PREPARING', 'ROUTE_READY', 'ROUTE_FAILED',
  'COURSE_SEARCH_STARTED', 'PLAYER_COURSE_FOUND', 'PLAYER_COURSE_FAILED', 'COURSES_MATCHED', 'COURSES_UNMATCHED', 'PLAYER_AT_START',
  'PLAYER_NUMBERS_CHECKED', 'NUMBER_CHOSEN', 'COURSE_SHARED',
  'COUNTDOWN_STARTED', 'MATCH_STARTED', 'DIGIT_1_COMPLETED', 'DIGIT_2_COMPLETED', 'FINISH_VERIFYING', 'FINISH_REJECTED',
  'PLAYER_FINISHED', 'MATCH_COMPLETED', 'RESULTS_FINAL', 'MATCH_CANCELLED'));

-- ---------------------------------------------------------------------------------------------------------------
-- Discovery cache (service role only)
-- ---------------------------------------------------------------------------------------------------------------

-- key: algorithm version, network fingerprint, public start junction, radius. A partial scan is stored too and
-- completed by later requests; `result.numbers` keeps each number's status.
create table public.number_discovery_cache (
  key text primary key check (length(key) between 10 and 300),
  result jsonb not null,
  partial boolean not null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '1 day'
);
alter table public.number_discovery_cache enable row level security;

create or replace function public.number_discovery_get(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('result', result, 'partial', partial, 'createdAt', created_at)
  from number_discovery_cache where key = p_key and expires_at > timezone('utc', now());
$$;

create or replace function public.number_discovery_put(p_key text, p_result jsonb, p_partial boolean)
returns void
language sql
security definer
set search_path = public
as $$
  insert into number_discovery_cache (key, result, partial) values (p_key, p_result, p_partial)
  on conflict (key) do update set result = excluded.result, partial = excluded.partial, created_at = timezone('utc', now()),
    expires_at = timezone('utc', now()) + interval '1 day';
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Online: each player's walkable numbers (no position), the common set, the host's choice, a shared course
-- ---------------------------------------------------------------------------------------------------------------

create table public.number_online_availability (
  match_id uuid not null references public.number_trail_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  radius_m integer not null check (radius_m between 300 and 3000),
  checked_radius_m integer not null,
  available text[] not null default '{}',
  not_found text[] not null default '{}',
  unchecked text[] not null default '{}',
  -- Searched from a spot the player picked on the map, not their phone's GPS.
  manual boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (match_id, user_id)
);
alter table public.number_online_availability enable row level security;
create policy number_online_availability_own on public.number_online_availability for select to authenticated using (user_id = auth.uid());

-- Records one player's check (service role, from the edge function's discovery). Before the number is chosen only.
create or replace function public.number_online_store_availability(p_match_id uuid, p_user_id uuid, p_result jsonb, p_manual boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
  v_numbers jsonb := coalesce(p_result -> 'numbers', '[]'::jsonb);
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  if v_match.mode <> 'online' then raise exception 'wrong_game'; end if;
  if v_match.status <> 'waiting' or v_match.requested_number is not null then raise exception 'match_not_editable'; end if;
  if not exists (select 1 from room_members where room_id = v_match.room_id and user_id = p_user_id and left_at is null and not removed) then raise exception 'not_in_room'; end if;
  insert into number_online_availability (match_id, user_id, radius_m, checked_radius_m, available, not_found, unchecked, manual, updated_at)
  values (p_match_id, p_user_id, (p_result ->> 'radiusM')::integer, coalesce((p_result ->> 'checkedRadiusM')::integer, 0),
    array(select x ->> 'number' from jsonb_array_elements(v_numbers) x where x ->> 'status' = 'AVAILABLE' and x ->> 'number' ~ '^([0-9]|[1-9][0-9])$'),
    array(select x ->> 'number' from jsonb_array_elements(v_numbers) x where x ->> 'status' = 'NOT_FOUND_IN_CHECKED_AREA' and x ->> 'number' ~ '^([0-9]|[1-9][0-9])$'),
    array(select x ->> 'number' from jsonb_array_elements(v_numbers) x where x ->> 'status' not in ('AVAILABLE', 'NOT_FOUND_IN_CHECKED_AREA') and x ->> 'number' ~ '^([0-9]|[1-9][0-9])$'),
    coalesce(p_manual, false), timezone('utc', now()))
  on conflict (match_id, user_id) do update set radius_m = excluded.radius_m, checked_radius_m = excluded.checked_radius_m, available = excluded.available,
    not_found = excluded.not_found, unchecked = excluded.unchecked, manual = excluded.manual, updated_at = excluded.updated_at;
  perform number_event(p_match_id, 'PLAYER_NUMBERS_CHECKED', p_user_id, jsonb_build_object('available', (select count(*) from jsonb_array_elements(v_numbers) x where x ->> 'status' = 'AVAILABLE')));
  return jsonb_build_object('stored', true);
end;
$$;

-- Numbers every present player can walk. Per player only a status and a count: never their list or position.
create or replace function public.number_online_common_of(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with present as (
    select m.user_id from number_trail_matches x join room_members m on m.room_id = x.room_id
    where x.id = p_match_id and m.left_at is null and not m.removed
  ), checks as (
    select p.user_id, a.available, a.not_found, a.unchecked, a.radius_m, a.checked_radius_m, a.manual
    from present p left join number_online_availability a on a.match_id = p_match_id and a.user_id = p.user_id
  ), numbers as (select n::text as number from generate_series(0, 99) n)
  select jsonb_build_object(
    'players', coalesce((select jsonb_agg(jsonb_build_object('userId', c.user_id,
        'status', case when c.available is null then 'not_checked' when cardinality(c.unchecked) > 0 then 'partial' else 'done' end,
        'available', coalesce(cardinality(c.available), 0), 'radiusM', c.radius_m, 'manual', c.manual)) from checks c), '[]'::jsonb),
    'everyoneChecked', not exists (select 1 from checks where available is null),
    -- Walkable for everyone: available to every present player.
    'common', coalesce((select jsonb_agg(n.number order by n.number::int) from numbers n
        where (select count(*) from present) >= 2 and not exists (select 1 from checks c where c.available is null or not (n.number = any(c.available)))), '[]'::jsonb),
    -- Nobody has ruled it out, but someone hasn't checked it yet.
    'pending', coalesce((select jsonb_agg(n.number order by n.number::int) from numbers n
        where exists (select 1 from checks c where c.available is null or n.number = any(c.unchecked))
          and not exists (select 1 from checks c where n.number = any(c.not_found))), '[]'::jsonb));
$$;

create or replace function public.number_online_common(p_match_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
begin
  select * into v_match from number_trail_matches where id = p_match_id;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  if not exists (select 1 from room_members where room_id = v_match.room_id and user_id = auth.uid() and left_at is null and not removed) then raise exception 'not_in_match'; end if;
  return number_online_common_of(p_match_id);
end;
$$;

-- Host: the race's number, from the numbers everyone can walk (checked here, not trusted from the phone).
create or replace function public.number_online_choose_number(p_match_id uuid, p_number text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
  v_common jsonb;
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  perform number_room_host(v_match.room_id, auth.uid());
  if v_match.mode <> 'online' then raise exception 'wrong_game'; end if;
  if v_match.status <> 'waiting' then raise exception 'match_not_editable'; end if;
  if coalesce(p_number, '') !~ '^([0-9]|[1-9][0-9])$' then raise exception 'bad_number'; end if;
  v_common := number_online_common_of(p_match_id);
  if not (v_common -> 'common') ? p_number then raise exception 'number_not_common'; end if;
  update number_trail_matches set requested_number = p_number, target_number = p_number where id = p_match_id;
  perform number_event(p_match_id, 'NUMBER_CHOSEN', auth.uid(), jsonb_build_object('number', p_number));
  return jsonb_build_object('number', p_number);
end;
$$;

-- Host: everyone races this one course (one of the host's own routes for the race's number). Identical for all, so
-- the fairness verdict is "matched" with nothing to compare. Each player still checks in at its start.
create or replace function public.number_online_share_course(p_match_id uuid, p_candidate_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_match number_trail_matches;
  v_c number_course_candidates;
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  perform number_room_host(v_match.room_id, auth.uid());
  if v_match.mode <> 'online' then raise exception 'wrong_game'; end if;
  if v_match.requested_number is null then raise exception 'match_not_ready'; end if;
  if v_match.status not in ('waiting', 'course_search') then raise exception 'match_not_editable'; end if;
  select * into v_c from number_course_candidates where id = p_candidate_id;
  if v_c.id is null or v_c.user_id <> auth.uid() then raise exception 'not_found'; end if;
  if v_c.expires_at <= now() then raise exception 'candidate_expired'; end if;
  if v_c.number <> v_match.target_number then raise exception 'bad_number'; end if;
  if v_match.status = 'waiting' then perform number_transition(p_match_id, 'course_search'); end if;
  delete from number_trail_player_courses where match_id = p_match_id;
  delete from number_course_equivalence where match_id = p_match_id;
  perform number_transition(p_match_id, 'course_matching');
  insert into number_trail_player_courses (match_id, user_id, candidate_id, course, official_total_m, digit_m, connector_m, finish_m, repeated_m, start_point)
  select p_match_id, m.user_id, v_c.id, v_c.course, v_c.official_total_m, v_c.digit_m, v_c.connector_m, v_c.finish_m, v_c.repeated_m,
    st_setsrid(st_makepoint((v_c.course -> 'start' ->> 'longitude')::float8, (v_c.course -> 'start' ->> 'latitude')::float8), 4326)::geography
  from room_members m where m.room_id = v_match.room_id and m.left_at is null and not m.removed;
  insert into number_course_equivalence (match_id, status, target_m, spread_m, tolerance_m, checks, unknown, version)
  values (p_match_id, 'matched', v_c.official_total_m, 0, v_match.tolerance_share * v_c.official_total_m,
    jsonb_build_array(jsonb_build_object('name', 'shared course', 'ok', true, 'spread', 0, 'allowed', 0, 'unit', 'm')), '{}', 'shared-course-v1');
  perform number_transition(p_match_id, 'ready');
  perform number_event(p_match_id, 'COURSE_SHARED', auth.uid(), jsonb_build_object('officialM', round(v_c.official_total_m::numeric, 1)));
  return jsonb_build_object('shared', true, 'officialM', v_c.official_total_m);
end;
$$;

revoke execute on function public.number_discovery_get(text) from public, anon, authenticated;
revoke execute on function public.number_discovery_put(text, jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.number_online_store_availability(uuid, uuid, jsonb, boolean) from public, anon, authenticated;
revoke execute on function public.number_online_common_of(uuid) from public, anon, authenticated;
revoke execute on function public.number_online_common(uuid) from anon;
revoke execute on function public.number_online_choose_number(uuid, text) from anon;
revoke execute on function public.number_online_share_course(uuid, uuid) from anon;
