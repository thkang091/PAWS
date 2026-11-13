-- PAWS Number Trail, phase N2: the nearby multiplayer race. Players in a nearby room walk the same two-digit number
-- on real streets; the first finish the server verifies wins.
--
-- Trust model, as for team battles: clients never write a number, a course, a start time, progress, a finish or a
-- result.
--   * The lifecycle (number_can_transition) is enforced by a trigger on every status change, for every role.
--   * Host actions (create, settings, start, cancel) are SQL functions that check auth.uid() is the room's host.
--   * Planning, GPS checks and finish checks run in the `tournament` edge function (numberMatch.ts and N1's engine)
--     and are committed by service-role-only functions that take the caller's user id from the verified JWT.
--   * Every mutation locks the match row first, so changes to one match apply one at a time, in commit order.
--   * Finish order: a receipt number from one sequence, taken under the match lock BEFORE the walk is checked. A
--     verified finish is placed only when every earlier receipt has been settled. So a slow check can't reorder
--     finishes, two finishes can't both win, and a retry returns what was already decided.
--   * Each change gets the match's next sequence number, an event row, and a broadcast on the room's private channel
--     with no coordinates. The database is the record; broadcasts only say "reload".
--
-- Raw GPS stays in gps_sessions / gps_points, private to its owner. Course geometry is public street data from a
-- PAWS road area or OpenStreetMap (© OpenStreetMap contributors, ODbL); its sources are stored with the course.

-- ---------------------------------------------------------------------------------------------------------------
-- Rooms and GPS sessions learn about Number Trail
-- ---------------------------------------------------------------------------------------------------------------

alter table public.multiplayer_rooms drop constraint if exists multiplayer_rooms_game_type_check;
alter table public.multiplayer_rooms add constraint multiplayer_rooms_game_type_check
  check (game_type in ('find_mafia', 'steal_territory', 'steal_road', 'number_trail'));

-- A Number Trail walk belongs to a match, not a tournament.
alter table public.gps_sessions alter column tournament_id drop not null;
alter table public.gps_sessions add column if not exists number_match_id uuid;

-- ---------------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------------

create table public.number_trail_matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.multiplayer_rooms(id) on delete cascade,
  -- For a future online mode; nearby races don't belong to a tournament.
  tournament_id uuid references public.tournaments(id) on delete set null,
  -- Cross-city first-to-finish stays off until course equivalence across cities can be shown.
  mode text not null default 'nearby' check (mode = 'nearby'),
  status text not null default 'waiting'
    check (status in ('waiting', 'preparing_routes', 'ready', 'countdown', 'active', 'verifying', 'completed', 'cancelled')),
  minutes integer not null default 25 check (minutes in (15, 25, 40)),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  countdown_s integer not null default 10 check (countdown_s between 5 and 120),
  -- Always two characters, leading zero kept.
  target_number text check (target_number ~ '^[0-9]{2}$'),
  algorithm text,
  race_version text,
  match_version text,
  network_source text check (network_source in ('paws', 'osm')),
  start_node_id text,
  prepare_token uuid,
  prepare_started_at timestamptz,
  prepare_attempts integer not null default 0,
  prepare_error text,
  countdown_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  winner_user_id uuid references auth.users(id) on delete set null,
  outcome text check (outcome in ('winner', 'no_finisher')),
  completed_at timestamptz,
  finalized_at timestamptz,
  result jsonb,
  seq bigint not null default 0,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  check (status in ('waiting', 'preparing_routes', 'cancelled') or target_number is not null),
  check (status not in ('countdown', 'active', 'verifying', 'completed') or (starts_at is not null and ends_at is not null))
);
-- One live match per room: a double tap on "create" makes one.
create unique index number_trail_matches_one_live_idx on public.number_trail_matches (room_id) where status not in ('completed', 'cancelled');
create index number_trail_matches_room_idx on public.number_trail_matches (room_id, created_at desc);

alter table public.gps_sessions add constraint gps_sessions_number_match_fk foreign key (number_match_id) references public.number_trail_matches(id) on delete cascade;
alter table public.gps_sessions add constraint gps_sessions_owner_check check ((tournament_id is null) <> (number_match_id is null));
create unique index gps_sessions_one_per_number_match_idx on public.gps_sessions (number_match_id, user_id) where number_match_id is not null;

-- The shared course. Written once per preparation, frozen from the countdown on.
create table public.number_trail_courses (
  match_id uuid primary key references public.number_trail_matches(id) on delete cascade,
  target_number text not null check (target_number ~ '^[0-9]{2}$'),
  -- NumberCourse (numberMatch.ts): digit strokes, corners, connector and approach as street polylines.
  course jsonb not null check (course ->> 'number' = target_number),
  summary jsonb not null,
  sources jsonb not null default '[]'::jsonb,
  network_fingerprint text not null,
  feasible_count integer not null check (feasible_count > 0),
  created_at timestamptz not null default timezone('utc', now())
);

-- Who races. Made for everyone in the room at the countdown; the course digest shows all got the same course.
create table public.number_trail_assignments (
  match_id uuid not null references public.number_trail_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  target_number text not null check (target_number ~ '^[0-9]{2}$'),
  course_digest text not null,
  assignment_version text not null default 'number-assignment-v1',
  session_id uuid references public.gps_sessions(id) on delete set null,
  status text not null default 'racing' check (status in ('racing', 'finished', 'left')),
  assigned_at timestamptz not null default timezone('utc', now()),
  primary key (match_id, user_id)
);

-- The server's latest check of each walk. Only the server writes it.
create table public.number_trail_progress (
  match_id uuid not null,
  user_id uuid not null,
  phase text not null default 'DIGIT_1_PENDING' check (phase in (
    'DIGIT_1_PENDING', 'DIGIT_1_IN_PROGRESS', 'DIGIT_1_COMPLETE', 'CONNECTOR_IN_PROGRESS', 'DIGIT_2_IN_PROGRESS',
    'DIGIT_2_COMPLETE', 'FINISH_PENDING_VERIFICATION', 'VERIFIED_COMPLETE', 'INVALID_COMPLETION')),
  digits_done smallint not null default 0 check (digits_done between 0 and 2),
  coverage numeric(5, 3) not null default 0 check (coverage between 0 and 1),
  public_progress jsonb not null default '{}'::jsonb,
  own_progress jsonb not null default '{}'::jsonb,
  through_seq integer not null default 0,
  version integer not null default 0,
  digit1_at timestamptz,
  digit2_at timestamptz,
  verified_at timestamptz,
  primary key (match_id, user_id),
  foreign key (match_id, user_id) references public.number_trail_assignments(match_id, user_id) on delete cascade
);

-- One server-wide order of finish receipts.
create sequence public.number_trail_receipt_seq;

