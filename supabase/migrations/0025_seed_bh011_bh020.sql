-- ============================================================
-- Migration 0025 — Seed BH011–BH020: Crate, Doorway, and Bowl Manners
-- ============================================================
-- Asset rules:
--   BH011–BH013  TARGET_CRATE  + DOG_PROFILE
--   BH014–BH017  TARGET_DOORWAY + DOG_PROFILE
--   BH018–BH020  TARGET_BOWL   + DOG_PROFILE
--
-- Audio rules:
--   BH011–BH013  audioRequired = false  (entry behaviors)
--   BH014–BH020  audioRequired = true   (release-cue timing required)
--
-- Self-referential FK strategy: insert all rows with NULL for
-- regression_activity_id / harder_activity_id, then UPDATE.
-- coinReward = 0 for all: non-CERTIFIED activities cannot award Gold Coins.
-- ============================================================

INSERT INTO training_catalog_activities (
  id, category, sequence_number, level,
  title, skill_family, quest_content_type,
  lesson_goal, why_it_matters, tutorial_steps, visible_checkpoint,
  prerequisites, regression_activity_id, harder_activity_id,
  required_reference_assets,
  recommended_fps, min_clip_seconds, max_clip_seconds,
  pass_criteria, fail_criteria, needs_review_criteria, safety_notes,
  minimum_auto_pass_confidence, minimum_auto_fail_confidence,
  verification_status, xp_reward, coin_reward, stars_available,
  vlm_prompt,
  start_state_criteria, out_of_scope_claims, recording_requirements
)
VALUES

-- ── BH011: Safe-Zone Entry ────────────────────────────────────────────────────
(
  'BH011', 'BETTER_BEHAVIOR_AT_HOME', 11, 1,
  'Safe-Zone Entry', 'Crate and Safe-Zone Conditioning', 'AI_VERIFIED_MAIN_QUEST',
  'Dog voluntarily moves into or onto a registered safe zone (crate or mat) on a single cue without physical guidance.',
  'A dog that willingly enters its safe zone can self-regulate during overstimulating situations. The safe zone — whether a crate, mat, or bed — becomes a reliable anchor for every calm-at-home and travel behavior.',
  $bh011_steps$[
    "Place the crate or mat in the room with the door open (or edge visible). Let the dog investigate freely.",
    "Toss a high-value treat just inside the entry of the safe zone. Say nothing — let the dog discover the zone on its own terms.",
    "Repeat 5–8 times until the dog moves in confidently without hesitation.",
    "Introduce the verbal cue 'Place' (or your chosen word) just as the dog starts to move in.",
    "Build to a reliable, unprompted entry on a single verbal cue from 1 metre away."
  ]$bh011_steps$::jsonb,
  'Dog''s full body moves inside or onto the registered safe zone on a single cue; the safe zone matches the TARGET_CRATE or TARGET_MAT reference photo.',
  ARRAY['BH001'],
  NULL, NULL,
  ARRAY['DOG_PROFILE', 'TARGET_CRATE']::reference_asset_type[],
  3, 5, 20,
  ARRAY[
    'The safe zone visible in the clip matches the TARGET_CRATE or an available reference photo (color, shape, texture match).',
    'Dog''s entire body — including hindquarters — moves inside or fully onto the safe zone.',
    'Dog enters without being physically pushed, lifted, or lured with food maintained at the nose.'
  ],
  ARRAY[
    'Dog places only its front paws inside the safe zone while hindquarters remain outside.',
    'Handler physically pushes or lifts the dog into the safe zone.',
    'Dog approaches but then retreats and does not complete entry.',
    'The safe zone visible in the clip does not match any available reference photo.'
  ],
  ARRAY[
    'The safe zone is partially out of frame, making it impossible to confirm a full-body entry.',
    'The dog''s hindquarters are obscured by the crate door frame or camera angle at the moment of entry.',
    'A mat and a crate are both visible; it is ambiguous which one is the registered safe zone.'
  ],
  ARRAY['Never force a dog into a crate by pushing from behind or blocking escape — this creates fear of the safe zone.'],
  0.78, 0.88, 'BETA', 60, 0, 3,
  $bh011_vlm$You are evaluating a dog-training video for PAWS activity BH011: Safe-Zone Entry.

ACTIVITY DEFINITION
The dog must voluntarily move its entire body into or onto a registered safe zone — either the crate photographed in TARGET_CRATE or a mat registered under another reference asset — on a single handler cue, without physical guidance. Full-body entry means all four paws and the dog's hindquarters are inside or on the safe zone.

REFERENCE ASSET CHECK — evaluate first
1. Compare the safe zone visible in this clip against the TARGET_CRATE reference photo: shape, color, material, door style. If a clear crate match is found, proceed with TARGET_CRATE as the reference.
2. If a mat is visible instead of a crate, check whether a TARGET_MAT reference is available. If so, compare against that. Note in matchedReferenceAssets which reference type was matched and at what confidence.
3. If neither a crate nor a mat is matched to any available reference, set referenceObjectMatchedWhenRequired=false, verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE — evaluate after reference check
1. Is at least one dog clearly visible in frame? If not, set scorable=false, verdict=NEEDS_REVIEW.
2. Is exactly one dog identifiable as the subject? If ambiguous, set targetDogUnambiguous=false.
3. Is the entire safe-zone entry visible before the dog begins moving? targetObjectVisibleWhenRequired=true; if the entry is partially out of frame, confirming full-body entry may be impossible.
4. Is the interior of the safe zone visible so that the dog's hindquarters can be seen moving inside? If not, set framingSufficient=false.
5. Does the clip capture the full entry from outside to inside the safe zone? If it cuts before the dog's hindquarters clear the entry, set actionCapturedFromStartToFinish=false.

START STATE
The dog should be at least 0.5 metres from the safe-zone entry and facing away from or at an angle to it. The safe zone must be in its target position in frame. If a crate is used, the door must be fully open.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. The safe zone in the clip matches the TARGET_CRATE reference photo (or an available mat reference if a mat is used as the safe zone).
2. The dog's entire body — all four paws and hindquarters — moves fully inside or fully onto the safe zone.
3. The dog entered on its own power: no physical pushing, lifting, or continuous nose-contact luring by the handler.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Dog places only front paws inside while hindquarters remain outside the entry.
- Handler physically pushes, lifts, or steers the dog into the safe zone.
- Dog approaches the safe-zone entry but turns away and does not complete the entry.
- The safe zone does not match any available reference photo.

NEEDS REVIEW CRITERIA
- The safe zone is partially out of frame, making full-body entry unconfirmable.
- The dog's hindquarters are obscured by the crate door frame at the critical moment of entry.
- Both a mat and a crate are visible in frame; it is genuinely ambiguous which is the registered safe zone.

FORBIDDEN INFERENCES — never include these in output
- Do not infer that the dog feels emotionally safe, calm, comfortable, or relaxed inside the safe zone.
- Do not evaluate posture, body tension, or tail position inside the safe zone.
- Do not comment on crate size, brand, or how well it fits the dog.
- Do not evaluate duration of stay inside the safe zone.
- Do not speculate about the dog's history with crates or safe zones.

JSON OUTPUT INSTRUCTION
Return a structured JSON result. In matchedReferenceAssets, include one entry per reference asset checked (TARGET_CRATE and TARGET_MAT if applicable), each with matched=true/false and confidence. In observedEvents, record: (a) timestamp of cue delivery, (b) timestamp of first paw entry, (c) timestamp when hindquarters clear the entry. Set confidence based on reference match quality and full-body entry visibility.$bh011_vlm$,
  ARRAY[
    'The safe zone is fully visible in frame before the dog begins moving.',
    'Dog is at least 0.5 metres from the safe-zone entry before the cue.',
    'If a crate is used, the crate door must be fully open or removed.'
  ],
  ARRAY[
    'Do not infer that the dog feels emotionally safe, calm, comfortable, or relaxed inside the safe zone.',
    'Do not evaluate posture, body tension, or tail position inside the safe zone.',
    'Do not comment on crate size, brand, or how well it fits the dog.',
    'Do not evaluate duration of stay inside the safe zone.'
  ],
  $bh011_req${"cameraAngle": "VISIBLE_TARGET_ZONE", "fullDogBodyRequired": true, "pawsRequired": true, "hipsRequired": false, "ownerRequiredInFrame": false, "audioRequired": false, "targetObjectRequiredInFrame": true, "destinationRequiredInFrame": true, "setupInstructions": ["Position the camera so the entire crate or safe-zone entry is visible before the dog begins moving.", "Ensure the interior of the safe zone can be seen so a full-body entry is confirmable.", "Film from a 45-degree side angle to see both entry and depth of the safe zone."]}$bh011_req$::jsonb
),

