-- Same-place Duel only. No matchmaking, ranking, payments, or game results.
-- Client mutations use authenticated RPCs. Realtime observers refetch on the
-- room revision; player rows are not independently writable by either player.
create schema if not exists private;

create table public.duel_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  phase text not null default 'waiting' check (phase in ('waiting', 'selecting', 'playing', 'closed')),
  selected_game text check (selected_game = 'paws-says'),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null default (clock_timestamp() + interval '2 hours'),
  unique (host_user_id, request_key)
);

create table public.duel_room_players (
  room_id uuid not null references public.duel_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dog_id uuid not null references public.dogs(id) on delete cascade,
  slot smallint not null check (slot in (1, 2)),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  ready boolean not null default false,
  last_seen_at timestamptz not null default clock_timestamp(),
  joined_at timestamptz not null default clock_timestamp(),
  primary key (room_id, user_id),
  unique (room_id, slot)
);

create index duel_room_players_user_room_idx on public.duel_room_players(user_id, room_id);
create index duel_room_players_dog_idx on public.duel_room_players(dog_id);
create index duel_rooms_expiry_idx on public.duel_rooms(expires_at) where phase <> 'closed';

-- Every attempted create key stays bound to its response, even when it merely
-- resumes an existing host room. A delayed retry after closure cannot create
-- an unintended second room. This table is never exposed to the client API.
create table private.duel_create_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  room_id uuid not null references public.duel_rooms(id) on delete cascade,
  primary key (user_id, request_key)
);
create index duel_create_requests_room_idx on private.duel_create_requests(room_id);
alter table private.duel_create_requests enable row level security;
revoke all on private.duel_create_requests from public, anon, authenticated;

alter table public.duel_rooms enable row level security;
alter table public.duel_room_players enable row level security;
revoke all on public.duel_rooms, public.duel_room_players from public, anon, authenticated;
grant select on public.duel_rooms, public.duel_room_players to authenticated;

create function private.duel_is_member(target_room_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.duel_room_players p
    where p.room_id = target_room_id and p.user_id = (select auth.uid())
  );
$$;
revoke all on function private.duel_is_member(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.duel_is_member(uuid) to authenticated;

create policy duel_room_members_read on public.duel_rooms
  for select to authenticated using ((select private.duel_is_member(id)));
create policy duel_players_members_read on public.duel_room_players
  for select to authenticated using ((select private.duel_is_member(room_id)));

-- The snapshot exposes only the two participants' game identity, never email,
-- profile fields, credentials, or other rooms. It is also checked when called
-- from another privileged helper rather than relying on the caller's RLS.
create function private.duel_snapshot(target_room_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  room_row public.duel_rooms;
  participants jsonb;
begin
  if actor is null then raise exception 'DUEL_AUTH_REQUIRED'; end if;
  if not private.duel_is_member(target_room_id) then raise exception 'DUEL_ROOM_NOT_FOUND'; end if;
  select * into room_row from public.duel_rooms where id = target_room_id;
  if not found then raise exception 'DUEL_ROOM_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', p.user_id, 'dogId', p.dog_id, 'name', p.name,
    'ready', p.ready, 'lastSeenAt', p.last_seen_at
  ) order by p.slot), '[]'::jsonb) into participants
  from public.duel_room_players p where p.room_id = target_room_id;
  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', room_row.id, 'code', room_row.code, 'hostUserId', room_row.host_user_id,
      'phase', room_row.phase, 'selectedGame', room_row.selected_game,
      'revision', room_row.revision, 'expiresAt', room_row.expires_at
    ), 'players', participants, 'meUserId', actor
  );
end;
$$;
revoke all on function private.duel_snapshot(uuid) from public, anon, authenticated;

