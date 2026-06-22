-- ============================================================
-- Migration 0042 — Seed remaining MVP Challenge Games
-- Categories:
--   SAFETY_AND_OBEDIENCE
--   COOL_TRICKS_AND_GAMES
--   CALM_ALONE_TIME
-- ============================================================

create or replace function public.build_mvp_challenge_prompt(
  p_id text,
  p_title text,
  p_category text,
  p_start text,
  p_checkpoint text,
  p_setup jsonb,
  p_actions jsonb,
  p_pass jsonb,
  p_fail jsonb,
  p_review jsonb,
  p_out_scope jsonb,
  p_safety jsonb,
  p_audio text,
  p_duration text,
  p_refs text
)
returns text
language sql
immutable
as $$
  select concat(
    'You are reviewing one short continuous phone video for a PAWS Challenge Game.', E'\n\n',
    'CHALLENGE GAME ID: ', p_id, E'\n',
    'CHALLENGE GAME TITLE: ', p_title, E'\n',
    'CATEGORY: ', p_category, E'\n',
    'EXPECTED START STATE:', E'\n', p_start, E'\n\n',
    'VISIBLE CHECKPOINT:', E'\n', p_checkpoint, E'\n\n',
    'RECORDING SETUP:', E'\n', p_setup::text, E'\n\n',
    'REQUIRED SAVED REFERENCE PHOTOS:', E'\n', p_refs, E'\n',
    'Only submitted video evidence may support PASS.', E'\n\n',
    'AUDIO RULE:', E'\n', p_audio, E'\n\n',
    'FPS:', E'\n',
    'Review at the visual sampling rate configured by the video review pipeline. Do not require pose estimation, synthetic landmarks, medical inference, or emotion inference.', E'\n\n',
    'CLIP-DURATION RANGE:', E'\n', p_duration, E'\n\n',
    'ORDERED VISIBLE ACTIONS:', E'\n', p_actions::text, E'\n\n',
    'PASS CRITERIA:', E'\n', p_pass::text, E'\n\n',
    'FAIL CRITERIA:', E'\n', p_fail::text, E'\n\n',
    'NEEDS_REVIEW CRITERIA:', E'\n', p_review::text, E'\n\n',
    'OUT-OF-SCOPE CLAIMS:', E'\n', p_out_scope::text, E'\n\n',
    'SAFETY NOTES:', E'\n', p_safety::text, E'\n\n',
    'DECISION RULES:', E'\n',
    '- PASS only when the visible checkpoint is clearly completed by the target dog in the submitted video.', E'\n',
    '- FAIL only when the clip is clear and scorable and the required visible checkpoint is clearly not completed.', E'\n',
    '- NEEDS_REVIEW when evidence is missing, cropped, ambiguous, too dark, too short, or not scorable.', E'\n',
    '- Missing evidence is never FAIL.', E'\n',
    '- Use only real visible evidence from the submitted video.', E'\n\n',
    'JSON-ONLY RESPONSE INSTRUCTION:', E'\n',
    'Return strict JSON only with this shape: {"verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"summary":"string","observedCheckpoints":["string"],"missingCheckpoints":["string"],"safetyFlags":["string"]}'
  );
$$;