-- ── BH012: Open-Crate Entry ───────────────────────────────────────────────────
(
  'BH012', 'BETTER_BEHAVIOR_AT_HOME', 12, 1,
  'Open-Crate Entry', 'Crate and Safe-Zone Conditioning', 'AI_VERIFIED_MAIN_QUEST',
  'Dog voluntarily enters the TARGET_CRATE with all four paws while the crate door remains visibly open throughout the entry sequence.',
  'Confirming that the dog enters an open crate on cue — with no door closing threat — establishes that the crate is genuinely the dog''s choice. This voluntary association is the psychological foundation for every crate-training milestone that follows.',
  $bh012_steps$[
    "Ensure the crate door is fully open and held or propped in place — it must not swing during the exercise.",
    "Stand or sit beside the crate. Use your cue word and gesture toward the entry.",
    "The moment all four paws are inside the crate, mark and reward from outside — do not close the door.",
    "Let the dog exit freely after the reward. Do not lure the dog back out — let it leave on its own terms.",
    "Repeat 8–10 times per session until the dog enters promptly and without hesitation on the verbal cue alone."
  ]$bh012_steps$::jsonb,
  'All four paws are inside the TARGET_CRATE; the crate door is visibly open and does not move during the entry; entry is voluntary.',
  ARRAY['BH011'],
  NULL, NULL,
  ARRAY['DOG_PROFILE', 'TARGET_CRATE']::reference_asset_type[],
  3, 5, 20,
  ARRAY[
    'The crate in the clip matches the TARGET_CRATE reference photo.',
    'The crate door is visibly open — not partially closed — throughout the entire entry sequence.',
    'All four of the dog''s paws are inside the crate simultaneously.',
    'The dog entered under its own power with no physical guidance from the handler.'
  ],
  ARRAY[
    'The crate door closes or begins closing while the dog is entering.',
    'The crate door is not visible in the clip, making open-door status unverifiable.',
    'Dog places only front paws inside while rear paws remain outside the crate.',
    'Handler physically pushes or steers the dog into the crate.',
    'The crate in the clip does not match the TARGET_CRATE reference photo.'
  ],
  ARRAY[
    'The crate door is partially out of frame; whether it remained open throughout cannot be confirmed.',
    'The camera angle makes it impossible to confirm all four paws are inside versus the dog being halfway in.',
    'The crate door appears open at entry start but its status mid-entry is obscured by the handler or the dog.'
  ],
  ARRAY['Do not close the crate door during this exercise — the goal is to build positive voluntary association without confinement.'],
  0.80, 0.90, 'BETA', 60, 0, 3,
  $bh012_vlm$You are evaluating a dog-training video for PAWS activity BH012: Open-Crate Entry.

ACTIVITY DEFINITION
The dog must voluntarily enter the TARGET_CRATE — all four paws inside — while the crate door remains visibly open throughout the entire entry sequence. The open-door status is a scored criterion, not just a quality note. An entry where the door swings even partially closed during entry fails this criterion.

REFERENCE ASSET CHECK — evaluate first
Compare the crate visible in this clip against the TARGET_CRATE reference photo: shape, door style, color, material, dimensions. If they clearly do not match, set referenceObjectMatchedWhenRequired=false, verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE
1. Is at least one dog clearly visible? scorable check — if not, set scorable=false, verdict=NEEDS_REVIEW.
2. Is exactly one dog identifiable as the subject? If ambiguous, set targetDogUnambiguous=false.
3. Is the crate door visible throughout the clip? targetObjectVisibleWhenRequired=true. If the crate door is out of frame at any point during entry, the open-door criterion cannot be confirmed for that interval.
4. Is the full dog body visible at the moment all four paws are inside? pawsVisibleWhenRequired=true.
5. Does the clip capture the full entry from outside to all-four-paws-inside? actionCapturedFromStartToFinish check.

START STATE
The crate door must be visibly fully open before the dog begins moving toward the crate. Dog must be outside the crate at clip start.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. The crate in the clip matches the TARGET_CRATE reference photo.
2. The crate door is visibly open — not partially closed — at every point during the dog's entry sequence. The door may be propped, held, or locked in the open position.
3. All four of the dog's paws are inside the crate simultaneously at some point in the clip.
4. The dog entered under its own power: no physical pushing, lifting, or sustained nose-contact luring.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- The crate door visibly moves toward closed at any point while the dog is in the entry sequence.
- The crate door is not in frame, making its open status during entry unverifiable (treat as fail; do not assume open).
- Dog's rear paws remain outside while only front paws are inside at the clip's end.
- Handler physically pushes or steers the dog into the crate.
- Crate does not match TARGET_CRATE reference.

NEEDS REVIEW CRITERIA
- The crate door is in frame at entry start but leaves frame mid-entry; door status during that interval is unknown.
- The dog is fully inside but the camera angle is directly behind the dog, making a 4-paw inside-confirmation impossible.
- The handler's body partially blocks the crate door view during entry.

FORBIDDEN INFERENCES — never include these in output
- Do not evaluate the dog's comfort or stress level inside the crate.
- Do not comment on duration of stay after entry.
- Do not assess crate size or fit.
- Do not infer training history from the dog's entry speed or hesitation.

JSON OUTPUT INSTRUCTION
Return a structured JSON result. In matchedReferenceAssets, include one entry for TARGET_CRATE. In observedEvents, record: (a) timestamp of cue, (b) timestamp of first paw entry, (c) timestamp of 4-paw confirmation, (d) any door-movement event if observed. Set confidence based on reference match and door-status visibility throughout entry.$bh012_vlm$,
  ARRAY[
    'The crate door is visibly fully open before the dog begins moving.',
    'Dog is at least 0.5 metres from the crate entry and facing it or at an angle to it.'
  ],
  ARRAY[
    'Do not evaluate the dog''s comfort or stress level inside the crate.',
    'Do not comment on duration of stay after entry.',
    'Do not assess crate size or fit.',
    'Do not infer training history from the dog''s entry speed or hesitation.'
  ],
  $bh012_req${"cameraAngle": "VISIBLE_TARGET_ZONE", "fullDogBodyRequired": true, "pawsRequired": true, "hipsRequired": false, "ownerRequiredInFrame": false, "audioRequired": false, "targetObjectRequiredInFrame": true, "destinationRequiredInFrame": true, "setupInstructions": ["Position the camera at a 45-degree side angle so both the crate door position and the dog's full body during entry are visible.", "Ensure the crate door and its hinge are in frame so the open status can be confirmed throughout the clip.", "Film with the crate entry facing the camera, not pointing away from it."]}$bh012_req$::jsonb
),

