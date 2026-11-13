-- Nearby rooms, room first.
--
--   * A room is made before its game is picked: "Make a room" opens the lobby, players join, and the host picks a game
--     on the games page (and can change it while the room is open and nothing is running).
--   * Who may start a game: the host, the player in first place, or the player in last place. Places come from the
--     wins recorded in this room (room_scores), never from the phone.
--   * Remote invite: joining by the six-character code (from anywhere) only while the host allows it. The QR code shown
--     in the room always works: you have to be there to scan it.

-- ---------------------------------------------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------------------------------------------

alter table public.multiplayer_rooms alter column game_type drop not null;
alter table public.multiplayer_rooms drop constraint if exists multiplayer_rooms_game_type_check;
alter table public.multiplayer_rooms add constraint multiplayer_rooms_game_type_check
  check (game_type is null or game_type in ('find_mafia', 'steal_territory', 'steal_road', 'number_trail'));
alter table public.multiplayer_rooms add column if not exists start_permission text not null default 'host'
  check (start_permission in ('host', 'first', 'last'));
-- Existing rooms, and rooms made for a game up front (Number Trail online, which is played apart), keep joining by
-- code. A room made the nearby way (no game yet) starts QR-only until its host allows remote invites.
alter table public.multiplayer_rooms add column if not exists remote_invite boolean not null default true;
-- Online rooms (friends anywhere) play Number Trail only, each player on their own streets; the race's distance and
-- ranking live on the room until the race is made.
alter table public.multiplayer_rooms add column if not exists play_mode text not null default 'nearby';
alter table public.multiplayer_rooms add column if not exists nt_category text not null default 'standard';
alter table public.multiplayer_rooms add column if not exists nt_ranked boolean not null default true;
alter table public.multiplayer_rooms drop constraint if exists multiplayer_rooms_play_mode_check;
alter table public.multiplayer_rooms add constraint multiplayer_rooms_play_mode_check check (play_mode in ('nearby', 'online'));
alter table public.multiplayer_rooms drop constraint if exists multiplayer_rooms_nt_category_check;
alter table public.multiplayer_rooms add constraint multiplayer_rooms_nt_category_check check (nt_category in ('short', 'standard', 'long'));

-- ---------------------------------------------------------------------------------------------------------------
-- Scores: wins in this room, from each game's own recorded results
-- ---------------------------------------------------------------------------------------------------------------

