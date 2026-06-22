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
- Owner or handler in frame required: YES
- Leash required in frame: YES
${list(spec.setupInstructions)}

SAVED REFERENCE-PHOTO RULES
${list(spec.requiredReferenceAssets)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If the release cue, U-turn cue, return cue, or required timing audio is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is being judged. If the attempt depends on cue timing and the cue is inaudible, return NEEDS_REVIEW."}

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
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, required audio when applicable, relevant action visible from start to finish, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;

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
    category: "BETTER_WALKS",
    sequenceNumber: spec.orderIndex,
    level: spec.level,
    title: spec.title,
    skillFamily: spec.skillFamily,
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity builds one observable walking foundation without claiming broader leash reliability outside the submitted clip.",
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
    xpReward: spec.orderIndex >= 17 ? 105 : spec.orderIndex >= 13 ? 95 : 90,
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
    id: "BW011",
    title: "Start Walking on Release",
    orderIndex: 11,
    lessonGoal: "Teach the dog to begin walking only after one audible release cue.",
    visibleCheckpoint: "Dog remains paused before one audible release cue and begins walking only after cue.",
    tutorialSteps: ["Set up owner, dog, leash, and path in view.", "Begin recording before the pause.", "Keep dog paused briefly.", "Give one audible release cue.", "Begin walking only after the cue."],
    cameraAngle: "WIDE_ROUTE_WITH_LEASH",
    setupInstructions: ["Owner, dog, leash, and path must be visible.", "Audio is required.", "Pause before the cue must be visible.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog remains paused before cue.", "Release cue is audible.", "Dog starts moving after cue.", "Leash remains visible.", "No dragging occurs."],
    failCriteria: ["Dog starts before cue.", "Owner drags dog into motion.", "No pause occurs."],
    needsReviewCriteria: ["Cue inaudible.", "Timing unclear.", "Dog cropped.", "Leash hidden."],
    outOfScopeClaims: ["Do not claim generalized release reliability.", "Do not claim outdoor leash manners."],
    safetyNotes: ["Use a safe path.", "Do not pull the dog into motion."],
    prerequisiteActivityIds: ["BW010"],
    nextActivityId: "BW012",
    orderedVisibleActions: ["Target dog, owner, leash, and path are visible before release.", "Dog remains paused before the cue.", "One release cue is audible.", "Dog begins walking only after the cue without dragging."],
    skillFamily: "Walking Starts and Turns",
    level: 2,
  },
  {
    id: "BW012",
    title: "Direction Change with Owner",
    orderIndex: 12,
    lessonGoal: "Teach the dog to follow the owner's visible direction change without being dragged.",
    visibleCheckpoint: "While walking, owner visibly changes direction and dog follows the new direction without being dragged.",
    tutorialSteps: ["Keep route, owner, dog, and leash visible.", "Begin recording before walking starts.", "Walk forward briefly.", "Owner changes direction visibly.", "Reward after the dog follows the new direction."],
    cameraAngle: "WIDE_ROUTE_WITH_LEASH",
    setupInstructions: ["Route, owner, dog, and leash must be visible.", "Direction change must remain in frame.", "Audio is optional.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Owner direction change is visible.", "Dog follows new direction.", "Leash remains visible.", "No dragging occurs."],
    failCriteria: ["Dog continues old direction.", "Owner drags dog around turn.", "Route is not completed."],
    needsReviewCriteria: ["Turn cropped.", "Leash hidden.", "Timing unclear.", "Dog path hidden."],
    outOfScopeClaims: ["Do not claim generalized walking reliability.", "Do not claim outdoor leash manners."],
    safetyNotes: ["Use a safe route.", "Avoid leash corrections or dragging."],
    prerequisiteActivityIds: ["BW011"],
    nextActivityId: "BW013",
    orderedVisibleActions: ["Target dog, owner, route, and leash are visible before the turn.", "Owner walks forward.", "Owner visibly changes direction.", "Dog follows the new direction without being dragged."],
    skillFamily: "Walking Starts and Turns",
    level: 2,
  },
  {
    id: "BW013",
    title: "Emergency U-Turn Indoors",
    orderIndex: 13,
    lessonGoal: "Teach the dog to follow an indoor emergency U-turn after one audible cue.",
    visibleCheckpoint: "After one audible U-turn cue indoors, owner changes direction and dog follows the new route.",
    tutorialSteps: ["Use an indoor route.", "Keep owner, dog, and leash visible.", "Begin recording before the cue.", "Give one audible U-turn cue.", "Owner turns and rewards after dog follows."],
    cameraAngle: "WIDE_INDOOR_ROUTE_WITH_LEASH",
    setupInstructions: ["Indoor route must be visible.", "Owner, dog, and leash must be visible.", "Audio is required.", "Turn timing must be visible."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Cue is audible.", "Owner turns.", "Dog follows.", "No dragging occurs."],
    failCriteria: ["Dog continues forward.", "Owner pulls dog forcefully.", "Dog does not follow turn."],
    needsReviewCriteria: ["Cue unclear.", "Route hidden.", "Leash cropped.", "Turn timing unclear."],
    outOfScopeClaims: ["Do not claim emergency reliability around hazards.", "Do not claim outdoor reliability."],
    safetyNotes: ["Use a safe indoor route.", "Do not pull the dog forcefully."],
    prerequisiteActivityIds: ["BW012"],
    nextActivityId: "BW014",
    orderedVisibleActions: ["Target dog, owner, leash, and indoor route are visible before the cue.", "One U-turn cue is audible.", "Owner changes direction.", "Dog follows the new route without dragging."],
    skillFamily: "Walking Starts and Turns",
    level: 2,
  },
  {
    id: "BW014",
    title: "Emergency U-Turn Outdoors",
    orderIndex: 14,
    lessonGoal: "Teach the dog to follow an outdoor emergency U-turn on a quiet safe route.",
    visibleCheckpoint: "On a quiet safe outdoor route, audible U-turn cue occurs, owner changes direction, and dog follows.",
    tutorialSteps: ["Use a quiet safe outdoor route.", "Keep dog, owner, leash, and route visible.", "Begin recording before the cue.", "Give one audible U-turn cue.", "Owner turns and rewards after dog follows."],
    cameraAngle: "WIDE_OUTDOOR_ROUTE_WITH_LEASH",
    setupInstructions: ["Quiet safe outdoor route must be visible.", "Dog, owner, leash, and route must be visible.", "Audio is required.", "Do not practice near traffic."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Outdoor route is visible.", "Cue is audible.", "Dog follows turn.", "Leash remains visible.", "No dragging occurs."],
    failCriteria: ["Dog does not follow.", "Sustained pulling continues.", "Owner drags dog."],
    needsReviewCriteria: ["Route safety unclear.", "Audio unclear.", "Leash hidden.", "Turn cropped."],
    outOfScopeClaims: ["Do not claim reliability around traffic.", "Do not claim generalized outdoor leash reliability."],
    safetyNotes: ["Use a quiet safe outdoor route.", "Never practice near traffic.", "Do not drag the dog."],
    prerequisiteActivityIds: ["BW013"],
    nextActivityId: "BW015",
    orderedVisibleActions: ["Target dog, owner, leash, and quiet outdoor route are visible before the cue.", "One U-turn cue is audible.", "Owner changes direction.", "Dog follows the turn without dragging."],
    skillFamily: "Walking Starts and Turns",
    level: 2,
  },
  {
    id: "BW015",
    title: "Side Switch",
    orderIndex: 15,
    lessonGoal: "Teach the dog to move from one side of the owner to the other side in the configured direction.",
    visibleCheckpoint: "Dog visibly moves from one side of the owner to the other side in the configured direction.",
    tutorialSteps: ["Keep owner legs and dog visible.", "Begin with dog on one side.", "Cue if timing is being judged.", "Dog crosses to the opposite side.", "Reward after the end position is visible."],
    cameraAngle: "MEDIUM_OWNER_LEGS_AND_DOG",
    setupInstructions: ["Owner legs and dog must be visible.", "Leash must be visible when used.", "Audio is required only when cue timing is judged.", "Side transition path must be visible."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins on one side.", "Dog crosses to opposite side.", "End position is visible.", "No dragging occurs."],
    failCriteria: ["Dog remains on same side.", "Dog circles without reaching target side.", "Owner pulls dog physically."],
    needsReviewCriteria: ["Owner legs cropped.", "Path hidden.", "Side transition unclear.", "Leash hidden when used."],
    outOfScopeClaims: ["Do not claim generalized side-switch reliability.", "Do not infer heel position."],
    safetyNotes: ["Keep the leash loose when used.", "Avoid pulling the dog physically."],
    prerequisiteActivityIds: ["BW012"],
    nextActivityId: "BW016",
    orderedVisibleActions: ["Target dog and owner legs are visible before the side switch.", "Dog begins on one side of the owner.", "Dog crosses to the opposite side in the configured direction.", "Dog reaches the visible end position without dragging."],
    skillFamily: "Walking Position Changes",
    level: 2,
  },
  {
    id: "BW016",
    title: "Behind Cue",
    orderIndex: 16,
    lessonGoal: "Teach the dog to move behind the owner from one side to the configured other side.",
    visibleCheckpoint: "Dog visibly moves behind owner from one side to the other side and reaches configured end position.",
    tutorialSteps: ["Keep owner legs, dog path, and leash visible.", "Begin with dog on one side.", "Cue if timing is being judged.", "Dog passes behind owner.", "Reward after configured end side is reached."],
    cameraAngle: "MEDIUM_OWNER_LEGS_AND_DOG",
    setupInstructions: ["Owner legs, dog path, and leash must be visible.", "Audio is required only when cue timing is judged.", "Behind-owner path must remain visible.", "No leash pulling may move the dog through the path."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins on one side.", "Dog passes behind owner.", "Dog reaches configured side.", "No dragging occurs."],
    failCriteria: ["Dog moves in front instead of behind.", "Dog fails to reach target side.", "Owner pulls dog through path."],
    needsReviewCriteria: ["Behind-owner path hidden.", "Owner body blocks view.", "Transition unclear.", "Leash hidden."],
    outOfScopeClaims: ["Do not claim generalized positioning reliability.", "Do not infer heel skill."],
    safetyNotes: ["Keep the route clear behind owner.", "Do not pull dog through the path."],
    prerequisiteActivityIds: ["BW015"],
    nextActivityId: "BW017",
    orderedVisibleActions: ["Target dog, owner legs, leash, and behind-owner path are visible before the cue.", "Dog begins on one side of owner.", "Dog passes behind owner.", "Dog reaches the configured end side without dragging."],
    skillFamily: "Walking Position Changes",
    level: 2,
  },
  {
    id: "BW017",
    title: "Sniff-Release Cue",
    orderIndex: 17,
    lessonGoal: "Teach the dog to pause before a visible sniff destination and approach only after release.",
    visibleCheckpoint: "Dog remains paused before entering a visible sniff destination and approaches only after audible release cue.",
    tutorialSteps: ["Choose a visible safe sniff destination.", "Keep dog, owner, leash, and destination visible.", "Begin recording before the pause.", "Give one audible release cue.", "Allow sniff access only after release."],
    cameraAngle: "WIDE_ROUTE_WITH_SNIFF_DESTINATION",
    setupInstructions: ["Dog, owner, leash, and sniff destination must be visible.", "Audio is required.", "Pause and approach timing must be visible.", "No physical restraint may hold the dog back."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog pauses before destination.", "Release cue is audible.", "Dog approaches only after cue."],
    failCriteria: ["Dog reaches sniff destination before cue.", "Owner restrains dog physically."],
    needsReviewCriteria: ["Destination unclear.", "Cue inaudible.", "Timing unclear.", "Leash hidden."],
    outOfScopeClaims: ["Do not infer generalized impulse control.", "Do not claim outdoor sniff reliability."],
    safetyNotes: ["Use a safe sniff destination.", "Do not physically hold dog back."],
    prerequisiteActivityIds: ["BW011"],
    nextActivityId: "BW018",
    orderedVisibleActions: ["Target dog, owner, leash, and sniff destination are visible before release.", "Dog pauses before entering the sniff destination.", "One release cue is audible.", "Dog approaches the destination only after the cue."],
    skillFamily: "Sniff Access",
    level: 2,
  },
  {
    id: "BW018",
    title: "Return from Sniffing",
    orderIndex: 18,
    lessonGoal: "Teach the dog to disengage from sniffing after one audible return cue and travel back toward owner.",
    visibleCheckpoint: "Dog begins visibly sniffing in a safe area, receives one audible return cue, disengages, and travels back toward owner.",
    tutorialSteps: ["Use a safe sniff area.", "Keep owner, dog, leash, and sniff area visible.", "Begin while dog is visibly sniffing.", "Give one audible return cue.", "Reward after dog disengages and travels toward owner."],
    cameraAngle: "WIDE_ROUTE_WITH_SNIFF_AREA",
    setupInstructions: ["Owner, dog, leash, and sniff area must be visible.", "Audio is required.", "Dog head and disengagement must be visible.", "Owner must not drag dog back."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog visibly sniffs.", "Return cue is audible.", "Dog disengages after cue.", "Dog travels toward owner."],
    failCriteria: ["Dog remains sniffing.", "Dog travels away.", "Owner drags dog back."],
    needsReviewCriteria: ["Cue unclear.", "Dog head hidden.", "Route cropped.", "Timing unclear."],
    outOfScopeClaims: ["Do not claim generalized recall.", "Do not claim reliable outdoor disengagement."],
    safetyNotes: ["Use a safe sniff area.", "Do not drag the dog back."],
    prerequisiteActivityIds: ["BW017"],
    nextActivityId: "BW019",
    orderedVisibleActions: ["Target dog, owner, leash, and safe sniff area are visible while dog is sniffing.", "One return cue is audible.", "Dog disengages from sniffing after the cue.", "Dog travels back toward owner without being dragged."],
    skillFamily: "Sniff Access",
    level: 2,
  },
  {
    id: "BW019",
    title: "Doorway Wait Before Walk",
    orderIndex: 19,
    lessonGoal: "Teach the dog to wait behind a registered doorway threshold before exiting into walk setup.",
    visibleCheckpoint: "Dog remains behind registered doorway threshold until audible release cue, then exits into walk setup.",
    tutorialSteps: ["Use the registered TARGET_DOORWAY.", "Keep dog, owner, leash, and threshold visible.", "Begin recording before the wait.", "Give one audible release cue.", "Exit into walk setup only after the cue."],
    cameraAngle: "VISIBLE_TARGET_DOORWAY_WITH_LEASH",
    setupInstructions: ["TARGET_DOORWAY threshold must be visible.", "Dog, owner, leash, and threshold must be visible.", "Audio is required.", "Dog must exit only after the cue."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Doorway matches TARGET_DOORWAY reference photos.", "Dog waits behind threshold.", "Release is audible.", "Dog exits only after cue."],
    failCriteria: ["Dog crosses early.", "Owner restrains dog.", "Dog rushes threshold before release."],
    needsReviewCriteria: ["Threshold cropped.", "Leash hidden.", "Audio unclear.", "Doorway identity unclear."],
    outOfScopeClaims: ["Do not claim exterior-door safety.", "Do not claim generalized doorway reliability."],
    safetyNotes: ["Use a safe doorway.", "Do not practice near traffic-facing exits."],
    prerequisiteActivityIds: ["BW011"],
    nextActivityId: "BW020",
    orderedVisibleActions: ["Target dog, owner, leash, and registered TARGET_DOORWAY threshold are visible before release.", "Dog waits behind threshold.", "One release cue is audible.", "Dog exits into walk setup only after the cue."],
    skillFamily: "Walk Start Safety",
    level: 2,
  },
  {
    id: "BW020",
    title: "Car-Exit Wait Before Walk",
    orderIndex: 20,
    lessonGoal: "Teach the dog to remain inside a safely parked vehicle exit boundary until release before a walk.",
    visibleCheckpoint: "From a safely parked vehicle, dog remains inside vehicle exit boundary until audible release cue and exits only afterward.",
    tutorialSteps: ["Use a safely parked vehicle only.", "Keep visible exit boundary, dog, owner, and leash in frame.", "Begin recording before release.", "Give one audible release cue.", "Allow dog to exit only after cue."],
    cameraAngle: "VISIBLE_PARKED_VEHICLE_EXIT",
    setupInstructions: ["Safely parked vehicle only.", "Vehicle exit boundary must be visible.", "Dog, owner, and leash must be visible.", "Audio is required.", "Use CUSTOM_OBJECT only if the current schema requires vehicle-area registration."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog remains inside before release.", "Cue is audible.", "Dog exits only after cue.", "Leash is visible.", "Setup is visibly safe."],
    failCriteria: ["Dog exits early.", "Owner pulls dog out.", "Setup is visibly unsafe."],
    needsReviewCriteria: ["Vehicle exit boundary hidden.", "Audio unclear.", "Leash hidden.", "Safety unclear."],
    outOfScopeClaims: ["Do not claim traffic safety.", "Do not claim generalized car-exit reliability."],
    safetyNotes: ["Use only a safely parked vehicle.", "Never practice near moving traffic.", "Keep leash attached and visible."],
    prerequisiteActivityIds: ["BW019"],
    nextActivityId: "BW021",
    orderedVisibleActions: ["Target dog, owner, leash, and safely parked vehicle exit boundary are visible before release.", "Dog remains inside the vehicle exit boundary before release.", "One release cue is audible.", "Dog exits only after the cue while leash remains visible."],
    skillFamily: "Walk Start Safety",
    level: 2,
  },
];

export const BW011_BW020: BatchActivity[] = SPECS.map(makeActivity);