create table public.number_trail_finish_attempts (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null,
  user_id uuid not null,
  request_key text not null check (char_length(request_key) between 8 and 80),
  receipt_seq bigint not null unique,
  received_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'expired')),
  reason text,
  through_seq integer,
  track_hash text,
  verdict jsonb,
  verify_started_at timestamptz not null,
  verify_count integer not null default 1,
  settled_at timestamptz,
  finish_order integer,
  unique (match_id, user_id, request_key),
  foreign key (match_id, user_id) references public.number_trail_assignments(match_id, user_id) on delete cascade
);
create unique index number_trail_attempts_one_pending_idx on public.number_trail_finish_attempts (match_id, user_id) where status = 'pending';
create index number_trail_attempts_order_idx on public.number_trail_finish_attempts (match_id, receipt_seq);
create index number_trail_attempts_hash_idx on public.number_trail_finish_attempts (track_hash) where status = 'verified';

-- Official results. Insert-only: never updated, deleted only with the match or the account.
create table public.number_trail_results (
  match_id uuid not null references public.number_trail_matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  placement integer not null check (placement > 0),
  finish_order integer check (finish_order > 0),
  finished boolean not null,
  is_winner boolean not null default false,
  receipt_seq bigint,
  received_at timestamptz,
  elapsed_ms integer,
  digits_done smallint not null default 0,
  coverage numeric(5, 3) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (match_id, user_id),
  check (finished = (finish_order is not null)),
  check (not is_winner or finish_order = 1)
);
create unique index number_trail_results_one_winner_idx on public.number_trail_results (match_id) where is_winner;
create unique index number_trail_results_order_idx on public.number_trail_results (match_id, finish_order) where finish_order is not null;

create table public.number_trail_events (
  match_id uuid not null references public.number_trail_matches(id) on delete cascade,
  seq bigint not null,
  kind text not null check (kind in (
    'PLAYER_JOINED', 'PLAYER_LEFT', 'PLAYER_READY', 'SETTINGS_CHANGED', 'ROUTE_PREPARING', 'ROUTE_READY', 'ROUTE_FAILED',
    'COUNTDOWN_STARTED', 'MATCH_STARTED', 'DIGIT_1_COMPLETED', 'DIGIT_2_COMPLETED', 'FINISH_VERIFYING', 'FINISH_REJECTED',
    'PLAYER_FINISHED', 'MATCH_COMPLETED', 'RESULTS_FINAL', 'MATCH_CANCELLED')),
  user_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (match_id, seq)
);

-- Feasible plans per start junction, network version and walking time, so "new number" and the next room at the same
-- start don't plan again. Service role only. Derived from the network it names; expires.
create table public.number_trail_plan_cache (
  cache_key text primary key,
  network_fingerprint text not null,
  start_node_id text not null,
  minutes integer not null,
  algorithm text not null,
  outcome text not null,
  plans jsonb not null default '[]'::jsonb,
  plan_count integer not null default 0,
  stats jsonb not null default '{}'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null
);

alter table public.number_trail_matches enable row level security;
alter table public.number_trail_courses enable row level security;
alter table public.number_trail_assignments enable row level security;
alter table public.number_trail_progress enable row level security;
alter table public.number_trail_finish_attempts enable row level security;
alter table public.number_trail_results enable row level security;
alter table public.number_trail_events enable row level security;
alter table public.number_trail_plan_cache enable row level security;

