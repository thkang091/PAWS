-- ============================================================
-- Migration 0038 — Seed SO001–SO020: Safety and Obedience
-- ============================================================
-- Category: SAFETY_AND_OBEDIENCE
-- Covers: Recall, Sit-Stay, Down-Stay, Wait at Threshold,
--   Loose-Leash Walking, Leave It, Drop It, Hand Touch,
--   Look/Focus, Emergency Stop.
--
-- Self-referential FK strategy: insert all rows NULL for
-- regression_activity_id / harder_activity_id, then UPDATE.
-- coinReward = 0 for all BETA activities.
-- ============================================================

INSERT INTO training_catalog_activities (
  id, category, sequence_number, level,
  title, skill_family, quest_content_type,
  lesson_goal, why_it_matters,
  tutorial_steps, visible_checkpoint,
  prerequisites, regression_activity_id, harder_activity_id,
  required_reference_assets, recommended_fps,
  min_clip_seconds, max_clip_seconds,
  pass_criteria, fail_criteria, needs_review_criteria, safety_notes,
  minimum_auto_pass_confidence, minimum_auto_fail_confidence,
  verification_status, xp_reward, coin_reward, stars_available,
  vlm_prompt, start_state_criteria, out_of_scope_claims, recording_requirements
)
VALUES

-- ── SO001: Recall at 1 Metre ──────────────────────────────────────────────────
(
  'SO001', 'SAFETY_AND_OBEDIENCE', 1, 1,
  'Recall at 1 Metre',
  'Emergency Recall',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog turns and moves toward the handler within 3 seconds of a single "Come" cue from 1 metre away.',
  'Recall is the most important safety behavior a dog can learn. A dog that comes when called can be stopped before reaching traffic, other dogs, or dangerous situations. Starting at 1 metre with high rewards builds a rock-solid conditioned response before adding distance.',
  $so001_steps$[
    "Place your dog in a sit or let them sniff the floor 1 metre away. Do not let them wander further.",
    "Say \"Come\" once in a clear, happy tone. Never repeat it.",
    "The instant the dog turns toward you, back up a step and praise enthusiastically.",
    "Reward the dog immediately when they reach you — treat delivered at your feet or hand.",
    "Run 10 repetitions per session. Every recall must be rewarded; never call the dog for anything unpleasant."
  ]$so001_steps$::jsonb,
  'Dog''s body turns toward the handler and the dog takes at least one step toward the handler within 3 seconds of a single "Come" cue from 1 metre.',
  ARRAY[]::text[],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 5, 15,
  ARRAY[
    'Handler delivers a single audible "Come" cue at an identifiable timestamp.',
    'Dog''s body visibly turns toward the handler''s direction within 3 seconds of the cue.',
    'Dog takes at least one step toward the handler following the turn.',
    'Dog reaches the handler''s position or immediate proximity within the clip.'
  ],
  ARRAY[
    'Dog does not turn toward the handler within 3 seconds of the single "Come" cue.',
    'Handler repeats "Come" more than once before the dog turns.',
    'Dog turns but moves away from or parallel to the handler rather than toward them.',
    'Dog was already moving toward the handler before the cue was delivered.'
  ],
  ARRAY[
    'Dog''s initial orientation makes it ambiguous whether the subsequent movement is a recall response or continuation of prior movement.',
    'The audio track is too distorted to confirm a single "Come" cue was delivered.',
    'The clip ends before the dog reaches the handler; only the initial turn is visible.',
    'Multiple dogs are present and it is unclear which dog responded.'
  ],
  ARRAY[
    'Never call the dog to you for nail trims, baths, or scolding — this poisons the recall cue.'
  ],
  0.80, 0.90,
  'BETA', 60, 0, 3,
  $so001_vlm$You are evaluating a dog-training video for PAWS activity SO001: Recall at 1 Metre.

ACTIVITY DEFINITION
The dog must turn toward the handler and move in the handler''s direction within 3 seconds of a single audible "Come" cue. The starting distance is approximately 1 metre. The dog does not need to sit in front of the handler; forward movement is the scored behavior.

SCORABLE VIDEO GATE — evaluate before all else
1. Is at least one dog clearly visible? If not, set scorable=false, verdict=NEEDS_REVIEW.
2. Is exactly one dog identifiable as the subject? If ambiguous, set targetDogUnambiguous=false.
3. Is the handler's verbal "Come" cue audible? audioRequired=true. If audio is absent or fully inaudible, set audioAvailableWhenRequired=false, verdict=NEEDS_REVIEW.
4. Is the dog's full body visible so directional movement can be assessed? Set fullDogBodyVisibleWhenRequired accordingly.
5. Does the clip capture the moment before the cue through the dog reaching (or approaching) the handler? If not, set actionCapturedFromStartToFinish=false.

START STATE
The dog should be facing away from or at an angle to the handler — not already moving toward them. Dog is approximately 1 metre from the handler.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. A single "Come" cue is delivered at an identifiable timestamp.
2. The dog''s body visibly turns toward the handler within 3 seconds of the cue.
3. The dog takes at least one step toward the handler following the turn.
4. The dog reaches the handler or approaches within arm''s reach within the clip.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Dog does not turn toward the handler within 3 seconds of the cue.
- Handler repeats "Come" more than once before the dog responds.
- Dog turns but moves parallel or away from the handler.
- Dog was already approaching the handler before the cue.

NEEDS REVIEW CRITERIA
- The initial orientation makes the response ambiguous.
- Audio is too distorted to confirm a single cue delivery.
- The clip ends before the dog reaches the handler.
- Multiple dogs are present and response assignment is ambiguous.

FORBIDDEN INFERENCES
- Do not assess sit-front or finish position — only approach is scored.
- Do not evaluate the dog''s speed or enthusiasm.
- Do not comment on the handler''s tone or reward method.

JSON OUTPUT INSTRUCTION
In observedEvents, record: (a) timestamp of "Come" cue, (b) timestamp of first dog head/body turn, (c) timestamp of dog reaching handler. Set confidence based on clarity of cue, turn, and approach.$so001_vlm$,
  ARRAY['Dog is facing away or at an angle — not already approaching the handler.', 'Starting distance is approximately 1 metre.'],
  ARRAY['Do not assess sit-front position.', 'Do not evaluate recall speed or enthusiasm.', 'Do not comment on reward method.'],
  $so001_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":false,"hipsRequired":false,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":false,"destinationRequiredInFrame":false,"setupInstructions":["Film from the side so the dog''s initial orientation and subsequent turn toward the handler are both visible.","Ensure audio clearly captures the ''Come'' cue.","Start recording before calling so the neutral start state is captured."]}$so001_req$::jsonb
),

-- ── SO002: Recall at 3 Metres ─────────────────────────────────────────────────
(
  'SO002', 'SAFETY_AND_OBEDIENCE', 2, 1,
  'Recall at 3 Metres',
  'Emergency Recall',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog turns and comes directly to the handler within 5 seconds of a single "Come" cue from 3 metres.',
  'Doubling the recall distance from 1 to 3 metres is the first real test of the conditioned response. At 3 metres, distractions are more present and the dog has a choice — stay where they are or come to you. A reliable 3-metre recall in a controlled indoor setting is the prerequisite for outdoor distance recalls.',
  $so002_steps$[
    "Practice SO001 until recall is reliable before adding distance.",
    "Stand 3 metres from your dog. Let them settle before calling.",
    "Say ''Come'' once in a clear, upbeat tone and back up slightly as the dog moves.",
    "Reward immediately and enthusiastically when the dog reaches you.",
    "Vary the starting position — corner of the room, behind a chair — so the dog recalls regardless of where you are."
  ]$so002_steps$::jsonb,
  'Dog turns toward the handler and arrives at the handler''s position within 5 seconds of a single "Come" cue from approximately 3 metres.',
  ARRAY['SO001'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 6, 18,
  ARRAY[
    'A single "Come" cue is clearly audible at an identifiable timestamp.',
    'Dog''s body turns toward the handler within 5 seconds of the cue.',
    'Dog moves directly (or nearly directly) toward the handler without detours longer than 1 second.',
    'Dog arrives within arm''s reach of the handler within the clip.'
  ],
  ARRAY[
    'Dog does not turn toward the handler within 5 seconds of the cue.',
    'Handler repeats "Come" more than once before the dog turns.',
    'Dog turns but detours or stops for more than 2 seconds before resuming approach.',
    'Dog was already approaching the handler before the cue.'
  ],
  ARRAY[
    'Dog begins to turn but the clip ends before the full approach is visible.',
    'The dog takes a curved path; it is ambiguous whether the path constitutes a meaningful detour.',
    'The audio is unclear and it is uncertain whether a single cue was delivered.',
    'The 3-metre distance is significantly shorter or longer than described.'
  ],
  ARRAY['Avoid calling the dog when they are engaged in play — set up success by calling during calm moments at first.'],
  0.80, 0.90,
  'BETA', 65, 0, 3,
  $so002_vlm$You are evaluating a dog-training video for PAWS activity SO002: Recall at 3 Metres.

ACTIVITY DEFINITION
The dog must turn toward the handler and travel directly to the handler''s position within 5 seconds of a single "Come" cue from approximately 3 metres. The path should be direct; brief curves are acceptable but deliberate stops or detours over 2 seconds constitute a failure.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous check.
3. Audio: "Come" cue must be audible. audioAvailableWhenRequired=true.
4. Full dog body visible? fullDogBodyVisibleWhenRequired.
5. Clip captures cue through dog reaching handler? actionCapturedFromStartToFinish.

START STATE
Dog is at approximately 3 metres from the handler. Dog is not actively approaching before the cue.

PASS CRITERIA — all must be satisfied
1. Single audible "Come" cue at identifiable timestamp.
2. Dog''s body turns toward handler within 5 seconds.
3. Dog moves toward handler without detour exceeding 2 seconds.
4. Dog arrives within arm''s reach of handler within the clip.

FAIL CRITERIA — any one is sufficient
- No turn toward handler within 5 seconds.
- Handler repeats cue more than once.
- Dog stops or detours for more than 2 seconds.
- Dog was already approaching before the cue.

NEEDS REVIEW CRITERIA
- Clip ends before dog arrives.
- Detour path ambiguous in length.
- Audio distorted — single cue not confirmable.
- Distance substantially different from 3 metres.

FORBIDDEN INFERENCES
- Do not assess sit-front or finish.
- Do not evaluate speed or enthusiasm.
- Do not comment on reward method.

JSON OUTPUT: record timestamps of (a) cue, (b) turn, (c) arrival.$so002_vlm$,
  ARRAY['Dog is not actively approaching before the cue.', 'Distance is approximately 3 metres.'],
  ARRAY['Do not assess sit position on arrival.', 'Do not evaluate speed.'],
  $so002_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":false,"hipsRequired":false,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":false,"destinationRequiredInFrame":false,"setupInstructions":["Film from the side so the full 3-metre approach path is visible.","Ensure the starting position and the handler are both in frame.","Record audio clearly so the single ''Come'' cue is audible."]}$so002_req$::jsonb
),

