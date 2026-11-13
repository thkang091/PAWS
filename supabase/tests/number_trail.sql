-- Number Trail (phase N2) against real PostgreSQL + PostGIS: match lifecycle, host rights, course and assignment locks,
-- leading zeros, receipt-ordered finishes, one winner, immutable results, events and broadcasts without coordinates,
-- and row level security with several identities. Run as a database administrator after the migrations. Everything
-- is rolled back. Parallel sessions are in supabase/tests/local/number_concurrency.sh.
begin;

create function pg_temp.raises(stmt text, expected text) returns boolean language plpgsql as $$
begin
  execute stmt;
  raise notice 'expected %, got no error', expected;
  return false;
exception when others then
  -- `expected` is a regular expression, so a refusal may name either of two mechanisms.
  if sqlerrm !~ expected then raise notice 'expected %, got %', expected, sqlerrm; return false; end if;
  return true;
end;
$$;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(u::text, ''), true), set_config('request.jwt.claim.role', case when u is null then '' else 'authenticated' end, true);
$$;
-- A stored course as the edge function would write it (the geometry itself is checked by the TypeScript tests).
create function pg_temp.course(n text, difficulty text default 'easy') returns jsonb language sql immutable as $$
  select jsonb_build_object('version', 'number-match-v1', 'raceVersion', 'number-race-v1', 'algorithm', 'number-trail-v1', 'number', n,
    'layout', 'side_by_side', 'headingDeg', 0, 'minutes', 22, 'difficulty', difficulty, 'raceM', 1450, 'approachM', 120, 'connectorM', 140,
    'digitM', jsonb_build_array(600, 700), 'start', jsonb_build_object('nodeId', 'osm:n1', 'latitude', 37.77, 'longitude', -122.42),
    'digits', jsonb_build_array(jsonb_build_object('digit', substr(n, 1, 1)), jsonb_build_object('digit', substr(n, 2, 1))),
    'connector', '[]'::jsonb, 'approach', '[]'::jsonb);
$$;
-- Moves a match's clock back, as if time had passed. Test only: the guard trigger forbids it otherwise.
create function pg_temp.shift(m uuid, secs integer) returns void language plpgsql as $$
begin
  alter table public.number_trail_matches disable trigger number_trail_matches_guard;
  update public.number_trail_matches set countdown_at = countdown_at - make_interval(secs => secs), starts_at = starts_at - make_interval(secs => secs),
    ends_at = ends_at - make_interval(secs => secs) where id = m;
  alter table public.number_trail_matches enable trigger number_trail_matches_guard;
end;
$$;
create function pg_temp.age_attempts(m uuid, secs integer) returns void language sql as $$
  update public.number_trail_finish_attempts set received_at = received_at - make_interval(secs => secs), verify_started_at = verify_started_at - make_interval(secs => secs) where match_id = m;
$$;
create function pg_temp.kinds(m uuid) returns text[] language sql stable as $$
  select array_agg(kind order by seq) from public.number_trail_events where match_id = m;
$$;
create function pg_temp.count_kind(m uuid, k text) returns integer language sql stable as $$
  select count(*)::integer from public.number_trail_events where match_id = m and kind = k;
$$;
-- A room with a host and players, all ready, a match drawn with number n. Returns the match.
create function pg_temp.drawn(host uuid, players uuid[], n text, max_players integer default 10) returns uuid language plpgsql as $$
declare
  r jsonb;
  m uuid;
  t uuid;
  p uuid;
begin
  perform pg_temp.as_user(host);
  r := public.create_room('number_trail', 'Race ' || n, max_players, false, 5, true, null, 'Host');
  foreach p in array players loop
    perform pg_temp.as_user(p);
    perform public.join_room(r ->> 'code', null, null, 'P' || left(p::text, 4));
    perform public.set_room_ready((r ->> 'roomId')::uuid, true);
  end loop;
  perform pg_temp.as_user(host);
  m := (public.number_create_match((r ->> 'roomId')::uuid, 25, null) ->> 'matchId')::uuid;
  t := (public.number_begin_prepare(m, host) ->> 'token')::uuid;
  perform public.number_record_course(m, t, pg_temp.course(n), '{"source": "osm"}'::jsonb, '[{"source": "OpenStreetMap"}]'::jsonb, 'fp-test', 9);
  return m;
end;
$$;
-- Started and running (start time already passed).
create function pg_temp.racing(host uuid, players uuid[], n text) returns uuid language plpgsql as $$
declare
  m uuid := pg_temp.drawn(host, players, n);
begin
  perform pg_temp.as_user(host);
  perform public.number_start(m);
  perform pg_temp.shift(m, 6);
  perform pg_temp.as_user(null);
  perform public.number_advance(m);
  return m;
end;
$$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 30));
  r jsonb;
  room uuid;
  code text;
  m uuid;
  m2 uuid;
  t uuid;
  x jsonb;
  a1 jsonb;
  a2 jsonb;
  a3 jsonb;
  n integer;
  v_status text;
  mt public.number_trail_matches;
  s jsonb;
