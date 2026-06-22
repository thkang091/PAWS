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

AUDIO RULE
${spec.audioRequired ? "Audio is required. If required cue timing is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is judged. Do not fail solely because audio is absent."}

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
    hipsRequired: ["CT011", "CT012", "CT013", "CT020"].includes(spec.id),
    ownerRequiredInFrame: spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")),
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: ["CT014", "CT015", "CT016", "CT020"].includes(spec.id),
    destinationRequiredInFrame: ["CT011", "CT012", "CT013", "CT014", "CT015", "CT016", "CT017", "CT018", "CT019", "CT020"].includes(spec.id),
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
    whyItMatters: "This activity verifies one visible trick behavior in the submitted clip without claiming generalized performance.",
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
    xpReward: spec.orderIndex >= 18 ? 135 : spec.orderIndex >= 14 ? 125 : 120,
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
    id: "CT011",
    title: "Back Up: 4 Steps",
    orderIndex: 11,
    lessonGoal: "Teach the dog to visibly move backward for at least four consecutive steps.",
    visibleCheckpoint: "Dog visibly moves backward for at least 4 consecutive steps.",
    tutorialSteps: ["Choose a clear non-slip route.", "Use a side or rear full-body view.", "Keep dog paws and backward route visible.", "Begin recording before backward movement starts.", "Reward after at least four backward steps without pushing."],
    cameraAngle: "SIDE_OR_REAR_FULL_BODY_BACKUP_ROUTE",
    setupInstructions: ["Dog paws and backward route must be visible.", "Recording must begin before backward movement starts.", "Dog must remain generally facing forward while backing up.", "No physical pushing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins visible.", "At least 4 backward steps occur.", "Dog remains generally facing forward while backing up.", "No physical pushing occurs."],
    failCriteria: ["Fewer than 4 backward steps occur.", "Dog turns around instead of backing up.", "Dog moves forward.", "Owner physically pushes dog backward."],
    needsReviewCriteria: ["Paws hidden.", "Route cropped.", "Step count unclear.", "Dog begins moving before recording starts."],
    outOfScopeClaims: ["Do not claim generalized rear-end awareness.", "Do not claim formal backup reliability."],
    safetyNotes: ["Use a clear non-slip route.", "Do not push the dog backward."],
    prerequisiteActivityIds: ["CT010"],
    nextActivityId: "CT012",
    orderedVisibleActions: ["Target dog, paws, and backward route are visible before movement.", "Dog begins backing up while generally facing forward.", "At least four consecutive backward steps occur.", "Owner does not physically push the dog."],
    skillFamily: "Movement Tricks",
    level: 2,
  },
  {
    id: "CT012",
    title: "Middle Position",
    orderIndex: 12,
    lessonGoal: "Teach the dog to move into the space between the owner's legs and end centered there.",
    visibleCheckpoint: "Dog visibly moves into the space between owner's legs and ends centered between the legs.",
    tutorialSteps: ["Stand with enough space for the dog to enter safely.", "Keep owner legs and dog path visible.", "Begin with dog outside middle position.", "Cue or lure dog into the space between legs.", "Reward when centered without pulling or lifting."],
    cameraAngle: "FRONT_REAR_OR_ANGLED_OWNER_LEGS_AND_DOG_PATH",
    setupInstructions: ["Owner legs and dog path must be visible.", "Dog must begin outside middle position.", "Final centered position must be visible.", "No pulling or lifting may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins outside middle position.", "Dog travels into the space between owner's legs.", "Final centered position is visible.", "No pulling or lifting occurs."],
    failCriteria: ["Dog does not enter between owner's legs.", "Dog stops beside owner.", "Owner physically places dog into position."],
    needsReviewCriteria: ["Owner legs cropped.", "Dog path hidden.", "Final position unclear.", "Dog body obscured."],
    outOfScopeClaims: ["Do not claim generalized handler focus.", "Do not infer comfort with all handler positions."],
    safetyNotes: ["Use enough space for the dog to enter safely.", "Do not squeeze or trap the dog."],
    prerequisiteActivityIds: ["CT001"],
    nextActivityId: "CT013",
    orderedVisibleActions: ["Target dog starts outside middle position with owner legs and path visible.", "Dog travels into the space between owner's legs.", "Dog ends centered between the legs.", "Owner does not pull, lift, or place the dog."],
    skillFamily: "Handler-Position Tricks",
    level: 2,
  },
  {
    id: "CT013",
    title: "Middle Hold: 3 Seconds",
    orderIndex: 13,
    lessonGoal: "Teach the dog to remain centered between the owner's legs for at least 3 seconds.",
    visibleCheckpoint: "Dog remains centered between owner's legs continuously for at least 3 seconds.",
    tutorialSteps: ["Keep owner legs and dog full body visible.", "Begin with dog in or entering middle position.", "Start timing once the dog is centered.", "Reward after a continuous 3-second hold.", "Do not physically hold the dog in place."],
    cameraAngle: "OWNER_LEGS_AND_FULL_DOG_BODY",
    setupInstructions: ["Owner legs and dog full body must be visible.", "Dog must be centered between legs for timing.", "Duration must be judgeable.", "No physical restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 6,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins or enters middle position.", "Dog remains centered between legs.", "Continuous 3-second hold completes.", "No physical restraint occurs."],
    failCriteria: ["Dog exits before 3 seconds.", "Dog remains only beside owner.", "Owner physically holds dog in place."],
    needsReviewCriteria: ["Dog cropped.", "Owner legs hidden.", "Duration unclear.", "Clip too short."],
    outOfScopeClaims: ["Do not infer emotional comfort.", "Do not claim sustained middle-position reliability."],
    safetyNotes: ["Give the dog space to exit after the hold.", "Do not squeeze or restrain the dog."],
    prerequisiteActivityIds: ["CT012"],
    nextActivityId: "CT014",
    orderedVisibleActions: ["Target dog and owner legs are visible with dog beginning or entering middle position.", "Dog is centered between owner's legs.", "Dog remains centered continuously for at least 3 seconds.", "Owner does not physically restrain the dog."],
    skillFamily: "Handler-Position Tricks",
    level: 2,
  },
  {
    id: "CT014",
    title: "Go Around Cone",
    orderIndex: 14,
    lessonGoal: "Teach the dog to travel around a registered cone and return to the expected side or handler area.",
    visibleCheckpoint: "Dog travels around the registered TARGET_CONE and returns to the original side or handler area.",
    tutorialSteps: ["Register the TARGET_CONE reference.", "Keep cone, dog, route, and owner visible.", "Begin recording before the dog starts around the cone.", "Cue or lure the dog around the cone.", "Reward after route completion."],
    cameraAngle: "WIDE_CONE_DOG_ROUTE_OWNER",
    setupInstructions: ["TARGET_CONE, dog, route, and owner must be visible.", "Visible cone must match saved TARGET_CONE photos.", "Dog route around cone must remain visible.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CONE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Visible cone matches TARGET_CONE.", "Dog travels around the cone.", "Dog returns to the expected side or handler area.", "No physical guidance occurs."],
    failCriteria: ["Dog does not pass around cone.", "Dog stops before completing route.", "Owner physically moves dog around cone."],
    needsReviewCriteria: ["Cone cropped.", "Dog path hidden.", "Cone identity unclear.", "Route completion unclear."],
    outOfScopeClaims: ["Do not claim generalized object-navigation skill.", "Do not infer cone cue reliability outside the clip."],
    safetyNotes: ["Use a stable lightweight cone.", "Keep route clear and non-slip."],
    prerequisiteActivityIds: ["CT001"],
    nextActivityId: "CT015",
    orderedVisibleActions: ["Target dog, registered TARGET_CONE, route, and owner are visible.", "Dog travels around the cone.", "Dog returns to the expected side or handler area.", "Owner does not physically guide the dog."],
    skillFamily: "Cone Tricks",
    level: 2,
  },
  {
    id: "CT015",
    title: "Cone Wrap Clockwise",
    orderIndex: 15,
    lessonGoal: "Teach the dog to wrap around a registered cone in a clockwise direction.",
    visibleCheckpoint: "Dog visibly wraps around registered TARGET_CONE in a clockwise direction.",
    tutorialSteps: ["Use the registered TARGET_CONE.", "Keep cone and dog route visible.", "Begin recording before the wrap starts.", "Cue or lure a clockwise wrap.", "Reward after the full wrap completes without forcing."],
    cameraAngle: "WIDE_CONE_AND_DOG_ROUTE",
    setupInstructions: ["TARGET_CONE and dog route must be visible.", "Visible cone must match saved TARGET_CONE photos.", "Clockwise direction must be judgeable.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CONE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Cone matches TARGET_CONE.", "Clockwise route is visible.", "Dog completes wrap.", "No forcing occurs."],
    failCriteria: ["Counterclockwise route only.", "Incomplete wrap.", "Owner physically guides dog."],
    needsReviewCriteria: ["Direction unclear.", "Route cropped.", "Cone hidden.", "Cone identity unclear."],
    outOfScopeClaims: ["Do not claim generalized cone wraps.", "Do not infer directional cue understanding outside the clip."],
    safetyNotes: ["Use a stable lightweight cone.", "Keep the path non-slip."],
    prerequisiteActivityIds: ["CT014"],
    nextActivityId: "CT016",
    orderedVisibleActions: ["Target dog, registered TARGET_CONE, and route are visible.", "Dog starts clockwise route around the cone.", "Dog completes the clockwise wrap.", "Owner does not physically guide the dog."],
    skillFamily: "Cone Tricks",
    level: 2,
  },
  {
    id: "CT016",
    title: "Cone Wrap Counterclockwise",
    orderIndex: 16,
    lessonGoal: "Teach the dog to wrap around a registered cone in a counterclockwise direction.",
    visibleCheckpoint: "Dog visibly wraps around registered TARGET_CONE in a counterclockwise direction.",
    tutorialSteps: ["Use the registered TARGET_CONE.", "Keep cone and dog route visible.", "Begin recording before the wrap starts.", "Cue or lure a counterclockwise wrap.", "Reward after the full wrap completes without forcing."],
    cameraAngle: "WIDE_CONE_AND_DOG_ROUTE",
    setupInstructions: ["TARGET_CONE and dog route must be visible.", "Visible cone must match saved TARGET_CONE photos.", "Counterclockwise direction must be judgeable.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CONE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Cone matches TARGET_CONE.", "Counterclockwise route is visible.", "Full wrap completes.", "No forcing occurs."],
    failCriteria: ["Clockwise route only.", "Incomplete wrap.", "Owner physically moves dog."],
    needsReviewCriteria: ["Direction unclear.", "Route hidden.", "Cone identity unclear."],
    outOfScopeClaims: ["Do not claim generalized cone wraps.", "Do not infer directional cue understanding outside the clip."],
    safetyNotes: ["Use a stable lightweight cone.", "Keep the path non-slip."],
    prerequisiteActivityIds: ["CT015"],
    nextActivityId: "CT017",
    orderedVisibleActions: ["Target dog, registered TARGET_CONE, and route are visible.", "Dog starts counterclockwise route around the cone.", "Dog completes the counterclockwise wrap.", "Owner does not physically move the dog."],
    skillFamily: "Cone Tricks",
    level: 2,
  },
  {
    id: "CT017",
    title: "Weave Through Legs: One Pass",
    orderIndex: 17,
    lessonGoal: "Teach the dog to pass through the space between the owner's legs once.",
    visibleCheckpoint: "Dog visibly passes through the space between owner's legs once.",
    tutorialSteps: ["Stand with enough space for safe movement.", "Keep owner legs and dog path visible.", "Begin with dog on one side.", "Cue or lure one pass through the legs.", "Reward after the dog emerges on the expected side."],
    cameraAngle: "OWNER_LEGS_AND_DOG_PATH",
    setupInstructions: ["Owner legs and dog path must be visible.", "Dog must begin on one side.", "Dog must emerge on expected side.", "No pulling or forcing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins on one side.", "Dog passes through owner's legs.", "Dog emerges on the expected side.", "No pulling or forcing occurs."],
    failCriteria: ["Dog walks around owner instead.", "Dog stops before passing through.", "Owner physically moves dog."],
    needsReviewCriteria: ["Path hidden by owner body.", "Dog cropped.", "Leg position unclear."],
    outOfScopeClaims: ["Do not claim full leg-weave chains.", "Do not infer handler focus outside the clip."],
    safetyNotes: ["Keep stance comfortable and stable.", "Do not trap or pull the dog through."],
    prerequisiteActivityIds: ["CT012"],
    nextActivityId: "CT018",
    orderedVisibleActions: ["Target dog starts on one side with owner legs and path visible.", "Dog passes through the space between owner's legs.", "Dog emerges on the expected side.", "Owner does not pull or force the dog."],
    skillFamily: "Leg Weave Tricks",
    level: 2,
  },
  {
    id: "CT018",
    title: "Weave Through Legs: Two Passes",
    orderIndex: 18,
    lessonGoal: "Teach the dog to complete two visible leg-weave passes in the configured order.",
    visibleCheckpoint: "Dog completes two visible leg-weave passes in the configured order.",
    tutorialSteps: ["Keep owner legs and dog route visible continuously.", "Begin recording before the first pass.", "Cue or lure the first pass.", "Cue or lure the second pass in order.", "Reward after both passes complete."],
    cameraAngle: "OWNER_LEGS_AND_CONTINUOUS_DOG_ROUTE",
    setupInstructions: ["Owner legs and dog route must be visible continuously.", "Both passes must be visible and countable.", "Configured order must be judgeable.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "First pass completes.", "Second pass completes.", "Order is visible.", "No physical guidance occurs."],
    failCriteria: ["Only one pass completes.", "Dog routes around owner instead.", "Owner pulls dog through path."],
    needsReviewCriteria: ["One pass hidden.", "Route unclear.", "Dog cropped."],
    outOfScopeClaims: ["Do not claim a finished weave routine.", "Do not infer cue fluency outside the clip."],
    safetyNotes: ["Keep stance stable.", "Avoid pulling the dog through the route."],
    prerequisiteActivityIds: ["CT017"],
    nextActivityId: "CT019",
    orderedVisibleActions: ["Target dog and owner legs are visible before the first pass.", "Dog completes the first leg-weave pass.", "Dog completes the second leg-weave pass in the configured order.", "Owner does not physically guide or pull the dog."],
    skillFamily: "Leg Weave Tricks",
    level: 2,
  },
  {
    id: "CT019",
    title: "Figure Eight",
    orderIndex: 19,
    lessonGoal: "Teach the dog to complete a visible figure-eight path around the owner's legs.",
    visibleCheckpoint: "Dog completes a visible figure-eight path around owner's legs.",
    tutorialSteps: ["Keep owner legs and dog path visible continuously.", "Begin recording before the route starts.", "Guide the dog around one leg.", "Dog crosses center and passes around the opposite leg.", "Reward after the full figure-eight route completes."],
    cameraAngle: "OWNER_LEGS_AND_FIGURE_EIGHT_PATH",
    setupInstructions: ["Owner legs and dog path must be visible continuously.", "Center crossing must be visible.", "Full route completion must be judgeable.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog passes around one leg.", "Dog crosses center.", "Dog passes around opposite leg.", "Full figure-eight route completes.", "No forcing occurs."],
    failCriteria: ["Only one side is completed.", "Route order is incorrect.", "Dog stops mid-route.", "Owner physically guides dog."],
    needsReviewCriteria: ["Dog path hidden.", "Owner legs cropped.", "Route completion unclear."],
    outOfScopeClaims: ["Do not claim a finished figure-eight trick in all settings.", "Do not infer cue fluency outside the clip."],
    safetyNotes: ["Keep stance stable.", "Do not pull the dog around legs."],
    prerequisiteActivityIds: ["CT018"],
    nextActivityId: "CT020",
    orderedVisibleActions: ["Target dog and owner legs are visible before route starts.", "Dog passes around one leg.", "Dog crosses center.", "Dog passes around the opposite leg.", "Dog completes the full figure-eight route without forcing."],
    skillFamily: "Leg Weave Tricks",
    level: 2,
  },
  {
    id: "CT020",
    title: "Platform Stand",
    orderIndex: 20,
    lessonGoal: "Teach the dog to place all four paws on a registered platform and stand briefly.",
    visibleCheckpoint: "Dog places all four paws onto registered TARGET_PLATFORM and remains standing briefly.",
    tutorialSteps: ["Use the registered TARGET_PLATFORM.", "Keep full platform and dog paws visible.", "Begin recording before the dog steps onto the platform.", "Reward after all four paws are on the platform and standing posture is visible.", "Do not lift or restrain the dog."],
    cameraAngle: "FULL_PLATFORM_AND_DOG_PAWS",
    setupInstructions: ["TARGET_PLATFORM and all dog paws must be visible.", "Visible platform must match saved TARGET_PLATFORM photos.", "Standing posture must be visible briefly.", "No lifting or restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_PLATFORM"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Platform matches TARGET_PLATFORM.", "Dog voluntarily steps onto platform.", "All four paws visibly contact platform.", "Stable standing posture is visible briefly.", "No lifting or restraint occurs."],
    failCriteria: ["Fewer than four paws are on platform.", "Dog steps off before posture is established.", "Owner lifts dog onto platform."],
    needsReviewCriteria: ["Platform cropped.", "Paws hidden.", "Platform identity unclear.", "Dog body obscured."],
    outOfScopeClaims: ["Do not infer physical fitness.", "Do not claim platform confidence in all settings."],
    safetyNotes: ["Use a stable non-slip platform.", "Keep platform height safe and comfortable."],
    prerequisiteActivityIds: ["CT005"],
    nextActivityId: "CT021",
    orderedVisibleActions: ["Target dog, registered TARGET_PLATFORM, and all paws are visible before entry.", "Dog voluntarily steps onto the platform.", "All four paws contact the platform.", "Dog remains in stable standing posture briefly without lifting or restraint."],
    skillFamily: "Platform Tricks",
    level: 2,
  },
];

export const CT011_CT020: BatchActivity[] = SPECS.map(makeActivity);
