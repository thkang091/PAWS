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
  "Gemini may verify only visible or audible evidence from the submitted clip.",
  "Allowed observations include dog entry, boundary holds, resting posture, owner movement, doorway interaction, frame exit or return, safe-zone exit, visible pacing, visible scratching, and audible vocalization when audio is present.",
  "Forbidden claims include dog feels calm, dog feels safe, dog is comfortable alone, dog has or does not have separation anxiety, dog is cured, dog can be left alone indefinitely, or behavior will generalize beyond submitted clip.",
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
${spec.audioRequired ? "Audio is required. If the release cue or required cue timing is missing or unusable, return NEEDS_REVIEW." : "Audio is optional. Audible vocalization may be noted only when audio is present; missing optional audio is not FAIL."}

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
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, required audio when applicable, relevant action visible from start to finish, required saved references matching visible dog and objects, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;

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
    whyItMatters: "This activity verifies a narrow visible calm-alone-time step without inferring feelings, anxiety status, or generalization outside the submitted evidence.",
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
    xpReward: spec.orderIndex >= 39 ? 170 : spec.orderIndex >= 35 ? 165 : 160,
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
    id: "CA031",
    title: "Crate Entry -> Owner Step-Away",
    orderIndex: 31,
    lessonGoal: "Teach the dog to voluntarily enter the registered open crate and remain inside while owner steps away.",
    visibleCheckpoint: "Dog voluntarily enters registered open TARGET_CRATE and remains inside while owner visibly steps away a short distance.",
    tutorialSteps: ["Use the registered TARGET_CRATE.", "Keep crate entrance, open door, dog, and owner visible.", "Begin with dog outside crate.", "Record voluntary entry before owner step-away.", "Owner steps away while crate door remains open."],
    cameraAngle: "CRATE_ENTRANCE_OPEN_DOOR_DOG_AND_OWNER",
    setupInstructions: ["Crate entrance must be visible.", "Crate door must be visibly open.", "Dog and owner must be visible.", "Owner step-away movement must be visible.", "No blocking or restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CRATE"],
    conditionalReferenceRules: ["Visible crate must match saved TARGET_CRATE photos; unclear crate identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Crate matches TARGET_CRATE.", "Dog begins outside crate.", "Dog voluntarily enters.", "Owner visibly steps away.", "Dog remains inside crate during step-away.", "Crate door remains open.", "No blocking or restraint occurs."],
    failCriteria: ["Dog does not enter crate.", "Dog exits immediately during step-away.", "Owner pushes dog inside.", "Owner physically blocks exit.", "Crate door closes."],
    needsReviewCriteria: ["Crate entrance cropped.", "Owner movement hidden.", "Dog hidden.", "Crate identity unclear.", "Door position unclear.", "Timing unclear."],
    outOfScopeClaims: ["Do not claim crate comfort.", "Do not infer emotional safety.", "Do not claim alone-time readiness."],
    safetyNotes: ["Keep crate door open.", "Never force crate entry.", "Do not block exit."],
    prerequisiteActivityIds: ["CA008", "CA017"],
    nextActivityId: "CA032",
    orderedVisibleActions: ["Target dog starts outside registered open TARGET_CRATE.", "Dog voluntarily enters crate.", "Owner visibly steps away a short distance.", "Dog remains inside crate with door open and no blocking."],
    skillFamily: "Crate Owner-Distance",
    level: 4,
  },
  {
    id: "CA032",
    title: "Settle While Owner Stands Up",
    orderIndex: 32,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary in resting posture while owner stands up.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary in visible resting posture while owner visibly stands up.",
    tutorialSteps: ["Use the registered safe-zone boundary.", "Keep dog, owner, and safe-zone boundary visible.", "Begin with dog in a visible resting posture.", "Owner visibly stands up.", "Reward after the dog remains inside without restraint."],
    cameraAngle: "DOG_OWNER_AND_SAFE_ZONE_BOUNDARY",
    setupInstructions: ["Dog, owner, and safe-zone boundary must be visible.", "Dog posture must be visible.", "Owner stand-up transition must be visible.", "No physical restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Safe zone matches registered reference.", "Dog begins in visible resting posture.", "Owner stands up visibly.", "Dog remains inside boundary.", "No physical restraint occurs."],
    failCriteria: ["Dog exits safe zone during owner movement.", "Dog is physically held in place.", "Owner movement does not occur."],
    needsReviewCriteria: ["Dog posture hidden.", "Owner cropped.", "Safe-zone boundary cropped.", "Transition unclear."],
    outOfScopeClaims: ["Do not infer emotional calmness.", "Do not claim comfort.", "Do not claim separation tolerance."],
    safetyNotes: ["Keep movement small.", "Do not restrain the dog."],
    prerequisiteActivityIds: ["CA012"],
    nextActivityId: "CA033",
    orderedVisibleActions: ["Target dog begins inside matched registered safe-zone boundary in visible resting posture.", "Owner is visible near the dog.", "Owner visibly stands up.", "Dog remains inside boundary without restraint."],
    skillFamily: "Owner Movement While Settled",
    level: 4,
  },
  {
    id: "CA033",
    title: "Settle While Owner Walks Across Room",
    orderIndex: 33,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner walks across the room.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary in visible resting posture while owner walks across the room.",
    tutorialSteps: ["Use the registered safe-zone boundary.", "Keep dog, owner route, and safe zone visible.", "Begin with dog inside zone in visible resting posture.", "Owner walks across the room.", "Do not block or restrain the dog."],
    cameraAngle: "DOG_OWNER_ROUTE_AND_SAFE_ZONE",
    setupInstructions: ["Dog, owner route, and safe zone must be visible.", "Resting posture must be established.", "Owner walk across room must be visible.", "No physical blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins inside safe zone.", "Visible resting posture is established.", "Owner walks across room.", "Dog remains inside zone.", "No restraint occurs."],
    failCriteria: ["Dog follows owner out of safe zone.", "Owner physically blocks dog.", "Dog leaves boundary before owner route completes."],
    needsReviewCriteria: ["Owner route hidden.", "Dog cropped.", "Safe-zone boundary hidden.", "Posture unclear."],
    outOfScopeClaims: ["Do not claim alone-time tolerance.", "Do not infer emotional state.", "Do not claim behavior generalizes."],
    safetyNotes: ["Use a safe clear room.", "Do not block exit.", "Keep route simple."],
    prerequisiteActivityIds: ["CA032"],
    nextActivityId: "CA034",
    orderedVisibleActions: ["Target dog begins inside matched safe-zone boundary in visible resting posture.", "Owner route across room is visible.", "Owner walks across room.", "Dog remains inside zone without restraint."],
    skillFamily: "Owner Movement While Settled",
    level: 4,
  },
  {
    id: "CA034",
    title: "Settle While Owner Touches Doorway",
    orderIndex: 34,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner touches an interior doorway.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner walks to and visibly touches an interior doorway.",
    tutorialSteps: ["Use the registered safe-zone boundary.", "Keep dog, owner, safe zone, and doorway visible.", "Begin with dog inside the safe zone.", "Owner walks to and touches doorway or door handle area.", "Do not physically block the dog."],
    cameraAngle: "DOG_OWNER_SAFE_ZONE_AND_DOORWAY",
    setupInstructions: ["Dog, owner, safe zone, and doorway must be visible.", "Owner hand or doorway-touch area must be visible.", "Doorway touch must be scorable.", "No physical blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog starts inside safe zone.", "Owner reaches doorway.", "Owner visibly touches doorway or door handle area.", "Dog remains inside safe zone.", "No restraint occurs."],
    failCriteria: ["Dog exits zone and follows owner.", "Doorway-touch step does not occur.", "Owner physically blocks dog."],
    needsReviewCriteria: ["Doorway cropped.", "Owner hand hidden.", "Safe zone hidden.", "Dog hidden.", "Action unclear."],
    outOfScopeClaims: ["Do not infer emotional state.", "Do not claim departure readiness.", "Do not claim treatment success."],
    safetyNotes: ["Use an interior doorway.", "Do not practice near unsafe exits.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA033"],
    nextActivityId: "CA035",
    orderedVisibleActions: ["Target dog starts inside matched safe-zone boundary.", "Owner and interior doorway are visible.", "Owner reaches and touches doorway or handle area.", "Dog remains inside safe zone without restraint."],
    skillFamily: "Doorway Movement While Settled",
    level: 4,
  },
  {
    id: "CA035",
    title: "Settle While Owner Opens Interior Door",
    orderIndex: 35,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner opens an interior door.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner visibly opens an interior door.",
    tutorialSteps: ["Use the registered safe-zone boundary and an interior door.", "Keep dog, owner, safe zone, doorway, and door motion visible.", "Begin with dog inside safe zone.", "Owner opens the interior door.", "Avoid physical blocking or restraint."],
    cameraAngle: "DOG_OWNER_SAFE_ZONE_DOORWAY_AND_DOOR_MOTION",
    setupInstructions: ["Dog, owner, safe zone, doorway, and door motion must be visible.", "Dog must begin inside safe zone.", "Door motion must be scorable.", "No blocking or restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins inside safe zone.", "Owner reaches doorway.", "Door visibly opens.", "Dog remains inside safe zone.", "No blocking or restraint occurs."],
    failCriteria: ["Dog exits safe zone during door opening.", "Owner physically blocks dog.", "Door motion does not occur."],
    needsReviewCriteria: ["Door motion hidden.", "Doorway cropped.", "Dog hidden.", "Zone boundary unclear.", "Timing unclear."],
    outOfScopeClaims: ["Do not claim departure tolerance.", "Do not infer emotional state.", "Do not claim long-term alone-time readiness."],
    safetyNotes: ["Use an interior door.", "Do not practice near unsafe exits.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA034"],
    nextActivityId: "CA036",
    orderedVisibleActions: ["Target dog begins inside matched safe-zone boundary.", "Owner, doorway, and door are visible.", "Owner opens interior door.", "Dog remains inside safe-zone boundary without blocking or restraint."],
    skillFamily: "Doorway Movement While Settled",
    level: 4,
  },
  {
    id: "CA036",
    title: "Settle While Owner Exits Doorway Briefly",
    orderIndex: 36,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner briefly exits through an interior doorway and returns.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner opens an interior door, briefly exits through doorway, and visibly returns.",
    tutorialSteps: ["Use the registered safe zone and an interior doorway.", "Keep safe zone, dog, doorway, and owner visible before exit and after return.", "Begin with dog inside the safe zone.", "Owner briefly exits through doorway and returns.", "Do not block or restrain the dog."],
    cameraAngle: "SAFE_ZONE_DOG_DOORWAY_AND_OWNER_EXIT_RETURN",
    setupInstructions: ["Safe zone, dog, doorway, and owner must be visible before exit and after return.", "Owner exit through doorway must be visible.", "Return must be visible.", "No blocking or restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 12,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins inside safe zone.", "Owner exits through doorway briefly.", "Owner returns visibly.", "Dog remains inside safe-zone boundary.", "No blocking or restraint occurs."],
    failCriteria: ["Dog exits zone before owner returns.", "Owner never exits doorway.", "Owner physically blocks dog."],
    needsReviewCriteria: ["Doorway hidden.", "Owner return cropped.", "Dog hidden.", "Safe-zone boundary cropped.", "Exit duration unclear."],
    outOfScopeClaims: ["Do not infer separation-anxiety improvement.", "Do not infer emotional state.", "Do not claim treatment success."],
    safetyNotes: ["Use an interior doorway.", "Keep exit brief.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA035"],
    nextActivityId: "CA037",
    orderedVisibleActions: ["Target dog begins inside matched safe-zone boundary.", "Owner opens or uses interior doorway.", "Owner briefly exits through doorway.", "Owner returns visibly.", "Dog remains inside boundary without blocking."],
    skillFamily: "Doorway Movement While Settled",
    level: 4,
  },
  {
    id: "CA037",
    title: "Enrichment -> Owner Exits Frame",
    orderIndex: 37,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary with registered enrichment visible while owner briefly exits frame.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary with registered enrichment CUSTOM_OBJECT visible while owner exits frame briefly.",
    tutorialSteps: ["Use registered enrichment CUSTOM_OBJECT and safe zone.", "Keep dog, safe zone, enrichment object, and owner visible before exit.", "Begin with dog inside the safe-zone boundary.", "Owner briefly exits frame.", "Keep object visible enough to confirm setup."],
    cameraAngle: "DOG_SAFE_ZONE_ENRICHMENT_AND_OWNER_EXIT",
    setupInstructions: ["Dog, safe zone, enrichment object, and owner must be visible before exit.", "Enrichment object must remain visible enough to confirm setup.", "Owner exit must be visible.", "No restraint or blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "CUSTOM_OBJECT"],
    conditionalReferenceRules: [safeZoneReferenceRule, "Registered enrichment object must match saved CUSTOM_OBJECT photos; unclear object identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 12,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Enrichment object matches saved reference.", "Safe zone matches saved reference.", "Dog remains inside boundary.", "Owner exits frame.", "No restraint occurs.", "Object remains visible enough to confirm setup."],
    failCriteria: ["Dog exits safe zone before owner returns or clip ends.", "Enrichment object is absent.", "Owner physically blocks dog.", "Wrong object is used."],
    needsReviewCriteria: ["Enrichment object hidden.", "Safe-zone boundary cropped.", "Dog hidden.", "Owner exit unclear.", "Object identity unclear."],
    outOfScopeClaims: ["Do not claim enrichment reduces anxiety.", "Do not infer emotional comfort.", "Do not claim treatment success."],
    safetyNotes: ["Use supervised dog-safe enrichment.", "Do not block exit.", "Remove unsafe items."],
    prerequisiteActivityIds: ["CA015", "CA021"],
    nextActivityId: "CA038",
    orderedVisibleActions: ["Target dog starts inside matched safe-zone boundary with registered enrichment CUSTOM_OBJECT visible.", "Owner is visible before exit.", "Owner exits frame briefly.", "Dog remains inside boundary and object remains visible enough to confirm setup."],
    skillFamily: "Enrichment Owner-Distance",
    level: 4,
  },
  {
    id: "CA038",
    title: "Enrichment -> Owner Returns",
    orderIndex: 38,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary with enrichment visible while owner exits frame and returns.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary with registered enrichment object visible while owner exits frame briefly and then returns.",
    tutorialSteps: ["Use registered enrichment CUSTOM_OBJECT and safe zone.", "Keep dog, safe zone, enrichment object, and owner visible before exit and after return.", "Begin with dog inside the safe zone.", "Owner exits frame briefly.", "Owner returns visibly."],
    cameraAngle: "DOG_SAFE_ZONE_ENRICHMENT_OWNER_EXIT_RETURN",
    setupInstructions: ["Dog, safe zone, enrichment object, and owner must be visible before exit and after return.", "Owner exit and return must be scorable.", "Enrichment object identity must be visible.", "No restraint or blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "CUSTOM_OBJECT"],
    conditionalReferenceRules: [safeZoneReferenceRule, "Registered enrichment object must match saved CUSTOM_OBJECT photos; unclear object identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 15,
    maxClipSeconds: 30,
    passCriteria: ["Dog matches DOG_PROFILE.", "Enrichment object matches saved reference.", "Dog remains inside zone.", "Owner exits frame.", "Owner visibly returns.", "No restraint occurs."],
    failCriteria: ["Dog exits zone before return.", "Owner does not return.", "Enrichment object missing.", "Physical blocking occurs."],
    needsReviewCriteria: ["Return hidden.", "Enrichment object cropped.", "Safe-zone boundary hidden.", "Dog hidden.", "Timing unclear."],
    outOfScopeClaims: ["Do not infer emotional response to owner return.", "Do not claim enrichment reduces anxiety.", "Do not claim comfort."],
    safetyNotes: ["Use supervised dog-safe enrichment.", "Keep absence brief.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA037"],
    nextActivityId: "CA039",
    orderedVisibleActions: ["Target dog starts inside matched safe-zone boundary with registered enrichment CUSTOM_OBJECT visible.", "Owner exits frame briefly.", "Dog remains inside zone.", "Owner visibly returns.", "No restraint or blocking occurs."],
    skillFamily: "Enrichment Owner-Distance",
    level: 4,
  },
  {
    id: "CA039",
    title: "Safe-Zone Entry -> Hold -> Release",
    orderIndex: 39,
    lessonGoal: "Teach the dog to enter the registered safe zone, hold for a configured interval, and exit only after release cue.",
    visibleCheckpoint: "Dog begins outside registered safe zone, voluntarily enters, remains inside for configured visible hold interval, and exits only after audible release cue.",
    tutorialSteps: ["Use the registered safe zone.", "Keep full boundary, dog, and owner visible.", "Begin with dog outside boundary.", "Record voluntary entry and configured hold interval.", "Give an audible release cue before dog exits."],
    cameraAngle: "FULL_SAFE_ZONE_BOUNDARY_DOG_AND_OWNER",
    setupInstructions: ["Full safe-zone boundary must be visible.", "Dog and owner must be visible.", "Audio is required for release cue.", "Entry, hold, release cue, and exit must be visible.", "No physical restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: ["Dog matches DOG_PROFILE.", "Safe zone matches saved reference.", "Dog starts outside boundary.", "Dog voluntarily enters.", "Dog remains inside for configured hold duration.", "Release cue is audible.", "Dog exits only after cue.", "No physical restraint occurs."],
    failCriteria: ["Dog does not enter.", "Dog exits before hold completes.", "Dog exits before release cue.", "Owner forces dog into zone.", "Owner physically restrains dog."],
    needsReviewCriteria: ["Boundary cropped.", "Cue inaudible.", "Hold duration unclear.", "Entry hidden.", "Exit hidden.", "Dog identity unclear."],
    outOfScopeClaims: ["Do not infer emotional calmness.", "Do not claim comfort.", "Do not claim behavior generalizes."],
    safetyNotes: ["Use a stable safe zone.", "Do not force entry.", "Do not restrain the dog."],
    prerequisiteActivityIds: ["CA005"],
    nextActivityId: "CA040",
    orderedVisibleActions: ["Target dog starts outside matched registered safe-zone boundary.", "Dog voluntarily enters safe zone.", "Dog remains inside for configured visible hold interval.", "Audible release cue occurs.", "Dog exits only after cue without restraint."],
    skillFamily: "Safe-Zone Release",
    level: 4,
  },
  {
    id: "CA040",
    title: "Crate Entry -> Hold -> Release",
    orderIndex: 40,
    lessonGoal: "Teach the dog to enter the registered open crate, hold for a configured interval, and exit only after release cue.",
    visibleCheckpoint: "Dog voluntarily enters registered open crate, remains inside for configured interval while door stays open, and exits only after audible release cue.",
    tutorialSteps: ["Use the registered TARGET_CRATE.", "Keep crate entrance, open door, dog, and owner visible.", "Begin with dog outside crate.", "Record voluntary entry and configured hold interval.", "Give an audible release cue before dog exits."],
    cameraAngle: "CRATE_ENTRANCE_OPEN_DOOR_DOG_AND_OWNER",
    setupInstructions: ["Crate entrance and door must be visible.", "Dog and owner must be visible.", "Audio is required for release cue.", "Crate door must remain open.", "Entry, hold, cue, and exit must be visible."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CRATE"],
    conditionalReferenceRules: ["Visible crate must match saved TARGET_CRATE photos; unclear crate identity returns NEEDS_REVIEW."],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: ["Dog matches DOG_PROFILE.", "Crate matches TARGET_CRATE.", "Dog starts outside crate.", "Dog voluntarily enters.", "Crate door remains open.", "Dog remains inside for configured interval.", "Release cue is audible.", "Dog exits only after cue.", "No blocking or restraint occurs."],
    failCriteria: ["Dog does not enter crate.", "Dog exits early.", "Dog exits before release.", "Crate door closes.", "Owner blocks or forces dog."],
    needsReviewCriteria: ["Crate entrance hidden.", "Door position unclear.", "Audio unclear.", "Hold duration unclear.", "Dog hidden."],
    outOfScopeClaims: ["Do not claim crate comfort or alone-time readiness.", "Do not infer emotional safety.", "Do not claim behavior generalizes."],
    safetyNotes: ["Keep crate door open.", "Never force crate entry.", "Do not block exit."],
    prerequisiteActivityIds: ["CA008"],
    nextActivityId: "CA041",
    orderedVisibleActions: ["Target dog starts outside matched registered TARGET_CRATE.", "Dog voluntarily enters open crate.", "Dog remains inside for configured interval while door stays open.", "Audible release cue occurs.", "Dog exits only after cue without blocking or restraint."],
    skillFamily: "Crate Release",
    level: 4,
  },
];

export const CA031_CA040: BatchActivity[] = SPECS.map(makeActivity);