-- ── SO003: Recall with Door Distraction ──────────────────────────────────────
(
  'SO003', 'SAFETY_AND_OBEDIENCE', 3, 2,
  'Recall Past a Door Distraction',
  'Emergency Recall',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog recalls to the handler while an interior door is open nearby, ignoring the open door and coming directly to the handler.',
  'The first real-world recall challenge: an open door. Dogs instinctively want to investigate open spaces. A dog that recalls reliably past an open interior door is on the path to a safe outdoor recall. This bridges controlled practice to real-life scenarios.',
  $so003_steps$[
    "Practice SO002 until reliable before adding distractions.",
    "Open an interior door so it forms a visible distraction in the room.",
    "Position the dog so they can see the open door but are not directly in front of it.",
    "Call ''Come'' once and reward the dog enthusiastically when they ignore the door and come to you.",
    "Repeat until 8 of 10 recalls ignore the door completely before moving to outdoor environments."
  ]$so003_steps$::jsonb,
  'Dog turns toward the handler and travels directly to them, visibly passing by or near an open interior door without entering or pausing at the door for more than 1 second.',
  ARRAY['SO002'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 6, 20,
  ARRAY[
    'A single "Come" cue is audible at an identifiable timestamp.',
    'An open interior door is visible in the frame.',
    'Dog moves toward the handler without entering the open doorway or pausing at the doorway for more than 1 second.',
    'Dog arrives at the handler''s position within the clip.'
  ],
  ARRAY[
    'Dog enters the open doorway or leaves the room through it.',
    'Dog pauses at the open doorway for more than 2 seconds before continuing the recall.',
    'No open door is visible in the frame.',
    'Handler repeats "Come" more than once.'
  ],
  ARRAY[
    'An object that may be a door is visible but is partially obscured; whether it constitutes an open doorway is ambiguous.',
    'Dog briefly glances at the door (under 1 second) and then continues recall — ambiguous pause duration.',
    'Clip ends before dog arrives at handler.'
  ],
  ARRAY['Ensure the area beyond the open door is safe in case the dog does pass through.'],
  0.78, 0.88,
  'BETA', 70, 0, 3,
  $so003_vlm$You are evaluating a dog-training video for PAWS activity SO003: Recall Past a Door Distraction.

ACTIVITY DEFINITION
The dog must respond to a single "Come" cue and travel to the handler''s position while an open interior door is visible in the environment. The dog must not enter the open doorway or pause there for more than 1 second. The distraction (open door) must be visible in the clip.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Open door visible in frame? targetObjectVisibleWhenRequired=true.
4. Audio: "Come" cue audible? audioAvailableWhenRequired=true.
5. Full dog body and approach path visible? fullDogBodyVisibleWhenRequired.
6. Clip captures cue through arrival? actionCapturedFromStartToFinish.

START STATE
Dog is at a distance from the handler. An open door is visible in the environment and the dog is aware of it (has glanced toward it or is positioned where it is visible).

PASS CRITERIA — all must be satisfied
1. Single "Come" cue audible at identifiable timestamp.
2. Open interior door visible in the frame.
3. Dog does not enter the open doorway or pause there for more than 1 second.
4. Dog arrives at handler within the clip.

FAIL CRITERIA — any one is sufficient
- Dog enters the open doorway.
- Dog pauses at the doorway for more than 2 seconds.
- No open door visible in the frame.
- Handler repeats cue more than once.

NEEDS REVIEW CRITERIA
- Doorway visibility is ambiguous (partially obscured).
- Brief glance at door; pause duration under 1 second — ambiguous.
- Clip ends before arrival.

FORBIDDEN INFERENCES
- Do not assess sit-front or finish.
- Do not evaluate the distraction difficulty level.

JSON OUTPUT: record timestamps of (a) cue, (b) dog glance at door if any, (c) arrival.$so003_vlm$,
  ARRAY['Open interior door is visible and the dog is aware of it.', 'Dog is at least 1 metre from handler.'],
  ARRAY['Do not assess sit-front.', 'Do not evaluate distraction difficulty level.'],
  $so003_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":false,"hipsRequired":false,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":true,"destinationRequiredInFrame":false,"setupInstructions":["Position the camera so the open door AND the handler are both visible in frame.","The dog''s full approach path should be captured.","Record audio to capture the single ''Come'' cue."]}$so003_req$::jsonb
),

-- ── SO004: Sit-Stay 5 Seconds ─────────────────────────────────────────────────
(
  'SO004', 'SAFETY_AND_OBEDIENCE', 4, 1,
  'Sit-Stay: 5 Seconds',
  'Stay and Impulse Control',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog holds a sit position for 5 continuous seconds after a "Stay" cue, releasing only on an audible release word.',
  'A sit-stay is the cornerstone of practical obedience. Five seconds is the first milestone where the dog must hold a position rather than simply adopt it. This foundation is used every time you need the dog to wait at a door, hold while you put on their leash, or stay calm in a crowded environment.',
  $so004_steps$[
    "Ask for a sit and immediately give a quiet ''Stay'' cue with your palm facing the dog.",
    "Count silently to 5. If the dog moves, calmly re-sit and restart with a shorter count.",
    "After 5 seconds, deliver the treat to the dog while they are still in the sit.",
    "Only release with your chosen release word (''Free'', ''Okay'', etc.) after the treat.",
    "Build to 5 consecutive successful stays before progressing to 15 seconds."
  ]$so004_steps$::jsonb,
  'Dog''s rear remains on the floor continuously for 5 seconds after a "Stay" cue, releasing only after an audible release cue.',
  ARRAY['BH006'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  2, 10, 25,
  ARRAY[
    'A "Stay" or equivalent hold cue is delivered at an identifiable timestamp.',
    'Dog''s rear remains visibly on the floor continuously for 5 seconds after the cue.',
    'Dog does not stand, lie down, or reposition during the 5-second hold.',
    'Dog releases only after an audible release cue is delivered (or reward is delivered on the mat).'
  ],
  ARRAY[
    'Dog''s rear leaves the floor before 5 continuous seconds are completed.',
    'Dog transitions into a down during the hold.',
    'Dog shuffles or repositions more than one body length during the hold.',
    'No hold cue is present and the dog is simply left in a sit without instruction.'
  ],
  ARRAY[
    'The clip is shorter than 5 seconds after the stay cue; the hold duration cannot be confirmed.',
    'Dog makes subtle weight shifts; whether the rear briefly lifted is ambiguous.',
    'The release sequence is missing from the clip; only the hold start is visible.'
  ],
  ARRAY['Do not use physical restraint to hold the dog in a stay — this builds anxiety rather than calm self-control.'],
  0.80, 0.90,
  'BETA', 65, 0, 3,
  $so004_vlm$You are evaluating a dog-training video for PAWS activity SO004: Sit-Stay 5 Seconds.

ACTIVITY DEFINITION
The dog must hold a sit position — rear on floor, front legs straight — for a continuous 5-second window after a "Stay" (or equivalent hold) cue. The dog must not stand, lie down, or reposition during the hold. The sequence is: sit established → stay cue → 5-second hold → reward on sit OR release cue.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Full dog body visible including hips? hipsVisibleWhenRequired=true.
4. Handler visible? ownerVisibleWhenRequired=true.
5. Does clip capture stay cue through end of 5-second hold? actionCapturedFromStartToFinish.

START STATE
Dog is in a sit position before the "Stay" cue is delivered.

PASS CRITERIA — all must be satisfied
1. A "Stay" or hold cue is audible or visually signaled at an identifiable timestamp.
2. Dog''s rear remains on the floor continuously for 5 seconds after the cue.
3. Dog does not stand, lie down, or reposition more than a minor weight shift during the hold.
4. Dog releases only after the reward is delivered in the sit OR after an audible release cue.

FAIL CRITERIA — any one is sufficient
- Dog''s rear leaves the floor before 5 seconds are complete.
- Dog transitions to a down.
- Dog shuffles more than one body length.

NEEDS REVIEW CRITERIA
- Clip ends before 5-second hold is confirmed.
- Minor weight shifts with ambiguous rear contact.
- Release cue not captured in clip.

FORBIDDEN INFERENCES
- Do not assess sit quality or squareness.
- Do not evaluate hold duration beyond 5 seconds.

JSON OUTPUT: record timestamps of (a) stay cue, (b) 5-second timer start, (c) 5-second timer end or any break.$so004_vlm$,
  ARRAY['Dog is in a sit before the stay cue.', 'Handler is standing or crouching nearby.'],
  ARRAY['Do not assess sit quality.', 'Do not evaluate hold beyond the 5-second target.'],
  $so004_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":true,"hipsRequired":true,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":false,"destinationRequiredInFrame":false,"setupInstructions":["Film from the side so hip contact with the floor is visible throughout.","Record at least 12 seconds to capture the full hold and reward sequence.","Ensure the stay cue (verbal or hand signal) is captured."]}$so004_req$::jsonb
),

-- ── SO005: Sit-Stay 15 Seconds ────────────────────────────────────────────────
(
  'SO005', 'SAFETY_AND_OBEDIENCE', 5, 1,
  'Sit-Stay: 15 Seconds',
  'Stay and Impulse Control',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog holds a sit-stay for 15 continuous seconds with the handler standing upright and stationary at a distance of up to 1 metre.',
  'Fifteen seconds is the first duration where the sit-stay becomes practically useful — long enough to answer the front door, leash up the dog, or wait at a curb. The handler''s stationary, upright posture (not hovering) begins training the dog to hold without constant body language prompts.',
  $so005_steps$[
    "Build from a reliable 5-second stay before increasing duration.",
    "Ask for sit, deliver stay cue, and step back 1 metre. Stand upright — do not lean toward the dog.",
    "Count silently to 15. Reward in the sit. Release with your release word.",
    "If the dog breaks before 15 seconds, re-sit and reward at 10 seconds before building back.",
    "Vary the count so the dog cannot predict exactly when the reward comes."
  ]$so005_steps$::jsonb,
  'Dog''s rear remains on the floor for 15 continuous seconds after a stay cue, with the handler standing upright at up to 1 metre distance.',
  ARRAY['SO004'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  2, 20, 35,
  ARRAY[
    'A stay cue is delivered and the dog is in a sit.',
    'Dog''s rear remains on the floor for 15 continuous seconds.',
    'Handler is visible and standing upright — not crouching or leaning toward the dog.',
    'Dog does not stand, lie down, or reposition more than minor weight shifts during the 15-second window.'
  ],
  ARRAY[
    'Dog''s rear leaves the floor before 15 seconds are completed.',
    'Dog transitions to a down position.',
    'Handler continuously hovers at close range, providing excessive body-language support.'
  ],
  ARRAY[
    'Clip ends before 15 seconds of confirmed hold are recorded.',
    'Minor weight shift with ambiguous rear contact.',
    'Handler''s position relative to the dog is unclear from the camera angle.'
  ],
  ARRAY['Start in a low-distraction room; add distractions only after the 15-second indoor stay is solid.'],
  0.80, 0.90,
  'BETA', 70, 0, 3,
  $so005_vlm$You are evaluating a dog-training video for PAWS activity SO005: Sit-Stay 15 Seconds.

ACTIVITY DEFINITION
The dog must hold a sit (rear on floor) for 15 continuous seconds after a stay cue while the handler stands upright at up to 1 metre distance. Any break in the rear-floor contact resets the timer.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Full dog body with hips visible? hipsVisibleWhenRequired=true.
4. Handler visible? ownerVisibleWhenRequired=true.
5. Does clip capture stay cue plus 15-second hold? actionCapturedFromStartToFinish.

START STATE
Dog is in a sit. Stay cue is delivered by the handler.

PASS CRITERIA
1. Stay cue delivered at identifiable timestamp.
2. Dog''s rear remains on floor continuously for 15 seconds.
3. Handler is standing upright at up to 1 metre distance.
4. No stand, down, or repositioning during the hold.

FAIL CRITERIA
- Rear leaves floor before 15 seconds.
- Dog transitions to down.
- Handler crouches continuously throughout the hold, providing unsupported body-language cueing.

NEEDS REVIEW
- Clip too short to confirm full 15-second hold.
- Ambiguous brief rear lift.
- Handler posture unclear from angle.

FORBIDDEN INFERENCES
- Do not assess sit quality.
- Do not evaluate hold beyond 15 seconds.

JSON OUTPUT: timestamps of (a) stay cue, (b) 15-second timer start, (c) timer end or break.$so005_vlm$,
  ARRAY['Dog is in a sit before the stay cue.', 'Handler steps back to approximately 1 metre.'],
  ARRAY['Do not evaluate sit quality.', 'Do not evaluate hold beyond 15 seconds.'],
  $so005_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":true,"hipsRequired":true,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":false,"destinationRequiredInFrame":false,"setupInstructions":["Film from the side so hips and handler position are simultaneously visible.","Record at least 22 seconds to capture the full 15-second hold.","Ensure the camera captures both the dog and the handler within the 1-metre frame."]}$so005_req$::jsonb
),

