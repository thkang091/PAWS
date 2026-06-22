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
  fullDogBodyRequired: boolean;
  pawsRequired: boolean;
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
- Owner or handler in frame required: ${spec.ownerRequiredInFrame ? "YES" : "NO"}
- Target object in frame required: ${spec.targetObjectRequiredInFrame ? "YES" : "NO"}
- Destination in frame required: ${spec.destinationRequiredInFrame ? "YES" : "NO"}
${list(spec.setupInstructions)}

REQUIRED SAVED REFERENCE PHOTOS
${list(spec.requiredReferenceAssets)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If the required cue or timing audio is missing or unusable, return NEEDS_REVIEW." : "Audio is optional for this activity. Do not fail solely because audio is absent; return NEEDS_REVIEW only if the submitted attempt depends on release timing that cannot be judged without audio."}

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
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, or semantic accuracy.`;

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: spec.fullDogBodyRequired,
    pawsRequired: spec.pawsRequired,
    hipsRequired: false,
    ownerRequiredInFrame: spec.ownerRequiredInFrame,
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: spec.targetObjectRequiredInFrame,
    destinationRequiredInFrame: spec.destinationRequiredInFrame,
    setupInstructions: spec.setupInstructions,
  };
  const prerequisiteActivityId = spec.prerequisiteActivityIds[0] ?? null;
  const activity: SeedActivity = {
    id: spec.id,
    category: "BETTER_BEHAVIOR_AT_HOME",
    sequenceNumber: spec.orderIndex,
    level: spec.level,
    title: spec.title,
    skillFamily: spec.skillFamily,
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity builds one small, observable household behavior without claiming broader reliability outside the submitted clip.",
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
    xpReward: spec.orderIndex >= 36 ? 110 : spec.orderIndex >= 33 ? 105 : 100,
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
    id: "BH031",
    title: "Leave Visible Floor Food",
    orderIndex: 31,
    lessonGoal: "Teach the dog to disengage from visible uncovered floor food without touching or consuming it.",
    visibleCheckpoint: "Dog disengages from visible uncovered floor food and does not touch or consume it.",
    tutorialSteps: [
      "Stage a small piece of visible uncovered floor food indoors.",
      "Position the camera so the food and dog nose remain visible.",
      "Begin recording before the dog approaches the food.",
      "Allow the dog to notice the food without pushing the dog away.",
      "Reward after the dog visibly disengages and does not contact the food.",
    ],
    cameraAngle: "CLOSE_DOG_NOSE_AND_OBJECT",
    setupInstructions: [
      "Food and dog nose must remain visible.",
      "Begin recording before the dog engages with the food.",
      "Audio is required only if release timing is being judged.",
      "Do not physically push the dog away from the food.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Food is visible.",
      "Dog disengages from the visible food.",
      "No contact or consumption occurs.",
    ],
    failCriteria: [
      "Dog contacts or consumes food.",
      "Dog remains persistently engaged with the food.",
      "Owner pushes dog away.",
    ],
    needsReviewCriteria: [
      "Food hidden.",
      "Dog nose hidden.",
      "Timing unclear.",
      "Multiple dogs make identity ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized leave-it reliability.",
      "Do not claim outdoor reliability.",
      "Do not infer food guarding status.",
    ],
    safetyNotes: [
      "Use dog-safe food.",
      "Keep the setup low pressure.",
      "Stop if guarding behavior appears.",
    ],
    prerequisiteActivityIds: ["BH030"],
    nextActivityId: "BH032",
    orderedVisibleActions: [
      "Target dog, dog nose, and visible uncovered floor food are in frame before engagement.",
      "Dog notices or approaches the visible food.",
      "Dog visibly disengages from the food.",
      "Food is not touched or consumed during the clip.",
    ],
    skillFamily: "Leave It Foundations",
    level: 3,
    fullDogBodyRequired: false,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: false,
  },
  {
    id: "BH032",
    title: "Walk Past Visible Food Indoors",
    orderIndex: 32,
    lessonGoal: "Teach the dog to walk past staged floor food indoors without touching or consuming it.",
    visibleCheckpoint: "Dog walks past visible staged floor food indoors without touching or consuming it.",
    tutorialSteps: [
      "Stage visible dog-safe floor food along a short indoor route.",
      "Position the camera so the route, owner, dog, and food are visible.",
      "Begin recording before the dog starts the route.",
      "Walk past the food without dragging the dog.",
      "Reward after the dog completes the visible path without accessing the food.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Route, owner, dog, and staged food must be visible.",
      "Leash must be visible when used.",
      "Path past the food must be visible from start to finish.",
      "Do not drag the dog past the food.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Dog passes the food area.",
      "Food remains untouched.",
      "Visible path is completed.",
    ],
    failCriteria: [
      "Dog accesses food.",
      "Dog leaves route to consume food.",
      "Owner drags dog past food.",
    ],
    needsReviewCriteria: [
      "Food hidden.",
      "Path cropped.",
      "Dog route unclear.",
      "Multiple dogs make identity ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not claim outdoor reliability.",
      "Do not claim generalized leave-it reliability.",
    ],
    safetyNotes: [
      "Use dog-safe food.",
      "Keep the route short.",
      "Avoid leash tension that drags the dog.",
    ],
    prerequisiteActivityIds: ["BH031"],
    nextActivityId: "BH033",
    orderedVisibleActions: [
      "Target dog, owner, indoor route, and visible staged food are in frame before movement begins.",
      "Dog travels along the route past the staged food.",
      "Dog completes the visible path.",
      "Food remains untouched and unconsumed.",
    ],
    skillFamily: "Leave It Foundations",
    level: 3,
    fullDogBodyRequired: true,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH033",
    title: "Settle Beside Owner: 10 Seconds",
    orderIndex: 33,
    lessonGoal: "Teach the dog to remain in a visible resting posture beside the owner for at least 10 seconds.",
    visibleCheckpoint: "Dog remains in a visible resting posture beside the owner for at least 10 seconds.",
    tutorialSteps: [
      "Choose a quiet spot beside the owner.",
      "Position the camera so the dog and owner remain visible continuously.",
      "Begin recording before the settle interval starts.",
      "Allow the dog to enter a resting posture beside the owner.",
      "Reward after a continuous 10-second visible resting interval.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Dog and owner must remain visible continuously.",
      "Resting posture must be visible.",
      "The 10-second interval must be visible from start to finish.",
      "No physical restraint may hold the dog in place.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 14,
    maxClipSeconds: 25,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Dog is beside owner.",
      "Resting posture is visible.",
      "Continuous 10-second interval is completed.",
      "No restraint occurs.",
    ],
    failCriteria: [
      "Dog leaves owner area before 10 seconds.",
      "Dog does not enter resting posture.",
      "Owner restrains dog.",
    ],
    needsReviewCriteria: [
      "Dog hidden.",
      "Owner cropped.",
      "Posture unclear.",
      "Duration unclear.",
    ],
    outOfScopeClaims: [
      "Do not infer emotional calmness.",
      "Do not claim generalized settling reliability.",
    ],
    safetyNotes: [
      "Keep the environment quiet.",
      "Do not hold the dog down.",
      "End before the dog becomes restless.",
    ],
    prerequisiteActivityIds: ["BH004"],
    nextActivityId: "BH034",
    orderedVisibleActions: [
      "Target dog and owner are visible before the settle interval starts.",
      "Dog is beside the owner in a visible resting posture.",
      "Dog remains in that resting posture for at least 10 continuous seconds.",
      "No physical restraint occurs.",
    ],
    skillFamily: "Settle Foundations",
    level: 3,
    fullDogBodyRequired: true,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: false,
  },
  {
    id: "BH034",
    title: "Settle Beside Owner: 30 Seconds",
    orderIndex: 34,
    lessonGoal: "Extend settling beside the owner to a continuous 30-second visible resting posture.",
    visibleCheckpoint: "Dog remains in visible resting posture beside owner continuously for at least 30 seconds.",
    tutorialSteps: [
      "Use the same quiet owner-side setup.",
      "Keep the dog and owner visible.",
      "Begin recording before the 30-second interval starts.",
      "Allow the dog to remain in resting posture.",
      "Reward after the continuous 30-second interval is complete.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Dog and owner must remain visible.",
      "Resting posture must be visible continuously.",
      "Clip must be long enough to score a 30-second interval.",
      "No physical restraint may hold the dog in place.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 1,
    minClipSeconds: 35,
    maxClipSeconds: 50,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Continuous 30-second visible resting posture is completed.",
      "Dog remains beside owner.",
      "No restraint occurs.",
    ],
    failCriteria: [
      "Dog leaves area before duration.",
      "Dog does not remain in resting posture.",
      "Owner restrains dog.",
    ],
    needsReviewCriteria: [
      "Dog cropped.",
      "Owner cropped.",
      "Duration unclear.",
      "Clip too short.",
    ],
    outOfScopeClaims: [
      "Do not infer emotional calmness.",
      "Do not claim anxiety improvement.",
    ],
    safetyNotes: [
      "Keep the session short and easy.",
      "Do not physically hold the dog in position.",
      "Reset if the dog gets up.",
    ],
    prerequisiteActivityIds: ["BH033"],
    nextActivityId: "BH035",
    orderedVisibleActions: [
      "Target dog and owner are visible before the 30-second settle interval starts.",
      "Dog is beside owner in a visible resting posture.",
      "Dog remains in that posture continuously for at least 30 seconds.",
      "No physical restraint occurs.",
    ],
    skillFamily: "Settle Foundations",
    level: 3,
    fullDogBodyRequired: true,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: false,
  },
  {
    id: "BH035",
    title: "Settle on Mat: 1 Minute",
    orderIndex: 35,
    lessonGoal: "Teach the dog to remain inside the registered mat boundary in a visible resting posture for at least 60 seconds.",
    visibleCheckpoint: "Dog remains inside registered TARGET_MAT boundary in a visible resting posture for at least 60 seconds.",
    tutorialSteps: [
      "Use the registered TARGET_MAT.",
      "Position the camera so the full mat and dog remain visible continuously.",
      "Begin recording before the 60-second interval starts.",
      "Let the dog settle inside the mat boundary.",
      "Reward after the continuous 60-second resting interval is complete.",
    ],
    cameraAngle: "VISIBLE_TARGET_ZONE",
    setupInstructions: [
      "Full mat boundary must stay visible.",
      "Dog must remain visible continuously.",
      "Clip must be long enough to score a 60-second interval.",
      "No physical restraint may hold the dog on the mat.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    audioRequired: false,
    fps: 1,
    minClipSeconds: 65,
    maxClipSeconds: 85,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "TARGET_MAT matches saved reference photos.",
      "Dog remains inside mat boundary.",
      "Resting posture is visible.",
      "Continuous 60-second interval is completed.",
    ],
    failCriteria: [
      "Dog exits mat before duration.",
      "Dog does not enter resting posture.",
      "Owner restrains dog on mat.",
    ],
    needsReviewCriteria: [
      "Mat cropped.",
      "Dog hidden.",
      "Mat identity unclear.",
      "Duration unclear.",
      "Clip too short.",
    ],
    outOfScopeClaims: [
      "Do not infer anxiety improvement.",
      "Do not claim generalized mat settling reliability.",
    ],
    safetyNotes: [
      "Use a comfortable mat.",
      "Do not physically hold the dog on the mat.",
      "Keep the area quiet.",
    ],
    prerequisiteActivityIds: ["BH034"],
    nextActivityId: "BH036",
    orderedVisibleActions: [
      "Target dog and registered TARGET_MAT are visible before the 60-second settle interval starts.",
      "Dog is inside the mat boundary in a visible resting posture.",
      "Dog remains inside the mat boundary continuously for at least 60 seconds.",
      "No physical restraint occurs.",
    ],
    skillFamily: "Settle Foundations",
    level: 3,
    fullDogBodyRequired: true,
    pawsRequired: true,
    ownerRequiredInFrame: false,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH036",
    title: "Play -> Drop Toy -> Settle",
    orderIndex: 36,
    lessonGoal: "Teach the dog to release a registered toy during play, travel to the registered mat, and enter a visible settle posture.",
    visibleCheckpoint: "Visible toy play, audible drop cue, TARGET_TOY release, movement to TARGET_MAT, and visible settle posture.",
    tutorialSteps: [
      "Use the registered TARGET_TOY and TARGET_MAT.",
      "Position the camera so the dog, toy, and mat remain visible.",
      "Begin recording during visible toy play.",
      "Give one audible drop cue.",
      "Reward after the dog releases, moves to the mat, and enters a settle posture.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_DOG_AND_OBJECTS",
    setupInstructions: [
      "Toy and mat must be visible.",
      "Dog must be visible continuously.",
      "Audio is required for the drop cue.",
      "Use 5 FPS during toy release evidence and 3 FPS during travel and settle evidence.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY", "TARGET_MAT"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Registered toy matches TARGET_TOY reference photos.",
      "Drop cue is audible.",
      "Voluntary release occurs.",
      "Dog travels to registered mat.",
      "Dog enters visible settle posture.",
    ],
    failCriteria: [
      "No toy release occurs.",
      "Dog does not move to mat.",
      "Dog does not settle.",
      "Forced toy removal occurs.",
    ],
    needsReviewCriteria: [
      "Toy hidden.",
      "Mat hidden.",
      "Dog mouth cropped.",
      "Audio missing.",
      "Sequence unclear.",
    ],
    outOfScopeClaims: [
      "Do not infer emotional regulation.",
      "Do not claim resource guarding treatment.",
    ],
    safetyNotes: [
      "Use safe toy play intensity.",
      "Do not pry the toy from the dog's mouth.",
      "Stop if guarding behavior appears.",
    ],
    prerequisiteActivityIds: ["BH026", "BH033"],
    nextActivityId: "BH037",
    orderedVisibleActions: [
      "Target dog, registered TARGET_TOY, and registered TARGET_MAT are visible during toy play.",
      "One drop cue is audible.",
      "Dog voluntarily releases the toy.",
      "Dog travels to the registered mat.",
      "Dog enters a visible settle posture on or at the mat.",
    ],
    skillFamily: "Drop and Settle",
    level: 3,
    fullDogBodyRequired: true,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH037",
    title: "Wait Before Toy Access",
    orderIndex: 37,
    lessonGoal: "Teach the dog to remain away from a registered toy until an audible release cue.",
    visibleCheckpoint: "Dog remains away from registered TARGET_TOY until audible release cue and approaches only after cue.",
    tutorialSteps: [
      "Use the registered TARGET_TOY.",
      "Position the camera so the dog and toy are visible.",
      "Begin recording before the wait interval starts.",
      "Give one audible release cue after the wait.",
      "Allow toy access only after the release cue.",
    ],
    cameraAngle: "VISIBLE_OBJECT_AND_DESTINATION",
    setupInstructions: [
      "Dog and toy must be visible.",
      "Release cue must be audible.",
      "Dog's approach timing must be visible.",
      "No physical restraint may hold the dog back.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Toy matches TARGET_TOY reference photos.",
      "Dog waits away from the toy.",
      "Release cue is audible.",
      "Dog approaches only after cue.",
    ],
    failCriteria: [
      "Dog accesses toy before release.",
      "Owner restrains dog.",
      "Wrong toy is used.",
    ],
    needsReviewCriteria: [
      "Toy hidden.",
      "Audio unclear.",
      "Timing unclear.",
      "Dog path hidden.",
    ],
    outOfScopeClaims: [
      "Do not infer generalized impulse control.",
      "Do not claim toy access reliability outside the clip.",
    ],
    safetyNotes: [
      "Use a safe toy.",
      "Keep the wait short.",
      "Avoid holding the dog back.",
    ],
    prerequisiteActivityIds: ["BH006"],
    nextActivityId: "BH038",
    orderedVisibleActions: [
      "Target dog and registered TARGET_TOY are visible before the wait starts.",
      "Dog remains away from the toy.",
      "One release cue is audible.",
      "Dog approaches the toy only after the release cue.",
    ],
    skillFamily: "Wait for Access",
    level: 3,
    fullDogBodyRequired: true,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH038",
    title: "Wait Before Sniff Access",
    orderIndex: 38,
    lessonGoal: "Teach the dog to pause before entering a visible sniff destination and approach only after release.",
    visibleCheckpoint: "Dog remains paused before entering a visible sniff destination and approaches only after audible release cue.",
    tutorialSteps: [
      "Choose a clear indoor sniff destination.",
      "Position the camera so the dog, owner, and destination are visible.",
      "Begin recording before the pause starts.",
      "Give one audible release cue.",
      "Allow the dog to approach the destination only after release.",
    ],
    cameraAngle: "VISIBLE_OBJECT_AND_DESTINATION",
    setupInstructions: [
      "Dog, owner, and sniff destination must be visible.",
      "Release cue must be audible.",
      "Dog's pause and approach timing must be visible.",
      "No physical restraint may hold the dog back.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Dog waits before the visible sniff destination.",
      "Release cue is audible.",
      "Dog approaches destination only after release.",
    ],
    failCriteria: [
      "Dog reaches destination before release.",
      "Physical restraint is used.",
    ],
    needsReviewCriteria: [
      "Destination unclear.",
      "Timing unclear.",
      "Audio unclear.",
      "Dog path hidden.",
    ],
    outOfScopeClaims: [
      "Do not infer generalized impulse control.",
      "Do not claim outdoor sniff reliability.",
    ],
    safetyNotes: [
      "Use a safe sniff destination.",
      "Keep the pause brief.",
      "Do not physically block or hold the dog.",
    ],
    prerequisiteActivityIds: ["BH037"],
    nextActivityId: "BH039",
    orderedVisibleActions: [
      "Target dog, owner, and visible sniff destination are in frame before the pause.",
      "Dog remains paused before entering the sniff destination.",
      "One release cue is audible.",
      "Dog approaches the destination only after the release cue.",
    ],
    skillFamily: "Wait for Access",
    level: 3,
    fullDogBodyRequired: true,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH039",
    title: "Calm Leash Clipping",
    orderIndex: 39,
    lessonGoal: "Teach the dog to remain visible while the owner clips a leash to the collar or harness without obvious forced restraint.",
    visibleCheckpoint: "Owner visibly clips leash to collar or harness while dog remains visible and no obvious forced restraint occurs.",
    tutorialSteps: [
      "Position the camera so the dog's neck or harness attachment point is visible.",
      "Keep the owner's hands and leash visible.",
      "Begin recording before the clipping action starts.",
      "Clip the leash without dragging or pinning the dog.",
      "Reward after the clipping action visibly completes.",
    ],
    cameraAngle: "CLOSE_HANDLER_HANDS_AND_ATTACHMENT_POINT",
    setupInstructions: [
      "Dog neck or harness attachment point must be visible.",
      "Owner hands must be visible.",
      "Leash must be visible.",
      "No dragging, pinning, or forced restraint may occur.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 15,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Clipping action visibly completes.",
      "Dog remains visible.",
      "No dragging or pinning occurs.",
    ],
    failCriteria: [
      "Clip is not attached.",
      "Forced restraint occurs.",
      "Dog is dragged into place.",
    ],
    needsReviewCriteria: [
      "Clip point hidden.",
      "Hand blocks critical view.",
      "Dog cropped.",
      "Leash hidden.",
    ],
    outOfScopeClaims: [
      "Do not claim handling comfort.",
      "Do not infer emotional calmness.",
    ],
    safetyNotes: [
      "Use properly fitted gear.",
      "Do not pin the dog for clipping.",
      "Stop if the dog struggles.",
    ],
    prerequisiteActivityIds: [],
    nextActivityId: "BH040",
    orderedVisibleActions: [
      "Target dog, leash, owner hands, and attachment point are visible before clipping begins.",
      "Owner moves the leash clip to the collar or harness attachment point.",
      "Clipping action visibly completes.",
      "No dragging, pinning, or forced restraint occurs.",
    ],
    skillFamily: "Handling for Daily Routines",
    level: 3,
    fullDogBodyRequired: false,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: false,
  },
  {
    id: "BH040",
    title: "Calm Harness Setup",
    orderIndex: 40,
    lessonGoal: "Teach the dog to remain visible while the owner places and secures a harness without obvious forced restraint.",
    visibleCheckpoint: "Owner visibly places and secures harness without obvious forced restraint.",
    tutorialSteps: [
      "Position the camera so the harness and dog body are visible.",
      "Begin recording before harness placement starts.",
      "Place and secure the harness without dragging, pinning, or forced restraint.",
      "Keep fastening points visible when possible.",
      "Reward after harness setup visibly completes.",
    ],
    cameraAngle: "CLOSE_HANDLER_HANDS_AND_DOG_BODY",
    setupInstructions: [
      "Harness and dog body must be visible.",
      "Fastening points should be visible when possible.",
      "Clip must be long enough to show setup completion.",
      "No dragging, pinning, or forced restraint may occur.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 25,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Harness setup visibly completes.",
      "No dragging, pinning, or forced restraint occurs.",
    ],
    failCriteria: [
      "Harness setup incomplete.",
      "Forced restraint visibly occurs.",
    ],
    needsReviewCriteria: [
      "Buckle hidden.",
      "Harness obscured.",
      "Dog cropped.",
      "Clip too short.",
    ],
    outOfScopeClaims: [
      "Do not infer emotional comfort.",
      "Do not claim handling comfort.",
    ],
    safetyNotes: [
      "Use a correctly fitted harness.",
      "Do not force the dog into position.",
      "Stop if the dog struggles.",
    ],
    prerequisiteActivityIds: ["BH039"],
    nextActivityId: "BH041",
    orderedVisibleActions: [
      "Target dog body and harness are visible before setup begins.",
      "Owner places the harness on the dog.",
      "Owner secures the harness fastening points when visible.",
      "Harness setup visibly completes without dragging, pinning, or forced restraint.",
    ],
    skillFamily: "Handling for Daily Routines",
    level: 3,
    fullDogBodyRequired: false,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: false,
  },
];

export const BH031_BH040: BatchActivity[] = SPECS.map(makeActivity);
