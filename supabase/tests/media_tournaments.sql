-- Media tournaments (phase 4A) against a real PostgreSQL: challenges, entries, the automatic check's outcomes,
-- retakes, review requests, moderation, voting, reports, results, row level security and storage. Run as a database
-- administrator after the migrations (statements run as the administrator stand in for the edge function's service
-- role). The clock is moved by editing the tournament's dates. Everything is rolled back.
begin;

create function pg_temp.raises(stmt text, expected text) returns boolean language plpgsql as $$
begin
  execute stmt;
  return false;
exception when others then
  if position(expected in sqlerrm) = 0 then raise notice 'expected %, got %', expected, sqlerrm; return false; end if;
  return true;
end;
$$;

create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claim.sub', coalesce(u::text, ''), true), set_config('request.jwt.claim.role', 'authenticated', true);
$$;

do $$
declare
  org uuid := gen_random_uuid();
  alice uuid := gen_random_uuid();
  bob uuid := gen_random_uuid();
  carol uuid := gen_random_uuid();
  dave uuid := gen_random_uuid();
  eve uuid := gen_random_uuid();
  u uuid;
  dog_of jsonb := '{}'::jsonb;
  t uuid;
  shape_t uuid;
  ch public.media_challenges;
  r jsonb;
  s_alice uuid;
  s_alice2 uuid;
  s_bob uuid;
  s_carol uuid;
  s_eve uuid;
  sub public.media_submissions;
  n integer;
  list jsonb;
