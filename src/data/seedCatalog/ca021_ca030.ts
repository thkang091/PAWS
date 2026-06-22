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

const calmScopeRules = [
  "Gemini must verify only visible behavior within the submitted clip.",
  "Do not infer emotional state, anxiety diagnosis, treatment success, long-term tolerance, or safety outside submitted clip.",
  "Visible vocalization may be noted only when audio is present.",
];

const safeZoneReferenceRule = "Registered safe-zone reference is required: TARGET_MAT or TARGET_CRATE depending on selected safe-zone type; if the selected safe-zone boundary cannot be matched confidently, return NEEDS_REVIEW.";

const promptFor = (spec: ActivitySpec): string => `PAWS GEMINI 2.5 FLASH VERIFIER PROMPT

ACTIVITY ID
${spec.id}

ACTIVITY TITLE
${spec.title}

EXPECTED START STATE
${spec.prerequisiteActivityIds.length > 0 ? `Prerequisite activity or activities ${spec.prerequisiteActivityIds.join(", ")} have been passed. ` : ""}${spec.orderedVisibleActions[0]}

VISIBLE CHECKPOINT
${spec.visibleCheckpoint}

RECORDING SETUP
- Camera angle: ${spec.cameraAngle}
- Full dog body required: YES
- Owner or handler in frame required: YES
${list(spec.setupInstructions)}

REQUIRED SAVED REFERENCES
${list(spec.requiredReferenceAssets)}
${list(spec.conditionalReferenceRules)}

AUDIO RULE
Audio is optional. Visible vocalization may be noted only when audio is present; missing optional audio is not FAIL.

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

CALM ALONE TIME SCOPE RULES
${list(calmScopeRules)}

JSON-ONLY RESPONSE INSTRUCTION
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, relevant action visible from start to finish, required saved references matching visible dog and safe-zone object, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
    setupInstructions: spec.setupInstructions,
  };
  const prerequisiteActivityId = spec.prerequisiteActivityIds[0] ?? null;
  const activity: SeedActivity = {
    id: spec.id,
    category: "CALM_ALONE_TIME",
    sequenceNumber: spec.orderIndex,
    level: spec.level,
    title: spec.title,
    skillFamily: spec.skillFamily,
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity verifies a narrow visible owner-distance step without inferring feelings, anxiety status, or generalization outside the submitted evidence.",
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
    xpReward: spec.orderIndex >= 29 ? 155 : spec.orderIndex >= 25 ? 150 : 145,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: spec.fps,
    minClipSeconds: spec.minClipSeconds,
    maxClipSeconds: spec.maxClipSeconds,
    vlmPrompt: promptFor(spec),
  };
  return { ...activity, orderIndex: spec.orderIndex, recordingSetup: recordingRequirements, audioRequired: spec.audioRequired, fps: spec.fps, prerequisiteActivityId, nextActivityId: spec.nextActivityId, orderedVisibleActions: spec.orderedVisibleActions };
};

const exitReturnSteps = (seconds: number): string[] => [
  "Use the registered safe zone.",
  "Keep dog and safe-zone boundary visible continuously.",
  "Show owner before frame exit and after return.",
  `Owner exits camera frame for at least ${seconds} seconds.`,
  "Do not restrain or physically block the dog.",
];

const exitReturnSetup = (seconds: number): string[] => [
  "Safe zone and dog must be visible continuously.",
  "Owner must be visible before exit and after return.",
  `Owner out-of-frame interval of at least ${seconds} seconds must be scorable.`,
  "No physical blocking or restraint may occur.",
];

const exitReturnActions = (seconds: number): string[] => [
  "Target dog starts inside matched registered safe-zone boundary.",
  "Owner is visible before exit.",
  `Owner exits camera frame and remains out of frame for at least ${seconds} seconds.`,
  "Dog remains inside safe-zone boundary.",
  "Owner returns visibly without restraint or physical blocking.",
];

const SPECS: ActivitySpec[] = [
  {
    id: "CA021",
    title: "Owner Exits Frame: 5 Seconds",
    orderIndex: 21,
    lessonGoal: "Teach the dog to remain inside the registered safe zone while owner exits frame for 5 seconds.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner exits camera frame for at least 5 seconds and returns.",
    tutorialSteps: exitReturnSteps(5),
    cameraAngle: "SAFE_ZONE_DOG_AND_OWNER_EXIT_RETURN",
    setupInstructions: exitReturnSetup(5),
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 12,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Owner exits frame.", "Owner remains out of frame at least 5 seconds.", "Dog remains inside safe zone.", "Owner returns visibly.", "No restraint occurs."],
    failCriteria: ["Dog exits zone before owner returns.", "Owner returns before 5 seconds.", "Owner physically blocks dog."],
    needsReviewCriteria: ["Dog hidden.", "Boundary cropped.", "Exit duration unclear.", "Return not visible."],
    outOfScopeClaims: ["Do not infer emotional state.", "Do not infer anxiety diagnosis.", "Do not claim long-term tolerance."],
    safetyNotes: ["Use a safe interior setup.", "Keep absence brief.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA020"],
    nextActivityId: "CA022",
    orderedVisibleActions: exitReturnActions(5),
    skillFamily: "Owner Out of Frame",
    level: 3,
  },
  {
    id: "CA022",
    title: "Owner Exits Frame: 10 Seconds",
    orderIndex: 22,
    lessonGoal: "Teach the dog to remain inside the registered safe zone while owner exits frame for 10 seconds.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner exits frame for at least 10 seconds and returns.",
    tutorialSteps: exitReturnSteps(10),
    cameraAngle: "DOG_SAFE_ZONE_AND_OWNER_RETURN",
    setupInstructions: exitReturnSetup(10),
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 16,
    maxClipSeconds: 30,
    passCriteria: ["Dog matches DOG_PROFILE.", "10-second owner absence is visible.", "Dog stays inside zone.", "Owner returns.", "No restraint occurs."],
    failCriteria: ["Dog exits safe zone.", "Owner returns too early.", "Physical blocking occurs."],
    needsReviewCriteria: ["Timing unclear.", "Dog hidden.", "Zone cropped.", "Owner return hidden."],
    outOfScopeClaims: ["Do not claim comfort.", "Do not infer emotional state.", "Do not claim long-term tolerance."],
    safetyNotes: ["Use a safe interior setup.", "Do not block the dog.", "Return before increasing difficulty."],
    prerequisiteActivityIds: ["CA021"],
    nextActivityId: "CA023",
    orderedVisibleActions: exitReturnActions(10),
    skillFamily: "Owner Out of Frame",
    level: 3,
  },
  {
    id: "CA023",
    title: "Owner Exits Frame: 15 Seconds",
    orderIndex: 23,
    lessonGoal: "Teach the dog to remain inside the registered safe zone while owner exits frame for 15 seconds.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner exits frame for at least 15 seconds and returns.",
    tutorialSteps: exitReturnSteps(15),
    cameraAngle: "DOG_SAFE_ZONE_AND_OWNER_RETURN",
    setupInstructions: exitReturnSetup(15),
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 20,
    maxClipSeconds: 35,
    passCriteria: ["Dog matches DOG_PROFILE.", "15-second owner absence is visible.", "Dog stays inside zone.", "Owner returns.", "No restraint occurs."],
    failCriteria: ["Dog exits zone.", "Owner returns before duration.", "Blocking occurs."],
    needsReviewCriteria: ["Duration unclear.", "Dog cropped.", "Boundary hidden.", "Owner return missing."],
    outOfScopeClaims: ["Do not infer separation-anxiety improvement.", "Do not infer emotional state.", "Do not claim treatment success."],
    safetyNotes: ["Use a safe interior setup.", "Do not block exit.", "Keep the absence short."],
    prerequisiteActivityIds: ["CA022"],
    nextActivityId: "CA024",
    orderedVisibleActions: exitReturnActions(15),
    skillFamily: "Owner Out of Frame",
    level: 3,
  },
  {
    id: "CA024",
    title: "Owner Exits Frame: 20 Seconds",
    orderIndex: 24,
    lessonGoal: "Teach the dog to remain inside the registered safe zone while owner exits frame for 20 seconds.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner exits frame for at least 20 seconds and returns.",
    tutorialSteps: exitReturnSteps(20),
    cameraAngle: "SAFE_ZONE_DOG_AND_OWNER_RETURN",
    setupInstructions: exitReturnSetup(20),
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 1,
    minClipSeconds: 25,
    maxClipSeconds: 40,
    passCriteria: ["Dog matches DOG_PROFILE.", "Owner is absent for at least 20 seconds.", "Dog remains inside zone.", "Owner returns visibly.", "No restraint occurs."],
    failCriteria: ["Dog exits zone before return.", "Owner returns too early.", "Blocking occurs."],
    needsReviewCriteria: ["Timing unclear.", "Dog hidden.", "Boundary cropped.", "Return missing."],
    outOfScopeClaims: ["Do not infer emotional state.", "Do not infer treatment success.", "Do not claim safety outside submitted clip."],
    safetyNotes: ["Use a safe interior setup.", "Do not block the dog.", "Stop before difficulty becomes unsafe."],
    prerequisiteActivityIds: ["CA023"],
    nextActivityId: "CA025",
    orderedVisibleActions: exitReturnActions(20),
    skillFamily: "Owner Out of Frame",
    level: 3,
  },
  {
    id: "CA025",
    title: "Owner Exits Frame: 30 Seconds",
    orderIndex: 25,
    lessonGoal: "Teach the dog to remain inside the registered safe zone while owner exits frame for 30 seconds.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner exits frame for at least 30 seconds and returns.",
    tutorialSteps: exitReturnSteps(30),
    cameraAngle: "SAFE_ZONE_DOG_AND_OWNER_RETURN_LONG",
    setupInstructions: exitReturnSetup(30),
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 1,
    minClipSeconds: 35,
    maxClipSeconds: 50,
    passCriteria: ["Dog matches DOG_PROFILE.", "Owner is absent at least 30 seconds.", "Dog remains inside zone.", "Owner returns visibly.", "No restraint occurs."],
    failCriteria: ["Dog exits zone.", "Owner returns before 30 seconds.", "Physical blocking occurs."],
    needsReviewCriteria: ["Dog hidden.", "Timing unclear.", "Zone cropped.", "Return missing.", "Clip too short."],
    outOfScopeClaims: ["Do not claim long-term alone-time tolerance.", "Do not infer emotional state.", "Do not claim treatment success."],
    safetyNotes: ["Use a safe interior setup.", "Keep camera stable.", "Do not physically block the dog."],
    prerequisiteActivityIds: ["CA024"],
    nextActivityId: "CA026",
    orderedVisibleActions: exitReturnActions(30),
    skillFamily: "Owner Out of Frame",
    level: 3,
  },
  {
    id: "CA026",
    title: "Owner Returns After 5 Seconds",
    orderIndex: 26,
    lessonGoal: "Verify owner return after a 5-second frame exit while the dog remains in the registered safe zone.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner exits frame for at least 5 seconds and visibly returns.",
    tutorialSteps: exitReturnSteps(5),
    cameraAngle: "DOG_SAFE_ZONE_OWNER_EXIT_AND_RETURN",
    setupInstructions: exitReturnSetup(5),
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 12,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Owner exits frame.", "5-second absence completes.", "Dog stays inside safe zone.", "Return is visible.", "No restraint occurs."],
    failCriteria: ["Dog exits zone before return.", "Duration is not completed.", "Blocking occurs."],
    needsReviewCriteria: ["Timing unclear.", "Owner return cropped.", "Dog hidden.", "Zone cropped."],
    outOfScopeClaims: ["Do not infer dog's emotional response to return.", "Do not infer emotional state.", "Do not claim long-term tolerance."],
    safetyNotes: ["Use a safe interior setup.", "Keep absence brief.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA021"],
    nextActivityId: "CA027",
    orderedVisibleActions: exitReturnActions(5),
    skillFamily: "Owner Return",
    level: 3,
  },
  {
    id: "CA027",
    title: "Owner Returns After 10 Seconds",
    orderIndex: 27,
    lessonGoal: "Verify owner return after a 10-second frame exit while the dog remains in the registered safe zone.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner exits frame for at least 10 seconds and visibly returns.",
    tutorialSteps: exitReturnSteps(10),
    cameraAngle: "DOG_SAFE_ZONE_OWNER_EXIT_AND_RETURN",
    setupInstructions: exitReturnSetup(10),
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 16,
    maxClipSeconds: 30,
    passCriteria: ["Dog matches DOG_PROFILE.", "Owner exit and return are visible.", "10-second absence completes.", "Dog stays inside zone.", "No restraint occurs."],
    failCriteria: ["Dog exits zone.", "Owner returns early.", "Blocking occurs."],
    needsReviewCriteria: ["Duration unclear.", "Return hidden.", "Dog cropped.", "Safe zone hidden."],
    outOfScopeClaims: ["Do not infer emotional state.", "Do not claim comfort.", "Do not claim treatment success."],
    safetyNotes: ["Use a safe interior setup.", "Do not block exit.", "Keep camera stable."],
    prerequisiteActivityIds: ["CA026"],
    nextActivityId: "CA028",
    orderedVisibleActions: exitReturnActions(10),
    skillFamily: "Owner Return",
    level: 3,
  },
  {
    id: "CA028",
    title: "Owner Returns After 20 Seconds",
    orderIndex: 28,
    lessonGoal: "Verify owner return after a 20-second frame exit while the dog remains in the registered safe zone.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner exits frame for at least 20 seconds and returns.",
    tutorialSteps: exitReturnSteps(20),
    cameraAngle: "DOG_SAFE_ZONE_BOUNDARY_OWNER_RETURN",
    setupInstructions: exitReturnSetup(20),
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 1,
    minClipSeconds: 25,
    maxClipSeconds: 40,
    passCriteria: ["Dog matches DOG_PROFILE.", "Owner absence reaches 20 seconds.", "Dog remains inside zone.", "Owner return is visible.", "No restraint occurs."],
    failCriteria: ["Dog exits zone.", "Owner returns early.", "Blocking occurs."],
    needsReviewCriteria: ["Timing unclear.", "Dog hidden.", "Return cropped.", "Boundary unclear."],
    outOfScopeClaims: ["Do not infer long-term behavior change.", "Do not infer emotional state.", "Do not claim safety outside submitted clip."],
    safetyNotes: ["Use a safe interior setup.", "Do not block the dog.", "Return if the setup becomes unsafe."],
    prerequisiteActivityIds: ["CA027"],
    nextActivityId: "CA029",
    orderedVisibleActions: exitReturnActions(20),
    skillFamily: "Owner Return",
    level: 3,
  },
  {
    id: "CA029",
    title: "Place -> Owner Step-Away",
    orderIndex: 29,
    lessonGoal: "Teach the dog to enter the registered place area and remain there while owner steps away.",
    visibleCheckpoint: "Dog voluntarily enters registered place area, remains inside, and stays while owner visibly steps away.",
    tutorialSteps: ["Use the registered safe-zone place area.", "Keep dog, owner, and full place boundary visible.", "Begin before dog enters the place area.", "Owner visibly steps away after entry.", "Do not push, block, or restrain the dog."],
    cameraAngle: "DOG_OWNER_AND_FULL_PLACE_BOUNDARY",
    setupInstructions: ["Dog, owner, and full place boundary must be visible.", "Dog entry must be visible.", "Owner step-away movement must be visible.", "No restraint or physical blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Place matches registered reference.", "Dog enters voluntarily.", "Owner steps away visibly.", "Dog remains inside boundary.", "No restraint occurs."],
    failCriteria: ["Dog exits immediately.", "Owner physically blocks dog.", "Dog is pushed onto place."],
    needsReviewCriteria: ["Entry hidden.", "Owner movement cropped.", "Zone boundary hidden.", "Dog identity unclear."],
    outOfScopeClaims: ["Do not claim emotional calmness.", "Do not infer anxiety diagnosis.", "Do not claim long-term tolerance."],
    safetyNotes: ["Use a stable place area.", "Do not push or block the dog.", "Keep distance easy."],
    prerequisiteActivityIds: ["CA017"],
    nextActivityId: "CA030",
    orderedVisibleActions: ["Target dog starts outside or near matched registered place boundary.", "Dog voluntarily enters the place area.", "Owner visibly steps away.", "Dog remains inside boundary without restraint."],
    skillFamily: "Owner Step-Away",
    level: 3,
  },
  {
    id: "CA030",
    title: "Safe Zone -> Owner Step-Away",
    orderIndex: 30,
    lessonGoal: "Teach the dog to begin inside the registered safe zone and remain there while owner steps away to a short distance.",
    visibleCheckpoint: "Dog begins inside registered safe zone and remains there while owner steps away to the configured short distance.",
    tutorialSteps: ["Use the registered safe zone.", "Keep safe-zone boundary, dog, and owner visible.", "Begin with dog inside the boundary.", "Owner steps away to the configured short distance.", "Do not block or restrain the dog."],
    cameraAngle: "SAFE_ZONE_BOUNDARY_DOG_AND_OWNER",
    setupInstructions: ["Safe-zone boundary, dog, and owner must be visible.", "Owner step-away movement must be visible.", "Configured short distance must be scorable.", "No physical blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Safe zone is matched.", "Dog starts inside boundary.", "Owner visibly steps away.", "Dog remains inside safe zone.", "No restraint occurs."],
    failCriteria: ["Dog exits zone during step-away.", "Owner blocks dog physically.", "Movement setup is not completed."],
    needsReviewCriteria: ["Distance unclear.", "Owner cropped.", "Safe zone cropped.", "Dog hidden."],
    outOfScopeClaims: ["Do not infer separation tolerance.", "Do not infer emotional state.", "Do not claim safety outside submitted clip."],
    safetyNotes: ["Use a safe interior setup.", "Keep distance short.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA029"],
    nextActivityId: "CA031",
    orderedVisibleActions: ["Target dog starts inside matched registered safe-zone boundary.", "Owner and safe-zone boundary are visible.", "Owner visibly steps away to configured short distance.", "Dog remains inside boundary without restraint."],
    skillFamily: "Owner Step-Away",
    level: 3,
  },
];

export const CA021_CA030: BatchActivity[] = SPECS.map(makeActivity);
