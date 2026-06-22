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
Audio is optional. Do not fail solely because audio is absent.

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
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, relevant action visible from start to finish, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    audioRequired: false,
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
    xpReward: spec.orderIndex >= 27 ? 125 : spec.orderIndex >= 25 ? 115 : 105,
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
    audioRequired: false,
    fps: spec.fps,
    prerequisiteActivityId,
    nextActivityId: spec.nextActivityId,
    orderedVisibleActions: spec.orderedVisibleActions,
  };
};

const SPECS: ActivitySpec[] = [
  {
    id: "BW021",
    title: "Curb Pause Simulation",
    orderIndex: 21,
    lessonGoal: "Teach the dog to stop before a visible curb-like boundary line in a safe simulated setup.",
    visibleCheckpoint: "Using a safe indoor or yard boundary simulation, dog stops before visible curb-like line and waits briefly.",
    tutorialSteps: ["Create a safe visible curb-like boundary line.", "Keep owner, dog, leash, and path visible.", "Approach the boundary.", "Pause before the line.", "Reward after a brief pause without dragging."],
    cameraAngle: "WIDE_ROUTE_WITH_BOUNDARY",
    setupInstructions: ["Visible boundary line is required.", "Owner, dog, leash, and path must be visible.", "Dog paws must be visible near boundary.", "Use a safe indoor or yard simulation."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Boundary is visible.", "Dog stops before boundary.", "Brief pause is completed.", "No dragging occurs."],
    failCriteria: ["Dog crosses without pausing.", "Owner blocks or drags dog."],
    needsReviewCriteria: ["Boundary unclear.", "Dog paws hidden.", "Leash hidden.", "Timing unclear."],
    outOfScopeClaims: ["Do not claim road safety.", "Do not claim traffic reliability."],
    safetyNotes: ["Use only a safe simulated setup.", "Do not practice near active roads."],
    prerequisiteActivityIds: ["BW010"],
    nextActivityId: "BW022",
    orderedVisibleActions: ["Target dog, owner, leash, path, and visible boundary line are in frame.", "Dog approaches the boundary line.", "Dog stops before crossing the boundary.", "Dog waits briefly without owner dragging or blocking."],
    skillFamily: "Curb and Object Navigation",
    level: 2,
  },
  {
    id: "BW022",
    title: "Curb Pause Outdoors",
    orderIndex: 22,
    lessonGoal: "Teach the dog to pause before a visible curb boundary in a safe quiet outdoor sidewalk area.",
    visibleCheckpoint: "On a safe quiet outdoor sidewalk area away from active traffic, dog pauses before visible curb boundary.",
    tutorialSteps: ["Choose a safe quiet outdoor curb area away from active traffic.", "Keep dog, owner, leash, and curb visible.", "Approach the curb.", "Pause before crossing.", "Reward after the dog stops before the curb."],
    cameraAngle: "WIDE_SAFE_OUTDOOR_CURB",
    setupInstructions: ["Safe outdoor curb area must be visible.", "Dog, owner, leash, and curb must be visible.", "Dog paws should be visible near the curb.", "Setup must be away from active traffic."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Curb is visible.", "Dog stops before curb.", "Leash is visible.", "No forced blocking occurs."],
    failCriteria: ["Dog crosses curb without pause.", "Owner drags dog backward.", "Setup is visibly unsafe."],
    needsReviewCriteria: ["Curb hidden.", "Safety unclear.", "Paws hidden.", "Route cropped."],
    outOfScopeClaims: ["Do not claim traffic reliability.", "Do not claim road safety."],
    safetyNotes: ["Use a quiet safe curb area.", "Never practice near active traffic."],
    prerequisiteActivityIds: ["BW021"],
    nextActivityId: "BW023",
    orderedVisibleActions: ["Target dog, owner, leash, and safe outdoor curb are visible.", "Dog approaches the curb boundary.", "Dog pauses before the curb.", "Leash remains visible and no forced blocking occurs."],
    skillFamily: "Curb and Object Navigation",
    level: 2,
  },
  {
    id: "BW023",
    title: "Walk Past Visible Object Indoors",
    orderIndex: 23,
    lessonGoal: "Teach the dog to walk past a registered or clearly staged visible object indoors without contacting it or leaving the route.",
    visibleCheckpoint: "Dog walks past registered or clearly staged visible object indoors without contacting it or leaving route.",
    tutorialSteps: ["Place a registered or clearly staged visible object indoors.", "Keep dog, owner, leash, route, and object visible.", "Begin recording before passing the object.", "Walk past without dragging.", "Reward after passing with no contact."],
    cameraAngle: "WIDE_INDOOR_ROUTE_WITH_OBJECT",
    setupInstructions: ["Dog, owner, leash, route, and object must be visible.", "Use CUSTOM_OBJECT when a specific registered staged object is required.", "Path past the object must be visible.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Object is visible.", "Dog passes object.", "Dog remains on route.", "No contact occurs.", "No dragging occurs."],
    failCriteria: ["Dog contacts object.", "Dog leaves route toward object.", "Owner drags dog past."],
    needsReviewCriteria: ["Object hidden.", "Path cropped.", "Leash hidden.", "Object identity unclear when registration is required."],
    outOfScopeClaims: ["Do not claim generalized object neutrality.", "Do not claim outdoor reliability."],
    safetyNotes: ["Use a safe object.", "Keep route clear."],
    prerequisiteActivityIds: ["BW006"],
    nextActivityId: "BW024",
    orderedVisibleActions: ["Target dog, owner, leash, indoor route, and visible staged object are in frame.", "Dog and owner approach the object.", "Dog passes the object while staying on route.", "No contact or dragging occurs."],
    skillFamily: "Curb and Object Navigation",
    level: 2,
  },
  {
    id: "BW024",
    title: "Walk Past Visible Object Outdoors",
    orderIndex: 24,
    lessonGoal: "Teach the dog to walk past a registered or clearly staged visible object outdoors at a safe distance.",
    visibleCheckpoint: "Dog walks past a registered or clearly staged visible object outdoors at a safe distance without contacting it or leaving route.",
    tutorialSteps: ["Choose a quiet safe outdoor route.", "Place or identify a visible staged object.", "Keep dog, owner, leash, path, and object visible.", "Walk past at a safe distance.", "Reward after passing with no contact or dragging."],
    cameraAngle: "WIDE_OUTDOOR_ROUTE_WITH_OBJECT",
    setupInstructions: ["Quiet outdoor route must be visible.", "Dog, owner, leash, path, and object must be visible.", "Use CUSTOM_OBJECT when a specific registered staged object is required.", "Safe distance from object must be visible."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Object is visible.", "Safe route is visible.", "Dog passes object.", "No contact occurs.", "No dragging occurs."],
    failCriteria: ["Dog moves toward object.", "Dog contacts object.", "Owner drags dog."],
    needsReviewCriteria: ["Object hidden.", "Route safety unclear.", "Path cropped.", "Leash hidden."],
    outOfScopeClaims: ["Do not claim generalized outdoor object neutrality.", "Do not claim busy-route reliability."],
    safetyNotes: ["Use a quiet safe route.", "Avoid hazardous objects."],
    prerequisiteActivityIds: ["BW023"],
    nextActivityId: "BW025",
    orderedVisibleActions: ["Target dog, owner, leash, quiet outdoor path, and visible object are in frame.", "Dog and owner approach the object at a safe distance.", "Dog passes the object while staying on route.", "No contact or dragging occurs."],
    skillFamily: "Curb and Object Navigation",
    level: 2,
  },
  {
    id: "BW025",
    title: "Walk Around Cone",
    orderIndex: 25,
    lessonGoal: "Teach the dog and owner to walk around a registered cone and complete one visible loop or turn.",
    visibleCheckpoint: "Dog and owner walk around registered TARGET_CONE and complete one visible loop or turn around cone.",
    tutorialSteps: ["Register TARGET_CONE before recording.", "Keep cone, owner, dog, leash, and path visible.", "Approach the cone.", "Walk one loop or turn around it.", "Reward after the route is completed without dragging."],
    cameraAngle: "WIDE_ROUTE_WITH_TARGET_CONE",
    setupInstructions: ["Cone, owner, dog, leash, and path must be visible.", "Cone must match TARGET_CONE reference photos.", "Route around cone must remain visible.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CONE"],
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Cone matches TARGET_CONE.", "Dog and owner travel around cone.", "Route is completed.", "Leash remains visible.", "No dragging occurs."],
    failCriteria: ["Cone is not circled.", "Dog leaves route.", "Owner drags dog."],
    needsReviewCriteria: ["Cone cropped.", "Route hidden.", "Cone identity unclear.", "Leash hidden."],
    outOfScopeClaims: ["Do not claim generalized obstacle navigation.", "Do not infer heel skill."],
    safetyNotes: ["Use a stable cone.", "Keep the path clear."],
    prerequisiteActivityIds: ["BW012"],
    nextActivityId: "BW026",
    orderedVisibleActions: ["Target dog, owner, leash, path, and registered TARGET_CONE are visible.", "Dog and owner approach the cone.", "Dog and owner travel around the cone.", "Route completes without dragging."],
    skillFamily: "Cone and Route Skills",
    level: 2,
  },
  {
    id: "BW026",
    title: "Cone Path with Loose Leash",
    orderIndex: 26,
    lessonGoal: "Teach the dog to walk through a visible registered cone route while the leash remains slack.",
    visibleCheckpoint: "Dog walks with owner through a visible route containing registered cones while leash remains slack or without sustained tension.",
    tutorialSteps: ["Use registered TARGET_CONE references for the cone route.", "Keep multiple cones, owner, dog, and leash visible.", "Begin before entering the route.", "Walk through the route.", "Reward after route completion with no sustained pulling."],
    cameraAngle: "WIDE_CONE_ROUTE_WITH_LEASH",
    setupInstructions: ["Multiple cone route must be visible.", "Cones must match TARGET_CONE references.", "Dog, owner, and leash must be visible.", "Leash slack or lack of sustained tension must be visible."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CONE"],
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Cones are matched.", "Route is completed.", "Leash remains slack.", "No dragging occurs."],
    failCriteria: ["Sustained pulling occurs.", "Dog leaves cone route.", "Owner drags dog."],
    needsReviewCriteria: ["Cones hidden.", "Leash obscured.", "Route unclear.", "Cone identity unclear."],
    outOfScopeClaims: ["Do not claim generalized loose-leash reliability.", "Do not infer off-leash skill."],
    safetyNotes: ["Use stable cones.", "Keep route clear and low distraction."],
    prerequisiteActivityIds: ["BW025", "BW006"],
    nextActivityId: "BW027",
    orderedVisibleActions: ["Target dog, owner, leash, and registered cone route are visible.", "Dog and owner enter the cone route.", "Dog walks through the cone route with leash slack or without sustained tension.", "Route is completed without dragging."],
    skillFamily: "Cone and Route Skills",
    level: 2,
  },
  {
    id: "BW027",
    title: "Loose-Leash Quiet-Yard Route",
    orderIndex: 27,
    lessonGoal: "Teach the dog to walk a quiet-yard route with owner while the leash remains slack.",
    visibleCheckpoint: "Dog walks a visible quiet-yard route with owner while leash remains slack or without sustained tension.",
    tutorialSteps: ["Choose a safe quiet-yard route.", "Keep owner, dog, leash, and path visible.", "Begin before route starts.", "Walk the visible route.", "Reward after completion without sustained leash tension."],
    cameraAngle: "WIDE_QUIET_YARD_ROUTE",
    setupInstructions: ["Safe yard route must be visible.", "Owner, dog, leash, and path must be visible.", "Leash slack must be visible.", "Route completion must be visible."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Route is visibly completed.", "Leash remains slack.", "Dog remains with owner."],
    failCriteria: ["Sustained pulling occurs.", "Route abandonment occurs.", "Dragging occurs."],
    needsReviewCriteria: ["Leash hidden.", "Route unclear.", "Dog cropped.", "Owner cropped."],
    outOfScopeClaims: ["Do not claim sidewalk reliability.", "Do not claim busy-route reliability."],
    safetyNotes: ["Use a safe quiet yard.", "Avoid distractions that exceed the dog's skill."],
    prerequisiteActivityIds: ["BW008"],
    nextActivityId: "BW028",
    orderedVisibleActions: ["Target dog, owner, leash, and quiet-yard route are visible.", "Dog and owner begin the visible route.", "Dog travels with owner while leash remains slack.", "Route is visibly completed."],
    skillFamily: "Outdoor Loose-Leash Routes",
    level: 2,
  },
  {
    id: "BW028",
    title: "Loose-Leash Driveway Route",
    orderIndex: 28,
    lessonGoal: "Teach the dog to walk a safe driveway route with owner while the leash remains slack.",
    visibleCheckpoint: "Dog walks a safe driveway route with owner while leash remains slack or without sustained tension.",
    tutorialSteps: ["Choose a safe driveway away from moving vehicles.", "Keep dog, owner, leash, and path visible.", "Begin before route starts.", "Walk the driveway route.", "Reward after completion with no sustained pulling."],
    cameraAngle: "WIDE_SAFE_DRIVEWAY_ROUTE",
    setupInstructions: ["Safe driveway away from moving vehicles must be visible.", "Dog, owner, leash, and path must be visible.", "Leash slack must be visible.", "Unsafe vehicle movement must not be present."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Visible safe route is completed.", "Leash remains slack.", "Dog travels with owner."],
    failCriteria: ["Sustained pulling occurs.", "Owner drags dog.", "Unsafe setup is visible."],
    needsReviewCriteria: ["Driveway safety unclear.", "Leash hidden.", "Path cropped.", "Dog cropped."],
    outOfScopeClaims: ["Do not claim street-walking reliability.", "Do not claim traffic safety."],
    safetyNotes: ["Use a driveway away from moving vehicles.", "Do not practice near traffic."],
    prerequisiteActivityIds: ["BW027"],
    nextActivityId: "BW029",
    orderedVisibleActions: ["Target dog, owner, leash, and safe driveway path are visible.", "Dog and owner walk the driveway route.", "Leash remains slack or without sustained tension.", "Visible safe route is completed."],
    skillFamily: "Outdoor Loose-Leash Routes",
    level: 2,
  },
  {
    id: "BW029",
    title: "Loose-Leash Quiet-Sidewalk Route",
    orderIndex: 29,
    lessonGoal: "Teach the dog to walk a quiet safe sidewalk route while the leash remains slack.",
    visibleCheckpoint: "Dog walks a quiet safe sidewalk route while leash remains slack or without sustained tension.",
    tutorialSteps: ["Choose a quiet safe sidewalk.", "Keep dog, owner, leash, and route visible.", "Begin before route starts.", "Walk the sidewalk route.", "Reward after the dog travels with owner without sustained pulling."],
    cameraAngle: "WIDE_QUIET_SIDEWALK_ROUTE",
    setupInstructions: ["Quiet sidewalk route must be visible.", "Dog, owner, leash, and route must be visible.", "Leash slack must be visible.", "Setup must not show busy traffic exposure."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    fps: 3,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: ["Dog matches DOG_PROFILE.", "Sidewalk route is visible.", "Leash remains slack.", "Dog travels with owner."],
    failCriteria: ["Sustained pulling occurs.", "Owner drags dog.", "Setup is visibly unsafe."],
    needsReviewCriteria: ["Sidewalk safety unclear.", "Leash hidden.", "Route cropped.", "Dog cropped."],
    outOfScopeClaims: ["Do not claim busy-street reliability.", "Do not claim traffic safety."],
    safetyNotes: ["Use a quiet safe sidewalk.", "Avoid busy streets and active traffic."],
    prerequisiteActivityIds: ["BW028"],
    nextActivityId: "BW030",
    orderedVisibleActions: ["Target dog, owner, leash, and quiet sidewalk route are visible.", "Dog and owner walk the sidewalk route.", "Leash remains slack or without sustained tension.", "Dog travels with owner without dragging."],
    skillFamily: "Outdoor Loose-Leash Routes",
    level: 2,
  },
  {
    id: "BW030",
    title: "Loose-Leash Route with One Turn",
    orderIndex: 30,
    lessonGoal: "Teach the dog to complete a visible loose-leash route and follow one owner direction change.",
    visibleCheckpoint: "Dog completes a visible loose-leash route and follows one visible owner direction change.",
    tutorialSteps: ["Choose a safe visible route.", "Keep route, leash, dog, and owner visible.", "Begin before walking starts.", "Complete one visible turn.", "Reward after dog follows owner with leash slack."],
    cameraAngle: "WIDE_ROUTE_WITH_ONE_TURN",
    setupInstructions: ["Route, leash, dog, and owner must be visible.", "One turn must remain visible.", "Leash slack must be visible.", "Use 3-5 FPS for route and turn evidence."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    fps: 5,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: ["Dog matches DOG_PROFILE.", "Leash remains slack.", "Dog follows owner.", "One turn is visibly completed.", "No dragging occurs."],
    failCriteria: ["Sustained pulling occurs.", "Dog fails to follow turn.", "Owner drags dog."],
    needsReviewCriteria: ["Turn hidden.", "Leash obscured.", "Route unclear.", "Dog cropped."],
    outOfScopeClaims: ["Do not claim generalized walking reliability.", "Do not claim busy-street reliability."],
    safetyNotes: ["Use a safe route.", "Do not drag dog through the turn."],
    prerequisiteActivityIds: ["BW029", "BW012"],
    nextActivityId: "BW031",
    orderedVisibleActions: ["Target dog, owner, leash, and route are visible before walking starts.", "Dog and owner walk with leash slack or without sustained tension.", "Owner completes one visible direction change.", "Dog follows the turn without dragging."],
    skillFamily: "Outdoor Loose-Leash Routes",
    level: 2,
  },
];

export const BW021_BW030: BatchActivity[] = SPECS.map(makeActivity);
