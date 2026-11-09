-- Run as a local/test database administrator after applying the Duel migration.
-- Synthetic identities and all room changes are rolled back; no existing users
-- or dogs are selected. The assertions run as authenticated, not as postgres.
begin;

create temporary table duel_test_users(label text primary key, user_id uuid not null, dog_id uuid not null);
insert into duel_test_users select label, gen_random_uuid(), gen_random_uuid()
  from unnest(array['host', 'guest', 'outsider']) label;
insert into auth.users(id) select user_id from duel_test_users;
insert into public.profiles(id) select user_id from duel_test_users on conflict (id) do nothing;
insert into public.dogs(id, owner_id, name, gender, age_years, breed, obedience_level, energy_level, dog_tag)
select dog_id, user_id, 'Duel test ' || label, 'unknown', 3, 'Test breed', 'beginner', 'moderate',
  'DUEL-TEST-' || dog_id::text from duel_test_users;
create temporary table duel_test_snapshots(label text primary key, value jsonb not null);
create temporary table duel_test_keys(label text primary key, value uuid not null);
insert into duel_test_keys values ('create', gen_random_uuid());
insert into duel_test_keys values ('resume', gen_random_uuid());
create temporary table duel_test_assertions(message text not null);
grant select on duel_test_users, duel_test_keys to authenticated;
grant select, insert, update on duel_test_snapshots, duel_test_assertions to authenticated;

create function pg_temp.duel_assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'FAIL: %', message; end if;
  insert into duel_test_assertions values (message);
end;
$$;
create function pg_temp.duel_expect_error(statement text, expected_message text)
returns void language plpgsql as $$
declare matched boolean := false;
begin
  begin
    execute statement;
  exception when others then
    if position(expected_message in sqlerrm) = 0 then raise; end if;
    matched := true;
  end;
  perform pg_temp.duel_assert(matched, 'Blocked: ' || expected_message);
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.duel_expect_error(
  format('select public.create_duel_room(%L,%L)',
    (select dog_id from duel_test_users where label='host'), (select value from duel_test_keys where label='create')),
  'DUEL_AUTH_REQUIRED');
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='host'), true);
select pg_temp.duel_expect_error(
  format('select public.create_duel_room(%L,%L)',
    (select dog_id from duel_test_users where label='guest'), (select value from duel_test_keys where label='create')),
  'DUEL_DOG_NOT_FOUND');
insert into duel_test_snapshots values ('created', public.create_duel_room(
  (select dog_id from duel_test_users where label='host'), (select value from duel_test_keys where label='create')));
