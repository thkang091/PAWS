-- Photo Pose discovery against a real PostgreSQL: Gemini batches, hand-written ideas, organizer review, reference
-- images and their storage access, publishing into a phase 4A media challenge, locked instructions, and what
-- players can see. Run as a database administrator after the migrations. Everything is rolled back.
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
  idea jsonb := jsonb_build_object(
    'title', 'Matching Head Tilt', 'description', 'You and your dog tilt your heads the same way.', 'category', 'matching', 'difficulty', 'easy',
    'setupMinutes', 3, 'participants', 1, 'requiredObjects', '[]'::jsonb, 'dogRequirements', '[]'::jsonb,
    'ownerPosition', 'Kneeling beside the dog', 'dogPosition', 'Sitting, facing the camera', 'cameraAngle', 'Eye level with the dog',
    'framing', 'Both faces fill the frame', 'instructions', '["Kneel next to your dog", "Make a sound so your dog tilts", "Tilt your head the same way"]'::jsonb,
    'criteria', '[{"id": "pose_tilt", "label": "Both heads tilt the same way", "kind": "pose"}]'::jsonb,
    'safetyNotes', '["Let your dog leave the pose whenever they want."]'::jsonb, 'safetyFlags', '[]'::jsonb,
    'visualReferencePrompt', 'A smiling owner and a dog both tilting their heads to the left', 'shareability', 'Instantly readable mirror pose',
    'fingerprint', 'head-match-tilt', 'sourceId', 'matching-head-tilt');
  flagged jsonb;
  r jsonb;
  p1 uuid;
  p2 uuid;
  hand public.photo_pose_concepts;
  ch public.media_challenges;
  t public.tournaments;
  n integer;
  lib jsonb;
  s uuid;