-- ── SO006: Sit-Stay 30 Seconds with Handler Step-Away ────────────────────────
(
  'SO006', 'SAFETY_AND_OBEDIENCE', 6, 2,
  'Sit-Stay: 30 Seconds with Handler Movement',
  'Stay and Impulse Control',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog holds a sit-stay for 30 continuous seconds while the handler takes 2–3 steps away and returns once.',
  'Adding handler movement to a stay is the moment where stays become genuinely useful. A dog that holds a stay while the handler moves can wait at the front door while groceries are brought in, wait in the car while the handler steps out, or hold while the handler moves away in a public space.',
  $so006_steps$[
    "Build from a reliable 15-second stationary stay before adding movement.",
    "Give the stay cue, then step 2–3 paces away. Return to the dog before releasing.",
    "Take a small step away, pause 3 seconds, return. Gradually build to 2–3 paces away for 30 seconds total.",
    "Return to the dog and reward in the sit before releasing.",
    "Never call the dog out of a stay — always return to them to release."
  ]$so006_steps$::jsonb,
  'Dog''s rear remains on the floor for 30 continuous seconds while the handler takes at least 2 steps away and returns at least once.',
  ARRAY['SO005'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  2, 35, 60,
  ARRAY[
    'A stay cue is delivered at an identifiable timestamp.',
    'Dog''s rear remains on the floor continuously for 30 seconds.',
    'Handler takes at least 2 visible steps away from the dog during the hold period.',
    'Handler returns to the dog''s side before the clip ends.',
    'Dog does not stand, lie down, or follow the handler during the 30-second hold.'
  ],
  ARRAY[
    'Dog''s rear leaves the floor before 30 seconds are completed.',
    'Dog follows the handler when the handler steps away.',
    'Handler does not step away from the dog at any point during the hold.',
    'Dog transitions to a down position.'
  ],
  ARRAY[
    'Clip ends before 30 seconds of confirmed hold are recorded.',
    'Handler''s movement is minimal (less than 1 step); whether the movement constitutes a ''step away'' is ambiguous.',
    'Ambiguous brief rear lift during handler movement.'
  ],
  ARRAY['Do not use this drill in environments where the dog may panic at being ''left'' — build confidence in familiar indoor spaces first.'],
  0.80, 0.90,
  'BETA', 80, 0, 3,
  $so006_vlm$You are evaluating a dog-training video for PAWS activity SO006: Sit-Stay 30 Seconds with Handler Movement.

ACTIVITY DEFINITION
The dog must hold a sit (rear on floor) for 30 continuous seconds while the handler takes at least 2 visible steps away from the dog during the hold and returns at least once. Any break in rear-floor contact resets the timer.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Full dog body with hips visible? hipsVisibleWhenRequired=true.
4. Is handler movement visible in frame? ownerVisibleWhenRequired=true.
5. Does clip capture stay cue through 30-second hold? actionCapturedFromStartToFinish.

START STATE
Dog is in a sit. Stay cue delivered. Handler steps away.

PASS CRITERIA
1. Stay cue at identifiable timestamp.
2. Dog''s rear on floor for 30 continuous seconds.
3. Handler takes at least 2 visible steps away during the hold.
4. Dog does not follow the handler.
5. Handler returns to dog during or at end of the hold.

FAIL CRITERIA
- Rear leaves floor before 30 seconds.
- Dog follows the handler when handler steps away.
- Handler never steps away.
- Dog transitions to down.

NEEDS REVIEW
- Clip too short for 30-second confirmation.
- Handler movement ambiguous (less than 1 step).
- Brief rear lift during handler movement.

FORBIDDEN INFERENCES
- Do not evaluate distance of handler movement beyond confirming at least 2 steps.
- Do not assess sit quality.

JSON OUTPUT: timestamps of (a) stay cue, (b) handler first step away, (c) 30-second timer start, (d) timer end or break.$so006_vlm$,
  ARRAY['Dog is in a sit before the stay cue.', 'Handler steps away during the hold.'],
  ARRAY['Do not evaluate distance of handler movement precisely.', 'Do not assess sit quality.'],
  $so006_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":true,"hipsRequired":true,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":false,"destinationRequiredInFrame":false,"setupInstructions":["Film from a position where both the dog and the handler''s step-away path are visible.","Record at least 38 seconds to capture the full 30-second hold.","Ensure hips are visible throughout."]}$so006_req$::jsonb
),

-- ── SO007: Down-Stay 5 Seconds ────────────────────────────────────────────────
(
  'SO007', 'SAFETY_AND_OBEDIENCE', 7, 1,
  'Down-Stay: 5 Seconds',
  'Stay and Impulse Control',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog holds a down position (elbows and hips on the floor) for 5 continuous seconds after a "Down" and "Stay" cue.',
  'A down-stay is harder than a sit-stay because the position requires more body commitment. A dog that can hold a down-stay can be calm and out of the way for extended periods — during meals, at a café, or in a waiting room.',
  $so007_steps$[
    "Ask for a down (BH004). When the dog is settled, add the ''Stay'' cue.",
    "Hold the stay for 5 seconds. Reward in the down before releasing.",
    "Release with your release word — never call the dog out of a down-stay.",
    "Repeat 10 times per session before increasing duration.",
    "If the dog sits up during the hold, re-down and shorten the hold to 3 seconds before building back."
  ]$so007_steps$::jsonb,
  'Dog''s elbows and hip bones remain on the floor continuously for 5 seconds after a down and stay cue.',
  ARRAY['SO004', 'BH004'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  2, 10, 25,
  ARRAY[
    'Dog is in a down position — elbows and hips on the floor — before and throughout the hold.',
    'A stay cue is delivered at an identifiable timestamp.',
    'Dog''s elbows and hips remain on the floor continuously for 5 seconds.',
    'Dog does not sit up, stand, or reposition during the 5-second hold.'
  ],
  ARRAY[
    'Dog sits up (elbows leave the floor) before 5 seconds are complete.',
    'Dog stands before 5 seconds are complete.',
    'Dog rolls over or significantly repositions during the hold.',
    'Dog was never in a down position — only a sit is visible.'
  ],
  ARRAY[
    'Clip ends before 5-second hold is confirmed.',
    'Dog makes subtle weight shifts; whether elbows briefly lifted is ambiguous.',
    'Camera angle from behind makes elbow and hip floor contact ambiguous.'
  ],
  ARRAY['Avoid forcing the dog into the down for this drill — physical manipulation builds resentment. Use a lure if needed.'],
  0.80, 0.90,
  'BETA', 65, 0, 3,
  $so007_vlm$You are evaluating a dog-training video for PAWS activity SO007: Down-Stay 5 Seconds.

ACTIVITY DEFINITION
The dog must hold a down position — both elbows AND hip bones on the floor — for 5 continuous seconds after a "Down" + "Stay" cue combination. Any position change that lifts elbows or hips resets the timer.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Full dog body with elbows and hips visible? fullDogBodyVisibleWhenRequired=true, hipsVisibleWhenRequired=true, pawsVisibleWhenRequired=true.
4. Handler visible? ownerVisibleWhenRequired=true.
5. Clip captures stay cue through 5-second hold? actionCapturedFromStartToFinish.

START STATE
Dog is in a down position (elbows and hips on the floor) before the stay cue.

PASS CRITERIA
1. Stay cue audible or visually delivered at identifiable timestamp.
2. Dog''s elbows and hips remain on the floor for 5 continuous seconds.
3. Dog does not sit up, stand, or significantly reposition.

FAIL CRITERIA
- Elbows leave the floor (sit up) before 5 seconds.
- Dog stands.
- Dog rolls significantly or repositions more than one body length.
- Dog was never in a down.

NEEDS REVIEW
- Clip too short for 5-second confirmation.
- Ambiguous brief elbow lift.
- Camera angle obscures elbow or hip contact.

FORBIDDEN INFERENCES
- Do not differentiate sphinx vs lateral down.
- Do not assess hold beyond 5 seconds.

JSON OUTPUT: timestamps of (a) stay cue, (b) timer start, (c) timer end or break.$so007_vlm$,
  ARRAY['Dog is in a down (elbows and hips on floor) before the stay cue.', 'Handler is beside the dog.'],
  ARRAY['Do not differentiate sphinx vs lateral down.', 'Do not evaluate hold beyond 5 seconds.'],
  $so007_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":true,"hipsRequired":true,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":false,"destinationRequiredInFrame":false,"setupInstructions":["Film from the side so elbows, chest, and hips are simultaneously visible.","Record at least 12 seconds to capture the stay cue and full hold.","Good lighting to see the elbows and hips clearly."]}$so007_req$::jsonb
),

-- ── SO008: Wait at Threshold (Doorway) ───────────────────────────────────────
(
  'SO008', 'SAFETY_AND_OBEDIENCE', 8, 1,
  'Wait at Threshold',
  'Door Manners and Impulse Control',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog holds a sit or stand behind a doorway threshold while the handler opens the door, waits 3 seconds with the door open, then releases the dog to cross.',
  'A dog that waits at a doorway without being invited through is a safe dog. Bolting out the front door is a leading cause of dog deaths from traffic. This behavior also removes the dangerous door-rushing behavior that causes falls in elderly owners.',
  $so008_steps$[
    "Stand at an interior door with your dog behind you in a sit or stand.",
    "Give the ''Wait'' cue with your palm facing the dog. Open the door slowly.",
    "If the dog starts to cross, calmly block with your body and close the door. Reset.",
    "Hold the door open for 3 seconds — dog must remain behind the threshold.",
    "Release with ''Free'' and step through together. Repeat until 8 of 10 attempts succeed."
  ]$so008_steps$::jsonb,
  'Dog remains behind the door threshold (does not cross) while the door is open for 3 continuous seconds, then crosses only after an audible release cue.',
  ARRAY['BH006'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 8, 25,
  ARRAY[
    'Handler delivers a "Wait" or hold cue before opening the door.',
    'The door opens to reveal the threshold line on the floor.',
    'Dog does not cross the threshold while the door is open during the 3-second hold.',
    'Dog crosses the threshold only after an audible release cue is delivered.'
  ],
  ARRAY[
    'Dog crosses the threshold before the release cue is delivered.',
    'Handler delivers the release cue before 3 seconds have elapsed with the door open.',
    'Dog pushes past the handler through the doorway before the door is fully open.',
    'No clear threshold is visible in the frame.'
  ],
  ARRAY[
    'The threshold line is not clearly visible in the frame.',
    'Dog''s paws are at the threshold edge; it is ambiguous whether they have crossed.',
    'The clip ends before the full 3-second hold with the door open is captured.',
    'The release cue is inaudible or missing from the clip.'
  ],
  ARRAY['Supervise all doorway training near front doors with traffic risk.'],
  0.78, 0.88,
  'BETA', 70, 0, 3,
  $so008_vlm$You are evaluating a dog-training video for PAWS activity SO008: Wait at Threshold.

ACTIVITY DEFINITION
The dog must hold behind a door threshold — not crossing the floor line at the base of the open door — for 3 continuous seconds while the door is open. The dog must release and cross only after an audible release cue.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Is the doorway threshold visible in frame? targetObjectVisibleWhenRequired=true.
4. Handler visible? ownerVisibleWhenRequired=true.
5. Does clip capture wait cue, open door (3-second hold), and release? actionCapturedFromStartToFinish.

START STATE
Dog is behind the closed door. Handler gives wait cue and opens the door.

PASS CRITERIA
1. "Wait" cue delivered before the door opens.
2. Door opens revealing the threshold.
3. Dog remains behind the threshold for at least 3 continuous seconds with the door open.
4. Dog crosses only after an audible release cue.

FAIL CRITERIA
- Dog crosses threshold before the release cue.
- Release cue delivered before 3 seconds with door open.
- Dog pushes past the handler before door is open.
- No threshold visible in frame.

NEEDS REVIEW
- Threshold line ambiguous in frame.
- Dog''s paws at the edge — crossing ambiguous.
- Clip ends before 3-second confirmation.
- Release cue inaudible.

FORBIDDEN INFERENCES
- Do not assess body position at the threshold (sit, stand, or down are all acceptable).
- Do not evaluate what happens after the dog crosses.

JSON OUTPUT: timestamps of (a) wait cue, (b) door open, (c) 3-second hold end or crossing event, (d) release cue.$so008_vlm$,
  ARRAY['Dog is behind the closed door before the wait cue.', 'Threshold must be visible in frame.'],
  ARRAY['Do not assess body position at threshold.', 'Do not evaluate post-crossing behavior.'],
  $so008_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":true,"hipsRequired":false,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":true,"destinationRequiredInFrame":true,"setupInstructions":["Position camera to show the threshold line at the base of the door and the dog''s full body.","Include the handler so the release cue delivery is visible.","Capture the full sequence from wait cue through the dog crossing after release."]}$so008_req$::jsonb
),

