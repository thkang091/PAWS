import type { CompletedSeedActivity, SeedActivity } from "./bh001_bh010";

type BatchActivity = CompletedSeedActivity & {
  orderedVisibleActions: string[];
};

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
  conditionalReferenceRules?: string[];
  audioRequired: boolean;
  audioRuleOverride?: string;
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
  fullDogBodyRequired: boolean;
  pawsRequired: boolean;
  hipsRequired: boolean;
  ownerRequiredInFrame: boolean;
  targetObjectRequiredInFrame: boolean;
  destinationRequiredInFrame: boolean;
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
- Full dog body required: ${spec.fullDogBodyRequired ? "YES" : "NO"}
- Paws required: ${spec.pawsRequired ? "YES" : "NO"}
- Hips required: ${spec.hipsRequired ? "YES" : "NO"}
- Owner or handler in frame required: ${spec.ownerRequiredInFrame ? "YES" : "NO"}
- Target object in frame required: ${spec.targetObjectRequiredInFrame ? "YES" : "NO"}
- Destination in frame required: ${spec.destinationRequiredInFrame ? "YES" : "NO"}
${list(spec.setupInstructions)}

REQUIRED SAVED REFERENCES
${list(spec.requiredReferenceAssets)}
${spec.conditionalReferenceRules?.length ? `\nCONDITIONAL SAVED REFERENCES\n${list(spec.conditionalReferenceRules)}` : ""}

AUDIO RULE
${spec.audioRuleOverride ?? (spec.audioRequired ? "Audio is required. If the required cue, release cue, recall cue, whistle, or timing audio is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is being judged. Do not fail solely because audio is absent; return NEEDS_REVIEW only if timing cannot be judged without audio.")}

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
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. Verify only visible or audible evidence from the submitted user-uploaded dog-training video and saved reference photos. PASS requires the visible checkpoint, required audio when applicable, relevant action visible from start to finish, object-reference matches when required, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence and must never bypass Gemini review or unlock the next activity. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: spec.fullDogBodyRequired,
    pawsRequired: spec.pawsRequired,
    hipsRequired: spec.hipsRequired,
    ownerRequiredInFrame: spec.ownerRequiredInFrame,
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: spec.targetObjectRequiredInFrame,
    destinationRequiredInFrame: spec.destinationRequiredInFrame,
    setupInstructions: spec.setupInstructions,
  };
  const prerequisiteActivityId = spec.prerequisiteActivityIds[0] ?? null;
  const activity: SeedActivity = {
    id: spec.id,
    category: "SAFETY_AND_OBEDIENCE",
    sequenceNumber: spec.orderIndex,
    level: spec.level,
    title: spec.title,
    skillFamily: spec.skillFamily,
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity builds one observable safety or obedience behavior without claiming broader reliability outside the submitted clip.",
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
    xpReward: spec.orderIndex === 50 ? 150 : 135,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: spec.fps,
    minClipSeconds: spec.minClipSeconds,
    maxClipSeconds: spec.maxClipSeconds,
    vlmPrompt: promptFor(spec),
  };
  return {
    ...activity,
    orderIndex: spec.orderIndex,
    recordingSetup: recordingRequirements,
    audioRequired: spec.audioRequired,
    fps: spec.fps,
    prerequisiteActivityId,
    nextActivityId: spec.nextActivityId,
    orderedVisibleActions: spec.orderedVisibleActions,
  };
};

