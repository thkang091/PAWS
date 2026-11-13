-- Tournament phase 2: rooms (capacity, invitations, host controls), Find the Mafia privacy and voting, and Follow the
-- Shape recording. Run as a database administrator after the migrations. Everything is rolled back.
begin;
do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 12));
  host uuid;
  r jsonb;
  v_room uuid;
  room_code text;
  token text;
  refused boolean;
  v_count integer;
  v_round uuid;
  mafia uuid;
  civ uuid;
  t public.tournaments;
  s uuid;
  first_row public.shape_submissions;
  second_row public.shape_submissions;
begin
  for i in 1..12 loop
    insert into auth.users (id, email) values (u[i], u[i] || '@test.paws');
    insert into public.profiles (id) values (u[i]) on conflict do nothing;
  end loop;
  host := u[1];

  -- ---------------- Rooms ----------------
  perform set_config('request.jwt.claim.sub', host::text, true);
  refused := false;
  begin
    perform public.create_room('find_mafia', 'Test room', 10, false, 10, false, null, 'Host');
  exception when others then refused := sqlerrm = 'safety_not_acknowledged';
  end;
  if not refused then raise exception 'Room made without the safety promise'; end if;

  r := public.create_room('find_mafia', 'Test room', 10, false, 10, true, null, 'Host');
  v_room := (r ->> 'roomId')::uuid;
  room_code := r ->> 'code';
  token := r ->> 'token';
  if room_code !~ '^[A-HJ-NP-Z2-9]{6}$' or token is null then raise exception 'Room code or invitation missing'; end if;
  if exists (select 1 from public.room_invites where token_hash = convert_to(token, 'UTF8')) then raise exception 'Raw token stored'; end if;

  -- Players 2 to 10 join: two by QR token, the rest by code.
  for i in 2..10 loop
    perform set_config('request.jwt.claim.sub', u[i]::text, true);
    if i <= 3 then
      perform public.join_room(null, token, null, 'Player ' || i);
    else
      perform public.join_room(room_code, null, null, 'Player ' || i);
    end if;
  end loop;
  select count(*) into v_count from public.room_members where room_id = v_room and left_at is null;
  if v_count <> 10 then raise exception 'Ten players did not fill the room: %', v_count; end if;

  -- The eleventh is refused.
  perform set_config('request.jwt.claim.sub', u[11]::text, true);
  refused := false;
  begin
    perform public.join_room(room_code, null, null, 'Eleven');
  exception when others then refused := sqlerrm = 'room_full';
  end;
  if not refused then raise exception 'An eleventh player joined'; end if;

  -- Scanning the same code twice changes nothing.
  perform set_config('request.jwt.claim.sub', u[2]::text, true);
  r := public.join_room(null, token, null, 'Player 2');
  if not (r ->> 'alreadyIn')::boolean then raise exception 'Duplicate scan was treated as a new join'; end if;
  select count(*) into v_count from public.room_members where room_id = v_room;
  if v_count <> 10 then raise exception 'Duplicate scan added a row'; end if;

  -- An expired invitation is refused.
  update public.room_invites set expires_at = now() - interval '1 minute' where room_id = v_room;
  perform set_config('request.jwt.claim.sub', u[12]::text, true);
  refused := false;
  begin
    perform public.join_room(null, token, null, 'Late');
  exception when others then refused := sqlerrm = 'invite_expired';
  end;
  if not refused then raise exception 'Expired invitation accepted'; end if;

  -- Only the host controls the room.
  perform set_config('request.jwt.claim.sub', u[2]::text, true);
  refused := false;
  begin perform public.cancel_room(v_room); exception when others then refused := sqlerrm = 'not_the_host'; end;
  if not refused then raise exception 'Non-host cancelled the room'; end if;
  refused := false;
  begin perform public.issue_room_invite(v_room); exception when others then refused := sqlerrm = 'not_the_host'; end;
  if not refused then raise exception 'Non-host made an invitation'; end if;
  refused := false;
  begin perform public.remove_room_member(v_room, u[3]); exception when others then refused := sqlerrm = 'not_the_host'; end;
  if not refused then raise exception 'Non-host removed a player'; end if;
  refused := false;
  begin perform public.save_mafia_setup(v_room, 37.77, -122.48, '[]'::jsonb, '', '', '{}'::jsonb, true); exception when others then refused := sqlerrm = 'not_the_host'; end;
  if not refused then raise exception 'Non-host changed the setup'; end if;

  -- A removed player cannot come back.
  perform set_config('request.jwt.claim.sub', host::text, true);
  perform public.remove_room_member(v_room, u[10]);
  perform set_config('request.jwt.claim.sub', u[10]::text, true);
  refused := false;
  begin perform public.join_room(room_code, null, null, 'Back'); exception when others then refused := sqlerrm = 'removed_from_room'; end;
  if not refused then raise exception 'Removed player rejoined'; end if;

  -- Members see the room; outsiders do not.
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', u[12]::text, true);
  select count(*) into v_count from public.room_members where room_id = v_room;
  if v_count <> 0 then raise exception 'Outsider read the member list'; end if;
  perform set_config('request.jwt.claim.sub', u[2]::text, true);
  select count(*) into v_count from public.room_members where room_id = v_room;
  if v_count = 0 then raise exception 'Member could not read the member list'; end if;
  execute 'reset role';

  -- ---------------- Find the Mafia (round written as the edge function would) ----------------
  mafia := u[4];
  civ := u[5];
  insert into public.mafia_rounds (room_id, status, settings, started_at, walking_ends_at, discussion_ends_at, voting_ends_at)
  values (v_room, 'walking', '{"allowSelfVote": false}'::jsonb, now() - interval '20 minutes', now() - interval '3 minutes', now() - interval '1 minute', now() + interval '1 minute')
  returning id into v_round;
  insert into public.mafia_role_assignments (round_id, user_id, role)
  select v_round, m.user_id, case when m.user_id = mafia then 'mafia' else 'civilian' end
  from public.room_members m where m.room_id = v_room and m.left_at is null;
  insert into public.mafia_objectives (round_id, role, text) values (v_round, 'civilian', 'Civilian route'), (v_round, 'mafia', 'Secret route');
  insert into public.mafia_checkpoints (round_id, number, label, latitude, longitude, audience) values
    (v_round, 1, 'Gate', 37.7700, -122.4800, 'all'),
    (v_round, 2, 'Bench', 37.7710, -122.4800, 'civilian'),
    (v_round, 3, 'Oak', 37.7690, -122.4800, 'mafia');

  refused := false;
  begin
    insert into public.mafia_role_assignments (round_id, user_id, role) values (v_round, u[11], 'mafia');
  exception when unique_violation then refused := true;
  end;
  if not refused then raise exception 'A second Mafia was assigned'; end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', civ::text, true);
  select count(*) into v_count from public.mafia_role_assignments where round_id = v_round;
  if v_count <> 1 then raise exception 'A civilian could read other roles: %', v_count; end if;
  if exists (select 1 from public.mafia_objectives where round_id = v_round and role = 'mafia') then raise exception 'A civilian read the Mafia objective'; end if;
  if exists (select 1 from public.mafia_checkpoints where round_id = v_round and audience = 'mafia') then raise exception 'A civilian saw the Mafia checkpoint'; end if;
  perform set_config('request.jwt.claim.sub', host::text, true);
  select count(*) into v_count from public.mafia_role_assignments where round_id = v_round;
  if v_count <> 1 then raise exception 'The host could read other roles'; end if;
  perform set_config('request.jwt.claim.sub', mafia::text, true);
  if not exists (select 1 from public.mafia_checkpoints where round_id = v_round and audience = 'mafia') then raise exception 'The Mafia could not see its checkpoint'; end if;
  if exists (select 1 from public.mafia_checkpoints where round_id = v_round and audience = 'civilian') then raise exception 'The Mafia saw the civilian branch'; end if;
  execute 'reset role';

  -- Voting: one each, on the server clock, never for yourself.
  perform set_config('request.jwt.claim.sub', civ::text, true);
  refused := false;
  begin perform public.cast_mafia_vote(v_round, civ); exception when others then refused := sqlerrm = 'no_self_vote'; end;
  if not refused then raise exception 'Self-vote accepted'; end if;
  perform public.cast_mafia_vote(v_round, mafia);
  refused := false;
  begin perform public.cast_mafia_vote(v_round, u[6]); exception when others then refused := sqlerrm = 'already_voted'; end;
  if not refused then raise exception 'Second vote accepted'; end if;
  refused := false;
  begin perform public.cast_mafia_vote(v_round, u[11]); exception when others then refused := sqlerrm in ('already_voted', 'bad_target'); end;
  if not refused then raise exception 'Vote for an outsider accepted'; end if;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', u[6]::text, true);
  if exists (select 1 from public.mafia_votes where round_id = v_round) then raise exception 'A player saw someone else''s vote'; end if;
  execute 'reset role';

  update public.mafia_rounds set voting_ends_at = now() - interval '1 second' where id = v_round;
  perform set_config('request.jwt.claim.sub', u[6]::text, true);
  refused := false;
  begin perform public.cast_mafia_vote(v_round, mafia); exception when others then refused := sqlerrm = 'voting_closed'; end;
  if not refused then raise exception 'Late vote accepted'; end if;

  update public.mafia_rounds set status = 'finished', finished_at = now() where id = v_round;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', civ::text, true);
  select count(*) into v_count from public.mafia_role_assignments where round_id = v_round;
  if v_count < 9 then raise exception 'Roles not revealed after the round: %', v_count; end if;
  perform set_config('request.jwt.claim.sub', u[12]::text, true);
  select count(*) into v_count from public.mafia_role_assignments where round_id = v_round;
  if v_count <> 0 then raise exception 'An outsider read the roles'; end if;
  execute 'reset role';

  -- The host leaving hands the room on. Every join here shares one transaction time, so spread the join times out
  -- the way separate requests would.
  update public.room_members m set joined_at = m.joined_at + make_interval(secs => array_position(u, m.user_id)) where m.room_id = v_room;
  perform set_config('request.jwt.claim.sub', host::text, true);
  perform public.leave_room(v_room);
  if (select host_id from public.multiplayer_rooms where id = v_room) <> u[2] then raise exception 'Host did not pass to the earliest player'; end if;

  -- ---------------- Follow the Shape ----------------
  insert into public.tournament_organizers (user_id) values (host);
  insert into public.tournaments (game_type, mode, name, registration_opens_at, starts_at, ends_at)
  values ('follow_shape', 'online', 'Test shapes', now() - interval '2 days', now() - interval '1 day', now() + interval '1 day') returning * into t;
  perform set_config('request.jwt.claim.sub', host::text, true);
  perform public.create_shape_challenge(t.id, 'star');
  insert into public.gps_sessions (tournament_id, user_id) values (t.id, u[2]) returning id into s;
  first_row := public.record_shape_submission(s, 87.5, 0.21, 'frechet-v1', '[[0,0],[1,1]]'::jsonb, '[[0,0],[1,1]]'::jsonb, 820, 900);
  second_row := public.record_shape_submission(s, 12.0, 0.9, 'frechet-v1', '[]'::jsonb, '[]'::jsonb, 1, 1);
  if second_row.id <> first_row.id or second_row.score <> 87.5 then raise exception 'Repeated shape hand-in changed the result'; end if;
  insert into public.gps_sessions (tournament_id, user_id) values (t.id, u[3]) returning id into s;
  refused := false;
  begin perform public.record_shape_submission(s, 90, 0.1, 'frechet-v2', '[]'::jsonb, '[]'::jsonb, 800, 800); exception when others then refused := sqlerrm = 'algorithm_mismatch'; end;
  if not refused then raise exception 'A result scored with a different algorithm was stored'; end if;
  refused := false;
  begin perform public.create_shape_challenge(t.id, 'heart'); exception when others then refused := sqlerrm = 'challenge_has_results'; end;
  if not refused then raise exception 'Target changed after results were in'; end if;

  raise notice 'tournament phase 2 checks passed';
end;
$$;
rollback;