-- ── SO009: Loose-Leash Walking 5 Steps ───────────────────────────────────────
(
  'SO009', 'SAFETY_AND_OBEDIENCE', 9, 1,
  'Loose-Leash Walking: 5 Steps',
  'Leash Manners',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog walks 5 consecutive steps beside the handler with the leash visibly loose (J-shape) — no tension on the leash for the full 5 steps.',
  'Loose-leash walking is one of the most requested behaviors by dog owners. Pulling on leash causes joint damage, makes walks miserable, and is dangerous for elderly or small-framed owners. Five steps of loose leash is the measurable foundation of every enjoyable walk.',
  $so009_steps$[
    "Start with your dog at your left or right side. Leash is attached and has a visible J-shape (no tension).",
    "Take one step forward. If the dog stays beside you, reward immediately.",
    "Build to 3 steps, then 5. Reward at the 5-step mark.",
    "If the dog pulls, stop walking immediately. Wait for the leash to go slack, then resume.",
    "Use high-value treats and reward frequently — every 5 steps at first, extending as the dog succeeds."
  ]$so009_steps$::jsonb,
  'Leash maintains a visible J-shape (no tension) for 5 consecutive steps while the dog walks beside the handler.',
  ARRAY['BH002'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 8, 20,
  ARRAY[
    'The leash is visible in the frame and shows a J-shape (visible slack) at the start of the 5-step sequence.',
    'Dog walks at the handler''s side for 5 consecutive steps without the leash becoming taut.',
    'The leash does not become straight or taut at any point during the 5-step sequence.',
    'Dog is beside the handler — not in front pulling or significantly behind.'
  ],
  ARRAY[
    'The leash becomes visibly taut or straight at any point during the 5-step sequence.',
    'Dog is in front of the handler with the leash angled forward rather than hanging loose.',
    'The 5-step sequence is not completed — the dog pulls before 5 steps are taken.',
    'No leash is visible in the frame.'
  ],
  ARRAY[
    'The leash is partially out of frame; whether it becomes taut cannot be confirmed.',
    'The camera angle is from behind, making leash tension ambiguous.',
    'Dog walks beside the handler but the leash is not clearly visible throughout.',
    'Fewer than 5 steps are captured before the clip ends.'
  ],
  ARRAY['Do not jerk the leash to correct pulling — stop walking and wait for the dog to release the tension voluntarily.'],
  0.80, 0.90,
  'BETA', 65, 0, 3,
  $so009_vlm$You are evaluating a dog-training video for PAWS activity SO009: Loose-Leash Walking 5 Steps.

ACTIVITY DEFINITION
The leash must show a visible J-shape (slack, not taut) for 5 consecutive steps while the dog walks beside the handler. A taut leash at any point during the 5-step sequence fails the criteria. The leash must be visible in the frame.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Is the leash visible in frame? targetObjectVisibleWhenRequired=true.
4. Handler visible? ownerVisibleWhenRequired=true.
5. Full dog body visible? fullDogBodyVisibleWhenRequired=true.
6. Does clip capture at least 5 consecutive steps? actionCapturedFromStartToFinish.

START STATE
Dog is beside the handler. Leash is attached. Leash shows a J-shape before the 5-step sequence begins.

PASS CRITERIA
1. Leash visible with J-shape at start of sequence.
2. Dog walks beside the handler for 5 consecutive steps.
3. Leash remains slack (J-shape) for all 5 steps — never becomes straight or taut.
4. Dog is beside the handler, not in front pulling.

FAIL CRITERIA
- Leash becomes visibly taut or straight during the 5-step sequence.
- Dog is in front of handler pulling.
- 5-step sequence not completed before leash goes taut.
- No leash visible in frame.

NEEDS REVIEW
- Leash partially out of frame; tautness not confirmable.
- Camera from behind; leash tension ambiguous.
- Leash not clearly visible throughout.
- Fewer than 5 steps captured.

FORBIDDEN INFERENCES
- Do not evaluate heel position precision.
- Do not assess the dog''s attention or engagement.

JSON OUTPUT: record timestamps of (a) 5-step sequence start, (b) any taut-leash event during steps, (c) 5-step sequence end.$so009_vlm$,
  ARRAY['Leash is attached and shows J-shape before sequence begins.', 'Dog is beside the handler.'],
  ARRAY['Do not evaluate heel position precision.', 'Do not assess dog attention.'],
  $so009_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":false,"hipsRequired":false,"ownerRequiredInFrame":true,"audioRequired":false,"targetObjectRequiredInFrame":true,"destinationRequiredInFrame":false,"setupInstructions":["Film from the side so both the leash and the dog''s body position beside the handler are visible.","The leash must be in frame throughout the 5-step sequence.","Ensure enough frame width to capture 5 steps of walking."]}$so009_req$::jsonb
),

-- ── SO010: Loose-Leash Walking 20 Steps ──────────────────────────────────────
(
  'SO010', 'SAFETY_AND_OBEDIENCE', 10, 2,
  'Loose-Leash Walking: 20 Steps',
  'Leash Manners',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog walks 20 consecutive steps beside the handler with the leash maintaining a visible J-shape (no tension) throughout.',
  'Twenty steps of loose-leash walking is the first real practical threshold — it''s the equivalent of crossing a parking lot, walking from one room to another, or approaching a building entrance. At this duration, the behavior starts to transfer to real-world walks.',
  $so010_steps$[
    "Build from a reliable 5-step loose leash before extending to 20.",
    "Walk in a straight line first — turns require more coordination and come later.",
    "Stop and reward every 20 steps. Don''t wait until the dog pulls to stop.",
    "If the dog pulls at step 12, stop, wait for slack, then restart the count from 1.",
    "Reward heavily and frequently — the dog is doing significant self-control work."
  ]$so010_steps$::jsonb,
  'Leash shows a visible J-shape for 20 consecutive steps without becoming taut.',
  ARRAY['SO009'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 15, 35,
  ARRAY[
    'Leash is visible and shows a J-shape at the start of the 20-step sequence.',
    'Dog walks beside the handler for 20 consecutive steps.',
    'Leash does not become straight or taut at any point during the 20-step sequence.',
    'Dog remains at the handler''s side throughout — not in front pulling.'
  ],
  ARRAY[
    'Leash becomes visibly taut or straight at any point during the 20-step sequence.',
    'Dog is in front of the handler pulling.',
    'The 20-step sequence is not completed before a pull occurs.',
    'No leash is visible.'
  ],
  ARRAY[
    'Leash partially out of frame; tautness not confirmable for the full 20 steps.',
    'Camera from behind; leash tension ambiguous.',
    'Fewer than 20 steps captured in the clip.'
  ],
  ARRAY['Outdoor 20-step loose-leash work should be practiced in a fenced area or on a long line until the behavior is reliable.'],
  0.80, 0.90,
  'BETA', 75, 0, 3,
  $so010_vlm$You are evaluating a dog-training video for PAWS activity SO010: Loose-Leash Walking 20 Steps.

ACTIVITY DEFINITION
The leash must show a visible J-shape (slack, never taut) for 20 consecutive steps while the dog walks beside the handler. A single taut-leash event during the 20-step window resets the counter and is a FAIL for this attempt. The leash must be visible throughout.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Leash visible? targetObjectVisibleWhenRequired=true.
4. Handler visible? ownerVisibleWhenRequired=true.
5. Full dog body visible? fullDogBodyVisibleWhenRequired=true.
6. 20-step sequence fully captured? actionCapturedFromStartToFinish.

START STATE
Dog beside handler. Leash attached with J-shape at sequence start.

PASS CRITERIA
1. Leash visible with J-shape at sequence start.
2. Dog beside handler for 20 consecutive steps.
3. Leash never straight or taut during the 20-step window.
4. Dog not in front of handler pulling.

FAIL CRITERIA
- Leash taut at any point in the 20-step sequence.
- Dog in front pulling.
- Sequence not completed.
- Leash not visible.

NEEDS REVIEW
- Leash out of frame for part of the sequence.
- Camera angle ambiguous for tension.
- Fewer than 20 steps captured.

FORBIDDEN INFERENCES
- Do not evaluate heel precision.
- Do not assess dog gaze direction.

JSON OUTPUT: timestamps of (a) 20-step sequence start, (b) any taut-leash event, (c) sequence end or sequence restart.$so010_vlm$,
  ARRAY['Leash shows J-shape before the 20-step sequence begins.', 'Dog is beside handler.'],
  ARRAY['Do not evaluate heel precision.', 'Do not assess gaze direction.'],
  $so010_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":false,"hipsRequired":false,"ownerRequiredInFrame":true,"audioRequired":false,"targetObjectRequiredInFrame":true,"destinationRequiredInFrame":false,"setupInstructions":["Film from the side to capture both the leash and the dog''s position beside the handler.","Ensure enough background to count 20 steps.","Leash must remain in frame throughout."]}$so010_req$::jsonb
),

-- ── SO011: Leave It (Food on Floor) ──────────────────────────────────────────
(
  'SO011', 'SAFETY_AND_OBEDIENCE', 11, 1,
  'Leave It: Food on Floor',
  'Impulse Control and Safety',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog looks away from or turns its body away from food placed on the floor within 3 seconds of a "Leave it" cue, without touching or sniffing the food item.',
  '"Leave it" is a safety behavior that can prevent a dog from eating toxic food, dead animals, or dangerous objects on the ground. A reliable leave-it response to food is the foundation for generalizing the cue to more dangerous items.',
  $so011_steps$[
    "Place a low-value treat on the floor and cover it with your foot before the dog can sniff it.",
    "When the dog looks away or backs away from your foot, mark and reward with a different treat from your hand.",
    "Graduate to leaving the treat uncovered. Say ''Leave it'' just as the dog notices the treat.",
    "Mark and reward the moment the dog turns away from the treat — even slightly.",
    "Never let the dog eat the ''leave it'' treat during practice — the behavior must always result in turning away."
  ]$so011_steps$::jsonb,
  'Dog''s head turns away from a food item on the floor within 3 seconds of a "Leave it" cue, without touching or sniffing the item.',
  ARRAY['BH002'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 5, 20,
  ARRAY[
    'A food item is visibly on the floor.',
    'A "Leave it" or equivalent cue is delivered at an identifiable timestamp.',
    'Dog''s head turns away from the food item within 3 seconds of the cue.',
    'Dog does not touch or consume the food item during the clip.'
  ],
  ARRAY[
    'Dog touches or consumes the food item on the floor.',
    'Dog''s nose makes contact with the food item after the "Leave it" cue.',
    'Dog does not turn away from the food item within 3 seconds of the cue.',
    'No food item is visible on the floor.'
  ],
  ARRAY[
    'The food item is partially out of frame; whether the dog contacts it is ambiguous.',
    'Dog''s head movement is minimal — whether it constitutes a "look away" is ambiguous.',
    'The audio cue is present but too distorted to confirm it was "Leave it."'
  ],
  ARRAY['Do not use highly tempting food for first "Leave it" practice — use low-value treats so the dog can succeed.'],
  0.80, 0.90,
  'BETA', 65, 0, 3,
  $so011_vlm$You are evaluating a dog-training video for PAWS activity SO011: Leave It (Food on Floor).

ACTIVITY DEFINITION
A food item is on the floor. The handler delivers a "Leave it" cue. The dog must turn its head or body away from the food item within 3 seconds and must not touch or consume the food item. The food item must be visible in the frame.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Food item visible on floor? targetObjectVisibleWhenRequired=true.
4. Audio: "Leave it" cue audible? audioAvailableWhenRequired=true.
5. Dog''s head and muzzle visible? fullDogBodyVisibleWhenRequired (head at minimum).
6. Clip captures cue through dog turning away? actionCapturedFromStartToFinish.

START STATE
Food item is on the floor and the dog is aware of it (has noticed it or is approaching it). Handler has not yet delivered the "Leave it" cue.

PASS CRITERIA
1. Food item visible on floor.
2. "Leave it" cue at identifiable timestamp.
3. Dog''s head turns away from food within 3 seconds.
4. Dog does not touch or consume the food item.

FAIL CRITERIA
- Dog touches or consumes food.
- Dog''s nose contacts food after the cue.
- No turn away within 3 seconds.
- No food item visible.

NEEDS REVIEW
- Food item partially out of frame; contact ambiguous.
- Head movement minimal; "look away" ambiguous.
- "Leave it" cue distorted.

FORBIDDEN INFERENCES
- Do not evaluate the dog''s sit or position after turning away.
- Do not assess reward delivery method.

JSON OUTPUT: timestamps of (a) "Leave it" cue, (b) dog turn-away event, (c) any food contact event.$so011_vlm$,
  ARRAY['Food item is on the floor and dog has noticed it.', 'Handler has not yet delivered the cue.'],
  ARRAY['Do not evaluate post-turn position.', 'Do not assess reward delivery.'],
  $so011_req${"cameraAngle":"CLOSE_HAND_AND_OBJECT","fullDogBodyRequired":false,"pawsRequired":false,"hipsRequired":false,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":true,"destinationRequiredInFrame":false,"setupInstructions":["Position camera so the food item on the floor and the dog''s muzzle and head are simultaneously visible.","The food item must be clearly visible before the cue is delivered.","Ensure audio captures the ''Leave it'' cue clearly."]}$so011_req$::jsonb
),

-- ── SO012: Drop It ────────────────────────────────────────────────────────────
(
  'SO012', 'SAFETY_AND_OBEDIENCE', 12, 1,
  'Drop It: Object in Mouth',
  'Impulse Control and Safety',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog releases an object from its mouth within 3 seconds of a "Drop it" cue, without the handler physically prying the object away.',
  '"Drop it" can save a dog''s life if they pick up something dangerous. A reliable drop-it response — built through positive trade-up rather than force — means the dog voluntarily releases even high-value items when cued.',
  $so012_steps$[
    "Let the dog hold a toy or low-value object in their mouth.",
    "Present a higher-value treat at their nose and say ''Drop it'' clearly.",
    "The instant the dog drops the object, mark and deliver the treat.",
    "Allow the dog to pick the object back up and repeat — dropping should never mean losing the game.",
    "Gradually increase the value of the held object as reliability improves."
  ]$so012_steps$::jsonb,
  'Dog releases the object from its mouth within 3 seconds of a "Drop it" cue, with the object visibly falling from the mouth or being placed on the floor.',
  ARRAY['BH002'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 5, 20,
  ARRAY[
    'Dog has an object visibly in its mouth before the cue.',
    'A "Drop it" or equivalent cue is delivered at an identifiable timestamp.',
    'The object falls from the dog''s mouth or is placed on the floor within 3 seconds of the cue.',
    'The handler does not physically pry the object from the dog''s mouth.'
  ],
  ARRAY[
    'Dog does not release the object within 3 seconds of the cue.',
    'Handler physically pries the object from the dog''s mouth.',
    'Dog had no object in its mouth before the cue.',
    'The cue is delivered but the dog swallows or runs away with the object.'
  ],
  ARRAY[
    'The object is partially in the dog''s mouth; whether it is held or just being mouthed is ambiguous.',
    'The "Drop it" cue is present but the object falls from frame before it can be confirmed as fully dropped.',
    'The audio cue is distorted and "Drop it" cannot be confirmed.'
  ],
  ARRAY['Never play tug-of-war during "Drop it" practice — wait until the cue is solid before reintroducing tug.'],
  0.80, 0.90,
  'BETA', 65, 0, 3,
  $so012_vlm$You are evaluating a dog-training video for PAWS activity SO012: Drop It.

ACTIVITY DEFINITION
The dog has an object in its mouth. The handler delivers a "Drop it" cue. The dog must release the object — drop it to the floor or open its mouth to release it — within 3 seconds. The handler must not physically pry the object away.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Object visible in dog''s mouth before cue? targetObjectVisibleWhenRequired=true.
4. Audio: "Drop it" cue audible? audioAvailableWhenRequired=true.
5. Dog''s head and muzzle visible? fullDogBodyVisibleWhenRequired (head at minimum).
6. Clip captures cue through drop event? actionCapturedFromStartToFinish.

START STATE
Dog has an object in its mouth before the cue is delivered.

PASS CRITERIA
1. Object visibly in dog''s mouth before cue.
2. "Drop it" cue at identifiable timestamp.
3. Object falls from mouth or is placed on floor within 3 seconds.
4. Handler does not physically pry the object.

FAIL CRITERIA
- Dog does not release within 3 seconds.
- Handler physically pries object out.
- Dog had no object before the cue.
- Dog runs away or swallows the object.

NEEDS REVIEW
- Object hold ambiguous — mouthing vs. gripping.
- Object falls out of frame before drop can be confirmed.
- "Drop it" cue distorted.

FORBIDDEN INFERENCES
- Do not evaluate what happens after the drop.
- Do not assess reward delivery method.

JSON OUTPUT: timestamps of (a) "Drop it" cue, (b) object release event.$so012_vlm$,
  ARRAY['Dog has object in mouth before the cue.', 'Handler has not yet delivered the cue.'],
  ARRAY['Do not evaluate post-drop behavior.', 'Do not assess reward delivery.'],
  $so012_req${"cameraAngle":"CLOSE_HAND_AND_OBJECT","fullDogBodyRequired":false,"pawsRequired":false,"hipsRequired":false,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":true,"destinationRequiredInFrame":false,"setupInstructions":["Position camera to see the object in the dog''s mouth and the drop clearly.","Ensure audio captures the ''Drop it'' cue.","The drop event must be clearly visible in frame."]}$so012_req$::jsonb
),

-- ── SO013: Hand Touch ─────────────────────────────────────────────────────────
(
  'SO013', 'SAFETY_AND_OBEDIENCE', 13, 1,
  'Hand Touch: Nose to Palm',
  'Focus and Engagement',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog moves forward and touches its nose to the handler''s open palm within 2 seconds of a "Touch" cue.',
  'The hand touch is one of the most versatile foundation behaviors: it builds focus, can be used to guide the dog through tight spaces, redirect attention, interrupt unwanted behavior, or recall the dog to hand in crowded environments. Unlike recall, the hand touch brings the dog to a precise location.',
  $so013_steps$[
    "Hold your flat palm 15 cm from the dog''s nose. The dog will naturally sniff it.",
    "The instant the dog''s nose makes contact with your palm, mark and reward.",
    "Add the "Touch" verbal cue just before presenting your palm, once the dog is reliably touching.",
    "Practice with both hands and at different heights — nose level, hip level, below the dog''s head.",
    "Build to the dog touching from 1 metre away by gradually increasing the distance."
  ]$so013_steps$::jsonb,
  'Dog''s nose makes visible contact with the handler''s open palm within 2 seconds of a "Touch" cue.',
  ARRAY['BH002'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 5, 15,
  ARRAY[
    'Handler''s open palm is clearly visible and presented at dog nose level.',
    'A "Touch" cue is delivered at an identifiable timestamp.',
    'Dog''s nose visibly makes contact with the handler''s palm within 2 seconds of the cue.',
    'Contact is initiated by the dog moving toward the palm — not the handler pressing the palm against the dog''s nose.'
  ],
  ARRAY[
    'Dog does not make nose-to-palm contact within 2 seconds of the cue.',
    'Handler moves the palm to press against the dog''s nose rather than the dog moving to touch it.',
    'Dog touches the palm with a paw rather than its nose.',
    'No palm is visible in the frame.'
  ],
  ARRAY[
    'The contact point is off-frame; whether nose or palm was used is ambiguous.',
    'The "Touch" cue is too distorted to confirm at an identifiable timestamp.',
    'The dog begins to move toward the palm but the clip ends before contact.'
  ],
  ARRAY['Keep touch sessions short — 5–8 reps maximum — to maintain enthusiasm.'],
  0.80, 0.90,
  'BETA', 55, 0, 3,
  $so013_vlm$You are evaluating a dog-training video for PAWS activity SO013: Hand Touch.

ACTIVITY DEFINITION
The handler presents an open palm. A "Touch" cue is delivered. The dog must move toward the palm and make nose-to-palm contact within 2 seconds of the cue. Contact must be dog-initiated — the handler pressing the palm against the dog''s nose does not qualify.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Handler''s open palm visible? targetObjectVisibleWhenRequired=true.
4. Audio: "Touch" cue audible? audioAvailableWhenRequired=true.
5. Dog''s muzzle and handler''s palm simultaneously visible? fullDogBodyVisibleWhenRequired (head at minimum).
6. Clip captures cue through nose-palm contact? actionCapturedFromStartToFinish.

START STATE
Handler holds open palm approximately 15 cm from dog''s nose. Dog has not yet touched the palm.

PASS CRITERIA
1. Open palm visible in frame.
2. "Touch" cue at identifiable timestamp.
3. Dog''s nose makes contact with palm within 2 seconds.
4. Contact is dog-initiated (dog moves toward palm, not palm pressed against nose).

FAIL CRITERIA
- No nose-palm contact within 2 seconds.
- Handler presses palm against dog''s nose.
- Dog touches with paw, not nose.
- No palm visible.

NEEDS REVIEW
- Contact off-frame; nose vs. paw ambiguous.
- "Touch" cue distorted.
- Dog begins to move but clip ends before contact.

FORBIDDEN INFERENCES
- Do not evaluate the dog''s sit or position before or after touching.
- Do not assess touch pressure.

JSON OUTPUT: timestamps of (a) "Touch" cue, (b) nose-palm contact event.$so013_vlm$,
  ARRAY['Handler''s open palm is presented before the cue.', 'Dog has not yet touched the palm.'],
  ARRAY['Do not evaluate position before or after touch.', 'Do not assess touch pressure.'],
  $so013_req${"cameraAngle":"CLOSE_HAND_AND_OBJECT","fullDogBodyRequired":false,"pawsRequired":false,"hipsRequired":false,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":true,"destinationRequiredInFrame":false,"setupInstructions":["Position the camera so both the open palm and the dog''s muzzle are clearly visible.","Ensure the nose-palm contact event is in frame.","Capture the ''Touch'' cue and the contact in the same clip."]}$so013_req$::jsonb
),

-- ── SO014: Watch Me / Focus ───────────────────────────────────────────────────
(
  'SO014', 'SAFETY_AND_OBEDIENCE', 14, 1,
  'Watch Me: 3-Second Eye Contact',
  'Focus and Engagement',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog maintains eye contact with the handler''s face for 3 continuous seconds after a "Watch me" or "Look" cue.',
  'Eye contact on cue is the foundation of all attentive training: a dog that looks at you reliably can be redirected from distractions, can receive visual cues, and is in a state of attentive engagement rather than environmental scanning. Three seconds of reliable eye contact is the first step toward focus in any environment.',
  $so014_steps$[
    "Hold a treat at your eye level (bridge of your nose) and say ''Watch me'' or ''Look''.",
    "The instant the dog''s eyes meet yours, mark and reward.",
    "Build to 3 seconds by counting silently before marking.",
    "Fade the lure: say the cue and wait for the dog to look up before presenting the treat.",
    "Practice in different positions — standing, sitting on the floor, crouching — so the dog learns to find your eyes."
  ]$so014_steps$::jsonb,
  'Dog''s eyes are directed at the handler''s face for 3 continuous seconds after a "Watch me" or "Look" cue.',
  ARRAY['BH002'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 8, 20,
  ARRAY[
    'A "Watch me," "Look," or equivalent focus cue is delivered at an identifiable timestamp.',
    'Dog''s gaze is directed at the handler''s face (not the hand, treat, or environment) for 3 continuous seconds.',
    'The dog''s eye direction is toward the handler''s head rather than toward the treat, lure, or environment.'
  ],
  ARRAY[
    'Dog looks at the handler''s hand holding the treat rather than the handler''s face.',
    'Dog looks away from the handler''s face for more than 1 second before the 3-second window is complete.',
    'Dog does not make eye contact with the handler''s face at any point in the clip.',
    'Handler''s face is not visible in the frame — eye contact cannot be confirmed.'
  ],
  ARRAY[
    'Dog''s gaze direction is toward the upper body but it is ambiguous whether it meets the handler''s eyes specifically.',
    'The handler''s face is partially out of frame, making eye contact confirmation ambiguous.',
    'Dog''s gaze breaks for less than 1 second; it is ambiguous whether the 3-second window was maintained.'
  ],
  ARRAY['Do not use a lure held at your nose for more than 2–3 sessions — the dog should look at your face spontaneously, not because they''re tracking a treat.'],
  0.78, 0.88,
  'BETA', 60, 0, 3,
  $so014_vlm$You are evaluating a dog-training video for PAWS activity SO014: Watch Me (3-Second Eye Contact).

ACTIVITY DEFINITION
The dog must direct its gaze toward the handler''s face (eyes or upper face region) for 3 continuous seconds after a "Watch me" or equivalent cue. Gaze directed at the handler''s hand, treat, or environment does not satisfy the criterion.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Handler''s face visible? ownerVisibleWhenRequired=true. Without the handler''s face in frame, eye contact cannot be confirmed.
4. Dog''s eyes visible? fullDogBodyVisibleWhenRequired (head at minimum).
5. Audio: focus cue audible? audioAvailableWhenRequired=true.
6. Clip captures cue through 3-second eye contact window? actionCapturedFromStartToFinish.

START STATE
Dog is in any position. Handler''s face is visible. Dog has not yet begun maintaining sustained eye contact.

PASS CRITERIA
1. "Watch me" or equivalent cue at identifiable timestamp.
2. Dog''s gaze directed at handler''s face (not hand or treat) for 3 continuous seconds.
3. Handler''s face visible in frame to confirm eye contact direction.

FAIL CRITERIA
- Dog looks at handler''s hand rather than face.
- Gaze breaks for more than 1 second before 3-second window is complete.
- Dog never makes eye contact with handler''s face.
- Handler''s face not visible.

NEEDS REVIEW
- Gaze direction toward upper body but face contact ambiguous.
- Handler''s face partially out of frame.
- Brief gaze break under 1 second; 3-second window continuity ambiguous.

FORBIDDEN INFERENCES
- Do not evaluate dog position or posture during focus.
- Do not assess handler''s lure technique.

JSON OUTPUT: timestamps of (a) focus cue, (b) start of 3-second eye contact, (c) end of 3 seconds or first gaze break.$so014_vlm$,
  ARRAY['Handler''s face is visible in frame.', 'Dog has not yet begun sustained eye contact.'],
  ARRAY['Do not evaluate dog position during focus.', 'Do not assess lure technique.'],
  $so014_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":false,"pawsRequired":false,"hipsRequired":false,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":false,"destinationRequiredInFrame":false,"setupInstructions":["Position camera so both the dog''s eyes and the handler''s face are visible simultaneously.","This is critical: without both faces in frame, eye contact cannot be confirmed.","Record audio to capture the focus cue."]}$so014_req$::jsonb
),

-- ── SO015: Emergency Stop from Walk ──────────────────────────────────────────
(
  'SO015', 'SAFETY_AND_OBEDIENCE', 15, 2,
  'Emergency Stop: Instant Sit from Walking',
  'Safety and Emergency Behaviors',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog transitions from walking beside the handler to a sit within 2 seconds of a sudden "Sit" or "Stop" cue delivered while moving.',
  'An emergency stop from walking is a safety behavior that can prevent a dog from running into traffic, reaching a dangerous animal, or approaching a child who is afraid of dogs. The behavior must be fast and on first cue — practicing it as an unexpected drill builds the reliable reflex.',
  $so015_steps$[
    "Walk your dog on leash in a loose-leash pattern.",
    "Without warning, give one clear ''Sit'' cue and stop walking simultaneously.",
    "Reward immediately when the dog sits — do not wait for a perfect square sit.",
    "Practice randomly during walks so the dog cannot predict when the sit will be cued.",
    "Build to off-leash emergency sits in a fenced yard before using on public walks."
  ]$so015_steps$::jsonb,
  'Dog transitions from walking to a sit with rear on floor within 2 seconds of a "Sit" or "Stop" cue delivered while the dog is in motion.',
  ARRAY['SO005', 'SO009'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 5, 15,
  ARRAY[
    'Dog and handler are visibly walking (both in motion) before the cue.',
    'A "Sit" or "Stop" cue is delivered at an identifiable timestamp while both are in motion.',
    'Dog''s rear contacts the floor in a sit within 2 seconds of the cue.',
    'Dog comes to a complete stop and does not continue walking after the sit is established.'
  ],
  ARRAY[
    'Dog does not sit within 2 seconds of the cue.',
    'Dog was already stationary when the cue was delivered — this is a sit cue, not an emergency stop.',
    'Handler delivers the cue when they themselves have already stopped — dog has no forward momentum.',
    'Dog sits down but then immediately stands and continues walking.'
  ],
  ARRAY[
    'Dog''s rear contacts the floor but it is ambiguous whether it occurred within 2 seconds.',
    'The cue is delivered as both begin to slow — it is unclear whether "walking" momentum existed.',
    'Audio cue is distorted; a single "Sit" cue cannot be confirmed.'
  ],
  ARRAY['Only transition to off-leash emergency stops after the on-leash version is solid in multiple environments.'],
  0.80, 0.90,
  'BETA', 75, 0, 3,
  $so015_vlm$You are evaluating a dog-training video for PAWS activity SO015: Emergency Stop from Walk.

ACTIVITY DEFINITION
The dog must be in motion (walking) when the handler delivers a "Sit" or "Stop" cue. The dog must transition from walking to a sitting position — rear on floor — within 2 seconds of the cue. A dog that is already stationary when the cue is delivered does not meet the start-state requirement.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Full dog body visible including hips? hipsVisibleWhenRequired=true.
4. Handler visible? ownerVisibleWhenRequired=true.
5. Audio: "Sit" or "Stop" cue audible? audioAvailableWhenRequired=true.
6. Clip captures the walking phase, the cue, and the sit? actionCapturedFromStartToFinish.

START STATE
Both the dog and handler are in motion — walking — before the cue. Neither has stopped yet.

PASS CRITERIA
1. Dog and handler are visibly walking before the cue.
2. Single "Sit" or "Stop" cue at identifiable timestamp while in motion.
3. Dog''s rear contacts the floor within 2 seconds of the cue.
4. Dog remains in the sit — does not continue walking after the sit.

FAIL CRITERIA
- Dog does not sit within 2 seconds.
- Dog was already stationary when the cue was delivered.
- Handler had already stopped before the cue.
- Dog sits then immediately resumes walking.

NEEDS REVIEW
- Sit timing ambiguous relative to 2-second window.
- Walking momentum unclear — both may have been slowing.
- Audio cue distorted.

FORBIDDEN INFERENCES
- Do not evaluate sit quality or squareness.
- Do not assess off-leash vs on-leash performance.

JSON OUTPUT: timestamps of (a) walking phase start, (b) "Sit"/"Stop" cue, (c) rear-contact event.$so015_vlm$,
  ARRAY['Dog and handler are walking (in motion) before the cue.', 'Cue is delivered while both are moving.'],
  ARRAY['Do not evaluate sit quality.', 'Do not assess leash vs off-leash.'],
  $so015_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":true,"hipsRequired":true,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":false,"destinationRequiredInFrame":false,"setupInstructions":["Film from the side so both the walking phase and the sit transition are visible.","Capture the cue delivery and the hip-contact moment.","Ensure enough horizontal space to show forward walking momentum."]}$so015_req$::jsonb
),

-- ── SO016: Sit-Stay During Doorbell ──────────────────────────────────────────
(
  'SO016', 'SAFETY_AND_OBEDIENCE', 16, 2,
  'Sit-Stay During Doorbell Sound',
  'Calm Responses to Household Triggers',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog maintains a sit-stay for 5 seconds after a doorbell sound plays, without breaking the stay or barking excessively.',
  'The doorbell is one of the most common over-excitement triggers for dogs. A dog that can hold a sit-stay when the doorbell rings is a dog that can be safely present during visitor arrivals. This behavior directly reduces jumping, rushing the door, and barking that makes welcoming guests stressful.',
  $so016_steps$[
    "Practice SO005 (15-second sit-stay) until solid before adding the doorbell trigger.",
    "Ask for a sit-stay. Have a helper ring the doorbell or play a doorbell sound clip.",
    "If the dog holds the stay, reward before the dog can react further.",
    "If the dog breaks, re-cue the sit-stay and try with the doorbell at lower volume.",
    "Gradually increase doorbell volume and realism as the stay becomes reliable."
  ]$so016_steps$::jsonb,
  'Dog remains in a sit for 5 seconds after an audible doorbell sound, without standing, running toward the door, or barking continuously.',
  ARRAY['SO005'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 8, 25,
  ARRAY[
    'A doorbell or knocking sound is audible at an identifiable timestamp.',
    'Dog was in a sit before the doorbell sound.',
    'Dog''s rear remains on the floor for 5 seconds after the doorbell sounds.',
    'Dog does not run toward the door or stand up in the 5 seconds after the sound.'
  ],
  ARRAY[
    'Dog stands up or runs toward the door within 5 seconds of the doorbell sound.',
    'Dog barks continuously for more than 3 seconds after the doorbell sound without returning to the sit.',
    'Dog was not in a sit before the doorbell sounded.',
    'No doorbell or knocking sound is audible in the clip.'
  ],
  ARRAY[
    'Brief vocalization (1–2 barks) followed by returning to sit — ambiguous whether this constitutes a break.',
    'Dog''s weight shifts noticeably toward the door but rear stays on floor; ambiguous.',
    'The doorbell sound is faint or distorted; it is unclear if the dog heard it.',
    'Clip ends before 5 seconds of post-doorbell sit are confirmed.'
  ],
  ARRAY['Do not practice doorbell stays if the dog has severe anxiety around visitors — work with a certified trainer first.'],
  0.78, 0.88,
  'BETA', 80, 0, 3,
  $so016_vlm$You are evaluating a dog-training video for PAWS activity SO016: Sit-Stay During Doorbell Sound.

ACTIVITY DEFINITION
The dog is in a sit-stay when an audible doorbell or knocking sound occurs. The dog must maintain the sit (rear on floor) for 5 seconds after the sound without standing up, running to the door, or barking continuously.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Audio: doorbell or knocking sound audible? audioAvailableWhenRequired=true.
4. Full dog body with hips visible? hipsVisibleWhenRequired=true.
5. Handler visible? ownerVisibleWhenRequired=true.
6. Clip captures the pre-doorbell sit, the sound, and the 5-second hold? actionCapturedFromStartToFinish.

START STATE
Dog is in a sit before the doorbell sounds. Stay cue has been delivered.

PASS CRITERIA
1. Audible doorbell or knocking sound at identifiable timestamp.
2. Dog in a sit before the sound.
3. Rear remains on floor for 5 seconds post-sound.
4. Dog does not run toward the door.
5. If the dog vocalizes, it is fewer than 3 continuous seconds before returning to calm.

FAIL CRITERIA
- Dog stands or runs toward door within 5 seconds.
- Dog barks continuously for more than 3 seconds post-sound.
- Dog was not in sit before doorbell.
- No doorbell sound audible.

NEEDS REVIEW
- Brief 1–2 bark vocalization then returns to sit; ambiguous.
- Weight shift toward door but rear stays; ambiguous break.
- Doorbell faint — dog may not have heard it.
- Clip too short to confirm 5-second post-sound hold.

FORBIDDEN INFERENCES
- Do not evaluate the dog''s emotional state during the sound.
- Do not assess the handler''s body language or proximity.

JSON OUTPUT: timestamps of (a) doorbell sound, (b) any dog movement toward door, (c) 5-second timer start, (d) timer end or sit break.$so016_vlm$,
  ARRAY['Dog is in sit-stay before the doorbell sounds.', 'Doorbell or knocking sound must be audible in clip.'],
  ARRAY['Do not evaluate emotional state.', 'Do not assess handler proximity.'],
  $so016_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":true,"hipsRequired":true,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":false,"destinationRequiredInFrame":false,"setupInstructions":["Record in the room where the doorbell sound will occur.","Ensure the doorbell sound is audible on the recording.","Film from the side so hip contact with the floor is visible throughout the 5-second hold."]}$so016_req$::jsonb
),

-- ── SO017: Settle on Leash at Public Space ────────────────────────────────────
(
  'SO017', 'SAFETY_AND_OBEDIENCE', 17, 3,
  'Settle on Leash: 30 Seconds Outdoors',
  'Real-Life Calm Behaviors',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog lies down or sits calmly on leash in an outdoor public space for 30 seconds while pedestrians or vehicles pass nearby, without pulling, barking, or lunging.',
  'A dog that can settle calmly in a public space can accompany you to cafés, outdoor markets, parks, and transit stops. This is the behavior that separates a dog that can live a full life with their owner from one that must stay home.',
  $so017_steps$[
    "Choose a low-traffic outdoor space — a quiet side street or a park bench area — for first attempts.",
    "Ask for a sit or down and hold a short leash loosely. Do not tension the leash preemptively.",
    "If a person or vehicle passes and the dog stays calm, reward immediately.",
    "If the dog reacts, step away to a greater distance and try again when the trigger passes.",
    "Build to 30 seconds of calm as distractions gradually increase in intensity over multiple sessions."
  ]$so017_steps$::jsonb,
  'Dog holds a sit or down position outdoors for 30 seconds while at least one person, vehicle, or animal passes within visible range, without barking, lunging, or significant pulling on the leash.',
  ARRAY['SO006', 'BH010'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  2, 35, 75,
  ARRAY[
    'The environment is clearly outdoors — open sky, sidewalk, road, or outdoor public space is visible.',
    'Dog is in a sit or down with leash attached for the 30-second window.',
    'At least one visible distraction (person, vehicle, or animal) passes within the dog''s visible range during the 30 seconds.',
    'Dog does not bark at, lunge toward, or sustain forward leash tension toward the distraction.',
    'Dog remains in the sit or down position for 30 continuous seconds.'
  ],
  ARRAY[
    'Dog lunges toward a passing distraction, with the leash going taut in the forward direction.',
    'Dog barks continuously for more than 3 seconds at a passing distraction.',
    'Dog stands and moves more than one body length toward a distraction during the 30 seconds.',
    'No visible distraction passes during the 30-second window — the environment appears devoid of movement.'
  ],
  ARRAY[
    'Dog exhibits brief alerting (ears forward, weight shift) but does not lunge or bark; whether this constitutes reactivity is ambiguous.',
    'Clip is too short to confirm 30 seconds of calm.',
    'The environment is indoor or it is ambiguous whether it is outdoors.',
    'The leash goes briefly taut toward a distraction but returns slack within 1 second.'
  ],
  ARRAY['Do not force a reactive dog past their threshold for this exercise — work at a distance where the dog can remain below threshold first.'],
  0.78, 0.88,
  'BETA', 90, 0, 3,
  $so017_vlm$You are evaluating a dog-training video for PAWS activity SO017: Settle on Leash Outdoors 30 Seconds.

ACTIVITY DEFINITION
The dog must hold a sit or down position on a leash in an outdoor public space for 30 continuous seconds while at least one distraction (person, vehicle, or animal) passes within visible range. The dog must not lunge, bark continuously, or stand and move toward the distraction.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Environment clearly outdoors? Set scorable accordingly.
4. Full dog body and leash visible? fullDogBodyVisibleWhenRequired=true; leash visible to assess tension.
5. Handler visible? ownerVisibleWhenRequired=true.
6. At least one distraction visible during the hold? targetObjectVisibleWhenRequired (distraction).
7. Clip captures 30-second window? actionCapturedFromStartToFinish.

START STATE
Dog is in a sit or down in an outdoor space. Leash is attached. Dog has not yet encountered a distraction.

PASS CRITERIA
1. Environment clearly outdoors.
2. Dog in sit or down for 30 continuous seconds.
3. At least one distraction (person, vehicle, or animal) passes within view.
4. Dog does not lunge (forward taut leash sustained) or bark continuously more than 3 seconds.
5. Dog does not stand and move more than one body length toward the distraction.

FAIL CRITERIA
- Dog lunges with sustained forward leash tension.
- Continuous barking for more than 3 seconds at distraction.
- Dog stands and moves more than one body length toward distraction.
- No distraction present during the 30 seconds.

NEEDS REVIEW
- Brief alert posture without lunging; reactivity level ambiguous.
- 30-second window incomplete.
- Environment indoors or ambiguous.
- Leash briefly taut then returns slack within 1 second.

FORBIDDEN INFERENCES
- Do not evaluate the dog''s alerting or ear position as a fail criterion.
- Do not assess the handler''s leash technique.

JSON OUTPUT: timestamps of (a) 30-second timer start, (b) first distraction visible, (c) any lunge or bark event, (d) timer end or break.$so017_vlm$,
  ARRAY['Environment is outdoors.', 'Dog is in sit or down with leash attached.', 'At least one distraction is present or expected.'],
  ARRAY['Do not assess alerting posture as failure.', 'Do not evaluate handler leash technique.'],
  $so017_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":false,"hipsRequired":false,"ownerRequiredInFrame":true,"audioRequired":false,"targetObjectRequiredInFrame":true,"destinationRequiredInFrame":false,"setupInstructions":["Record outdoors so the environment is clearly visible.","Position camera to capture the dog, the handler, and any passing distractions.","Record at least 38 seconds to capture the full 30-second calm window."]}$so017_req$::jsonb
),

-- ── SO018: Sit Before Door Opens (Polite Greeting Setup) ─────────────────────
(
  'SO018', 'SAFETY_AND_OBEDIENCE', 18, 2,
  'Sit Before Visitor Enters (Door Greeting Protocol)',
  'Door Manners and Impulse Control',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog holds a sit behind a door while the handler opens it to an arriving visitor, maintaining the sit until given a release cue even as the visitor enters.',
  'This is the full visitor-greeting protocol: the dog sits while the door is opened, the visitor enters, and the dog waits for a release before greeting. This eliminates jumping, door-rushing, and the chaos of excited greetings that cause falls and frightened visitors.',
  $so018_steps$[
    "Practice SO008 until the wait at threshold is solid.",
    "Add a helper visitor who arrives at the door and enters naturally.",
    "Dog must sit and hold while the visitor enters and says hello to the handler first.",
    "Only release the dog to greet the visitor after the visitor is in the room and the dog is sitting calmly.",
    "Reward both the sit hold AND the calm greeting — this teaches that patience earns the social reward."
  ]$so018_steps$::jsonb,
  'Dog maintains a sit while a handler opens the door to a visitor and the visitor enters, releasing only on a cue from the handler.',
  ARRAY['SO008', 'BH003'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 12, 35,
  ARRAY[
    'Dog is in a sit before the door opens.',
    'A second person (visitor) enters through the door during the clip.',
    'Dog maintains the sit while the visitor crosses the threshold and enters the room.',
    'Dog releases only after an audible release cue from the handler, not spontaneously when the visitor enters.'
  ],
  ARRAY[
    'Dog jumps up toward the visitor as they enter.',
    'Dog rushes through the door toward the visitor before the visitor is inside.',
    'Dog breaks the sit and runs to the visitor before a release cue is given.',
    'No visitor enters during the clip — only the handler is present.'
  ],
  ARRAY[
    'Dog rises briefly as the visitor enters but returns to sit before the release cue.',
    'Release cue inaudible or not captured in clip.',
    'Dog''s sit break is ambiguous — may be a weight shift rather than a full stand.',
    'Visitor enters but stays very close to the door; whether the dog''s threshold was crossed is ambiguous.'
  ],
  ARRAY['Ask visitors not to make direct eye contact with the dog during the greeting setup — this reduces excitement and lunging.'],
  0.78, 0.88,
  'BETA', 85, 0, 3,
  $so018_vlm$You are evaluating a dog-training video for PAWS activity SO018: Sit Before Visitor Enters.

ACTIVITY DEFINITION
The dog is in a sit behind the door. The handler opens the door and a visitor enters. The dog must maintain the sit while the visitor crosses the threshold and enters the room, releasing only after a handler-delivered release cue.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Handler visible? ownerVisibleWhenRequired=true.
4. Does a visitor enter through the door during the clip? targetObjectVisibleWhenRequired (visitor).
5. Full dog body and hips visible? hipsVisibleWhenRequired=true.
6. Does clip capture pre-door sit through visitor entry and release? actionCapturedFromStartToFinish.

START STATE
Dog is in a sit before the door opens. A visitor is about to arrive.

PASS CRITERIA
1. Dog is in sit before door opens.
2. A visitor enters through the door during the clip.
3. Dog maintains sit while visitor crosses threshold and enters room.
4. Dog releases only after an audible release cue from handler.

FAIL CRITERIA
- Dog jumps toward visitor as they enter.
- Dog rushes through the door before visitor is inside.
- Dog breaks sit and goes to visitor before release cue.
- No visitor enters during the clip.

NEEDS REVIEW
- Dog briefly rises then returns to sit before release.
- Release cue inaudible.
- Sit break vs. weight shift ambiguous.
- Visitor stays near door; entry threshold ambiguous.

FORBIDDEN INFERENCES
- Do not evaluate the greeting behavior after the release cue.
- Do not assess visitor behavior.

JSON OUTPUT: timestamps of (a) door opens, (b) visitor crosses threshold, (c) any sit break, (d) release cue.$so018_vlm$,
  ARRAY['Dog is in sit before the door opens.', 'A visitor is present and will enter during the clip.'],
  ARRAY['Do not evaluate post-release greeting.', 'Do not assess visitor behavior.'],
  $so018_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":true,"hipsRequired":true,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":true,"destinationRequiredInFrame":false,"setupInstructions":["Position camera to show the dog, the door, and the visitor entering.","The dog''s hips and the door threshold must both be visible simultaneously.","Ensure the release cue is audible in the recording."]}$so018_req$::jsonb
),

-- ── SO019: Down-Stay with Food on Floor ──────────────────────────────────────
(
  'SO019', 'SAFETY_AND_OBEDIENCE', 19, 2,
  'Down-Stay with Food Distraction',
  'Impulse Control and Safety',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog holds a down-stay for 10 seconds while food is visible on the floor within 1 metre, without breaking to investigate the food.',
  'This drill is one of the hardest impulse-control tests: the dog must stay in a down while food sits on the floor nearby. This builds the same neural pathway that''s activated when the dog passes dropped food on a walk — learning that holding position earns more than bolting toward food does.',
  $so019_steps$[
    "Practice SO007 (5-second down-stay) until it is solid before adding food distraction.",
    "Ask for a down. Place a low-value treat on the floor 1 metre away.",
    "Immediately say ''Stay.'' If the dog holds, reward with a different treat from your hand after 10 seconds.",
    "If the dog breaks toward the food, calmly block and re-down. Do not scold.",
    "Gradually move the food closer as reliability improves, and increase the food value incrementally."
  ]$so019_steps$::jsonb,
  'Dog holds a down-stay for 10 seconds while a food item is visibly on the floor within approximately 1 metre, without breaking the stay to approach the food.',
  ARRAY['SO007', 'SO011'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  2, 15, 30,
  ARRAY[
    'A food item is visibly on the floor within approximately 1 metre of the dog.',
    'Dog is in a down (elbows and hips on floor) before the stay cue.',
    'A stay cue is delivered at an identifiable timestamp.',
    'Dog''s elbows and hips remain on the floor for 10 continuous seconds.',
    'Dog does not break the down-stay to approach or consume the food item.'
  ],
  ARRAY[
    'Dog breaks the down-stay and approaches or consumes the food item before 10 seconds.',
    'Dog stands and moves toward the food item.',
    'No food item is visible on the floor during the hold.',
    'Dog was never in a down position.'
  ],
  ARRAY[
    'Food item is partially out of frame or unclear.',
    'Dog stretches head toward the food without fully breaking the down; break ambiguous.',
    'Clip too short for 10-second confirmation.',
    'Dog''s eyes and attention are on the food but body remains in down; ambiguous anxiety vs. calm hold.'
  ],
  ARRAY['If the dog is highly food-motivated, start with the lowest-value food possible (a piece of kibble) so the stay is achievable.'],
  0.80, 0.90,
  'BETA', 80, 0, 3,
  $so019_vlm$You are evaluating a dog-training video for PAWS activity SO019: Down-Stay with Food Distraction.

ACTIVITY DEFINITION
A food item is on the floor within approximately 1 metre of the dog. The dog must maintain a down position (elbows and hips on floor) for 10 continuous seconds after a stay cue, without approaching or consuming the food.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Food item visible on floor within approx 1 metre? targetObjectVisibleWhenRequired=true.
4. Full dog body with elbows and hips visible? hipsVisibleWhenRequired=true, pawsVisibleWhenRequired=true.
5. Handler visible? ownerVisibleWhenRequired=true.
6. Clip captures stay cue through 10-second hold? actionCapturedFromStartToFinish.

START STATE
Food item is on the floor. Dog is in a down. Stay cue is about to be delivered.

PASS CRITERIA
1. Food item visible within approx 1 metre.
2. Dog in down (elbows and hips on floor) before stay cue.
3. Stay cue at identifiable timestamp.
4. Down held for 10 continuous seconds without approaching food.

FAIL CRITERIA
- Dog breaks down-stay and approaches or consumes food.
- Dog stands and moves toward food.
- No food visible.
- Dog never in a down.

NEEDS REVIEW
- Food out of frame or unclear.
- Head stretch toward food without full break; ambiguous.
- Clip too short.
- Attention on food but body in down; ambiguous hold quality.

FORBIDDEN INFERENCES
- Do not evaluate the dog''s emotional state or food fixation.
- Do not assess the reward delivered after the hold.

JSON OUTPUT: timestamps of (a) stay cue, (b) 10-second timer start, (c) timer end or break event.$so019_vlm$,
  ARRAY['Food item is visible on floor within 1 metre.', 'Dog is in down before the stay cue.'],
  ARRAY['Do not evaluate emotional state.', 'Do not assess the reward method.'],
  $so019_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":true,"hipsRequired":true,"ownerRequiredInFrame":true,"audioRequired":true,"targetObjectRequiredInFrame":true,"destinationRequiredInFrame":false,"setupInstructions":["Position camera to see the food item on the floor and the dog''s full body simultaneously.","Elbows and hips must be visible throughout.","Record at least 18 seconds to capture the full 10-second hold."]}$so019_req$::jsonb
),

-- ── SO020: Leash Walk with a Turn ─────────────────────────────────────────────
(
  'SO020', 'SAFETY_AND_OBEDIENCE', 20, 2,
  'Loose-Leash Walk with a 90-Degree Turn',
  'Leash Manners',
  'AI_VERIFIED_MAIN_QUEST',
  'Dog walks on a loose leash for 10 steps, maintains the loose leash through a 90-degree turn, and continues for 5 more steps after the turn — all without leash tension.',
  'Turns are the hardest part of loose-leash walking: the dog must adjust their body position relative to the handler rather than simply walking in a straight line. A dog that can maintain loose leash through turns can navigate sidewalks, parking lots, and real-life walks without pulling.',
  $so020_steps$[
    "Practice SO010 (20-step straight line) until solid before adding turns.",
    "Walk 10 steps, then turn 90 degrees. Walk 5 more steps. The leash must stay loose through the turn.",
    "If the dog lags or forges during the turn, lure them around the turn with a treat for the first few sessions.",
    "Practice both left and right turns — the dog must adjust equally well to either direction.",
    "Reward at the end of the 5-step post-turn section, not during the turn."
  ]$so020_steps$::jsonb,
  'Leash maintains a visible J-shape (no tension) for 10 steps before a 90-degree turn and for 5 steps after the turn, with no taut leash at any point.',
  ARRAY['SO010'],
  NULL, NULL,
  ARRAY['DOG_PROFILE']::reference_asset_type[],
  3, 15, 35,
  ARRAY[
    'Leash is visible and shows a J-shape before and throughout the 10 pre-turn steps.',
    'Handler makes a visible 90-degree turn.',
    'Dog follows through the turn with the leash maintaining a J-shape.',
    'Leash shows a J-shape during at least 5 steps after the turn.',
    'Leash does not become straight or taut at any point during the 10+turn+5 sequence.'
  ],
  ARRAY[
    'Leash becomes taut before the turn, during the turn, or after the turn.',
    'Dog does not follow the handler through the turn — dog continues straight while handler turns.',
    'Handler does not complete a visible 90-degree turn.',
    'No leash is visible in the frame.'
  ],
  ARRAY[
    'Leash goes briefly taut during the turn (within 0.5 seconds) then returns slack; ambiguous.',
    'Turn angle is shallow (less than 60 degrees); whether it qualifies as a 90-degree turn is ambiguous.',
    'Leash partially out of frame during the turn; tension not confirmable.',
    'Clip ends before 5 post-turn steps are captured.'
  ],
  ARRAY['Introduce turn direction (left vs. right) separately before combining them in practice walks.'],
  0.80, 0.90,
  'BETA', 80, 0, 3,
  $so020_vlm$You are evaluating a dog-training video for PAWS activity SO020: Loose-Leash Walk with a 90-Degree Turn.

ACTIVITY DEFINITION
The handler and dog walk with the leash showing a J-shape (slack) for 10 steps, then the handler makes a visible 90-degree turn, and the dog follows with the leash remaining slack for 5 more steps. Leash tension at any point during the sequence is a FAIL.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Leash visible? targetObjectVisibleWhenRequired=true.
4. Handler visible? ownerVisibleWhenRequired=true.
5. Full dog body visible? fullDogBodyVisibleWhenRequired=true.
6. Clip captures 10 pre-turn steps, the turn, and 5 post-turn steps? actionCapturedFromStartToFinish.

START STATE
Dog and handler walking with J-shape leash. About to begin the 10-step pre-turn sequence.

PASS CRITERIA
1. Leash shows J-shape for 10 pre-turn steps.
2. Handler makes visible approx 90-degree turn.
3. Dog follows through the turn with leash remaining slack.
4. Leash shows J-shape for 5 post-turn steps.
5. Leash never straight or taut throughout.

FAIL CRITERIA
- Leash taut at any point in the sequence.
- Dog doesn''t follow handler through turn.
- No visible turn by handler.
- Leash not visible.

NEEDS REVIEW
- Brief taut event during turn (under 0.5s) then slack returns.
- Turn angle shallow — 90 degrees ambiguous.
- Leash out of frame during turn.
- Fewer than 5 post-turn steps captured.

FORBIDDEN INFERENCES
- Do not evaluate heel position precision.
- Do not assess the dog''s attention during the turn.

JSON OUTPUT: timestamps of (a) 10-step sequence start, (b) turn initiation, (c) turn completion, (d) any taut-leash event, (e) 5-step post-turn end.$so020_vlm$,
  ARRAY['Dog and handler are walking with J-shape leash.', 'About to begin 10-step pre-turn sequence.'],
  ARRAY['Do not evaluate heel precision.', 'Do not assess attention during turn.'],
  $so020_req${"cameraAngle":"SIDE_FULL_BODY","fullDogBodyRequired":true,"pawsRequired":false,"hipsRequired":false,"ownerRequiredInFrame":true,"audioRequired":false,"targetObjectRequiredInFrame":true,"destinationRequiredInFrame":false,"setupInstructions":["Film from a position where the turn direction is clearly visible.","Leash must be in frame throughout the pre-turn walk, the turn, and the post-turn walk.","Ensure enough background space to capture both the 10-step approach and the 5-step exit."]}$so020_req$::jsonb
)

ON CONFLICT (id) DO NOTHING;

-- ─── Wire regression / harder FK references ───────────────────────────────────

UPDATE training_catalog_activities SET harder_activity_id    = 'SO002' WHERE id = 'SO001';

UPDATE training_catalog_activities SET regression_activity_id = 'SO001',
                                        harder_activity_id    = 'SO003' WHERE id = 'SO002';

UPDATE training_catalog_activities SET regression_activity_id = 'SO002',
                                        harder_activity_id    = 'SO004' WHERE id = 'SO003';

UPDATE training_catalog_activities SET harder_activity_id    = 'SO005' WHERE id = 'SO004';
UPDATE training_catalog_activities SET regression_activity_id = 'SO004',
                                        harder_activity_id    = 'SO006' WHERE id = 'SO005';
UPDATE training_catalog_activities SET regression_activity_id = 'SO005',
                                        harder_activity_id    = 'SO007' WHERE id = 'SO006';

UPDATE training_catalog_activities SET harder_activity_id    = 'SO008' WHERE id = 'SO007';
UPDATE training_catalog_activities SET regression_activity_id = 'SO007',
                                        harder_activity_id    = 'SO009' WHERE id = 'SO008';

UPDATE training_catalog_activities SET harder_activity_id    = 'SO010' WHERE id = 'SO009';
UPDATE training_catalog_activities SET regression_activity_id = 'SO009',
                                        harder_activity_id    = 'SO011' WHERE id = 'SO010';

UPDATE training_catalog_activities SET regression_activity_id = 'SO010',
                                        harder_activity_id    = 'SO012' WHERE id = 'SO011';
UPDATE training_catalog_activities SET regression_activity_id = 'SO011',
                                        harder_activity_id    = 'SO013' WHERE id = 'SO012';
UPDATE training_catalog_activities SET regression_activity_id = 'SO012',
                                        harder_activity_id    = 'SO014' WHERE id = 'SO013';
UPDATE training_catalog_activities SET regression_activity_id = 'SO013',
                                        harder_activity_id    = 'SO015' WHERE id = 'SO014';
UPDATE training_catalog_activities SET regression_activity_id = 'SO014',
                                        harder_activity_id    = 'SO016' WHERE id = 'SO015';
UPDATE training_catalog_activities SET regression_activity_id = 'SO015',
                                        harder_activity_id    = 'SO017' WHERE id = 'SO016';
UPDATE training_catalog_activities SET regression_activity_id = 'SO016',
                                        harder_activity_id    = 'SO018' WHERE id = 'SO017';
UPDATE training_catalog_activities SET regression_activity_id = 'SO017',
                                        harder_activity_id    = 'SO019' WHERE id = 'SO018';
UPDATE training_catalog_activities SET regression_activity_id = 'SO018',
                                        harder_activity_id    = 'SO020' WHERE id = 'SO019';
UPDATE training_catalog_activities SET regression_activity_id = 'SO019' WHERE id = 'SO020';

-- ─── Reference asset requirements ─────────────────────────────────────────────

INSERT INTO training_reference_asset_requirements (
  activity_id, asset_type, is_required, description,
  minimum_photos, maximum_photos, reusable_across_activities, instructions
)
SELECT
  id,
  'DOG_PROFILE'::reference_asset_type,
  true,
  'A clear front-facing photo of the dog''s face to confirm the correct dog is in the training clip.',
  1, 3, true,
  ARRAY['Take the photo in good lighting', 'Ensure the dog''s face and distinguishing markings are visible']
FROM training_catalog_activities
WHERE id IN (
  'SO001','SO002','SO003','SO004','SO005','SO006','SO007','SO008',
  'SO009','SO010','SO011','SO012','SO013','SO014','SO015','SO016',
  'SO017','SO018','SO019','SO020'
)
ON CONFLICT DO NOTHING;
