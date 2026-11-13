#!/usr/bin/env bash
# Concurrency checks for Number Trail, with real parallel database sessions. Run by scripts/test-db-local.sh on the
# throwaway cluster only (it commits its own test data). Expects PGHOST/PGPORT/PGUSER/PGDATABASE and PSQL_BIN.
set -euo pipefail
PSQL=("${PSQL_BIN:-psql}" -X -q -t -A -v ON_ERROR_STOP=1)
q() { "${PSQL[@]}" -c "$1"; }
fail() { echo "   FAIL  number concurrency: $1"; exit 1; }

# ---- Setup: one room of eight, drawn, committed so other sessions can see it.
"${PSQL[@]}" >/dev/null <<'SQL'
drop schema if exists ncc cascade;
create schema ncc;
create table ncc.ids (k text primary key, v uuid);
create table ncc.out (k text primary key, started timestamptz, finished timestamptz, result jsonb, error text);
create function ncc.id(name text) returns uuid language sql stable as $$ select v from ncc.ids where k = name $$;
create function ncc.course(n text) returns jsonb language sql immutable as $$
  select jsonb_build_object('version', 'number-match-v1', 'raceVersion', 'number-race-v1', 'algorithm', 'number-trail-v1', 'number', n,
    'layout', 'side_by_side', 'difficulty', 'easy', 'raceM', 1450, 'start', jsonb_build_object('nodeId', 'osm:n1', 'latitude', 37.77, 'longitude', -122.42),
    'digits', jsonb_build_array(jsonb_build_object('digit', substr(n, 1, 1)), jsonb_build_object('digit', substr(n, 2, 1))));
$$;
do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 8));
  r jsonb;
  m uuid;
  t uuid;
begin
  for i in 1..8 loop
    insert into auth.users (id, email) values (u[i], 'ncc' || i || '@test.paws');
    insert into ncc.ids values ('u' || i, u[i]);
  end loop;
  perform set_config('request.jwt.claim.sub', u[1]::text, true);
  r := public.create_room('number_trail', 'ncc race', 10, false, 5, true, null, 'H');
  for i in 2..8 loop
    perform set_config('request.jwt.claim.sub', u[i]::text, true);
    perform public.join_room(r ->> 'code', null, null, 'P' || i);
    perform public.set_room_ready((r ->> 'roomId')::uuid, true);
  end loop;
  perform set_config('request.jwt.claim.sub', u[1]::text, true);
  m := (public.number_create_match((r ->> 'roomId')::uuid, 25, null) ->> 'matchId')::uuid;
  t := (public.number_begin_prepare(m, u[1]) ->> 'token')::uuid;
  perform public.number_record_course(m, t, ncc.course('08'), '{"source": "osm"}', '[]', 'fp', 4);
  insert into ncc.ids values ('m', m), ('room', (r ->> 'roomId')::uuid);
end;
$$;
SQL

# Runs one SQL expression in its own session, records its result or error, holding the transaction open `hold` seconds.
run() { # key user-or-empty hold expression
  local claim=""
  [[ -n "$2" ]] && claim="select set_config('request.jwt.claim.sub', ncc.id('$2')::text, true);"
  "${PSQL[@]}" >/dev/null 2>&1 <<SQL || true
begin;
$claim
insert into ncc.out (k, started) values ('$1', clock_timestamp());
do \$\$
begin
  update ncc.out set result = ($4)::jsonb where k = '$1';
exception when others then
  update ncc.out set error = sqlerrm where k = '$1';
end;
\$\$;
select pg_sleep($3);
commit;
update ncc.out set finished = clock_timestamp() where k = '$1';
SQL
}

# ---- 1. The host double-taps Start: one countdown, one set of assignments.
run start_a u1 0.8 "public.number_start(ncc.id('m'))" &
sleep 0.2
run start_b u1 0 "public.number_start(ncc.id('m'))" &
wait
started=$(q "select count(*) filter (where result is not null) || ':' || count(*) filter (where error = 'already_started') from ncc.out where k like 'start_%'")
[[ "$started" == "1:1" ]] || fail "double start gave $started (started:already_started)"
n=$(q "select count(*) from public.number_trail_assignments where match_id = ncc.id('m')")
[[ "$n" == "8" ]] || fail "$n assignments after a double start"
echo "   pass  a double-tapped start makes one countdown and one set of assignments"

