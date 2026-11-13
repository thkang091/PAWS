#!/usr/bin/env bash
# Concurrency checks for team battles, with real parallel database sessions. Run by scripts/test-db-local.sh on the
# throwaway cluster only (it commits its own test data). Expects PGHOST/PGPORT/PGUSER/PGDATABASE and PSQL_BIN.
set -euo pipefail
PSQL=("${PSQL_BIN:-psql}" -X -q -t -A -v ON_ERROR_STOP=1)
q() { "${PSQL[@]}" -c "$1"; }
fail() { echo "   FAIL  concurrency: $1"; exit 1; }

# ---- Setup: one live territory match and one live road match, committed so other sessions can see them.
"${PSQL[@]}" >/dev/null <<'SQL'
drop schema if exists cc cascade;
create schema cc;
create table cc.ids (k text primary key, v uuid);
create table cc.timing (k text primary key, started timestamptz, finished timestamptz, result jsonb);
create function cc.sq(x0 float8, y0 float8, d float8) returns text language sql immutable as $$
  select json_build_object('type', 'Polygon', 'coordinates', json_build_array(json_build_array(
    json_build_array(x0, y0), json_build_array(x0 + d, y0), json_build_array(x0 + d, y0 + d), json_build_array(x0, y0 + d), json_build_array(x0, y0))))::text;
$$;
create function cc.id(name text) returns uuid language sql stable as $$ select v from cc.ids where k = name $$;
do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 9));
  r jsonb;
  m uuid;
  reg uuid;
begin
  for i in 1..9 loop
    insert into auth.users (id, email) values (u[i], 'cc' || i || '@test.paws');
    insert into public.profiles (id) values (u[i]) on conflict do nothing;
    insert into cc.ids values ('u' || i, u[i]);
  end loop;
  -- Territory: u1 blue, u2 orange, u3 blue, u4 orange.
  perform set_config('request.jwt.claim.sub', u[1]::text, true);
  r := public.create_room('steal_territory', 'cc territory', 10, true, 0, true, null, 'A');
  for i in 2..4 loop
    perform set_config('request.jwt.claim.sub', u[i]::text, true);
    perform public.join_room(r ->> 'code', null, null, 'P' || i);
    perform public.set_room_ready((r ->> 'roomId')::uuid, true);
  end loop;
  perform set_config('request.jwt.claim.sub', u[1]::text, true);
  for i in 1..4 loop
    perform public.set_member_team((r ->> 'roomId')::uuid, u[i], case when i % 2 = 1 then 'blue' else 'orange' end);
  end loop;
  m := public.start_battle((r ->> 'roomId')::uuid);
  update public.battle_matches set starts_at = now() - interval '1 second', ends_at = now() + interval '1 hour' where id = m;
  perform public.battle_advance(m);
  insert into cc.ids values ('tm', m);

  -- Road: an organizer publishes three verified roads; u5 blue, u6 orange.
  insert into public.tournament_organizers (user_id) values (u[9]);
  perform set_config('request.jwt.claim.sub', u[9]::text, true);
  reg := (public.create_competition_region('cc roads', 37.8, -122.42, 'PAWS test fixture', 'Test data', '')).id;
  perform public.import_road_graph(reg,
    jsonb_build_array(
      jsonb_build_object('key', 'a', 'latitude', 37.8, 'longitude', -122.420),
      jsonb_build_object('key', 'b', 'latitude', 37.8, 'longitude', -122.419),
      jsonb_build_object('key', 'c', 'latitude', 37.8, 'longitude', -122.418),
      jsonb_build_object('key', 'd', 'latitude', 37.8, 'longitude', -122.417)),
    jsonb_build_array(
      jsonb_build_object('startKey', 'a', 'endKey', 'b', 'name', 'R1', 'coords', '[[-122.420,37.8],[-122.419,37.8]]'::jsonb),
      jsonb_build_object('startKey', 'b', 'endKey', 'c', 'name', 'R2', 'coords', '[[-122.419,37.8],[-122.418,37.8]]'::jsonb),
      jsonb_build_object('startKey', 'c', 'endKey', 'd', 'name', 'R3', 'coords', '[[-122.418,37.8],[-122.417,37.8]]'::jsonb)));
  update public.road_edges set status = 'verified' where region_id = reg;
  perform public.publish_competition_region(reg);
  insert into cc.ids select 'r_' || name, id from public.road_edges where region_id = reg;
  perform set_config('request.jwt.claim.sub', u[5]::text, true);
  r := public.create_room('steal_road', 'cc road', 10, true, 0, true, null, 'E');
  perform set_config('request.jwt.claim.sub', u[6]::text, true);
  perform public.join_room(r ->> 'code', null, null, 'F');
  perform public.set_room_ready((r ->> 'roomId')::uuid, true);
  perform set_config('request.jwt.claim.sub', u[5]::text, true);
  perform public.set_member_team((r ->> 'roomId')::uuid, u[5], 'blue');
  perform public.set_member_team((r ->> 'roomId')::uuid, u[6], 'orange');
  perform public.set_battle_settings((r ->> 'roomId')::uuid, 15, reg);
  m := public.start_battle((r ->> 'roomId')::uuid);
  update public.battle_matches set starts_at = now() - interval '1 second', ends_at = now() + interval '1 hour' where id = m;
  perform public.battle_advance(m);
  insert into cc.ids values ('rm', m);
