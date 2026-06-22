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

AUDIO RULE
${spec.audioRequired ? "Audio is required. If required cue timing is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is judged. If cue timing is part of the submitted attempt and audio is unclear, return NEEDS_REVIEW."}

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
    targetObjectRequiredInFrame: spec.requiredReferenceAssets.some((asset) => asset !== "DOG_PROFILE"),
    destinationRequiredInFrame: ["HH002", "HH003", "HH004", "HH005", "HH006", "HH007", "HH008", "HH009", "HH010"].includes(spec.id),
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
    whyItMatters: "This activity verifies one visible household helper foundation without claiming generalized assistance outside the submitted clip.",
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
    xpReward: spec.orderIndex >= 7 ? 120 : spec.orderIndex >= 3 ? 110 : 100,
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
    id: "HH001",
    title: "Hand Target",
    orderIndex: 1,
    lessonGoal: "Teach the dog to visibly touch the owner's open palm with the nose as a household helper foundation.",
    visibleCheckpoint: "Dog visibly touches owner's open palm with nose.",
    tutorialSteps: ["Present an open palm near the dog.", "Keep dog nose and palm visible.", "Begin recording before the dog moves to the palm.", "Reward after nose contact.", "Do not press the hand into the dog's nose."],
    cameraAngle: "CLOSE_NOSE_AND_PALM",
    setupInstructions: ["Dog nose and owner's open palm must be visible.", "Contact moment must remain unobscured.", "No physical pushing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 4,
    maxClipSeconds: 10,
    passCriteria: ["Dog matches DOG_PROFILE.", "Palm is visible.", "Dog nose visibly contacts palm.", "No physical pushing occurs."],
    failCriteria: ["No nose contact occurs.", "Owner presses hand into dog's nose."],
    needsReviewCriteria: ["Dog nose hidden.", "Palm cropped.", "Contact moment unclear."],
    outOfScopeClaims: ["Do not claim generalized targeting reliability.", "Do not infer helper-task readiness."],
    safetyNotes: ["Keep hand movement gentle.", "Do not push into the dog's face."],
    prerequisiteActivityIds: [],
    nextActivityId: "HH002",
    orderedVisibleActions: ["Target dog and owner's open palm are visible before contact.", "Dog moves nose toward palm.", "Dog nose visibly contacts palm.", "Owner does not press hand into dog's nose."],
    skillFamily: "Household Foundations",
    level: 1,
  },
  {
    id: "HH002",
    title: "Go to Designated Mat",
    orderIndex: 2,
    lessonGoal: "Teach the dog to voluntarily move onto the registered household mat.",
    visibleCheckpoint: "Dog voluntarily moves onto registered TARGET_MAT and places at least two paws inside mat boundary.",
    tutorialSteps: ["Use the registered TARGET_MAT.", "Keep full mat and dog route visible.", "Begin with the dog outside the mat.", "Encourage voluntary entry.", "Reward after at least two paws enter the mat boundary."],
    cameraAngle: "FULL_MAT_AND_DOG_ROUTE",
    setupInstructions: ["TARGET_MAT and dog route must be visible.", "Visible mat must match saved TARGET_MAT photos.", "Dog must begin outside the mat.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Mat matches TARGET_MAT.", "Dog begins outside mat.", "Dog enters voluntarily.", "At least two paws enter mat boundary.", "No forcing occurs."],
    failCriteria: ["Dog does not enter mat.", "Wrong target is used.", "Owner drags dog onto mat."],
    needsReviewCriteria: ["Mat cropped.", "Paws hidden.", "Mat identity unclear.", "Dog already on mat at clip start."],
    outOfScopeClaims: ["Do not claim mat stay reliability.", "Do not infer relaxation."],
    safetyNotes: ["Use a stable non-slip mat.", "Do not drag the dog onto the mat."],
    prerequisiteActivityIds: ["HH001"],
    nextActivityId: "HH003",
    orderedVisibleActions: ["Target dog, registered TARGET_MAT, and route are visible with dog outside mat.", "Dog voluntarily travels toward the mat.", "At least two paws enter mat boundary.", "Owner does not drag or force the dog."],
    skillFamily: "Mat and Crate Tasks",
    level: 1,
  },
  {
    id: "HH003",
    title: "Mat Send from 3 Feet",
    orderIndex: 3,
    lessonGoal: "Teach the dog to travel approximately 3 feet to the registered mat.",
    visibleCheckpoint: "Dog begins approximately 3 feet away and travels to registered TARGET_MAT.",
    tutorialSteps: ["Use the registered TARGET_MAT.", "Keep dog start area, route, and mat visible.", "Begin with dog approximately 3 feet away.", "Give the send cue if used.", "Reward after at least two paws enter the mat."],
    cameraAngle: "DOG_START_ROUTE_AND_TARGET_MAT",
    setupInstructions: ["Dog start area, route, and TARGET_MAT must be visible.", "Visible mat must match saved TARGET_MAT photos.", "Audio is required when send cue timing is judged.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Mat matches TARGET_MAT.", "Dog starts approximately 3 feet away.", "Dog travels to mat.", "At least two paws enter mat.", "No physical guidance occurs."],
    failCriteria: ["Dog does not travel to mat.", "Wrong destination is used.", "Owner physically moves dog."],
    needsReviewCriteria: ["Start distance unclear.", "Route cropped.", "Mat identity unclear.", "Cue unclear when required."],
    outOfScopeClaims: ["Do not claim distance send reliability.", "Do not infer cue fluency outside the clip."],
    safetyNotes: ["Keep the route clear.", "Use an easy distance."],
    prerequisiteActivityIds: ["HH002"],
    nextActivityId: "HH004",
    orderedVisibleActions: ["Target dog starts approximately 3 feet from registered TARGET_MAT with route visible.", "Dog travels toward the mat.", "At least two paws enter mat boundary.", "Owner does not physically guide the dog."],
    skillFamily: "Mat and Crate Tasks",
    level: 1,
  },
  {
    id: "HH004",
    title: "Mat Send from 6 Feet",
    orderIndex: 4,
    lessonGoal: "Teach the dog to travel approximately 6 feet to the registered mat.",
    visibleCheckpoint: "Dog begins approximately 6 feet away and travels to registered TARGET_MAT.",
    tutorialSteps: ["Use the registered TARGET_MAT.", "Keep full route and mat visible.", "Begin with dog approximately 6 feet away.", "Give the send cue if used.", "Reward after at least two paws enter the mat boundary."],
    cameraAngle: "FULL_ROUTE_AND_TARGET_MAT",
    setupInstructions: ["Full route and TARGET_MAT must be visible.", "Visible mat must match saved TARGET_MAT photos.", "Audio is required when cue timing is judged.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Registered mat matches TARGET_MAT.", "Dog starts approximately 6 feet away.", "Dog travels to mat.", "At least two paws enter boundary.", "No physical guidance occurs."],
    failCriteria: ["Dog travels elsewhere.", "Dog does not enter mat.", "Owner physically guides dog."],
    needsReviewCriteria: ["Distance unclear.", "Path cropped.", "Mat identity unclear."],
    outOfScopeClaims: ["Do not claim long-distance send reliability.", "Do not infer generalized household helper behavior."],
    safetyNotes: ["Keep the route clear.", "Use a safe non-slip surface."],
    prerequisiteActivityIds: ["HH003"],
    nextActivityId: "HH005",
    orderedVisibleActions: ["Target dog starts approximately 6 feet from registered TARGET_MAT with full route visible.", "Dog travels toward the mat.", "At least two paws enter mat boundary.", "Owner does not physically guide the dog."],
    skillFamily: "Mat and Crate Tasks",
    level: 1,
  },
  {
    id: "HH005",
    title: "Open-Crate Entry",
    orderIndex: 5,
    lessonGoal: "Teach the dog to voluntarily enter the registered crate while the door remains open.",
    visibleCheckpoint: "Dog voluntarily enters registered TARGET_CRATE while crate door remains visibly open.",
    tutorialSteps: ["Use the registered TARGET_CRATE.", "Keep crate entrance and dog visible.", "Begin with dog outside crate.", "Leave the crate door open.", "Reward voluntary entry without pushing or lifting."],
    cameraAngle: "CRATE_ENTRANCE_AND_DOG",
    setupInstructions: ["TARGET_CRATE entrance and dog must be visible.", "Visible crate must match saved TARGET_CRATE photos.", "Crate door must remain visibly open.", "Dog must begin outside crate."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CRATE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Crate matches TARGET_CRATE.", "Door remains open.", "Dog begins outside crate.", "Dog voluntarily enters.", "No forcing occurs."],
    failCriteria: ["Dog does not enter.", "Wrong crate is used.", "Owner pushes or lifts dog inside."],
    needsReviewCriteria: ["Crate entrance cropped.", "Door position hidden.", "Crate identity unclear.", "Dog already inside at clip start."],
    outOfScopeClaims: ["Do not claim crate comfort.", "Do not claim dog can remain crated alone."],
    safetyNotes: ["Keep crate door open.", "Never force entry."],
    prerequisiteActivityIds: ["HH004"],
    nextActivityId: "HH006",
    orderedVisibleActions: ["Target dog and registered TARGET_CRATE entrance are visible with dog outside crate.", "Crate door remains visibly open.", "Dog voluntarily enters crate.", "Owner does not push or lift dog inside."],
    skillFamily: "Mat and Crate Tasks",
    level: 1,
  },
  {
    id: "HH006",
    title: "Crate Send from 3 Feet",
    orderIndex: 6,
    lessonGoal: "Teach the dog to travel approximately 3 feet into the registered open crate.",
    visibleCheckpoint: "Dog begins approximately 3 feet away and travels into registered open TARGET_CRATE.",
    tutorialSteps: ["Use the registered TARGET_CRATE.", "Keep dog start position, crate entrance, and path visible.", "Begin approximately 3 feet away.", "Give the send cue if used.", "Reward after the dog enters the open crate."],
    cameraAngle: "DOG_START_PATH_AND_CRATE_ENTRANCE",
    setupInstructions: ["Dog start position, TARGET_CRATE entrance, and path must be visible.", "Visible crate must match saved TARGET_CRATE photos.", "Crate door must remain open.", "Audio is required when cue timing is judged."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CRATE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Crate matches TARGET_CRATE.", "Dog starts approximately 3 feet away.", "Dog travels into crate.", "Crate door remains open.", "No physical forcing occurs."],
    failCriteria: ["Dog does not enter crate.", "Dog goes to wrong location.", "Owner physically moves dog."],
    needsReviewCriteria: ["Distance unclear.", "Path hidden.", "Crate identity unclear.", "Cue unclear when required."],
    outOfScopeClaims: ["Do not claim generalized crate send reliability.", "Do not infer emotional comfort."],
    safetyNotes: ["Keep crate open and stable.", "Do not force the dog inside."],
    prerequisiteActivityIds: ["HH005"],
    nextActivityId: "HH007",
    orderedVisibleActions: ["Target dog starts approximately 3 feet from registered open TARGET_CRATE with path visible.", "Dog travels toward crate entrance.", "Dog enters crate.", "Owner does not physically move the dog."],
    skillFamily: "Mat and Crate Tasks",
    level: 1,
  },
  {
    id: "HH007",
    title: "Carry Target Toy: 3 Feet",
    orderIndex: 7,
    lessonGoal: "Teach the dog to carry the registered target toy visibly for approximately 3 feet.",
    visibleCheckpoint: "Dog carries registered TARGET_TOY visibly for approximately 3 feet.",
    tutorialSteps: ["Use the registered TARGET_TOY.", "Keep dog mouth, toy, and route visible.", "Begin recording before or as the carry starts.", "Reward after approximately 3 feet of travel.", "Do not physically move the dog or toy."],
    cameraAngle: "DOG_MOUTH_TOY_AND_ROUTE",
    setupInstructions: ["Dog mouth, TARGET_TOY, and route must be visible.", "Visible toy must match saved TARGET_TOY photos.", "Approximate 3-foot distance must be judgeable.", "No physical assistance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Dog holds toy visibly.", "Approximately 3 feet of travel completes.", "No physical assistance occurs."],
    failCriteria: ["Dog drops toy before distance completes.", "Wrong toy is carried.", "Owner physically moves dog."],
    needsReviewCriteria: ["Dog mouth hidden.", "Toy identity unclear.", "Path cropped.", "Distance unclear."],
    outOfScopeClaims: ["Do not claim formal hold reliability.", "Do not infer retrieve completion."],
    safetyNotes: ["Use a safe toy.", "Keep the path clear."],
    prerequisiteActivityIds: ["HH001"],
    nextActivityId: "HH008",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, dog mouth, and route are visible.", "Dog holds toy in mouth.", "Dog carries toy approximately 3 feet.", "Owner does not physically assist."],
    skillFamily: "Carry and Bring Tasks",
    level: 1,
  },
  {
    id: "HH008",
    title: "Carry Target Toy: 6 Feet",
    orderIndex: 8,
    lessonGoal: "Teach the dog to carry the registered target toy visibly for approximately 6 feet.",
    visibleCheckpoint: "Dog carries registered TARGET_TOY visibly for approximately 6 feet.",
    tutorialSteps: ["Use the registered TARGET_TOY.", "Keep route, dog mouth, and toy visible.", "Begin recording before or as the carry starts.", "Reward after approximately 6 feet of travel.", "Do not physically guide the dog."],
    cameraAngle: "ROUTE_DOG_MOUTH_AND_TOY",
    setupInstructions: ["Route, dog mouth, and TARGET_TOY must be visible.", "Visible toy must match saved TARGET_TOY photos.", "Approximate 6-foot distance must be judgeable.", "No assistance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Toy remains in dog mouth.", "Approximately 6 feet of travel completes.", "No assistance occurs."],
    failCriteria: ["Toy is dropped early.", "Wrong toy is carried.", "Owner physically guides dog."],
    needsReviewCriteria: ["Mouth hidden.", "Route cropped.", "Distance unclear.", "Toy identity unclear."],
    outOfScopeClaims: ["Do not claim long carry reliability.", "Do not infer delivery skill yet."],
    safetyNotes: ["Use a safe toy.", "Keep route clear and non-slip."],
    prerequisiteActivityIds: ["HH007"],
    nextActivityId: "HH009",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, mouth, and route are visible.", "Dog holds toy in mouth.", "Dog carries toy approximately 6 feet.", "Owner does not physically guide dog."],
    skillFamily: "Carry and Bring Tasks",
    level: 1,
  },
  {
    id: "HH009",
    title: "Bring Visible Target Toy",
    orderIndex: 9,
    lessonGoal: "Teach the dog to travel to the registered visible toy, pick it up, and begin returning toward owner.",
    visibleCheckpoint: "Dog travels to registered visible TARGET_TOY, picks it up, and begins returning toward owner.",
    tutorialSteps: ["Use the registered TARGET_TOY.", "Keep toy, dog, owner, and path visible.", "Begin recording before the dog travels to the toy.", "Reward after pickup and return begins.", "Do not place toy in the dog's mouth."],
    cameraAngle: "TOY_DOG_OWNER_AND_PATH",
    setupInstructions: ["TARGET_TOY, dog, owner, and path must be visible.", "Visible toy must match saved TARGET_TOY photos.", "Pickup and return start must be visible.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Dog travels to toy.", "Pickup is visible.", "Return toward owner begins.", "No physical guidance occurs."],
    failCriteria: ["Wrong toy is selected.", "No pickup occurs.", "Dog does not begin return.", "Owner places toy in dog's mouth."],
    needsReviewCriteria: ["Toy hidden.", "Pickup obscured.", "Return path cropped.", "Toy identity unclear."],
    outOfScopeClaims: ["Do not claim full delivery behavior.", "Do not infer object-name recognition."],
    safetyNotes: ["Use a safe toy.", "Keep path clear."],
    prerequisiteActivityIds: ["HH008"],
    nextActivityId: "HH010",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, owner, and path are visible.", "Dog travels to the toy.", "Dog picks up the toy.", "Dog begins returning toward owner without physical guidance."],
    skillFamily: "Carry and Bring Tasks",
    level: 1,
  },
  {
    id: "HH010",
    title: "Bring Target Toy to Owner",
    orderIndex: 10,
    lessonGoal: "Teach the dog to pick up the registered target toy, carry it back, and reach owner area while holding it.",
    visibleCheckpoint: "Dog travels to registered TARGET_TOY, picks it up, carries it back, and reaches owner area while holding toy.",
    tutorialSteps: ["Use the registered TARGET_TOY.", "Keep owner, dog, toy, and route visible.", "Begin recording before the dog travels to the toy.", "Reward after dog reaches owner area while holding toy.", "Do not physically guide the dog."],
    cameraAngle: "OWNER_DOG_TOY_AND_ROUTE",
    setupInstructions: ["Owner, dog, TARGET_TOY, and route must be visible.", "Visible toy must match saved TARGET_TOY photos.", "Pickup, carry, and arrival must be visible.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Dog picks up toy.", "Dog carries toy toward owner.", "Dog reaches owner area while holding toy.", "No physical guidance occurs."],
    failCriteria: ["Wrong toy is used.", "No pickup occurs.", "Toy is dropped before arrival.", "Dog does not reach owner."],
    needsReviewCriteria: ["Pickup hidden.", "Dog mouth cropped.", "Route hidden.", "Arrival obscured."],
    outOfScopeClaims: ["Do not claim formal retrieve reliability.", "Do not infer service-task reliability."],
    safetyNotes: ["Use a safe toy.", "Keep route clear and low distraction."],
    prerequisiteActivityIds: ["HH009"],
    nextActivityId: "HH011",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, owner, and route are visible before travel.", "Dog travels to toy and picks it up.", "Dog carries toy back toward owner.", "Dog reaches owner area while holding toy without physical guidance."],
    skillFamily: "Carry and Bring Tasks",
    level: 1,
  },
];

export const HH001_HH010: BatchActivity[] = SPECS.map(makeActivity);
