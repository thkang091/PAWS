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
${spec.prerequisiteActivityIds.length > 0 ? `Prerequisite activity or activities ${spec.prerequisiteActivityIds.join(", ")} have been passed. ` : ""}${spec.orderedVisibleActions[0]}

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
${spec.audioRequired ? "Audio is required. If required bell audio, ring audio, spoken cue, or cue timing is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is judged. If a spoken cue or cue timing is part of the submitted attempt and audio is unclear, return NEEDS_REVIEW."}

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
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, required audio when applicable, relevant action visible from start to finish, required saved references matching visible dog and objects, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: false,
    ownerRequiredInFrame: spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")),
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
    setupInstructions: spec.setupInstructions,
  };
  const prerequisiteActivityId = spec.prerequisiteActivityIds[0] ?? null;
  const activity: SeedActivity = {
    id: spec.id,
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    sequenceNumber: spec.orderIndex,
    level: spec.level,
    title: spec.title,
    skillFamily: spec.skillFamily,
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity verifies one visible household helper task without claiming generalized assistance outside the submitted clip.",
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
    xpReward: spec.orderIndex >= 38 ? 170 : spec.orderIndex >= 34 ? 165 : 160,
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
    id: "HH031",
    title: "Bell Ring at Doorway",
    orderIndex: 31,
    lessonGoal: "Teach the dog to travel to a registered doorway area and activate the registered bell.",
    visibleCheckpoint: "Dog travels to registered doorway area, contacts registered TARGET_BELL, and produces visible bell movement or audible ring.",
    tutorialSteps: ["Use the registered TARGET_BELL and TARGET_DOORWAY.", "Keep doorway, bell, dog, and route visible.", "Begin recording before the dog travels to the doorway.", "Capture audio for bell activation.", "Reward after dog contact causes bell movement or ring."],
    cameraAngle: "DOORWAY_BELL_DOG_AND_ROUTE",
    setupInstructions: ["TARGET_DOORWAY, TARGET_BELL, dog, and route must be visible.", "Visible doorway and bell must match saved reference photos.", "Audio is required for ring evidence.", "Owner must not ring the bell or force contact."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BELL", "TARGET_DOORWAY"],
    conditionalReferenceRules: ["If bell or doorway identity cannot be matched to saved references, return NEEDS_REVIEW."],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Doorway matches TARGET_DOORWAY.", "Bell matches TARGET_BELL.", "Dog reaches doorway area.", "Dog contacts bell.", "Bell movement or audible ring occurs.", "No owner-forced contact occurs."],
    failCriteria: ["Dog does not reach bell.", "Owner rings bell instead.", "Dog contacts wrong object.", "No bell activation occurs."],
    needsReviewCriteria: ["Bell hidden.", "Doorway cropped.", "Contact obscured.", "Ring audio unclear.", "Reference identity unclear."],
    outOfScopeClaims: ["Do not claim generalized door-alert behavior.", "Do not infer service alert reliability."],
    safetyNotes: ["Use a stable safe bell.", "Keep bell volume comfortable.", "Keep the route clear."],
    prerequisiteActivityIds: ["HH030"],
    nextActivityId: "HH032",
    orderedVisibleActions: ["Target dog, registered TARGET_DOORWAY, registered TARGET_BELL, and route are visible.", "Dog travels to doorway area.", "Dog contacts the bell.", "Bell movement or audible ring occurs without owner-forced contact."],
    skillFamily: "Button and Bell Tasks",
    level: 4,
  },
  {
    id: "HH032",
    title: "Nose-Touch Light Drawer",
    orderIndex: 32,
    lessonGoal: "Teach the dog to touch a registered lightweight drawer front or attached target with the nose.",
    visibleCheckpoint: "Dog visibly touches registered lightweight drawer front or attached target with nose.",
    tutorialSteps: ["Use only a lightweight safe drawer.", "Keep drawer front, dog nose, and target area visible.", "Begin recording before nose contact.", "Reward after visible nose contact.", "Do not press the dog into the drawer."],
    cameraAngle: "DRAWER_FRONT_DOG_NOSE_AND_TARGET_AREA",
    setupInstructions: ["TARGET_DRAWER front, dog nose, and configured target area must be visible.", "Visible drawer must match saved TARGET_DRAWER photos.", "Contact moment must be scorable.", "No owner-forced contact may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DRAWER"],
    conditionalReferenceRules: ["If drawer identity or configured target area is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Drawer matches TARGET_DRAWER.", "Dog nose visibly contacts configured drawer target.", "No owner-forced contact occurs."],
    failCriteria: ["No nose contact occurs.", "Wrong surface is contacted.", "Owner presses dog into drawer."],
    needsReviewCriteria: ["Nose hidden.", "Drawer target cropped.", "Contact moment unclear.", "Drawer identity unclear."],
    outOfScopeClaims: ["Do not claim drawer-closing skill is complete.", "Do not infer household assistance reliability."],
    safetyNotes: ["Use only lightweight safe drawer.", "Ensure drawer cannot slam or trap paws."],
    prerequisiteActivityIds: ["HH001"],
    nextActivityId: "HH033",
    orderedVisibleActions: ["Target dog, registered TARGET_DRAWER front, dog nose, and target area are visible.", "Dog moves nose toward configured drawer target.", "Dog nose visibly contacts the drawer target.", "Owner does not force contact."],
    skillFamily: "Drawer Tasks",
    level: 4,
  },
  {
    id: "HH033",
    title: "Push Light Drawer Closed",
    orderIndex: 33,
    lessonGoal: "Teach the dog to push a registered lightweight drawer from partially open toward closed.",
    visibleCheckpoint: "Dog visibly contacts registered lightweight drawer front and pushes it from partially open toward closed position.",
    tutorialSteps: ["Use the registered lightweight drawer.", "Start with the drawer visibly partially open.", "Keep drawer movement and dog contact area visible.", "Begin before dog contact.", "Reward after the drawer visibly moves toward closed."],
    cameraAngle: "DRAWER_MOTION_AND_DOG_CONTACT_AREA",
    setupInstructions: ["TARGET_DRAWER, drawer movement, and dog contact area must be visible.", "Drawer must begin visibly partially open.", "Visible drawer must match saved TARGET_DRAWER photos.", "Owner must not push or close the drawer."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DRAWER"],
    conditionalReferenceRules: ["If drawer identity or starting position is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Drawer matches TARGET_DRAWER.", "Drawer begins visibly partially open.", "Dog contacts drawer front or target.", "Drawer visibly moves toward closed position.", "No owner pushing occurs."],
    failCriteria: ["Drawer does not move.", "Owner closes drawer.", "Wrong object is used.", "Dog contact is absent."],
    needsReviewCriteria: ["Drawer motion cropped.", "Starting position unclear.", "Dog contact hidden.", "Drawer identity unclear."],
    outOfScopeClaims: ["Do not claim reliable drawer closing.", "Do not infer service-task suitability."],
    safetyNotes: ["Use only lightweight drawer.", "Prevent paw trapping.", "Do not use heavy cabinets."],
    prerequisiteActivityIds: ["HH032"],
    nextActivityId: "HH034",
    orderedVisibleActions: ["Target dog and registered TARGET_DRAWER are visible with drawer partially open.", "Dog contacts drawer front or target.", "Drawer visibly moves toward closed position.", "Owner does not push or close drawer."],
    skillFamily: "Drawer Tasks",
    level: 4,
  },
  {
    id: "HH034",
    title: "Pull Light Object with Rope",
    orderIndex: 34,
    lessonGoal: "Teach the dog to grip a safe rope or pull target and move a registered lightweight object a short distance.",
    visibleCheckpoint: "Dog grips attached rope or safe pull target and visibly pulls registered lightweight object a short distance.",
    tutorialSteps: ["Use a registered lightweight CUSTOM_OBJECT with a safe rope or pull target.", "Keep rope, dog mouth, object, and movement path visible.", "Begin before the dog grips the rope.", "Reward after dog pull moves the object.", "Do not move the object by hand."],
    cameraAngle: "ROPE_DOG_MOUTH_OBJECT_AND_MOVEMENT_PATH",
    setupInstructions: ["Rope or pull target, dog mouth, CUSTOM_OBJECT, and movement path must be visible.", "Object must be lightweight and match saved CUSTOM_OBJECT photos.", "Object movement after dog pull must be visible.", "Owner must not pull or move the object."],
    requiredReferenceAssets: ["DOG_PROFILE", "CUSTOM_OBJECT"],
    conditionalReferenceRules: ["The safe pull object must match registered CUSTOM_OBJECT; unclear object identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Safe pull object matches registered CUSTOM_OBJECT.", "Dog grips rope or target.", "Object visibly moves after dog pull.", "No owner pulling object occurs."],
    failCriteria: ["Object does not move.", "Dog does not grip rope.", "Owner moves object.", "Setup is visibly unsafe."],
    needsReviewCriteria: ["Rope hidden.", "Dog mouth obscured.", "Object motion unclear.", "Object identity unclear."],
    outOfScopeClaims: ["Do not claim door or drawer pulling reliability.", "Do not infer service-task suitability."],
    safetyNotes: ["Lightweight object only.", "No sharp edges.", "No heavy drawers or doors.", "Avoid rope entanglement."],
    prerequisiteActivityIds: ["HH025"],
    nextActivityId: "HH035",
    orderedVisibleActions: ["Target dog, registered CUSTOM_OBJECT, rope or pull target, dog mouth, and movement path are visible.", "Dog grips rope or safe pull target.", "Dog pulls and the lightweight object visibly moves.", "Owner does not pull or move the object."],
    skillFamily: "Object Pull Tasks",
    level: 4,
  },
  {
    id: "HH035",
    title: "Bring Leash from Visible Location",
    orderIndex: 35,
    lessonGoal: "Teach the dog to pick up a visible leash and carry it toward the owner.",
    visibleCheckpoint: "Dog travels to visible registered leash, picks it up, and carries it toward owner.",
    tutorialSteps: ["Place the leash in a visible safe location.", "Register the leash as CUSTOM_OBJECT when the saved-object flow is used.", "Keep leash, dog, owner, and route visible.", "Begin before the dog travels to the leash.", "Reward after the dog begins carrying the leash toward owner."],
    cameraAngle: "LEASH_DOG_OWNER_AND_ROUTE",
    setupInstructions: ["Leash, dog, owner, and route must be visible.", "Leash must match saved reference when registered as CUSTOM_OBJECT.", "Pickup and return route must be visible.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["CUSTOM_OBJECT is required when the leash is registered as a saved object; if registered leash identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Visible leash matches saved reference when registered.", "Dog travels to leash.", "Pickup is visible.", "Dog carries leash toward owner.", "No physical guidance occurs."],
    failCriteria: ["Wrong object is selected.", "No pickup occurs.", "Dog does not begin return.", "Owner places leash in dog mouth."],
    needsReviewCriteria: ["Leash hidden.", "Pickup obscured.", "Return route cropped.", "Leash identity unclear."],
    outOfScopeClaims: ["Do not claim reliable walk-request signaling.", "Do not infer service-task reliability."],
    safetyNotes: ["Use a lightweight safe leash.", "Avoid leash tangling around the dog."],
    prerequisiteActivityIds: ["HH009"],
    nextActivityId: "HH036",
    orderedVisibleActions: ["Target dog, visible leash, owner, and route are visible.", "Dog travels to the leash.", "Dog picks up leash visibly.", "Dog carries leash toward owner without physical guidance."],
    skillFamily: "Object Carry Tasks",
    level: 4,
  },
  {
    id: "HH036",
    title: "Bring Registered Object from Visible Location",
    orderIndex: 36,
    lessonGoal: "Teach the dog to pick up a visible registered object and carry it toward the owner.",
    visibleCheckpoint: "Dog travels to registered visible CUSTOM_OBJECT, picks it up, and carries it toward owner.",
    tutorialSteps: ["Use a registered safe CUSTOM_OBJECT.", "Keep target object, dog, owner, and route visible.", "Begin before the dog travels to the object.", "Record pickup and carry toward owner.", "Reward after the dog begins the return with the object."],
    cameraAngle: "TARGET_OBJECT_DOG_OWNER_AND_ROUTE",
    setupInstructions: ["CUSTOM_OBJECT, dog, owner, and route must be visible.", "Object must match registered CUSTOM_OBJECT reference photos.", "Pickup and carry must be visible.", "No physical direction may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "CUSTOM_OBJECT"],
    conditionalReferenceRules: ["If the target object identity cannot be matched to saved CUSTOM_OBJECT references, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Object matches registered reference.", "Dog travels to object.", "Pickup is visible.", "Dog carries object toward owner.", "No physical guidance occurs."],
    failCriteria: ["Wrong object is selected.", "No pickup occurs.", "Dog does not return.", "Owner physically directs dog."],
    needsReviewCriteria: ["Object hidden.", "Pickup obscured.", "Route cropped.", "Object identity unclear."],
    outOfScopeClaims: ["Do not claim broad named-object understanding.", "Do not infer generalized object retrieval."],
    safetyNotes: ["Use a lightweight safe object.", "Keep the route clear."],
    prerequisiteActivityIds: ["HH035"],
    nextActivityId: "HH037",
    orderedVisibleActions: ["Target dog, registered CUSTOM_OBJECT, owner, and route are visible.", "Dog travels to the object.", "Dog picks up object visibly.", "Dog carries object toward owner without physical guidance."],
    skillFamily: "Object Carry Tasks",
    level: 4,
  },
  {
    id: "HH037",
    title: "Go to Mat When Owner Points",
    orderIndex: 37,
    lessonGoal: "Teach the dog to travel to the registered mat after a visible owner pointing gesture.",
    visibleCheckpoint: "Owner visibly points toward registered TARGET_MAT and dog travels to mat boundary.",
    tutorialSteps: ["Use the registered TARGET_MAT.", "Keep owner pointing gesture, dog, route, and full mat visible.", "Begin with dog off the mat.", "Record the pointing gesture before dog travel.", "Reward after at least two paws enter the mat boundary."],
    cameraAngle: "OWNER_POINTING_DOG_ROUTE_AND_FULL_MAT",
    setupInstructions: ["Owner pointing gesture, dog, route, and full TARGET_MAT must be visible.", "Visible mat must match saved TARGET_MAT photos.", "Dog must begin off the mat.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    conditionalReferenceRules: ["If mat identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Mat matches TARGET_MAT.", "Pointing gesture is visible.", "Dog travels toward mat after gesture.", "At least two paws enter mat boundary.", "No physical guidance occurs."],
    failCriteria: ["Dog travels elsewhere.", "Dog does not enter mat.", "Owner physically moves dog."],
    needsReviewCriteria: ["Pointing gesture cropped.", "Path hidden.", "Mat identity unclear.", "Dog already on mat at start."],
    outOfScopeClaims: ["Do not claim generalized gesture comprehension.", "Do not infer broad directional reliability."],
    safetyNotes: ["Use a stable mat.", "Keep the route clear."],
    prerequisiteActivityIds: ["HH003"],
    nextActivityId: "HH038",
    orderedVisibleActions: ["Target dog, owner pointing gesture, route, and registered TARGET_MAT are visible, with dog off the mat.", "Owner points toward mat.", "Dog travels toward mat after gesture.", "At least two paws enter mat boundary without physical guidance."],
    skillFamily: "Directional Tasks",
    level: 4,
  },
  {
    id: "HH038",
    title: "Go to Crate When Owner Points",
    orderIndex: 38,
    lessonGoal: "Teach the dog to travel into the registered open crate after a visible owner pointing gesture.",
    visibleCheckpoint: "Owner visibly points toward registered open TARGET_CRATE and dog travels into crate.",
    tutorialSteps: ["Use the registered TARGET_CRATE with the door open.", "Keep pointing gesture, crate entrance, dog, and route visible.", "Begin with dog outside the crate.", "Record the gesture before dog travel.", "Reward after voluntary crate entry."],
    cameraAngle: "POINTING_GESTURE_CRATE_ENTRANCE_DOG_AND_ROUTE",
    setupInstructions: ["Owner pointing gesture, TARGET_CRATE entrance, dog, and route must be visible.", "Visible crate must match saved TARGET_CRATE photos.", "Crate door must remain open.", "No physical forcing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CRATE"],
    conditionalReferenceRules: ["If crate identity or door-open status is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Crate matches TARGET_CRATE.", "Crate door remains open.", "Pointing gesture is visible.", "Dog travels into crate.", "No physical forcing occurs."],
    failCriteria: ["Dog travels elsewhere.", "Dog does not enter crate.", "Owner pushes dog inside."],
    needsReviewCriteria: ["Gesture cropped.", "Crate entrance hidden.", "Route unclear.", "Crate identity unclear."],
    outOfScopeClaims: ["Do not claim crate comfort.", "Do not infer generalized gesture comprehension."],
    safetyNotes: ["Keep crate door open.", "Never force crate entry.", "Use a comfortable crate setup."],
    prerequisiteActivityIds: ["HH006"],
    nextActivityId: "HH039",
    orderedVisibleActions: ["Target dog, owner pointing gesture, route, and registered open TARGET_CRATE are visible.", "Owner points toward crate.", "Dog travels toward crate after gesture.", "Dog enters crate without physical forcing."],
    skillFamily: "Directional Tasks",
    level: 4,
  },
  {
    id: "HH039",
    title: "Find Owner in Same Room",
    orderIndex: 39,
    lessonGoal: "Teach the dog to travel toward the owner from another visible area in the same room.",
    visibleCheckpoint: "Dog visibly travels toward owner from another visible area in the same room.",
    tutorialSteps: ["Keep dog, owner, and route visible.", "Begin with dog away from owner.", "Give a spoken cue if cue timing is part of the attempt.", "Record dog travel to owner area.", "Reward after the dog reaches owner area without physical guidance."],
    cameraAngle: "DOG_OWNER_AND_ROUTE_SAME_ROOM",
    setupInstructions: ["Dog, owner, and route must be visible.", "Audio is required when spoken cue timing is judged.", "Multiple people must be distinguishable when present.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required; if multiple people make owner identity ambiguous, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins away from owner.", "Cue is audible when required.", "Dog travels toward owner.", "Dog reaches owner area.", "No physical guidance occurs."],
    failCriteria: ["Dog does not approach owner.", "Dog travels to wrong person.", "Owner physically directs dog."],
    needsReviewCriteria: ["Owner cropped.", "Route hidden.", "Cue unclear when required.", "Multiple people ambiguous."],
    outOfScopeClaims: ["Do not claim generalized search reliability.", "Do not infer person-name comprehension."],
    safetyNotes: ["Use a safe familiar room.", "Keep route clear."],
    prerequisiteActivityIds: ["HH001"],
    nextActivityId: "HH040",
    orderedVisibleActions: ["Target dog begins away from visible owner in the same room.", "Cue occurs when used.", "Dog travels toward owner.", "Dog reaches owner area without physical guidance."],
    skillFamily: "Family-Member Tasks",
    level: 4,
  },
  {
    id: "HH040",
    title: "Find Owner in Next Room",
    orderIndex: 40,
    lessonGoal: "Teach the dog to travel through a visible route and reach the owner in an adjacent room.",
    visibleCheckpoint: "Dog begins in one visible room or doorway area, travels through route, and reaches owner in the adjacent room.",
    tutorialSteps: ["Set up a safe adjacent-room route.", "Keep route, doorway transition, dog, and owner visible when possible.", "Begin with dog away from owner.", "Give a spoken cue if cue timing is part of the attempt.", "Reward after the dog reaches owner area."],
    cameraAngle: "ROUTE_DOORWAY_TRANSITION_DOG_AND_OWNER",
    setupInstructions: ["Route, doorway transition, dog, and owner must be visible when possible.", "Audio is required when spoken cue timing is judged.", "Room transition must be scorable.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required; if owner identity or room transition is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins away from owner.", "Dog travels through visible route.", "Dog reaches owner area.", "No physical guidance occurs."],
    failCriteria: ["Dog does not reach owner.", "Dog travels to wrong person.", "Owner physically guides dog."],
    needsReviewCriteria: ["Room transition hidden.", "Route cropped.", "Owner hidden.", "Cue unclear when required."],
    outOfScopeClaims: ["Do not claim generalized search reliability.", "Do not infer indoor recall reliability."],
    safetyNotes: ["Use a safe clear route.", "Avoid stairs or obstacles for this version."],
    prerequisiteActivityIds: ["HH039"],
    nextActivityId: "HH041",
    orderedVisibleActions: ["Target dog begins away from owner in one visible room or doorway area.", "Dog travels through visible route or doorway transition.", "Dog reaches owner area in adjacent room.", "Owner does not physically guide dog."],
    skillFamily: "Family-Member Tasks",
    level: 4,
  },
];

export const HH031_HH040: BatchActivity[] = SPECS.map(makeActivity);