end;
$$;
SQL

# A claim run in its own session, timed from just before the call to just after the commit.
claim() { # key user x0 y0 d request points_hash hold_seconds
  "${PSQL[@]}" >/dev/null <<SQL
begin;
insert into cc.timing (k, started) values ('$1', clock_timestamp());
update cc.timing set result = public.commit_territory_claim(cc.id('tm'), cc.id('$2'), cc.sq($3, $4, $5), '$6', '$7') where k = '$1';
select pg_sleep($8);
commit;
update cc.timing set finished = clock_timestamp() where k = '$1';
SQL
}

# ---- 1. Opposite teams claim the same square at the same moment. The advisory lock serializes them: the second
#         waits for the first to commit, then takes the whole square. No ground ends up with both teams.
claim blue_first u1 -122.40 37.77 0.001 cc-key-blue-01 cc-h1 1.5 &
sleep 0.4
claim orange_second u2 -122.40 37.77 0.001 cc-key-orange-1 cc-h2 0 &
wait
waited=$(q "select extract(epoch from (o.finished - b.started)) >= 1.4 and o.started < b.finished from cc.timing b, cc.timing o where b.k = 'blue_first' and o.k = 'orange_second'")
[[ "$waited" == "t" ]] || fail "the second claim did not wait for the first (no serialization)"
captured=$(q "select round((result ->> 'capturedM2')::numeric) from cc.timing where k = 'orange_second'")
[[ "$captured" -ge 9700 && "$captured" -le 9850 ]] || fail "second claim captured $captured m2, expected the whole square"
overlap=$(q "select coalesce(extensions.st_area(extensions.st_intersection(b.geom, o.geom)::extensions.geography), 0) < 0.01 from public.territory_ownership b, public.territory_ownership o where b.match_id = cc.id('tm') and o.match_id = b.match_id and b.team = 'blue' and o.team = 'orange'")
[[ "$overlap" == "t" ]] || fail "blue and orange overlap after simultaneous claims"
echo "   pass  simultaneous opposite claims serialize; later commit owns the overlap; no shared ground"

# ---- 2. The same request sent twice at once (a retry racing the original): one claim, one answer.
claim dup_a u3 -122.39 37.77 0.001 cc-key-same-req cc-h3 1 &
sleep 0.3
claim dup_b u3 -122.39 37.77 0.001 cc-key-same-req cc-h3 0 &
wait
n=$(q "select count(*) from public.territory_claims where match_id = cc.id('tm') and request_key = 'cc-key-same-req'")
[[ "$n" == "1" ]] || fail "a raced retry made $n claims"
rep=$(q "select (result ->> 'repeated') from cc.timing where k = 'dup_b'")
[[ "$rep" == "true" ]] || fail "the raced retry was not reported as a repeat"
echo "   pass  a raced retry with the same request key is idempotent"

# ---- 3. A claim whose transaction rolls back leaves no trace: no claim, no event, no score, no sequence number.
before=$(q "select seq || ':' || (select round(sum(area_m2)) from public.territory_ownership where match_id = cc.id('tm')) from public.battle_matches where id = cc.id('tm')")
"${PSQL[@]}" >/dev/null <<'SQL'
begin;
select public.commit_territory_claim(cc.id('tm'), cc.id('u4'), cc.sq(-122.38, 37.77, 0.001), 'cc-key-rollback', 'cc-h4');
rollback;
SQL
after=$(q "select seq || ':' || (select round(sum(area_m2)) from public.territory_ownership where match_id = cc.id('tm')) from public.battle_matches where id = cc.id('tm')")
n=$(q "select count(*) from public.territory_claims where request_key = 'cc-key-rollback'")
[[ "$before" == "$after" && "$n" == "0" ]] || fail "rolled-back claim changed state ($before -> $after, $n rows)"
echo "   pass  a rolled-back claim changes nothing"