with rows as (
  select *
  from (
    values
    ('GAME_SO_001','SAFETY_AND_OBEDIENCE','Name Snap','Respond to one name cue indoors.','The dog turns toward the owner after one audible name cue.','easy',5,12,'["SO002"]'::jsonb,'Dog is indoors and not already staring at the owner.','Dog turns head or body toward owner within 2 seconds after one audible name cue.','["Use a wide indoor view.","Keep dog and owner visible.","Begin before the name cue.","Audio must be clear."]'::jsonb,'["Start with the dog not staring at you.","Say the dog name once.","Reward when the dog turns toward you."]'::jsonb,'["Dog visible before cue.","One name cue audible.","Dog orients after cue."]'::jsonb,'["DOG_PROFILE matches visible dog.","One name cue audible.","Dog orients within 2 seconds after cue."]'::jsonb,'["Dog does not orient after cue.","Dog responds only before cue."]'::jsonb,'["Cue inaudible.","Dog or owner cropped.","Timing unclear.","Multiple dogs ambiguous."]'::jsonb,'["Use one cue only.","Do not shout repeatedly."]'::jsonb,'["Do not claim generalized attention.","Do not claim outdoor reliability."]'::jsonb,'Audio is required. If cue audio is missing or unclear, return NEEDS_REVIEW.'),
    ('GAME_SO_002','SAFETY_AND_OBEDIENCE','Sit Freeze','Hold a sit for 5 seconds.','The dog remains seated continuously for at least 5 seconds.','easy',8,16,'["SO006"]'::jsonb,'Dog is standing or settling into sit with full body visible.','Dog remains seated continuously for at least 5 seconds.','["Use side full-body view.","Keep hips and paws visible.","Use a non-slip surface."]'::jsonb,'["Cue or lure a sit.","Start timing when hips touch floor.","Reward after 5 seconds."]'::jsonb,'["Dog sits.","Hips remain on floor.","Hold reaches 5 seconds."]'::jsonb,'["DOG_PROFILE matches visible dog.","Sit posture clear.","Continuous 5-second hold visible.","No restraint."]'::jsonb,'["Dog stands before 5 seconds.","Dog lies down before 5 seconds.","Owner holds dog in sit."]'::jsonb,'["Hips hidden.","Paws cropped.","Duration unclear.","Clip too short."]'::jsonb,'["Use a non-slip surface.","Avoid pushing dog into position."]'::jsonb,'["Do not claim generalized sit reliability."]'::jsonb,'Audio is optional.'),
    ('GAME_SO_003','SAFETY_AND_OBEDIENCE','Down Stay','Hold a down for 5 seconds.','The dog remains in a visible down posture for at least 5 seconds.','easy',8,16,'["SO009"]'::jsonb,'Dog is in or entering a down posture with elbows and torso visible.','Dog remains down continuously for at least 5 seconds.','["Use side full-body view.","Keep elbows and torso visible.","Use a comfortable surface."]'::jsonb,'["Ask for down.","Begin timing after elbows and torso lower.","Reward after 5 seconds."]'::jsonb,'["Dog enters down.","Elbows and torso remain lowered.","Hold reaches 5 seconds."]'::jsonb,'["DOG_PROFILE matches visible dog.","Down posture visible.","Continuous 5-second hold completed.","No restraint."]'::jsonb,'["Dog rises before 5 seconds.","Dog never reaches down.","Owner holds dog down."]'::jsonb,'["Elbows hidden.","Torso cropped.","Duration unclear."]'::jsonb,'["Use a comfortable surface.","Never force down posture."]'::jsonb,'["Do not infer relaxation.","Do not claim generalized obedience."]'::jsonb,'Audio is optional.'),
    ('GAME_SO_004','SAFETY_AND_OBEDIENCE','Hand Target Pop','Touch the owner palm with the nose.','The dog visibly nose-targets an open palm.','easy',4,10,'["SO016"]'::jsonb,'Owner presents an open palm near the dog without touching the dog nose.','Dog nose visibly contacts the open palm.','["Use close or medium view.","Keep dog nose and open palm visible."]'::jsonb,'["Present open palm.","Let dog move to hand.","Reward after nose contact."]'::jsonb,'["Palm visible.","Dog moves nose toward palm.","Nose contacts palm."]'::jsonb,'["DOG_PROFILE matches visible dog.","Open palm visible.","Nose-to-palm contact visible.","No pushing."]'::jsonb,'["Dog does not contact palm.","Owner presses hand into dog nose."]'::jsonb,'["Nose hidden.","Palm cropped.","Contact obscured."]'::jsonb,'["Keep the hand still.","Do not crowd the dog."]'::jsonb,'["Do not claim generalized targeting reliability."]'::jsonb,'Audio is optional.'),
    ('GAME_SO_005','SAFETY_AND_OBEDIENCE','Indoor Dash Recall','Recall from across the room.','After one audible recall cue, the dog travels to the owner indoors.','medium',8,20,'["SO020"]'::jsonb,'Dog is indoors and not already traveling toward owner.','Dog reorients after one audible recall cue and reaches owner area.','["Use wide indoor view.","Keep start point, path, and owner visible.","Audio must be clear."]'::jsonb,'["Start 10 to 15 feet away.","Say one recall cue.","Reward when dog reaches you."]'::jsonb,'["Dog starts away.","Recall cue audible.","Dog turns toward owner.","Dog reaches owner area."]'::jsonb,'["DOG_PROFILE matches visible dog.","Recall cue audible.","Dog moves after cue.","Dog reaches owner area."]'::jsonb,'["Dog remains away.","Dog travels elsewhere.","Movement occurs only before cue."]'::jsonb,'["Audio unclear.","Path hidden.","Owner cropped.","Start distance unclear."]'::jsonb,'["Practice indoors or enclosed.","Do not test near traffic."]'::jsonb,'["Do not claim recall reliability outside this clip."]'::jsonb,'Audio is required. If cue audio is missing or unclear, return NEEDS_REVIEW.'),
    ('GAME_SO_006','SAFETY_AND_OBEDIENCE','Release Rocket','Move only after release.','The dog holds position and moves only after one audible release cue.','medium',6,14,'["SO015"]'::jsonb,'Dog is holding a visible start position before release.','Dog exits held position only after one audible release cue.','["Use wide owner-and-dog view.","Keep dog and owner visible.","Audio must be clear."]'::jsonb,'["Ask for short hold.","Say one release cue.","Let dog move after release."]'::jsonb,'["Dog holds position.","Release cue audible.","Dog moves after cue."]'::jsonb,'["DOG_PROFILE matches visible dog.","Hold visible.","Release cue audible.","Movement starts after cue."]'::jsonb,'["Dog exits before cue.","Owner physically moves dog."]'::jsonb,'["Audio unclear.","Timing unclear.","Dog cropped."]'::jsonb,'["Use an easy position.","Do not restrain dog."]'::jsonb,'["Do not infer generalized impulse control."]'::jsonb,'Audio is required. If release cue is missing or unclear, return NEEDS_REVIEW.'),
    ('GAME_SO_007','SAFETY_AND_OBEDIENCE','Leave It Peek','Disengage from visible food or object.','The dog disengages from a visible low-value item without accessing it.','medium',6,16,'["SO031"]'::jsonb,'Dog is oriented toward a visible low-value food item or object.','Dog visibly disengages and does not touch or consume the item.','["Use close or medium view.","Keep dog nose and item visible.","Use a safe low-value item."]'::jsonb,'["Present safe item.","Wait for disengagement.","Reward away from item."]'::jsonb,'["Item visible.","Dog orients.","Dog disengages.","Item remains untouched."]'::jsonb,'["DOG_PROFILE matches visible dog.","Item visible.","Disengagement visible.","No contact or consumption."]'::jsonb,'["Dog contacts or consumes item.","Dog remains persistently engaged.","Owner pushes dog away."]'::jsonb,'["Item hidden.","Dog nose hidden.","Timing unclear."]'::jsonb,'["Use safe low-value items.","Avoid conflict around food."]'::jsonb,'["Do not claim food safety reliability.","Do not infer resource guarding status."]'::jsonb,'Audio is optional.'),
    ('GAME_SO_008','SAFETY_AND_OBEDIENCE','Whistle Sprint','Recall after a whistle cue.','After one audible whistle pattern, the dog travels to the owner.','hard',8,25,'["SO030"]'::jsonb,'Dog is in a safe area and not already moving toward owner.','Dog reorients after whistle and reaches owner area.','["Use wide safe-area view.","Keep dog, route, and owner visible.","Audio must capture whistle."]'::jsonb,'["Start 15 to 20 feet away.","Give one whistle pattern.","Reward generously on arrival."]'::jsonb,'["Dog starts away.","Whistle audible.","Dog reorients.","Dog reaches owner area."]'::jsonb,'["DOG_PROFILE matches visible dog.","Whistle audible.","Dog moves after whistle.","Dog arrives."]'::jsonb,'["Dog does not recall.","Dog travels wrong direction.","Movement occurs only before whistle."]'::jsonb,'["Whistle unclear.","Route hidden.","Owner cropped.","Distance unclear."]'::jsonb,'["Use enclosed area or long line.","Never test near roads."]'::jsonb,'["Do not claim emergency recall reliability.","Do not claim off-leash safety."]'::jsonb,'Audio is required. If whistle is missing or unclear, return NEEDS_REVIEW.'),
    ('GAME_SO_009','SAFETY_AND_OBEDIENCE','Collar Touch Finish','Recall and accept a gentle collar touch.','The dog recalls to owner and owner gently touches visible collar area.','hard',8,22,'["SO023"]'::jsonb,'Dog starts away from owner with recall path visible.','Dog arrives after audible recall and owner gently touches collar area.','["Use wide-to-medium view.","Keep travel path and collar area visible.","Audio must be clear."]'::jsonb,'["Call dog once.","Reward arrival.","Gently touch collar area."]'::jsonb,'["Recall cue audible.","Dog travels to owner.","Owner touches collar area."]'::jsonb,'["DOG_PROFILE matches visible dog.","Recall sequence visible.","Gentle collar touch visible.","No forced restraint."]'::jsonb,'["Dog does not arrive.","Collar touch does not occur.","Owner grabs or drags dog."]'::jsonb,'["Collar area hidden.","Path hidden.","Audio unclear."]'::jsonb,'["Touch gently.","Do not use collar touch to punish."]'::jsonb,'["Do not infer handling comfort.","Do not claim recall reliability."]'::jsonb,'Audio is required. If recall cue is missing or unclear, return NEEDS_REVIEW.'),
    ('GAME_SO_010','SAFETY_AND_OBEDIENCE','Safety Combo','Recall, sit, and release.','The dog recalls, briefly sits near owner, then leaves only after release.','featured',12,30,'["SO024","SO015"]'::jsonb,'Dog starts away from owner and is not already moving toward owner.','Dog recalls, sits briefly near owner, and exits only after release cue.','["Use wide room or safe-area view.","Keep dog path, owner, and hips visible.","Audio must be clear."]'::jsonb,'["Call dog once.","Cue or wait for sit.","Give one release cue."]'::jsonb,'["Recall audible.","Dog arrives.","Dog sits.","Release audible.","Dog leaves after release."]'::jsonb,'["DOG_PROFILE matches visible dog.","Recall visible.","Sit visible.","Release audible.","Exit occurs after release."]'::jsonb,'["Dog does not arrive.","Dog does not sit.","Dog leaves before release.","Owner forces sit."]'::jsonb,'["Audio unclear.","Hips hidden.","Timing unclear.","Path cropped."]'::jsonb,'["Use a safe setup.","Keep the combo short."]'::jsonb,'["Do not claim emergency reliability.","Do not claim traffic safety."]'::jsonb,'Audio is required for recall and release timing. Missing cue audio requires NEEDS_REVIEW.'),

    ('GAME_CT_001','COOL_TRICKS_AND_GAMES','Spin Pop','Complete one clean spin.','The dog completes one visible 360-degree spin without physical guidance.','easy',4,12,'["CT001"]'::jsonb,'Dog is standing with full body visible before spin begins.','Dog completes one 360-degree turn.','["Use full-body view.","Keep all paws visible.","Begin before cue or lure."]'::jsonb,'["Cue or lure one spin.","Let dog complete the circle.","Reward after spin."]'::jsonb,'["Dog starts standing.","Dog begins turn.","Dog completes full circle."]'::jsonb,'["DOG_PROFILE matches visible dog.","One full spin visible.","No physical rotation."]'::jsonb,'["Dog turns less than full circle.","Dog wanders away.","Owner rotates dog."]'::jsonb,'["Full body cropped.","Turn starts before recording.","Direction unclear."]'::jsonb,'["Use non-slip surface.","Stop if dog appears uncomfortable."]'::jsonb,'["Do not claim trick fluency.","Do not infer athletic ability."]'::jsonb,'Audio is optional.'),
    ('GAME_CT_002','COOL_TRICKS_AND_GAMES','Paw Tap','Lift one paw to owner hand.','The dog visibly lifts a paw and contacts owner hand.','easy',4,12,'["CT006"]'::jsonb,'Dog is near owner with front paw visible.','Dog lifts paw and contacts owner hand.','["Use close or medium view.","Keep paw and hand visible."]'::jsonb,'["Offer hand.","Cue paw if trained.","Reward after contact."]'::jsonb,'["Hand visible.","Dog lifts paw.","Paw contacts hand."]'::jsonb,'["DOG_PROFILE matches visible dog.","Paw lift visible.","Paw-to-hand contact visible."]'::jsonb,'["Dog does not lift paw.","Owner picks up paw."]'::jsonb,'["Paw hidden.","Hand cropped.","Contact obscured."]'::jsonb,'["Do not pull paw.","Keep repetition short."]'::jsonb,'["Do not claim generalized trick reliability."]'::jsonb,'Audio is optional.'),
    ('GAME_CT_003','COOL_TRICKS_AND_GAMES','Nose Boop','Touch visible target with nose.','The dog touches a visible hand or target with nose.','easy',4,10,'["CT011"]'::jsonb,'Dog is near visible hand or target before contact.','Dog nose visibly contacts the target.','["Use close or medium view.","Keep dog nose and target visible."]'::jsonb,'["Present target.","Let dog move to it.","Reward after contact."]'::jsonb,'["Target visible.","Dog moves nose toward target.","Nose contact occurs."]'::jsonb,'["DOG_PROFILE matches visible dog.","Target visible.","Nose contact visible."]'::jsonb,'["Dog does not touch target.","Owner pushes target into dog."]'::jsonb,'["Nose hidden.","Target cropped.","Contact unclear."]'::jsonb,'["Use safe soft target.","Do not crowd dog face."]'::jsonb,'["Do not claim object discrimination."]'::jsonb,'Audio is optional.'),
    ('GAME_CT_004','COOL_TRICKS_AND_GAMES','Tunnel Peek','Move through visible tunnel or gap.','The dog voluntarily travels through a safe visible tunnel, hoop, or gap.','medium',6,18,'["CT016"]'::jsonb,'Dog starts outside visible tunnel or gap.','Dog enters and exits through visible tunnel or gap voluntarily.','["Use wide view.","Keep entrance, exit, and path visible.","Use stable safe prop."]'::jsonb,'["Set up low safe tunnel or gap.","Encourage voluntary movement.","Reward after exit."]'::jsonb,'["Dog starts outside.","Dog enters prop.","Dog travels through.","Dog exits."]'::jsonb,'["DOG_PROFILE matches visible dog.","Prop path visible.","Dog travels through voluntarily."]'::jsonb,'["Dog avoids prop.","Dog goes around.","Owner forces dog through."]'::jsonb,'["Entrance or exit cropped.","Dog hidden.","Prop unclear."]'::jsonb,'["Use stable low-height setup.","Never force entry."]'::jsonb,'["Do not claim agility proficiency."]'::jsonb,'Audio is optional.'),
    ('GAME_CT_005','COOL_TRICKS_AND_GAMES','Find It Drop','Find a visible tossed reward or toy.','The dog follows a visible tossed item and reaches it.','medium',5,15,'["CT021"]'::jsonb,'Dog is near owner before a short visible toss.','Dog follows tossed item and reaches landing area.','["Use wide view.","Keep toss area and dog path visible."]'::jsonb,'["Show reward or toy.","Toss short distance.","Let dog move to it."]'::jsonb,'["Item tossed visibly.","Dog follows after toss.","Dog reaches landing area."]'::jsonb,'["DOG_PROFILE matches visible dog.","Toss visible.","Dog moves after tossed item."]'::jsonb,'["Dog ignores toss.","Dog moves only before toss."]'::jsonb,'["Toss hidden.","Landing area cropped.","Dog path hidden."]'::jsonb,'["Use safe treats or toys.","Keep toss away from obstacles."]'::jsonb,'["Do not claim scent-work skill.","Do not claim retrieve reliability."]'::jsonb,'Audio is optional.'),
    ('GAME_CT_006','COOL_TRICKS_AND_GAMES','Toy Fetch Mini','Go to toy and return toward owner.','The dog moves to visible toy and returns toward owner area.','medium',8,22,'["CT026"]'::jsonb,'Dog starts near owner with toy visible ahead or tossed visibly.','Dog moves to toy and returns toward owner area.','["Use wide view.","Keep dog, toy, and owner visible.","Use safe toy."]'::jsonb,'["Place or toss toy.","Encourage dog to get it.","Reward movement back."]'::jsonb,'["Toy visible.","Dog travels to toy.","Dog orients back.","Dog returns toward owner."]'::jsonb,'["DOG_PROFILE matches visible dog.","Toy interaction visible.","Dog returns toward owner."]'::jsonb,'["Dog never approaches toy.","Dog leaves away with toy.","Owner drags dog back."]'::jsonb,'["Toy hidden.","Return path cropped.","Dog mouth hidden."]'::jsonb,'["Use dog-safe toy.","Avoid slippery floors."]'::jsonb,'["Do not claim formal fetch reliability."]'::jsonb,'Audio is optional.'),
    ('GAME_CT_007','COOL_TRICKS_AND_GAMES','Bow Moment','Show a brief play bow.','The dog enters a visible bow posture with front lowered and rear up.','medium',5,14,'["CT031"]'::jsonb,'Dog starts standing with full body visible.','Dog lowers front body while rear remains elevated briefly.','["Use side full-body view.","Keep front legs, torso, and rear visible."]'::jsonb,'["Cue or lure bow.","Reward when front lowers and rear remains up."]'::jsonb,'["Dog starts standing.","Front lowers.","Rear remains up.","Bow visible."]'::jsonb,'["DOG_PROFILE matches visible dog.","Bow posture visible.","Rear remains elevated."]'::jsonb,'["Dog lies fully down.","Dog remains standing.","Owner pushes dog."]'::jsonb,'["Body cropped.","Rear hidden.","Transition unclear."]'::jsonb,'["Use comfortable surface.","Stop if dog appears uncomfortable."]'::jsonb,'["Do not infer flexibility or physical fitness."]'::jsonb,'Audio is optional.'),
    ('GAME_CT_008','COOL_TRICKS_AND_GAMES','Two-Trick Combo','Complete two visible tricks in order.','The dog performs two simple visible tricks in configured order.','hard',8,22,'["CT036"]'::jsonb,'Dog is ready near owner before first trick begins.','Dog completes two distinct visible tricks in intended order.','["Use full-body view.","Keep owner cues and dog visible."]'::jsonb,'["Choose two trained tricks.","Cue them in order.","Reward after second trick."]'::jsonb,'["First trick completed.","Second trick completed.","Order clear."]'::jsonb,'["DOG_PROFILE matches visible dog.","Two distinct tricks visible.","Order clear.","No forcing."]'::jsonb,'["Only one trick completed.","Order wrong when required.","Owner physically moves dog."]'::jsonb,'["One trick cropped.","Sequence starts before recording.","Timing unclear."]'::jsonb,'["Use easy tricks.","Avoid high-impact repetition."]'::jsonb,'["Do not claim full trick-chain fluency."]'::jsonb,'Audio is optional unless cue timing is judged.'),
    ('GAME_CT_009','COOL_TRICKS_AND_GAMES','Prop Target','Touch or step onto visible prop.','The dog interacts with a safe visible prop by touching it or placing paws on it.','hard',6,18,'["CT041"]'::jsonb,'Dog starts away from visible prop.','Dog voluntarily touches or places paws on visible prop.','["Use wide or medium view.","Keep prop boundary visible.","Use stable low prop."]'::jsonb,'["Place safe prop.","Cue interaction.","Reward after visible touch or paw placement."]'::jsonb,'["Prop visible.","Dog starts away.","Dog approaches.","Dog touches or steps onto prop."]'::jsonb,'["DOG_PROFILE matches visible dog.","Prop visible.","Interaction visible.","No guidance."]'::jsonb,'["Dog avoids prop.","Dog touches different item.","Owner places dog on prop."]'::jsonb,'["Prop cropped.","Paws or nose hidden.","Movement path hidden."]'::jsonb,'["Use stable low props.","Avoid slippery or sharp objects."]'::jsonb,'["Do not claim object discrimination."]'::jsonb,'Audio is optional.'),
    ('GAME_CT_010','COOL_TRICKS_AND_GAMES','Showtime Combo','Three short tricks in one clip.','The dog completes three short visible tricks or game actions in one safe sequence.','featured',12,35,'["CT050"]'::jsonb,'Dog is near owner and ready before first trick starts.','Dog completes three distinct visible tricks or game actions in sequence.','["Use full-body view.","Keep dog and owner visible.","Use safe surface."]'::jsonb,'["Pick three easy tricks.","Cue one at a time.","Reward after final action."]'::jsonb,'["First action completed.","Second action completed.","Third action completed."]'::jsonb,'["DOG_PROFILE matches visible dog.","Three distinct actions visible.","Sequence complete.","No forcing."]'::jsonb,'["Fewer than three actions completed.","Required action missing.","Owner physically moves dog."]'::jsonb,'["Actions cropped.","Dog hidden.","Sequence unclear.","Clip too short."]'::jsonb,'["Keep actions low impact.","Stop if dog appears tired."]'::jsonb,'["Do not claim competition-level performance.","Do not infer physical fitness."]'::jsonb,'Audio is optional.'),

    ('GAME_CA_001','CALM_ALONE_TIME','Settle Snapshot','Rest in one place for 10 seconds.','The dog remains in a visible resting posture in one area for at least 10 seconds.','easy',12,25,'["CA001"]'::jsonb,'Dog is visible in a resting area before scored interval.','Dog remains in same visible resting area for at least 10 seconds.','["Use one continuous clip.","Keep dog visible.","Keep resting area visible."]'::jsonb,'["Start when dog is in resting area.","Record a continuous 10-second interval."]'::jsonb,'["Dog visible.","Resting posture or settled position visible.","Dog remains 10 seconds."]'::jsonb,'["DOG_PROFILE matches visible dog.","Dog remains visible.","Continuous 10-second interval completed.","No restraint."]'::jsonb,'["Dog leaves area before 10 seconds.","Owner restrains dog."]'::jsonb,'["Dog hidden.","Duration unclear.","Clip too short.","Area cropped."]'::jsonb,'["Use safe familiar area.","Do not confine unsafely."]'::jsonb,'["Do not claim emotional state.","Do not diagnose, cure, treat, or improve anxiety.","Do not claim indefinite alone-time safety."]'::jsonb,'Audio is optional.'),
    ('GAME_CA_002','CALM_ALONE_TIME','Door Step Away','Owner steps away briefly while dog stays in place.','Owner visibly steps away and dog remains in same area.','easy',8,20,'["CA006"]'::jsonb,'Dog is visible in safe area while owner is nearby.','Owner steps away and dog remains in same area for at least 5 seconds.','["Use wide room view.","Keep dog and owner movement visible.","Begin before owner steps away."]'::jsonb,'["Set dog in safe area.","Step away briefly.","Return and reward after interval."]'::jsonb,'["Dog starts in area.","Owner steps away.","Dog remains in area."]'::jsonb,'["DOG_PROFILE matches visible dog.","Owner step-away visible.","Dog remains 5 seconds.","No restraint."]'::jsonb,'["Dog immediately follows owner out of area.","Owner blocks or restrains dog."]'::jsonb,'["Owner movement hidden.","Dog cropped.","Timing unclear."]'::jsonb,'["Keep step-away brief.","Do not use unsafe barriers."]'::jsonb,'["Do not claim emotional state.","Do not diagnose, cure, treat, or improve anxiety.","Do not claim indefinite alone-time safety."]'::jsonb,'Audio is optional.'),
    ('GAME_CA_003','CALM_ALONE_TIME','Mat Pause','Stay on a mat for 15 seconds.','The dog remains on a visible mat or resting spot for at least 15 seconds.','easy',18,30,'["CA011"]'::jsonb,'Dog is on or entering visible mat or resting spot.','Dog remains inside visible mat or spot boundary for at least 15 seconds.','["Keep full mat or resting spot visible.","Keep dog visible continuously."]'::jsonb,'["Guide dog to mat or spot.","Record hold.","Reward after 15 seconds."]'::jsonb,'["Dog enters or is on spot.","Boundary visible.","Dog stays 15 seconds."]'::jsonb,'["DOG_PROFILE matches visible dog.","Mat or spot visible.","Continuous 15-second hold completed."]'::jsonb,'["Dog leaves before 15 seconds.","Owner holds dog in place."]'::jsonb,'["Boundary cropped.","Dog hidden.","Duration unclear.","Clip too short."]'::jsonb,'["Use comfortable stable surface.","Keep sessions short."]'::jsonb,'["Do not claim emotional state.","Do not diagnose, cure, treat, or improve anxiety.","Do not claim indefinite alone-time safety."]'::jsonb,'Audio is optional.'),
    ('GAME_CA_004','CALM_ALONE_TIME','Gate View Pause','Stay behind visible gate or threshold briefly.','The dog remains behind a visible gate, doorway, or threshold without crossing.','medium',10,24,'["CA016"]'::jsonb,'Dog starts behind visible gate or threshold.','Dog remains behind threshold for at least 10 seconds without crossing.','["Keep gate or threshold visible.","Keep dog visible.","Use safe indoor setup."]'::jsonb,'["Set up safe threshold.","Record a short wait."]'::jsonb,'["Threshold visible.","Dog starts behind it.","Dog remains behind it."]'::jsonb,'["DOG_PROFILE matches visible dog.","Threshold visible.","Dog stays behind 10 seconds.","No physical blocking."]'::jsonb,'["Dog crosses before 10 seconds.","Owner physically blocks dog."]'::jsonb,'["Threshold cropped.","Dog hidden.","Timing unclear."]'::jsonb,'["Use safe indoor barriers.","Do not test near traffic exits."]'::jsonb,'["Do not claim emotional state.","Do not diagnose, cure, treat, or improve anxiety.","Do not claim indefinite alone-time safety."]'::jsonb,'Audio is optional.'),
    ('GAME_CA_005','CALM_ALONE_TIME','Enrichment Start','Engage with safe item for 10 seconds.','The dog interacts with visible safe enrichment item for at least 10 seconds.','medium',12,25,'["CA021"]'::jsonb,'Dog is near visible safe enrichment item.','Dog voluntarily engages with item for at least 10 seconds.','["Keep dog and enrichment item visible.","Use one continuous clip.","Use dog-safe item."]'::jsonb,'["Place enrichment item.","Let dog engage voluntarily.","Record 10 seconds."]'::jsonb,'["Item visible.","Dog approaches.","Dog engages.","Engagement lasts 10 seconds."]'::jsonb,'["DOG_PROFILE matches visible dog.","Item visible.","Dog engages voluntarily.","10-second interval visible."]'::jsonb,'["Dog does not engage.","Owner forces item into mouth.","Item unsafe."]'::jsonb,'["Item hidden.","Interaction hidden.","Duration unclear."]'::jsonb,'["Use dog-safe enrichment only.","Remove unsafe item."]'::jsonb,'["Do not claim emotional state.","Do not diagnose, cure, treat, or improve anxiety.","Do not claim indefinite alone-time safety."]'::jsonb,'Audio is optional.'),
    ('GAME_CA_006','CALM_ALONE_TIME','Owner Out Of Frame','Dog stays visible after owner exits frame.','Owner exits camera frame briefly while dog remains visible in same area.','medium',12,28,'["CA026"]'::jsonb,'Dog is visible with owner initially in or near frame.','Owner exits frame and dog remains visible in same area for at least 10 seconds.','["Use fixed camera view.","Keep dog visible after owner exits.","Begin before owner exits."]'::jsonb,'["Place camera so dog stays visible.","Step out briefly.","Return after interval."]'::jsonb,'["Dog visible.","Owner exits frame.","Dog remains in area."]'::jsonb,'["DOG_PROFILE matches visible dog.","Owner exit visible.","Dog remains visible 10 seconds.","No restraint."]'::jsonb,'["Dog exits frame.","Owner restrains dog.","Dog leaves area before interval."]'::jsonb,'["Owner exit unclear.","Dog cropped.","Duration unclear."]'::jsonb,'["Keep absence brief.","Use safe familiar room."]'::jsonb,'["Do not claim emotional state.","Do not diagnose, cure, treat, or improve anxiety.","Do not claim indefinite alone-time safety."]'::jsonb,'Audio is optional.'),
    ('GAME_CA_007','CALM_ALONE_TIME','Camera Check','Fixed camera view for 20 seconds.','A fixed camera records dog remaining visible in one safe area for at least 20 seconds.','hard',22,40,'["CA031"]'::jsonb,'Dog is visible in a safe area at beginning of fixed-camera clip.','Dog remains visible in same safe area for at least 20 seconds.','["Use fixed camera angle.","Keep safe area visible.","Keep dog visible continuously."]'::jsonb,'["Set phone down.","Record quiet 20-second interval.","Return and end clip."]'::jsonb,'["Fixed view begins.","Dog remains visible.","Dog stays in area.","20-second interval completes."]'::jsonb,'["DOG_PROFILE matches visible dog.","Dog visible continuously.","Same area maintained 20 seconds."]'::jsonb,'["Dog leaves visible area before 20 seconds.","Dog is confined unsafely."]'::jsonb,'["Dog cropped.","Camera moves too much.","Duration unclear.","Clip too short."]'::jsonb,'["Use safe room.","Do not extend absence beyond short clip."]'::jsonb,'["Do not claim emotional state.","Do not diagnose, cure, treat, or improve anxiety.","Do not claim indefinite alone-time safety."]'::jsonb,'Audio is optional.'),
    ('GAME_CA_008','CALM_ALONE_TIME','Return Routine','Owner returns while dog remains in area.','Owner returns into frame and dog remains in same area until return is visible.','hard',15,35,'["CA036"]'::jsonb,'Dog is visible in safe area before or during brief owner absence.','Dog remains in visible area until owner returns into frame.','["Use fixed or wide view.","Keep dog area visible.","Show owner returning into frame."]'::jsonb,'["Step away briefly.","Return calmly into frame.","Reward after clip if desired."]'::jsonb,'["Dog visible in area.","Owner absent or away.","Dog remains.","Owner returns."]'::jsonb,'["DOG_PROFILE matches visible dog.","Return visible.","Dog remains in area until return.","No restraint."]'::jsonb,'["Dog leaves before owner returns.","Owner physically blocks dog.","Return not shown."]'::jsonb,'["Return hidden.","Dog cropped.","Timing unclear."]'::jsonb,'["Keep return low-key.","Use short safe interval."]'::jsonb,'["Do not claim emotional state.","Do not diagnose, cure, treat, or improve anxiety.","Do not claim indefinite alone-time safety."]'::jsonb,'Audio is optional.'),
    ('GAME_CA_009','CALM_ALONE_TIME','Two-Minute Setup Preview','Show a safe short alone-time setup.','The clip shows safe short-duration setup and dog remaining visible briefly.','hard',20,45,'["CA041"]'::jsonb,'Dog is in or near visible safe short-duration setup.','Dog remains visible in setup area for at least 20 seconds with no obvious unsafe handling.','["Keep water, safe area, and dog visible if present.","Show no obvious hazards in immediate area."]'::jsonb,'["Show safe setup.","Record dog in area.","Keep clip short."]'::jsonb,'["Setup area visible.","Dog visible.","Dog remains in area.","No obvious unsafe handling."]'::jsonb,'["DOG_PROFILE matches visible dog.","Setup visible.","Dog remains visible 20 seconds.","No unsafe handling."]'::jsonb,'["Dog leaves immediately.","Unsafe handling visible.","Dog forced into setup."]'::jsonb,'["Setup hidden.","Dog cropped.","Duration unclear."]'::jsonb,'["This only reviews submitted short clip.","Do not use to prove longer absence safety."]'::jsonb,'["Do not claim emotional state.","Do not diagnose, cure, treat, or improve anxiety.","Do not claim indefinite alone-time safety."]'::jsonb,'Audio is optional.'),
    ('GAME_CA_010','CALM_ALONE_TIME','Calm Routine Clip','Short visible routine: settle, step away, return.','A short sequence shows dog settling, owner stepping away briefly, and owner returning.','featured',25,60,'["CA050"]'::jsonb,'Dog is visible in safe area before short routine begins.','Dog remains visible through settle, brief owner step-away, and owner return.','["Use wide fixed view.","Keep dog area and owner movement visible.","Use safe familiar room."]'::jsonb,'["Start with dog in area.","Step away briefly.","Return and end clip."]'::jsonb,'["Dog visible in area.","Owner steps away.","Dog remains visible.","Owner returns."]'::jsonb,'["DOG_PROFILE matches visible dog.","Step-away and return visible.","Dog remains in area.","No unsafe handling."]'::jsonb,'["Dog leaves before return.","Owner forces dog to remain.","Required segment missing."]'::jsonb,'["Any segment unclear.","Dog hidden.","Owner movement hidden.","Clip too short."]'::jsonb,'["Keep routine short.","Do not claim indefinite alone-time safety."]'::jsonb,'["Do not claim emotional state.","Do not diagnose, cure, treat, or improve anxiety.","Do not claim indefinite alone-time safety."]'::jsonb,'Audio is optional.')
  ) as r(id, category, title, subtitle, description, difficulty, min_clip_seconds, max_clip_seconds, required_mastered_activity_ids, expected_start, visible_checkpoint, recording_setup, user_instructions, ordered_actions, pass_criteria, fail_criteria, needs_review_criteria, safety_notes, out_scope, audio_rule)
), priced as (
  select
    r.*,
    case r.difficulty
      when 'easy' then 10
      when 'medium' then 20
      when 'hard' then 35
      else 50
    end as silver_cost,
    case r.difficulty
      when 'easy' then 2
      when 'medium' then 5
      when 'hard' then 10
      else 20
    end as gold_reward,
    case r.difficulty
      when 'easy' then 10
      when 'medium' then 20
      when 'hard' then 35
      else 50
    end as bonus_xp
  from rows r
)
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
  is_active,
  required_reference_assets
)
select
  id,
  category::training_goal_category,
  title,
  subtitle,
  description,
  difficulty::challenge_game_difficulty,
  recording_setup,
  user_instructions,
  min_clip_seconds,
  max_clip_seconds,
  required_mastered_activity_ids,
  public.build_mvp_challenge_prompt(
    id,
    title,
    category,
    expected_start,
    visible_checkpoint,
    recording_setup,
    ordered_actions,
    pass_criteria,
    fail_criteria,
    needs_review_criteria,
    out_scope,
    safety_notes,
    audio_rule,
    min_clip_seconds::text || '-' || max_clip_seconds::text || ' seconds',
    '- DOG_PROFILE must match the visible target dog.'
  ),
  silver_cost,
  gold_reward,
  bonus_xp,
  3,
  safety_notes,
  true,
  array['DOG_PROFILE']::reference_asset_type[]
from priced
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
  required_reference_assets = excluded.required_reference_assets,
  updated_at = timezone('utc', now());

drop function public.build_mvp_challenge_prompt(text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, text);
