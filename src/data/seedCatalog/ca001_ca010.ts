import type { CompletedSeedActivity, SeedActivity } from "./bh001_bh010";

type BatchActivity = CompletedSeedActivity & { orderedVisibleActions: string[]; referenceSetupOnly: boolean };

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
  referenceSetupOnly?: boolean;
};

const list = (items: string[]): string => items.map((item) => `- ${item}`).join("\n");

const calmScopeRules = [
  "Gemini may verify only visible or audible evidence from the submitted clip.",
  "Allowed observations include safe-zone entry, remaining inside a visible boundary, owner stepping away or exiting frame, position changes, safe-zone exit, visible pacing, visible scratching, and visible vocalization only when audio is present.",
  "Forbidden claims include dog feels calm, dog feels safe, dog is comfortable alone, dog has separation anxiety, dog no longer has separation anxiety, dog is cured, dog can be left alone indefinitely, or behavior will generalize outside submitted clip.",
];

const promptFor = (spec: ActivitySpec): string => {
  if (spec.referenceSetupOnly) {
    return `PAWS REFERENCE-SETUP VALIDATION PROMPT

ACTIVITY ID
${spec.id}

ACTIVITY TITLE
${spec.title}

EXPECTED START STATE
User is registering one safe-zone reference photo before later Calm Alone Time safe-zone activities.

VISIBLE CHECKPOINT
${spec.visibleCheckpoint}

RECORDING SETUP
- Quest type: REFERENCE_SETUP
- This activity is not a video pass gate.
${list(spec.setupInstructions)}

REQUIRED SAVED REFERENCES
${list(spec.requiredReferenceAssets)}
${list(spec.conditionalReferenceRules)}

AUDIO RULE
Audio is not required because CA001 validates saved reference-photo setup only.

FPS
${spec.fps}

CLIP-DURATION RANGE
${spec.minClipSeconds}-${spec.maxClipSeconds} seconds; no user video is required for CA001.

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
Use the existing reference-photo validation flow only. Do not create an invented video verdict, invented reference-photo URL, or semantic accuracy claim. Missing evidence returns NEEDS_REVIEW, not FAIL. Owner confirmation is not evidence. Return strict JSON only with this exact shape when validation is requested: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}.`;
  }

  return `PAWS GEMINI 2.5 FLASH VERIFIER PROMPT

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
- Owner or handler in frame required: ${spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")) ? "YES" : "NO"}
${list(spec.setupInstructions)}

REQUIRED REFERENCES
${list(spec.requiredReferenceAssets)}
${list(spec.conditionalReferenceRules)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If required cue timing or audible evidence is missing or unusable, return NEEDS_REVIEW." : "Audio is optional. Visible vocalization may be noted only when audio is present; missing optional audio is not FAIL."}

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
};

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: false,
    ownerRequiredInFrame: spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")),
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: spec.requiredReferenceAssets.some((asset) => asset !== "DOG_PROFILE"),
    destinationRequiredInFrame: !spec.referenceSetupOnly,
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
    questContentType: spec.referenceSetupOnly ? "REFERENCE_SETUP" : "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity verifies a narrow visible alone-time foundation without inferring feelings, anxiety status, or generalization outside the submitted evidence.",
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
    xpReward: spec.orderIndex >= 9 ? 125 : spec.orderIndex >= 6 ? 120 : 115,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: spec.fps,
    minClipSeconds: spec.minClipSeconds,
    maxClipSeconds: spec.maxClipSeconds,
    vlmPrompt: promptFor(spec),
  };
  return { ...activity, orderIndex: spec.orderIndex, recordingSetup: recordingRequirements, audioRequired: spec.audioRequired, fps: spec.fps, prerequisiteActivityId, nextActivityId: spec.nextActivityId, orderedVisibleActions: spec.orderedVisibleActions, referenceSetupOnly: Boolean(spec.referenceSetupOnly) };
};

const safeZoneReferenceRule = "The saved safe-zone reference must be TARGET_MAT or TARGET_CRATE depending on selected safe-zone type; if the selected safe-zone object cannot be matched confidently, return NEEDS_REVIEW.";

const SPECS: ActivitySpec[] = [
  {
    id: "CA001",
    title: "Safe-Zone Photo Setup",
    orderIndex: 1,
    lessonGoal: "Require a clear saved reference photo for the selected safe zone before later safe-zone activities.",
    visibleCheckpoint: "A valid saved safe-zone photo exists with full object boundary visible enough for future matching.",
    tutorialSteps: ["Choose one primary safe zone, either a mat or an open crate.", "Register the safe-zone reference photo as TARGET_MAT or TARGET_CRATE.", "Keep the full safe-zone object and boundary visible.", "Use adequate lighting and avoid severe blur.", "Do not register multiple possible zones in one reference photo."],
    cameraAngle: "REFERENCE_PHOTO_SAFE_ZONE_BOUNDARY",
    setupInstructions: ["Full safe-zone object must be visible.", "Boundary must be visible.", "Lighting must be adequate.", "Image must not have severe blur.", "Object must not be heavily cropped.", "One primary safe zone per saved reference."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["TARGET_MAT or TARGET_CRATE is required depending on selected safe-zone type.", "CA001 uses existing reference-photo validation flow rather than Gemini video review."],
    audioRequired: false,
    fps: 0,
    minClipSeconds: 0,
    maxClipSeconds: 0,
    passCriteria: ["DOG_PROFILE reference exists.", "Valid saved safe-zone photo exists.", "Reference asset type is TARGET_MAT or TARGET_CRATE.", "Safe-zone boundary is visible enough for future matching."],
    failCriteria: ["Do not use FAIL for missing setup evidence."],
    needsReviewCriteria: ["Photo missing.", "Object heavily cropped.", "Blurry image.", "Poor lighting.", "Safe-zone type unclear.", "Multiple possible zones make identity unclear."],
    outOfScopeClaims: ["Do not infer emotional safety.", "Do not claim the dog feels safe.", "Do not claim alone-time comfort."],
    safetyNotes: ["Choose a stable comfortable zone.", "Keep the reference object clear and unobstructed."],
    prerequisiteActivityIds: [],
    nextActivityId: "CA002",
    orderedVisibleActions: ["User registers one safe-zone reference photo.", "Photo shows TARGET_MAT or TARGET_CRATE.", "Full object boundary is visible.", "Reference setup is stored for later matching."],
    skillFamily: "Safe-Zone Setup",
    level: 1,
    referenceSetupOnly: true,
  },
  {
    id: "CA002",
    title: "Voluntary Safe-Zone Entry",
    orderIndex: 2,
    lessonGoal: "Teach the dog to voluntarily enter the registered safe zone.",
    visibleCheckpoint: "Dog begins outside registered safe-zone boundary and voluntarily enters the same safe zone shown in saved reference photos.",
    tutorialSteps: ["Use the safe zone registered in CA001.", "Keep full safe-zone boundary visible.", "Begin with dog outside the boundary.", "Record the dog path into the zone.", "Reward after at least two paws cross the visible boundary without force."],
    cameraAngle: "FULL_SAFE_ZONE_BOUNDARY_AND_DOG_PATH",
    setupInstructions: ["Full safe-zone boundary must be visible.", "Dog path must be visible.", "Begin recording before dog enters.", "No dragging, lifting, or pushing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Safe zone matches saved TARGET_MAT or TARGET_CRATE.", "Dog begins outside boundary.", "Dog voluntarily enters.", "At least two paws cross visible boundary.", "No dragging, lifting, or pushing occurs."],
    failCriteria: ["Dog does not enter safe zone.", "Dog enters a visibly different unregistered zone.", "Owner physically forces entry."],
    needsReviewCriteria: ["Safe-zone boundary cropped.", "Paws hidden.", "Dog already inside at clip start.", "Reference identity unclear.", "Route hidden."],
    outOfScopeClaims: ["Do not claim dog feels safe.", "Do not infer emotional comfort.", "Do not claim separation tolerance."],
    safetyNotes: ["Use a stable safe zone.", "Never force entry.", "Keep repetitions short."],
    prerequisiteActivityIds: ["CA001"],
    nextActivityId: "CA003",
    orderedVisibleActions: ["Target dog starts outside registered safe-zone boundary.", "Full safe-zone boundary and dog path are visible.", "Dog voluntarily enters the safe zone.", "At least two paws cross the visible boundary without force."],
    skillFamily: "Safe-Zone Foundation",
    level: 1,
  },
  {
    id: "CA003",
    title: "Place Hold: 3 Seconds",
    orderIndex: 3,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary for 3 seconds.",
    visibleCheckpoint: "Dog remains continuously inside registered safe-zone boundary for at least 3 seconds.",
    tutorialSteps: ["Use the registered safe zone.", "Keep the entire boundary visible.", "Start with the dog inside the boundary.", "Record a continuous 3-second hold.", "Reward without physically restraining the dog."],
    cameraAngle: "ENTIRE_SAFE_ZONE_BOUNDARY_AND_DOG",
    setupInstructions: ["Entire safe-zone boundary must be visible.", "Dog must be visible continuously.", "Duration must be scorable.", "No physical restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 6,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Safe zone is matched.", "Dog remains inside boundary.", "Continuous 3-second hold completes.", "No physical restraint occurs."],
    failCriteria: ["Dog exits before 3 seconds.", "Dog is physically held in place."],
    needsReviewCriteria: ["Boundary cropped.", "Dog hidden.", "Duration unclear.", "Clip too short."],
    outOfScopeClaims: ["Do not infer emotional calmness.", "Do not claim relaxation.", "Do not claim alone-time comfort."],
    safetyNotes: ["Keep duration easy.", "Do not restrain the dog."],
    prerequisiteActivityIds: ["CA002"],
    nextActivityId: "CA004",
    orderedVisibleActions: ["Target dog is inside matched registered safe-zone boundary.", "Entire boundary and dog remain visible.", "Dog remains inside continuously for at least 3 seconds.", "No physical restraint occurs."],
    skillFamily: "Safe-Zone Hold",
    level: 1,
  },
  {
    id: "CA004",
    title: "Place Hold: 10 Seconds",
    orderIndex: 4,
    lessonGoal: "Extend the registered safe-zone hold to 10 seconds.",
    visibleCheckpoint: "Dog remains continuously inside registered safe-zone boundary for at least 10 seconds.",
    tutorialSteps: ["Use the registered safe zone.", "Keep boundary and dog visible continuously.", "Begin timing after dog is inside boundary.", "Record a continuous 10-second hold.", "Avoid physical restraint."],
    cameraAngle: "SAFE_ZONE_BOUNDARY_AND_CONTINUOUS_DOG_VIEW",
    setupInstructions: ["Boundary must be visible.", "Dog must be visible continuously.", "Clip must be long enough to score 10 seconds.", "No restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 14,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Safe zone is matched.", "Dog remains inside boundary continuously.", "10-second hold completes.", "No restraint occurs."],
    failCriteria: ["Dog exits before 10 seconds.", "Owner physically restrains dog."],
    needsReviewCriteria: ["Dog hidden.", "Boundary cropped.", "Duration unclear.", "Clip too short."],
    outOfScopeClaims: ["Do not claim relaxation.", "Do not infer emotional calmness.", "Do not claim separation tolerance."],
    safetyNotes: ["Increase duration gradually.", "Keep the safe zone stable."],
    prerequisiteActivityIds: ["CA003"],
    nextActivityId: "CA005",
    orderedVisibleActions: ["Target dog is inside matched registered safe-zone boundary.", "Boundary and dog remain visible continuously.", "Dog remains inside for at least 10 seconds.", "No restraint occurs."],
    skillFamily: "Safe-Zone Hold",
    level: 1,
  },
  {
    id: "CA005",
    title: "Place Hold: 30 Seconds",
    orderIndex: 5,
    lessonGoal: "Extend the registered safe-zone hold to 30 seconds.",
    visibleCheckpoint: "Dog remains continuously inside registered safe-zone boundary for at least 30 seconds.",
    tutorialSteps: ["Use the registered safe zone.", "Keep full boundary and dog visible continuously.", "Begin timing after dog is inside boundary.", "Record a continuous 30-second hold.", "End before difficulty increases too much."],
    cameraAngle: "FULL_SAFE_ZONE_BOUNDARY_AND_CONTINUOUS_DOG_VIEW",
    setupInstructions: ["Full boundary must be visible.", "Dog must be visible continuously.", "Clip must be long enough to score 30 seconds.", "No physical hold may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 1,
    minClipSeconds: 35,
    maxClipSeconds: 50,
    passCriteria: ["Dog matches DOG_PROFILE.", "Registered safe zone is matched.", "Dog remains inside boundary for 30 seconds.", "No restraint occurs."],
    failCriteria: ["Dog exits before duration.", "Owner physically holds dog in zone."],
    needsReviewCriteria: ["Dog cropped.", "Boundary hidden.", "Duration unclear.", "Clip too short."],
    outOfScopeClaims: ["Do not claim separation tolerance.", "Do not claim relaxation.", "Do not claim the dog can be left alone indefinitely."],
    safetyNotes: ["Keep duration within the requested range.", "Stop if the dog exits or appears unsafe."],
    prerequisiteActivityIds: ["CA004"],
    nextActivityId: "CA006",
    orderedVisibleActions: ["Target dog is inside matched registered safe-zone boundary.", "Full boundary and dog remain visible continuously.", "Dog remains inside for at least 30 seconds.", "No physical hold occurs."],
    skillFamily: "Safe-Zone Hold",
    level: 1,
  },
  {
    id: "CA006",
    title: "Open-Crate Entry",
    orderIndex: 6,
    lessonGoal: "Teach the dog to voluntarily enter the registered crate while the door remains open.",
    visibleCheckpoint: "Dog voluntarily enters registered TARGET_CRATE while crate door remains visibly open.",
    tutorialSteps: ["Use the registered TARGET_CRATE.", "Keep crate entrance and open door visible.", "Begin with dog outside crate.", "Record the dog path into the crate.", "Reward voluntary entry without closing the door."],
    cameraAngle: "CRATE_ENTRANCE_OPEN_DOOR_AND_DOG_PATH",
    setupInstructions: ["Crate entrance must be visible.", "Crate door must be visible and open.", "Dog path must be visible.", "No physical forcing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CRATE"],
    conditionalReferenceRules: ["Visible crate must match saved TARGET_CRATE photos; unclear crate identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Crate matches TARGET_CRATE.", "Dog begins outside crate.", "Dog voluntarily enters.", "Crate door stays open.", "No physical forcing occurs."],
    failCriteria: ["Dog does not enter.", "Owner pushes or lifts dog inside.", "Wrong crate is used."],
    needsReviewCriteria: ["Crate entrance cropped.", "Door position hidden.", "Dog already inside at clip start.", "Crate identity unclear."],
    outOfScopeClaims: ["Do not claim crate comfort.", "Do not infer emotional safety.", "Do not claim crating reliability."],
    safetyNotes: ["Keep crate door open.", "Never force entry.", "Do not use crate as punishment."],
    prerequisiteActivityIds: ["CA002"],
    nextActivityId: "CA007",
    orderedVisibleActions: ["Target dog starts outside registered TARGET_CRATE.", "Crate entrance and open door are visible.", "Dog voluntarily enters crate.", "No physical forcing occurs."],
    skillFamily: "Open-Crate Foundation",
    level: 1,
  },
  {
    id: "CA007",
    title: "Crate Hold with Open Door: 3 Seconds",
    orderIndex: 7,
    lessonGoal: "Teach the dog to remain inside the registered crate for 3 seconds while the door stays open.",
    visibleCheckpoint: "Dog remains inside registered crate continuously for at least 3 seconds while crate door remains visibly open.",
    tutorialSteps: ["Use the registered TARGET_CRATE.", "Keep crate entrance and open door visible.", "Start with dog inside crate.", "Record a continuous 3-second hold.", "Do not block the dog from exiting."],
    cameraAngle: "CRATE_ENTRANCE_OPEN_DOOR_AND_DOG",
    setupInstructions: ["Crate entrance and door must be visible.", "Dog must be visible continuously.", "Door must remain open.", "No physical restraint or blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CRATE"],
    conditionalReferenceRules: ["Visible crate must match saved TARGET_CRATE photos; unclear crate identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 6,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Crate matches TARGET_CRATE.", "Door remains open.", "Dog stays inside crate for 3 seconds.", "No physical restraint occurs."],
    failCriteria: ["Dog exits before duration.", "Door closes.", "Owner physically blocks exit."],
    needsReviewCriteria: ["Dog hidden.", "Crate boundary cropped.", "Door position unclear.", "Duration unclear."],
    outOfScopeClaims: ["Do not claim dog can stay crated alone.", "Do not infer emotional comfort.", "Do not claim crate training is complete."],
    safetyNotes: ["Keep crate door open.", "Do not block exit.", "Keep duration easy."],
    prerequisiteActivityIds: ["CA006"],
    nextActivityId: "CA008",
    orderedVisibleActions: ["Target dog is inside matched registered TARGET_CRATE.", "Crate entrance and open door remain visible.", "Dog stays inside continuously for at least 3 seconds.", "No blocking or restraint occurs."],
    skillFamily: "Open-Crate Hold",
    level: 1,
  },
  {
    id: "CA008",
    title: "Crate Hold with Open Door: 10 Seconds",
    orderIndex: 8,
    lessonGoal: "Extend the registered open-crate hold to 10 seconds.",
    visibleCheckpoint: "Dog remains inside registered crate continuously for at least 10 seconds while crate door remains visibly open.",
    tutorialSteps: ["Use the registered TARGET_CRATE.", "Keep crate entrance, open door, and dog visible continuously.", "Start with dog inside crate.", "Record a continuous 10-second hold.", "Avoid blocking or restraining the dog."],
    cameraAngle: "CRATE_ENTRANCE_OPEN_DOOR_AND_CONTINUOUS_DOG_VIEW",
    setupInstructions: ["Crate entrance must be visible.", "Dog must be visible continuously.", "Crate door must be visible and open.", "No blocking or restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CRATE"],
    conditionalReferenceRules: ["Visible crate must match saved TARGET_CRATE photos; unclear crate identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 14,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Crate is matched.", "Dog stays inside for 10 seconds.", "Door remains open.", "No blocking or restraint occurs."],
    failCriteria: ["Dog exits early.", "Door closes.", "Owner physically prevents exit."],
    needsReviewCriteria: ["Crate boundary hidden.", "Dog cropped.", "Duration unclear.", "Door position unclear."],
    outOfScopeClaims: ["Do not infer emotional comfort.", "Do not claim dog can stay crated alone.", "Do not claim separation tolerance."],
    safetyNotes: ["Keep door open.", "Do not block exit.", "Keep the session short."],
    prerequisiteActivityIds: ["CA007"],
    nextActivityId: "CA009",
    orderedVisibleActions: ["Target dog is inside matched registered TARGET_CRATE.", "Crate entrance, dog, and open door remain visible.", "Dog stays inside continuously for at least 10 seconds.", "No blocking or restraint occurs."],
    skillFamily: "Open-Crate Hold",
    level: 1,
  },
  {
    id: "CA009",
    title: "Settle Beside Owner: 10 Seconds",
    orderIndex: 9,
    lessonGoal: "Teach the dog to remain in a visible resting posture beside owner for 10 seconds.",
    visibleCheckpoint: "Dog remains in visible resting posture beside owner for at least 10 seconds.",
    tutorialSteps: ["Set up beside the owner in a quiet area.", "Keep dog and owner visible.", "Keep dog body visible continuously.", "Record a continuous 10-second resting posture.", "Avoid physical restraint."],
    cameraAngle: "DOG_AND_OWNER_CONTINUOUS_VIEW",
    setupInstructions: ["Dog and owner must be visible.", "Dog body must be visible continuously.", "Posture and duration must be scorable.", "No restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required."],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 14,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog remains beside owner.", "Resting posture is visible.", "10-second interval completes.", "No restraint occurs."],
    failCriteria: ["Dog leaves area before duration.", "Dog does not reach resting posture.", "Owner physically restrains dog."],
    needsReviewCriteria: ["Dog hidden.", "Posture unclear.", "Owner cropped.", "Duration unclear."],
    outOfScopeClaims: ["Do not infer emotional calmness.", "Do not claim relaxation.", "Do not claim separation-anxiety status."],
    safetyNotes: ["Use a comfortable surface.", "Keep the duration easy."],
    prerequisiteActivityIds: ["CA005"],
    nextActivityId: "CA010",
    orderedVisibleActions: ["Target dog is beside visible owner.", "Dog body remains visible continuously.", "Dog remains in visible resting posture for at least 10 seconds.", "No restraint occurs."],
    skillFamily: "Owner-Side Settle",
    level: 1,
  },
  {
    id: "CA010",
    title: "Settle Beside Owner: 30 Seconds",
    orderIndex: 10,
    lessonGoal: "Extend the visible resting posture beside owner to 30 seconds.",
    visibleCheckpoint: "Dog remains in visible resting posture beside owner continuously for at least 30 seconds.",
    tutorialSteps: ["Set up beside the owner in a quiet area.", "Keep dog and owner visible.", "Keep dog body visible continuously.", "Record a continuous 30-second resting posture.", "Avoid restraint or blocking."],
    cameraAngle: "DOG_AND_OWNER_CONTINUOUS_LONG_VIEW",
    setupInstructions: ["Dog and owner must be visible.", "Dog body must be visible continuously.", "Clip must be long enough to score 30 seconds.", "No physical restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required."],
    audioRequired: false,
    fps: 1,
    minClipSeconds: 35,
    maxClipSeconds: 50,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog remains beside owner.", "Resting posture is visible.", "Continuous 30-second interval completes.", "No restraint occurs."],
    failCriteria: ["Dog leaves owner area early.", "Dog does not remain in resting posture.", "Physical restraint occurs."],
    needsReviewCriteria: ["Dog cropped.", "Posture unclear.", "Duration unclear.", "Clip too short."],
    outOfScopeClaims: ["Do not infer separation-anxiety improvement.", "Do not infer emotional calmness.", "Do not claim the dog can be left alone indefinitely."],
    safetyNotes: ["Use a comfortable surface.", "Do not restrain the dog.", "Stop before the dog appears unsafe."],
    prerequisiteActivityIds: ["CA009"],
    nextActivityId: "CA011",
    orderedVisibleActions: ["Target dog is beside visible owner.", "Dog body remains visible continuously.", "Dog remains in visible resting posture for at least 30 seconds.", "No restraint occurs."],
    skillFamily: "Owner-Side Settle",
    level: 1,
  },
];

export const CA001_CA010: BatchActivity[] = SPECS.map(makeActivity);
