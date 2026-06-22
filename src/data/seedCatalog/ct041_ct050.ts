import type { CompletedSeedActivity, SeedActivity } from "./bh001_bh010";

type BatchActivity = CompletedSeedActivity & { orderedVisibleActions: string[] };

type ActivitySpec = {
  id: string;
  title: string;
  orderIndex: number;
  lessonGoal: string;
  visibleCheckpoint: string;
  tutorialSteps: string[];
  cameraAngle: string;
  setupInstructions: string[];
  requiredReferenceAssets: string[];
  conditionalReferenceRules: string[];
  audioRequired: boolean;
  fps: number;
  minClipSeconds: number;
  maxClipSeconds: number;
  passCriteria: string[];
  failCriteria: string[];
  needsReviewCriteria: string[];
  outOfScopeClaims: string[];
  safetyNotes: string[];
  prerequisiteActivityIds: string[];
  nextActivityId: string | null;
  orderedVisibleActions: string[];
  skillFamily: string;
  level: 1 | 2 | 3 | 4 | 5;
};

const list = (items: string[]): string => items.map((item) => `- ${item}`).join("\n");

const promptFor = (spec: ActivitySpec): string => `PAWS GEMINI 2.5 FLASH VERIFIER PROMPT

ACTIVITY ID
${spec.id}

ACTIVITY TITLE
${spec.title}

EXPECTED START STATE
${spec.prerequisiteActivityIds.length > 0 ? `Prerequisite activity or activities ${spec.prerequisiteActivityIds.join(", ")} have been passed when that branch applies. ` : ""}${spec.orderedVisibleActions[0]}

VISIBLE CHECKPOINT
${spec.visibleCheckpoint}

RECORDING SETUP
- Camera angle: ${spec.cameraAngle}
- Full dog body required: YES
- Owner or handler in frame required: ${spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")) ? "YES" : "NO"}
${list(spec.setupInstructions)}

REQUIRED SAVED REFERENCES
${list(spec.requiredReferenceAssets)}
${list(spec.conditionalReferenceRules)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If cue timing, release cue, or required challenge audio is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is judged. If cue timing is part of the submitted challenge and audio is unclear, return NEEDS_REVIEW."}

FPS
${spec.fps}

CLIP-DURATION RANGE
${spec.minClipSeconds}-${spec.maxClipSeconds} seconds

ORDERED VISIBLE ACTIONS
${spec.orderedVisibleActions.map((action, index) => `${index + 1}. ${action}`).join("\n")}

PASS CRITERIA
${list(spec.passCriteria)}

FAIL CRITERIA
${list(spec.failCriteria)}

NEEDS_REVIEW CRITERIA
${list(spec.needsReviewCriteria)}

OUT-OF-SCOPE CLAIMS
${list(spec.outOfScopeClaims)}

SAFETY NOTES
${list(spec.safetyNotes)}

JSON-ONLY RESPONSE INSTRUCTION
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, required audio when applicable, relevant action visible from start to finish, required saved references matching visible dog and objects when applicable, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")),
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: ["CT043", "CT044", "CT049", "CT050"].includes(spec.id),
    destinationRequiredInFrame: ["CT043", "CT044", "CT045", "CT046", "CT049", "CT050"].includes(spec.id),
    setupInstructions: spec.setupInstructions,
  };
  const prerequisiteActivityId = spec.prerequisiteActivityIds[0] ?? null;
  const activity: SeedActivity = {
    id: spec.id,
    category: "COOL_TRICKS_AND_GAMES",
    sequenceNumber: spec.orderIndex,
    level: spec.level,
    title: spec.title,
    skillFamily: spec.skillFamily,
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity verifies a visible trick sequence or challenge in the submitted clip without claiming broad mastery.",
    tutorialSteps: spec.tutorialSteps,
    visibleCheckpoint: spec.visibleCheckpoint,
    prerequisites: spec.prerequisiteActivityIds,
    regressionActivityId: prerequisiteActivityId,
    harderActivityId: spec.nextActivityId,
    requiredReferenceAssets: spec.requiredReferenceAssets,
    recordingRequirements,
    startStateCriteria: [spec.orderedVisibleActions[0]],
    passCriteria: spec.passCriteria,
    failCriteria: spec.failCriteria,
    needsReviewCriteria: spec.needsReviewCriteria,
    outOfScopeClaims: spec.outOfScopeClaims,
    safetyNotes: spec.safetyNotes,
    minimumAutoPassConfidence: 0.8,
    minimumAutoFailConfidence: 0.9,
    verificationStatus: "BETA",
    xpReward: spec.orderIndex >= 50 ? 190 : spec.orderIndex >= 46 ? 180 : 170,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: spec.fps,
    minClipSeconds: spec.minClipSeconds,
    maxClipSeconds: spec.maxClipSeconds,
    vlmPrompt: promptFor(spec),
  };
  return { ...activity, orderIndex: spec.orderIndex, recordingSetup: recordingRequirements, audioRequired: spec.audioRequired, fps: spec.fps, prerequisiteActivityId, nextActivityId: spec.nextActivityId, orderedVisibleActions: spec.orderedVisibleActions };
};

const SPECS: ActivitySpec[] = [
  {
    id: "CT041",
    title: "Sit -> Down -> Stand",
    orderIndex: 41,
    lessonGoal: "Teach the dog to complete an ordered sit, down, and stand sequence.",
    visibleCheckpoint: "Dog visibly completes the ordered sequence: sit, down, stand.",
    tutorialSteps: ["Use a side full-body view.", "Keep hips, elbows, torso, and paws visible.", "Begin recording before the sit is established.", "Cue or lure each posture without touching the dog.", "Reward after the stand is established."],
    cameraAngle: "SIDE_FULL_BODY_POSITION_SEQUENCE",
    setupInstructions: ["Hips, elbows, torso, and paws must be visible.", "Recording must begin before the sequence starts.", "Each posture transition must be visible.", "No physical forcing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Sit is visibly established.", "Down is visibly established.", "Stand is visibly established.", "Sequence order is correct.", "No physical forcing occurs."],
    failCriteria: ["One posture is missing.", "Sequence order is wrong.", "Owner physically moves dog through positions."],
    needsReviewCriteria: ["Hips hidden.", "Elbows hidden.", "Paws cropped.", "Transitions unclear.", "Sequence begins before recording."],
    outOfScopeClaims: ["Do not claim generalized obedience.", "Do not infer cue fluency outside the clip."],
    safetyNotes: ["Use a non-slip surface.", "Do not force positions."],
    prerequisiteActivityIds: ["CT020", "SO014"],
    nextActivityId: "CT042",
    orderedVisibleActions: ["Target dog is visible from the side before the sequence starts.", "Dog establishes sit.", "Dog transitions into down.", "Dog transitions into stand.", "Sequence completes in order without physical forcing."],
    skillFamily: "Combo Tricks",
    level: 5,
  },
  {
    id: "CT042",
    title: "Spin -> Bow",
    orderIndex: 42,
    lessonGoal: "Teach the dog to complete one visible spin and then enter a visible bow posture.",
    visibleCheckpoint: "Dog completes one visible spin and then enters a visible bow posture.",
    tutorialSteps: ["Use a full-body view.", "Keep hips, elbows, and spin route visible.", "Begin recording before the spin starts.", "Cue or lure one spin and then a bow.", "Reward after bow posture is visible."],
    cameraAngle: "FULL_BODY_SPIN_AND_BOW",
    setupInstructions: ["Full body, hips, elbows, and route must be visible.", "Spin must occur before bow.", "Bow must be distinguishable from a full down.", "No physical positioning may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Full spin completes.", "Dog then lowers front body into bow.", "Rear remains elevated during bow.", "Sequence order is correct.", "No physical forcing occurs."],
    failCriteria: ["Spin is incomplete.", "Bow is missing.", "Dog lies fully down instead of bowing.", "Owner physically positions dog."],
    needsReviewCriteria: ["Spin route hidden.", "Hips cropped.", "Elbows hidden.", "Order unclear."],
    outOfScopeClaims: ["Do not claim broad combo mastery.", "Do not infer cue reliability outside the clip."],
    safetyNotes: ["Use a non-slip surface.", "Stop if the dog appears physically uncomfortable."],
    prerequisiteActivityIds: ["CT006", "CT007", "CT009"],
    nextActivityId: "CT043",
    orderedVisibleActions: ["Target dog and full route are visible before spin.", "Dog completes one visible spin.", "Dog then lowers front body into bow.", "Rear remains elevated and no physical positioning occurs."],
    skillFamily: "Combo Tricks",
    level: 5,
  },
  {
    id: "CT043",
    title: "Paws Up -> Pivot",
    orderIndex: 43,
    lessonGoal: "Teach the dog to place both front paws on the registered platform and pivot rear paws around it.",
    visibleCheckpoint: "Dog places both front paws on registered TARGET_PLATFORM and pivots rear paws around the platform.",
    tutorialSteps: ["Use the registered TARGET_PLATFORM.", "Keep platform and all paws visible.", "Begin recording before paws-up or pivot starts.", "Cue or lure rear-paw pivot while front paws stay on platform.", "Reward after configured pivot completes."],
    cameraAngle: "PLATFORM_ALL_PAWS_AND_PIVOT",
    setupInstructions: ["TARGET_PLATFORM and all paws must be visible.", "Visible platform must match saved TARGET_PLATFORM photos.", "Configured pivot direction or amount must be judgeable.", "No physical rotation may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_PLATFORM"],
    conditionalReferenceRules: ["Visible platform must match saved TARGET_PLATFORM reference photos."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Platform matches TARGET_PLATFORM.", "Both front paws remain on platform.", "Rear paws visibly move around platform.", "Pivot completes according to configured direction or amount.", "No physical forcing occurs."],
    failCriteria: ["Front paws leave platform.", "Rear-paw movement does not occur.", "Owner physically rotates dog."],
    needsReviewCriteria: ["Paws hidden.", "Platform cropped.", "Pivot direction unclear.", "Platform identity unclear."],
    outOfScopeClaims: ["Do not infer mobility or fitness.", "Do not claim pivot fluency outside the clip."],
    safetyNotes: ["Use a stable non-slip platform.", "Keep pivot movement slow and comfortable."],
    prerequisiteActivityIds: ["CT021", "CT022"],
    nextActivityId: "CT044",
    orderedVisibleActions: ["Target dog, registered TARGET_PLATFORM, and all paws are visible.", "Dog places both front paws on platform.", "Front paws remain on platform while rear paws move around.", "Configured pivot completes without physical rotation."],
    skillFamily: "Combo Tricks",
    level: 5,
  },
  {
    id: "CT044",
    title: "Retrieve -> Carry -> Basket",
    orderIndex: 44,
    lessonGoal: "Teach the dog to retrieve the registered toy, carry it to the registered basket, and release it inside.",
    visibleCheckpoint: "Dog visibly travels to registered TARGET_TOY, picks it up, carries it to registered TARGET_BASKET, and releases it inside the basket boundary.",
    tutorialSteps: ["Use the registered TARGET_TOY and TARGET_BASKET.", "Keep toy, basket, dog mouth, route, and owner visible.", "Begin recording before the dog travels to toy.", "Reward after release inside basket boundary.", "Do not place the toy by hand."],
    cameraAngle: "TOY_BASKET_DOG_MOUTH_ROUTE_OWNER",
    setupInstructions: ["TARGET_TOY, TARGET_BASKET, dog mouth, route, and owner must be visible.", "Toy and basket must match saved references.", "Pickup, carry, and release must be visible.", "Owner must not place the toy into the basket."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
    conditionalReferenceRules: ["Visible toy must match TARGET_TOY and visible basket must match TARGET_BASKET reference photos."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Basket matches TARGET_BASKET.", "Dog travels to toy.", "Dog picks up toy.", "Dog carries toy to basket.", "Dog releases toy inside basket boundary.", "No physical placement by owner occurs."],
    failCriteria: ["Wrong toy is selected.", "Dog drops toy outside basket.", "Owner places toy into basket.", "Route is incomplete."],
    needsReviewCriteria: ["Pickup hidden.", "Release hidden.", "Toy identity unclear.", "Basket identity unclear.", "Route cropped."],
    outOfScopeClaims: ["Do not claim generalized cleanup behavior.", "Do not infer object sorting."],
    safetyNotes: ["Use a safe toy and stable basket.", "Keep route clear."],
    prerequisiteActivityIds: ["CT036"],
    nextActivityId: "CT045",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, registered TARGET_BASKET, route, owner, and dog mouth are visible.", "Dog travels to toy and picks it up.", "Dog carries toy to basket.", "Dog releases toy inside basket boundary without owner placement."],
    skillFamily: "Toy Game Combos",
    level: 5,
  },
  {
    id: "CT045",
    title: "Three-Trick Combo",
    orderIndex: 45,
    lessonGoal: "Verify three configured visible tricks completed in the required order.",
    visibleCheckpoint: "Dog completes exactly three configured visible tricks in the required order.",
    tutorialSteps: ["Choose exactly three previously completed CT tricks.", "Use activity-appropriate camera angles and references.", "Begin recording before the first trick.", "Complete the three tricks in configured order.", "Stop after the third trick."],
    cameraAngle: "ACTIVITY_APPROPRIATE_THREE_TRICK_COMBO",
    setupInstructions: ["Full body or activity-appropriate view must be used.", "Component-specific references must be available when selected tricks require them.", "Audio is required only when cue timing is part of scoring.", "Each trick must be individually scorable."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["Add and match activity-specific saved references only when selected tricks require them; missing required references return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 30,
    passCriteria: ["Dog matches DOG_PROFILE.", "All three configured tricks visibly complete.", "Sequence order is correct.", "Each trick is individually scorable.", "No physical forcing occurs."],
    failCriteria: ["One required trick is missing.", "Order is wrong.", "One trick visibly fails.", "Owner physically positions dog."],
    needsReviewCriteria: ["Any trick cropped.", "Order unclear.", "Required reference object missing.", "Audio unclear when required."],
    outOfScopeClaims: ["Do not claim broad trick mastery.", "Do not infer reliability outside this configured combo."],
    safetyNotes: ["Use only safe tricks for the dog.", "Stop before fatigue or frustration."],
    prerequisiteActivityIds: ["CT041", "CT042", "CT043"],
    nextActivityId: "CT046",
    orderedVisibleActions: ["Target dog and required setup for three selected tricks are visible before the combo starts.", "First configured trick completes.", "Second configured trick completes.", "Third configured trick completes.", "Order is correct and no physical forcing occurs."],
    skillFamily: "Combo Tricks",
    level: 5,
  },
  {
    id: "CT046",
    title: "Five-Trick Combo",
    orderIndex: 46,
    lessonGoal: "Verify five configured visible tricks completed in the required order.",
    visibleCheckpoint: "Dog completes exactly five configured visible tricks in the required order.",
    tutorialSteps: ["Choose exactly five previously completed CT tricks.", "Prepare required reference objects for selected tricks.", "Record before the first trick starts.", "Complete the five tricks in configured order.", "Stop after the fifth trick."],
    cameraAngle: "ACTIVITY_APPROPRIATE_FIVE_TRICK_COMBO",
    setupInstructions: ["Full body or activity-appropriate view must be used.", "Component-specific references must match when selected tricks require them.", "Audio is required only when cue timing is judged.", "Each trick must be scorable."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["Add and match activity-specific saved references only when selected tricks require them; missing required references return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 15,
    maxClipSeconds: 40,
    passCriteria: ["Dog matches DOG_PROFILE.", "All five tricks visibly complete.", "Order is correct.", "Each trick is scorable.", "Required references match.", "No forcing occurs."],
    failCriteria: ["One or more tricks are missing.", "Order is incorrect.", "Required object mismatch occurs.", "Owner physically guides dog."],
    needsReviewCriteria: ["Any trick hidden.", "Sequence unclear.", "Clip too short.", "Required reference missing."],
    outOfScopeClaims: ["Do not claim generalized performance reliability.", "Do not infer broad trick mastery."],
    safetyNotes: ["Use safe familiar tricks.", "Keep the sequence short enough to avoid fatigue."],
    prerequisiteActivityIds: ["CT045"],
    nextActivityId: "CT047",
    orderedVisibleActions: ["Target dog and required setup for five selected tricks are visible before the combo starts.", "First configured trick completes.", "Second configured trick completes.", "Third configured trick completes.", "Fourth configured trick completes.", "Fifth configured trick completes in order without forcing."],
    skillFamily: "Combo Tricks",
    level: 5,
  },
  {
    id: "CT047",
    title: "Fastest Sit",
    orderIndex: 47,
    lessonGoal: "Measure a visible stand-to-sit response after the configured cue in the submitted clip.",
    visibleCheckpoint: "Dog begins standing and visibly transitions into sit after the configured cue; cue timestamp, hips-contact-floor timestamp, and elapsed response time can be measured.",
    tutorialSteps: ["Use a side full-body view.", "Keep hips and paws visible.", "Begin with dog standing.", "Give the configured cue if cue timing is scored.", "Reward after hips contact floor."],
    cameraAngle: "SIDE_FULL_BODY_TIMED_SIT",
    setupInstructions: ["Hips and paws must be visible.", "Dog must begin standing.", "Audio is required when verbal cue timing is scored.", "Cue timestamp and hips-contact-floor timestamp must be measurable."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog starts standing.", "Cue is audible when used.", "Hips contact floor.", "Sit is visibly established.", "Response time can be measured.", "No physical forcing occurs."],
    failCriteria: ["Dog does not sit.", "Sit starts before cue when cue timing is required.", "Owner pushes dog into sit."],
    needsReviewCriteria: ["Hips hidden.", "Cue unclear.", "Timing unclear.", "Dog already seated at clip start."],
    outOfScopeClaims: ["Do not claim competition fairness beyond the submitted clip.", "Do not claim generalized fastest-sit ability."],
    safetyNotes: ["Use a non-slip surface.", "Do not push the dog into sit."],
    prerequisiteActivityIds: ["SO004", "CT041"],
    nextActivityId: "CT048",
    orderedVisibleActions: ["Target dog is standing in side full-body view before cue.", "Configured cue occurs when cue timing is scored.", "Dog transitions into sit after cue.", "Hips contact floor and response time can be measured without physical forcing."],
    skillFamily: "Challenge Games",
    level: 5,
  },
  {
    id: "CT048",
    title: "Longest Stay",
    orderIndex: 48,
    lessonGoal: "Measure a configured visible stay duration and optional release timing in the submitted clip.",
    visibleCheckpoint: "Dog remains in configured visible stay position continuously for the submitted duration and exits only after release when release is part of the challenge.",
    tutorialSteps: ["Choose a safe stay position.", "Keep dog visible continuously.", "Begin recording before visible stay start.", "Capture release cue audio if release timing is judged.", "End after the hold or release is scorable."],
    cameraAngle: "CONTINUOUS_VISIBLE_STAY_POSITION",
    setupInstructions: ["Dog must be visible continuously.", "Owner must be visible when relevant.", "Audio is required when release cue is judged.", "Visible stay start timestamp, stay end timestamp, and total scorable hold duration must be measurable."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["Add and match activity-specific saved references only when the configured stay uses a registered object."],
    audioRequired: false,
    fps: 1,
    minClipSeconds: 10,
    maxClipSeconds: 120,
    passCriteria: ["Dog matches DOG_PROFILE.", "Stay posture is visible.", "Dog remains in position continuously.", "Measured duration is valid.", "No restraint occurs.", "Dog exits only after release when release is part of the challenge."],
    failCriteria: ["Dog leaves position before target duration.", "Dog is physically held in place.", "Start position is never established."],
    needsReviewCriteria: ["Dog hidden during hold.", "Clip cropped.", "Duration unclear.", "Release timing unclear when required."],
    outOfScopeClaims: ["Do not claim generalized stay reliability.", "Do not claim formal competition validity."],
    safetyNotes: ["Use a comfortable safe stay position.", "Keep challenge duration appropriate for the dog."],
    prerequisiteActivityIds: ["SO042", "CT013"],
    nextActivityId: "CT049",
    orderedVisibleActions: ["Target dog is visible in configured stay position before timing starts.", "Visible stay start timestamp is scorable.", "Dog remains in position continuously for submitted duration.", "Visible stay end timestamp is scorable.", "Dog exits only after release when release timing is part of the challenge."],
    skillFamily: "Challenge Games",
    level: 5,
  },
  {
    id: "CT049",
    title: "Personalized Trick Showcase",
    orderIndex: 49,
    lessonGoal: "Verify a user-selected set of previously unlocked tricks completed in configured order.",
    visibleCheckpoint: "Dog completes a user-selected set of previously unlocked tricks in the configured order.",
    tutorialSteps: ["Select previously unlocked tricks for the showcase.", "Prepare activity-specific references when selected tricks require them.", "Use activity-appropriate camera angles and FPS.", "Begin recording before the first selected trick.", "Stop within the 45-second maximum."],
    cameraAngle: "ACTIVITY_APPROPRIATE_SHOWCASE",
    setupInstructions: ["Activity-appropriate camera angle must be used.", "Component-appropriate references and FPS must be used.", "Maximum clip duration is 45 seconds.", "No physical forcing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["Activity-specific registered references are required only when the selected tricks require them; missing or mismatched required references return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 45,
    passCriteria: ["Dog matches DOG_PROFILE.", "Every selected trick visibly completes.", "Order matches configured showcase.", "Required objects match saved references.", "No physical forcing occurs."],
    failCriteria: ["Any required trick clearly fails.", "Wrong trick order.", "Required object mismatch.", "Owner physically guides dog."],
    needsReviewCriteria: ["Any trick hidden.", "Order unclear.", "Required object missing.", "Clip too long or too short to score reliably."],
    outOfScopeClaims: ["Do not claim broad mastery outside submitted clip.", "Do not infer all tricks are reliable."],
    safetyNotes: ["Choose safe previously unlocked tricks.", "Stop before fatigue or frustration."],
    prerequisiteActivityIds: ["CT046", "CT047", "CT048", "CT044", "CT043"],
    nextActivityId: "CT050",
    orderedVisibleActions: ["Target dog and required setup for selected showcase tricks are visible before showcase starts.", "Each selected trick begins in configured order.", "Every selected trick visibly completes.", "Required reference objects match when applicable.", "No physical forcing occurs."],
    skillFamily: "Challenge Games",
    level: 5,
  },
  {
    id: "CT050",
    title: "Cool-Tricks Final Routine",
    orderIndex: 50,
    lessonGoal: "Verify a clearly segmented final routine with body-position, movement, object or platform, combo, and showcase trick segments.",
    visibleCheckpoint: "A clearly segmented single clip or short clip set contains one body-position trick, one movement trick, one object or platform trick, one combo sequence, and one user-selected showcase trick.",
    tutorialSteps: ["Choose safe previously unlocked tricks for each required segment.", "Prepare activity-specific saved references for selected components.", "Record clearly segmented clips or one clearly segmented recording.", "Use component-appropriate FPS and cue audio where timing matters.", "Keep combined duration within 60 seconds."],
    cameraAngle: "SEGMENTED_ACTIVITY_APPROPRIATE_FINAL_ROUTINE",
    setupInstructions: ["Clearly segmented clips or one clearly segmented recording are required.", "Activity-specific saved references must be present for selected components.", "Audio is required where cue timing matters.", "Maximum combined duration is 60 seconds.", "Dog identity must remain clear."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["Activity-specific registered references are required only when selected components require them; missing or mismatched required references return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 15,
    maxClipSeconds: 60,
    passCriteria: ["Dog matches DOG_PROFILE.", "Every required segment passes.", "Saved reference objects match.", "Dog identity remains clear.", "No unsafe handling or forced positioning occurs."],
    failCriteria: ["Any required trick clearly fails.", "Object mismatch occurs.", "Forced positioning occurs.", "Required segment is missing."],
    needsReviewCriteria: ["Segment unclear.", "Dog hidden.", "Required asset missing.", "Sequence order unclear.", "Clip too ambiguous."],
    outOfScopeClaims: ["Do not claim complete trick mastery.", "Do not infer routine reliability outside the submitted clip."],
    safetyNotes: ["Use only safe previously unlocked tricks.", "Stop before fatigue or frustration.", "Avoid unsafe props or surfaces."],
    prerequisiteActivityIds: ["CT046", "CT049"],
    nextActivityId: null,
    orderedVisibleActions: ["Target dog and all required component setups are visible in a clearly segmented final routine.", "One body-position trick segment completes.", "One movement trick segment completes.", "One object or platform trick segment completes.", "One combo sequence completes.", "One user-selected showcase trick completes without unsafe handling or forced positioning."],
    skillFamily: "Final Trick Routine",
    level: 5,
  },
];

export const CT041_CT050: BatchActivity[] = SPECS.map(makeActivity);