# ---- 4. Eight claims from four players at once, alternating teams, some overlapping. Every one commits in some
#         order; the sequence has no gaps or repeats, events match it, and the teams never share ground.
for i in 0 1 2 3 4 5 6 7; do
  user="u$(( (i % 4) + 1 ))"
  x=$(echo "-122.37 + $i * 0.0006" | bc -l)
  claim "burst_$i" "$user" "$x" 37.77 0.001 "cc-key-burst-0$i" "cc-burst-$i" 0 &
done
wait
ok=$(q "select count(*) = max(seq) and min(seq) = 1 and max(seq) = (select seq from public.battle_matches where id = cc.id('tm')) and count(distinct seq) = count(*) from public.battle_match_events where match_id = cc.id('tm')")
[[ "$ok" == "t" ]] || fail "event sequence has gaps or repeats after a burst"
n=$(q "select count(*) from public.territory_claims where match_id = cc.id('tm') and request_key like 'cc-key-burst-%'")
[[ "$n" == "8" ]] || fail "only $n of 8 burst claims committed"
overlap=$(q "select coalesce(extensions.st_area(extensions.st_intersection(b.geom, o.geom)::extensions.geography), 0) < 0.01 from public.territory_ownership b, public.territory_ownership o where b.match_id = cc.id('tm') and o.match_id = b.match_id and b.team = 'blue' and o.team = 'orange'")
[[ "$overlap" == "t" ]] || fail "teams overlap after a burst of claims"
scores=$(q "select bool_and(abs(t.score - o.area_m2) < 1e-6) from public.battle_teams t join public.territory_ownership o using (match_id, team) where t.match_id = cc.id('tm')")
[[ "$scores" == "t" ]] || fail "official scores differ from owned areas"
echo "   pass  8 parallel claims: gapless sequence, matching events, scores equal owned area, no shared ground"

# ---- 5. Both teams capture the same road at once: one wins, the other hits the cooldown. One owner row.
road() { # key user edge request hold
  "${PSQL[@]}" >/dev/null <<SQL
begin;
insert into cc.timing (k, started) values ('$1', clock_timestamp());
update cc.timing set result = public.commit_road_capture(cc.id('rm'), cc.id('$2'), cc.id('$3'), 0.95, '$4') where k = '$1';
select pg_sleep($5);
commit;
update cc.timing set finished = clock_timestamp() where k = '$1';
SQL
}
road road_blue u5 r_R2 cc-road-blue-1 1 &
sleep 0.3
road road_orange u6 r_R2 cc-road-orange-1 0 &
wait
a=$(q "select result ->> 'status' from cc.timing where k = 'road_blue'")
b=$(q "select coalesce(result ->> 'reason', result ->> 'status') from cc.timing where k = 'road_orange'")
owners=$(q "select count(*) || ':' || min(team) from public.road_edge_ownership where match_id = cc.id('rm') and edge_id = cc.id('r_R2')")
[[ "$a" == "accepted" && "$b" == "cooldown" && "$owners" == "1:blue" ]] || fail "parallel road capture: blue $a, orange $b, owners $owners"
echo "   pass  parallel road captures: first commit wins, the other gets the cooldown, one owner"

# ---- 6. Parallel captures of different roads by one team keep the network score consistent.
road net_1 u5 r_R1 cc-road-net-1 0 &
road net_3 u5 r_R3 cc-road-net-3 0 &
wait
ok=$(q "select abs(score - (select sum(length_m) from public.road_edges where id in (cc.id('r_R1'), cc.id('r_R2'), cc.id('r_R3'))) / 10 * 1.2) < 1e-9 from public.battle_teams where match_id = cc.id('rm') and team = 'blue'")
[[ "$ok" == "t" ]] || fail "network bonus wrong after parallel captures"
echo "   pass  parallel captures of connected roads give the full network bonus"

"${PSQL[@]}" -c "drop schema cc cascade" >/dev/null