const SPECS: ActivitySpec[] = [
  {
    id: "SO041",
    title: "Wait Before Tossed Toy",
    orderIndex: 41,
    lessonGoal: "Teach the dog to wait before moving to a registered tossed or placed toy until an audible release cue.",
    visibleCheckpoint: "A registered TARGET_TOY is tossed or placed, the dog waits, one audible release cue occurs, and the dog moves to the toy only after the cue.",
    tutorialSteps: [
      "Use the registered TARGET_TOY.",
      "Keep the owner, dog, toy toss or placement, and toy landing area visible.",
      "Begin recording before the toy is tossed or placed.",
      "Ask for a wait without physical restraint.",
      "Give one audible release cue.",
      "Allow the dog to move to the toy only after the release cue.",
    ],
    cameraAngle: "WIDE_OWNER_DOG_AND_TOY_LANDING",
    setupInstructions: [
      "Owner, dog, toy landing area, and route to the toy must remain visible.",
      "Audio is required.",
      "The toy must match TARGET_TOY reference photos.",
      "Begin recording before the toss or placement.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Registered toy matches TARGET_TOY reference photos.",
      "Toy toss or placement is visible.",
      "Dog remains waiting before release.",
      "Release cue is audible.",
      "Dog movement to the toy begins only after the cue.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog moves to the toy before the release cue.",
      "Owner physically restrains the dog.",
      "Wrong toy is used.",
      "No visible wait occurs.",
    ],
    needsReviewCriteria: [
      "Toy landing is hidden.",
      "Release cue is inaudible.",
      "Dog route is cropped.",
      "Toy identity is unclear.",
      "Timing is unclear.",
      "Multiple dogs make identity ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized impulse control.",
      "Do not claim outdoor toy reliability.",
    ],
    safetyNotes: [
      "Use a safe toy and non-slippery surface.",
      "Do not physically hold the dog in place.",
    ],
    prerequisiteActivityIds: ["SO040"],
    nextActivityId: "SO042",
    orderedVisibleActions: [
      "Target dog, owner, registered TARGET_TOY, and toy landing area are visible before the toss or placement.",
      "The registered toy is tossed or placed while the dog remains away from it.",
      "Dog visibly waits before release.",
      "One release cue is audible.",
      "Dog moves toward the toy only after the release cue.",
    ],
    skillFamily: "Wait and Release",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "SO042",
    title: "Stay + Release",
    orderIndex: 42,
    lessonGoal: "Teach the dog to hold a configured visible position for 5 seconds and exit only after an audible release cue.",
    visibleCheckpoint: "Dog holds the configured visible position for at least 5 seconds and exits only after one audible release cue.",
    tutorialSteps: [
      "Choose a visible start position such as sit, down, or stand.",
      "Keep the dog, owner, and start position visible.",
      "Begin recording before the stay interval.",
      "Wait for a continuous 5-second hold.",
      "Give one audible release cue.",
      "Reward after the dog exits only after the cue.",
    ],
    cameraAngle: "WIDE_OWNER_AND_DOG",
    setupInstructions: [
      "Dog, owner, and start position must be visible.",
      "Audio is required.",
      "The hold interval must be visible continuously.",
      "No physical restraint may be used.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 2,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Configured position is established.",
      "Dog holds the position continuously for at least 5 seconds.",
      "Release cue is audible.",
      "Dog exits only after the release cue.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog exits before 5 seconds.",
      "Dog exits before the release cue.",
      "Owner physically restrains the dog.",
      "No start position is visible.",
    ],
    needsReviewCriteria: [
      "Start posture is unclear.",
      "Audio is unclear.",
      "Duration is unclear.",
      "Dog is cropped.",
      "Clip is too short.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized stay reliability.",
      "Do not infer impulse control outside the submitted clip.",
    ],
    safetyNotes: [
      "Use an easy familiar position.",
      "Keep the stay interval short and achievable.",
      "Do not physically hold the dog in place.",
    ],
    prerequisiteActivityIds: ["SO041"],
    nextActivityId: "SO043",
    orderedVisibleActions: [
      "Target dog and owner are visible with the dog in the configured start position.",
      "Dog remains in that visible position for at least 5 continuous seconds.",
      "One release cue is audible.",
      "Dog exits the position only after the release cue.",
    ],
    skillFamily: "Stay and Release",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: false,
  },
  {
    id: "SO043",
    title: "Stay + Owner Step-Away",
    orderIndex: 43,
    lessonGoal: "Teach the dog to remain in a visible stay while the owner steps away.",
    visibleCheckpoint: "Dog remains in the configured stay position while the owner visibly steps away and remains until release when a release cue is included.",
    tutorialSteps: [
      "Set up a short stay in a quiet safe area.",
      "Place the phone so the dog and owner movement stay visible.",
      "Begin recording before the owner steps away.",
      "Owner takes a small step away while the dog stays.",
      "If using a release cue, give one audible release before the dog exits.",
      "Reward without physical restraint.",
    ],
    cameraAngle: "WIDE_OWNER_AND_DOG",
    setupInstructions: [
      "Dog and owner must remain visible.",
      "Owner step-away movement must be visible.",
      "Audio is required when a release cue is used.",
      "No physical restraint may occur.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    audioRuleOverride: "Audio is required when a release cue is used. If release timing is part of the submitted attempt and the cue is missing or unusable, return NEEDS_REVIEW. If no release is included, judge only the visible stay during the step-away.",
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Stay position is established.",
      "Owner visibly steps away.",
      "Dog remains in place during the step-away.",
      "If release is included, dog exits only after the release cue.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog follows the owner before release.",
      "Dog exits during the step-away.",
      "Owner physically restrains the dog.",
    ],
    needsReviewCriteria: [
      "Owner route is cropped.",
      "Dog is hidden.",
      "Release audio is unclear when required.",
      "Duration is unclear.",
      "Step-away timing is unclear.",
    ],
    outOfScopeClaims: [
      "Do not infer emotional calmness.",
      "Do not claim alone-time tolerance.",
      "Do not claim generalized stay reliability.",
    ],
    safetyNotes: [
      "Use a very short step-away.",
      "Keep the dog on a non-slip surface.",
      "Do not test this near hazards.",
    ],
    prerequisiteActivityIds: ["SO042"],
    nextActivityId: "SO044",
    orderedVisibleActions: [
      "Target dog is visible in the configured stay position and owner is visible nearby.",
      "Owner visibly steps away from the dog.",
      "Dog remains in place while the owner steps away.",
      "If a release cue is included, the cue is audible before the dog exits.",
    ],
    skillFamily: "Stay and Release",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: false,
  },
  {
    id: "SO044",
    title: "Place -> Release -> Recall",
    orderIndex: 44,
    lessonGoal: "Combine a registered mat wait, audible release, and audible recall to owner.",
    visibleCheckpoint: "Dog begins on TARGET_MAT, waits, exits only after audible release, then travels to owner after audible recall.",
    tutorialSteps: [
      "Use the registered TARGET_MAT.",
      "Keep the full mat, dog, owner, and route visible.",
      "Begin with the dog on the mat.",
      "Give one audible release cue before the dog exits.",
      "Give one audible recall cue.",
      "Reward when the dog reaches the owner area.",
    ],
    cameraAngle: "WIDE_MAT_OWNER_AND_ROUTE",
    setupInstructions: [
      "Full mat, dog, owner, and route must be visible.",
      "Audio is required.",
      "Mat must match TARGET_MAT reference photos.",
      "Begin recording with the dog on the mat.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Mat matches TARGET_MAT reference photos.",
      "Dog starts on the mat and waits.",
      "Release cue is audible.",
      "Dog exits the mat after the release cue.",
      "Recall cue is audible.",
      "Dog travels to owner after recall.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog leaves the mat before the release cue.",
      "No recall occurs.",
      "Dog travels elsewhere.",
      "Owner physically guides the dog.",
    ],
    needsReviewCriteria: [
      "Mat is cropped or unclear.",
      "Audio is unclear.",
      "Route is hidden.",
      "Release timing is unclear.",
      "Recall timing is unclear.",
      "Dog identity is unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized place reliability.",
      "Do not claim generalized recall reliability.",
    ],
    safetyNotes: [
      "Use a safe indoor route.",
      "Keep distance short enough for success.",
      "Do not pull the dog from the mat.",
    ],
    prerequisiteActivityIds: ["SO043"],
    nextActivityId: "SO045",
    orderedVisibleActions: [
      "Target dog begins on the registered TARGET_MAT with owner and route visible.",
      "Dog waits on the mat.",
      "One release cue is audible.",
      "Dog exits the mat only after release.",
      "One recall cue is audible.",
      "Dog travels to the owner area after the recall cue.",
    ],
    skillFamily: "Integrated Obedience",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "SO045",
    title: "Recall Ladder",
    orderIndex: 45,
    lessonGoal: "Verify short, medium, and longer safe-distance recalls in a segmented ladder.",
    visibleCheckpoint: "A segmented clip or clip set shows short, medium, and longer safe-distance recalls where the dog reorients after each audible cue and reaches the owner each time.",
    tutorialSteps: [
      "Use a safe enclosed area or safe indoor setup.",
      "Record separate short clips or clearly segmented recalls.",
      "Keep the dog start point, route, and owner visible for every segment.",
      "Give one audible recall cue per segment.",
      "Reward each arrival.",
      "Stop if distance becomes too difficult.",
    ],
    cameraAngle: "WIDE_SAFE_RECALL_AREA",
    setupInstructions: [
      "Dog, owner, start point, and route must be visible in every segment.",
      "Audio is required.",
      "Use separate short clips when possible.",
      "Maximum combined duration is 45 seconds.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 12,
    maxClipSeconds: 45,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Recall cue is audible in every segment.",
      "Dog begins away from owner in every segment.",
      "Dog reorients after the cue in every segment.",
      "Dog reaches owner in every segment.",
      "Increasing distance is visible.",
      "Setup is safe.",
    ],
    failCriteria: [
      "Any required segment clearly fails.",
      "Dog travels away from the owner.",
      "Dog does not arrive.",
      "Motion occurs only before the cue.",
    ],
    needsReviewCriteria: [
      "A required segment is missing.",
      "Audio is unclear.",
      "Distance is unclear.",
      "Route is hidden.",
      "Safety setup is unclear.",
      "Dog identity is unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim off-leash reliability.",
      "Do not claim emergency recall reliability.",
      "Do not claim recall outside the submitted setup.",
    ],
    safetyNotes: [
      "Use a safe enclosed or indoor setup.",
      "Do not test near traffic.",
      "Keep each distance easy enough for success.",
    ],
    prerequisiteActivityIds: ["SO044"],
    nextActivityId: "SO046",
    orderedVisibleActions: [
      "Short-distance recall segment shows dog away from owner before the audible cue.",
      "Dog reorients after the short-distance cue and reaches owner.",
      "Medium-distance recall segment shows dog away from owner before the audible cue.",
      "Dog reorients after the medium-distance cue and reaches owner.",
      "Longer safe-distance recall segment shows dog away from owner before the audible cue.",
      "Dog reorients after the longer-distance cue and reaches owner.",
    ],
    skillFamily: "Recall",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: true,
  },
  {
    id: "SO046",
    title: "Whistle Recall Ladder",
    orderIndex: 46,
    lessonGoal: "Verify increasing safe-distance whistle recalls in a segmented ladder.",
    visibleCheckpoint: "A segmented clip or clip set shows increasing safe-distance whistle recalls where the dog reorients after each whistle and reaches the owner each time.",
    tutorialSteps: [
      "Use a safe enclosed area or visible long-line setup.",
      "Record separate short clips or clearly segmented whistle recalls.",
      "Keep dog, owner, route, and safe setup visible.",
      "Use one audible whistle per segment.",
      "Reward each arrival.",
      "Do not test near traffic or unsafe exits.",
    ],
    cameraAngle: "WIDE_SAFE_RECALL_AREA",
    setupInstructions: [
      "Dog, owner, route, and safe setup must be visible.",
      "Audio is required.",
      "Use component segments for increasing distances.",
      "Maximum combined duration is 45 seconds.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 12,
    maxClipSeconds: 45,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Whistle is audible in every segment.",
      "Dog reorients after the whistle in every segment.",
      "Dog travels toward owner in every segment.",
      "Dog reaches owner in every segment.",
      "Increasing distance is visible.",
    ],
    failCriteria: [
      "Any required segment clearly fails.",
      "Dog travels away from owner.",
      "Dog does not arrive.",
      "Response occurs only before whistle.",
    ],
    needsReviewCriteria: [
      "Whistle is unclear.",
      "A required segment is missing.",
      "Route is hidden.",
      "Distance is unclear.",
      "Safety setup is unclear.",
      "Dog identity is unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim off-leash whistle reliability.",
      "Do not claim emergency reliability.",
      "Do not claim recall outside the submitted setup.",
    ],
    safetyNotes: [
      "Use a safe enclosed area or visible long line.",
      "Never practice near traffic.",
      "Keep distances manageable.",
    ],
    prerequisiteActivityIds: ["SO045"],
    nextActivityId: "SO047",
    orderedVisibleActions: [
      "First whistle recall segment shows dog away from owner before the whistle.",
      "Dog reorients after the first whistle and reaches owner.",
      "Second whistle recall segment shows increased distance before the whistle.",
      "Dog reorients after the second whistle and reaches owner.",
      "Final whistle recall segment shows the longest safe distance before the whistle.",
      "Dog reorients after the final whistle and reaches owner.",
    ],
    skillFamily: "Whistle Recall",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: true,
  },
  {
    id: "SO047",
    title: "Wait -> Leave -> Recall",
    orderIndex: 47,
    lessonGoal: "Combine a wait, visible disengagement from a staged item, and audible recall to owner.",
    visibleCheckpoint: "Dog waits, visibly disengages from a visible staged item, then travels to owner after an audible recall cue.",
    tutorialSteps: [
      "Use a safe visible staged item.",
      "Register the staged item as CUSTOM_OBJECT if the object-reference flow requires it.",
      "Keep the staged item, dog, owner, and route visible.",
      "Ask for a short wait.",
      "Cue disengagement or leave-it without blocking the dog.",
      "Give one audible recall cue and reward arrival.",
    ],
    cameraAngle: "WIDE_STAGED_ITEM_OWNER_DOG_ROUTE",
    setupInstructions: [
      "Staged item, dog, owner, and route must be visible.",
      "Audio is required.",
      "Use CUSTOM_OBJECT reference photos only when the staged item is registered.",
      "No blocking, dragging, or physical restraint may occur.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [
      "CUSTOM_OBJECT is required only when the staged leave-it object is registered in the saved object-reference flow.",
      "If a registered staged object is used and identity cannot be matched confidently, return NEEDS_REVIEW.",
    ],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Wait is visible.",
      "Disengagement from the staged item is visible.",
      "Recall cue is audible.",
      "Dog travels to owner after recall.",
      "Dog arrives at owner area.",
      "No blocking or physical restraint occurs.",
    ],
    failCriteria: [
      "Dog accesses the staged item.",
      "No recall occurs.",
      "Dog travels away from owner.",
      "Owner blocks, drags, or physically restrains the dog.",
    ],
    needsReviewCriteria: [
      "Staged item is hidden.",
      "Disengagement is unclear.",
      "Recall cue is inaudible.",
      "Route is cropped.",
      "Action order is unclear.",
      "Registered object identity is unclear when applicable.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized safety behavior.",
      "Do not claim reliable leave-it outside the submitted clip.",
    ],
    safetyNotes: [
      "Use a safe staged item.",
      "Do not use dangerous food, medication, or household hazards.",
      "Do not physically block or drag the dog.",
    ],
    prerequisiteActivityIds: ["SO046"],
    nextActivityId: "SO048",
    orderedVisibleActions: [
      "Target dog, staged item, owner, and route are visible before the wait.",
      "Dog visibly waits near or before the staged item.",
      "Dog visibly disengages from the staged item without physical blocking.",
      "One recall cue is audible.",
      "Dog travels to owner and arrives after the recall cue.",
    ],
    skillFamily: "Integrated Safety",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "SO048",
    title: "Sit -> Stay -> Recall",
    orderIndex: 48,
    lessonGoal: "Combine a visible sit, stay interval, audible recall cue, travel to owner, and arrival.",
    visibleCheckpoint: "Dog sits, holds a stay interval, moves only after an audible recall cue, travels to owner, and arrives.",
    tutorialSteps: [
      "Use a safe visible route.",
      "Keep the dog hips, owner, and route visible.",
      "Ask for sit and confirm hips contact the floor.",
      "Hold a short stay interval.",
      "Give one audible recall cue.",
      "Reward after the dog reaches the owner area.",
    ],
    cameraAngle: "WIDE_OWNER_DOG_AND_ROUTE",
    setupInstructions: [
      "Dog hips, owner, and route must be visible.",
      "Audio is required.",
      "The sit and stay interval must be visible before recall.",
      "Movement must begin after the recall cue.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Sit is established with hips contacting the floor.",
      "Stay interval is visible.",
      "Recall cue is audible.",
      "Movement begins after the cue.",
      "Dog reaches owner area.",
      "No physical forcing occurs.",
    ],
    failCriteria: [
      "Sit is missing.",
      "Dog breaks stay before the cue.",
      "No recall occurs.",
      "Owner physically moves the dog.",
    ],
    needsReviewCriteria: [
      "Hips are hidden.",
      "Timing is unclear.",
      "Audio is unclear.",
      "Route is hidden.",
      "Sequence is unclear.",
      "Dog identity is unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized obedience.",
      "Do not claim recall reliability outside the submitted clip.",
    ],
    safetyNotes: [
      "Use a safe indoor or enclosed route.",
      "Do not call across slippery surfaces.",
      "Keep distance manageable.",
    ],
    prerequisiteActivityIds: ["SO047"],
    nextActivityId: "SO049",
    orderedVisibleActions: [
      "Target dog, owner, and route are visible before the sit.",
      "Dog enters or is already in a visible sit with hips on the floor.",
      "Dog holds a brief stay interval.",
      "One recall cue is audible.",
      "Dog begins moving after the recall cue.",
      "Dog reaches the owner area.",
    ],
    skillFamily: "Integrated Obedience",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: true,
  },
  {
    id: "SO049",
    title: "Obedience Sequence",
    orderIndex: 49,
    lessonGoal: "Verify an ordered sit, down, stand, brief stay, audible release, and exit sequence.",
    visibleCheckpoint: "Dog performs sit, down, stand, brief stay, then exits only after an audible release cue in the correct order.",
    tutorialSteps: [
      "Use a side full-body camera angle.",
      "Keep hips, elbows, torso, and paws visible.",
      "Cue or lure sit, down, then stand without physical forcing.",
      "Hold a brief stay after stand.",
      "Give one audible release cue.",
      "Reward after the dog exits only after the cue.",
    ],
    cameraAngle: "SIDE_FULL_BODY",
    setupInstructions: [
      "Full body, hips, elbows, torso, and paws must be visible.",
      "Audio is required.",
      "The sequence must be sit, down, stand, brief stay, release.",
      "No physical forcing may occur.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Sit posture is established.",
      "Down posture is established.",
      "Stand posture is established.",
      "Brief stay is completed.",
      "Release cue is audible.",
      "Dog exits after the cue.",
      "Order is correct.",
      "No physical forcing occurs.",
    ],
    failCriteria: [
      "A required posture is missing.",
      "Positions occur in the wrong order.",
      "Dog exits early.",
      "Owner physically moves the dog.",
    ],
    needsReviewCriteria: [
      "Required body parts are hidden.",
      "Transitions are cropped.",
      "Audio is unclear.",
      "Timing is unclear.",
      "Clip is too short.",
      "Dog identity is unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim long-term obedience.",
      "Do not claim generalized obedience outside the submitted clip.",
    ],
    safetyNotes: [
      "Use a non-slip surface.",
      "Do not physically force positions.",
      "Stop if the dog appears physically uncomfortable.",
    ],
    prerequisiteActivityIds: ["SO048"],
    nextActivityId: "SO050",
    orderedVisibleActions: [
      "Target dog is visible from a side full-body angle before the sequence.",
      "Dog establishes sit.",
      "Dog transitions to and establishes down.",
      "Dog transitions to and establishes stand.",
      "Dog holds a brief stay.",
      "One release cue is audible.",
      "Dog exits only after the release cue.",
    ],
    skillFamily: "Integrated Obedience",
    level: 5,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: false,
  },
  {
    id: "SO050",
    title: "Safety-and-Obedience Final Routine",
    orderIndex: 50,
    lessonGoal: "Verify a narrow visible safety-and-obedience routine made of passed component behaviors.",
    visibleCheckpoint: "A segmented clip or short clips include name response, sit, stay, release cue, leave-it checkpoint, recall, and either doorway wait or toy-drop checkpoint.",
    tutorialSteps: [
      "Use clearly segmented short clips or one segmented clip.",
      "Keep the dog and relevant component object references visible.",
      "Include name response, sit, stay, release cue, leave-it, recall, and doorway wait or toy drop.",
      "Use audio wherever cue timing matters.",
      "Keep the combined routine under 60 seconds.",
      "Stop and retry if any segment becomes unsafe or unclear.",
    ],
    cameraAngle: "SEGMENTED_COMPONENT_APPROPRIATE_VIEW",
    setupInstructions: [
      "Dog identity must remain clear in every segment.",
      "Use component-specific framing and FPS.",
      "Audio is required wherever cue timing matters.",
      "Maximum combined duration is 60 seconds.",
      "All selected saved object references must be visible and match their reference photos.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [
      "TARGET_TOY is required when a toy-drop component is selected.",
      "TARGET_MAT is required when a mat component is selected.",
      "TARGET_DOORWAY is required when a doorway component is selected.",
      "CUSTOM_OBJECT is required when a registered leave-it object is used.",
      "If any selected saved object reference cannot be matched confidently, return NEEDS_REVIEW.",
    ],
    audioRequired: false,
    audioRuleOverride: "Audio is required wherever cue timing matters, including name cue, release cue, recall cue, doorway release, or drop cue. If required cue timing audio is missing or unusable in any selected segment, return NEEDS_REVIEW.",
    fps: 5,
    minClipSeconds: 20,
    maxClipSeconds: 60,
    passCriteria: [
      "Dog matches DOG_PROFILE in every segment.",
      "Every required visible segment passes.",
      "All selected saved reference objects match.",
      "Required audio cues are audible.",
      "No unsafe handling occurs.",
      "No physical restraint or forced removal occurs.",
    ],
    failCriteria: [
      "Any required component clearly fails.",
      "Recall fails.",
      "Dog releases or exits early.",
      "Leave-it checkpoint fails.",
      "Doorway crossing occurs early when doorway is selected.",
      "Forced toy removal occurs when toy drop is selected.",
      "Physical restraint occurs.",
    ],
    needsReviewCriteria: [
      "A required segment is missing.",
      "Object identity is unclear.",
      "Dog identity is unclear.",
      "Required audio is missing.",
      "Action sequence is cropped.",
      "Safety setup is unclear.",
      "Component timing is unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim perfect safety.",
      "Do not claim off-leash reliability.",
      "Do not claim long-term obedience.",
      "Do not claim real-world emergency reliability outside submitted clips.",
    ],
    safetyNotes: [
      "Use safe indoor or enclosed setups.",
      "Do not test near traffic, hazards, or unsafe exits.",
      "Keep each component short and familiar.",
      "Stop if handling becomes unsafe.",
    ],
    prerequisiteActivityIds: ["SO049"],
    nextActivityId: null,
    orderedVisibleActions: [
      "Name-response segment shows one cue and visible dog orientation toward owner.",
      "Sit segment shows a visible sit with hips contacting the floor.",
      "Stay segment shows a visible hold interval.",
      "Release-cue segment shows dog exits only after an audible release.",
      "Leave-it segment shows visible disengagement from the staged item without access.",
      "Recall segment shows dog reorients after audible cue and reaches owner.",
      "Doorway wait or toy-drop segment shows the selected checkpoint pass with required saved object references when applicable.",
    ],
    skillFamily: "Final Routine",
    level: 5,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
];

export const SO041_SO050: BatchActivity[] = SPECS.map(makeActivity);
