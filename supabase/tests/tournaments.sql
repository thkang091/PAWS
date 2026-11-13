-- Tournament phase 1: privacy, one entry per player, server-only scoring, idempotent hand-in, and time windows.
-- Run as a database administrator after the migrations (psql or the Supabase SQL editor). Everything is rolled back.
begin;
do $$
declare
  alice uuid := gen_random_uuid();
  bob uuid := gen_random_uuid();
  alice_dog uuid;
  live public.tournaments;
  closed public.tournaments;
  s_alice uuid;
  s_bob uuid;
  first_row public.territory_submissions;
  second_row public.territory_submissions;
  seen bigint;
  refused boolean;
  -- A roughly 140 m by 110 m block in San Francisco, closed, longitude first.
  ring text := '{"type":"Polygon","coordinates":[[[-122.4870,37.7690],[-122.4854,37.7690],[-122.4854,37.7700],[-122.4870,37.7700],[-122.4870,37.7690]]]}';
begin
  insert into auth.users (id, email) values (alice, alice || '@test.paws'), (bob, bob || '@test.paws');
  insert into public.profiles (id) values (alice), (bob) on conflict do nothing;
  insert into public.dogs (owner_id, name, gender, breed, obedience_level, energy_level, dog_tag, age_years)
  values (alice, 'Test Bori', 'female', 'Mixed', 'basic', 'moderate', 'TEST-' || left(alice::text, 8), 3)
  returning id into alice_dog;

  insert into public.tournaments (game_type, mode, name, registration_opens_at, starts_at, ends_at)
  values ('largest_country', 'online', 'Test live', now() - interval '2 days', now() - interval '1 day', now() + interval '1 day')
  returning * into live;
  insert into public.tournaments (game_type, mode, name, registration_opens_at, starts_at, ends_at)
  values ('largest_country', 'online', 'Test closed', now() - interval '9 days', now() - interval '8 days', now() - interval '1 day')
  returning * into closed;

  if public.tournament_phase(live) <> 'active' or public.tournament_phase(closed) <> 'completed' then
    raise exception 'Phases follow the server clock';
  end if;

  -- One entry per player, however many times they join.
  perform set_config('request.jwt.claim.sub', alice::text, true);
  perform public.join_tournament(live.id, alice_dog);
  perform public.join_tournament(live.id, alice_dog);
  if (select count(*) from public.tournament_participants where tournament_id = live.id and user_id = alice) <> 1 then
    raise exception 'A player joined twice';
  end if;

  -- Joining a finished tournament is refused.
  refused := false;
  begin
    perform public.join_tournament(closed.id, alice_dog);
  exception when others then
    refused := sqlerrm = 'registration_closed';
  end;
  if not refused then raise exception 'Joined a closed tournament'; end if;

  -- Someone else's dog can't be entered.
  perform set_config('request.jwt.claim.sub', bob::text, true);
  refused := false;
  begin
    perform public.join_tournament(live.id, alice_dog);
  exception when others then
    refused := sqlerrm = 'not_your_dog';
  end;
  if not refused then raise exception 'Entered another person''s dog'; end if;

  -- Sessions and points are written by the edge function (service role); here, as the administrator.
  insert into public.gps_sessions (tournament_id, user_id, dog_id) values (live.id, alice, alice_dog) returning id into s_alice;
  insert into public.gps_points (session_id, sequence_number, latitude, longitude, accuracy_m, captured_at)
  select s_alice, n, 37.7690 + n * 0.00001, -122.4870, 6, now() - interval '10 minutes' + n * interval '4 seconds'
  from generate_series(1, 20) n;
  -- A batch sent again stores nothing new.
  insert into public.gps_points (session_id, sequence_number, latitude, longitude, accuracy_m, captured_at)
  values (s_alice, 1, 37.7690, -122.4870, 6, now()) on conflict (session_id, sequence_number) do nothing;
  if (select count(*) from public.gps_points where session_id = s_alice) <> 20 then raise exception 'A repeated point was stored twice'; end if;

  -- One open walk per person.
  refused := false;
  begin
    insert into public.gps_sessions (tournament_id, user_id) values (live.id, alice);
  exception when unique_violation then
    refused := true;
  end;
  if not refused then raise exception 'Two walks open at once'; end if;

  -- Bob, signed in, sees none of Alice's route.
  insert into public.gps_sessions (tournament_id, user_id) values (live.id, bob) returning id into s_bob;
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', bob::text, true);
  select count(*) into seen from public.gps_points where session_id = s_alice;
  if seen <> 0 then raise exception 'Another player could read raw GPS points'; end if;
  select count(*) into seen from public.gps_sessions where id = s_alice;
  if seen <> 0 then raise exception 'Another player could read a GPS session'; end if;
  -- And cannot write a point or a score directly.
  refused := false;
  begin
    insert into public.gps_points (session_id, sequence_number, latitude, longitude, captured_at) values (s_bob, 1, 37.77, -122.48, now());
  exception when insufficient_privilege then
    refused := true;
  end;
  if not refused then raise exception 'A player wrote GPS points directly'; end if;
  refused := false;
  begin
    perform public.record_territory(s_bob, ring, 15000, 500, 600);
  exception when insufficient_privilege then
    refused := true;
  end;
  if not refused then raise exception 'A player could record a territory'; end if;

  -- Alice can read her own points.
  perform set_config('request.jwt.claim.sub', alice::text, true);
  select count(*) into seen from public.gps_points where session_id = s_alice;
  if seen <> 20 then raise exception 'Owner could not read her own points'; end if;
  execute 'reset role';

  -- Official area comes from PostGIS; a second hand-in returns the first.
  first_row := public.record_territory(s_alice, ring, 15650, 520, 640);
  if first_row.area_m2 < 14000 or first_row.area_m2 > 16000 then raise exception 'Unexpected area: %', first_row.area_m2; end if;
  if first_row.validation_status <> 'valid' then raise exception 'Matching areas were flagged'; end if;
  second_row := public.record_territory(s_alice, ring, 99999, 1, 1);
  if second_row.id <> first_row.id or (select count(*) from public.territory_submissions where session_id = s_alice) <> 1 then
    raise exception 'Repeated hand-in created a second result';
  end if;
  if (select status from public.gps_sessions where id = s_alice) <> 'submitted' then raise exception 'Session not closed after hand-in'; end if;

  -- A self-crossing outline is refused by PostGIS.
  refused := false;
  begin
    perform public.record_territory(s_bob, '{"type":"Polygon","coordinates":[[[-122.487,37.769],[-122.485,37.770],[-122.485,37.769],[-122.487,37.770],[-122.487,37.769]]]}', 100, 300, 300);
  exception when others then
    refused := sqlerrm = 'invalid_polygon';
  end;
  if not refused then raise exception 'A bow-tie outline was accepted'; end if;

  -- Only the owner gets the outline back.
  perform set_config('request.jwt.claim.sub', bob::text, true);
  if public.territory_detail(first_row.id) is not null then raise exception 'Another player read an outline'; end if;
  perform set_config('request.jwt.claim.sub', alice::text, true);
  if public.territory_detail(first_row.id)->'outline'->>'type' <> 'Polygon' then raise exception 'Owner could not read her outline'; end if;

  -- Cancelled walks lose their points to the purge after a day.
  update public.gps_sessions set status = 'cancelled', started_at = now() - interval '2 days' where id = s_bob;
  insert into public.gps_points (session_id, sequence_number, latitude, longitude, captured_at) values (s_bob, 1, 37.77, -122.48, now() - interval '2 days');
  perform public.purge_tournament_gps(30);
  if exists (select 1 from public.gps_points where session_id = s_bob) then raise exception 'Purge kept a cancelled walk'; end if;
  if (select count(*) from public.gps_points where session_id = s_alice) <> 20 then raise exception 'Purge removed points from a live tournament'; end if;

  raise notice 'tournament checks passed';
end;
$$;
rollback;