begin
  insert into auth.users (id, email) values (org, 'org@poses.test'), (alice, 'alice@poses.test');
  insert into public.profiles (id) values (org), (alice) on conflict do nothing;
  insert into public.tournament_organizers (user_id) values (org);
  flagged := idea || jsonb_build_object('title', 'Matching Bandanas', 'fingerprint', 'bandana', 'safetyFlags', '["accessory: comfortable, loose and quick to remove"]'::jsonb);

  -- A Gemini batch (the edge function's part): every idea starts as suggested, with its model and schema version.
  r := public.record_pose_batch(org, 'matching', 'easy', 5, 'gemini-2.5-flash', 'pose-concept-v1', 'pose-discovery-v1',
    jsonb_build_array(idea, flagged), '[{"title": "Jump for it", "reasons": ["unsafe: jumping"]}]'::jsonb);
  p1 := (r -> 'conceptIds' ->> 0)::uuid;
  p2 := (r -> 'conceptIds' ->> 1)::uuid;
  if (select review_status from public.photo_pose_concepts where id = p1) <> 'suggested' then raise exception 'Idea not suggested'; end if;
  if (select generation_metadata ->> 'schemaVersion' from public.photo_pose_concepts where id = p1) <> 'pose-concept-v1' then raise exception 'Schema version lost'; end if;
  if (select jsonb_array_length(rejected) from public.photo_pose_batches where id = (r ->> 'batchId')::uuid) <> 1 then raise exception 'Rejections not kept'; end if;
  if (select trend_source from public.photo_pose_concepts where id = p1) is not null then raise exception 'Trend claimed'; end if;
  -- A trend claim without evidence is refused by the table.
  if not pg_temp.raises(format('update public.photo_pose_concepts set trend_source = %L where id = %L', 'tiktok', p1), 'photo_pose_concepts_check') then raise exception 'Unverified trend stored'; end if;
  -- Ideas that need more than the owner in the photo are refused.
  if not pg_temp.raises(format('update public.photo_pose_concepts set participants = 2 where id = %L', p1), 'participants') then raise exception 'Two-person pose stored'; end if;

  -- Only the edge function records batches or reference images.
  if has_function_privilege('authenticated', 'public.record_pose_batch(uuid, text, text, integer, text, text, text, jsonb, jsonb, text)', 'execute')
    or has_function_privilege('authenticated', 'public.set_pose_reference(uuid, text, text, text, jsonb)', 'execute') then
    raise exception 'A client can record ideas or references';
  end if;

  -- Hand-written ideas, for when Gemini is unavailable: organizers only.
  perform pg_temp.as_user(alice);
  if not pg_temp.raises(format('select public.create_pose_concept(%L)', idea), 'not_an_organizer') then raise exception 'A player wrote an idea'; end if;
  perform pg_temp.as_user(org);
  hand := public.create_pose_concept(idea || jsonb_build_object('title', 'Back to Back Besties', 'fingerprint', 'back-bestie'));
  if hand.ai_model is not null or hand.review_status <> 'suggested' then raise exception 'Hand-written idea wrong'; end if;

  -- Players see no unpublished idea, or its reference image.
  execute 'reset role';
  update public.photo_pose_concepts set reference_media_path = 'concepts/' || p1 || '/draft.png' where id = p1;
  insert into storage.objects (bucket_id, name) values ('challenge-references', 'concepts/' || p1 || '/ref.png'), ('challenge-references', 'concepts/' || p1 || '/draft.png');
  perform pg_temp.as_user(alice);
  execute 'set local role authenticated';
  -- Starter poses ship with the app; this test counts only its own ideas.
  select count(*) into n from public.photo_pose_concepts where fingerprint not like 'starter:%';
  if n <> 0 then raise exception 'Alice sees % unpublished ideas', n; end if;
  select count(*) into n from storage.objects where bucket_id = 'challenge-references';
  if n <> 0 then raise exception 'Alice sees a draft reference'; end if;
  if exists (select 1 from jsonb_array_elements(public.pose_library()) e where e ->> 'id' not in (select id::text from public.photo_pose_concepts where fingerprint like 'starter:%')) then raise exception 'Library shows unpublished ideas'; end if;
  perform pg_temp.as_user(org);
  select count(*) into n from public.photo_pose_concepts where fingerprint not like 'starter:%';
  if n <> 3 then raise exception 'Organizer sees % ideas', n; end if;
  select count(*) into n from storage.objects where bucket_id = 'challenge-references';
  if n <> 2 then raise exception 'Organizer can''t see references'; end if;
  execute 'reset role';

  -- Review: publishing needs an approved idea and an approved reference; flagged ideas need their flags read.
  perform pg_temp.as_user(org);
  if not pg_temp.raises(format('select public.publish_pose_challenge(%L, %L, %L, %L, %L, %L)', p1, 'Tilt week', now(), now() + interval '1 hour', now() + interval '3 days', now() + interval '5 days'), 'pose_not_approved') then
    raise exception 'Published a suggestion';
  end if;
  if not pg_temp.raises(format('select public.review_pose_concept(%L, %L)', p2, 'approve'), 'safety_unchecked') then raise exception 'Flags skipped'; end if;
  if (public.review_pose_concept(p2, 'approve', null, true)).review_status <> 'approved' then raise exception 'Flagged idea not approved after check'; end if;
  if (public.review_pose_concept(hand.id, 'reject', 'Too close to another idea')).review_status <> 'rejected' then raise exception 'Reject failed'; end if;
  perform public.review_pose_concept(p1, 'approve');
  perform pg_temp.as_user(alice);
  if not pg_temp.raises(format('select public.review_pose_concept(%L, %L)', p2, 'reject'), 'not_an_organizer') then raise exception 'A player reviewed'; end if;

  -- The organizer edits the words before publishing.
  perform pg_temp.as_user(org);
  perform public.update_pose_concept(p1, '{"title": "Head Tilt Twins", "instructions": ["Kneel next to your dog", "Squeak a toy", "Tilt the same way"]}');
  if (select title from public.photo_pose_concepts where id = p1) <> 'Head Tilt Twins' then raise exception 'Edit lost'; end if;

  -- Reference images: stored by the edge function, pending until the organizer approves. Uploads need a licence.
  if not pg_temp.raises(format('select public.publish_pose_challenge(%L, %L, %L, %L, %L, %L)', p1, 'Tilt week', now(), now() + interval '1 hour', now() + interval '3 days', now() + interval '5 days'), 'reference_not_approved') then
    raise exception 'Published without a reference';
  end if;
  perform pg_temp.as_user(null);
  if not pg_temp.raises(format('select public.set_pose_reference(%L, %L, %L, %L, %L)', p1, 'concepts/x.jpg', 'uploaded', '', '{}'), 'photo_pose_concepts_check') then raise exception 'Upload without licence'; end if;
  r := public.set_pose_reference(p1, 'concepts/' || p1 || '/ref.png', 'generated', null, '{"status": "passed"}');
  if r ->> 'replacedPath' <> 'concepts/' || p1 || '/draft.png' then raise exception 'Replaced reference not returned'; end if;
  if (select reference_status from public.photo_pose_concepts where id = p1) <> 'pending' then raise exception 'Reference not pending'; end if;
  perform pg_temp.as_user(alice);
  if not pg_temp.raises(format('select public.review_pose_reference(%L, true)', p1), 'not_an_organizer') then raise exception 'A player approved a reference'; end if;
  perform pg_temp.as_user(org);
  perform public.review_pose_reference(p1, true);

  -- Publish: a Photo Pose tournament and a media challenge holding a copy of the instructions.
  ch := public.publish_pose_challenge(p1, 'Tilt week', now() - interval '2 days', now() - interval '1 day', now() + interval '1 day', now() + interval '3 days');
  t := (select x from public.tournaments x where id = ch.tournament_id);
  if t.game_type <> 'photo_pose' or ch.pose_concept_id <> p1 or ch.reference_path <> 'concepts/' || p1 || '/ref.png' then raise exception 'Published challenge wrong'; end if;
  if ch.title <> 'Head Tilt Twins' or ch.instructions -> 'steps' ->> 1 <> 'Squeak a toy' or ch.instructions -> 'criteria' -> 0 ->> 'id' <> 'pose_tilt' then raise exception 'Instructions not copied: %', ch.instructions; end if;
  if (select review_status from public.photo_pose_concepts where id = p1) <> 'published' then raise exception 'Idea not published'; end if;
  -- Published ideas are locked; the running challenge keeps the words players saw.
  if not pg_temp.raises(format('select public.update_pose_concept(%L, %L)', p1, '{"title": "Changed"}'), 'pose_locked') then raise exception 'Edited a published idea'; end if;
  if not pg_temp.raises(format('select public.publish_pose_challenge(%L, %L, %L, %L, %L, %L)', p1, 'Again', now(), now() + interval '1 hour', now() + interval '3 days', now() + interval '5 days'), 'pose_not_approved') then
    raise exception 'Published twice';
  end if;

  -- Players now see the published idea and its reference, nothing else.
  perform pg_temp.as_user(alice);
  execute 'set local role authenticated';
  select count(*) into n from public.photo_pose_concepts;
  if n <> 1 then raise exception 'Alice sees % ideas after publishing', n; end if;
  select count(*) into n from storage.objects where bucket_id = 'challenge-references';
  if n <> 1 then raise exception 'Alice sees % references', n; end if;
  lib := public.pose_library();
  if jsonb_array_length(lib) <> 1 or (lib -> 0 ->> 'entered')::boolean then raise exception 'Library wrong: %', lib; end if;
  execute 'reset role';

  -- Pose history: after Alice enters, the library knows.
  perform public.join_tournament(t.id, null);
  perform pg_temp.as_user(null);
  s := (public.record_media_submission(ch.id, alice, null, alice || '/' || ch.id || '/a.jpg', 1000, 1000, 1000) -> 'submission' ->> 'id')::uuid;
  perform public.apply_media_check(s, 'passed', null, 'entry-check-v1', null);
  perform pg_temp.as_user(alice);
  if not (public.pose_library() -> 0 ->> 'entered')::boolean then raise exception 'History not recorded'; end if;

  -- Retiring takes it out of the library; the challenge stays.
  perform pg_temp.as_user(org);
  perform public.retire_pose_concept(p1);
  perform pg_temp.as_user(alice);
  if exists (select 1 from jsonb_array_elements(public.pose_library()) e where e ->> 'id' = p1::text) then raise exception 'Retired idea still offered'; end if;
  if not exists (select 1 from public.media_challenges where id = ch.id) then raise exception 'Challenge lost'; end if;

  raise notice 'photo_poses: all checks passed';
end;
$$;
rollback;