-- ── BH013: Crate Send from 3 Feet ────────────────────────────────────────────
(
  'BH013', 'BETTER_BEHAVIOR_AT_HOME', 13, 2,
  'Crate Send from 3 Feet', 'Crate and Safe-Zone Conditioning', 'AI_VERIFIED_MAIN_QUEST',
  'Dog travels from approximately 3 feet (1 metre) away and enters the TARGET_CRATE on a single cue, with the handler remaining stationary at the send position.',
  'Sending the dog to the crate from a distance proves the cue is fully generalised — the dog is heading to the crate because of the word, not because you are walking toward it together. This is the first step toward an off-leash crate send useful for household management.',
  $bh013_steps$[
    "Position yourself 3 feet from the open crate door, dog sitting or standing at your side.",
    "Point toward the crate and give your cue word. Do not take any steps toward the crate.",
    "The moment all four paws are inside, mark and toss a treat into the crate from where you are standing.",
    "If the dog does not go, step one foot closer and try again. Build the distance back up gradually.",
    "Alternate sending the dog from your left and right side so the behavior is not side-dependent."
  ]$bh013_steps$::jsonb,
  'Handler remains stationary at send position while dog travels to and enters the TARGET_CRATE; all four paws inside after a single cue.',
  ARRAY['BH012'],
  NULL, NULL,
  ARRAY['DOG_PROFILE', 'TARGET_CRATE']::reference_asset_type[],
  3, 8, 25,
  ARRAY[
    'The crate in the clip matches the TARGET_CRATE reference photo.',
    'The handler remains visibly stationary at the send position throughout the dog''s travel to the crate.',
    'Dog travels from the send position to the crate and all four paws enter the crate.',
    'The handler gave the cue only once before the dog began moving toward the crate.'
  ],
  ARRAY[
    'Handler walks toward or into the crate alongside the dog during the send.',
    'Dog does not enter the crate after the cue — it stops partway or diverts.',
    'Handler cues more than once before the dog begins moving.',
    'The crate in the clip does not match the TARGET_CRATE reference photo.'
  ],
  ARRAY[
    'The clip framing does not show both the handler''s starting position and the crate entry simultaneously; the 3-foot distance cannot be assessed.',
    'The handler takes one step toward the crate and then stops; it is ambiguous whether this constitutes walking to the crate or a single gesture step.',
    'The dog''s entry is partially out of frame; 4-paw inside confirmation is impossible.'
  ],
  ARRAY['Never throw a treat into the crate to get the dog inside — lure-first undermines the verbal send.'],
  0.78, 0.88, 'BETA', 75, 0, 3,
  $bh013_vlm$You are evaluating a dog-training video for PAWS activity BH013: Crate Send from 3 Feet.

ACTIVITY DEFINITION
The handler stands stationary approximately 3 feet (1 metre) from the open crate and gives a single cue. The dog must travel from the handler's position to the TARGET_CRATE and place all four paws inside. The handler must not walk to the crate alongside the dog. The 3-foot start distance must be visible in frame; if it cannot be assessed, return NEEDS_REVIEW.

REFERENCE ASSET CHECK — evaluate first
Compare the crate in this clip against the TARGET_CRATE reference photo: shape, door style, color, material. Clear mismatch → referenceObjectMatchedWhenRequired=false, verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE
1. Is at least one dog clearly visible? scorable check.
2. Is exactly one dog the subject? targetDogUnambiguous check.
3. Are both the handler's position and the crate entry simultaneously visible in frame? ownerVisibleWhenRequired=true and targetObjectVisibleWhenRequired=true. If either is outside frame, the distance criterion cannot be assessed — set framingSufficient=false, verdict=NEEDS_REVIEW.
4. Is the dog's full body visible during travel and entry? fullDogBodyVisibleWhenRequired=true.
5. Does the clip capture the full sequence from send cue to 4-paw crate entry? actionCapturedFromStartToFinish check.

START STATE
Handler must be stationary, visible, and approximately 3 feet from the crate. The dog must be beside or in front of the handler, not already moving toward the crate. The crate door must be fully open.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. The crate in the clip matches the TARGET_CRATE reference photo.
2. The handler's starting position is approximately 3 feet (0.7–1.3 metres) from the crate entry — visible in a single frame.
3. The handler remains visibly stationary throughout the dog's travel; no steps toward the crate are taken.
4. The dog travels to the crate independently and all four paws enter the crate.
5. The cue was given only once before the dog began moving.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- The handler walks alongside the dog toward the crate during the send.
- The dog does not complete entry after the single cue.
- The handler repeats the cue more than once before the dog moves.
- The crate does not match TARGET_CRATE reference.

NEEDS REVIEW CRITERIA
- The clip framing does not show both the handler's start position and the crate entry in a single frame; the 3-foot gap cannot be confirmed.
- The handler takes a single step toward the crate (gesture step) and stops; ambiguity about whether this is walking to the crate.
- The dog enters the crate but the camera angle cannot confirm 4-paw inside placement.

FORBIDDEN INFERENCES — never include these in output
- Do not fail for a distance of 2.5 feet vs. 3 feet — approximate distance is acceptable.
- Do not evaluate dog speed, enthusiasm, or directness of path.
- Do not assess the handler's cue type, hand signal, or body language beyond the stationary position requirement.
- Do not comment on the dog's behavior inside the crate after entry.
- Do not infer the dog's emotional comfort or stress from its behavior inside the crate.

JSON OUTPUT INSTRUCTION
Return a structured JSON result. In matchedReferenceAssets, include TARGET_CRATE. In observedEvents, record: (a) timestamp of send cue, (b) timestamp of first dog movement toward crate, (c) timestamp of 4-paw entry. If the distance cannot be confirmed, record a NEEDS_REVIEW event at the start of the clip with a note. Set confidence based on distance visibility, reference match, and full-body entry confirmation.$bh013_vlm$,
  ARRAY[
    'Handler is visible, stationary, and approximately 3 feet (1 metre) from the crate entry.',
    'Dog is beside or in front of the handler — not already facing or approaching the crate.',
    'The crate door is visibly open.'
  ],
  ARRAY[
    'Do not fail for a distance of 2.5 feet vs. 3 feet — approximate distance is acceptable.',
    'Do not evaluate dog speed, enthusiasm, or directness of path.',
    'Do not comment on the dog''s behavior inside the crate after entry.'
  ],
  $bh013_req${"cameraAngle": "WIDE_ROOM_OWNER_AND_DOG", "fullDogBodyRequired": true, "pawsRequired": true, "hipsRequired": false, "ownerRequiredInFrame": true, "audioRequired": false, "targetObjectRequiredInFrame": true, "destinationRequiredInFrame": true, "setupInstructions": ["Film with a wide angle that shows both the handler's send position and the crate entry simultaneously.", "The distance between handler and crate must be visible in frame so the approximate 3-foot gap can be assessed.", "Position the camera to the side so the dog's travel path and crate entry depth are both visible."]}$bh013_req$::jsonb
),

-- ── BH014: Doorway Wait — 1 Second ───────────────────────────────────────────
(
  'BH014', 'BETTER_BEHAVIOR_AT_HOME', 14, 1,
  'Doorway Wait: 1 Second', 'Doorway Manners and Boundary Control', 'AI_VERIFIED_MAIN_QUEST',
  'Dog pauses behind a visible registered interior doorway threshold for at least 1 second after the handler''s wait cue, then moves through only after an audible release cue.',
  'A dog that automatically waits at thresholds cannot bolt out of an open door. Teaching the wait at interior doorways — where the stakes are low — builds the reflex that later transfers to front doors, gates, and car doors where the stakes are very high.',
  $bh014_steps$[
    "Practice at an interior doorway only — bedroom, bathroom, or hallway door.",
    "Walk toward the door with your dog. Before the dog crosses the threshold, say 'Wait' clearly.",
    "If the dog stops, immediately mark and reward from your position — do not call them through yet.",
    "After the mark and reward, give your release word and invite the dog through.",
    "If the dog walks through before the wait, step back, reset, and try again with your body positioned more deliberately at the threshold."
  ]$bh014_steps$::jsonb,
  'Dog''s body remains behind the visible registered doorway threshold for 1 full second after the wait cue; dog crosses only after the audible release cue.',
  ARRAY['BH006'],
  NULL, NULL,
  ARRAY['DOG_PROFILE', 'TARGET_DOORWAY']::reference_asset_type[],
  3, 8, 20,
  ARRAY[
    'The doorway in the clip matches the TARGET_DOORWAY reference photo.',
    'Dog''s body — at minimum all four paws — remains on the same side of the threshold as the handler for at least 1 continuous second after the wait cue.',
    'An audible release cue is delivered by the handler at an identifiable timestamp.',
    'Dog crosses the threshold only after the release cue, not before.'
  ],
  ARRAY[
    'Dog crosses the threshold before the release cue is delivered.',
    'No audible release cue is present in the clip.',
    'The hold lasts less than 1 second before release or dog self-releases.',
    'The doorway in the clip does not match the TARGET_DOORWAY reference photo.'
  ],
  ARRAY[
    'The threshold line is ambiguous — the doorway has no door frame or the frame edge is outside the camera view.',
    'The release cue is present but audio is too quiet or distorted to confirm timing relative to the dog''s movement.',
    'The dog''s paws are straddling the threshold and it is unclear whether any paw crossed before the release cue.'
  ],
  ARRAY['Practice only at interior doorways at this level — this behavior is not yet reliable enough for exterior doors or gates.'],
  0.80, 0.90, 'BETA', 60, 0, 3,
  $bh014_vlm$You are evaluating a dog-training video for PAWS activity BH014: Doorway Wait — 1 Second.

ACTIVITY DEFINITION
The dog must remain behind a visible registered interior doorway threshold for at least 1 continuous second after the handler's wait cue, then cross the threshold only after an audible release cue. audioRequired=true because the release-cue delivery timestamp determines whether the dog crossed before or after permission was granted.

SAFETY SCOPE CONSTRAINT
This activity is designed for interior doorways only. Do not imply that a passing score on this clip means the dog is safe at exterior doors, gates, or driveways. Do not make exterior-safety inferences from this clip.

REFERENCE ASSET CHECK — evaluate first
Compare the door frame visible in this clip against the TARGET_DOORWAY reference photo: door frame color, trim style, width, any distinguishing features. Clear mismatch → referenceObjectMatchedWhenRequired=false, verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE
1. Is at least one dog clearly visible in frame? scorable check.
2. Is exactly one dog identifiable as the subject? targetDogUnambiguous check.
3. Is the doorway threshold — the floor-level line between the two sides — visible? targetObjectVisibleWhenRequired=true. If the threshold line is not visible, the wait cannot be scored.
4. Is the handler visible, confirming both are on the same side of the threshold? ownerVisibleWhenRequired=true.
5. Is the release cue audible? audioAvailableWhenRequired=true. If audio is absent or fully inaudible, set audioAvailableWhenRequired=false, verdict=NEEDS_REVIEW.
6. Does the clip capture the wait period and the dog's crossing after the release cue? actionCapturedFromStartToFinish check.

START STATE
Dog and handler are on the same side of the threshold, approaching the doorway. The dog has not yet crossed the threshold. The doorway frame is fully visible.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. The doorway in the clip matches the TARGET_DOORWAY reference photo.
2. All four of the dog's paws remain on the same side of the threshold as the handler for at least 1 continuous second after the wait cue.
3. An audible release cue is delivered at an identifiable timestamp.
4. The dog does not cross the threshold until after the release cue is delivered.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Any paw crosses the threshold before the release cue is delivered.
- No audible release cue is present in the clip.
- The dog waits for less than 1 second before the release cue is given.
- The doorway does not match TARGET_DOORWAY reference.

NEEDS REVIEW CRITERIA
- The threshold line is not visible; it is impossible to confirm whether the dog's paws were on the correct side.
- The release cue audio is present but too quiet or distorted to confirm whether it preceded the dog's crossing.
- The dog's front paws are at the very edge of the threshold; inside-versus-crossed is genuinely ambiguous.

FORBIDDEN INFERENCES — never include these in output
- Do not imply that a passing score here means the dog is safe at exterior doors.
- Do not evaluate the dog's posture type (sit, stand, down) during the wait.
- Do not assess the doorway type, security rating, or door material.
- Do not speculate on the dog's future reliability at other thresholds.

JSON OUTPUT INSTRUCTION
Return a structured JSON result. In matchedReferenceAssets, include TARGET_DOORWAY. In observedEvents, record: (a) timestamp of wait cue, (b) 1-second timer start, (c) 1-second timer end, (d) timestamp of release cue, (e) timestamp of first crossing. Verify (d) precedes (e) for the pass condition. Set confidence based on threshold visibility and audio clarity.$bh014_vlm$,
  ARRAY[
    'Dog and handler are approaching the doorway from the same side.',
    'The door frame is fully visible in frame before the wait cue is given.',
    'This must be an interior doorway — exterior doors are not appropriate for this activity level.'
  ],
  ARRAY[
    'Do not imply that this wait transfers to exterior door safety from this clip alone.',
    'Do not evaluate the dog''s sit or down posture during the wait — any stationary position behind the threshold is acceptable.',
    'Do not assess the doorway''s location in the home or its security function.'
  ],
  $bh014_req${"cameraAngle": "VISIBLE_TARGET_ZONE", "fullDogBodyRequired": true, "pawsRequired": true, "hipsRequired": false, "ownerRequiredInFrame": true, "audioRequired": true, "targetObjectRequiredInFrame": true, "destinationRequiredInFrame": false, "setupInstructions": ["Film from the side so the doorway threshold line is clearly visible and the dog's paws relative to it can be assessed.", "Ensure audio captures the wait cue and the release cue clearly.", "The door frame must be visible in frame so it can be matched against the TARGET_DOORWAY reference photo."]}$bh014_req$::jsonb
),

