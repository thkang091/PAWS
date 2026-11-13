-- Seasonal Selfie against real PostgreSQL: one challenge per month with that month's theme, photos all month and a
-- last week to vote; Best of the week names its entries by their own game. Everything is rolled back.
begin;

do $$
declare
  u uuid := gen_random_uuid();
  m date := date '2031-10-01';
  c uuid;
  t uuid;
  r jsonb;
begin
  insert into auth.users (id, email) values (u, 'ss@test.paws');
  insert into public.profiles (id) values (u) on conflict do nothing;

  perform public.open_weekly_challenges(timestamptz '2031-10-15 12:00+00');
  select c2.id, t2.id into c, t from public.media_challenges c2 join public.tournaments t2 on t2.id = c2.tournament_id
   where t2.game_type = 'seasonal_selfie' and t2.auto_week = m;
  assert c is not null, 'October opens a Seasonal Selfie';
  assert (select title = 'Halloween costume' and requires_owner and media_kind = 'photo' from public.media_challenges where id = c), 'with October''s theme, you and your dog';
  assert (select starts_at = m::timestamp at time zone 'utc' and ends_at = date '2031-11-01'::timestamp at time zone 'utc' from public.tournaments where id = t), 'for the whole month';
  assert (select entries_close_at = date '2031-10-25'::timestamp at time zone 'utc' from public.media_challenges where id = c), 'entries close a week before the end';
  perform public.open_weekly_challenges(timestamptz '2031-10-20 12:00+00');
  assert (select count(*) from public.tournaments where game_type = 'seasonal_selfie' and auto_week = m) = 1, 'once a month';
  raise notice 'pass  seasonal selfie: one themed challenge a month';

  -- Best of the week counts a seasonal entry as Seasonal Selfie (this month's challenge, entries open now).
  perform public.open_weekly_challenges(now());
  select c2.id, t2.id into c, t from public.media_challenges c2 join public.tournaments t2 on t2.id = c2.tournament_id
   where t2.game_type = 'seasonal_selfie' and t2.auto_week = date_trunc('month', now() at time zone 'utc')::date;
  insert into public.tournament_participants (tournament_id, user_id) values (t, u);
  if public.media_phase(c) = 'entries' then
    perform public.record_media_submission(c, u, null, u || '/' || c || '/s.jpg', 800, 800, 1000);
    perform set_config('request.jwt.claim.sub', u::text, true);
    r := public.games_of_the_week(null, 20);
    assert exists (select 1 from jsonb_array_elements(r -> 'games') e where e ->> 'game' = 'seasonal_selfie'), 'listed as Seasonal Selfie';
    raise notice 'pass  best of the week names seasonal entries';
  else
    raise notice 'pass  (voting week: entry check skipped)';
  end if;
end;
$$;

rollback;
