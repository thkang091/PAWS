-- ============================================================
-- Migration 0030 — Seed Better Behavior at Home Challenge Games
-- ============================================================
-- These Challenge Games use Silver Coin entry costs and Gold Coin
-- PASS rewards from the centralized challenge economy. FAIL and
-- NEEDS_REVIEW are handled by settle_challenge_game_attempt and do
-- not award Gold Coins.

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
  'GAME_BH_001',
  'BETTER_BEHAVIOR_AT_HOME',
  'Go to Your Mat',
  'Move onto a visible mat and remain there briefly.',
  'The owner cues the dog to move onto a visible mat and remain there briefly.',
  'easy',
  '["Use one short continuous phone video.","Place one mat fully in camera view.","Start with the dog off the mat.","Keep the dog and full mat visible."]'::jsonb,
  '["Start recording.","Cue the dog to go to the mat.","Wait until the dog is fully on the mat.","Keep the dog on the mat for at least 5 seconds."]'::jsonb,
  6,
  20,
  '["BH009"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BH_001
Challenge Game Title: Go to Your Mat
Expected start state: dog starts off the visible mat.
Visible checkpoint: dog moves onto the mat and stays there for at least 5 seconds.
Recording setup: one short continuous phone video; dog and full mat visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 6-20 seconds.
Ordered visible actions: dog starts off mat; dog moves onto mat; dog stays on mat for at least 5 seconds.
PASS criteria: dog starts off mat; dog moves onto mat; dog stays on mat at least 5 seconds.
FAIL criteria: dog never reaches mat; dog immediately leaves mat.
NEEDS_REVIEW criteria: mat blocked; dog leaves frame; video cut or unclear.
Out-of-scope claims: do not infer relaxation or long-term reliability.
Safety notes: use a stable mat and never force the dog.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  10,
  2,
  10,
  3,
  '["Use a stable mat.","Never force the dog.","Keep repetitions short."]'::jsonb,
  true
),
(
  'GAME_BH_002',
  'BETTER_BEHAVIOR_AT_HOME',
  'Mat Stay Challenge',
  'Remain on a visible mat for at least 15 seconds.',
  'The dog remains on a visible mat for at least 15 seconds.',
  'medium',
  '["Use one short continuous phone video.","Keep the dog and full mat visible.","Begin before the hold interval.","Do not physically hold the dog on the mat."]'::jsonb,
  '["Set the dog up on the mat.","Let the dog hold position.","Reward after the visible 15-second hold."]'::jsonb,
  16,
  30,
  '["BH010"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BH_002
Challenge Game Title: Mat Stay Challenge
Expected start state: dog is on a visible mat before the hold interval.
Visible checkpoint: dog remains on the mat for at least 15 seconds.
Recording setup: one short continuous phone video; dog and full mat visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 16-30 seconds.
Ordered visible actions: dog is on mat; mat remains visible; dog remains on mat for at least 15 seconds.
PASS criteria: dog remains on mat at least 15 seconds.
FAIL criteria: dog clearly leaves mat before 15 seconds.
NEEDS_REVIEW criteria: dog or mat is not fully visible; duration unclear.
Out-of-scope claims: do not infer calmness, anxiety improvement, or indefinite stay reliability.
Safety notes: use a comfortable surface and avoid restraint.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  20,
  5,
  20,
  3,
  '["Use a comfortable surface.","Avoid physical restraint."]'::jsonb,
  true
),
(
  'GAME_BH_003',
  'BETTER_BEHAVIOR_AT_HOME',
  'Doorway Wait',
  'Wait behind a doorway boundary until release.',
  'The dog waits behind a doorway boundary until release.',
  'medium',
  '["Use one short continuous phone video.","Record from the side.","Keep dog and doorway visible.","Use a safe indoor doorway."]'::jsonb,
  '["Start with the dog behind the doorway boundary.","Open the door while the dog waits.","Release the dog after at least 5 seconds."]'::jsonb,
  8,
  25,
  '["BH017"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BH_003
Challenge Game Title: Doorway Wait
Expected start state: dog starts behind a visible indoor doorway boundary.
Visible checkpoint: dog stays behind doorway while door opens, waits at least 5 seconds, and crosses only after release.
Recording setup: one short continuous phone video; side view; dog and doorway visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 8-25 seconds.
Ordered visible actions: dog waits behind boundary; door opens; dog waits at least 5 seconds; dog crosses after release.
PASS criteria: dog stays behind doorway while door opens; dog waits at least 5 seconds; dog crosses only after release.
FAIL criteria: dog rushes through before release.
NEEDS_REVIEW criteria: doorway boundary cannot be seen clearly; timing unclear; dog hidden.
Out-of-scope claims: do not claim exterior-door safety, traffic safety, or generalized impulse control.
Safety notes: use an indoor doorway and do not practice near traffic-facing exits.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  20,
  5,
  20,
  3,
  '["Use a safe indoor doorway.","Do not practice near traffic-facing exits."]'::jsonb,
  true
),
(
  'GAME_BH_004',
  'BETTER_BEHAVIOR_AT_HOME',
  'Food Bowl Wait',
  'Wait briefly before approaching a visible food bowl.',
  'The dog waits briefly before approaching a visible food bowl.',
  'medium',
  '["Use one short continuous phone video.","Keep dog, bowl, and owner hand movement visible.","Begin before the dog approaches."]'::jsonb,
  '["Start with the dog away from the bowl.","Wait at least 5 seconds.","Release the dog toward the bowl."]'::jsonb,
  8,
  20,
  '["BH020"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BH_004
Challenge Game Title: Food Bowl Wait
Expected start state: dog starts away from a visible food bowl.
Visible checkpoint: dog waits at least 5 seconds and approaches only after release.
Recording setup: one short continuous phone video; dog, bowl, and owner hand movement visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 8-20 seconds.
Ordered visible actions: dog is away from bowl; dog waits at least 5 seconds; dog approaches only after release.
PASS criteria: dog waits at least 5 seconds; dog approaches only after release.
FAIL criteria: dog reaches the bowl before release.
NEEDS_REVIEW criteria: bowl or dog is blocked from view; timing unclear.
Out-of-scope claims: do not infer food guarding status or permanent meal manners.
Safety notes: avoid conflict around food; stop if guarding behavior appears.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  20,
  5,
  20,
  3,
  '["Avoid conflict around food.","Stop if guarding behavior appears."]'::jsonb,
  true
),
(
  'GAME_BH_005',
  'BETTER_BEHAVIOR_AT_HOME',
  'Drop the Toy',
  'Release a visible toy after the drop cue.',
  'The dog releases a visible toy after the owner gives the drop cue.',
  'easy',
  '["Use one short continuous phone video.","Keep dog mouth and toy visible.","Begin before the release attempt.","Do not force the toy out."]'::jsonb,
  '["Play briefly with a safe toy.","Give the drop cue.","Reward the visible release."]'::jsonb,
  5,
  20,
  '["BH026"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BH_005
Challenge Game Title: Drop the Toy
Expected start state: dog has a visible toy before the drop attempt.
Visible checkpoint: dog visibly releases the toy.
Recording setup: one short continuous phone video; dog mouth and toy visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 5-20 seconds.
Ordered visible actions: toy visible; drop opportunity occurs; dog releases toy; no forced removal.
PASS criteria: dog visibly releases the toy.
FAIL criteria: dog does not release the toy.
NEEDS_REVIEW criteria: toy release cannot be seen clearly; mouth or toy cropped.
Out-of-scope claims: do not claim resource guarding improvement or treatment success.
Safety notes: use a safe toy and do not pry the toy from the dog's mouth.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  10,
  2,
  10,
  3,
  '["Use a safe toy.","Do not force toy removal."]'::jsonb,
  true
),
(
  'GAME_BH_006',
  'BETTER_BEHAVIOR_AT_HOME',
  'Leave the Toy Alone',
  'Avoid picking up a visible toy for at least 5 seconds.',
  'The dog avoids picking up a visible toy for at least 5 seconds.',
  'easy',
  '["Use one short continuous phone video.","Keep dog and toy visible.","Begin before the wait interval.","Do not physically hold the dog back."]'::jsonb,
  '["Place a visible safe toy.","Start the dog away from the toy.","Reward after the dog avoids picking up the toy for at least 5 seconds."]'::jsonb,
  6,
  20,
  '["BH037"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BH_006
Challenge Game Title: Leave the Toy Alone
Expected start state: dog starts near or oriented to a visible toy.
Visible checkpoint: dog does not pick up the toy for at least 5 seconds.
Recording setup: one short continuous phone video; dog and toy visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 6-20 seconds.
Ordered visible actions: toy visible; dog remains visible; dog does not pick up toy for at least 5 seconds.
PASS criteria: dog does not pick up toy for at least 5 seconds.
FAIL criteria: dog picks up toy before the wait ends.
NEEDS_REVIEW criteria: toy or dog is not clearly visible; timing unclear.
Out-of-scope claims: do not claim generalized leave-it or permanent toy manners.
Safety notes: use a safe toy and avoid restraint.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  10,
  2,
  10,
  3,
  '["Use a safe toy.","Avoid physical restraint."]'::jsonb,
  true
),
(
  'GAME_BH_007',
  'BETTER_BEHAVIOR_AT_HOME',
  'Sit for Greeting',
  'Remain seated while a familiar person calmly approaches.',
  'The dog remains seated while a familiar person calmly approaches.',
  'medium',
  '["Use one short continuous phone video.","Use a familiar person.","Keep dog and person visible.","Avoid overwhelming the dog."]'::jsonb,
  '["Start with the dog seated or entering a sit.","Have a familiar person approach calmly.","Reward after the dog remains seated for at least 3 seconds."]'::jsonb,
  6,
  20,
  '["BH003","BH022"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BH_007
Challenge Game Title: Sit for Greeting
Expected start state: dog is seated or transitions into sit before the familiar person approaches.
Visible checkpoint: dog remains seated during the approach for at least 3 seconds.
Recording setup: one short continuous phone video; dog and familiar person visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 6-20 seconds.
Ordered visible actions: familiar person approaches; dog remains seated; seated hold lasts at least 3 seconds.
PASS criteria: dog remains seated during the approach for at least 3 seconds.
FAIL criteria: dog jumps onto person; dog immediately leaves the seated position.
NEEDS_REVIEW criteria: dog is blocked by approaching person; seated posture unclear.
Out-of-scope claims: do not claim generalized greeting manners or permanent jumping solution.
Safety notes: use a familiar person and keep the approach low intensity.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  20,
  5,
  20,
  3,
  '["Use a familiar person.","Keep the approach low intensity."]'::jsonb,
  true
),
(
  'GAME_BH_008',
  'BETTER_BEHAVIOR_AT_HOME',
  'Calm After Play',
  'Transition from short play to a mat stay.',
  'The dog transitions from short play to a mat stay.',
  'hard',
  '["Use one short continuous phone video.","Use one visible toy and one visible mat.","Keep dog, toy, path, and mat visible."]'::jsonb,
  '["Play briefly with a visible toy.","Cue the dog to move to the mat.","Keep the dog on the mat for at least 5 seconds."]'::jsonb,
  10,
  30,
  '["BH036"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BH_008
Challenge Game Title: Calm After Play
Expected start state: dog is participating in short play with a visible toy.
Visible checkpoint: dog moves to the mat after the cue and stays on the mat for at least 5 seconds.
Recording setup: one short continuous phone video; one visible toy and one visible mat.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 10-30 seconds.
Ordered visible actions: short play visible; dog moves to mat after cue; dog stays on mat at least 5 seconds.
PASS criteria: dog participates in short play; dog moves to mat after cue; dog stays on mat at least 5 seconds.
FAIL criteria: dog never reaches mat; dog immediately leaves mat.
NEEDS_REVIEW criteria: play-to-mat transition cannot be assessed; dog or mat hidden.
Out-of-scope claims: do not infer emotional regulation or permanent calmness.
Safety notes: use a safe toy and stop before arousal escalates.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  35,
  10,
  35,
  3,
  '["Use a safe toy.","Stop before arousal escalates."]'::jsonb,
  true
),
(
  'GAME_BH_009',
  'BETTER_BEHAVIOR_AT_HOME',
  'Open Crate Entry',
  'Voluntarily enter an open crate or visible safe-zone area.',
  'The dog voluntarily enters an open crate or visible safe-zone area after a cue.',
  'easy',
  '["Use one short continuous phone video.","Keep dog and entry area visible.","Keep crate door open if using a crate.","Begin before entry."]'::jsonb,
  '["Start with dog outside the crate or safe-zone area.","Cue voluntary entry.","Reward without closing the crate door."]'::jsonb,
  5,
  20,
  '["BH012"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BH_009
Challenge Game Title: Open Crate Entry
Expected start state: dog starts outside a visible open crate or safe-zone area.
Visible checkpoint: dog voluntarily enters the open crate or safe-zone area.
Recording setup: one short continuous phone video; entry area visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 5-20 seconds.
Ordered visible actions: dog starts outside; crate or safe-zone area visible; dog enters voluntarily; no force.
PASS criteria: dog voluntarily enters the open crate or safe-zone area.
FAIL criteria: dog does not enter; dog is physically forced into the area.
NEEDS_REVIEW criteria: entry cannot be seen clearly.
Out-of-scope claims: do not claim crate comfort or alone-time safety.
Safety notes: do not close the crate door and do not force the dog.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  10,
  2,
  10,
  3,
  '["Do not close the crate door.","Do not force the dog into the area."]'::jsonb,
  true
),
(
  'GAME_BH_010',
  'BETTER_BEHAVIOR_AT_HOME',
  'Door Open Mat Stay',
  'Remain on a visible mat while the owner opens a nearby door.',
  'The dog remains on a visible mat while the owner opens a nearby door.',
  'hard',
  '["Use one short continuous phone video.","Keep dog, mat, and nearby door visible.","Begin before the door opens."]'::jsonb,
  '["Start with the dog on the mat.","Open a nearby interior door.","Keep the dog on the mat for at least 5 seconds."]'::jsonb,
  8,
  25,
  '["BH010","BH017"]'::jsonb,
  $prompt$Challenge Game ID: GAME_BH_010
Challenge Game Title: Door Open Mat Stay
Expected start state: dog starts on a visible mat before the nearby door opens.
Visible checkpoint: dog stays on the mat while the door opens and stays for at least 5 seconds.
Recording setup: one short continuous phone video; dog, mat, and door visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 8-25 seconds.
Ordered visible actions: dog starts on mat; door opens; dog stays on mat at least 5 seconds.
PASS criteria: dog stays on the mat while the door opens; dog stays for at least 5 seconds.
FAIL criteria: dog immediately leaves the mat when the door opens.
NEEDS_REVIEW criteria: dog, mat, or door is not visible clearly; timing unclear.
Out-of-scope claims: do not claim exterior-door reliability or permanent calmness at home.
Safety notes: use an interior doorway and do not practice near unsafe exits.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  35,
  10,
  35,
  3,
  '["Use an interior doorway.","Do not practice near unsafe exits."]'::jsonb,
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