-- ── BH015: Doorway Wait — 3 Seconds ──────────────────────────────────────────
(
  'BH015', 'BETTER_BEHAVIOR_AT_HOME', 15, 2,
  'Doorway Wait: 3 Seconds', 'Doorway Manners and Boundary Control', 'AI_VERIFIED_MAIN_QUEST',
  'Dog remains behind a visible registered interior doorway threshold for at least 3 continuous seconds after the wait cue, crossing only after the audible release cue.',
  'Three seconds is the minimum hold that starts building a habit rather than a reaction. At this duration the dog must actively choose to hold the threshold rather than simply processing the cue — the pause becomes intentional impulse control.',
  $bh015_steps$[
    "Start from the 1-second hold (BH014 mastered). Gradually extend the wait before the release cue.",
    "Count silently to 3 before delivering the release cue. Vary the duration slightly so the dog cannot anticipate the exact second.",
    "Reward with a treat before the release cue — reach past the threshold and reward the dog on its side.",
    "If the dog breaks before 3 seconds, reset calmly without scolding and try again at 2 seconds first.",
    "Practice at the same interior doorway multiple times before introducing new doorways."
  ]$bh015_steps$::jsonb,
  'Dog''s body remains behind the registered doorway threshold for 3 continuous seconds; dog crosses only after the audible release cue.',
  ARRAY['BH014'],
  NULL, NULL,
  ARRAY['DOG_PROFILE', 'TARGET_DOORWAY']::reference_asset_type[],
  2, 10, 25,
  ARRAY[
    'The doorway in the clip matches the TARGET_DOORWAY reference photo.',
    'All four paws remain on the handler''s side of the threshold for 3 continuous seconds after the wait cue.',
    'An audible release cue is delivered at an identifiable timestamp.',
    'Dog crosses the threshold only after the release cue, not before.'
  ],
  ARRAY[
    'Any paw crosses the threshold before the release cue.',
    'The hold lasts fewer than 3 continuous seconds before the release cue is delivered.',
    'No audible release cue is present.',
    'The doorway does not match TARGET_DOORWAY reference.'
  ],
  ARRAY[
    'Threshold line is not visible in frame; paw-side confirmation is impossible.',
    'Release cue audio is present but too distorted to confirm timing relative to crossing.',
    'A paw is at the threshold edge for a sustained period; inside-versus-crossed is ambiguous.'
  ],
  ARRAY['Practice only at interior doorways at this level.'],
  0.80, 0.90, 'BETA', 75, 0, 3,
  $bh015_vlm$You are evaluating a dog-training video for PAWS activity BH015: Doorway Wait — 3 Seconds.

ACTIVITY DEFINITION
The dog must remain behind a visible registered interior doorway threshold for at least 3 continuous seconds after the wait cue, then cross only after an audible release cue. The scored sequence is identical to BH014 but with a 3-second hold requirement. audioRequired=true.

SAFETY SCOPE CONSTRAINT
This is an interior doorway exercise. Do not infer exterior-door safety from this clip.

REFERENCE ASSET CHECK — evaluate first
Compare the door frame in this clip against TARGET_DOORWAY: frame color, trim, width. Clear mismatch → referenceObjectMatchedWhenRequired=false, verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Doorway threshold visible in frame? targetObjectVisibleWhenRequired. If not visible, threshold-crossing cannot be assessed.
4. Handler visible confirming shared starting side? ownerVisibleWhenRequired.
5. Release cue audible? audioAvailableWhenRequired. Missing audio → audioAvailableWhenRequired=false, verdict=NEEDS_REVIEW.
6. Clip captures the full 3-second hold and the crossing after release? actionCapturedFromStartToFinish.

START STATE
Dog and handler on same side of threshold. Doorway frame fully visible. Dog not yet crossing.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. Doorway matches TARGET_DOORWAY reference.
2. All four paws remain on the handler's side for a continuous 3-second window after the wait cue. Any paw crossing resets the timer.
3. Audible release cue delivered at identifiable timestamp.
4. Dog crosses the threshold only after the release cue.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Any paw crosses before the release cue.
- Hold is shorter than 3 continuous seconds before release cue.
- No audible release cue present.
- Doorway does not match TARGET_DOORWAY reference.

NEEDS REVIEW CRITERIA
- Threshold line not visible; paw-side assessment impossible.
- Release cue audio present but timing too distorted to confirm relative to crossing.
- Paw is at the threshold edge for multiple seconds; inside vs. crossed is genuinely ambiguous.

FORBIDDEN INFERENCES
- Do not imply exterior-door safety.
- Do not evaluate hold posture type.

JSON OUTPUT INSTRUCTION
In observedEvents, record: (a) wait cue, (b) 3-second timer start, (c) 3-second timer end, (d) release cue, (e) threshold crossing. Verify (d) precedes (e). Include TARGET_DOORWAY in matchedReferenceAssets. Set confidence based on threshold visibility and audio timing clarity.$bh015_vlm$,
  ARRAY[
    'Dog and handler on same side of threshold before the wait cue.',
    'The TARGET_DOORWAY frame is visible in frame before the cue.'
  ],
  ARRAY[
    'Do not imply exterior-door safety from this clip.',
    'Do not evaluate the hold posture — any stationary position behind the threshold is acceptable.'
  ],
  $bh015_req${"cameraAngle": "VISIBLE_TARGET_ZONE", "fullDogBodyRequired": true, "pawsRequired": true, "hipsRequired": false, "ownerRequiredInFrame": true, "audioRequired": true, "targetObjectRequiredInFrame": true, "destinationRequiredInFrame": false, "setupInstructions": ["Film from the side so the doorway threshold and all four of the dog's paws are visible throughout the hold.", "Ensure audio captures both the wait cue and the release cue clearly.", "Record at least 10 seconds to capture the 3-second hold plus buffer before and after."]}$bh015_req$::jsonb
),