select pg_temp.duel_assert((value#>>'{room,code}') ~ '^[A-HJ-NP-Z2-9]{6}$', 'Server generates a valid six-character code') from duel_test_snapshots where label='created';
select pg_temp.duel_assert(value#>>'{room,phase}'='waiting' and jsonb_array_length(value->'players')=1
  and value#>>'{players,0,name}'='Duel test host' and value#>>'{players,0,ready}'='false',
  'Created room has server-owned dog identity and one unready host') from duel_test_snapshots where label='created';
select pg_temp.duel_assert(value->>'meUserId'=(select user_id::text from duel_test_users where label='host'),
  'Snapshot identifies its caller') from duel_test_snapshots where label='created';
select pg_temp.duel_assert(public.create_duel_room(
  (select dog_id from duel_test_users where label='host'), (select value from duel_test_keys where label='create'))#>>'{room,id}'=value#>>'{room,id}',
  'Repeated create request returns original room') from duel_test_snapshots where label='created';
select pg_temp.duel_assert(public.create_duel_room((select dog_id from duel_test_users where label='host'), (select value from duel_test_keys where label='resume'))#>>'{room,id}'=value#>>'{room,id}',
  'A host with an active room resumes it instead of creating another') from duel_test_snapshots where label='created';
select pg_temp.duel_assert(jsonb_array_length(public.join_duel_room(value#>>'{room,code}',
  (select dog_id from duel_test_users where label='host'))->'players')=1,
  'Host cannot occupy both seats by joining own code') from duel_test_snapshots where label='created';
select pg_temp.duel_expect_error(format('select public.set_duel_ready(%L,true)',value#>>'{room,id}'), 'DUEL_FRIEND_REQUIRED') from duel_test_snapshots where label='created';
select pg_temp.duel_expect_error(format('select public.start_duel_room(%L)',value#>>'{room,id}'), 'DUEL_NOT_READY') from duel_test_snapshots where label='created';
select pg_temp.duel_expect_error(format('update public.duel_rooms set phase=%L where id=%L','playing',value#>>'{room,id}'), 'permission denied') from duel_test_snapshots where label='created';
select pg_temp.duel_expect_error(format('update public.duel_room_players set ready=true where room_id=%L',value#>>'{room,id}'), 'permission denied') from duel_test_snapshots where label='created';

select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='outsider'), true);
select pg_temp.duel_assert((select count(*) from public.duel_rooms)=0 and (select count(*) from public.duel_room_players)=0,
  'RLS hides rooms and participants from outsiders');
select pg_temp.duel_expect_error(format('select public.get_duel_room(%L)',value#>>'{room,id}'), 'DUEL_ROOM_NOT_FOUND') from duel_test_snapshots where label='created';
select pg_temp.duel_expect_error(format('select public.heartbeat_duel_room(%L)',value#>>'{room,id}'), 'DUEL_ROOM_NOT_FOUND') from duel_test_snapshots where label='created';
select pg_temp.duel_expect_error(format('select public.leave_duel_room(%L)',value#>>'{room,id}'), 'DUEL_ROOM_NOT_FOUND') from duel_test_snapshots where label='created';

select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='guest'), true);
insert into duel_test_snapshots select 'joined', public.join_duel_room(' '||lower(value#>>'{room,code}')||' ',
  (select dog_id from duel_test_users where label='guest')) from duel_test_snapshots where label='created';
select pg_temp.duel_assert(jsonb_array_length(value->'players')=2 and value#>>'{players,1,name}'='Duel test guest'
  and value->>'meUserId'=(select user_id::text from duel_test_users where label='guest'),
  'Join uses the same room and authenticated guest dog identity') from duel_test_snapshots where label='joined';
select pg_temp.duel_assert((select count(*) from public.duel_rooms)=1 and (select count(*) from public.duel_room_players)=2,
  'Members can read their own room and both participants');
select pg_temp.duel_assert(jsonb_array_length(public.join_duel_room(value#>>'{room,code}',
  (select dog_id from duel_test_users where label='guest'))->'players')=2,
  'Repeated join is idempotent and does not consume another seat') from duel_test_snapshots where label='created';
select pg_temp.duel_expect_error(format('select public.create_duel_room(%L,%L)',
  (select dog_id from duel_test_users where label='guest'),gen_random_uuid()), 'DUEL_ALREADY_IN_ROOM');
select pg_temp.duel_expect_error(format('select public.select_duel_game(%L,%L)',value#>>'{room,id}','paws-says'), 'DUEL_HOST_REQUIRED') from duel_test_snapshots where label='created';
select pg_temp.duel_expect_error(format('select public.start_duel_room(%L)',value#>>'{room,id}'), 'DUEL_HOST_REQUIRED') from duel_test_snapshots where label='created';

-- This is a storage-level invariant in addition to the serialized RPC check.
-- PGlite can verify this constraint, but not a multi-connection lock race.
reset role;
select pg_temp.duel_expect_error(format(
  'insert into public.duel_room_players(room_id,user_id,dog_id,slot,name) values (%L,%L,%L,2,%L)',
  value#>>'{room,id}',(select user_id from duel_test_users where label='outsider'),
  (select dog_id from duel_test_users where label='outsider'),'Test over-capacity'), 'duplicate key')
  from duel_test_snapshots where label='created';
set local role authenticated;

select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='outsider'), true);
select pg_temp.duel_expect_error(format('select public.join_duel_room(%L,%L)',value#>>'{room,code}',
  (select dog_id from duel_test_users where label='outsider')), 'DUEL_ROOM_FULL') from duel_test_snapshots where label='created';
insert into duel_test_snapshots values ('other-room', public.create_duel_room(
  (select dog_id from duel_test_users where label='outsider'),gen_random_uuid()));
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='guest'), true);
select pg_temp.duel_expect_error(format('select public.join_duel_room(%L,%L)',value#>>'{room,code}',
  (select dog_id from duel_test_users where label='guest')), 'DUEL_ALREADY_IN_ROOM') from duel_test_snapshots where label='other-room';
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='outsider'), true);
select public.leave_duel_room((value#>>'{room,id}')::uuid) from duel_test_snapshots where label='other-room';

select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='host'), true);
insert into duel_test_snapshots select 'host-ready', public.set_duel_ready((value#>>'{room,id}')::uuid,true) from duel_test_snapshots where label='created';
select pg_temp.duel_assert(value#>>'{room,phase}'='waiting' and value#>>'{players,0,ready}'='true'
  and value#>>'{players,1,ready}'='false', 'Ready changes only the caller and one Ready stays waiting') from duel_test_snapshots where label='host-ready';
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='guest'), true);
insert into duel_test_snapshots select 'both-ready', public.set_duel_ready((value#>>'{room,id}')::uuid,true) from duel_test_snapshots where label='created';
select pg_temp.duel_assert(value#>>'{room,phase}'='selecting' and value#>>'{players,0,ready}'='true'
  and value#>>'{players,1,ready}'='true' and value#>>'{room,selectedGame}' is null,
  'Both Ready opens selection before any game is selected') from duel_test_snapshots where label='both-ready';
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='host'), true);
select pg_temp.duel_expect_error(format('select public.start_duel_room(%L)',value#>>'{room,id}'), 'DUEL_GAME_REQUIRED') from duel_test_snapshots where label='created';
select pg_temp.duel_expect_error(format('select public.select_duel_game(%L,%L)',value#>>'{room,id}','unknown-game'), 'DUEL_GAME_INVALID') from duel_test_snapshots where label='created';
insert into duel_test_snapshots select 'selected', public.select_duel_game((value#>>'{room,id}')::uuid,'paws-says') from duel_test_snapshots where label='created';
select pg_temp.duel_assert(value#>>'{room,selectedGame}'='paws-says' and value#>>'{players,0,ready}'='true'
  and value#>>'{players,1,ready}'='true', 'Host selection preserves both Ready confirmations') from duel_test_snapshots where label='selected';
insert into duel_test_snapshots select 'playing', public.start_duel_room((value#>>'{room,id}')::uuid) from duel_test_snapshots where label='created';
select pg_temp.duel_assert(value#>>'{room,phase}'='playing', 'Ready host starts selected game') from duel_test_snapshots where label='playing';
select pg_temp.duel_assert((value#>>'{room,revision}')::bigint >
  (select (value#>>'{room,revision}')::bigint from duel_test_snapshots where label='selected'),
  'Room revision increases when Start changes shared state') from duel_test_snapshots where label='playing';
select pg_temp.duel_assert(public.start_duel_room((value#>>'{room,id}')::uuid)#>>'{room,revision}'=value#>>'{room,revision}',
  'Duplicate Start does not start another round') from duel_test_snapshots where label='playing';
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='guest'), true);
select pg_temp.duel_assert(public.get_duel_room((value#>>'{room,id}')::uuid)#>>'{room,phase}'='playing',
  'Guest reads the same authoritative playing phase') from duel_test_snapshots where label='created';
select pg_temp.duel_expect_error(format('select public.start_duel_room(%L)',value#>>'{room,id}'), 'DUEL_HOST_REQUIRED') from duel_test_snapshots where label='created';
insert into duel_test_snapshots select 'reset', public.reset_duel_round((value#>>'{room,id}')::uuid) from duel_test_snapshots where label='created';
select pg_temp.duel_assert(value#>>'{room,phase}'='waiting' and value#>>'{room,selectedGame}' is null
  and value#>>'{players,0,ready}'='false' and value#>>'{players,1,ready}'='false',
  'Returning from a round requires fresh Ready confirmations') from duel_test_snapshots where label='reset';

-- Stale readiness is invalidated before a resumed heartbeat renews presence.
select public.set_duel_ready((value#>>'{room,id}')::uuid,true) from duel_test_snapshots where label='created';
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='host'), true);
select public.set_duel_ready((value#>>'{room,id}')::uuid,true) from duel_test_snapshots where label='created';
select public.select_duel_game((value#>>'{room,id}')::uuid,'paws-says') from duel_test_snapshots where label='created';
select public.set_duel_ready((value#>>'{room,id}')::uuid,false) from duel_test_snapshots where label='created';
select pg_temp.duel_assert(public.get_duel_room((value#>>'{room,id}')::uuid)#>>'{room,phase}'='waiting'
  and public.get_duel_room((value#>>'{room,id}')::uuid)#>>'{room,selectedGame}' is null,
  'Cancel Ready clears selection and returns to waiting') from duel_test_snapshots where label='created';
select public.set_duel_ready((value#>>'{room,id}')::uuid,true) from duel_test_snapshots where label='created';
reset role;
update public.duel_room_players set last_seen_at=clock_timestamp()-interval '91 seconds'
  where user_id=(select user_id from duel_test_users where label='guest');
set local role authenticated;
insert into duel_test_snapshots select 'stale', public.get_duel_room((value#>>'{room,id}')::uuid) from duel_test_snapshots where label='created';
select pg_temp.duel_assert(value#>>'{room,phase}'='waiting' and value#>>'{players,0,ready}'='false'
  and value#>>'{players,1,ready}'='false' and value#>>'{room,selectedGame}' is null,
  'Stale participant invalidates both Ready states and game selection') from duel_test_snapshots where label='stale';
select pg_temp.duel_expect_error(format('select public.set_duel_ready(%L,true)',value#>>'{room,id}'), 'DUEL_FRIEND_OFFLINE') from duel_test_snapshots where label='created';
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='guest'), true);
insert into duel_test_snapshots select 'recovered', public.heartbeat_duel_room((value#>>'{room,id}')::uuid) from duel_test_snapshots where label='created';
select pg_temp.duel_assert(value#>>'{players,1,ready}'='false' and (value#>>'{players,1,lastSeenAt}')::timestamptz > clock_timestamp()-interval '5 seconds',
  'Heartbeat restores presence without restoring Ready') from duel_test_snapshots where label='recovered';
select public.leave_duel_room((value#>>'{room,id}')::uuid) from duel_test_snapshots where label='created';
select pg_temp.duel_expect_error(format('select public.get_duel_room(%L)',value#>>'{room,id}'), 'DUEL_ROOM_NOT_FOUND') from duel_test_snapshots where label='created';
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='host'), true);
insert into duel_test_snapshots select 'guest-left', public.get_duel_room((value#>>'{room,id}')::uuid) from duel_test_snapshots where label='created';
select pg_temp.duel_assert(jsonb_array_length(value->'players')=1 and value#>>'{players,0,ready}'='false'
  and value#>>'{room,phase}'='waiting', 'Guest leave releases seat and clears host readiness') from duel_test_snapshots where label='guest-left';
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='outsider'), true);
select pg_temp.duel_assert(jsonb_array_length(public.join_duel_room(value#>>'{room,code}',
  (select dog_id from duel_test_users where label='outsider'))->'players')=2,
  'Another participant can join the released seat') from duel_test_snapshots where label='created';
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='host'), true);
select public.leave_duel_room((value#>>'{room,id}')::uuid) from duel_test_snapshots where label='created';
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='outsider'), true);
select pg_temp.duel_assert(public.get_duel_room((value#>>'{room,id}')::uuid)#>>'{room,phase}'='closed',
  'Host leave leaves a readable closed snapshot for the other member') from duel_test_snapshots where label='created';
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='guest'), true);
select pg_temp.duel_expect_error(format('select public.join_duel_room(%L,%L)',value#>>'{room,code}',
  (select dog_id from duel_test_users where label='guest')), 'DUEL_ROOM_CLOSED') from duel_test_snapshots where label='created';
select set_config('request.jwt.claim.sub', (select user_id::text from duel_test_users where label='host'), true);
select pg_temp.duel_assert(public.create_duel_room((select dog_id from duel_test_users where label='host'),
  (select value from duel_test_keys where label='create'))#>>'{room,phase}'='closed',
  'A closed request key is never recycled into a new room');
select pg_temp.duel_assert(public.create_duel_room((select dog_id from duel_test_users where label='host'),
  (select value from duel_test_keys where label='resume'))#>>'{room,phase}'='closed',
  'A retry of a resume request also returns its original closed room');
insert into duel_test_snapshots values ('expiring', public.create_duel_room(
  (select dog_id from duel_test_users where label='host'),gen_random_uuid()));
select pg_temp.duel_assert((value#>>'{room,expiresAt}')::timestamptz <= clock_timestamp()+interval '2 hours',
  'Rooms have a bounded two-hour lifetime') from duel_test_snapshots where label='expiring';
reset role;
update public.duel_rooms set expires_at=clock_timestamp()-interval '1 second'
  where id=(select (value#>>'{room,id}')::uuid from duel_test_snapshots where label='expiring');
set local role authenticated;
select pg_temp.duel_assert(public.get_duel_room((value#>>'{room,id}')::uuid)#>>'{room,phase}'='closed',
  'Expired room becomes closed when reconciled') from duel_test_snapshots where label='expiring';
reset role;

select pg_temp.duel_assert(not has_function_privilege('anon','public.create_duel_room(uuid,uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.create_duel_room(uuid,uuid)','EXECUTE'), 'RPC execution requires authenticated role');
select pg_temp.duel_assert(not has_table_privilege('authenticated','public.duel_rooms','INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated','public.duel_room_players','INSERT,UPDATE,DELETE'), 'No direct authenticated table mutations');
select pg_temp.duel_assert(not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in ('create_duel_room','join_duel_room','get_duel_room','set_duel_ready',
    'select_duel_game','start_duel_room','leave_duel_room','reset_duel_round','heartbeat_duel_room') and p.prosecdef),
  'Exposed RPC wrappers are SECURITY INVOKER');
select pg_temp.duel_assert((select count(*) from public.duel_rooms where host_user_id=(select user_id from duel_test_users where label='host'))=2,
  'Retries did not leave duplicate rooms behind');

select count(*) as passed_assertions from duel_test_assertions;
rollback;
select 'PASS: Duel authorization, membership, idempotency, Ready, selection, start, leave, expiry; fixtures rolled back' as verification;
