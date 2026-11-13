-- PAWS Tournament, phase 2: Follow the Shape (online), the shared nearby room system, and Find the Mafia.
--
-- Same trust model as phase 1. Players never write scores, roles, results or other people's data directly:
--   shapes        scored by the `tournament` edge function, recorded through record_shape_submission()
--   rooms         created, joined and left through the functions below, which lock the room row so capacity and
--                 host-only actions are atomic
--   Find the Mafia roles, checkpoints, objectives and results are written by the `rooms` edge function; votes go
--                 through cast_mafia_vote(), which checks the server clock
-- Every change to a room bumps its version and sends a broadcast with no private content (just "something changed")
-- to the room's private Realtime channel; clients then ask the server for the state they are allowed to see.

-- ---------------------------------------------------------------------------------------------------------------
-- Follow the Shape
-- ---------------------------------------------------------------------------------------------------------------

-- Target shapes as normalized vector paths (y up, about -1 to 1). Generated together with
-- supabase/functions/tournament/shapes.ts so the phone and the server use identical geometry.
create table public.shape_presets (
  key text primary key,
  name text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  closed boolean not null,
  min_distance_m integer not null check (min_distance_m >= 100),
  points jsonb not null
);

insert into public.shape_presets (key, name, difficulty, closed, min_distance_m, points) values
  ('triangle', 'Triangle', 'easy', true, 300, '[[0, 1], [0.866, -0.5], [-0.866, -0.5]]'::jsonb),
  ('square', 'Square', 'easy', true, 300, '[[-1, 1], [1, 1], [1, -1], [-1, -1]]'::jsonb),
  ('heart', 'Heart', 'medium', true, 500, '[[0.0, 0.2941], [0.0049, 0.3298], [0.0377, 0.4242], [0.1176, 0.5446], [0.25, 0.6488], [0.4231, 0.6998], [0.6113, 0.6765], [0.781, 0.5785], [0.8989, 0.4229], [0.9412, 0.2353], [0.8989, 0.0397], [0.781, -0.1483], [0.6113, -0.3235], [0.4231, -0.4871], [0.25, -0.6404], [0.1176, -0.7799], [0.0377, -0.8953], [0.0049, -0.9726], [0.0, -1.0], [-0.0049, -0.9726], [-0.0377, -0.8953], [-0.1176, -0.7799], [-0.25, -0.6404], [-0.4231, -0.4871], [-0.6113, -0.3235], [-0.781, -0.1483], [-0.8989, 0.0397], [-0.9412, 0.2353], [-0.8989, 0.4229], [-0.781, 0.5785], [-0.6113, 0.6765], [-0.4231, 0.6998], [-0.25, 0.6488], [-0.1176, 0.5446], [-0.0377, 0.4242], [-0.0049, 0.3298]]'::jsonb),
  ('lightning', 'Lightning bolt', 'medium', false, 400, '[[0.25, 1], [-0.35, 0.05], [0.2, 0.05], [-0.25, -1]]'::jsonb),
  ('star', 'Star', 'hard', true, 700, '[[0.0, 1.0], [-0.2351, 0.3236], [-0.9511, 0.309], [-0.3804, -0.1236], [-0.5878, -0.809], [-0.0, -0.4], [0.5878, -0.809], [0.3804, -0.1236], [0.9511, 0.309], [0.2351, 0.3236]]'::jsonb),
  ('letter_s', 'Letter S', 'hard', false, 500, '[[0.4698, 0.671], [0.3783, 0.8269], [0.2373, 0.9401], [0.0653, 0.9957], [-0.1153, 0.9865], [-0.2808, 0.9137], [-0.4096, 0.7868], [-0.4848, 0.6224], [-0.4966, 0.442], [-0.4435, 0.2691], [-0.3324, 0.1265], [-0.1778, 0.0327], [-0.0, 0.0], [0.1778, -0.0327], [0.3324, -0.1265], [0.4435, -0.2691], [0.4966, -0.442], [0.4848, -0.6224], [0.4096, -0.7868], [0.2808, -0.9137], [0.1153, -0.9865], [-0.0653, -0.9957], [-0.2373, -0.9401], [-0.3783, -0.8269], [-0.4698, -0.671]]'::jsonb);