# ---- 2. Many phones ask to move the match on the moment the countdown ends: it starts once.
"${PSQL[@]}" >/dev/null <<'SQL'
alter table public.number_trail_matches disable trigger number_trail_matches_guard;
update public.number_trail_matches set countdown_at = countdown_at - interval '10 seconds', starts_at = starts_at - interval '10 seconds', ends_at = ends_at - interval '10 seconds' where id = ncc.id('m');
alter table public.number_trail_matches enable trigger number_trail_matches_guard;
SQL
for i in 1 2 3 4 5 6; do run "tick_$i" "" 0 "to_jsonb(public.number_advance(ncc.id('m')))" & done
wait
n=$(q "select count(*) from public.number_trail_events where match_id = ncc.id('m') and kind = 'MATCH_STARTED'")
[[ "$n" == "1" ]] || fail "match started $n times"
echo "   pass  six simultaneous clock ticks start the race once"

# ---- 3. The same finish request raced against its own retry: one attempt, one receipt.
run dup_a "" 0.6 "public.number_receive_finish(ncc.id('m'), ncc.id('u8'), 'ncc-dup-key-1')" &
sleep 0.15
run dup_b "" 0 "public.number_receive_finish(ncc.id('m'), ncc.id('u8'), 'ncc-dup-key-1')" &
wait
n=$(q "select count(*) from public.number_trail_finish_attempts where match_id = ncc.id('m') and user_id = ncc.id('u8')")
same=$(q "select (a.result ->> 'id') = (b.result ->> 'id') and (b.result ->> 'repeated')::boolean from ncc.out a, ncc.out b where a.k = 'dup_a' and b.k = 'dup_b'")
[[ "$n" == "1" && "$same" == "t" ]] || fail "raced retry made $n attempts (same answer: $same)"
q "select public.number_settle_finish((result ->> 'id')::uuid, false, 'digit_two_incomplete', 1, null, '{}') from ncc.out where k = 'dup_a'" >/dev/null
echo "   pass  a finish raced against its own retry is received once"

# ---- 4. Seven players hand in at the same moment. Receipts are strictly ordered and match the order the lock was won.
for i in 1 2 3 4 5 6 7; do run "fin_$i" "" 0.2 "public.number_receive_finish(ncc.id('m'), ncc.id('u$i'), 'ncc-fin-key-$i')" & done
wait
ok=$(q "select count(distinct (result ->> 'receipt_seq')) = 7 and count(*) = 7 from ncc.out where k like 'fin_%' and result is not null")
[[ "$ok" == "t" ]] || fail "seven simultaneous finishes did not all get distinct receipts"
ok=$(q "select bool_and(ordered) from (select (received_at >= lag(received_at) over (order by receipt_seq)) is not false as ordered from public.number_trail_finish_attempts where match_id = ncc.id('m') and status = 'pending') x")
[[ "$ok" == "t" ]] || fail "receipt numbers and receipt times disagree"
echo "   pass  7 simultaneous finishes: distinct receipts, in lock order"

# ---- 5. Their checks report back in parallel and in reverse receipt order; the earliest two receipts are invalid.
#         Exactly one winner (the earliest verified receipt), finish order gapless, one completion event.
order=$(q "select string_agg(user_id::text, ' ' order by receipt_seq desc) from public.number_trail_finish_attempts where match_id = ncc.id('m') and status = 'pending'")
first_two=$(q "select string_agg(user_id::text, ' ') from (select user_id from public.number_trail_finish_attempts where match_id = ncc.id('m') and status = 'pending' order by receipt_seq limit 2) x")
expected=$(q "select user_id from public.number_trail_finish_attempts where match_id = ncc.id('m') and status = 'pending' order by receipt_seq offset 2 limit 1")
k=0
for user in $order; do
  k=$((k + 1))
  verified=true
  [[ " $first_two " == *" $user "* ]] && verified=false
  run "settle_$k" "" 0.1 "public.number_settle_finish((select id from public.number_trail_finish_attempts where match_id = ncc.id('m') and user_id = '$user' and status = 'pending'), $verified, case when $verified then null else 'connector_invalid' end, 10, 'ncc-track-$user', '{}')" &
  sleep 0.05