-- Anyone who joined the room (even if they left since) or raced in the match may read it. Removed players may not.
create or replace function public.number_member_of(p_match_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and (exists (
    select 1 from number_trail_matches m join room_members r on r.room_id = m.room_id
    where m.id = p_match_id and r.user_id = p_user_id and not r.removed
  ) or exists (select 1 from number_trail_assignments a where a.match_id = p_match_id and a.user_id = p_user_id));
$$;

create or replace function public.is_number_member(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select number_member_of(p_match_id, auth.uid());
$$;

create policy number_matches_members on public.number_trail_matches for select to authenticated using (is_number_member(id));
create policy number_courses_members on public.number_trail_courses for select to authenticated using (is_number_member(match_id));
create policy number_events_members on public.number_trail_events for select to authenticated using (is_number_member(match_id));
create policy number_results_members on public.number_trail_results for select to authenticated using (is_number_member(match_id));
create policy number_assignments_own on public.number_trail_assignments for select to authenticated using (user_id = auth.uid());
create policy number_progress_own on public.number_trail_progress for select to authenticated using (user_id = auth.uid());
create policy number_attempts_own on public.number_trail_finish_attempts for select to authenticated using (user_id = auth.uid());
-- number_trail_plan_cache: no policies.

-- ---------------------------------------------------------------------------------------------------------------
-- Lifecycle
-- ---------------------------------------------------------------------------------------------------------------

-- Same table as TRANSITIONS in supabase/functions/tournament/numberMatch.ts.
create or replace function public.number_can_transition(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'waiting' then p_to in ('preparing_routes', 'cancelled')
    when 'preparing_routes' then p_to in ('ready', 'waiting', 'cancelled')
    when 'ready' then p_to in ('preparing_routes', 'waiting', 'countdown', 'cancelled')
    when 'countdown' then p_to in ('active', 'cancelled')
    when 'active' then p_to in ('verifying', 'completed', 'cancelled')
    when 'verifying' then p_to in ('active', 'completed', 'cancelled')
    else false
  end;
$$;

-- Every status change, by anyone (service role included), must be an allowed move, and nothing that defines the race
-- changes once the countdown has begun.
create or replace function public.trg_number_match_guard()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status and not number_can_transition(old.status, new.status) then
    raise exception 'bad_transition';
  end if;
  if old.status in ('countdown', 'active', 'verifying', 'completed', 'cancelled') and (
    new.target_number is distinct from old.target_number or new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at or new.minutes is distinct from old.minutes or new.room_id is distinct from old.room_id
    or new.countdown_at is distinct from old.countdown_at
  ) then
    raise exception 'match_locked';
  end if;
  if old.winner_user_id is not null and new.winner_user_id is distinct from old.winner_user_id then
    raise exception 'result_locked';
  end if;
  return new;
end;
$$;
create trigger number_trail_matches_guard before update on public.number_trail_matches for each row execute function public.trg_number_match_guard();

-- The course and assignments are frozen from the countdown on.
create or replace function public.trg_number_course_guard()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from number_trail_matches where id = coalesce(old.match_id, new.match_id);
  -- A match being deleted takes its course with it.
  if v_status is null then return coalesce(new, old); end if;
  if v_status not in ('waiting', 'preparing_routes', 'ready') then raise exception 'assignment_locked'; end if;
  return coalesce(new, old);
end;
$$;
create trigger number_trail_courses_guard before update or delete on public.number_trail_courses for each row execute function public.trg_number_course_guard();

create or replace function public.trg_number_assignment_guard()
returns trigger
language plpgsql
as $$
begin
  if new.match_id <> old.match_id or new.user_id <> old.user_id or new.target_number <> old.target_number
    or new.course_digest <> old.course_digest or new.assigned_at <> old.assigned_at or new.assignment_version <> old.assignment_version then
    raise exception 'assignment_locked';
  end if;
  return new;
end;
$$;
create trigger number_trail_assignments_guard before update on public.number_trail_assignments for each row execute function public.trg_number_assignment_guard();

-- Results never change. They go only with their match or the player's account (a cascade, inside another trigger).
create or replace function public.trg_number_result_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception 'result_locked';
end;
$$;
create trigger number_trail_results_guard before update or delete on public.number_trail_results for each row execute function public.trg_number_result_guard();

-- Next sequence number, an event row, and a broadcast to the room's private channel. Never coordinates.
create or replace function public.number_event(p_match_id uuid, p_kind text, p_user_id uuid default null, p_payload jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq bigint;
  v_room uuid;
begin
  update number_trail_matches set seq = seq + 1 where id = p_match_id returning seq, room_id into v_seq, v_room;
  insert into number_trail_events (match_id, seq, kind, user_id, payload) values (p_match_id, v_seq, p_kind, p_user_id, coalesce(p_payload, '{}'::jsonb));
  begin
    perform realtime.send(
      jsonb_build_object('matchId', p_match_id, 'seq', v_seq, 'kind', p_kind, 'userId', p_user_id, 'payload', coalesce(p_payload, '{}'::jsonb), 'at', timezone('utc', now())),
      'number',
      'room:' || v_room,
      true
    );
  exception when others then
    -- Realtime unavailable: clients catch up from number_race_state.
    null;
  end;
  return v_seq;
end;
$$;

-- Moves a match the caller has locked. Times for the new status are set here, from the database clock.
create or replace function public.number_transition(p_match_id uuid, p_to text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update number_trail_matches set status = p_to,
    completed_at = case when p_to in ('completed', 'cancelled') then coalesce(completed_at, clock_timestamp()) else completed_at end
  where id = p_match_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Host actions
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.number_room_host(p_room_id uuid, p_user_id uuid)
returns multiplayer_rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room multiplayer_rooms;
begin
  select * into v_room from multiplayer_rooms where id = p_room_id;
  if v_room.id is null then raise exception 'room_not_found'; end if;
  if v_room.game_type <> 'number_trail' then raise exception 'wrong_game'; end if;
  if p_user_id is null or v_room.host_id <> p_user_id then raise exception 'not_the_host'; end if;
  return v_room;
end;
$$;

-- A new match in the room's lobby, or the live one if there already is one.
create or replace function public.number_create_match(p_room_id uuid, p_minutes integer default 25, p_difficulty text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room multiplayer_rooms;
  v_match number_trail_matches;
begin
  v_room := number_room_host(p_room_id, auth.uid());
  perform 1 from multiplayer_rooms where id = p_room_id for update;
  if v_room.status <> 'open' or v_room.expires_at <= now() then raise exception 'room_closed'; end if;
  select * into v_match from number_trail_matches where room_id = p_room_id and status not in ('completed', 'cancelled');
  if v_match.id is not null then return jsonb_build_object('matchId', v_match.id, 'alreadyExists', true); end if;
  if coalesce(p_minutes, 25) not in (15, 25, 40) then raise exception 'bad_minutes'; end if;
  if p_difficulty is not null and p_difficulty not in ('easy', 'medium', 'hard') then raise exception 'bad_difficulty'; end if;
  insert into number_trail_matches (room_id, minutes, difficulty, countdown_s, created_by)
  values (p_room_id, coalesce(p_minutes, 25), p_difficulty, least(120, greatest(5, v_room.start_delay_s)), auth.uid())
  returning * into v_match;
  perform room_changed(p_room_id, 'number_match');
  return jsonb_build_object('matchId', v_match.id, 'alreadyExists', false);
end;
$$;

-- Walking time, difficulty and countdown. Changing them after a number was drawn draws again from the lobby.
create or replace function public.number_set_settings(p_match_id uuid, p_minutes integer, p_difficulty text, p_countdown_s integer)
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
  if v_match.status not in ('waiting', 'ready') then raise exception 'match_not_editable'; end if;
  if coalesce(p_minutes, v_match.minutes) not in (15, 25, 40) then raise exception 'bad_minutes'; end if;
  if p_difficulty is not null and p_difficulty not in ('easy', 'medium', 'hard') then raise exception 'bad_difficulty'; end if;
  if p_countdown_s is not null and p_countdown_s not between 5 and 120 then raise exception 'bad_countdown'; end if;
  if v_match.status = 'ready' and (coalesce(p_minutes, v_match.minutes) <> v_match.minutes or p_difficulty is distinct from v_match.difficulty) then
    delete from number_trail_courses where match_id = p_match_id;
    update number_trail_matches set target_number = null, algorithm = null, start_node_id = null, network_source = null where id = p_match_id;
    perform number_transition(p_match_id, 'waiting');
  end if;
  update number_trail_matches set minutes = coalesce(p_minutes, minutes), difficulty = p_difficulty, countdown_s = coalesce(p_countdown_s, countdown_s), prepare_error = null
  where id = p_match_id;
  perform number_event(p_match_id, 'SETTINGS_CHANGED', auth.uid(),
    jsonb_build_object('minutes', coalesce(p_minutes, v_match.minutes), 'difficulty', p_difficulty, 'countdownS', coalesce(p_countdown_s, v_match.countdown_s)));
end;
$$;

-- Start: everyone present gets the same course, and the server sets the start time. Nothing about the race can change
-- after this.
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
  v_n integer;
  v_at timestamptz := clock_timestamp();
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  v_room := number_room_host(v_match.room_id, auth.uid());
  select * into v_room from multiplayer_rooms where id = v_match.room_id for update;
  if v_match.status in ('countdown', 'active', 'verifying') then raise exception 'already_started'; end if;
  if v_match.status <> 'ready' then raise exception 'match_not_ready'; end if;
  if v_room.status <> 'open' or v_room.expires_at <= now() then raise exception 'room_closed'; end if;
  select * into v_course from number_trail_courses where match_id = p_match_id;
  if v_course.match_id is null then raise exception 'match_not_ready'; end if;
  select count(*) into v_n from room_members where room_id = v_room.id and left_at is null;
  if v_n < 2 then raise exception 'not_enough_players'; end if;
  if v_n > least(10, v_room.max_players) then raise exception 'match_full'; end if;
  if exists (select 1 from room_members where room_id = v_room.id and left_at is null and not ready and user_id <> v_room.host_id) then
    raise exception 'not_everyone_ready';
  end if;

  insert into number_trail_assignments (match_id, user_id, display_name, target_number, course_digest)
  select p_match_id, m.user_id, m.display_name, v_course.target_number, md5(v_course.course::text)
  from room_members m where m.room_id = v_room.id and m.left_at is null;
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

-- Closes a match's walks. Points stay for the retention period; cancelled walks keep nothing.
create or replace function public.number_close_walks(p_match_id uuid, p_status text)
returns void
language sql
security definer
set search_path = public
as $$
  update gps_sessions set status = p_status, ended_at = coalesce(ended_at, timezone('utc', now()))
  where number_match_id = p_match_id and status in ('active', 'paused');
$$;

create or replace function public.number_cancel_locked(p_match_id uuid, p_by uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
begin
  select * into v_match from number_trail_matches where id = p_match_id;
  if v_match.status in ('completed', 'cancelled') then return; end if;
  perform number_transition(p_match_id, 'cancelled');
  perform number_close_walks(p_match_id, 'cancelled');
  delete from gps_points p using gps_sessions s where p.session_id = s.id and s.number_match_id = p_match_id;
  perform number_event(p_match_id, 'MATCH_CANCELLED', p_by, '{}'::jsonb);
  update multiplayer_rooms set status = 'finished' where id = v_match.room_id and status = 'playing';
end;
$$;

create or replace function public.number_cancel(p_match_id uuid)
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
  if v_match.status = 'completed' then raise exception 'match_completed'; end if;
  perform number_cancel_locked(p_match_id, auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Room activity becomes match events
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.trg_number_room_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match uuid;
  v_status text;
begin
  select m.id, m.status into v_match, v_status from number_trail_matches m join multiplayer_rooms r on r.id = m.room_id
  where m.room_id = new.room_id and r.game_type = 'number_trail' and m.status not in ('completed', 'cancelled');
  if v_match is null then return null; end if;
  if tg_op = 'INSERT' or (old.left_at is not null and new.left_at is null) then
    perform number_event(v_match, 'PLAYER_JOINED', new.user_id, jsonb_build_object('name', new.display_name));
  elsif old.left_at is null and new.left_at is not null then
    update number_trail_assignments set status = 'left' where match_id = v_match and user_id = new.user_id and status = 'racing';
    perform number_event(v_match, 'PLAYER_LEFT', new.user_id, jsonb_build_object('removed', new.removed));
  elsif old.ready is distinct from new.ready and new.left_at is null then
    perform number_event(v_match, 'PLAYER_READY', new.user_id, jsonb_build_object('ready', new.ready));
  end if;
  return null;
end;
$$;
create trigger number_room_members_events after insert or update on public.room_members for each row execute function public.trg_number_room_members();

-- A cancelled room (the host left an empty room, or cancelled it) cancels its race.
create or replace function public.trg_number_room_cancelled()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match uuid;
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' then return null; end if;
  for v_match in select id from number_trail_matches where room_id = new.id and status not in ('completed', 'cancelled') for update loop
    perform number_cancel_locked(v_match, null);
  end loop;
  return null;
end;
$$;
create trigger number_room_cancelled after update of status on public.multiplayer_rooms for each row execute function public.trg_number_room_cancelled();

-- ---------------------------------------------------------------------------------------------------------------
-- Preparing the course (service role: the edge function plans; these record it)
-- ---------------------------------------------------------------------------------------------------------------

-- The host asks for a number. Returns a token the plan must come back with, so a slow, abandoned preparation can't
-- overwrite a newer one. A preparation that never reported back can be restarted after 90 seconds.
create or replace function public.number_begin_prepare(p_match_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
  v_room multiplayer_rooms;
  v_token uuid := gen_random_uuid();
  v_previous text;
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  v_room := number_room_host(v_match.room_id, p_user_id);
  if v_match.status not in ('waiting', 'ready', 'preparing_routes') then raise exception 'match_not_editable'; end if;
  if v_room.status <> 'open' then raise exception 'room_closed'; end if;
  if v_match.status = 'preparing_routes' and v_match.prepare_started_at > clock_timestamp() - interval '90 seconds' then raise exception 'preparation_in_progress'; end if;
  if v_match.prepare_attempts >= 30 then raise exception 'too_many_attempts'; end if;
  v_previous := v_match.target_number;
  if v_match.status = 'ready' then
    delete from number_trail_courses where match_id = p_match_id;
    perform number_transition(p_match_id, 'preparing_routes');
  elsif v_match.status = 'waiting' then
    perform number_transition(p_match_id, 'preparing_routes');
  end if;
  update number_trail_matches set prepare_token = v_token, prepare_started_at = clock_timestamp(), prepare_attempts = prepare_attempts + 1,
    prepare_error = null, target_number = null
  where id = p_match_id;
  perform number_event(p_match_id, 'ROUTE_PREPARING', p_user_id, jsonb_build_object('minutes', v_match.minutes, 'difficulty', v_match.difficulty));
  return jsonb_build_object('token', v_token, 'minutes', v_match.minutes, 'difficulty', v_match.difficulty, 'previousNumber', v_previous);
end;
$$;

create or replace function public.number_prepare_failed(p_match_id uuid, p_token uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null or v_match.prepare_token is distinct from p_token or v_match.status <> 'preparing_routes' then raise exception 'stale_preparation'; end if;
  perform number_transition(p_match_id, 'waiting');
  update number_trail_matches set prepare_error = left(p_reason, 60), prepare_token = null where id = p_match_id;
  perform number_event(p_match_id, 'ROUTE_FAILED', null, jsonb_build_object('reason', left(p_reason, 60)));
end;
$$;

create or replace function public.number_record_course(
  p_match_id uuid,
  p_token uuid,
  p_course jsonb,
  p_summary jsonb,
  p_sources jsonb,
  p_fingerprint text,
  p_feasible integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
  v_number text := p_course ->> 'number';
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null or v_match.prepare_token is distinct from p_token or v_match.status <> 'preparing_routes' then raise exception 'stale_preparation'; end if;
  if v_number is null or v_number !~ '^[0-9]{2}$' then raise exception 'bad_number'; end if;
  if jsonb_array_length(coalesce(p_course -> 'digits', '[]'::jsonb)) <> 2 then raise exception 'bad_course'; end if;
  if v_match.difficulty is not null and p_course ->> 'difficulty' is distinct from v_match.difficulty then raise exception 'wrong_difficulty'; end if;
  insert into number_trail_courses (match_id, target_number, course, summary, sources, network_fingerprint, feasible_count)
  values (p_match_id, v_number, p_course, coalesce(p_summary, '{}'::jsonb), coalesce(p_sources, '[]'::jsonb), p_fingerprint, p_feasible);
  update number_trail_matches set target_number = v_number, algorithm = p_course ->> 'algorithm', race_version = p_course ->> 'raceVersion',
    match_version = p_course ->> 'version', start_node_id = p_course -> 'start' ->> 'nodeId', network_source = p_summary ->> 'source', prepare_token = null
  where id = p_match_id;
  perform number_transition(p_match_id, 'ready');
  perform number_event(p_match_id, 'ROUTE_READY', null, jsonb_build_object(
    'number', v_number, 'minutes', v_match.minutes, 'difficulty', p_course ->> 'difficulty', 'raceM', (p_course ->> 'raceM')::numeric,
    'layout', p_course ->> 'layout', 'feasible', p_feasible));
  return jsonb_build_object('number', v_number);
end;
$$;

create or replace function public.number_plan_cache_get(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('outcome', outcome, 'plans', plans, 'stats', stats, 'sources', sources, 'createdAt', created_at)
  from number_trail_plan_cache where cache_key = p_key and expires_at > now();
$$;

create or replace function public.number_plan_cache_put(p_key text, p_fingerprint text, p_start_node_id text, p_minutes integer, p_algorithm text, p_outcome text, p_plans jsonb, p_stats jsonb, p_sources jsonb, p_hours integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into number_trail_plan_cache (cache_key, network_fingerprint, start_node_id, minutes, algorithm, outcome, plans, plan_count, stats, sources, expires_at)
  values (p_key, p_fingerprint, p_start_node_id, p_minutes, p_algorithm, p_outcome, coalesce(p_plans, '[]'::jsonb), jsonb_array_length(coalesce(p_plans, '[]'::jsonb)),
    coalesce(p_stats, '{}'::jsonb), coalesce(p_sources, '[]'::jsonb), timezone('utc', now()) + make_interval(hours => greatest(1, least(p_hours, 24 * 7))))
  on conflict (cache_key) do update set outcome = excluded.outcome, plans = excluded.plans, plan_count = excluded.plan_count, stats = excluded.stats,
    sources = excluded.sources, created_at = excluded.created_at, expires_at = excluded.expires_at;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- The race (service role)
-- ---------------------------------------------------------------------------------------------------------------

-- Countdown to active once the start time has passed. Called with the match locked by everything that touches a race,
-- so no one depends on a phone asking at the right moment.
create or replace function public.number_tick(p_match_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
begin
  select * into v_match from number_trail_matches where id = p_match_id;
  if v_match.status = 'countdown' and clock_timestamp() >= v_match.starts_at then
    perform number_transition(p_match_id, 'active');
    perform number_event(p_match_id, 'MATCH_STARTED', null, jsonb_build_object('startsAt', v_match.starts_at));
    return 'active';
  end if;
  return v_match.status;
end;
$$;

-- Moves the match on by the database clock: countdown to active at the start time; a race past its time limit with
-- nothing waiting to be checked ends. Safe to call any number of times.
create or replace function public.number_advance(p_match_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
begin
  -- Players (signed in) must be in the match; the service role and database administrators have no auth.uid().
  if auth.uid() is not null and not is_number_member(p_match_id) then raise exception 'not_in_match'; end if;
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  v_match.status := number_tick(p_match_id);
  if v_match.status in ('active', 'verifying') then
    -- A check that never reported back for ten minutes is given up on: the player may hand in again.
    update number_trail_finish_attempts set status = 'expired', reason = 'verification_expired', settled_at = clock_timestamp()
    where match_id = p_match_id and status = 'pending' and verify_started_at < clock_timestamp() - interval '10 minutes';
    perform number_settle_order(p_match_id);
  end if;
  return (select status from number_trail_matches where id = p_match_id);
end;
$$;

-- The player's walk for this match: their one GPS session, opened (or reopened) now. Any other open walk of theirs is
-- closed, as for every PAWS walk: one at a time.
create or replace function public.number_begin_walk(p_match_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
  v_a number_trail_assignments;
  v_s gps_sessions;
  v_dog uuid;
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  v_match.status := number_tick(p_match_id);
  select * into v_a from number_trail_assignments where match_id = p_match_id and user_id = p_user_id;
  if v_a.user_id is null then raise exception 'not_in_match'; end if;
  if v_a.status = 'left' then raise exception 'not_in_room'; end if;
  if v_match.status = 'completed' then raise exception 'match_completed'; end if;
  if v_match.status not in ('countdown', 'active', 'verifying') then raise exception 'match_not_active'; end if;
  if clock_timestamp() >= v_match.ends_at then raise exception 'match_over'; end if;
  select * into v_s from gps_sessions where number_match_id = p_match_id and user_id = p_user_id;
  if v_s.id is not null and v_s.status in ('active', 'paused') then
    return jsonb_build_object('sessionId', v_s.id, 'lastSeq', v_s.last_seq, 'status', v_s.status, 'resumed', true);
  end if;
  update gps_sessions set status = 'expired', ended_at = timezone('utc', now())
  where user_id = p_user_id and status in ('active', 'paused') and id is distinct from v_s.id;
  if v_s.id is not null then
    -- Reopened after another walk closed it; the phone starts a new segment, so nothing is joined across the gap.
    update gps_sessions set status = 'active', ended_at = null where id = v_s.id returning * into v_s;
  else
    select dog_id into v_dog from room_members where room_id = v_match.room_id and user_id = p_user_id;
    insert into gps_sessions (number_match_id, user_id, dog_id) values (p_match_id, p_user_id, v_dog) returning * into v_s;
    update number_trail_assignments set session_id = v_s.id where match_id = p_match_id and user_id = p_user_id;
  end if;
  return jsonb_build_object('sessionId', v_s.id, 'lastSeq', v_s.last_seq, 'status', v_s.status, 'resumed', false);
end;
$$;

-- What the edge function needs before taking points: the match's times, the walk, and how much it sent in the last
-- minute.
create or replace function public.number_walk_context(p_match_id uuid, p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'match', jsonb_build_object('id', m.id, 'status', m.status, 'roomId', m.room_id, 'countdownAt', m.countdown_at, 'startsAt', m.starts_at, 'endsAt', m.ends_at, 'number', m.target_number),
    'assignment', (select jsonb_build_object('status', a.status, 'sessionId', a.session_id) from number_trail_assignments a where a.match_id = m.id and a.user_id = p_user_id),
    'member', exists (select 1 from room_members r where r.room_id = m.room_id and r.user_id = p_user_id and r.left_at is null),
    'session', (select jsonb_build_object('id', s.id, 'user_id', s.user_id, 'tournament_id', s.number_match_id, 'status', s.status, 'started_at', s.started_at, 'last_seq', s.last_seq, 'last_submit_attempt_at', s.last_submit_attempt_at)
      from gps_sessions s where s.number_match_id = m.id and s.user_id = p_user_id),
    'receivedLastMinute', (select count(*) from gps_points p join gps_sessions s on s.id = p.session_id
      where s.number_match_id = m.id and s.user_id = p_user_id and p.received_at >= timezone('utc', now()) - interval '1 minute'),
    'progress', (select jsonb_build_object('version', p.version, 'verifiedAt', p.verified_at, 'digitsDone', p.digits_done, 'throughSeq', p.through_seq)
      from number_trail_progress p where p.match_id = m.id and p.user_id = p_user_id)
  )
  from number_trail_matches m where m.id = p_match_id;
$$;

-- Stores checked points (planAppend in geo.ts decides which). Repeats are ignored.
create or replace function public.number_store_points(p_session_id uuid, p_points jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_top integer;
begin
  insert into gps_points (session_id, sequence_number, segment, latitude, longitude, accuracy_m, captured_at)
  select p_session_id, (x ->> 'seq')::integer, (x ->> 'segment')::integer, (x ->> 'latitude')::float8, (x ->> 'longitude')::float8,
    (x ->> 'accuracyM')::real, to_timestamp((x ->> 'capturedAt')::float8 / 1000.0)
  from jsonb_array_elements(coalesce(p_points, '[]'::jsonb)) x
  on conflict (session_id, sequence_number) do nothing;
  select max((x ->> 'seq')::integer) into v_top from jsonb_array_elements(coalesce(p_points, '[]'::jsonb)) x;
  update gps_sessions set last_seq = v_top where id = p_session_id and v_top is not null and last_seq < v_top;
  return coalesce((select last_seq from gps_sessions where id = p_session_id), 0);
end;
$$;

-- A player's points for this match, as stored by the server, received no later than p_received_by: a finish is judged
-- on what had arrived by its receipt, both times from the database clock. Null for everything stored so far. Only to
-- the edge function.
create or replace function public.number_points(p_match_id uuid, p_user_id uuid, p_received_by timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('seq', p.sequence_number, 'segment', p.segment, 'latitude', p.latitude, 'longitude', p.longitude,
    'accuracyM', p.accuracy_m, 'capturedAt', (extract(epoch from p.captured_at) * 1000)::bigint) order by p.sequence_number), '[]'::jsonb)
  from (
    select p.* from gps_points p join gps_sessions s on s.id = p.session_id
    where s.number_match_id = p_match_id and s.user_id = p_user_id and (p_received_by is null or p.received_at <= p_received_by)
    order by p.sequence_number limit 10000
  ) p;
$$;

-- The server's latest check of a walk. Digit completions are announced once each, never taken back.
create or replace function public.number_record_progress(
  p_match_id uuid,
  p_user_id uuid,
  p_phase text,
  p_digits_done integer,
  p_coverage numeric,
  p_public jsonb,
  p_own jsonb,
  p_through_seq integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
  v_old number_trail_progress;
  v_new number_trail_progress;
  v_now timestamptz;
begin
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  v_match.status := number_tick(p_match_id);
  if v_match.status not in ('active', 'verifying') then raise exception 'match_not_active'; end if;
  select * into v_old from number_trail_progress where match_id = p_match_id and user_id = p_user_id for update;
  if v_old.user_id is null then raise exception 'not_in_match'; end if;
  if not exists (select 1 from number_trail_assignments where match_id = p_match_id and user_id = p_user_id and status = 'racing') then
    return jsonb_build_object('version', v_old.version, 'recorded', false);
  end if;
  -- An older check finishing late never replaces a newer one.
  if p_through_seq < v_old.through_seq then return jsonb_build_object('version', v_old.version, 'recorded', false); end if;
  v_now := clock_timestamp();
  update number_trail_progress set
    -- While a finish is being checked, that is what the player sees.
    phase = case when exists (select 1 from number_trail_finish_attempts t where t.match_id = p_match_id and t.user_id = p_user_id and t.status = 'pending')
      then 'FINISH_PENDING_VERIFICATION' else p_phase end,
    digits_done = greatest(digits_done, p_digits_done), coverage = greatest(0, least(1, p_coverage)),
    public_progress = coalesce(p_public, '{}'::jsonb), own_progress = coalesce(p_own, '{}'::jsonb), through_seq = p_through_seq,
    version = version + 1, verified_at = v_now,
    digit1_at = case when p_digits_done >= 1 then coalesce(digit1_at, v_now) else digit1_at end,
    digit2_at = case when p_digits_done >= 2 then coalesce(digit2_at, v_now) else digit2_at end
  where match_id = p_match_id and user_id = p_user_id
  returning * into v_new;
  if v_old.digit1_at is null and v_new.digit1_at is not null then
    perform number_event(p_match_id, 'DIGIT_1_COMPLETED', p_user_id, jsonb_build_object('digit', substr(v_match.target_number, 1, 1)));
  end if;
  if v_old.digit2_at is null and v_new.digit2_at is not null then
    perform number_event(p_match_id, 'DIGIT_2_COMPLETED', p_user_id, jsonb_build_object('digit', substr(v_match.target_number, 2, 1)));
  end if;
  return jsonb_build_object('version', v_new.version, 'recorded', true, 'phase', v_new.phase);
end;
$$;

-- A finish request arrives. Its receipt number is taken here, under the match lock, before anything is checked.
-- Idempotent per request key; a player has at most one finish being checked at a time.
create or replace function public.number_receive_finish(p_match_id uuid, p_user_id uuid, p_request_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
  v_a number_trail_assignments;
  v_t number_trail_finish_attempts;
  v_now timestamptz;
begin
  if p_request_key is null or char_length(p_request_key) not between 8 and 80 then raise exception 'bad_request'; end if;
  select * into v_match from number_trail_matches where id = p_match_id for update;
  if v_match.id is null then raise exception 'match_not_found'; end if;
  v_match.status := number_tick(p_match_id);
  -- Taken after the lock, so receipt order and receipt time agree.
  v_now := clock_timestamp();
  select * into v_a from number_trail_assignments where match_id = p_match_id and user_id = p_user_id;
  if v_a.user_id is null then raise exception 'not_in_match'; end if;

  select * into v_t from number_trail_finish_attempts where match_id = p_match_id and user_id = p_user_id and request_key = p_request_key;
  if v_t.id is not null then return to_jsonb(v_t) || jsonb_build_object('repeated', true, 'startsAt', v_match.starts_at, 'matchStatus', v_match.status); end if;

  if v_a.status = 'finished' then raise exception 'already_finished'; end if;
  if v_a.status = 'left' then raise exception 'not_in_room'; end if;
  if not exists (select 1 from room_members where room_id = v_match.room_id and user_id = p_user_id and left_at is null and not removed) then raise exception 'not_in_room'; end if;
  if v_match.status = 'completed' then raise exception 'match_completed'; end if;
  if v_match.status = 'cancelled' then raise exception 'match_cancelled'; end if;
  if v_match.status not in ('active', 'verifying') then raise exception 'match_not_active'; end if;
  if v_now >= v_match.ends_at then raise exception 'match_over'; end if;

  select * into v_t from number_trail_finish_attempts where match_id = p_match_id and user_id = p_user_id and status = 'pending';
  if v_t.id is not null then return to_jsonb(v_t) || jsonb_build_object('repeated', true, 'startsAt', v_match.starts_at, 'matchStatus', v_match.status); end if;
  if exists (select 1 from number_trail_finish_attempts where match_id = p_match_id and user_id = p_user_id and received_at > v_now - interval '5 seconds') then
    raise exception 'slow_down';
  end if;
  if (select count(*) from number_trail_finish_attempts where match_id = p_match_id and user_id = p_user_id) >= 20 then raise exception 'too_many_attempts'; end if;

  insert into number_trail_finish_attempts (match_id, user_id, request_key, receipt_seq, received_at, verify_started_at)
  values (p_match_id, p_user_id, p_request_key, nextval('number_trail_receipt_seq'), v_now, v_now)
  returning * into v_t;
  update number_trail_progress set phase = 'FINISH_PENDING_VERIFICATION' where match_id = p_match_id and user_id = p_user_id;
  if v_match.status = 'active' then perform number_transition(p_match_id, 'verifying'); end if;
  perform number_event(p_match_id, 'FINISH_VERIFYING', p_user_id, jsonb_build_object('receiptSeq', v_t.receipt_seq));
  return to_jsonb(v_t) || jsonb_build_object('repeated', false, 'startsAt', v_match.starts_at, 'matchStatus', 'verifying');
end;
$$;

-- A check that never reported back (the function stopped, the phone retried) may be run again after a minute.
create or replace function public.number_claim_verification(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t number_trail_finish_attempts;
begin
  update number_trail_finish_attempts set verify_started_at = clock_timestamp(), verify_count = verify_count + 1
  where id = p_attempt_id and status = 'pending' and verify_started_at < clock_timestamp() - interval '60 seconds'
  returning * into v_t;
  if v_t.id is null then return null; end if;
  return to_jsonb(v_t) || jsonb_build_object('startsAt', (select starts_at from number_trail_matches where id = v_t.match_id));
end;
$$;

create or replace function public.number_stale_attempts(p_match_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from number_trail_finish_attempts
  where match_id = p_match_id and status = 'pending' and verify_started_at < clock_timestamp() - interval '60 seconds'
  order by receipt_seq limit 2;
$$;

-- Places verified finishes in receipt order, stopping at the first receipt still being checked. The first placed
-- finish wins and completes the match. When nothing is left to check after completion, everyone else is ranked and
-- the results are final. Called with the match locked.
create or replace function public.number_settle_order(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match number_trail_matches;
  v_t number_trail_finish_attempts;
  v_next integer;
  v_pending boolean;
  v_photo boolean;
  v_finishers integer;
begin
  select * into v_match from number_trail_matches where id = p_match_id;
  if v_match.status not in ('active', 'verifying', 'completed') then return; end if;
  select coalesce(max(finish_order), 0) into v_next from number_trail_results where match_id = p_match_id;

  for v_t in select * from number_trail_finish_attempts where match_id = p_match_id and status <> 'rejected' and status <> 'expired' order by receipt_seq loop
    exit when v_t.status = 'pending';
    if v_t.finish_order is not null or exists (select 1 from number_trail_results where match_id = p_match_id and user_id = v_t.user_id) then continue; end if;
    v_next := v_next + 1;
    update number_trail_finish_attempts set finish_order = v_next where id = v_t.id;
    update number_trail_assignments set status = 'finished' where match_id = p_match_id and user_id = v_t.user_id;
    update number_trail_progress set phase = 'VERIFIED_COMPLETE', digits_done = 2 where match_id = p_match_id and user_id = v_t.user_id;
    insert into number_trail_results (match_id, user_id, placement, finish_order, finished, is_winner, receipt_seq, received_at, elapsed_ms, digits_done, coverage)
    values (p_match_id, v_t.user_id, v_next, v_next, true, v_next = 1, v_t.receipt_seq, v_t.received_at,
      (extract(epoch from (v_t.received_at - v_match.starts_at)) * 1000)::integer, 2, 1);
    perform number_event(p_match_id, 'PLAYER_FINISHED', v_t.user_id, jsonb_build_object('placement', v_next, 'elapsedMs', (extract(epoch from (v_t.received_at - v_match.starts_at)) * 1000)::integer));
    if v_next = 1 then
      update number_trail_matches set winner_user_id = v_t.user_id, outcome = 'winner' where id = p_match_id;
      if v_match.status <> 'completed' then perform number_transition(p_match_id, 'completed'); end if;
      v_match.status := 'completed';
      perform number_event(p_match_id, 'MATCH_COMPLETED', v_t.user_id, jsonb_build_object('winnerUserId', v_t.user_id, 'number', v_match.target_number, 'outcome', 'winner'));
    end if;
  end loop;

  select exists (select 1 from number_trail_finish_attempts where match_id = p_match_id and status = 'pending') into v_pending;
  if v_match.status = 'verifying' and not v_pending then
    if clock_timestamp() >= v_match.ends_at then
      perform number_transition(p_match_id, 'completed');
      update number_trail_matches set outcome = 'no_finisher' where id = p_match_id;
      perform number_event(p_match_id, 'MATCH_COMPLETED', null, jsonb_build_object('winnerUserId', null, 'number', v_match.target_number, 'outcome', 'no_finisher'));
      v_match.status := 'completed';
    else
      perform number_transition(p_match_id, 'active');
      v_match.status := 'active';
    end if;
  elsif v_match.status = 'active' and clock_timestamp() >= v_match.ends_at then
    perform number_transition(p_match_id, 'completed');
    update number_trail_matches set outcome = 'no_finisher' where id = p_match_id;
    perform number_event(p_match_id, 'MATCH_COMPLETED', null, jsonb_build_object('winnerUserId', null, 'number', v_match.target_number, 'outcome', 'no_finisher'));
    v_match.status := 'completed';
  end if;

  if v_match.status = 'completed' and not v_pending and v_match.finalized_at is null then
    select count(*) into v_finishers from number_trail_results where match_id = p_match_id;
    insert into number_trail_results (match_id, user_id, placement, finish_order, finished, is_winner, digits_done, coverage)
    select p_match_id, a.user_id,
      v_finishers + rank() over (order by coalesce(p.digits_done, 0) desc, coalesce(p.coverage, 0) desc),
      null, false, false, coalesce(p.digits_done, 0), coalesce(p.coverage, 0)
    from number_trail_assignments a left join number_trail_progress p using (match_id, user_id)
    where a.match_id = p_match_id and not exists (select 1 from number_trail_results r where r.match_id = p_match_id and r.user_id = a.user_id);
    select (count(*) filter (where r.finish_order = 2) > 0 and max(r.received_at) filter (where r.finish_order = 2) - max(r.received_at) filter (where r.finish_order = 1) < interval '2 seconds')
      into v_photo from number_trail_results r where r.match_id = p_match_id;
    update number_trail_matches set finalized_at = clock_timestamp(), result = jsonb_build_object(
      'number', target_number, 'outcome', outcome, 'winnerUserId', winner_user_id, 'photoFinish', coalesce(v_photo, false),
      'finishers', (select count(*) from number_trail_results where match_id = p_match_id and finished),
      'players', (select count(*) from number_trail_assignments where match_id = p_match_id))
    where id = p_match_id;
    perform number_close_walks(p_match_id, 'submitted');
    update multiplayer_rooms set status = 'finished' where id = v_match.room_id and status = 'playing';
    perform number_event(p_match_id, 'RESULTS_FINAL', null, jsonb_build_object('photoFinish', coalesce(v_photo, false)));
  end if;
end;
$$;

-- The check of a finish reports back. Verified finishes are placed in receipt order; the first one wins.
create or replace function public.number_settle_finish(
  p_attempt_id uuid,
  p_verified boolean,
  p_reason text,
  p_through_seq integer,
  p_track_hash text,
  p_verdict jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t number_trail_finish_attempts;
  v_match number_trail_matches;
  v_verified boolean := coalesce(p_verified, false);
  v_reason text := p_reason;
  v_earlier integer;
begin
  select match_id into v_t.match_id from number_trail_finish_attempts where id = p_attempt_id;
  if v_t.match_id is null then raise exception 'attempt_not_found'; end if;
  select * into v_match from number_trail_matches where id = v_t.match_id for update;
  select * into v_t from number_trail_finish_attempts where id = p_attempt_id for update;
  if v_t.status = 'pending' then
    -- The same recorded walk can't win twice: an identical track already verified in another match is a replay.
    if v_verified and p_track_hash is not null and exists (
      select 1 from number_trail_finish_attempts o where o.track_hash = p_track_hash and o.status = 'verified' and o.match_id <> v_t.match_id
    ) then
      v_verified := false;
      v_reason := 'replayed_walk';
    end if;
    update number_trail_finish_attempts set status = case when v_verified then 'verified' else 'rejected' end,
      reason = case when v_verified then null else coalesce(v_reason, 'not_complete') end,
      through_seq = p_through_seq, track_hash = p_track_hash, verdict = p_verdict, settled_at = clock_timestamp()
    where id = p_attempt_id;
    if not v_verified then
      update number_trail_progress set phase = 'INVALID_COMPLETION' where match_id = v_t.match_id and user_id = v_t.user_id;
      perform number_event(v_t.match_id, 'FINISH_REJECTED', v_t.user_id, jsonb_build_object('reason', coalesce(v_reason, 'not_complete')));
    end if;
    perform number_settle_order(v_t.match_id);
  end if;
  select * into v_t from number_trail_finish_attempts where id = p_attempt_id;
  select * into v_match from number_trail_matches where id = v_t.match_id;
  select count(*) into v_earlier from number_trail_finish_attempts where match_id = v_t.match_id and status = 'pending' and receipt_seq < v_t.receipt_seq;
  return jsonb_build_object(
    'attemptId', v_t.id, 'status', v_t.status, 'reason', v_t.reason, 'receiptSeq', v_t.receipt_seq, 'finishOrder', v_t.finish_order,
    'matchStatus', v_match.status, 'winnerUserId', v_match.winner_user_id, 'waitingOnEarlier', v_earlier,
    'placement', (select placement from number_trail_results where match_id = v_t.match_id and user_id = v_t.user_id));
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- What a player may see
-- ---------------------------------------------------------------------------------------------------------------

-- The canonical match as the caller may see it: no one else's coordinates, ever. Events after p_after_seq (at most
-- 50) let a phone that missed broadcasts catch up; anything older is already reflected in the rest.
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
  v_revealed := v_match.status in ('ready', 'countdown', 'active', 'verifying', 'completed') or (v_match.status = 'cancelled' and v_match.starts_at is not null);
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
    'course', case when v_revealed then (select c.course from number_trail_courses c where c.match_id = p_match_id) end,
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
    'lastSeq', v_match.seq
  );
end;
$$;

-- The stored course and the race clock, for the edge function's checks.
create or replace function public.number_course(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('course', c.course, 'startsAt', m.starts_at, 'endsAt', m.ends_at, 'status', m.status)
  from number_trail_matches m join number_trail_courses c on c.match_id = m.id where m.id = p_match_id;
$$;

-- The room's current match (live, else the latest), for a phone opening the room.
create or replace function public.number_room_match(p_room_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.id from number_trail_matches m
  where m.room_id = p_room_id and (is_room_member(p_room_id) or exists (select 1 from number_trail_assignments a where a.match_id = m.id and a.user_id = auth.uid()))
  order by (m.status not in ('completed', 'cancelled')) desc, m.created_at desc limit 1;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------------------------------------------

-- Raw points of Number Trail walks go 30 days after the match ends. Results stay. Expired plans go too.
-- Schedule daily with pg_cron where available:
--   select cron.schedule('purge-number-trail', '25 3 * * *', $$select public.purge_number_trail(30)$$);
create or replace function public.purge_number_trail(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with gone as (
    delete from gps_points p using gps_sessions s, number_trail_matches m
    where p.session_id = s.id and s.number_match_id = m.id and m.status in ('completed', 'cancelled')
      and m.completed_at < now() - make_interval(days => greatest(p_days, 1))
    returning 1
  )
  select count(*) into v_count from gone;
  delete from number_trail_plan_cache where expires_at < now();
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Who may call what
-- ---------------------------------------------------------------------------------------------------------------

revoke execute on function public.number_event(uuid, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.number_transition(uuid, text) from public, anon, authenticated;
revoke execute on function public.number_tick(uuid) from public, anon, authenticated;
revoke execute on function public.number_room_host(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.number_close_walks(uuid, text) from public, anon, authenticated;
revoke execute on function public.number_cancel_locked(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.number_begin_prepare(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.number_prepare_failed(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.number_record_course(uuid, uuid, jsonb, jsonb, jsonb, text, integer) from public, anon, authenticated;
revoke execute on function public.number_plan_cache_get(text) from public, anon, authenticated;
revoke execute on function public.number_plan_cache_put(text, text, text, integer, text, text, jsonb, jsonb, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.number_begin_walk(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.number_walk_context(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.number_store_points(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.number_points(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.number_record_progress(uuid, uuid, text, integer, numeric, jsonb, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.number_receive_finish(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.number_claim_verification(uuid) from public, anon, authenticated;
revoke execute on function public.number_stale_attempts(uuid) from public, anon, authenticated;
revoke execute on function public.number_settle_order(uuid) from public, anon, authenticated;
revoke execute on function public.number_settle_finish(uuid, boolean, text, integer, text, jsonb) from public, anon, authenticated;
revoke execute on function public.purge_number_trail(integer) from public, anon, authenticated;
revoke execute on function public.number_course(uuid) from public, anon, authenticated;
-- Players: host actions check the host themselves; reads check membership.
revoke execute on function public.number_create_match(uuid, integer, text) from anon;
revoke execute on function public.number_set_settings(uuid, integer, text, integer) from anon;
revoke execute on function public.number_start(uuid) from anon;
revoke execute on function public.number_cancel(uuid) from anon;
revoke execute on function public.number_advance(uuid) from anon;
revoke execute on function public.number_race_state(uuid, bigint, uuid) from anon;
revoke execute on function public.number_room_match(uuid) from anon;
revoke execute on function public.is_number_member(uuid) from anon;
revoke execute on function public.number_member_of(uuid, uuid) from public, anon, authenticated;