create or replace function public.room_scores(p_room_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with wins as (
    -- Team battles: every member of the winning team (a tie scores nobody).
    select tm.user_id from battle_matches m
    join battle_teams b on b.match_id = m.id
    join battle_team_members tm on tm.match_id = m.id and tm.team = b.team
    where m.room_id = p_room_id and m.status = 'completed'
      and b.score > (select coalesce(max(o.score), 0) from battle_teams o where o.match_id = m.id and o.team <> b.team)
    union all
    -- Find the Mafia: the Mafia when they escape, everyone else when they are caught.
    select a.user_id from mafia_rounds r join mafia_role_assignments a on a.round_id = r.id
    where r.room_id = p_room_id and r.status = 'finished' and r.result ? 'winner'
      and ((r.result ->> 'winner' = 'mafia' and a.role = 'mafia') or (r.result ->> 'winner' = 'civilians' and a.role = 'civilian'))
    union all
    -- Number Trail: the verified winner.
    select res.user_id from number_trail_results res join number_trail_matches x on x.id = res.match_id
    where x.room_id = p_room_id and res.is_winner
  )
  select coalesce(jsonb_object_agg(m.user_id, (select count(*) from wins w where w.user_id = m.user_id)), '{}'::jsonb)
  from room_members m where m.room_id = p_room_id and m.left_at is null;
$$;

-- The player allowed to start now: the host, or the present player with the most (or fewest) wins. A tie goes to the
-- host when the host is in it, otherwise to whoever joined first.
create or replace function public.room_starter(p_room_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_room multiplayer_rooms;
  v_scores jsonb;
  v_target bigint;
  v_starter uuid;
begin
  select * into v_room from multiplayer_rooms where id = p_room_id;
  if v_room.id is null then return null; end if;
  if v_room.start_permission = 'host' then return v_room.host_id; end if;
  v_scores := room_scores(p_room_id);
  select case when v_room.start_permission = 'first' then max((value)::bigint) else min((value)::bigint) end into v_target from jsonb_each_text(v_scores);
  select m.user_id into v_starter from room_members m
  where m.room_id = p_room_id and m.left_at is null and coalesce((v_scores ->> m.user_id::text)::bigint, 0) = v_target
  order by (m.user_id = v_room.host_id) desc, m.joined_at, m.user_id limit 1;
  return coalesce(v_starter, v_room.host_id);
end;
$$;

create or replace function public.room_assert_can_start(p_room_id uuid, p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user_id is null or room_starter(p_room_id) is distinct from p_user_id then raise exception 'not_your_turn_to_start'; end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Making and joining a room
-- ---------------------------------------------------------------------------------------------------------------

-- p_game may be null: the host picks the game in the room. p_mode 'online' makes a Number Trail room for friends
-- anywhere (joined by code).
drop function if exists public.create_room(public.tournament_game, text, integer, boolean, integer, boolean, uuid, text);
create or replace function public.create_room(
  p_game public.tournament_game,
  p_name text,
  p_max_players integer,
  p_team_mode boolean,
  p_start_delay_s integer,
  p_safety_ack boolean,
  p_dog_id uuid,
  p_display_name text,
  p_mode text default 'nearby'
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
  if coalesce(p_mode, 'nearby') not in ('nearby', 'online') then raise exception 'bad_request'; end if;
  if p_mode = 'online' then p_game := 'number_trail'; end if;
  if p_dog_id is not null and not owns_dog(p_dog_id) then raise exception 'not_your_dog'; end if;
  if exists (
    select 1 from room_members m join multiplayer_rooms r on r.id = m.room_id
    where m.user_id = auth.uid() and m.left_at is null and r.status in ('open', 'playing') and r.expires_at > now()
  ) then raise exception 'already_in_room'; end if;

  for i in 1..8 loop
    v_code := make_room_code();
    begin
      insert into multiplayer_rooms (game_type, name, host_id, max_players, team_mode, start_delay_s, code, safety_ack_at, remote_invite, play_mode)
      values (p_game, btrim(p_name), auth.uid(), p_max_players, coalesce(p_team_mode, false), coalesce(p_start_delay_s, 10), v_code, timezone('utc', now()), p_game is not null, coalesce(p_mode, 'nearby'))
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

-- Join by the room's QR (always) or by its code (only while the host allows remote invites).
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
  v_by_code boolean := false;
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
    v_by_code := true;
  end if;

  select * into v_room from multiplayer_rooms where id = v_room_id for update;
  if v_room.status <> 'open' or v_room.expires_at <= now() then raise exception 'room_closed'; end if;

  select * into v_member from room_members where room_id = v_room.id and user_id = auth.uid();
  if v_member.user_id is not null and v_member.removed then raise exception 'removed_from_room'; end if;
  if v_member.user_id is not null and v_member.left_at is null then
    return jsonb_build_object('roomId', v_room.id, 'alreadyIn', true);
  end if;
  -- New joiners by code need the host's remote invite; the QR needs you to be there.
  if v_by_code and not v_room.remote_invite then raise exception 'remote_invite_off'; end if;
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

-- ---------------------------------------------------------------------------------------------------------------
-- The host's choices
-- ---------------------------------------------------------------------------------------------------------------

-- Pick (or change) the room's game. Only while the room is open and nothing is running; everyone else is asked to be
-- ready again, and a Number Trail race nobody has prepared is dropped.
create or replace function public.set_room_game(p_room_id uuid, p_game public.tournament_game)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room multiplayer_rooms;
begin
  select * into v_room from multiplayer_rooms where id = p_room_id for update;
  if v_room.id is null or v_room.host_id <> auth.uid() then raise exception 'not_the_host'; end if;
  if v_room.status <> 'open' then raise exception 'room_closed'; end if;
  -- Null puts the room back to picking a game.
  if p_game is not null and p_game::text not in ('find_mafia', 'steal_territory', 'steal_road', 'number_trail') then raise exception 'bad_request'; end if;
  if v_room.play_mode = 'online' and p_game is distinct from 'number_trail' then raise exception 'online_number_only'; end if;
  if v_room.game_type is not distinct from p_game then return; end if;
  if exists (select 1 from battle_matches where room_id = p_room_id and status in ('preparing', 'countdown', 'active', 'finalizing'))
    or exists (select 1 from mafia_rounds where room_id = p_room_id and status in ('walking', 'discussion', 'voting'))
    or exists (select 1 from number_trail_matches where room_id = p_room_id and status not in ('waiting', 'completed', 'cancelled')) then
    raise exception 'game_in_progress';
  end if;
  update number_trail_matches set status = 'cancelled', completed_at = clock_timestamp() where room_id = p_room_id and status = 'waiting';
  update multiplayer_rooms set game_type = p_game, max_players = case when p_game = 'find_mafia' then greatest(max_players, 4) else max_players end where id = p_room_id;
  update room_members set ready = false where room_id = p_room_id and left_at is null and user_id <> v_room.host_id;
  perform room_changed(p_room_id, 'game');
end;
$$;

drop function if exists public.set_room_options(uuid, text, boolean);
create or replace function public.set_room_options(p_room_id uuid, p_start_permission text, p_remote_invite boolean, p_nt_category text default null, p_nt_ranked boolean default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(p_start_permission, 'host') not in ('host', 'first', 'last') then raise exception 'bad_request'; end if;
  if coalesce(p_nt_category, 'standard') not in ('short', 'standard', 'long') then raise exception 'bad_category'; end if;
  update multiplayer_rooms
  set start_permission = coalesce(p_start_permission, start_permission),
      remote_invite = coalesce(p_remote_invite, remote_invite),
      nt_category = coalesce(p_nt_category, nt_category),
      nt_ranked = coalesce(p_nt_ranked, nt_ranked)
  where id = p_room_id and host_id = auth.uid() and status in ('open', 'playing');
  if not found then raise exception 'not_the_host'; end if;
  perform room_changed(p_room_id, 'options');
end;
$$;

-- ---------------------------------------------------------------------------------------------------------------
-- Starting follows the room's rule
-- ---------------------------------------------------------------------------------------------------------------

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
  if v_room.id is null then raise exception 'room_not_found'; end if;
  perform room_assert_can_start(p_room_id, auth.uid());
  if v_room.status <> 'open' or v_room.game_type is null or v_room.game_type not in ('steal_territory', 'steal_road') then raise exception 'room_closed'; end if;
  select count(*) into v_n from room_members where room_id = p_room_id and left_at is null;
  if v_n < 2 then raise exception 'not_enough_players'; end if;
  if v_n > least(10, v_room.max_players) then raise exception 'room_full'; end if;
  if exists (select 1 from room_members where room_id = p_room_id and left_at is null and team is null) then raise exception 'teams_not_set'; end if;
  if (select count(distinct team) from room_members where room_id = p_room_id and left_at is null) < 2 then raise exception 'teams_not_set'; end if;
  if exists (select 1 from room_members where room_id = p_room_id and left_at is null and not ready and user_id not in (v_room.host_id, auth.uid())) then raise exception 'not_everyone_ready'; end if;
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

-- Online rooms: whoever may start (the room's rule) makes the race, with the room's distance and ranking unless given.
create or replace function public.number_create_online_match(p_room_id uuid, p_number text, p_category text, p_ranked boolean default null, p_countdown_s integer default 10)
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
  v_category text;
begin
  select * into v_room from multiplayer_rooms where id = p_room_id for update;
  if v_room.id is null then raise exception 'room_not_found'; end if;
  if v_room.game_type is distinct from 'number_trail' then raise exception 'wrong_game'; end if;
  perform room_assert_can_start(p_room_id, auth.uid());
  if v_room.status <> 'open' or v_room.expires_at <= now() then raise exception 'room_closed'; end if;
  -- No number yet is fine: players check what they can walk, then the host picks one everyone can.
  if p_number is not null and p_number !~ '^([0-9]|[1-9][0-9])$' then raise exception 'bad_number'; end if;
  v_category := coalesce(p_category, v_room.nt_category);
  select case v_category when 'short' then 1000 when 'standard' then 1500 when 'long' then 2500 end,
         case v_category when 'short' then 15 when 'standard' then 25 when 'long' then 40 end into v_target, v_minutes;
  if v_target is null then raise exception 'bad_category'; end if;
  select * into v_match from number_trail_matches where room_id = p_room_id and status not in ('completed', 'cancelled');
  if v_match.id is not null then
    -- A lobby match nobody has prepared yet becomes this race; anything further along is kept.
    if v_match.status <> 'waiting' then raise exception 'match_exists'; end if;
    update number_trail_matches set status = 'cancelled', completed_at = clock_timestamp() where id = v_match.id;
  end if;
  insert into number_trail_matches (room_id, mode, ranked, requested_number, target_number, distance_category, target_distance_m, minutes, countdown_s, created_by)
  values (p_room_id, 'online', coalesce(p_ranked, v_room.nt_ranked, true), p_number, p_number, v_category, v_target, v_minutes, least(120, greatest(5, coalesce(p_countdown_s, 10))), auth.uid())
  returning * into v_match;
  perform room_changed(p_room_id, 'number_match');
  return jsonb_build_object('matchId', v_match.id);
end;
$$;

revoke execute on function public.room_scores(uuid) from anon;
revoke execute on function public.room_starter(uuid) from anon;
revoke execute on function public.room_assert_can_start(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.create_room(public.tournament_game, text, integer, boolean, integer, boolean, uuid, text, text) from anon;
revoke execute on function public.join_room(text, text, uuid, text) from anon;
revoke execute on function public.set_room_game(uuid, public.tournament_game) from anon;
revoke execute on function public.set_room_options(uuid, text, boolean, text, boolean) from anon;
revoke execute on function public.start_battle(uuid) from anon;
revoke execute on function public.number_create_online_match(uuid, text, text, boolean, integer) from anon;