-- ── BH016: Doorway Wait — 5 Seconds ──────────────────────────────────────────
(
  'BH016', 'BETTER_BEHAVIOR_AT_HOME', 16, 2,
  'Doorway Wait: 5 Seconds', 'Doorway Manners and Boundary Control', 'AI_VERIFIED_MAIN_QUEST',
  'Dog remains behind a visible registered interior doorway threshold for at least 5 continuous seconds after the wait cue, crossing only after the audible release cue.',
  'Five seconds is long enough to be practically useful at an interior door. At this duration you can step through a doorway yourself, set down an item, or check the space on the other side before releasing the dog — all real household scenarios.',
  $bh016_steps$[
    "Start from the 3-second reliable hold (BH015 mastered). Extend to 5 seconds gradually.",
    "Begin stepping through the threshold yourself while the dog holds — stand in the doorway for 5 seconds before the release.",
    "Reward the dog on its original side of the threshold before releasing it to cross.",
    "Vary the duration between 3 and 8 seconds so the dog cannot time the release.",
    "Occasionally release and reward without crossing — unpredictability strengthens the wait."
  ]$bh016_steps$::jsonb,
  'Dog''s body remains behind the registered doorway threshold for 5 continuous seconds; dog crosses only after the audible release cue.',
  ARRAY['BH015'],
  NULL, NULL,
  ARRAY['DOG_PROFILE', 'TARGET_DOORWAY']::reference_asset_type[],
  2, 12, 25,
  ARRAY[
    'The doorway matches the TARGET_DOORWAY reference photo.',
    'All four paws remain on the handler''s starting side for 5 continuous seconds after the wait cue.',
    'An audible release cue is delivered at an identifiable timestamp after the 5-second hold.',
    'Dog crosses the threshold only after the release cue.'
  ],
  ARRAY[
    'Any paw crosses the threshold before the release cue.',
    'The hold is shorter than 5 continuous seconds before the release cue.',
    'No audible release cue is present.',
    'Doorway does not match TARGET_DOORWAY reference.'
  ],
  ARRAY[
    'Threshold not visible in frame; paw-side assessment impossible.',
    'Release cue audio present but timing too distorted to confirm relative to crossing.',
    'Paw is at threshold edge for multiple seconds; inside vs. crossed is ambiguous.',
    'The handler steps partially through the threshold during the hold, creating visual ambiguity about the threshold line.'
  ],
  ARRAY['Practice only at interior doorways at this level.'],
  0.80, 0.90, 'BETA', 75, 0, 3,
  $bh016_vlm$You are evaluating a dog-training video for PAWS activity BH016: Doorway Wait — 5 Seconds.

ACTIVITY DEFINITION
The dog must remain behind a visible registered interior doorway threshold for at least 5 continuous seconds after the wait cue, then cross only after an audible release cue. The handler may step through the doorway during the hold — the dog must remain on its original side regardless of handler movement. audioRequired=true.

SAFETY SCOPE CONSTRAINT
Interior doorway exercise only. Do not infer exterior-door safety from this clip.

REFERENCE ASSET CHECK — evaluate first
Compare door frame against TARGET_DOORWAY. Clear mismatch → referenceObjectMatchedWhenRequired=false, verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Threshold visible throughout hold? targetObjectVisibleWhenRequired. If handler steps through doorway mid-hold and body blocks threshold visibility, note the gap.
4. Handler visible at start to confirm starting side? ownerVisibleWhenRequired.
5. Release cue audible? audioAvailableWhenRequired. Missing → verdict=NEEDS_REVIEW.
6. Clip captures 5-second hold and post-release crossing? actionCapturedFromStartToFinish.

START STATE
Dog and handler both on same side. Doorway fully visible. Dog not yet crossing.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. Doorway matches TARGET_DOORWAY reference.
2. All four paws remain on the starting side for a continuous 5-second window after the wait cue.
3. Audible release cue delivered at an identifiable timestamp after the 5-second hold.
4. Dog crosses threshold only after the release cue.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Any paw crosses threshold before the release cue.
- Hold is shorter than 5 continuous seconds before release.
- No audible release cue present.
- Doorway does not match TARGET_DOORWAY.

NEEDS REVIEW CRITERIA
- Threshold not visible; paw-side assessment impossible.
- Handler's body partially blocks the threshold view during the hold, making paw position ambiguous.
- Release cue audio timing too distorted relative to crossing event.
- Paw at the edge of threshold for sustained period; inside vs. crossed is ambiguous.

FORBIDDEN INFERENCES
- Do not imply exterior-door safety.
- Do not evaluate hold posture type.
- Do not assess whether the handler stepping through is "correct" technique — it is allowed.

JSON OUTPUT INSTRUCTION
In observedEvents: (a) wait cue, (b) 5-second timer start, (c) 5-second timer end, (d) release cue, (e) threshold crossing. Verify (d) precedes (e). Include TARGET_DOORWAY in matchedReferenceAssets. Set confidence based on threshold visibility and audio timing clarity.$bh016_vlm$,
  ARRAY[
    'Dog and handler are on the same side of the threshold.',
    'Doorway frame is fully visible in frame before the wait cue.'
  ],
  ARRAY[
    'Do not imply exterior-door safety from this clip.',
    'Do not evaluate the hold posture — any stationary position behind the threshold is acceptable.'
  ],
  $bh016_req${"cameraAngle": "VISIBLE_TARGET_ZONE", "fullDogBodyRequired": true, "pawsRequired": true, "hipsRequired": false, "ownerRequiredInFrame": true, "audioRequired": true, "targetObjectRequiredInFrame": true, "destinationRequiredInFrame": false, "setupInstructions": ["Film from the side so the threshold and all four paws are visible throughout the full hold.", "Record at least 12 seconds to capture the 5-second hold plus approach and crossing.", "Ensure audio captures the wait cue and the release cue clearly."]}$bh016_req$::jsonb
),

-- ── BH017: Doorway Wait While Door Opens Wider ───────────────────────────────
(
  'BH017', 'BETTER_BEHAVIOR_AT_HOME', 17, 3,
  'Doorway Wait While Door Opens Wider', 'Doorway Manners and Boundary Control', 'AI_VERIFIED_MAIN_QUEST',
  'Dog remains behind the visible registered doorway threshold while the handler visibly opens the door wider during the hold, crossing only after the audible release cue.',
  'An opening door is the highest-value impulse trigger for a dog. A dog that can hold a threshold while a door opens in front of it has mastered the most realistic version of doorway impulse control. This is the skill that prevents bolt-throughs at front doors.',
  $bh017_steps$[
    "Start with the door partly closed — about a quarter open. Ask for a wait at the threshold.",
    "While the dog holds, slowly push the door open wider (to half, then three-quarters, then fully open).",
    "If the dog holds through the door movement, immediately mark and reward on the original side.",
    "Give the release cue and invite the dog through.",
    "If the dog bolts when the door moves, work back to BH016 with a stationary door first."
  ]$bh017_steps$::jsonb,
  'Door visibly opens wider while dog remains behind the registered threshold; dog crosses only after audible release cue. Both the door movement and the threshold line must be visible throughout.',
  ARRAY['BH016'],
  NULL, NULL,
  ARRAY['DOG_PROFILE', 'TARGET_DOORWAY']::reference_asset_type[],
  2, 12, 30,
  ARRAY[
    'The doorway in the clip matches the TARGET_DOORWAY reference photo.',
    'The door visibly opens wider during the hold — the door angle change must be observable in the clip.',
    'All four of the dog''s paws remain on the handler''s side of the threshold throughout the door-opening movement.',
    'An audible release cue is delivered at an identifiable timestamp.',
    'Dog crosses the threshold only after the release cue.'
  ],
  ARRAY[
    'Any paw crosses the threshold before the release cue, including during the door-opening movement.',
    'The door does not visibly open wider during the hold — the door is already fully open at wait start.',
    'No audible release cue is present.',
    'The doorway does not match the TARGET_DOORWAY reference photo.'
  ],
  ARRAY[
    'The door movement is present but occurs while the threshold line is out of frame, making paw position during movement unverifiable.',
    'The release cue audio timing is too distorted to confirm it preceded the dog''s crossing.',
    'The door opens but the change in angle is very small (under 10 degrees) and it is ambiguous whether meaningful door movement occurred.',
    'The dog''s paws are at the threshold edge during the door-opening phase; inside vs. crossed is ambiguous.'
  ],
  ARRAY[
    'This activity is designed for interior doors. Do not attempt at exterior doors or gates until the dog has demonstrated consistent performance across many interior sessions.'
  ],
  0.80, 0.90, 'BETA', 100, 0, 3,
  $bh017_vlm$You are evaluating a dog-training video for PAWS activity BH017: Doorway Wait While Door Opens Wider.

ACTIVITY DEFINITION
The dog must hold a threshold wait while the handler visibly opens the door wider during the hold. Three things must be simultaneously assessable: (1) the door opening movement, (2) the dog's paws remaining on the original side of the threshold, and (3) an audible release cue before the dog crosses. If either the door movement or the threshold line is not visible in the clip, return NEEDS_REVIEW. audioRequired=true.

SAFETY SCOPE CONSTRAINT
Interior doorway exercise. Do not imply exterior-door safety from this clip even if the performance is strong.

REFERENCE ASSET CHECK — evaluate first
Compare door frame against TARGET_DOORWAY: color, trim, width, any distinctive features. Clear mismatch → referenceObjectMatchedWhenRequired=false, verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Is the door edge AND the threshold line both visible in frame throughout the hold? targetObjectVisibleWhenRequired=true. If either goes out of frame during the door-opening phase, set framingSufficient=false, verdict=NEEDS_REVIEW for that segment.
4. Handler visible? ownerVisibleWhenRequired.
5. Release cue audible? audioAvailableWhenRequired. Missing → verdict=NEEDS_REVIEW.
6. Does the clip capture the door-opening motion, the full hold, the release cue, and the crossing? actionCapturedFromStartToFinish.

START STATE
The door must not be fully open at the start of the wait — it must visibly open during the hold. Dog and handler on same side of threshold. Doorway fully visible.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. The doorway matches the TARGET_DOORWAY reference photo.
2. The door visibly opens wider during the hold — a change in door angle is observable in the clip.
3. All four of the dog's paws remain on the handler's starting side of the threshold throughout the door-opening movement and until the release cue.
4. An audible release cue is delivered at an identifiable timestamp.
5. Dog crosses the threshold only after the release cue.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Any paw crosses the threshold before the release cue, whether during or after the door-opening.
- The door is already fully open at the start of the wait and does not open further — door movement criterion not met.
- No audible release cue present.
- Doorway does not match TARGET_DOORWAY.

NEEDS REVIEW CRITERIA
- The door moves but the threshold line leaves frame during that motion; paw position during door-opening cannot be confirmed.
- Release cue audio timing too distorted to confirm it preceded crossing.
- Door angle change is less than approximately 10 degrees; whether meaningful opening occurred is ambiguous.
- Paw is at the threshold edge during the opening phase; inside vs. crossed is genuinely ambiguous.

FORBIDDEN INFERENCES — never include these in output
- Do not imply that exterior-door safety is demonstrated.
- Do not evaluate door-opening speed or whether the handler opened it "correctly."
- Do not assess the dog's hold posture or body tension during the door movement.
- Do not speculate about what would happen at a front door from this clip.

JSON OUTPUT INSTRUCTION
In observedEvents, record: (a) wait cue, (b) start of door-opening movement, (c) end of door-opening movement (door settled at new angle), (d) release cue, (e) threshold crossing. Verify (d) precedes (e) and that (b)–(c) occur between (a) and (d). Include TARGET_DOORWAY in matchedReferenceAssets. Note any visibility gaps during door movement.$bh017_vlm$,
  ARRAY[
    'The door is visibly not fully open at the start of the wait — it must open during the hold for this criterion to apply.',
    'Dog and handler are on the same side of the threshold.',
    'The doorway frame and threshold line are visible in frame.'
  ],
  ARRAY[
    'Do not imply that exterior-door safety is demonstrated.',
    'Do not evaluate the exact degree of door opening — any visible opening motion during the hold qualifies.',
    'Do not assess the handler''s door-opening speed or technique.'
  ],
  $bh017_req${"cameraAngle": "VISIBLE_TARGET_ZONE", "fullDogBodyRequired": true, "pawsRequired": true, "hipsRequired": false, "ownerRequiredInFrame": true, "audioRequired": true, "targetObjectRequiredInFrame": true, "destinationRequiredInFrame": false, "setupInstructions": ["Film from the side so the door edge, threshold line, and all four of the dog's paws are simultaneously visible.", "Ensure the door's opening movement is visible in the clip — the change in door angle must be captured.", "Audio must capture both the wait cue and the release cue."]}$bh017_req$::jsonb
),