done
wait
winner=$(q "select winner_user_id from public.number_trail_matches where id = ncc.id('m')")
[[ "$winner" == "$expected" ]] || fail "winner $winner, expected the earliest verified receipt $expected"
ok=$(q "select count(*) filter (where is_winner) = 1 and count(*) filter (where finished) = 5 and max(finish_order) = 5 and count(distinct finish_order) = 5 from public.number_trail_results where match_id = ncc.id('m')")
[[ "$ok" == "t" ]] || fail "results after parallel settles are inconsistent"
ok=$(q "select bool_and(ok) from (select (r.finish_order = rank() over (order by a.receipt_seq)) as ok from public.number_trail_results r join public.number_trail_finish_attempts a on a.match_id = r.match_id and a.user_id = r.user_id and a.status = 'verified' where r.match_id = ncc.id('m') and r.finished) x")
[[ "$ok" == "t" ]] || fail "finish order is not receipt order"
n=$(q "select count(*) from public.number_trail_events where match_id = ncc.id('m') and kind = 'MATCH_COMPLETED'")
[[ "$n" == "1" ]] || fail "$n completion events"
ok=$(q "select count(*) = max(seq) and min(seq) = 1 and max(seq) = (select seq from public.number_trail_matches where id = ncc.id('m')) from public.number_trail_events where match_id = ncc.id('m')")
[[ "$ok" == "t" ]] || fail "event sequence has gaps or repeats"
final=$(q "select finalized_at is not null and status = 'completed' from public.number_trail_matches where id = ncc.id('m')")
[[ "$final" == "t" ]] || fail "match not finalized after every check reported back"
echo "   pass  parallel, out-of-order checks: one winner (earliest verified receipt), finish order = receipt order, one completion"

# ---- 6. A rolled-back receipt leaves nothing behind (no attempt, no event, no sequence number used up in the match).
"${PSQL[@]}" >/dev/null <<'SQL'
do $$
declare
  u uuid := gen_random_uuid();
  v uuid := gen_random_uuid();
  r jsonb;
  m uuid;
  t uuid;
begin
  insert into auth.users (id, email) values (u, 'ncc-rb1@test.paws'), (v, 'ncc-rb2@test.paws');
  insert into ncc.ids values ('rb_u', u), ('rb_v', v);
  perform set_config('request.jwt.claim.sub', u::text, true);
  r := public.create_room('number_trail', 'ncc rollback', 10, false, 5, true, null, 'U');
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform public.join_room(r ->> 'code', null, null, 'V');
  perform public.set_room_ready((r ->> 'roomId')::uuid, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  m := (public.number_create_match((r ->> 'roomId')::uuid, 25, null) ->> 'matchId')::uuid;
  t := (public.number_begin_prepare(m, u) ->> 'token')::uuid;
  perform public.number_record_course(m, t, ncc.course('19'), '{}', '[]', 'fp', 2);
  perform public.number_start(m);
  insert into ncc.ids values ('rb_m', m);
end;
$$;
alter table public.number_trail_matches disable trigger number_trail_matches_guard;
update public.number_trail_matches set countdown_at = countdown_at - interval '10 seconds', starts_at = starts_at - interval '10 seconds', ends_at = ends_at - interval '10 seconds' where id = ncc.id('rb_m');
alter table public.number_trail_matches enable trigger number_trail_matches_guard;
select public.number_advance(ncc.id('rb_m'));
SQL
before=$(q "select seq || ':' || status from public.number_trail_matches where id = ncc.id('rb_m')")
"${PSQL[@]}" >/dev/null <<'SQL'
begin;
select public.number_receive_finish(ncc.id('rb_m'), ncc.id('rb_v'), 'ncc-rollback-1');
rollback;
SQL
after=$(q "select seq || ':' || status from public.number_trail_matches where id = ncc.id('rb_m')")
n=$(q "select count(*) from public.number_trail_finish_attempts where match_id = ncc.id('rb_m')")
[[ "$before" == "$after" && "$n" == "0" ]] || fail "rolled-back receipt changed state ($before -> $after, $n attempts)"
echo "   pass  a rolled-back receipt changes nothing"

# ---- 7. Progress and finishes from different players at once never deadlock and keep one event order.
for i in 1 2 3 4; do
  run "mix_p$i" "" 0.1 "public.number_record_progress(ncc.id('rb_m'), ncc.id('rb_u'), 'DIGIT_1_IN_PROGRESS', 0, 0.$i, '{}', '{}', $i)" &
done
run mix_f "" 0.1 "public.number_receive_finish(ncc.id('rb_m'), ncc.id('rb_v'), 'ncc-mixed-key-1')" &
wait
err=$(q "select count(*) from ncc.out where k like 'mix_%' and error is not null and error not like '%could not serialize%'")
[[ "$err" == "0" ]] || fail "concurrent progress and finish raised: $(q "select string_agg(error, '; ') from ncc.out where k like 'mix_%' and error is not null")"
ok=$(q "select count(*) = max(seq) and min(seq) = 1 from public.number_trail_events where match_id = ncc.id('rb_m')")
[[ "$ok" == "t" ]] || fail "event order broken under mixed writes"
echo "   pass  concurrent progress and finish writes: no deadlock, one gapless event order"

"${PSQL[@]}" -c "drop schema ncc cascade" >/dev/null 2>&1