begin
  for i in 1..30 loop
    insert into auth.users (id, email) values (u[i], 'nt' || i || '@test.paws');
  end loop;

  -- ======================= A. Database =======================

  -- A1. Valid match creation: the host of a Number Trail room opens a match in the lobby.
  perform pg_temp.as_user(u[1]);
  r := public.create_room('number_trail', 'Sunday race', 10, false, 10, true, null, 'Ana');
  room := (r ->> 'roomId')::uuid;
  code := r ->> 'code';
  x := public.number_create_match(room, 25, null);
  m := (x ->> 'matchId')::uuid;
  assert (x ->> 'alreadyExists')::boolean = false, 'A1 new match';
  select * into mt from public.number_trail_matches where id = m;
  assert mt.status = 'waiting' and mt.minutes = 25 and mt.countdown_s = 10 and mt.target_number is null and mt.mode = 'nearby', 'A1 waiting, no number yet';
  raise notice 'pass  A1 valid match creation';

  -- A2. Duplicate creation returns the live match; the unique index refuses a second one.
  x := public.number_create_match(room, 15, 'hard');
  assert (x ->> 'matchId')::uuid = m and (x ->> 'alreadyExists')::boolean, 'A2 same match';
  assert pg_temp.raises(format('insert into public.number_trail_matches (room_id, created_by) values (%L, %L)', room, u[1]), 'number_trail_matches_one_live_idx'), 'A2 unique live match';
  raise notice 'pass  A2 duplicate creation';

  -- A3. Unauthorized creation: not the host, or not a Number Trail room.
  perform pg_temp.as_user(u[2]);
  perform public.join_room(code, null, null, 'Ben');
  assert pg_temp.raises(format('select public.number_create_match(%L, 25, null)', room), 'not_the_host'), 'A3 member is not host';
  perform pg_temp.as_user(u[3]);
  r := public.create_room('steal_territory', 'Blue v orange', 10, true, 10, true, null, 'Cat');
  assert pg_temp.raises(format('select public.number_create_match(%L, 25, null)', r ->> 'roomId'), 'wrong_game'), 'A3 wrong game';
  perform pg_temp.as_user(u[2]);
  assert pg_temp.raises(format('select public.number_set_settings(%L, 40, null, 10)', m), 'not_the_host'), 'A3 settings host only';
  assert pg_temp.raises(format('select public.number_begin_prepare(%L, %L)', m, u[2]), 'not_the_host'), 'A3 prepare host only';
  assert pg_temp.raises(format('select public.number_create_match(%L, 25, null)', gen_random_uuid()), 'room_not_found'), 'A3 no such room';
  raise notice 'pass  A3 unauthorized creation refused';

  -- A4. Room membership: members read the match; outsiders don't.
  perform pg_temp.as_user(u[2]);
  s := public.number_race_state(m, 0, null);
  assert s -> 'match' ->> 'status' = 'waiting', 'A4 member reads';
  assert jsonb_array_length(s -> 'players') = 2, 'A4 two players';
  perform pg_temp.as_user(u[9]);
  assert pg_temp.raises(format('select public.number_race_state(%L, 0, null)', m), 'not_in_match'), 'A4 outsider refused';
  assert pg_temp.raises(format('select public.number_race_state(%L, 0, %L)', m, u[1]), 'not_in_match'), 'A4 cannot read as someone else';
  assert public.number_room_match(room) is null, 'A4 outsider cannot find the match';
  raise notice 'pass  A4 room membership';

  -- Settings, then a number. Leading zero kept.
  perform pg_temp.as_user(u[1]);
  perform public.number_set_settings(m, 15, 'easy', 8);
  select * into mt from public.number_trail_matches where id = m;
  assert mt.minutes = 15 and mt.difficulty = 'easy' and mt.countdown_s = 8, 'settings stored';
  assert pg_temp.raises(format('select public.number_set_settings(%L, 20, null, 8)', m), 'bad_minutes'), 'minutes 15/25/40 only';
  t := (public.number_begin_prepare(m, u[1]) ->> 'token')::uuid;
  assert (select status from public.number_trail_matches where id = m) = 'preparing_routes', 'preparing';
  assert pg_temp.raises(format('select public.number_begin_prepare(%L, %L)', m, u[1]), 'preparation_in_progress'), 'one preparation at a time';
  assert pg_temp.raises(format('select public.number_record_course(%L, %L, %L, %L, %L, %L, 3)', m, gen_random_uuid(), pg_temp.course('07'), '{}', '[]', 'fp'), 'stale_preparation'), 'wrong token refused';
  assert pg_temp.raises(format('select public.number_record_course(%L, %L, %L, %L, %L, %L, 3)', m, t, pg_temp.course('07', 'hard'), '{}', '[]', 'fp'), 'wrong_difficulty'), 'difficulty must match';

  -- A9. Leading zero preserved; malformed numbers refused.
  -- A single digit is a race number (any one digit can be drawn), but its course must hold exactly one digit.
  assert pg_temp.raises(format('select public.number_record_course(%L, %L, %L, %L, %L, %L, 3)', m, t, pg_temp.course('7'), '{}', '[]', 'fp'), 'bad_course'), 'A9 single digit with two drawn digits refused';
  assert pg_temp.raises(format('select public.number_record_course(%L, %L, %L, %L, %L, %L, 3)', m, t, pg_temp.course('123'), '{}', '[]', 'fp'), 'bad_number'), 'A9 three digits refused';
  assert pg_temp.raises(format('select public.number_record_course(%L, %L, %L, %L, %L, %L, 3)', m, t, pg_temp.course('7a'), '{}', '[]', 'fp'), 'bad_number'), 'A9 letters refused';
  -- Since phase P1 a single digit is a valid number, and since L1 that includes 0; malformed ones are still refused by
  -- the column.
  assert pg_temp.raises(format('update public.number_trail_matches set target_number = %L where id = %L', '', m), 'number_trail_matches_target_number_check'), 'A9 column refuses empty';
  assert pg_temp.raises(format('update public.number_trail_matches set target_number = %L where id = %L', '7a', m), 'number_trail_matches_target_number_check'), 'A9 column refuses letters';
  assert pg_temp.raises(format('update public.number_trail_matches set target_number = %L where id = %L', '123', m), 'number_trail_matches_target_number_check'), 'A9 column refuses three digits';
  perform public.number_record_course(m, t, pg_temp.course('07'), '{"source": "osm"}'::jsonb, '[]'::jsonb, 'fp', 3);
  select * into mt from public.number_trail_matches where id = m;
  assert mt.status = 'ready' and mt.target_number = '07' and pg_typeof(mt.target_number)::text = 'text', 'A9 07 kept as text';
  assert (select course ->> 'number' from public.number_trail_courses where match_id = m) = '07', 'A9 course 07';
  raise notice 'pass  A9 leading zero preserved, malformed numbers refused';

  -- Prepare failure goes back to the lobby with a reason; a new preparation clears it.
  perform pg_temp.as_user(u[4]);
  r := public.create_room('number_trail', 'Empty streets', 10, false, 10, true, null, 'Dee');
  m2 := (public.number_create_match((r ->> 'roomId')::uuid, 25, null) ->> 'matchId')::uuid;
  t := (public.number_begin_prepare(m2, u[4]) ->> 'token')::uuid;
  perform public.number_prepare_failed(m2, t, 'no_number_routes');
  select * into mt from public.number_trail_matches where id = m2;
  assert mt.status = 'waiting' and mt.prepare_error = 'no_number_routes' and mt.target_number is null, 'no routes: back to waiting, no number';
  assert pg_temp.count_kind(m2, 'ROUTE_FAILED') = 1, 'route failed event';
  perform pg_temp.as_user(u[4]);
  assert pg_temp.raises(format('select public.number_start(%L)', m2), 'match_not_ready'), 'cannot start without a number';
  raise notice 'pass  no feasible routes: recoverable, no number invented, cannot start';

  -- A8. Target number assignment: start gives every present member the same number and course.
  perform pg_temp.as_user(u[2]);
  assert pg_temp.raises(format('select public.number_start(%L)', m), 'not_your_turn_to_start'), 'only the room''s starter (the host by default) starts';
  perform pg_temp.as_user(u[1]);
  assert pg_temp.raises(format('select public.number_start(%L)', m), 'not_everyone_ready'), 'everyone ready first';
  perform pg_temp.as_user(u[2]);
  perform public.set_room_ready(room, true);
  perform pg_temp.as_user(u[1]);
  x := public.number_start(m);
  select * into mt from public.number_trail_matches where id = m;
  assert mt.status = 'countdown', 'A8 countdown';
  assert (select count(*) from public.number_trail_assignments where match_id = m and target_number = '07') = 2, 'A8 both assigned 07';
  assert (select count(distinct course_digest) from public.number_trail_assignments where match_id = m) = 1, 'A8 one course for all';
  assert (select course_digest from public.number_trail_assignments where match_id = m limit 1) = (select md5(course::text) from public.number_trail_courses where match_id = m), 'A8 digest is the stored course';
  assert (select status from public.multiplayer_rooms where id = room) = 'playing', 'A8 room playing';
  raise notice 'pass  A8 one number and one course for everyone';

  -- A7. Server start time: countdown from the database clock; nobody can move it.
  assert mt.starts_at = mt.countdown_at + interval '8 seconds' and mt.ends_at = mt.starts_at + interval '45 minutes', 'A7 start = countdown + 8 s, limit 2 x 15 + 15 min';
  assert mt.countdown_at between now() and clock_timestamp(), 'A7 countdown at server time';
  assert (x ->> 'startsAt')::timestamptz = mt.starts_at, 'A7 reply carries the server start';
  assert pg_temp.raises(format('update public.number_trail_matches set starts_at = starts_at - interval %L where id = %L', '5 seconds', m), 'match_locked'), 'A7 start time locked, even for the service role';
  perform pg_temp.as_user(u[1]);
  assert pg_temp.raises(format('select public.number_start(%L)', m), 'already_started'), 'A7 start twice';
  raise notice 'pass  A7 server-issued start time, locked';

  -- A10. Nothing about the course changes after the start.
  assert pg_temp.raises(format('update public.number_trail_assignments set target_number = %L where match_id = %L', '42', m), 'assignment_locked'), 'A10 assignment number locked';
  assert pg_temp.raises(format('update public.number_trail_assignments set course_digest = %L where match_id = %L', 'x', m), 'assignment_locked'), 'A10 digest locked';
  assert pg_temp.raises(format('update public.number_trail_courses set course = %L where match_id = %L', pg_temp.course('07'), m), 'assignment_locked'), 'A10 course locked';
  assert pg_temp.raises(format('delete from public.number_trail_courses where match_id = %L', m), 'assignment_locked'), 'A10 course cannot be deleted';
  assert pg_temp.raises(format('update public.number_trail_matches set target_number = %L where id = %L', '42', m), 'match_locked'), 'A10 match number locked';
  perform pg_temp.as_user(u[1]);
  assert pg_temp.raises(format('select public.number_set_settings(%L, 40, null, 10)', m), 'match_not_editable'), 'A10 settings locked';
  assert pg_temp.raises(format('select public.number_begin_prepare(%L, %L)', m, u[1]), 'match_not_editable'), 'A10 no new number';
  raise notice 'pass  A10 course and assignments locked from the countdown';

  -- A6. Invalid lifecycle transitions, for any role.
  assert pg_temp.raises(format('update public.number_trail_matches set status = %L where id = %L', 'completed', m), 'bad_transition'), 'A6 countdown -> completed';
  assert pg_temp.raises(format('update public.number_trail_matches set status = %L where id = %L', 'waiting', m), 'bad_transition'), 'A6 countdown -> waiting';
  assert pg_temp.raises(format('update public.number_trail_matches set status = %L where id = %L', 'ready', m2), 'bad_transition'), 'A6 waiting -> ready';
  assert public.number_can_transition('countdown', 'active') and not public.number_can_transition('completed', 'active') and not public.number_can_transition('cancelled', 'waiting'), 'A6 table';
  -- Before the start time, nothing is accepted.
  assert pg_temp.raises(format('select public.number_receive_finish(%L, %L, %L)', m, u[2], 'early-key-1'), 'match_not_active'), 'A6 no finish during countdown';
  raise notice 'pass  A6 invalid transitions refused';

  -- Countdown ends by the clock: active, MATCH_STARTED once.
  perform pg_temp.shift(m, 9);
  perform pg_temp.as_user(u[2]);
  assert public.number_advance(m) = 'active', 'active after start time';
  assert public.number_advance(m) = 'active' and pg_temp.count_kind(m, 'MATCH_STARTED') = 1, 'started once';
  perform pg_temp.as_user(u[9]);
  assert pg_temp.raises(format('select public.number_advance(%L)', m), 'not_in_match'), 'outsider cannot advance';

  -- A11. Progress ownership: only the server writes it, and each player reads only their own.
  perform pg_temp.as_user(null);
  x := public.number_record_progress(m, u[2], 'DIGIT_1_IN_PROGRESS', 0, 0.2, '{"phase": "DIGIT_1_IN_PROGRESS"}', '{"secret": "own only"}', 40);
  assert (x ->> 'recorded')::boolean, 'A11 recorded';
  assert pg_temp.raises(format('select public.number_record_progress(%L, %L, %L, 0, 0, %L, %L, 1)', m, u[9], 'DIGIT_1_PENDING', '{}', '{}'), 'not_in_match'), 'A11 outsider';
  x := public.number_record_progress(m, u[2], 'DIGIT_1_PENDING', 0, 0.1, '{}', '{}', 30);
  assert not (x ->> 'recorded')::boolean, 'A11 older check never replaces a newer one';
  execute 'set local role authenticated';
  perform pg_temp.as_user(u[1]);
  assert (select count(*) from public.number_trail_progress where match_id = m) = 1, 'A11 host sees only own progress row';
  assert (select count(*) from public.number_trail_progress where match_id = m and user_id = u[2]) = 0, 'A11 not the other player''s';
  assert pg_temp.raises(format('select public.number_record_progress(%L, %L, %L, 2, 1, %L, %L, 999)', m, u[1], 'DIGIT_2_COMPLETE', '{}', '{}'), 'permission denied'), 'A11 players cannot call the server function';
  update public.number_trail_progress set digits_done = 2 where match_id = m;
  get diagnostics n = row_count;
  assert n = 0, 'A11 players cannot write progress';
  perform pg_temp.as_user(u[2]);
  s := public.number_race_state(m, 0, null);
  assert s -> 'me' -> 'progress' ->> 'secret' = 'own only', 'A11 own progress in own state';
  perform pg_temp.as_user(u[1]);
  s := public.number_race_state(m, 0, null);
  assert s::text not like '%own only%', 'A11 another player''s own progress never shown';
  execute 'reset role';
  raise notice 'pass  A11 progress ownership';

  -- A12. Finish record uniqueness and idempotency.
  perform pg_temp.as_user(null);
  a1 := public.number_receive_finish(m, u[2], 'finish-key-0001');
  assert a1 ->> 'status' = 'pending' and not (a1 ->> 'repeated')::boolean, 'A12 received';
  assert (select status from public.number_trail_matches where id = m) = 'verifying', 'A12 verifying';
  a2 := public.number_receive_finish(m, u[2], 'finish-key-0001');
  assert a2 ->> 'id' = a1 ->> 'id' and (a2 ->> 'repeated')::boolean, 'A12 same key, same attempt';
  a3 := public.number_receive_finish(m, u[2], 'finish-key-0002');
  assert a3 ->> 'id' = a1 ->> 'id', 'A12 one finish checked at a time';
  assert pg_temp.raises(format('insert into public.number_trail_finish_attempts (match_id, user_id, request_key, receipt_seq, received_at, verify_started_at) values (%L, %L, %L, nextval(%L), now(), now())', m, u[2], 'finish-key-0003', 'number_trail_receipt_seq'), 'one_pending'), 'A12 index: one pending';
  assert pg_temp.raises(format('select public.number_receive_finish(%L, %L, %L)', m, u[2], 'short'), 'bad_request'), 'A12 key length';
  assert pg_temp.raises(format('select public.number_receive_finish(%L, %L, %L)', m, u[9], 'finish-key-9999'), 'not_in_match'), 'A12 outsider';
  -- Rejected: the player may hand in again after the cooldown.
  x := public.number_settle_finish((a1 ->> 'id')::uuid, false, 'digit_two_incomplete', 50, null, '{}');
  assert x ->> 'status' = 'rejected' and x ->> 'reason' = 'digit_two_incomplete', 'rejected with reason';
  assert (select status from public.number_trail_matches where id = m) = 'active', 'back to active';
  assert (select phase from public.number_trail_progress where match_id = m and user_id = u[2]) = 'INVALID_COMPLETION', 'invalid completion shown';
  assert pg_temp.raises(format('select public.number_receive_finish(%L, %L, %L)', m, u[2], 'finish-key-0004'), 'slow_down'), 'cooldown';
  x := public.number_settle_finish((a1 ->> 'id')::uuid, true, null, 99, 'h', '{}');
  assert x ->> 'status' = 'rejected', 'a settled attempt never changes';
  raise notice 'pass  A12 finish attempts unique, idempotent, one at a time';

  -- ======================= D. Winners =======================

  -- D1. First valid completion wins.
  perform pg_temp.age_attempts(m, 10);
  a1 := public.number_receive_finish(m, u[2], 'finish-key-0005');
  x := public.number_settle_finish((a1 ->> 'id')::uuid, true, null, 120, 'track-u2-m', '{"ok": true}');
  assert x ->> 'status' = 'verified' and (x ->> 'finishOrder')::integer = 1 and (x ->> 'winnerUserId')::uuid = u[2], 'D1 verified, first';
  select * into mt from public.number_trail_matches where id = m;
  assert mt.status = 'completed' and mt.winner_user_id = u[2] and mt.outcome = 'winner' and mt.finalized_at is not null, 'D1 completed and final';
  assert (select count(*) from public.number_trail_results where match_id = m) = 2, 'D1 everyone placed';
  assert (select placement from public.number_trail_results where match_id = m and user_id = u[1]) = 2 and not (select finished from public.number_trail_results where match_id = m and user_id = u[1]), 'D1 the other is second, not finished';
  assert (select status from public.multiplayer_rooms where id = room) = 'finished', 'D1 room finished';
  assert (select count(*) from public.gps_sessions where number_match_id = m and status in ('active', 'paused')) = 0, 'D1 walks closed';
  raise notice 'pass  D1 first valid completion wins';

  -- D6. A retry after success returns the decided result.
  a2 := public.number_receive_finish(m, u[2], 'finish-key-0005');
  assert (a2 ->> 'repeated')::boolean and a2 ->> 'status' = 'verified' and (a2 ->> 'finish_order')::integer = 1, 'D6 retry returns the result';
  assert pg_temp.raises(format('select public.number_receive_finish(%L, %L, %L)', m, u[2], 'finish-key-0006'), 'already_finished'), 'D6 a new request after finishing';
  -- Receipts after completion are refused.
  assert pg_temp.raises(format('select public.number_receive_finish(%L, %L, %L)', m, u[1], 'finish-key-0101'), 'match_completed'), 'D after completion';
  raise notice 'pass  D6 retry after success';

  -- D9. Results can't be changed by a player, or by anyone.
  assert pg_temp.raises(format('update public.number_trail_results set placement = 1 where match_id = %L and user_id = %L', m, u[1]), 'result_locked'), 'D9 results immutable';
  assert pg_temp.raises(format('delete from public.number_trail_results where match_id = %L', m), 'result_locked'), 'D9 results not deleted';
  assert pg_temp.raises(format('update public.number_trail_matches set winner_user_id = %L where id = %L', u[1], m), 'result_locked'), 'D9 winner locked';
  assert pg_temp.raises(format('update public.number_trail_matches set status = %L where id = %L', 'active', m), 'bad_transition'), 'D9 completed is final';
  execute 'set local role authenticated';
  perform pg_temp.as_user(u[1]);
  update public.number_trail_matches set result = '{}'::jsonb where id = m;
  get diagnostics n = row_count;
  assert n = 0, 'D9 players cannot update matches';
  insert into public.number_trail_results (match_id, user_id, placement, finished) select m, u[1], 1, false where false;
  assert pg_temp.raises(format('insert into public.number_trail_results (match_id, user_id, placement, finish_order, finished, is_winner) values (%L, %L, 1, 1, true, true)', m, u[1]), 'row-level security'), 'D9 players cannot insert results';
  assert pg_temp.raises(format('select public.number_settle_finish(%L, true, null, 1, null, %L)', a1 ->> 'id', '{}'), 'permission denied'), 'D9 players cannot settle';
  assert pg_temp.raises(format('select public.number_receive_finish(%L, %L, %L)', m, u[1], 'finish-key-0102'), 'permission denied'), 'D9 players cannot call receive directly';
  execute 'reset role';
  raise notice 'pass  D9 results immutable to players and server alike';

  -- D8. A player offline when the match ended gets the right result on reconnect.
  perform pg_temp.as_user(u[1]);
  s := public.number_race_state(m, 0, null);
  assert s -> 'match' ->> 'status' = 'completed' and (s -> 'match' ->> 'winnerUserId')::uuid = u[2] and (s -> 'match' ->> 'finalized')::boolean, 'D8 completed state';
  assert jsonb_array_length(s -> 'results') = 2 and (s -> 'me' -> 'result' ->> 'placement')::integer = 2, 'D8 own placement';
  assert (select count(*) from jsonb_array_elements(s -> 'events') e where e ->> 'kind' = 'MATCH_COMPLETED') = 1, 'D8 one completion event';
  raise notice 'pass  D8 match ended while offline: canonical result on reconnect';

  -- D2 + D3. Three racers. An invalid first finish doesn't win; a later receipt verified early waits for the earlier one.
  m := pg_temp.racing(u[10], array[u[11], u[12]], '42');
  perform pg_temp.as_user(null);
  a1 := public.number_receive_finish(m, u[11], 'race2-key-0001');
  a2 := public.number_receive_finish(m, u[12], 'race2-key-0002');
  a3 := public.number_receive_finish(m, u[10], 'race2-key-0003');
  assert (a1 ->> 'receipt_seq')::bigint < (a2 ->> 'receipt_seq')::bigint and (a2 ->> 'receipt_seq')::bigint < (a3 ->> 'receipt_seq')::bigint, 'receipts strictly ordered';
  assert (a1 ->> 'received_at')::timestamptz <= (a2 ->> 'received_at')::timestamptz, 'receipt times follow receipt order';
  -- The third receipt is checked first and is valid: it must wait.
  x := public.number_settle_finish((a3 ->> 'id')::uuid, true, null, 90, 'track-u10', '{}');
  assert x ->> 'status' = 'verified' and x ->> 'finishOrder' is null and (x ->> 'waitingOnEarlier')::integer = 2 and x ->> 'winnerUserId' is null, 'D3 later valid receipt waits';
  assert (select status from public.number_trail_matches where id = m) = 'verifying', 'D3 still verifying';
  assert pg_temp.count_kind(m, 'MATCH_COMPLETED') = 0 and pg_temp.count_kind(m, 'PLAYER_FINISHED') = 0, 'D3 no winner announced early';
  -- The first receipt is invalid.
  x := public.number_settle_finish((a1 ->> 'id')::uuid, false, 'connector_invalid', 80, null, '{}');
  assert x ->> 'status' = 'rejected' and (select winner_user_id from public.number_trail_matches where id = m) is null, 'D2 invalid first attempt does not win';
  -- The second is valid: it wins, then the third is placed second.
  x := public.number_settle_finish((a2 ->> 'id')::uuid, true, null, 85, 'track-u12', '{}');
  assert (x ->> 'finishOrder')::integer = 1 and (x ->> 'winnerUserId')::uuid = u[12], 'D2 second receipt wins';
  assert (select finish_order from public.number_trail_results where match_id = m and user_id = u[10]) = 2, 'D3 third receipt placed second';
  assert (select placement from public.number_trail_results where match_id = m and user_id = u[11]) = 3, 'D2 rejected player ranked after finishers';
  assert (select (result ->> 'photoFinish')::boolean from public.number_trail_matches where id = m), 'D3 receipts within 2 s: photo finish';
  raise notice 'pass  D2 invalid first attempt does not win; D3 near-simultaneous finishes follow receipt order';

  -- D10. One winner, ever.
  assert (select count(*) from public.number_trail_results where match_id = m and is_winner) = 1, 'D10 one winner row';
  assert pg_temp.raises(format('insert into public.number_trail_results (match_id, user_id, placement, finish_order, finished, is_winner) values (%L, %L, 1, 1, true, true)', m, u[11]), 'duplicate key'), 'D10 index refuses a second winner';
  assert pg_temp.count_kind(m, 'MATCH_COMPLETED') = 1, 'D10 one completion event';
  raise notice 'pass  D10 no contradictory winners';

  -- D7. Disconnect during verification: the check can be run again after a minute; after ten it is given up.
  m := pg_temp.racing(u[13], array[u[14]], '90');
  perform pg_temp.as_user(null);
  a1 := public.number_receive_finish(m, u[14], 'race3-key-0001');
  assert public.number_claim_verification((a1 ->> 'id')::uuid) is null, 'D7 a running check is not taken over';
  assert (select count(*) from public.number_stale_attempts(m)) = 0, 'D7 not stale yet';
  update public.number_trail_finish_attempts set verify_started_at = verify_started_at - interval '61 seconds' where id = (a1 ->> 'id')::uuid;
  assert (select count(*) from public.number_stale_attempts(m)) = 1, 'D7 stale after a minute';
  x := public.number_claim_verification((a1 ->> 'id')::uuid);
  assert x ->> 'id' = a1 ->> 'id' and (x ->> 'verify_count')::integer = 2, 'D7 check claimed again';
  update public.number_trail_finish_attempts set verify_started_at = verify_started_at - interval '11 minutes' where id = (a1 ->> 'id')::uuid;
  perform public.number_advance(m);
  assert (select status from public.number_trail_finish_attempts where id = (a1 ->> 'id')::uuid) = 'expired', 'D7 abandoned check expires';
  assert (select status from public.number_trail_matches where id = m) = 'active', 'D7 race goes on';
  perform pg_temp.age_attempts(m, 10);
  a2 := public.number_receive_finish(m, u[14], 'race3-key-0002');
  x := public.number_settle_finish((a2 ->> 'id')::uuid, true, null, 70, 'track-u14', '{}');
  assert (x ->> 'winnerUserId')::uuid = u[14], 'D7 player can hand in again and win';
  raise notice 'pass  D7 disconnect during verification recovers';

  -- Replays: the exact same recorded track can't win another match.
  m := pg_temp.racing(u[15], array[u[16]], '27');
  perform pg_temp.as_user(null);
  a1 := public.number_receive_finish(m, u[16], 'race4-key-0001');
  x := public.number_settle_finish((a1 ->> 'id')::uuid, true, null, 70, 'track-u14', '{}');
  assert x ->> 'status' = 'rejected' and x ->> 'reason' = 'replayed_walk', 'replayed track refused';
  raise notice 'pass  a track already verified in another match is refused as a replay';

  -- Time limit: nobody finishes, the race ends with no winner and everyone ranked by progress.
  perform public.number_record_progress(m, u[15], 'DIGIT_2_IN_PROGRESS', 1, 0.6, '{}', '{}', 10);
  perform pg_temp.shift(m, 66 * 60); -- 25 min race: limit 2 x 25 + 15 = 65 min
  assert pg_temp.raises(format('select public.number_receive_finish(%L, %L, %L)', m, u[15], 'race4-key-0002'), 'match_over'), 'no finish after the limit';
  assert public.number_advance(m) = 'completed', 'ends at the limit';
  select * into mt from public.number_trail_matches where id = m;
  assert mt.outcome = 'no_finisher' and mt.winner_user_id is null and mt.finalized_at is not null, 'no finisher';
  assert (select placement from public.number_trail_results where match_id = m and user_id = u[15]) = 1 and (select placement from public.number_trail_results where match_id = m and user_id = u[16]) = 2, 'ranked by progress';
  assert (select count(*) from public.number_trail_results where match_id = m and is_winner) = 0, 'no winner row';
  raise notice 'pass  time limit: no finisher, ranked by verified progress';

  -- A5. Capacity: at most the room's size and never more than ten.
  m := pg_temp.drawn(u[17], array[u[18], u[19]], '11', 3);
  perform pg_temp.as_user(u[20]);
  assert pg_temp.raises(format('select public.join_room(%L, null, null, %L)', (select r.code from public.multiplayer_rooms r join public.number_trail_matches x on x.room_id = r.id where x.id = m), 'Late'), 'room_full'), 'A5 full room refuses joins';
  update public.multiplayer_rooms set max_players = 2 where id = (select room_id from public.number_trail_matches where id = m);
  perform pg_temp.as_user(u[17]);
  assert pg_temp.raises(format('select public.number_start(%L)', m), 'match_full'), 'A5 more players than places';
  perform pg_temp.as_user(u[9]);
  assert pg_temp.raises(format('select public.create_room(%L, %L, 11, false, 10, true, null, %L)', 'number_trail', 'Too big', 'X'), 'multiplayer_rooms_max_players_check'), 'A5 never more than ten';
  raise notice 'pass  A5 capacity enforced';

  -- Leaving: before the start a player simply goes; during the race their assignment is marked and they can't finish.
  m := pg_temp.racing(u[21], array[u[22], u[23]], '58');
  perform pg_temp.as_user(u[23]);
  perform public.leave_room((select room_id from public.number_trail_matches where id = m));
  assert (select status from public.number_trail_assignments where match_id = m and user_id = u[23]) = 'left', 'left mid-race';
  perform pg_temp.as_user(null);
  assert pg_temp.raises(format('select public.number_receive_finish(%L, %L, %L)', m, u[23], 'race5-key-0001'), 'not_in_room'), 'cannot finish after leaving';
  assert pg_temp.count_kind(m, 'PLAYER_LEFT') = 1, 'left event';
  -- Host cancels: everything stops, walks closed and their points deleted.
  perform public.number_begin_walk(m, u[22]);
  perform public.number_store_points((select id from public.gps_sessions where number_match_id = m and user_id = u[22]),
    '[{"seq": 1, "segment": 0, "latitude": 37.77, "longitude": -122.42, "accuracyM": 5, "capturedAt": 1800000000000}]'::jsonb);
  perform pg_temp.as_user(u[22]);
  assert pg_temp.raises(format('select public.number_cancel(%L)', m), 'not_the_host'), 'cancel host only';
  perform pg_temp.as_user(u[21]);
  perform public.number_cancel(m);
  assert (select status from public.number_trail_matches where id = m) = 'cancelled' and pg_temp.count_kind(m, 'MATCH_CANCELLED') = 1, 'cancelled';
  assert (select count(*) from public.gps_points p join public.gps_sessions s on s.id = p.session_id where s.number_match_id = m) = 0, 'cancelled walks keep no points';
  perform pg_temp.as_user(null);
  assert pg_temp.raises(format('select public.number_begin_walk(%L, %L)', m, u[22]), 'match_not_active'), 'no walking in a cancelled match';
  -- The room comes back for another race.
  perform pg_temp.as_user(u[21]);
  perform public.reopen_room((select room_id from public.number_trail_matches where id = m));
  m2 := (public.number_create_match((select room_id from public.number_trail_matches where id = m), 40, 'medium') ->> 'matchId')::uuid;
  assert m2 <> m and (select status from public.number_trail_matches where id = m2) = 'waiting', 'play again: a new match';
  raise notice 'pass  leaving mid-race, host cancellation, room recovery';

  -- A room cancelled while racing cancels the race.
  m := pg_temp.racing(u[24], array[u[25]], '33');
  perform pg_temp.as_user(u[24]);
  perform public.cancel_room((select room_id from public.number_trail_matches where id = m));
  assert (select status from public.number_trail_matches where id = m) = 'cancelled', 'room cancel cancels the race';

  -- Walks: one GPS session per player per match, reopened if another walk closed it.
  m := pg_temp.racing(u[26], array[u[27]], '64');
  perform pg_temp.as_user(null);
  x := public.number_begin_walk(m, u[27]);
  assert not (x ->> 'resumed')::boolean, 'walk opened';
  a1 := public.number_begin_walk(m, u[27]);
  assert a1 ->> 'sessionId' = x ->> 'sessionId' and (a1 ->> 'resumed')::boolean, 'same walk resumed';
  update public.gps_sessions set status = 'expired' where id = (x ->> 'sessionId')::uuid;
  a1 := public.number_begin_walk(m, u[27]);
  assert a1 ->> 'sessionId' = x ->> 'sessionId' and (select status from public.gps_sessions where id = (x ->> 'sessionId')::uuid) = 'active', 'closed walk reopened, never a second one';
  assert pg_temp.raises(format('select public.number_begin_walk(%L, %L)', m, u[9]), 'not_in_match'), 'outsider has no walk';
  assert pg_temp.raises(format('insert into public.gps_sessions (user_id) values (%L)', u[27]), 'gps_sessions_owner_check'), 'a walk belongs to a tournament or a match';
  -- Points: repeats ignored, only those received by the cut-off are judged.
  perform public.number_store_points((x ->> 'sessionId')::uuid, '[{"seq": 1, "segment": 0, "latitude": 37.77, "longitude": -122.42, "accuracyM": 5, "capturedAt": 1800000000000},
    {"seq": 2, "segment": 0, "latitude": 37.7701, "longitude": -122.42, "accuracyM": 5, "capturedAt": 1800000004000}]'::jsonb);
  assert public.number_store_points((x ->> 'sessionId')::uuid, '[{"seq": 2, "segment": 0, "latitude": 1, "longitude": 1, "accuracyM": 5, "capturedAt": 1800000004000}]'::jsonb) = 2, 'repeat ignored';
  assert jsonb_array_length(public.number_points(m, u[27], clock_timestamp())) = 2, 'two points';
  assert (public.number_points(m, u[27], clock_timestamp()) -> 1 ->> 'latitude')::float8 = 37.7701, 'repeat did not overwrite';
  assert jsonb_array_length(public.number_points(m, u[27], now() - interval '1 second')) = 0, 'points received after the cut-off are not judged';
  assert jsonb_array_length(public.number_points(m, u[26], clock_timestamp())) = 0, 'another player''s points are not mixed in';
  x := public.number_walk_context(m, u[27]);
  assert (x -> 'session' ->> 'last_seq')::integer = 2 and (x ->> 'receivedLastMinute')::integer = 2 and (x ->> 'member')::boolean, 'walk context';

  -- ======================= E. Realtime =======================

  -- E1-E7. Events: what happened, in order, once each, gapless, and broadcast on the room's private channel.
  m := pg_temp.drawn(u[28], array[u[29]], '05');
  perform pg_temp.as_user(u[30]);
  perform public.join_room((select r.code from public.multiplayer_rooms r join public.number_trail_matches x on x.room_id = r.id where x.id = m), null, null, 'Zed');
  perform public.set_room_ready((select room_id from public.number_trail_matches where id = m), true);
  assert pg_temp.count_kind(m, 'PLAYER_JOINED') = 1 and pg_temp.count_kind(m, 'PLAYER_READY') = 1, 'E1 room updates as events';
  perform pg_temp.as_user(u[28]);
  x := public.number_start(m);
  assert (select (payload ->> 'startsAt')::timestamptz from public.number_trail_events where match_id = m and kind = 'COUNTDOWN_STARTED') = (select starts_at from public.number_trail_matches where id = m), 'E2 countdown carries the server start';
  perform pg_temp.shift(m, 6);
  perform pg_temp.as_user(null);
  perform public.number_record_progress(m, u[29], 'DIGIT_1_COMPLETE', 1, 0.5, '{}', '{}', 50);
  perform public.number_record_progress(m, u[29], 'CONNECTOR_IN_PROGRESS', 1, 0.5, '{}', '{}', 60);
  assert pg_temp.count_kind(m, 'MATCH_STARTED') = 1, 'E3 started (by the first race write after the start time)';
  assert pg_temp.count_kind(m, 'DIGIT_1_COMPLETED') = 1, 'E4 digit completion announced once';
  perform public.number_record_progress(m, u[29], 'DIGIT_2_COMPLETE', 2, 1, '{}', '{}', 70);
  assert pg_temp.count_kind(m, 'DIGIT_2_COMPLETED') = 1, 'E4 digit two';
  a1 := public.number_receive_finish(m, u[29], 'race6-key-0001');
  assert pg_temp.count_kind(m, 'FINISH_VERIFYING') = 1, 'E5 verification broadcast';
  perform public.number_settle_finish((a1 ->> 'id')::uuid, true, null, 70, 'track-u29', '{}');
  assert pg_temp.count_kind(m, 'MATCH_COMPLETED') = 1 and pg_temp.count_kind(m, 'PLAYER_FINISHED') = 1 and pg_temp.count_kind(m, 'RESULTS_FINAL') = 1, 'E6 winner announced once';
  assert (select count(*) = max(seq) and min(seq) = 1 and max(seq) = (select seq from public.number_trail_matches where id = m) from public.number_trail_events where match_id = m), 'E7 gapless sequence';
  assert (select count(*) from realtime.messages where topic = 'room:' || (select room_id from public.number_trail_matches where id = m) and event = 'number')
    = (select count(*) from public.number_trail_events where match_id = m), 'E7 every event broadcast';
  assert (select bool_and((payload ->> 'seq')::bigint > 0 and payload ->> 'matchId' = m::text) from realtime.messages where event = 'number' and topic = 'room:' || (select room_id from public.number_trail_matches where id = m)), 'E7 broadcasts carry match and sequence';
  raise notice 'pass  E1-E7 room, countdown, start, digits, verification and winner events, gapless and broadcast';

  -- E8. Catching up: events after a sequence number, from the database.
  perform pg_temp.as_user(u[30]);
  s := public.number_race_state(m, 5, null);
  assert (select bool_and((e ->> 'seq')::integer > 5) from jsonb_array_elements(s -> 'events') e), 'E8 only newer events';
  assert (s ->> 'lastSeq')::integer = (select seq from public.number_trail_matches where id = m), 'E8 last sequence';

  -- E11. Unauthorized channel subscription: only room members receive the room's broadcasts.
  execute 'set local role authenticated';
  perform set_config('realtime.topic', 'room:' || (select room_id from public.number_trail_matches where id = m), true);
  perform pg_temp.as_user(u[30]);
  assert (select count(*) from realtime.messages where event = 'number') > 0, 'E11 member receives';
  perform pg_temp.as_user(u[9]);
  assert (select count(*) from realtime.messages) = 0, 'E11 outsider receives nothing';
  assert pg_temp.raises(format('insert into realtime.messages (topic, extension, event, payload) values (%L, %L, %L, %L)',
    'room:' || (select room_id from public.number_trail_matches where id = m), 'broadcast', 'number', '{"kind": "MATCH_COMPLETED"}'), 'row-level security'), 'E11 nobody but the server broadcasts';
  perform pg_temp.as_user(u[30]);
  assert pg_temp.raises(format('insert into realtime.messages (topic, extension, event, payload) values (%L, %L, %L, %L)',
    'room:' || (select room_id from public.number_trail_matches where id = m), 'broadcast', 'number', '{"kind": "MATCH_COMPLETED"}'), 'row-level security'), 'E11 not even members fake a result';
  execute 'reset role';
  raise notice 'pass  E11 private channel: members only, server-only broadcasts';

  -- E12. No location leaks: no event, broadcast or other player's view carries coordinates.
  assert not exists (select 1 from public.number_trail_events e where e.payload::text ~* '(latitude|longitude|coords|"lat"|"lng")'), 'E12 events carry no coordinates';
  assert not exists (select 1 from realtime.messages where event = 'number' and payload::text ~* '(latitude|longitude|coords)'), 'E12 broadcasts carry no coordinates';
  perform pg_temp.as_user(u[30]);
  s := public.number_race_state(m, 0, null);
  assert (s -> 'players')::text !~* '(latitude|longitude|coords)', 'E12 other players shown without coordinates';
  raise notice 'pass  E12 no location leakage';

  -- RLS: own rows only for assignments and attempts; members only for matches, courses, events, results; no cache.
  execute 'set local role authenticated';
  perform pg_temp.as_user(u[29]);
  assert (select count(*) from public.number_trail_finish_attempts where match_id = m) = 1, 'own attempts';
  assert (select count(*) from public.number_trail_assignments where match_id = m) = 1, 'own assignment only';
  assert (select count(*) from public.number_trail_results where match_id = m) = 3, 'members read results';
  assert (select count(*) from public.number_trail_courses where match_id = m) = 1, 'members read the course';
  assert (select count(*) from public.number_trail_plan_cache) = 0, 'nobody reads the plan cache';
  perform pg_temp.as_user(u[9]);
  assert (select count(*) from public.number_trail_matches where id = m) = 0 and (select count(*) from public.number_trail_courses where match_id = m) = 0
    and (select count(*) from public.number_trail_events where match_id = m) = 0 and (select count(*) from public.number_trail_results where match_id = m) = 0, 'outsiders read nothing';
  assert (select count(*) from public.gps_points p join public.gps_sessions s on s.id = p.session_id where s.number_match_id is not null) = 0, 'outsiders read no GPS';
  perform pg_temp.as_user(u[26]);
  assert (select count(*) from public.gps_points p join public.gps_sessions s on s.id = p.session_id where s.user_id = u[27]) = 0, 'another racer''s GPS is private';
  execute 'reset role';
  raise notice 'pass  A14 row level security';

  -- A13 (again, from the cascade side): results go with the match, never alone.
  delete from public.multiplayer_rooms where id = (select room_id from public.number_trail_matches where id = m);
  assert (select count(*) from public.number_trail_results where match_id = m) = 0, 'A13 results deleted only with their match';
  raise notice 'pass  A13 result immutability';

  -- Plan cache: write, read, expire.
  perform public.number_plan_cache_put('k1', 'fp', 'osm:n1', 25, 'number-trail-v1', 'ok', '[{"number": "07"}]', '{}', '[]', 24);
  assert public.number_plan_cache_get('k1') -> 'plans' -> 0 ->> 'number' = '07', 'cache read';
  update public.number_trail_plan_cache set expires_at = now() - interval '1 minute' where cache_key = 'k1';
  assert public.number_plan_cache_get('k1') is null, 'expired cache ignored';
  raise notice 'pass  plan cache';
end;
$$;

rollback;