-- ── BH018: Food-Bowl Wait — 1 Second ─────────────────────────────────────────
(
  'BH018', 'BETTER_BEHAVIOR_AT_HOME', 18, 1,
  'Food-Bowl Wait: 1 Second', 'Food Impulse Control', 'AI_VERIFIED_MAIN_QUEST',
  'Dog pauses and does not approach the registered food bowl for at least 1 second after the bowl is lowered or the wait cue is given, then approaches only after the audible release cue.',
  'Impulse control around food is one of the most practical and safety-relevant skills a dog can have. A dog that can pause before eating is easier to manage around dropped food, other animals'' bowls, and food counters. It also prevents resource-guarding habits from forming.',
  $bh018_steps$[
    "Hold the food bowl at waist height. Ask for a sit or wait. Begin lowering the bowl slowly.",
    "The moment the dog leans toward the bowl or breaks the wait, raise the bowl back up without comment.",
    "When the dog remains still while you lower the bowl, mark as it reaches the floor and then give your release cue.",
    "After the release cue, step back and let the dog approach the bowl freely.",
    "Build to a 1-second full-bowl-on-the-floor wait before the release cue."
  ]$bh018_steps$::jsonb,
  'The registered food bowl is on the floor or being lowered; dog remains stationary and does not approach the bowl for 1 second; dog approaches only after audible release cue.',
  ARRAY['BH006'],
  NULL, NULL,
  ARRAY['DOG_PROFILE', 'TARGET_BOWL']::reference_asset_type[],
  3, 8, 20,
  ARRAY[
    'The bowl in the clip matches the TARGET_BOWL reference photo.',
    'Dog remains stationary — does not step toward, lunge at, or begin eating from the bowl — for at least 1 continuous second after the wait cue or bowl placement.',
    'An audible release cue is delivered at an identifiable timestamp.',
    'Dog approaches the bowl only after the release cue.'
  ],
  ARRAY[
    'Dog steps toward or begins eating from the bowl before the release cue.',
    'Dog lunges at the bowl during the lowering sequence.',
    'No audible release cue is present in the clip.',
    'The bowl does not match the TARGET_BOWL reference photo.'
  ],
  ARRAY[
    'The bowl is in frame but partially obscured; whether it matches TARGET_BOWL cannot be confirmed.',
    'The dog moves a paw slightly; it is ambiguous whether this constitutes approaching the bowl or a minor weight shift.',
    'Release cue audio is present but timing cannot be confirmed relative to the dog''s approach.'
  ],
  ARRAY[
    'Never take food away or block access after the release cue — this builds resource-guarding and defeats the purpose of the exercise.',
    'If the dog guards the bowl, contact a certified professional; do not continue this training.'
  ],
  0.80, 0.90, 'BETA', 60, 0, 3,
  $bh018_vlm$You are evaluating a dog-training video for PAWS activity BH018: Food-Bowl Wait — 1 Second.

ACTIVITY DEFINITION
The dog must remain stationary — not approaching, lunging toward, or eating from the registered food bowl — for at least 1 continuous second after the bowl is placed or the wait cue is given. The dog may then approach the bowl only after an audible release cue. audioRequired=true because the release-cue timestamp determines whether the approach was permitted.

FOOD SAFETY CONSTRAINT
Do not create conflict around food in this evaluation. Do not describe the dog as "guarding," "aggressive," or "anxious" around the bowl. Evaluate only the observable stationary hold and the release-cue sequence. If the dog shows rapid approach, mark it as a fail criterion only if it precedes the release cue.

REFERENCE ASSET CHECK — evaluate first
Compare the food bowl visible in this clip against the TARGET_BOWL reference photo: shape, color, material, size. Clear mismatch → referenceObjectMatchedWhenRequired=false, verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Is the food bowl visible in frame throughout the hold? targetObjectRequiredInFrame=true. If the bowl is out of frame, the approach cannot be assessed.
4. Is the handler visible to confirm bowl placement and release cue delivery? ownerVisibleWhenRequired.
5. Is the release cue audible? audioAvailableWhenRequired. Missing audio → audioAvailableWhenRequired=false, verdict=NEEDS_REVIEW.
6. Does the clip capture the full hold and the approach after release? actionCapturedFromStartToFinish.

START STATE
Food bowl is in frame, on the floor or being lowered. Dog has not yet approached or begun eating. Handler is visible.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. Bowl matches TARGET_BOWL reference photo.
2. Dog remains stationary — no step toward the bowl, no nose-toward-bowl lunge, no eating — for at least 1 continuous second after the wait cue or bowl placement.
3. Audible release cue delivered at an identifiable timestamp.
4. Dog approaches the bowl only after the release cue.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Dog steps toward or begins eating from the bowl before the release cue.
- Dog lunges at the bowl during the lowering sequence, before the bowl reaches the floor.
- No audible release cue in the clip.
- Bowl does not match TARGET_BOWL reference.

NEEDS REVIEW CRITERIA
- Bowl partially obscured; TARGET_BOWL match cannot be confirmed.
- Dog moves a single paw slightly; ambiguous whether this is approaching the bowl or a minor weight shift.
- Release cue audio present but timing too distorted to confirm relative to the dog's approach.

FORBIDDEN INFERENCES — never include these in output
- Do not describe the dog as guarding, anxious, or stressed around the bowl.
- Do not evaluate the dog's wait posture — sit, stand, down, or any position away from the bowl is acceptable.
- Do not comment on food type, bowl brand, or portion size.
- Do not assess whether the dog eats enthusiastically after the release.
- Do not create conflict in the evaluation language around food.

JSON OUTPUT INSTRUCTION
Return a structured JSON result. In matchedReferenceAssets, include TARGET_BOWL. In observedEvents: (a) bowl placement or wait cue, (b) 1-second timer start, (c) timer end, (d) release cue, (e) dog's first approach movement. Verify (d) precedes (e). Set confidence based on reference match, bowl visibility, and audio timing clarity.$bh018_vlm$,
  ARRAY[
    'The food bowl is visible in frame — either on the floor or being lowered — before the wait cue.',
    'Dog has not yet approached or begun eating from the bowl.',
    'Handler is visible and in control of the bowl or has just placed it.'
  ],
  ARRAY[
    'Do not create conflict or tension around the food evaluation — food bowl training must remain positive.',
    'Do not evaluate the dog''s posture during the wait — any stationary position away from the bowl is acceptable.',
    'Do not comment on the food type, bowl brand, or portion size.',
    'Do not evaluate whether the dog eats the food after the release.'
  ],
  $bh018_req${"cameraAngle": "SIDE_FULL_BODY", "fullDogBodyRequired": true, "pawsRequired": true, "hipsRequired": false, "ownerRequiredInFrame": true, "audioRequired": true, "targetObjectRequiredInFrame": true, "destinationRequiredInFrame": false, "setupInstructions": ["Film from the side so both the food bowl and the dog's full body (including paws) are simultaneously visible.", "Ensure audio captures the release cue clearly.", "Place the bowl on a solid floor (not carpet) so its position and distance from the dog are clearly visible."]}$bh018_req$::jsonb
),

