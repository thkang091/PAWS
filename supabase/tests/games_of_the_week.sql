-- Best of the week against real PostgreSQL: games ranked by plays, then minutes, then players who came back; only
-- totals come out; last week's plays don't count; signed-out callers are refused. Everything is rolled back.
begin;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 3));
  dog uuid[] := array[]::uuid[];
  g1 uuid;
  g2 uuid;
  d uuid;
  r jsonb;
  first jsonb;
begin
  for i in 1..3 loop
    insert into auth.users (id, email) values (u[i], 'w' || i || '@test.paws');
    insert into public.profiles (id) values (u[i]) on conflict do nothing;
    insert into public.dogs (owner_id, name, gender, breed, obedience_level, energy_level, dog_tag, age_years)
    values (u[i], 'Week ' || i, 'female', 'Mixed', 'basic', 'moderate', 'WEEK-' || left(u[i]::text, 8), 3) returning id into d;
    dog := dog || d;
  end loop;
  insert into public.challenge_games (category, title, subtitle, description, difficulty) values ('play', 'Find the Treat', 's', 'd', 'easy') returning id into g1;
  insert into public.challenge_games (category, title, subtitle, description, difficulty) values ('play', 'Hidden Toy', 's', 'd', 'easy') returning id into g2;

  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.games_of_the_week();
    raise exception 'signed-out caller was allowed';
  exception when others then
    if sqlerrm !~ 'not_signed_in' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', u[1]::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  -- (Other suites may have left plays this week, so only this test's own games are checked.)
  assert not exists (select 1 from jsonb_array_elements(public.games_of_the_week(null, 20) -> 'games') e where e ->> 'game' in ('challenge:' || g1, 'challenge:' || g2)), 'a game nobody played this week is not listed';

  -- Find the Treat: 3 plays this week by two players, one of whom came back. Hidden Toy: 2 plays by two players.
  insert into public.challenge_game_attempts (challenge_game_id, dog_id, owner_id, silver_coin_entry_cost, gold_coin_pass_reward, bonus_xp, idempotency_key)
  values (g1, dog[1], u[1], 0, 0, 0, 'w1'), (g1, dog[1], u[1], 0, 0, 0, 'w2'), (g1, dog[2], u[2], 0, 0, 0, 'w3'),
         (g2, dog[2], u[2], 0, 0, 0, 'w4'), (g2, dog[3], u[3], 0, 0, 0, 'w5');
  -- Last month's plays don't count.
  insert into public.challenge_game_attempts (challenge_game_id, dog_id, owner_id, silver_coin_entry_cost, gold_coin_pass_reward, bonus_xp, idempotency_key, created_at)
  select g2, dog[3], u[3], 0, 0, 0, 'old' || i, now() - interval '20 days' from generate_series(1, 5) i;

  r := public.games_of_the_week(null, 20);
  select e into first from jsonb_array_elements(r -> 'games') e where e ->> 'game' = 'challenge:' || g1;
  assert first ->> 'title' = 'Find the Treat' and (first ->> 'plays')::int = 3 and (first ->> 'players')::int = 2 and (first ->> 'returningPlayers')::int = 1, 'totals for the most played game';
  assert ((select e from jsonb_array_elements(r -> 'games') e where e ->> 'game' = 'challenge:' || g2) ->> 'plays')::int = 2, 'older plays are left out';
  assert (select min(o) from jsonb_array_elements(r -> 'games') with ordinality x(e, o) where e ->> 'game' = 'challenge:' || g1)
       < (select min(o) from jsonb_array_elements(r -> 'games') with ordinality x(e, o) where e ->> 'game' = 'challenge:' || g2), 'more plays ranks higher';
  assert not (r::text ~ u[1]::text or r::text ~ u[2]::text), 'no player ids leave the database';
  assert jsonb_array_length(public.games_of_the_week(null, 1) -> 'games') = 1, 'limit respected';
  raise notice 'pass  games of the week: ranked by plays, totals only, this week only, signed-in only';
end;
$$;

rollback;