-- One transaction and a room row lock serialize joining, Ready, selection,
-- starting, and leaving. The per-user advisory lock also prevents concurrent
-- create/join requests from placing the same account into two active rooms.
create function private.duel_room_action(
  operation text,
  target_room_id uuid default null,
  target_dog_id uuid default null,
  room_code text default null,
  request_key uuid default null,
  is_ready boolean default null,
  game_slug text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  room_row public.duel_rooms;
  existing_room public.duel_rooms;
  dog_name text;
  participant_count integer;
  all_ready boolean;
  current_time_value timestamptz := clock_timestamp();
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  random_bytes bytea;
  generated_code text;
  candidate integer;
  byte_index integer;
begin
  if actor is null then raise exception 'DUEL_AUTH_REQUIRED'; end if;
  if operation is null or operation not in ('create', 'join', 'get', 'ready', 'select', 'start', 'leave', 'reset', 'heartbeat') then
    raise exception 'DUEL_INVALID_REQUEST';
  end if;
  perform pg_advisory_xact_lock(145701, hashtext(actor::text));
  current_time_value := clock_timestamp();

  if operation in ('create', 'join') then
    select left(btrim(d.name), 80) into dog_name from public.dogs d
      where d.id = target_dog_id and d.owner_id = actor;
    if dog_name is null or dog_name = '' then raise exception 'DUEL_DOG_NOT_FOUND'; end if;
  end if;

  if operation = 'create' then
    if request_key is null then raise exception 'DUEL_INVALID_REQUEST'; end if;
    select r.* into room_row from public.duel_rooms r
      join private.duel_create_requests q on q.room_id = r.id
      where q.user_id = actor and q.request_key = duel_room_action.request_key for update of r;
    if found then
      -- A retry after an unknown network outcome returns the original room,
      -- including a closed room; the request key never creates another room.
      target_room_id := room_row.id;
      operation := 'heartbeat';
    else
      select r.* into existing_room from public.duel_rooms r
        join public.duel_room_players p on p.room_id = r.id
        where p.user_id = actor and r.phase <> 'closed' and r.expires_at > current_time_value
        order by r.created_at desc limit 1;
      if found then
        if existing_room.host_user_id <> actor then raise exception 'DUEL_ALREADY_IN_ROOM'; end if;
        target_room_id := existing_room.id;
        insert into private.duel_create_requests(user_id, request_key, room_id)
          values (actor, duel_room_action.request_key, target_room_id);
        operation := 'heartbeat';
      else
        for candidate in 1..20 loop
          random_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
          generated_code := '';
          for byte_index in 0..5 loop
            generated_code := generated_code || substr(alphabet, 1 + (get_byte(random_bytes, byte_index) % 32), 1);
          end loop;
          begin
            insert into public.duel_rooms(code, host_user_id, request_key)
              values (generated_code, actor, duel_room_action.request_key) returning * into room_row;
            exit;
          exception when unique_violation then
            if candidate = 20 then raise exception 'DUEL_CREATE_FAILED'; end if;
          end;
        end loop;
        insert into public.duel_room_players(room_id, user_id, dog_id, slot, name)
          values (room_row.id, actor, target_dog_id, 1, dog_name);
        insert into private.duel_create_requests(user_id, request_key, room_id)
          values (actor, duel_room_action.request_key, room_row.id);
        return private.duel_snapshot(room_row.id);
      end if;
    end if;
  end if;

  if operation = 'join' then
    if room_code is null or upper(btrim(room_code)) !~ '^[A-HJ-NP-Z2-9]{6}$' then
      raise exception 'DUEL_ROOM_NOT_FOUND';
    end if;
    select * into room_row from public.duel_rooms r
      where r.code = upper(btrim(duel_room_action.room_code)) for update;
    if not found then raise exception 'DUEL_ROOM_NOT_FOUND'; end if;
    current_time_value := clock_timestamp();
    target_room_id := room_row.id;
    if room_row.phase = 'closed' or room_row.expires_at <= current_time_value then raise exception 'DUEL_ROOM_CLOSED'; end if;

    if private.duel_is_member(target_room_id) then
      -- Joining the same room again never consumes the other seat or changes
      -- the chosen dog/readiness. It is a refresh of existing membership.
      operation := 'heartbeat';
    else
      if room_row.phase <> 'waiting' then raise exception 'DUEL_GAME_IN_PROGRESS'; end if;
      if exists (select 1 from public.duel_room_players p join public.duel_rooms r on r.id = p.room_id
        where p.user_id = actor and r.phase <> 'closed' and r.expires_at > current_time_value) then
        raise exception 'DUEL_ALREADY_IN_ROOM';
      end if;
      select count(*) into participant_count from public.duel_room_players where room_id = target_room_id;
      if participant_count >= 2 then raise exception 'DUEL_ROOM_FULL'; end if;
      insert into public.duel_room_players(room_id, user_id, dog_id, slot, name)
        values (target_room_id, actor, target_dog_id, 2, dog_name);
      update public.duel_room_players set ready = false where room_id = target_room_id;
      update public.duel_rooms set phase = 'waiting', selected_game = null, revision = revision + 1,
        updated_at = current_time_value where id = target_room_id;
      return private.duel_snapshot(target_room_id);
    end if;
  end if;

  -- No arbitrary room ID can be used to read, heartbeat, or mutate another
  -- room. Keep the error identical for a missing room and a non-member.
  if not private.duel_is_member(target_room_id) then raise exception 'DUEL_ROOM_NOT_FOUND'; end if;
  select * into room_row from public.duel_rooms where id = target_room_id for update;
  if not found then raise exception 'DUEL_ROOM_NOT_FOUND'; end if;
  current_time_value := clock_timestamp();

  if room_row.expires_at <= current_time_value and room_row.phase <> 'closed' then
    update public.duel_room_players set ready = false where room_id = target_room_id;
    update public.duel_rooms set phase = 'closed', selected_game = null, revision = revision + 1,
      updated_at = current_time_value where id = target_room_id returning * into room_row;
  end if;
  if room_row.phase = 'closed' then
    if operation = 'leave' then return null; end if;
    return private.duel_snapshot(target_room_id);
  end if;

  -- Recovery never silently restores Ready. A stale ready participant clears
  -- both confirmations and selection before their heartbeat is refreshed.
  if room_row.phase in ('waiting', 'selecting') and exists (
    select 1 from public.duel_room_players p where p.room_id = target_room_id
      and p.ready and p.last_seen_at < current_time_value - interval '90 seconds'
  ) then
    update public.duel_room_players set ready = false where room_id = target_room_id;
    update public.duel_rooms set phase = 'waiting', selected_game = null, revision = revision + 1,
      updated_at = current_time_value where id = target_room_id returning * into room_row;
  end if;

  if operation = 'get' then return private.duel_snapshot(target_room_id); end if;
  if operation = 'heartbeat' then
    update public.duel_room_players set last_seen_at = current_time_value
      where room_id = target_room_id and user_id = actor;
    update public.duel_rooms set revision = revision + 1, updated_at = current_time_value where id = target_room_id;
    return private.duel_snapshot(target_room_id);
  end if;

  if operation = 'leave' then
    if room_row.host_user_id = actor then
      update public.duel_room_players set ready = false where room_id = target_room_id;
      update public.duel_rooms set phase = 'closed', selected_game = null, revision = revision + 1,
        updated_at = current_time_value where id = target_room_id;
    else
      delete from public.duel_room_players where room_id = target_room_id and user_id = actor;
      update public.duel_room_players set ready = false where room_id = target_room_id;
      update public.duel_rooms set phase = 'waiting', selected_game = null, revision = revision + 1,
        updated_at = current_time_value where id = target_room_id;
    end if;
    return null;
  end if;

  if operation = 'reset' then
    if room_row.phase = 'playing' then
      update public.duel_room_players set ready = false where room_id = target_room_id;
      update public.duel_rooms set phase = 'waiting', selected_game = null, revision = revision + 1,
        updated_at = current_time_value where id = target_room_id;
    end if;
    return private.duel_snapshot(target_room_id);
  end if;

  if operation in ('select', 'start') and room_row.host_user_id <> actor then raise exception 'DUEL_HOST_REQUIRED'; end if;
  if operation = 'start' and room_row.phase = 'playing' then return private.duel_snapshot(target_room_id); end if;
  if room_row.phase = 'playing' then raise exception 'DUEL_GAME_IN_PROGRESS'; end if;
  update public.duel_room_players set last_seen_at = current_time_value where room_id = target_room_id and user_id = actor;

  if operation = 'ready' then
    if is_ready is null then raise exception 'DUEL_INVALID_REQUEST'; end if;
    if is_ready then
      select count(*) into participant_count from public.duel_room_players where room_id = target_room_id;
      if participant_count <> 2 then raise exception 'DUEL_FRIEND_REQUIRED'; end if;
      if exists (select 1 from public.duel_room_players where room_id = target_room_id
        and last_seen_at < current_time_value - interval '90 seconds') then raise exception 'DUEL_FRIEND_OFFLINE'; end if;
    end if;
    update public.duel_room_players set ready = is_ready where room_id = target_room_id and user_id = actor;
    select count(*) = 2 and bool_and(ready) into all_ready from public.duel_room_players where room_id = target_room_id;
    update public.duel_rooms set phase = case when all_ready then 'selecting' else 'waiting' end,
      selected_game = case when all_ready then selected_game else null end,
      revision = revision + 1, updated_at = current_time_value where id = target_room_id;
    return private.duel_snapshot(target_room_id);
  end if;

  if room_row.host_user_id <> actor then raise exception 'DUEL_HOST_REQUIRED'; end if;
  select count(*) = 2 and bool_and(ready and last_seen_at >= current_time_value - interval '90 seconds')
    into all_ready from public.duel_room_players where room_id = target_room_id;
  if not all_ready or room_row.phase <> 'selecting' then raise exception 'DUEL_NOT_READY'; end if;
  if operation = 'select' then
    if game_slug is null or game_slug <> 'paws-says' then raise exception 'DUEL_GAME_INVALID'; end if;
    update public.duel_rooms set selected_game = game_slug, revision = revision + 1,
      updated_at = current_time_value where id = target_room_id;
  elsif operation = 'start' then
    if room_row.selected_game is null then raise exception 'DUEL_GAME_REQUIRED'; end if;
    update public.duel_rooms set phase = 'playing', revision = revision + 1,
      updated_at = current_time_value where id = target_room_id;
  end if;
  return private.duel_snapshot(target_room_id);
end;
$$;
revoke all on function private.duel_room_action(text, uuid, uuid, text, uuid, boolean, text) from public, anon;
grant execute on function private.duel_room_action(text, uuid, uuid, text, uuid, boolean, text) to authenticated;

-- Only these explicit invoker entry points are exposed by the Data API.
create function public.create_duel_room(target_dog_id uuid, request_key uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.duel_room_action('create', null, target_dog_id, null, request_key); $$;
create function public.join_duel_room(room_code text, target_dog_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.duel_room_action('join', null, target_dog_id, room_code); $$;
create function public.get_duel_room(target_room_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.duel_room_action('get', target_room_id); $$;
create function public.set_duel_ready(target_room_id uuid, is_ready boolean)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.duel_room_action('ready', target_room_id, null, null, null, is_ready); $$;
create function public.select_duel_game(target_room_id uuid, game_slug text)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.duel_room_action('select', target_room_id, null, null, null, null, game_slug); $$;
create function public.start_duel_room(target_room_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.duel_room_action('start', target_room_id); $$;
create function public.leave_duel_room(target_room_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.duel_room_action('leave', target_room_id); $$;
create function public.reset_duel_round(target_room_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.duel_room_action('reset', target_room_id); $$;
create function public.heartbeat_duel_room(target_room_id uuid)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.duel_room_action('heartbeat', target_room_id); $$;

revoke all on function public.create_duel_room(uuid, uuid), public.join_duel_room(text, uuid),
  public.get_duel_room(uuid), public.set_duel_ready(uuid, boolean), public.select_duel_game(uuid, text),
  public.start_duel_room(uuid), public.leave_duel_room(uuid), public.reset_duel_round(uuid), public.heartbeat_duel_room(uuid)
  from public, anon;
grant execute on function public.create_duel_room(uuid, uuid), public.join_duel_room(text, uuid),
  public.get_duel_room(uuid), public.set_duel_ready(uuid, boolean), public.select_duel_game(uuid, text),
  public.start_duel_room(uuid), public.leave_duel_room(uuid), public.reset_duel_round(uuid), public.heartbeat_duel_room(uuid)
  to authenticated;

-- Publishing only room rows avoids delete-event/filter ambiguity for members.
-- A normal PostgreSQL test database may not have this Supabase publication.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'duel_rooms'
  ) then
    alter publication supabase_realtime add table public.duel_rooms;
  end if;
end;
$$;