-- ── BH019: Food-Bowl Wait — 3 Seconds ────────────────────────────────────────
(
  'BH019', 'BETTER_BEHAVIOR_AT_HOME', 19, 2,
  'Food-Bowl Wait: 3 Seconds', 'Food Impulse Control', 'AI_VERIFIED_MAIN_QUEST',
  'Dog remains stationary and does not approach the registered food bowl for at least 3 continuous seconds, approaching only after the audible release cue.',
  'Three seconds of bowl-wait is enough to build a practical mealtime routine that reinforces the dog''s position as a calm, cooperative family member at mealtimes. It also establishes the foundation for safe drop-food response later.',
  $bh019_steps$[
    "Build from the 1-second reliable wait (BH018). Gradually extend the pause to 3 seconds.",
    "Vary the wait duration between 1 and 4 seconds before releasing so the dog cannot predict the exact moment.",
    "Practice with the bowl in different positions in the feeding area to prevent location-specific waiting.",
    "If the dog breaks before 3 seconds, pick up the bowl calmly and reset. Do not scold.",
    "Once reliable at 3 seconds, begin stepping away from the bowl during the hold."
  ]$bh019_steps$::jsonb,
  'Dog remains stationary and away from the registered food bowl for 3 continuous seconds; dog approaches only after the audible release cue.',
  ARRAY['BH018'],
  NULL, NULL,
  ARRAY['DOG_PROFILE', 'TARGET_BOWL']::reference_asset_type[],
  2, 10, 25,
  ARRAY[
    'The bowl matches the TARGET_BOWL reference photo.',
    'Dog remains stationary and does not approach, lunge at, or eat from the bowl for 3 continuous seconds.',
    'Audible release cue delivered at an identifiable timestamp.',
    'Dog approaches the bowl only after the release cue.'
  ],
  ARRAY[
    'Dog approaches or begins eating before the release cue.',
    'Hold is shorter than 3 continuous seconds before the release cue.',
    'No audible release cue in the clip.',
    'Bowl does not match TARGET_BOWL reference.'
  ],
  ARRAY[
    'Bowl partially out of frame; match confirmation impossible.',
    'Dog takes a minor step; approaching vs. shifting weight is ambiguous.',
    'Release cue timing too distorted to confirm relative to approach.'
  ],
  ARRAY[
    'Never remove or block the bowl after the release cue.',
    'If the dog shows guarding behavior, stop and consult a professional.'
  ],
  0.80, 0.90, 'BETA', 75, 0, 3,
  $bh019_vlm$You are evaluating a dog-training video for PAWS activity BH019: Food-Bowl Wait — 3 Seconds.

ACTIVITY DEFINITION
The dog must remain stationary — not approaching or eating from the registered food bowl — for at least 3 continuous seconds after the bowl is placed and the wait cue given, then approach only after an audible release cue. audioRequired=true.

FOOD SAFETY CONSTRAINT
Do not use conflict language around food. Evaluate only observable hold behavior and release-cue sequencing. Mark approach-before-release as a fail without characterizing the dog's food-related behavior further.

REFERENCE ASSET CHECK — evaluate first
Compare the bowl against TARGET_BOWL: shape, color, material. Clear mismatch → referenceObjectMatchedWhenRequired=false, verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE
1. Dog visible? scorable check.
2. One dog? targetDogUnambiguous.
3. Bowl in frame throughout hold? targetObjectRequiredInFrame.
4. Handler visible? ownerVisibleWhenRequired.
5. Release cue audible? audioAvailableWhenRequired. Missing → verdict=NEEDS_REVIEW.
6. Clip captures 3-second hold and post-release approach? actionCapturedFromStartToFinish.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. Bowl matches TARGET_BOWL reference.
2. Dog stationary — no step toward bowl, no nose-toward-bowl lunge, no eating — for 3 continuous seconds.
3. Audible release cue at identifiable timestamp.
4. Dog approaches only after release cue.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Dog approaches or begins eating before release cue.
- Hold is shorter than 3 seconds before release.
- No release cue audible.
- Bowl does not match TARGET_BOWL.

NEEDS REVIEW CRITERIA
- Bowl partially out of frame; match unconfirmable.
- Minor paw movement; approaching vs. shifting weight is ambiguous.
- Release cue timing too distorted relative to approach.

FORBIDDEN INFERENCES
- Do not describe guarding, anxiety, or stress around food.
- Do not evaluate posture during hold or eating behavior after release.

JSON OUTPUT INSTRUCTION
In observedEvents: (a) bowl placement or wait cue, (b) 3-second timer start, (c) timer end, (d) release cue, (e) first approach. Verify (d) precedes (e). Include TARGET_BOWL in matchedReferenceAssets.$bh019_vlm$,
  ARRAY[
    'Food bowl is on the floor and visible in frame before the hold period.',
    'Dog has not yet approached or eaten from the bowl.'
  ],
  ARRAY[
    'Do not create conflict around food in evaluation language.',
    'Do not evaluate wait posture or eating behavior after release.',
    'Do not comment on food type or bowl material.'
  ],
  $bh019_req${"cameraAngle": "SIDE_FULL_BODY", "fullDogBodyRequired": true, "pawsRequired": true, "hipsRequired": false, "ownerRequiredInFrame": true, "audioRequired": true, "targetObjectRequiredInFrame": true, "destinationRequiredInFrame": false, "setupInstructions": ["Film from the side so both the food bowl and the dog's full body are visible for the entire 3-second hold.", "Record at least 10 seconds to capture the hold and approach after release.", "Ensure audio captures the release cue clearly."]}$bh019_req$::jsonb
),

-- ── BH020: Food-Bowl Wait — 5 Seconds ────────────────────────────────────────
(
  'BH020', 'BETTER_BEHAVIOR_AT_HOME', 20, 2,
  'Food-Bowl Wait: 5 Seconds', 'Food Impulse Control', 'AI_VERIFIED_MAIN_QUEST',
  'Dog remains stationary and does not approach the registered food bowl for at least 5 continuous seconds, approaching only after the audible release cue.',
  'Five seconds of food-bowl wait is the threshold at which the behavior becomes a reliable daily ritual rather than a variable practice. A dog that waits 5 seconds at its bowl will also pause when food is dropped on the floor — the most practical food-safety payoff of this entire skill family.',
  $bh020_steps$[
    "Build from the 3-second reliable wait (BH019). Extend to 5 seconds in 1-second increments.",
    "During the hold, practice stepping away from the bowl and returning — the dog must hold whether you are nearby or not.",
    "Vary release timing between 3 and 8 seconds so the dog cannot anticipate the exact moment.",
    "Introduce mild distractions during the hold: light movement in the room, a sound — the hold must be solid before adding distraction.",
    "Once the 5-second wait is reliable, begin generalizing to other bowl locations and slightly different bowl types."
  ]$bh020_steps$::jsonb,
  'Dog remains stationary and away from the registered food bowl for 5 continuous seconds; dog approaches only after the audible release cue.',
  ARRAY['BH019'],
  NULL, NULL,
  ARRAY['DOG_PROFILE', 'TARGET_BOWL']::reference_asset_type[],
  2, 12, 25,
  ARRAY[
    'The bowl matches the TARGET_BOWL reference photo.',
    'Dog remains stationary and does not approach, lunge at, or eat from the bowl for 5 continuous seconds.',
    'Audible release cue delivered at an identifiable timestamp after the 5-second hold.',
    'Dog approaches the bowl only after the release cue.'
  ],
  ARRAY[
    'Dog approaches or begins eating before the release cue.',
    'Hold is shorter than 5 continuous seconds before the release cue.',
    'No audible release cue in the clip.',
    'Bowl does not match TARGET_BOWL reference.'
  ],
  ARRAY[
    'Bowl partially out of frame during hold; match confirmation impossible.',
    'Dog makes a minor weight shift during the hold; approaching vs. fidgeting is ambiguous.',
    'Release cue audio timing too distorted to confirm relative to the dog''s first approach step.',
    'The clip ends before 5 seconds of hold plus the approach after release are both captured.'
  ],
  ARRAY[
    'Never remove or block the bowl after the release cue — this builds resource-guarding.',
    'If at any point the dog shows guarding behavior, stop the session and consult a professional.'
  ],
  0.80, 0.90, 'BETA', 100, 0, 3,
  $bh020_vlm$You are evaluating a dog-training video for PAWS activity BH020: Food-Bowl Wait — 5 Seconds.

ACTIVITY DEFINITION
The dog must remain stationary — not approaching, lunging at, or eating from the registered food bowl — for at least 5 continuous seconds after the bowl is placed and the wait cue given, then approach only after an audible release cue. audioRequired=true because release-cue timing determines whether the approach was permitted.

FOOD SAFETY CONSTRAINT
Do not use conflict language around food. Evaluate observable hold behavior and release-cue sequencing only. Do not describe the dog's food motivation, guarding tendency, or stress state.

REFERENCE ASSET CHECK — evaluate first
Compare the bowl in this clip against TARGET_BOWL: shape, color, material, size. Clear mismatch → referenceObjectMatchedWhenRequired=false, verdict=NEEDS_REVIEW.

SCORABLE VIDEO GATE
1. Dog clearly visible? scorable check.
2. One dog identifiable? targetDogUnambiguous.
3. Bowl visible in frame throughout the 5-second hold? targetObjectRequiredInFrame=true. If the bowl leaves frame during the hold, the approach criterion cannot be assessed for that period.
4. Handler visible at start and at release cue delivery? ownerVisibleWhenRequired.
5. Release cue audible? audioAvailableWhenRequired. Missing → verdict=NEEDS_REVIEW.
6. Clip captures full 5-second hold, release cue, and first approach? actionCapturedFromStartToFinish.

START STATE
Food bowl is on the floor and visible in frame. Dog has not approached or eaten. Handler is in control of the bowl or has just placed it.

PASS CRITERIA — all must be satisfied for a PASS verdict
1. Bowl matches TARGET_BOWL reference photo.
2. Dog remains stationary — no step toward the bowl, no nose-toward-bowl movement, no eating — for 5 continuous seconds after the wait cue. Any movement toward the bowl resets the 5-second timer.
3. Audible release cue delivered at an identifiable timestamp after the 5-second hold is complete.
4. Dog's first approach to the bowl occurs only after the release cue.

FAIL CRITERIA — any one is sufficient for a FAIL verdict
- Dog steps toward or begins eating from the bowl before the release cue, at any point during the 5-second window.
- Hold is shorter than 5 continuous seconds before the release cue.
- No audible release cue in the clip.
- Bowl does not match TARGET_BOWL.

NEEDS REVIEW CRITERIA
- Bowl partially out of frame during hold; reference match or approach assessment is impossible.
- Dog makes a minor weight shift during the hold; ambiguous whether this constitutes approaching the bowl.
- Release cue audio is present but timing is too distorted to confirm it preceded the dog's first approach step.
- The clip ends before both the 5-second hold end and the post-release approach are captured.

FORBIDDEN INFERENCES — never include these in output
- Do not describe the dog's guarding, anxiety, or stress state around food.
- Do not evaluate wait posture or eating behavior after the release.
- Do not comment on food type, bowl brand, or portion size.
- Do not infer from this clip that the dog's dropped-food response will be reliable.

JSON OUTPUT INSTRUCTION
Return a structured JSON result. In matchedReferenceAssets, include TARGET_BOWL. In observedEvents: (a) bowl placement or wait cue, (b) 5-second timer start, (c) 5-second timer end, (d) release cue timestamp, (e) dog's first movement toward the bowl. Verify (d) precedes (e). At 2 FPS, timer precision is ±0.5 seconds — note this. Set confidence based on reference match, bowl visibility throughout hold, and audio timing clarity.$bh020_vlm$,
  ARRAY[
    'Food bowl is on the floor and visible in frame before the hold period.',
    'Dog has not yet approached or eaten from the bowl.'
  ],
  ARRAY[
    'Do not create conflict around food in evaluation language.',
    'Do not evaluate the dog''s posture during the wait or eating behavior after release.',
    'Do not comment on food type, bowl brand, or portion size.',
    'Do not infer that this skill transfers to dropped-food response from this clip alone.'
  ],
  $bh020_req${"cameraAngle": "SIDE_FULL_BODY", "fullDogBodyRequired": true, "pawsRequired": true, "hipsRequired": false, "ownerRequiredInFrame": true, "audioRequired": true, "targetObjectRequiredInFrame": true, "destinationRequiredInFrame": false, "setupInstructions": ["Film from the side so the food bowl and the dog's full body are visible for the entire 5-second hold.", "Record at least 12 seconds to capture the approach, hold, release, and first bowl approach.", "Ensure audio captures the release cue clearly."]}$bh020_req$::jsonb
)