begin
  insert into auth.users (id, email) values (org, 'org@media.test'), (alice, 'alice@media.test'), (bob, 'bob@media.test'),
    (carol, 'carol@media.test'), (dave, 'dave@media.test'), (eve, 'eve@media.test');
  insert into public.profiles (id) values (org), (alice), (bob), (carol), (dave), (eve) on conflict do nothing;
  insert into public.tournament_organizers (user_id) values (org);
  foreach u in array array[alice, bob, carol, dave, eve] loop
    insert into public.dogs (owner_id, name, gender, breed, obedience_level, energy_level, dog_tag, age_years)
    values (u, 'Dog ' || left(u::text, 4), 'female', 'Mixed', 'basic', 'moderate', 'MT-' || left(u::text, 8), 3)
    returning jsonb_set(dog_of, array[u::text], to_jsonb(id)) into dog_of;
  end loop;

  -- Organizers create the tournament and its challenge; players can't.
  perform pg_temp.as_user(org);
  t := (public.create_tournament('photo_pose', 'online', 'Pose week', 'Test', now() - interval '2 days', now() - interval '1 day', now() + interval '2 days')).id;
  shape_t := (public.create_tournament('follow_shape', 'online', 'Shape week', 'Test', now() - interval '2 days', now() - interval '1 day', now() + interval '2 days')).id;
  if not pg_temp.raises(format('select public.create_media_challenge(%L, %L, %L, %L, %L)', shape_t, 'Pose', '', '{}', now() + interval '1 day'), 'not_a_media_tournament') then
    raise exception 'Challenge on a walking tournament';
  end if;
  if not pg_temp.raises(format('select public.create_media_challenge(%L, %L, %L, %L, %L)', t, 'Pose', '', '{}', now() + interval '2 days'), 'entries_window_invalid') then
    raise exception 'No time left for voting';
  end if;
  ch := public.create_media_challenge(t, 'Matching head tilt', 'Tilt your heads the same way.',
    '{"steps": ["Sit side by side", "Tilt"], "criteria": [{"id": "pose_tilt", "label": "Both heads tilt the same way", "kind": "pose"}]}'::jsonb,
    now() + interval '1 day');
  if ch.media_kind <> 'photo' or not ch.requires_owner then raise exception 'Challenge defaults wrong'; end if;
  perform pg_temp.as_user(alice);
  if not pg_temp.raises(format('select public.create_media_challenge(%L, %L, %L, %L, %L)', t, 'Mine', '', '{}', now() + interval '1 day'), 'not_an_organizer') then
    raise exception 'A player made a challenge';
  end if;

  -- Alice, Bob, Carol and Eve join. Dave doesn't, yet.
  foreach u in array array[alice, bob, carol, eve] loop
    perform pg_temp.as_user(u);
    perform public.join_tournament(t, (dog_of ->> u::text)::uuid);
  end loop;
  perform pg_temp.as_user(null);

  -- Entries (the edge function's part): only joined players, their own dog, their own folder.
  r := public.record_media_submission(ch.id, alice, (dog_of ->> alice::text)::uuid, alice || '/' || ch.id || '/a1.jpg', 1200, 1600, 200000);
  s_alice := (r -> 'submission' ->> 'id')::uuid;
  if r ->> 'replacedPath' is not null then raise exception 'Nothing to replace yet'; end if;
  if not pg_temp.raises(format('select public.record_media_submission(%L, %L, null, %L, 800, 800, 1000)', ch.id, dave, dave || '/x/d.jpg'), 'not_joined') then raise exception 'Entry without joining'; end if;
  if not pg_temp.raises(format('select public.record_media_submission(%L, %L, %L, %L, 800, 800, 1000)', ch.id, bob, dog_of ->> alice::text, bob || '/x/b.jpg'), 'not_your_dog') then raise exception 'Entry with another''s dog'; end if;
  if not pg_temp.raises(format('select public.record_media_submission(%L, %L, null, %L, 800, 800, 1000)', ch.id, bob, alice || '/x/b.jpg'), 'not_your_file') then raise exception 'Entry with another''s file'; end if;
  s_bob := (public.record_media_submission(ch.id, bob, (dog_of ->> bob::text)::uuid, bob || '/' || ch.id || '/b1.jpg', 1200, 1600, 200000) -> 'submission' ->> 'id')::uuid;
  s_carol := (public.record_media_submission(ch.id, carol, (dog_of ->> carol::text)::uuid, carol || '/' || ch.id || '/c1.jpg', 1200, 1600, 200000) -> 'submission' ->> 'id')::uuid;
  s_eve := (public.record_media_submission(ch.id, eve, (dog_of ->> eve::text)::uuid, eve || '/' || ch.id || '/e1.jpg', 1200, 1600, 200000) -> 'submission' ->> 'id')::uuid;

  -- The check's outcomes: passed joins the gallery, failed holds, unclear waits for a person. Never a rejection.
  if (public.apply_media_check(s_alice, 'passed', '{"answers": []}', 'entry-check-v1', null)).status <> 'approved' then raise exception 'Passed not approved'; end if;
  sub := public.apply_media_check(s_bob, 'failed', '{"answers": []}', 'entry-check-v1', 'no_dog');
  if sub.status <> 'held' or sub.held_reason <> 'no_dog' then raise exception 'Failed not held'; end if;
  if (public.apply_media_check(s_carol, 'unclear', null, 'entry-check-v1', null)).status <> 'pending_review' then raise exception 'Unclear not for review'; end if;
  if (public.apply_media_check(s_eve, 'unavailable', null, 'entry-check-v1', null)).status <> 'pending_review' then raise exception 'No check, no person'; end if;
  -- A second outcome for the same entry changes nothing.
  if (public.apply_media_check(s_alice, 'failed', null, 'x', 'no_dog')).status <> 'approved' then raise exception 'Check applied twice'; end if;

  -- A retake replaces the live entry and hands back the old photo to delete.
  r := public.record_media_submission(ch.id, alice, (dog_of ->> alice::text)::uuid, alice || '/' || ch.id || '/a2.jpg', 1200, 1600, 210000);
  s_alice2 := (r -> 'submission' ->> 'id')::uuid;
  if r ->> 'replacedPath' <> alice || '/' || ch.id || '/a1.jpg' then raise exception 'Retake lost the old path'; end if;
  if (select status from public.media_submissions where id = s_alice) <> 'withdrawn' then raise exception 'Old entry still live'; end if;
  if (select count(*) from public.media_submissions where challenge_id = ch.id and user_id = alice and status not in ('withdrawn', 'rejected')) <> 1 then raise exception 'Two live entries'; end if;
  perform public.apply_media_check(s_alice2, 'passed', null, 'entry-check-v1', null);
  -- The database itself refuses a second live entry.
  if not pg_temp.raises(format('insert into public.media_submissions (challenge_id, tournament_id, user_id, media_path, width, height, bytes) values (%L, %L, %L, %L, 1, 1, 1)', ch.id, t, alice, 'dup.jpg'), 'media_submissions_one_live_idx') then
    raise exception 'Second live entry allowed';
  end if;

  -- Nobody sees the gallery or votes while entries are open.
  perform pg_temp.as_user(bob);
  if not pg_temp.raises(format('select * from public.media_gallery(%L)', ch.id), 'gallery_not_open') then raise exception 'Gallery open during entries'; end if;
  if not pg_temp.raises(format('select public.cast_media_vote(%L)', s_alice2), 'voting_closed') then raise exception 'Vote during entries'; end if;

  -- Bob asks a person to look at his held entry, once. Carol's is already with a person.
  sub := public.request_media_review(s_bob, 'My dog is right there');
  if sub.status <> 'pending_review' or sub.review_requested_at is null then raise exception 'Review not requested'; end if;
  if not pg_temp.raises(format('select public.request_media_review(%L)', s_bob), 'review_already_requested') then raise exception 'Asked twice'; end if;
  if not pg_temp.raises(format('select public.request_media_review(%L)', s_alice2), 'entry_not_found') then raise exception 'Reviewed someone else''s entry'; end if;
  perform pg_temp.as_user(carol);
  if not pg_temp.raises(format('select public.request_media_review(%L)', s_carol), 'nothing_to_review') then raise exception 'Review of an entry already waiting'; end if;

  -- Row level security: your own entries, votes and reports only; challenges for everyone signed in.
  perform pg_temp.as_user(bob);
  execute 'set local role authenticated';
  select count(*) into n from public.media_submissions;
  if n <> 1 then raise exception 'Bob sees % entries', n; end if;
  select count(*) into n from public.media_challenges;
  if n < 1 then raise exception 'Bob can''t see the challenge'; end if;
  select count(*) into n from public.media_moderation_log;
  if n <> 0 then raise exception 'Bob reads the moderation log'; end if;
  -- Storage: only into your own staging folder; never another player's photos.
  insert into storage.objects (bucket_id, name) values ('media-entries', bob || '/incoming/b.jpg');
  if not pg_temp.raises(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'media-entries', bob || '/' || ch.id || '/direct.jpg'), 'row-level security') then raise exception 'Upload past the cleaning step'; end if;
  if not pg_temp.raises(format('insert into storage.objects (bucket_id, name) values (%L, %L)', 'media-entries', alice || '/incoming/x.jpg'), 'row-level security') then raise exception 'Upload into Alice''s folder'; end if;
  execute 'reset role';
  insert into storage.objects (bucket_id, name) values ('media-entries', alice || '/' || ch.id || '/a2.jpg');
  execute 'set local role authenticated';
  select count(*) into n from storage.objects where bucket_id = 'media-entries' and name like alice || '/%';
  if n <> 0 then raise exception 'Bob can read Alice''s photo'; end if;
  perform pg_temp.as_user(alice);
  select count(*) into n from storage.objects where bucket_id = 'media-entries' and name like alice || '/%';
  if n <> 1 then raise exception 'Alice can''t read her own photo'; end if;
  execute 'reset role';

  -- Clients can't record entries or check outcomes.
  if has_function_privilege('authenticated', 'public.record_media_submission(uuid, uuid, uuid, text, integer, integer, integer)', 'execute')
    or has_function_privilege('authenticated', 'public.apply_media_check(uuid, text, jsonb, text, text)', 'execute')
    or has_function_privilege('authenticated', 'public.media_log(uuid, uuid, text, text, text, text)', 'execute') then
    raise exception 'A client can write entries';
  end if;

  -- Voting opens.
  update public.media_challenges set entries_close_at = now() - interval '1 hour' where id = ch.id;
  if not pg_temp.raises(format('select public.record_media_submission(%L, %L, null, %L, 800, 800, 1000)', ch.id, bob, bob || '/x/late.jpg'), 'entries_closed') then raise exception 'Entry after close'; end if;

  -- Moderation: organizers only; a rejection needs a reason.
  perform pg_temp.as_user(alice);
  if not pg_temp.raises(format('select public.moderate_media_submission(%L, %L)', s_bob, 'approve'), 'not_an_organizer') then raise exception 'A player moderated'; end if;
  perform pg_temp.as_user(org);
  if (public.moderate_media_submission(s_bob, 'approve')).status <> 'approved' then raise exception 'Approve failed'; end if;
  if (public.moderate_media_submission(s_eve, 'approve')).status <> 'approved' then raise exception 'Approve failed'; end if;
  if not pg_temp.raises(format('select public.moderate_media_submission(%L, %L)', s_carol, 'reject'), 'reason_required') then raise exception 'Rejected without a reason'; end if;
  if (public.moderate_media_submission(s_carol, 'reject', 'not_the_challenge')).rejection_reason <> 'not_the_challenge' then raise exception 'Reject failed'; end if;

  -- Votes: one each, for someone else's approved entry, by players who joined. Voting again moves the vote.
  perform pg_temp.as_user(bob);
  perform public.cast_media_vote(s_alice2);
  perform public.cast_media_vote(s_eve);
  if (select count(*) from public.media_votes where voter_id = bob) <> 1 or (select submission_id from public.media_votes where voter_id = bob) <> s_eve then raise exception 'Vote did not move'; end if;
  if not pg_temp.raises(format('select public.cast_media_vote(%L)', s_bob), 'own_entry') then raise exception 'Voted for himself'; end if;
  perform pg_temp.as_user(carol);
  if not pg_temp.raises(format('select public.cast_media_vote(%L)', s_carol), 'entry_not_found') then raise exception 'Vote for a rejected entry'; end if;
  perform public.cast_media_vote(s_alice2);
  perform pg_temp.as_user(dave);
  if not pg_temp.raises(format('select public.cast_media_vote(%L)', s_alice2), 'not_joined') then raise exception 'Vote without joining'; end if;
  perform public.join_tournament(t, (dog_of ->> dave::text)::uuid);
  perform public.cast_media_vote(s_alice2);
  perform pg_temp.as_user(alice);
  perform public.cast_media_vote(s_bob);

  -- The gallery: approved entries only, your vote marked, no counts until voting closes.
  perform pg_temp.as_user(bob);
  select count(*) into n from public.media_gallery(ch.id);
  if n <> 3 then raise exception 'Gallery has % entries, expected 3', n; end if;
  if exists (select 1 from public.media_gallery(ch.id) where votes is not null) then raise exception 'Counts shown during voting'; end if;
  if not exists (select 1 from public.media_gallery(ch.id) g where g.submission_id = s_eve and g.my_vote) then raise exception 'Vote not marked'; end if;
  if not exists (select 1 from public.media_gallery(ch.id) g where g.submission_id = s_bob and g.is_mine) then raise exception 'Own entry not marked'; end if;
  if exists (select 1 from public.media_gallery(ch.id) g where g.submission_id = s_carol) then raise exception 'Rejected entry in the gallery'; end if;

  -- Reports: once each, never your own; the third hides the entry until a person looks, and the owner can ask.
  perform pg_temp.as_user(eve);
  if not pg_temp.raises(format('select public.report_media_submission(%L, %L)', s_eve, 'spam'), 'own_entry') then raise exception 'Reported own entry'; end if;
  foreach u in array array[carol, carol, dave, alice] loop
    perform pg_temp.as_user(u);
    perform public.report_media_submission(s_eve, 'not_their_photo');
  end loop;
  sub := (select s from public.media_submissions s where id = s_eve);
  if sub.report_count <> 3 or not sub.hidden_by_reports or sub.status <> 'pending_review' then raise exception 'Reports did not hide: %', row_to_json(sub); end if;
  perform pg_temp.as_user(bob);
  if exists (select 1 from public.media_gallery(ch.id) g where g.submission_id = s_eve) then raise exception 'Hidden entry in the gallery'; end if;
  perform pg_temp.as_user(eve);
  if (public.request_media_review(s_eve, 'It is my dog')).review_requested_at is null then raise exception 'Hidden entry can''t ask for review'; end if;
  if not pg_temp.raises(format('select * from public.media_results(%L)', ch.id), 'results_not_ready') then raise exception 'Results during voting'; end if;

  -- A moderator restores Eve's entry. Then voting closes.
  perform pg_temp.as_user(org);
  perform public.moderate_media_submission(s_eve, 'approve');
  update public.media_submissions set submitted_at = now() - interval '30 hours' where id = s_alice2;
  update public.media_submissions set submitted_at = now() - interval '40 hours' where id = s_eve;
  update public.media_submissions set submitted_at = now() - interval '35 hours' where id = s_bob;
  update public.tournaments set registration_opens_at = now() - interval '4 days', starts_at = now() - interval '3 days', ends_at = now() - interval '1 hour' where id = t;
  update public.media_challenges set entries_close_at = now() - interval '2 days' where id = ch.id;

  perform pg_temp.as_user(bob);
  if not pg_temp.raises(format('select public.cast_media_vote(%L)', s_alice2), 'voting_closed') then raise exception 'Vote after close'; end if;
  if not pg_temp.raises(format('select public.clear_media_vote(%L)', ch.id), 'voting_closed') then raise exception 'Vote removed after close'; end if;

  -- Results: most votes first (Alice: Carol and Dave), then ties by who entered first (Eve before Bob, one vote each).
  if (select string_agg(rank || ':' || votes, ',' order by rank) from public.media_results(ch.id)) <> '1:2,2:1,3:1' then
    raise exception 'Results wrong: %', (select string_agg(rank || ':' || votes || ':' || submission_id, ',' order by rank) from public.media_results(ch.id));
  end if;
  if (select submission_id from public.media_results(ch.id) where rank = 1) <> s_alice2 or (select submission_id from public.media_results(ch.id) where rank = 2) <> s_eve then
    raise exception 'Tie broken wrong';
  end if;
  if (select count(*) from public.media_results(ch.id) where is_mine) <> 1 then raise exception 'Own result not marked'; end if;
  if exists (select 1 from public.media_gallery(ch.id) where votes is null) then raise exception 'Counts hidden after close'; end if;

  -- Every decision is in the log.
  if (select count(distinct action) from public.media_moderation_log where submission_id in (s_alice, s_bob, s_carol, s_eve)) < 6 then
    raise exception 'Log incomplete: %', (select string_agg(distinct action, ',') from public.media_moderation_log);
  end if;

  -- The game screen's list: phase, your entry, your vote.
  perform pg_temp.as_user(alice);
  -- (The list also opens this week's automatic challenge; only this test's challenge is checked.)
  list := public.media_challenge_list('photo_pose');
  select coalesce(jsonb_agg(e), '[]'::jsonb) into list from jsonb_array_elements(list) e
   where (e ->> 'tournamentId')::uuid not in (select id from public.tournaments where auto_week is not null);
  if jsonb_array_length(list) <> 1 or list -> 0 ->> 'phase' <> 'completed' or (list -> 0 -> 'myEntry' ->> 'id')::uuid <> s_alice2 or (list -> 0 ->> 'myVote')::uuid <> s_bob then
    raise exception 'List wrong: %', list;
  end if;
  if (list -> 0 ->> 'entries')::integer <> 3 then raise exception 'Entry count wrong'; end if;

  raise notice 'media_tournaments: all checks passed';
end;
$$;
rollback;
