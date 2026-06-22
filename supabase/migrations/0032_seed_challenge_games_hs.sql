-- ============================================================
-- Migration 0032 — Seed Helpful Skills Around the House Games
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
  'GAME_HS_001',
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'Bring the Toy',
  'Bring a visible toy toward the owner.',
  'The dog brings a visible toy toward owner.',
  'easy',
  '["Use one short continuous phone video.","Keep dog, owner or destination area, toy, and route visible.","Begin before the dog starts bringing the toy.","Use a safe toy and clear route."]'::jsonb,
  '["Start with the dog and toy visible.","Invite the dog to bring the toy.","Reward when the dog reaches the owner or destination area."]'::jsonb,
  6,
  20,
  '["HH010"]'::jsonb,
  $prompt$Challenge Game ID: GAME_HS_001
Challenge Game Title: Bring the Toy
Expected start state: dog starts with access to a visible safe toy and visible owner or destination area.
Visible checkpoint: dog carries or moves toy toward owner and reaches owner or destination area.
Recording setup: one short continuous phone video; dog, toy, route, and owner or destination visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 6-20 seconds.
Ordered visible actions: toy visible; dog carries or moves toy toward owner; dog reaches owner or destination area.
PASS criteria: dog carries or moves toy toward owner; dog reaches owner or destination area.
FAIL criteria: dog does not bring toy.
NEEDS_REVIEW criteria: toy is blocked; dog path hidden; destination unclear.
Out-of-scope claims: do not claim service-task reliability or exact object localization.
Safety notes: use a safe toy and clear route.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  10,
  2,
  10,
  3,
  '["Use a safe toy.","Keep the route clear."]'::jsonb,
  true
),
(
  'GAME_HS_002',
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'Drop Toy Near Owner',
  'Release a toy near the owner.',
  'The dog releases a toy near owner.',
  'easy',
  '["Use one short continuous phone video.","Keep dog mouth, toy, owner area, and release location visible.","Begin while the dog has or approaches with the toy.","Do not forcibly remove the toy."]'::jsonb,
  '["Start with the dog holding the toy.","Ask for the drop if desired.","Reward after release near owner."]'::jsonb,
  5,
  20,
  '["HH011"]'::jsonb,
  $prompt$Challenge Game ID: GAME_HS_002
Challenge Game Title: Drop Toy Near Owner
Expected start state: dog begins with a visible toy near or approaching the owner area.
Visible checkpoint: dog visibly releases toy near owner.
Recording setup: one short continuous phone video; dog mouth, toy, owner area, and release location visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 5-20 seconds.
Ordered visible actions: dog begins with toy; dog is near owner area; dog visibly releases toy near owner.
PASS criteria: dog begins with toy; dog visibly releases toy near owner.
FAIL criteria: dog does not release toy.
NEEDS_REVIEW criteria: release location unclear; toy release hidden; dog mouth cropped.
Out-of-scope claims: do not claim generalized drop reliability or resource guarding improvement.
Safety notes: use a safe toy and do not pry it from the dog.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  10,
  2,
  10,
  3,
  '["Use a safe toy.","Do not pry the toy from the dog."]'::jsonb,
  true
),
(
  'GAME_HS_003',
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'Toy Box Drop',
  'Drop one toy into a visible basket or toy box.',
  'The dog drops one toy into a visible basket or toy box.',
  'medium',
  '["Use one short continuous phone video.","Keep dog, toy, basket or toy box, and release moment visible.","Begin before the dog reaches the basket.","Do not place the toy in the basket by hand."]'::jsonb,
  '["Set out one visible basket or toy box.","Have the dog bring the toy.","Reward after the toy ends inside the basket."]'::jsonb,
  6,
  25,
  '["HH012"]'::jsonb,
  $prompt$Challenge Game ID: GAME_HS_003
Challenge Game Title: Toy Box Drop
Expected start state: dog has or approaches with one visible toy and basket or toy box is visible.
Visible checkpoint: dog releases toy and toy visibly ends inside basket.
Recording setup: one short continuous phone video; dog, toy, basket, and release moment visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 6-25 seconds.
Ordered visible actions: dog and toy visible; basket visible; dog releases toy; toy ends inside basket.
PASS criteria: dog releases toy; toy visibly ends inside basket.
FAIL criteria: toy does not land inside basket.
NEEDS_REVIEW criteria: toy or basket blocked; release hidden; final toy location unclear.
Out-of-scope claims: do not claim generalized cleanup or exact object localization.
Safety notes: use a stable basket and safe toy.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  20,
  5,
  20,
  3,
  '["Use a stable basket.","Use a safe toy."]'::jsonb,
  true
),
(
  'GAME_HS_004',
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'Carry Toy to Mat',
  'Carry a visible toy to a visible mat.',
  'The dog carries a visible toy to a visible mat.',
  'medium',
  '["Use one short continuous phone video.","Keep toy, dog mouth, route, and mat visible.","Start with dog away from the mat.","Use a safe flat mat and clear route."]'::jsonb,
  '["Start with the dog away from the mat with the toy.","Invite the dog toward the mat.","Reward when the dog reaches the mat area while carrying the toy."]'::jsonb,
  6,
  20,
  '["HH026"]'::jsonb,
  $prompt$Challenge Game ID: GAME_HS_004
Challenge Game Title: Carry Toy to Mat
Expected start state: dog starts away from visible mat while carrying or picking up a visible toy.
Visible checkpoint: dog starts away from mat with toy and reaches mat area while carrying toy.
Recording setup: one short continuous phone video; toy, dog mouth, route, and mat visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 6-20 seconds.
Ordered visible actions: dog starts away from mat with toy; dog carries toy toward mat; dog reaches mat area with toy.
PASS criteria: dog starts away from mat with toy; dog reaches mat area while carrying toy.
FAIL criteria: dog never reaches mat area.
NEEDS_REVIEW criteria: toy or mat unclear; dog mouth hidden; route cropped.
Out-of-scope claims: do not claim generalized delivery or exact object localization.
Safety notes: use a safe toy and keep mat flat.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  20,
  5,
  20,
  3,
  '["Use a safe toy.","Keep mat flat and route clear."]'::jsonb,
  true
),
(
  'GAME_HS_005',
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'Pick Up the Toy',
  'Pick up one visible toy from the floor.',
  'The dog picks up one visible toy from floor.',
  'easy',
  '["Use one short continuous phone video.","Keep toy, dog mouth, and floor area visible.","Begin with the toy on the floor.","Use a safe toy."]'::jsonb,
  '["Place one toy on the floor.","Start recording before pickup.","Reward after the dog visibly picks up the toy."]'::jsonb,
  4,
  15,
  '["HH009"]'::jsonb,
  $prompt$Challenge Game ID: GAME_HS_005
Challenge Game Title: Pick Up the Toy
Expected start state: one visible toy begins on floor and dog is visible before pickup.
Visible checkpoint: toy begins on floor and dog visibly picks up toy.
Recording setup: one short continuous phone video; toy, dog mouth, and floor area visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 4-15 seconds.
Ordered visible actions: toy begins on floor; dog moves to toy; dog visibly picks up toy.
PASS criteria: toy begins on floor; dog visibly picks up toy.
FAIL criteria: dog does not pick up toy.
NEEDS_REVIEW criteria: pickup blocked; toy hidden; dog mouth cropped.
Out-of-scope claims: do not claim formal retrieve reliability or exact object localization.
Safety notes: use a safe toy and clear floor.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  10,
  2,
  10,
  3,
  '["Use a safe toy.","Keep the floor clear."]'::jsonb,
  true
),
(
  'GAME_HS_006',
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'Touch the Target',
  'Touch a visible target with the nose.',
  'The dog touches a visible target with nose.',
  'easy',
  '["Use one short continuous phone video.","Keep target and dog nose visible.","Begin before the dog moves to the target.","Do not press the target into the dog."]'::jsonb,
  '["Present a visible safe target.","Let the dog move toward it.","Reward after nose contact."]'::jsonb,
  4,
  15,
  '["HH001"]'::jsonb,
  $prompt$Challenge Game ID: GAME_HS_006
Challenge Game Title: Touch the Target
Expected start state: dog and visible target are in frame before contact.
Visible checkpoint: dog nose reaches target.
Recording setup: one short continuous phone video; target and dog nose visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 4-15 seconds.
Ordered visible actions: target and dog nose visible; dog moves nose toward target; dog nose reaches target.
PASS criteria: dog nose reaches target.
FAIL criteria: no visible target touch.
NEEDS_REVIEW criteria: target or nose blocked; contact moment unclear.
Out-of-scope claims: do not claim generalized target reliability or exact object localization.
Safety notes: use a safe target and do not push into dog face.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  10,
  2,
  10,
  3,
  '["Use a safe target.","Do not push into the dog face."]'::jsonb,
  true
),
(
  'GAME_HS_007',
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'Go to the Mat',
  'Move to a visible mat and stay briefly.',
  'The dog moves to visible mat and stays briefly.',
  'easy',
  '["Use one short continuous phone video.","Keep dog, route, and full mat visible.","Begin with the dog off the mat.","Use a safe stable mat."]'::jsonb,
  '["Start with dog off the mat.","Cue or invite the dog to the mat.","Reward after the dog remains at least 5 seconds."]'::jsonb,
  6,
  20,
  '["HH002"]'::jsonb,
  $prompt$Challenge Game ID: GAME_HS_007
Challenge Game Title: Go to the Mat
Expected start state: dog starts off the visible mat with route and mat in frame.
Visible checkpoint: dog starts off mat, reaches mat, and remains at least 5 seconds.
Recording setup: one short continuous phone video; dog, route, and full mat visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 6-20 seconds.
Ordered visible actions: dog starts off mat; dog reaches mat; dog remains at least 5 seconds.
PASS criteria: dog starts off mat; dog reaches mat; dog remains at least 5 seconds.
FAIL criteria: dog does not reach mat; dog immediately leaves.
NEEDS_REVIEW criteria: mat blocked; dog leaves frame; hold duration unclear.
Out-of-scope claims: do not claim relaxation or long-duration mat reliability.
Safety notes: use a stable non-slip mat and do not drag dog onto it.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  10,
  2,
  10,
  3,
  '["Use a stable non-slip mat.","Do not drag the dog onto the mat."]'::jsonb,
  true
),
(
  'GAME_HS_008',
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'Bring Toy and Sit',
  'Bring a toy toward owner and then sit.',
  'The dog brings toy toward owner and then sits.',
  'hard',
  '["Use one short continuous phone video.","Keep dog, toy, owner area, route, and final hips visible.","Begin before the toy return.","Do not force the sit."]'::jsonb,
  '["Have the dog bring a visible toy.","Ask for or wait for a sit near owner.","Reward after the sit is visible."]'::jsonb,
  8,
  25,
  '["HH010"]'::jsonb,
  $prompt$Challenge Game ID: GAME_HS_008
Challenge Game Title: Bring Toy and Sit
Expected start state: dog starts with or moves toward a visible toy before returning toward owner.
Visible checkpoint: dog returns toward owner with toy and visibly sits near owner.
Recording setup: one short continuous phone video; dog, toy, owner area, route, and hips visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 8-25 seconds.
Ordered visible actions: dog returns toward owner with toy; dog reaches owner area; dog visibly sits near owner.
PASS criteria: dog returns toward owner with toy; dog visibly sits near owner.
FAIL criteria: toy return or sit is missing.
NEEDS_REVIEW criteria: final sit blocked; toy hidden; dog hips cropped.
Out-of-scope claims: do not claim formal retrieve finish or service-task reliability.
Safety notes: use a safe toy and do not push dog into a sit.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  35,
  10,
  35,
  3,
  '["Use a safe toy.","Do not push the dog into a sit."]'::jsonb,
  true
),
(
  'GAME_HS_009',
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'Two-Toy Cleanup',
  'Place two visible toys into a basket in one clip.',
  'The dog places two visible toys into basket in one clip.',
  'hard',
  '["Use one short continuous phone video.","Keep two toys, basket, dog, and route visible across both cleanup actions.","Begin before the first cleanup action.","Do not place toys in the basket by hand."]'::jsonb,
  '["Set out two visible safe toys and one basket.","Record both toy placements.","Reward after two toys end inside the basket."]'::jsonb,
  12,
  40,
  '["HH014"]'::jsonb,
  $prompt$Challenge Game ID: GAME_HS_009
Challenge Game Title: Two-Toy Cleanup
Expected start state: two visible toys and visible basket are available before cleanup sequence.
Visible checkpoint: two toys visibly end inside basket.
Recording setup: one short continuous phone video; two toys, basket, dog, and route visible across both actions.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 12-40 seconds.
Ordered visible actions: first cleanup action visible; first toy ends inside basket; second cleanup action visible; second toy ends inside basket.
PASS criteria: two toys visibly end inside basket.
FAIL criteria: fewer than two toys end inside basket.
NEEDS_REVIEW criteria: one cleanup action blocked; basket hidden; toy final location unclear.
Out-of-scope claims: do not claim generalized cleanup or exact object localization.
Safety notes: use safe toys and stable basket.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  35,
  10,
  35,
  3,
  '["Use safe toys.","Keep the basket stable and route clear."]'::jsonb,
  true
),
(
  'GAME_HS_010',
  'HELPFUL_SKILLS_AROUND_THE_HOUSE',
  'Toy Delivery to Person',
  'Carry a toy toward a visible person.',
  'The dog carries toy toward a visible person.',
  'medium',
  '["Use one short continuous phone video.","Keep dog, toy, route, and destination person visible.","Begin before the dog approaches the person.","Use a safe toy and clear route."]'::jsonb,
  '["Start with dog and toy visible.","Invite delivery to the visible person.","Reward when the dog reaches the destination area."]'::jsonb,
  6,
  20,
  '["HH024"]'::jsonb,
  $prompt$Challenge Game ID: GAME_HS_010
Challenge Game Title: Toy Delivery to Person
Expected start state: dog starts with or near a visible toy and a visible destination person is in frame.
Visible checkpoint: dog carries toy toward person and reaches destination area.
Recording setup: one short continuous phone video; dog, toy, route, and destination person visible.
Required references: DOG_PROFILE must match the visible target dog.
Audio rule: audio is not required.
Clip duration: 6-20 seconds.
Ordered visible actions: dog carries toy toward person; person remains visible; dog reaches destination area.
PASS criteria: dog carries toy toward person; dog reaches destination area.
FAIL criteria: dog does not approach person with toy.
NEEDS_REVIEW criteria: person or toy blocked; route cropped; destination unclear.
Out-of-scope claims: do not claim generalized delivery or person-name comprehension.
Safety notes: use a safe toy and low-pressure route.
Return strict JSON only: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}$prompt$,
  20,
  5,
  20,
  3,
  '["Use a safe toy.","Keep the route clear and low pressure."]'::jsonb,
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