ON CONFLICT (id) DO NOTHING;

-- ─── Step 2: Wire regression and harder activity FK references ────────────────

UPDATE training_catalog_activities SET harder_activity_id    = 'BH012' WHERE id = 'BH011';

UPDATE training_catalog_activities SET regression_activity_id = 'BH011',
                                        harder_activity_id    = 'BH013' WHERE id = 'BH012';

UPDATE training_catalog_activities SET regression_activity_id = 'BH012' WHERE id = 'BH013';

UPDATE training_catalog_activities SET harder_activity_id    = 'BH015' WHERE id = 'BH014';

UPDATE training_catalog_activities SET regression_activity_id = 'BH014',
                                        harder_activity_id    = 'BH016' WHERE id = 'BH015';

UPDATE training_catalog_activities SET regression_activity_id = 'BH015',
                                        harder_activity_id    = 'BH017' WHERE id = 'BH016';

UPDATE training_catalog_activities SET regression_activity_id = 'BH016' WHERE id = 'BH017';

UPDATE training_catalog_activities SET harder_activity_id    = 'BH019' WHERE id = 'BH018';

UPDATE training_catalog_activities SET regression_activity_id = 'BH018',
                                        harder_activity_id    = 'BH020' WHERE id = 'BH019';

UPDATE training_catalog_activities SET regression_activity_id = 'BH019' WHERE id = 'BH020';

-- ─── Step 3: Reference asset requirements ─────────────────────────────────────

INSERT INTO training_reference_asset_requirements (
  activity_id, asset_type, is_required, description,
  minimum_photos, maximum_photos, reusable_across_activities, instructions
)
VALUES
  -- BH011
  ('BH011','DOG_PROFILE',true,'Clear photo of the dog from the front to confirm identity.',1,3,true,
   ARRAY['Take in good lighting','Include distinguishing markings']),
  ('BH011','TARGET_CRATE',true,'Photo of the crate exterior (door open) from a 45-degree angle.',1,2,true,
   ARRAY['Photograph with door fully open','Include the full crate from front and side if possible','Ensure color and door style are clearly visible']),

  -- BH012
  ('BH012','DOG_PROFILE',true,'Clear photo of the dog from the front to confirm identity.',1,3,true,
   ARRAY['Take in good lighting','Include distinguishing markings']),
  ('BH012','TARGET_CRATE',true,'Photo of the crate exterior (door open) from a 45-degree angle.',1,2,true,
   ARRAY['Photograph with door fully open','Include the full crate from front and side if possible','Ensure color and door style are clearly visible']),

  -- BH013
  ('BH013','DOG_PROFILE',true,'Clear photo of the dog from the front to confirm identity.',1,3,true,
   ARRAY['Take in good lighting','Include distinguishing markings']),
  ('BH013','TARGET_CRATE',true,'Photo of the crate exterior (door open) from a 45-degree angle.',1,2,true,
   ARRAY['Photograph with door fully open','Include the full crate from front and side if possible','Ensure color and door style are clearly visible']),

  -- BH014
  ('BH014','DOG_PROFILE',true,'Clear photo of the dog from the front to confirm identity.',1,3,true,
   ARRAY['Take in good lighting','Include distinguishing markings']),
  ('BH014','TARGET_DOORWAY',true,'Photo of the doorway from the same side the dog will wait on, showing the frame and threshold clearly.',1,2,true,
   ARRAY['Photograph the full door frame from floor to at least mid-height','Include the threshold line (floor transition) in the frame','Capture any distinctive trim color or hardware']),

  -- BH015
  ('BH015','DOG_PROFILE',true,'Clear photo of the dog from the front to confirm identity.',1,3,true,
   ARRAY['Take in good lighting','Include distinguishing markings']),
  ('BH015','TARGET_DOORWAY',true,'Photo of the doorway from the same side the dog will wait on, showing the frame and threshold clearly.',1,2,true,
   ARRAY['Photograph the full door frame from floor to at least mid-height','Include the threshold line (floor transition) in the frame','Capture any distinctive trim color or hardware']),

  -- BH016
  ('BH016','DOG_PROFILE',true,'Clear photo of the dog from the front to confirm identity.',1,3,true,
   ARRAY['Take in good lighting','Include distinguishing markings']),
  ('BH016','TARGET_DOORWAY',true,'Photo of the doorway from the same side the dog will wait on, showing the frame and threshold clearly.',1,2,true,
   ARRAY['Photograph the full door frame from floor to at least mid-height','Include the threshold line (floor transition) in the frame','Capture any distinctive trim color or hardware']),

  -- BH017
  ('BH017','DOG_PROFILE',true,'Clear photo of the dog from the front to confirm identity.',1,3,true,
   ARRAY['Take in good lighting','Include distinguishing markings']),
  ('BH017','TARGET_DOORWAY',true,'Photo of the doorway from the same side the dog will wait on, showing the frame and threshold clearly.',1,2,true,
   ARRAY['Photograph the full door frame from floor to at least mid-height','Include the threshold line (floor transition) in the frame','Capture any distinctive trim color or hardware']),

  -- BH018
  ('BH018','DOG_PROFILE',true,'Clear photo of the dog from the front to confirm identity.',1,3,true,
   ARRAY['Take in good lighting','Include distinguishing markings']),
  ('BH018','TARGET_BOWL',true,'Photo of the food bowl from above showing its shape, color, and material.',1,2,true,
   ARRAY['Photograph the bowl empty on a neutral floor','Capture the full rim and interior color','Include a hand for scale if the bowl is unusually large or small']),

  -- BH019
  ('BH019','DOG_PROFILE',true,'Clear photo of the dog from the front to confirm identity.',1,3,true,
   ARRAY['Take in good lighting','Include distinguishing markings']),
  ('BH019','TARGET_BOWL',true,'Photo of the food bowl from above showing its shape, color, and material.',1,2,true,
   ARRAY['Photograph the bowl empty on a neutral floor','Capture the full rim and interior color','Include a hand for scale if the bowl is unusually large or small']),

  -- BH020
  ('BH020','DOG_PROFILE',true,'Clear photo of the dog from the front to confirm identity.',1,3,true,
   ARRAY['Take in good lighting','Include distinguishing markings']),
  ('BH020','TARGET_BOWL',true,'Photo of the food bowl from above showing its shape, color, and material.',1,2,true,
   ARRAY['Photograph the bowl empty on a neutral floor','Capture the full rim and interior color','Include a hand for scale if the bowl is unusually large or small'])

ON CONFLICT DO NOTHING;
