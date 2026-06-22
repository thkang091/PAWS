-- ============================================================
-- Migration 0031 — Seed Better Walks Challenge Games
-- ============================================================
-- Challenge Games consume Silver Coins on entry and award Gold
-- Coins only on PASS through settle_challenge_game_attempt.

insert into challenge_games (
  id,
  category,
  title,
  subtitle,
  description,
  difficulty,
  recording_setup,
  user_instructions,
  min_clip_seconds,
  max_clip_seconds,
  required_mastered_activity_ids,
  verifier_prompt,
  silver_coin_entry_cost,
  gold_coin_pass_reward,
  bonus_xp,
  max_stars,
  safety_notes,
  is_active
) values
(
  'GAME_BW_001',
  'BETTER_WALKS',
  'Walk Five Steps Together',
  'Walk near the owner for at least five visible steps.',
  'The dog walks near the owner for at least five visible steps.',
  'easy',
  '["Use one short continuous phone video.","Use a safe controlled route.","Keep dog, owner, owner feet, and path visible.","Begin recording before walking starts."]'::jsonb,
  '["Start with dog and owner visible.","Walk forward together.","Keep the dog reasonably close for at least five visible owner steps."]'::jsonb,
  5,
  15,
  '["BW003"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BW_001
Challenge Game Title: Walk Five Steps Together
Expected start state: dog and owner are visible before walking starts on a safe controlled route.
Visible checkpoint: dog and owner move together for at least five visible steps while dog stays reasonably close and visible.
Recording setup: one short continuous phone video; dog, owner, owner feet, and path visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 5-15 seconds.
Ordered visible actions: dog and owner start in frame; owner takes at least five visible steps; dog moves with owner.
PASS criteria: dog and owner move together for at least five steps; dog stays reasonably close and visible.
FAIL criteria: five visible steps are not completed.
NEEDS_REVIEW criteria: dog leaves frame; owner feet hidden; step count unclear.
Out-of-scope claims: do not claim loose-leash mastery, reactivity detection, traffic safety, or outdoor reliability.
Safety notes: use a safe controlled route; do not pull or drag the dog.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  10,
  2,
  10,
  3,
  '["Use a safe controlled route.","Do not pull or drag the dog."]'::jsonb,
  true
),
(
  'GAME_BW_002',
  'BETTER_WALKS',
  'Stop With Me',
  'Walk together and stop when the owner stops.',
  'The dog walks with the owner and stops when the owner stops.',
  'medium',
  '["Use one short continuous phone video.","Keep dog, owner, owner feet, and path visible.","Begin before walking starts.","Use a safe controlled route."]'::jsonb,
  '["Walk forward with the dog.","Stop clearly.","Reward when the dog stops near you."]'::jsonb,
  5,
  15,
  '["BW010"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BW_002
Challenge Game Title: Stop With Me
Expected start state: dog and owner are walking together before the owner stop.
Visible checkpoint: owner clearly stops and dog stops near owner.
Recording setup: one short continuous phone video; dog, owner, feet, and path visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 5-15 seconds.
Ordered visible actions: dog and owner walk together; owner stops; dog stops near owner.
PASS criteria: dog and owner walk together; owner clearly stops; dog stops near owner.
FAIL criteria: dog continues walking away.
NEEDS_REVIEW criteria: stop cannot be assessed; dog or owner cropped; timing unclear.
Out-of-scope claims: do not claim generalized walk control, reactivity detection, or street safety.
Safety notes: use a safe controlled route; avoid abrupt leash corrections.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  20,
  5,
  20,
  3,
  '["Use a safe controlled route.","Avoid abrupt leash corrections."]'::jsonb,
  true
),
(
  'GAME_BW_003',
  'BETTER_WALKS',
  'Left Turn Follow',
  'Follow the owner through one visible left turn.',
  'The dog follows owner through one visible left turn.',
  'easy',
  '["Use one short continuous phone video.","Keep dog, owner, route, and turn visible.","Begin before the turn.","Use a safe controlled route."]'::jsonb,
  '["Walk forward.","Turn left once.","Reward after the dog follows into the new direction."]'::jsonb,
  5,
  15,
  '["BW012"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BW_003
Challenge Game Title: Left Turn Follow
Expected start state: dog and owner are visible before one left turn.
Visible checkpoint: owner turns left and dog follows into the new direction.
Recording setup: one short continuous phone video; dog, owner, route, and turn visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 5-15 seconds.
Ordered visible actions: dog and owner start before turn; owner turns left; dog follows.
PASS criteria: owner turns left; dog follows into new direction.
FAIL criteria: dog does not follow.
NEEDS_REVIEW criteria: turn is blocked; dog path hidden; direction change unclear.
Out-of-scope claims: do not claim heel precision, reactivity detection, or generalized walking reliability.
Safety notes: use a clear safe path; do not drag the dog through the turn.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  10,
  2,
  10,
  3,
  '["Use a clear safe path.","Do not drag the dog through the turn."]'::jsonb,
  true
),
(
  'GAME_BW_004',
  'BETTER_WALKS',
  'Right Turn Follow',
  'Follow the owner through one visible right turn.',
  'The dog follows owner through one visible right turn.',
  'easy',
  '["Use one short continuous phone video.","Keep dog, owner, route, and turn visible.","Begin before the turn.","Use a safe controlled route."]'::jsonb,
  '["Walk forward.","Turn right once.","Reward after the dog follows into the new direction."]'::jsonb,
  5,
  15,
  '["BW012"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BW_004
Challenge Game Title: Right Turn Follow
Expected start state: dog and owner are visible before one right turn.
Visible checkpoint: owner turns right and dog follows into the new direction.
Recording setup: one short continuous phone video; dog, owner, route, and turn visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 5-15 seconds.
Ordered visible actions: dog and owner start before turn; owner turns right; dog follows.
PASS criteria: owner turns right; dog follows into new direction.
FAIL criteria: dog does not follow.
NEEDS_REVIEW criteria: turn is blocked; dog path hidden; direction change unclear.
Out-of-scope claims: do not claim heel precision, reactivity detection, or generalized walking reliability.
Safety notes: use a clear safe path; do not drag the dog through the turn.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  10,
  2,
  10,
  3,
  '["Use a clear safe path.","Do not drag the dog through the turn."]'::jsonb,
  true
),
(
  'GAME_BW_005',
  'BETTER_WALKS',
  'U-Turn Follow',
  'Follow the owner through one direction reversal.',
  'The dog follows owner through one direction reversal.',
  'medium',
  '["Use one short continuous phone video.","Keep dog, owner, and route visible.","Begin before the direction reversal.","Use a safe controlled route."]'::jsonb,
  '["Walk forward.","Reverse direction once.","Reward when the dog follows after the turn."]'::jsonb,
  6,
  18,
  '["BW013"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BW_005
Challenge Game Title: U-Turn Follow
Expected start state: dog and owner are visible before one direction reversal.
Visible checkpoint: owner reverses direction and dog follows after the turn.
Recording setup: one short continuous phone video; dog, owner, and route visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 6-18 seconds.
Ordered visible actions: dog and owner set up before reversal; owner reverses direction; dog follows after turn.
PASS criteria: owner reverses direction; dog follows after the turn.
FAIL criteria: dog continues in the original direction.
NEEDS_REVIEW criteria: turn unclear; dog path hidden; route cropped.
Out-of-scope claims: do not claim emergency reliability, reactivity detection, or traffic safety.
Safety notes: use a safe controlled route; do not yank or drag the dog.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  20,
  5,
  20,
  3,
  '["Use a safe controlled route.","Do not yank or drag the dog."]'::jsonb,
  true
),
(
  'GAME_BW_006',
  'BETTER_WALKS',
  'Walk Around One Cone',
  'Follow the owner around one visible cone or household marker.',
  'The dog follows owner around one visible cone or household marker.',
  'medium',
  '["Use one short continuous phone video.","Use one visible cone or safe household marker.","Keep dog, owner, route, and marker visible.","Use a safe controlled route."]'::jsonb,
  '["Set up one visible marker.","Walk around the marker with the dog.","Reward after the route is completed."]'::jsonb,
  6,
  20,
  '["BW025"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BW_006
Challenge Game Title: Walk Around One Cone
Expected start state: dog, owner, and one visible marker are in frame before route begins.
Visible checkpoint: dog and owner complete the route around the marker.
Recording setup: one short continuous phone video; dog, owner, route, and marker visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 6-20 seconds.
Ordered visible actions: marker visible; dog and owner approach; dog and owner travel around marker; route completes.
PASS criteria: dog and owner complete the route around the marker.
FAIL criteria: route is incomplete.
NEEDS_REVIEW criteria: marker unclear; dog path hidden; route completion unclear.
Out-of-scope claims: do not claim obstacle mastery, heel skill, or reactivity detection.
Safety notes: use a stable safe marker; keep route clear.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  20,
  5,
  20,
  3,
  '["Use a stable safe marker.","Keep route clear."]'::jsonb,
  true
),
(
  'GAME_BW_007',
  'BETTER_WALKS',
  'Figure Eight Walk',
  'Follow the owner around two markers in a figure-eight route.',
  'The dog follows owner around two markers in a figure-eight route.',
  'hard',
  '["Use one short continuous phone video.","Use two visible cones or safe household markers.","Keep dog, owner, route, and both markers visible.","Use a safe controlled route with enough space."]'::jsonb,
  '["Set up two visible markers.","Walk one recognizable figure eight with the dog.","Reward after the figure-eight route is completed."]'::jsonb,
  10,
  30,
  '["BW026"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BW_007
Challenge Game Title: Figure Eight Walk
Expected start state: dog, owner, and two markers are visible before route begins.
Visible checkpoint: two markers are visible and dog and owner complete one recognizable figure eight.
Recording setup: one short continuous phone video; dog, owner, route, and both markers visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 10-30 seconds.
Ordered visible actions: two markers visible; dog and owner enter route; dog and owner travel around both markers in figure eight; route completes.
PASS criteria: two markers are visible; dog and owner complete one recognizable figure eight.
FAIL criteria: route is incomplete.
NEEDS_REVIEW criteria: dog leaves frame too long; markers cropped; route pattern unclear.
Out-of-scope claims: do not claim advanced heelwork, reactivity detection, or public-route reliability.
Safety notes: use stable safe markers; keep route clear and low distraction.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  35,
  10,
  35,
  3,
  '["Use stable safe markers.","Keep route clear and low distraction."]'::jsonb,
  true
),
(
  'GAME_BW_008',
  'BETTER_WALKS',
  'Doorway Start',
  'Wait briefly before starting a controlled walk through a doorway.',
  'The dog waits briefly before starting a controlled walk through a doorway.',
  'medium',
  '["Use one short continuous phone video.","Use a safe indoor doorway.","Keep dog, owner, doorway boundary, and start path visible.","Do not use a traffic-facing exit."]'::jsonb,
  '["Start behind the doorway boundary.","Wait at least 3 seconds.","Release into the walk."]'::jsonb,
  6,
  20,
  '["BW019"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BW_008
Challenge Game Title: Doorway Start
Expected start state: dog starts behind a visible safe doorway boundary before the walk begins.
Visible checkpoint: dog waits at least 3 seconds and starts walking after release.
Recording setup: one short continuous phone video; dog, owner, doorway boundary, and start path visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 6-20 seconds.
Ordered visible actions: dog starts behind boundary; dog waits at least 3 seconds; release moment occurs; dog starts walking after release.
PASS criteria: dog waits at least 3 seconds; dog starts walking after release.
FAIL criteria: dog rushes through before release.
NEEDS_REVIEW criteria: doorway boundary unclear; timing unclear; dog hidden.
Out-of-scope claims: do not claim exterior-door safety, traffic safety, or reactivity detection.
Safety notes: use a safe doorway; do not perform near traffic or public streets.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  20,
  5,
  20,
  3,
  '["Use a safe doorway.","Do not perform near traffic or public streets."]'::jsonb,
  true
),
(
  'GAME_BW_009',
  'BETTER_WALKS',
  'Walk to Mat and Stop',
  'Walk with owner to a visible mat and stop on or beside it.',
  'The dog walks with owner to a visible mat and stops on or beside it.',
  'medium',
  '["Use one short continuous phone video.","Keep dog, owner, path, and visible mat in frame.","Begin before walking starts.","Use a safe controlled route."]'::jsonb,
  '["Start away from the mat.","Walk toward the mat with the dog.","Stop on or directly beside the mat."]'::jsonb,
  6,
  20,
  '["BW010","BH007"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BW_009
Challenge Game Title: Walk to Mat and Stop
Expected start state: dog and owner start away from a visible mat on a safe route.
Visible checkpoint: dog moves toward mat and stops on or directly beside mat.
Recording setup: one short continuous phone video; dog, owner, path, and mat visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 6-20 seconds.
Ordered visible actions: dog, owner, path, and mat visible; dog and owner move toward mat; dog stops on or directly beside mat.
PASS criteria: dog moves toward mat; dog stops on or directly beside mat.
FAIL criteria: dog does not reach mat area; dog does not stop.
NEEDS_REVIEW criteria: mat or stop blocked; path cropped; stop location unclear.
Out-of-scope claims: do not claim place reliability, reactivity detection, or outdoor reliability.
Safety notes: use a safe controlled route; keep the mat flat and stable.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  20,
  5,
  20,
  3,
  '["Use a safe controlled route.","Keep the mat flat and stable."]'::jsonb,
  true
),
(
  'GAME_BW_010',
  'BETTER_WALKS',
  'Stop Before the Line',
  'Stop before crossing a visible floor line.',
  'The dog stops before crossing a visible floor line.',
  'medium',
  '["Use one short continuous phone video.","Use tape, chalk, or a safe visual boundary.","Keep dog, owner, route, and boundary line visible.","Do not perform near traffic."]'::jsonb,
  '["Set up a visible safe floor line.","Approach the line with the dog.","Stop before the line and wait at least 3 seconds."]'::jsonb,
  6,
  20,
  '["BW021"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BW_010
Challenge Game Title: Stop Before the Line
Expected start state: dog and owner start before a visible safe floor line or boundary.
Visible checkpoint: dog approaches line with owner, stops before line, and waits at least 3 seconds.
Recording setup: one short continuous phone video; dog, owner, route, and line visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 6-20 seconds.
Ordered visible actions: boundary line visible; dog approaches with owner; dog stops before line; dog waits at least 3 seconds.
PASS criteria: dog approaches line with owner; dog stops before line; dog waits at least 3 seconds.
FAIL criteria: dog crosses before pause.
NEEDS_REVIEW criteria: boundary line unclear; dog paws hidden; timing unclear.
Out-of-scope claims: do not claim road safety, traffic reliability, or reactivity detection.
Safety notes: use tape, chalk, or a safe visual boundary; do not perform near traffic.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  20,
  5,
  20,
  3,
  '["Use tape, chalk, or a safe visual boundary.","Do not perform near traffic."]'::jsonb,
  true
)
on conflict (id) do update set
  category = excluded.category,
  title = excluded.title,
  subtitle = excluded.subtitle,
  description = excluded.description,
  difficulty = excluded.difficulty,
  recording_setup = excluded.recording_setup,
  user_instructions = excluded.user_instructions,
  min_clip_seconds = excluded.min_clip_seconds,
  max_clip_seconds = excluded.max_clip_seconds,
  required_mastered_activity_ids = excluded.required_mastered_activity_ids,
  verifier_prompt = excluded.verifier_prompt,
  silver_coin_entry_cost = excluded.silver_coin_entry_cost,
  gold_coin_pass_reward = excluded.gold_coin_pass_reward,
  bonus_xp = excluded.bonus_xp,
  max_stars = excluded.max_stars,
  safety_notes = excluded.safety_notes,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());
