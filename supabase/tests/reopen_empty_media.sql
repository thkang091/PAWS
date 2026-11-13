-- Media challenges never sit dead (migration 20270318120000): an empty public challenge whose entry window closed opens
-- again until a day before it ends; anything with an entry, a friend battle, or a challenge in its last day is left
-- alone. Run after the migrations. Everything is rolled back.
begin;

create function pg_temp.challenge(p_game text, p_private boolean, p_close interval, p_end interval) returns uuid language plpgsql as $$
declare
  t uuid;
  c uuid;
begin
  insert into public.tournaments (game_type, mode, name, registration_opens_at, starts_at, ends_at, private)
  values (p_game::public.tournament_game, 'online', 'Reopen test', now() - interval '4 days', now() - interval '4 days', now() + p_end, p_private)
  returning id into t;
  insert into public.media_challenges (tournament_id, media_kind, title, entries_close_at)
  values (t, case when p_game = 'dog_reels' then 'video' else 'photo' end, 'Reopen test', now() + p_close)
  returning id into c;
  return c;
end;
$$;

do $$
declare
  u uuid := gen_random_uuid();
  quiet uuid;
  busy uuid;
  withdrawn uuid;
  friends uuid;
  last_day uuid;
  open_now uuid;
  n integer;
begin
  insert into auth.users (id, email) values (u, 'reopen@test.paws');
  -- Closed yesterday, ends in three days.
  quiet := pg_temp.challenge('dog_reels', false, interval '-1 day', interval '3 days');
  busy := pg_temp.challenge('photo_pose', false, interval '-1 day', interval '3 days');
  insert into public.media_submissions (challenge_id, tournament_id, user_id, media_path, width, height, bytes, status)
  select busy, tournament_id, u, 'test/busy.jpg', 1080, 1350, 1000, 'approved' from public.media_challenges where id = busy;
  withdrawn := pg_temp.challenge('photo_pose', false, interval '-1 day', interval '3 days');
  insert into public.media_submissions (challenge_id, tournament_id, user_id, media_path, width, height, bytes, status)
  select withdrawn, tournament_id, u, 'test/withdrawn.jpg', 1080, 1350, 1000, 'withdrawn' from public.media_challenges where id = withdrawn;
  friends := pg_temp.challenge('dog_reels', true, interval '-1 day', interval '3 days');
  last_day := pg_temp.challenge('photo_pose', false, interval '-2 days', interval '20 hours');
  open_now := pg_temp.challenge('photo_pose', false, interval '1 day', interval '3 days');

  n := public.reopen_empty_media_challenges();
  assert n = 2, format('the quiet week and the one with only a withdrawn entry reopen (got %s)', n);
  assert public.media_phase(quiet) = 'entries', 'the quiet week takes entries again';
  assert public.media_phase(busy) = 'voting', 'the week with an entry is voting';
  assert (select abs(extract(epoch from (c.entries_close_at - (t.ends_at - interval '1 day')))) < 1
            from public.media_challenges c join public.tournaments t on t.id = c.tournament_id where c.id = quiet),
    'until a day before the end, leaving a day to vote';
  assert (select entries_close_at < now() from public.media_challenges where id = busy), 'a week with an entry votes as planned';
  assert (select entries_close_at > now() from public.media_challenges where id = withdrawn), 'a withdrawn entry does not count';
  assert (select entries_close_at < now() from public.media_challenges where id = friends), 'friend battles keep their times';
  assert (select entries_close_at < now() from public.media_challenges where id = last_day), 'in its last day a week is left to finish';
  assert public.reopen_empty_media_challenges() = 0, 'running again changes nothing';
  raise notice 'pass  empty public media weeks reopen; entered, private and last-day ones do not';
end;
$$;

rollback;