-- One target per Follow the Shape tournament. The geometry and scoring rules are copied in when the challenge is
-- made, and the algorithm version is fixed, so later changes to presets or scoring never rewrite past results.
create table public.shape_challenges (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null unique references public.tournaments(id) on delete cascade,
  shape_key text not null references public.shape_presets(key),
  name text not null,
  difficulty text not null,
  closed boolean not null,
  min_distance_m integer not null,
  points jsonb not null,
  rules jsonb not null default '{}'::jsonb,
  algorithm_version text not null default 'frechet-v1',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.shape_submissions (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.shape_challenges(id) on delete cascade,
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  session_id uuid not null unique references public.gps_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  score numeric(4, 1) not null check (score between 0 and 100),
  frechet double precision not null,
  algorithm_version text not null,
  -- The route normalised and turned onto the target (unit-less, no coordinates), for drawing the comparison.
  route_normalized jsonb not null,
  target_normalized jsonb not null,
  distance_m double precision not null,
  elapsed_seconds integer not null,
  validation_status text not null default 'valid' check (validation_status in ('valid', 'flagged')),
  submitted_at timestamptz not null default timezone('utc', now())
);
create index shape_submissions_board_idx on public.shape_submissions (tournament_id, score desc, submitted_at asc);
create index shape_submissions_user_idx on public.shape_submissions (user_id, tournament_id);

alter table public.shape_presets enable row level security;
alter table public.shape_challenges enable row level security;
alter table public.shape_submissions enable row level security;
create policy shape_presets_read on public.shape_presets for select to authenticated using (true);
create policy shape_challenges_read on public.shape_challenges for select to authenticated using (true);
create policy shape_submissions_read_own on public.shape_submissions for select to authenticated using (user_id = auth.uid());

create or replace function public.create_shape_challenge(p_tournament_id uuid, p_shape_key text)
returns public.shape_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  v_t tournaments;
  v_p shape_presets;
  v_row shape_challenges;
begin
  if not is_tournament_organizer() then raise exception 'not_an_organizer'; end if;
  select * into v_t from tournaments where id = p_tournament_id;
  if v_t.id is null or v_t.game_type <> 'follow_shape' then raise exception 'not_a_shape_tournament'; end if;
  select * into v_p from shape_presets where key = p_shape_key;
  if v_p.key is null then raise exception 'unknown_shape'; end if;
  insert into shape_challenges (tournament_id, shape_key, name, difficulty, closed, min_distance_m, points)
  values (v_t.id, v_p.key, v_p.name, v_p.difficulty, v_p.closed, v_p.min_distance_m, v_p.points)
  on conflict (tournament_id) do update set shape_key = excluded.shape_key, name = excluded.name, difficulty = excluded.difficulty,
    closed = excluded.closed, min_distance_m = excluded.min_distance_m, points = excluded.points
  where not exists (select 1 from shape_submissions s where s.tournament_id = v_t.id)
  returning * into v_row;
  if v_row.id is null then raise exception 'challenge_has_results'; end if;
  return v_row;
end;
$$;
revoke execute on function public.create_shape_challenge(uuid, text) from anon;

-- Called only by the edge function after it scores the walk. Idempotent per walk.
create or replace function public.record_shape_submission(
  p_session_id uuid,
  p_score numeric,
  p_frechet double precision,
  p_algorithm text,
  p_route jsonb,
  p_target jsonb,
  p_distance_m double precision,
  p_elapsed_seconds integer
)
returns public.shape_submissions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session gps_sessions;
  v_challenge shape_challenges;
  v_row shape_submissions;
begin
  select * into v_row from shape_submissions where session_id = p_session_id;
  if v_row.id is not null then return v_row; end if;
  select * into v_session from gps_sessions where id = p_session_id for update;
  if v_session.id is null then raise exception 'session_not_found'; end if;
  if v_session.status not in ('active', 'paused') then raise exception 'session_closed'; end if;
  select * into v_challenge from shape_challenges where tournament_id = v_session.tournament_id;
  if v_challenge.id is null then raise exception 'no_challenge'; end if;
  if p_algorithm <> v_challenge.algorithm_version then raise exception 'algorithm_mismatch'; end if;

  insert into shape_submissions (challenge_id, tournament_id, session_id, user_id, dog_id, score, frechet, algorithm_version,
    route_normalized, target_normalized, distance_m, elapsed_seconds)
  values (v_challenge.id, v_session.tournament_id, v_session.id, v_session.user_id, v_session.dog_id, p_score, p_frechet, p_algorithm,
    p_route, p_target, p_distance_m, p_elapsed_seconds)
  returning * into v_row;

  update gps_sessions set status = 'submitted', ended_at = timezone('utc', now()), total_distance_m = p_distance_m,
    elapsed_seconds = p_elapsed_seconds, validation_status = 'valid'
  where id = v_session.id;
  return v_row;
end;
$$;
revoke execute on function public.record_shape_submission(uuid, numeric, double precision, text, jsonb, jsonb, double precision, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- Nearby rooms (shared by Find the Mafia and the later nearby games)
-- ---------------------------------------------------------------------------------------------------------------

create table public.multiplayer_rooms (
  id uuid primary key default gen_random_uuid(),
  game_type public.tournament_game not null check (game_type in ('find_mafia', 'steal_territory', 'steal_road')),
  name text not null check (char_length(name) between 2 and 40),
  host_id uuid not null references auth.users(id) on delete cascade,
  max_players integer not null check (max_players between 2 and 10),
  team_mode boolean not null default false,
  start_delay_s integer not null default 10 check (start_delay_s between 0 and 120),
  status text not null default 'open' check (status in ('open', 'playing', 'finished', 'cancelled')),
  -- What players type to join: six characters, no 0/O or 1/I.
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  version bigint not null default 0,
  safety_ack_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default timezone('utc', now()) + interval '6 hours',
  check (game_type <> 'find_mafia' or max_players >= 4)
);
create index multiplayer_rooms_host_idx on public.multiplayer_rooms (host_id, status);

create table public.room_members (
  room_id uuid not null references public.multiplayer_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid references public.dogs(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 40),
  ready boolean not null default false,
  joined_at timestamptz not null default timezone('utc', now()),
  left_at timestamptz,
  removed boolean not null default false,
  primary key (room_id, user_id)
);
create index room_members_user_idx on public.room_members (user_id) where left_at is null;

-- Invitation tokens for QR codes and links. Only a hash is stored; the token itself is shown once, to the host.
create table public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.multiplayer_rooms(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.multiplayer_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_invites enable row level security;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from room_members where room_id = p_room_id and user_id = auth.uid() and left_at is null);
$$;

create policy multiplayer_rooms_read_members on public.multiplayer_rooms for select to authenticated using (is_room_member(id));
create policy room_members_read_members on public.room_members for select to authenticated using (is_room_member(room_id));
-- room_invites: no policies. Only the functions below touch them.

-- Something changed in this room: bump its version and tell the room's private channel, with nothing secret in it.
create or replace function public.room_changed(p_room_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version bigint;
begin
  update multiplayer_rooms set version = version + 1 where id = p_room_id returning version into v_version;
  begin
    perform realtime.send(
      jsonb_build_object('roomId', p_room_id, 'version', v_version, 'kind', p_kind, 'eventId', gen_random_uuid(), 'at', timezone('utc', now())),
      'changed',
      'room:' || p_room_id,
      true
    );
  exception when others then
    -- Realtime unavailable: clients still catch up on their next fetch.
    null;
  end;
end;
$$;
revoke execute on function public.room_changed(uuid, text) from public, anon, authenticated;

create or replace function public.trg_room_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform room_changed(coalesce(new.room_id, old.room_id), tg_table_name);
  return null;
end;
$$;

create or replace function public.trg_room_row_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform room_changed(new.id, 'room');
  return null;
end;
$$;

create trigger room_members_changed after insert or update on public.room_members for each row execute function public.trg_room_changed();
create trigger multiplayer_rooms_changed after update of status, host_id, name on public.multiplayer_rooms for each row execute function public.trg_room_row_changed();

create or replace function public.make_room_code()
returns text
language plpgsql
set search_path = public, extensions
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := extensions.gen_random_bytes(6);
  v_code text := '';
begin
  for i in 0..5 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- A fresh invitation for the room. The raw token is returned once and never stored.
create or replace function public.issue_room_invite(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room multiplayer_rooms;
  v_token text := translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/=', '-_');
  v_expires timestamptz := timezone('utc', now()) + interval '30 minutes';
begin
  select * into v_room from multiplayer_rooms where id = p_room_id;
  if v_room.id is null or v_room.host_id <> auth.uid() then raise exception 'not_the_host'; end if;
  if v_room.status <> 'open' then raise exception 'room_closed'; end if;
  insert into room_invites (room_id, token_hash, expires_at, created_by)
  values (p_room_id, extensions.digest(v_token, 'sha256'), v_expires, auth.uid());
  return jsonb_build_object('token', v_token, 'expiresAt', v_expires, 'code', v_room.code);
end;
$$;
revoke execute on function public.issue_room_invite(uuid) from anon;

create or replace function public.create_room(
  p_game public.tournament_game,
  p_name text,
  p_max_players integer,
  p_team_mode boolean,
  p_start_delay_s integer,
  p_safety_ack boolean,
  p_dog_id uuid,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room multiplayer_rooms;
  v_code text;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not coalesce(p_safety_ack, false) then raise exception 'safety_not_acknowledged'; end if;
  if p_dog_id is not null and not owns_dog(p_dog_id) then raise exception 'not_your_dog'; end if;
  if exists (
    select 1 from room_members m join multiplayer_rooms r on r.id = m.room_id
    where m.user_id = auth.uid() and m.left_at is null and r.status in ('open', 'playing') and r.expires_at > now()
  ) then raise exception 'already_in_room'; end if;

  for i in 1..8 loop
    v_code := make_room_code();
    begin
      insert into multiplayer_rooms (game_type, name, host_id, max_players, team_mode, start_delay_s, code, safety_ack_at)
      values (p_game, btrim(p_name), auth.uid(), p_max_players, coalesce(p_team_mode, false), coalesce(p_start_delay_s, 10), v_code, timezone('utc', now()))
      returning * into v_room;
      exit;
    exception when unique_violation then
      v_room := null;
    end;
  end loop;
  if v_room.id is null then raise exception 'code_unavailable'; end if;

  insert into room_members (room_id, user_id, dog_id, display_name, ready)
  values (v_room.id, auth.uid(), p_dog_id, left(btrim(p_display_name), 40), true);
  return jsonb_build_object('roomId', v_room.id, 'code', v_room.code) || issue_room_invite(v_room.id);
end;
$$;
revoke execute on function public.create_room(public.tournament_game, text, integer, boolean, integer, boolean, uuid, text) from anon;

-- Join by invitation token (from a QR code or link) or by the room code. The room row is locked, so two people
-- taking the last place at once cannot both get in. Joining a room you are already in changes nothing.
create or replace function public.join_room(p_code text, p_token text, p_dog_id uuid, p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room_id uuid;
  v_room multiplayer_rooms;
  v_member room_members;
  v_active integer;
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if p_dog_id is not null and not owns_dog(p_dog_id) then raise exception 'not_your_dog'; end if;

  if p_token is not null and length(p_token) > 0 then
    select room_id into v_room_id from room_invites
    where token_hash = extensions.digest(p_token, 'sha256') and not revoked and expires_at > now();
    if v_room_id is null then raise exception 'invite_expired'; end if;
  else
    select id into v_room_id from multiplayer_rooms where code = upper(btrim(coalesce(p_code, '')));
    if v_room_id is null then raise exception 'room_not_found'; end if;
  end if;

  select * into v_room from multiplayer_rooms where id = v_room_id for update;
  if v_room.status <> 'open' or v_room.expires_at <= now() then raise exception 'room_closed'; end if;

  select * into v_member from room_members where room_id = v_room.id and user_id = auth.uid();
  if v_member.user_id is not null and v_member.removed then raise exception 'removed_from_room'; end if;
  if v_member.user_id is not null and v_member.left_at is null then
    return jsonb_build_object('roomId', v_room.id, 'alreadyIn', true);
  end if;
  if exists (
    select 1 from room_members m join multiplayer_rooms r on r.id = m.room_id
    where m.user_id = auth.uid() and m.left_at is null and r.id <> v_room.id and r.status in ('open', 'playing') and r.expires_at > now()
  ) then raise exception 'already_in_room'; end if;

  select count(*) into v_active from room_members where room_id = v_room.id and left_at is null;
  if v_active >= v_room.max_players then raise exception 'room_full'; end if;

  insert into room_members (room_id, user_id, dog_id, display_name, ready, joined_at, left_at)
  values (v_room.id, auth.uid(), p_dog_id, left(btrim(p_display_name), 40), false, timezone('utc', now()), null)
  on conflict (room_id, user_id) do update set left_at = null, ready = false, joined_at = timezone('utc', now()),
    dog_id = excluded.dog_id, display_name = excluded.display_name;
  return jsonb_build_object('roomId', v_room.id, 'alreadyIn', false);
end;
$$;
revoke execute on function public.join_room(text, text, uuid, text) from anon;

-- Leave a room. A leaving host hands the room to whoever joined earliest; an empty room is cancelled.
create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room multiplayer_rooms;
  v_next uuid;
begin
  select * into v_room from multiplayer_rooms where id = p_room_id for update;
  if v_room.id is null then return; end if;
  update room_members set left_at = timezone('utc', now()), ready = false
  where room_id = p_room_id and user_id = auth.uid() and left_at is null;
  if v_room.host_id = auth.uid() then
    select user_id into v_next from room_members where room_id = p_room_id and left_at is null order by joined_at, user_id limit 1;
    if v_next is null then
      update multiplayer_rooms set status = 'cancelled' where id = p_room_id and status in ('open', 'playing');
    else
      update multiplayer_rooms set host_id = v_next where id = p_room_id;
    end if;
  end if;
end;
$$;
revoke execute on function public.leave_room(uuid) from anon;

create or replace function public.set_room_ready(p_room_id uuid, p_ready boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update room_members set ready = coalesce(p_ready, false)
  where room_id = p_room_id and user_id = auth.uid() and left_at is null
    and exists (select 1 from multiplayer_rooms r where r.id = p_room_id and r.status = 'open');
  if not found then raise exception 'not_in_open_room'; end if;
end;
$$;
revoke execute on function public.set_room_ready(uuid, boolean) from anon;

create or replace function public.remove_room_member(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from multiplayer_rooms where id = p_room_id and host_id = auth.uid()) then raise exception 'not_the_host'; end if;
  if p_user_id = auth.uid() then raise exception 'cannot_remove_self'; end if;
  update room_members set left_at = timezone('utc', now()), removed = true, ready = false
  where room_id = p_room_id and user_id = p_user_id and left_at is null;
end;
$$;
revoke execute on function public.remove_room_member(uuid, uuid) from anon;

create or replace function public.cancel_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update multiplayer_rooms set status = 'cancelled' where id = p_room_id and host_id = auth.uid() and status in ('open', 'playing');
  if not found then raise exception 'not_the_host'; end if;
  update mafia_rounds set status = 'cancelled', finished_at = timezone('utc', now())
  where room_id = p_room_id and status not in ('finished', 'cancelled');
  update room_invites set revoked = true where room_id = p_room_id;
end;
$$;

-- Back to the lobby after a round: everyone not ready, the room open again.
create or replace function public.reopen_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update multiplayer_rooms set status = 'open', expires_at = greatest(expires_at, timezone('utc', now()) + interval '2 hours')
  where id = p_room_id and host_id = auth.uid() and status = 'finished';
  if not found then raise exception 'not_the_host'; end if;
  update room_members set ready = (user_id = auth.uid()) where room_id = p_room_id and left_at is null;
end;
$$;

-- Room broadcasts go to private channels named room:<id>. Members may listen and share presence; nobody but the
-- server may broadcast, so no client can fake a phase change or a result.
create or replace function public.is_room_topic_member(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_topic is null or p_topic not like 'room:%' then return false; end if;
  begin
    v_id := substr(p_topic, 6)::uuid;
  exception when others then
    return false;
  end;
  return is_room_member(v_id);
end;
$$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'realtime' and table_name = 'messages') then
    execute $p$create policy paws_room_members_listen on realtime.messages for select to authenticated
      using (public.is_room_topic_member(realtime.topic()) and realtime.messages.extension in ('broadcast', 'presence'))$p$;
    execute $p$create policy paws_room_members_presence on realtime.messages for insert to authenticated
      with check (public.is_room_topic_member(realtime.topic()) and realtime.messages.extension = 'presence')$p$;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Find the Mafia
-- ---------------------------------------------------------------------------------------------------------------

-- The host's plan for the next round. Only the host can read it; it is copied into the round when it starts.
create table public.mafia_setups (
  room_id uuid primary key references public.multiplayer_rooms(id) on delete cascade,
  meet_lat double precision check (meet_lat between -90 and 90),
  meet_lng double precision check (meet_lng between -180 and 180),
  checkpoints jsonb not null default '[]'::jsonb,
  civilian_objective text not null default '' check (char_length(civilian_objective) <= 300),
  mafia_objective text not null default '' check (char_length(mafia_objective) <= 300),
  settings jsonb not null default '{}'::jsonb,
  confirmed_safe boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.mafia_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.multiplayer_rooms(id) on delete cascade,
  status text not null default 'walking' check (status in ('walking', 'discussion', 'voting', 'finished', 'cancelled')),
  settings jsonb not null,
  meet_lat double precision,
  meet_lng double precision,
  started_at timestamptz not null,
  walking_ends_at timestamptz not null,
  discussion_ends_at timestamptz not null,
  voting_ends_at timestamptz not null,
  finished_at timestamptz,
  -- Filled once, when the round finishes: who was the Mafia, the vote totals, who was accused, who won.
  result jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create unique index mafia_rounds_one_live_idx on public.mafia_rounds (room_id) where status in ('walking', 'discussion', 'voting');

create table public.mafia_role_assignments (
  round_id uuid not null references public.mafia_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('civilian', 'mafia')),
  primary key (round_id, user_id)
);
create unique index mafia_one_mafia_idx on public.mafia_role_assignments (round_id) where role = 'mafia';

create table public.mafia_objectives (
  round_id uuid not null references public.mafia_rounds(id) on delete cascade,
  role text not null check (role in ('civilian', 'mafia')),
  text text not null,
  primary key (round_id, role)
);

create table public.mafia_checkpoints (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.mafia_rounds(id) on delete cascade,
  number integer not null check (number between 1 and 20),
  label text not null check (char_length(label) between 1 and 40),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  audience text not null check (audience in ('all', 'civilian', 'mafia')),
  unique (round_id, number)
);

create table public.mafia_votes (
  round_id uuid not null references public.mafia_rounds(id) on delete cascade,
  voter_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  cast_at timestamptz not null default timezone('utc', now()),
  primary key (round_id, voter_id)
);

-- What a player's walk reached. The route itself is never stored, only which checkpoints and how far.
create table public.mafia_walk_reports (
  round_id uuid not null references public.mafia_rounds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reached integer[] not null default '{}',
  distance_m integer not null default 0,
  shared boolean not null default true,
  submitted_at timestamptz not null default timezone('utc', now()),
  primary key (round_id, user_id)
);

alter table public.mafia_setups enable row level security;
alter table public.mafia_rounds enable row level security;
alter table public.mafia_role_assignments enable row level security;
alter table public.mafia_objectives enable row level security;
alter table public.mafia_checkpoints enable row level security;
alter table public.mafia_votes enable row level security;
alter table public.mafia_walk_reports enable row level security;

create or replace function public.mafia_my_role(p_round_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from mafia_role_assignments where round_id = p_round_id and user_id = auth.uid();
$$;

create or replace function public.mafia_round_over(p_round_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from mafia_rounds where id = p_round_id and status in ('finished', 'cancelled'));
$$;

create or replace function public.mafia_round_member(p_round_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from mafia_rounds r join room_members m on m.room_id = r.room_id
    where r.id = p_round_id and m.user_id = auth.uid());
$$;

create policy mafia_setups_host on public.mafia_setups for select to authenticated
  using (exists (select 1 from multiplayer_rooms r where r.id = room_id and r.host_id = auth.uid()));
create policy mafia_rounds_members on public.mafia_rounds for select to authenticated using (is_room_member(room_id));
-- Your own role only, until the round is over.
create policy mafia_roles_own on public.mafia_role_assignments for select to authenticated
  using (user_id = auth.uid() or (mafia_round_over(round_id) and mafia_round_member(round_id)));
create policy mafia_objectives_own on public.mafia_objectives for select to authenticated
  using (mafia_round_member(round_id) and (role = mafia_my_role(round_id) or mafia_round_over(round_id)));
create policy mafia_checkpoints_visible on public.mafia_checkpoints for select to authenticated
  using (mafia_round_member(round_id) and (audience = 'all' or audience = mafia_my_role(round_id) or mafia_round_over(round_id)));
create policy mafia_votes_own on public.mafia_votes for select to authenticated using (voter_id = auth.uid());
create policy mafia_reports_own on public.mafia_walk_reports for select to authenticated using (user_id = auth.uid());

create or replace function public.trg_round_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room uuid;
begin
  if tg_table_name = 'mafia_rounds' then
    v_room := new.room_id;
  else
    select room_id into v_room from mafia_rounds where id = new.round_id;
  end if;
  -- Votes and walk reports only say that a count changed; never who voted for whom.
  perform room_changed(v_room, tg_table_name);
  return null;
end;
$$;
create trigger mafia_rounds_changed after insert or update on public.mafia_rounds for each row execute function public.trg_round_changed();
create trigger mafia_votes_changed after insert on public.mafia_votes for each row execute function public.trg_round_changed();
create trigger mafia_reports_changed after insert or update on public.mafia_walk_reports for each row execute function public.trg_round_changed();

create or replace function public.save_mafia_setup(
  p_room_id uuid,
  p_meet_lat double precision,
  p_meet_lng double precision,
  p_checkpoints jsonb,
  p_civilian_objective text,
  p_mafia_objective text,
  p_settings jsonb,
  p_confirmed_safe boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from multiplayer_rooms where id = p_room_id and host_id = auth.uid() and status = 'open' and game_type = 'find_mafia') then
    raise exception 'not_the_host';
  end if;
  if jsonb_typeof(p_checkpoints) <> 'array' or jsonb_array_length(p_checkpoints) > 8 then raise exception 'bad_checkpoints'; end if;
  insert into mafia_setups (room_id, meet_lat, meet_lng, checkpoints, civilian_objective, mafia_objective, settings, confirmed_safe, updated_at)
  values (p_room_id, p_meet_lat, p_meet_lng, p_checkpoints, left(coalesce(p_civilian_objective, ''), 300), left(coalesce(p_mafia_objective, ''), 300),
    coalesce(p_settings, '{}'::jsonb), coalesce(p_confirmed_safe, false), timezone('utc', now()))
  on conflict (room_id) do update set meet_lat = excluded.meet_lat, meet_lng = excluded.meet_lng, checkpoints = excluded.checkpoints,
    civilian_objective = excluded.civilian_objective, mafia_objective = excluded.mafia_objective, settings = excluded.settings,
    confirmed_safe = excluded.confirmed_safe, updated_at = excluded.updated_at;
  perform room_changed(p_room_id, 'setup');
end;
$$;
revoke execute on function public.save_mafia_setup(uuid, double precision, double precision, jsonb, text, text, jsonb, boolean) from anon;

-- One secret vote per player, only while voting is open on the server clock. A second vote is refused.
create or replace function public.cast_mafia_vote(p_round_id uuid, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_round mafia_rounds;
begin
  select * into v_round from mafia_rounds where id = p_round_id;
  if v_round.id is null then raise exception 'round_not_found'; end if;
  if v_round.status in ('finished', 'cancelled') or now() >= v_round.voting_ends_at then raise exception 'voting_closed'; end if;
  if now() < v_round.discussion_ends_at then raise exception 'voting_not_open'; end if;
  if not exists (select 1 from room_members where room_id = v_round.room_id and user_id = auth.uid() and left_at is null) then raise exception 'not_in_room'; end if;
  if not exists (select 1 from mafia_role_assignments where round_id = p_round_id and user_id = auth.uid()) then raise exception 'not_in_round'; end if;
  if not exists (select 1 from mafia_role_assignments where round_id = p_round_id and user_id = p_target_id) then raise exception 'bad_target'; end if;
  if p_target_id = auth.uid() and not coalesce((v_round.settings ->> 'allowSelfVote')::boolean, false) then raise exception 'no_self_vote'; end if;
  insert into mafia_votes (round_id, voter_id, target_id) values (p_round_id, auth.uid(), p_target_id)
  on conflict (round_id, voter_id) do nothing;
  if not found then raise exception 'already_voted'; end if;
end;
$$;
revoke execute on function public.cast_mafia_vote(uuid, uuid) from anon;

revoke execute on function public.cancel_room(uuid) from anon;
revoke execute on function public.reopen_room(uuid) from anon;
