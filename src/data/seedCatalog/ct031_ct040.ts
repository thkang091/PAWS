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
${list(spec.conditionalReferenceRules)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If required bell sound or cue timing is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is judged. Do not fail solely because audio is absent."}

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
    hipsRequired: ["CT031", "CT034", "CT035", "CT036", "CT037", "CT038", "CT039", "CT040"].includes(spec.id),
    ownerRequiredInFrame: spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")),
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: ["CT034", "CT035", "CT036", "CT037", "CT038", "CT039", "CT040"].includes(spec.id),
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
    whyItMatters: "This activity verifies one visible trick or game behavior in the submitted clip without claiming generalized performance.",
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
    xpReward: spec.orderIndex >= 38 ? 165 : spec.orderIndex >= 34 ? 160 : 155,
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
    id: "CT031",
    title: "Hide Face",
    orderIndex: 31,
    lessonGoal: "Teach the dog to place nose or face behind or beneath a configured visible prop or paw position.",
    visibleCheckpoint: "Dog visibly places nose or face behind or beneath the configured visible prop or paw position.",
    tutorialSteps: ["Choose the configured hide-face target area.", "Keep dog face and prop area visible.", "Begin recording before the face moves behind the target.", "Reward after the hide-face position is visible briefly.", "Do not physically place the dog's head."],
    cameraAngle: "CLOSE_DOG_FACE_AND_PROP_AREA",
    setupInstructions: ["Dog face and configured prop area must be visible.", "If a registered prop is used, object identity must be matchable.", "Hide-face position must be visible briefly.", "No physical forcing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["CUSTOM_OBJECT is required only when a registered hide-face prop is used; if registered prop identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog face begins visible.", "Dog visibly moves face behind configured target area.", "Hide-face position is visible briefly.", "No physical forcing occurs."],
    failCriteria: ["Dog does not cover or hide face.", "Owner physically places dog's head.", "Wrong target action occurs."],
    needsReviewCriteria: ["Dog face cropped.", "Prop hidden.", "Action unclear.", "Registered prop identity unclear."],
    outOfScopeClaims: ["Do not infer emotional behavior.", "Do not claim the dog is shy or embarrassed."],
    safetyNotes: ["Use a safe comfortable prop or paw position.", "Do not press the dog's head into place."],
    prerequisiteActivityIds: ["CT028", "CT029"],
    nextActivityId: "CT032",
    orderedVisibleActions: ["Target dog face and configured prop area are visible before action.", "Dog moves face behind or beneath the configured target area.", "Hide-face position is visible briefly.", "Owner does not physically place the dog's head."],
    skillFamily: "Paw and Face Tricks",
    level: 4,
  },
  {
    id: "CT032",
    title: "Touch Button",
    orderIndex: 32,
    lessonGoal: "Teach the dog to touch the registered button with nose or paw according to configured mode.",
    visibleCheckpoint: "Dog visibly touches the registered TARGET_BUTTON with nose or paw according to configured mode.",
    tutorialSteps: ["Use the registered TARGET_BUTTON.", "Keep the button and configured contact body part visible.", "Begin recording before contact.", "Reward after visible nose or paw contact.", "Do not press the dog into the button."],
    cameraAngle: "BUTTON_AND_CONTACT_BODY_PART",
    setupInstructions: ["TARGET_BUTTON and contact body part must be visible.", "Visible button must match saved TARGET_BUTTON photos.", "Configured nose or paw mode must be judgeable.", "No owner-forced contact may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BUTTON"],
    conditionalReferenceRules: ["Visible button must match saved TARGET_BUTTON reference photos."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Button matches TARGET_BUTTON.", "Configured nose or paw contact visibly occurs.", "No owner-forced contact occurs."],
    failCriteria: ["Dog does not contact button.", "Wrong object is contacted.", "Owner presses dog into button."],
    needsReviewCriteria: ["Button cropped.", "Contact point hidden.", "Object identity unclear."],
    outOfScopeClaims: ["Do not claim button communication has been learned.", "Do not infer semantic button meaning."],
    safetyNotes: ["Use a stable safe button.", "Do not push the dog's face or paw."],
    prerequisiteActivityIds: ["CT001"],
    nextActivityId: "CT033",
    orderedVisibleActions: ["Target dog, registered TARGET_BUTTON, and configured contact body part are visible before contact.", "Dog moves nose or paw toward the button.", "Configured contact visibly occurs.", "Owner does not press the dog into the button."],
    skillFamily: "Interactive Object Tricks",
    level: 4,
  },
  {
    id: "CT033",
    title: "Ring Bell",
    orderIndex: 33,
    lessonGoal: "Teach the dog to contact a registered bell so bell movement or an audible ring occurs.",
    visibleCheckpoint: "Dog visibly contacts registered TARGET_BELL and bell movement or audible ring occurs.",
    tutorialSteps: ["Use the registered TARGET_BELL.", "Keep bell and dog contact point visible.", "Begin recording before contact.", "Capture audio for the bell ring.", "Reward after dog contact causes bell movement or sound."],
    cameraAngle: "BELL_AND_DOG_CONTACT_POINT",
    setupInstructions: ["TARGET_BELL and dog contact point must be visible.", "Visible bell must match saved TARGET_BELL photos.", "Audio is required.", "Owner must not ring the bell instead."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BELL"],
    conditionalReferenceRules: ["Visible bell must match saved TARGET_BELL reference photos."],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Bell matches TARGET_BELL.", "Dog contact visibly occurs.", "Bell movement or audible ring is detected.", "No forced contact occurs."],
    failCriteria: ["No contact occurs.", "Wrong object is contacted.", "Owner rings bell instead.", "Owner physically pushes dog into bell."],
    needsReviewCriteria: ["Bell hidden.", "Contact point obscured.", "Audio unclear.", "Bell identity unclear."],
    outOfScopeClaims: ["Do not claim functional bell communication.", "Do not infer request intent."],
    safetyNotes: ["Use a stable safe bell.", "Keep bell volume comfortable."],
    prerequisiteActivityIds: ["CT032"],
    nextActivityId: "CT034",
    orderedVisibleActions: ["Target dog, registered TARGET_BELL, and contact point are visible before contact.", "Dog contacts the bell.", "Bell movement or audible ring occurs.", "Owner does not ring the bell or force contact."],
    skillFamily: "Interactive Object Tricks",
    level: 4,
  },
  {
    id: "CT034",
    title: "Retrieve Visible Toy",
    orderIndex: 34,
    lessonGoal: "Teach the dog to travel to a registered visible toy, pick it up, and begin returning toward owner.",
    visibleCheckpoint: "Dog travels to registered visible TARGET_TOY, takes it into mouth, and begins returning toward owner.",
    tutorialSteps: ["Use the registered TARGET_TOY.", "Keep toy, dog, owner, and travel path visible.", "Begin recording before the dog travels to the toy.", "Reward after pickup and return begins.", "Do not place the toy in the dog's mouth."],
    cameraAngle: "WIDE_TOY_DOG_OWNER_TRAVEL_PATH",
    setupInstructions: ["TARGET_TOY, dog, owner, and travel path must be visible.", "Visible toy must match saved TARGET_TOY photos.", "Pickup and return start must be visible.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    conditionalReferenceRules: ["Visible toy must match saved TARGET_TOY reference photos."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Dog travels to toy.", "Dog picks up toy.", "Dog begins return toward owner.", "No physical guidance occurs."],
    failCriteria: ["Dog ignores toy.", "Dog picks up wrong object.", "Dog does not begin return.", "Owner places toy in dog mouth."],
    needsReviewCriteria: ["Toy hidden.", "Pickup obscured.", "Return path cropped.", "Toy identity unclear."],
    outOfScopeClaims: ["Do not claim formal retrieve reliability.", "Do not infer object-name understanding."],
    safetyNotes: ["Use a safe toy.", "Keep route clear."],
    prerequisiteActivityIds: ["CT001"],
    nextActivityId: "CT035",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, owner, and travel path are visible before travel.", "Dog travels to the toy.", "Dog takes toy into mouth.", "Dog begins returning toward owner without physical guidance."],
    skillFamily: "Toy Games",
    level: 4,
  },
  {
    id: "CT035",
    title: "Carry Toy: 3 Feet",
    orderIndex: 35,
    lessonGoal: "Teach the dog to carry the registered toy visibly for approximately 3 feet.",
    visibleCheckpoint: "Dog carries registered TARGET_TOY visibly for approximately 3 feet.",
    tutorialSteps: ["Use the registered TARGET_TOY.", "Keep dog mouth, toy, and travel path visible.", "Begin recording before or as the carry starts.", "Reward after approximately 3 feet of travel.", "Do not physically move the dog or toy."],
    cameraAngle: "DOG_MOUTH_TOY_AND_TRAVEL_PATH",
    setupInstructions: ["Dog mouth, TARGET_TOY, and travel path must be visible.", "Visible toy must match saved TARGET_TOY photos.", "Approximate 3-foot distance must be judgeable.", "No physical assistance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    conditionalReferenceRules: ["Visible toy must match saved TARGET_TOY reference photos."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Toy remains visibly held in dog mouth.", "Approximately 3 feet of travel completes.", "No physical assistance occurs."],
    failCriteria: ["Dog drops toy before distance completes.", "Wrong toy is carried.", "Owner physically moves dog or toy."],
    needsReviewCriteria: ["Toy hidden by angle.", "Route cropped.", "Distance unclear.", "Dog mouth obscured."],
    outOfScopeClaims: ["Do not claim formal hold reliability.", "Do not infer retrieve completion."],
    safetyNotes: ["Use a safe toy.", "Keep the path clear and non-slip."],
    prerequisiteActivityIds: ["CT034"],
    nextActivityId: "CT036",
    orderedVisibleActions: ["Target dog, mouth, registered TARGET_TOY, and travel path are visible.", "Dog holds the toy in mouth.", "Dog carries the toy approximately 3 feet.", "Owner does not physically move dog or toy."],
    skillFamily: "Toy Games",
    level: 4,
  },
  {
    id: "CT036",
    title: "Toy into Basket",
    orderIndex: 36,
    lessonGoal: "Teach the dog to carry the registered toy to the registered basket and release it inside the basket boundary.",
    visibleCheckpoint: "Dog carries registered TARGET_TOY to registered TARGET_BASKET and visibly releases toy inside basket boundary.",
    tutorialSteps: ["Use the registered TARGET_TOY and TARGET_BASKET.", "Keep toy, basket, dog mouth, and route visible.", "Begin recording before the carry to basket.", "Reward after release inside the basket boundary.", "Do not place the toy into the basket by hand."],
    cameraAngle: "TOY_BASKET_DOG_MOUTH_AND_ROUTE",
    setupInstructions: ["TARGET_TOY, TARGET_BASKET, dog mouth, and route must be visible.", "Visible toy and basket must match saved references.", "Release inside basket boundary must be visible.", "No forced placement may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
    conditionalReferenceRules: ["Visible toy must match TARGET_TOY and visible basket must match TARGET_BASKET reference photos."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Basket matches TARGET_BASKET.", "Dog carries toy to basket.", "Release occurs inside basket boundary.", "No forced placement occurs."],
    failCriteria: ["Toy is dropped outside basket.", "Wrong basket is used.", "Owner places toy into basket.", "No release occurs."],
    needsReviewCriteria: ["Basket cropped.", "Release hidden.", "Toy identity unclear.", "Basket identity unclear.", "Dog mouth hidden."],
    outOfScopeClaims: ["Do not claim a finished tidy-up behavior.", "Do not infer object sorting ability."],
    safetyNotes: ["Use a safe basket and toy.", "Keep basket stable."],
    prerequisiteActivityIds: ["CT035"],
    nextActivityId: "CT037",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, registered TARGET_BASKET, dog mouth, and route are visible.", "Dog carries toy to basket.", "Dog releases toy inside basket boundary.", "Owner does not place toy into basket."],
    skillFamily: "Toy Games",
    level: 4,
  },
  {
    id: "CT037",
    title: "Find Visible Toy",
    orderIndex: 37,
    lessonGoal: "Teach the dog to travel to the registered visible toy in the scene and contact or pick it up.",
    visibleCheckpoint: "Dog visibly travels to the registered TARGET_TOY among the visible scene and contacts or picks it up.",
    tutorialSteps: ["Use the registered TARGET_TOY.", "Keep toy, dog, and route visible.", "Begin recording before the dog travels to the toy.", "Reward after contact or pickup according to the configured completion rule.", "Do not physically move the dog to the toy."],
    cameraAngle: "VISIBLE_TOY_DOG_AND_ROUTE",
    setupInstructions: ["TARGET_TOY, dog, and route must be visible.", "Visible toy must match saved TARGET_TOY photos.", "Configured completion rule must be clear: contact or pickup.", "No owner physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    conditionalReferenceRules: ["Visible toy must match saved TARGET_TOY reference photos."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Dog travels toward toy.", "Dog touches or picks up toy according to configured completion rule.", "No owner physical guidance occurs."],
    failCriteria: ["Dog selects wrong object.", "Dog does not reach toy.", "Owner moves dog to toy."],
    needsReviewCriteria: ["Toy hidden.", "Route cropped.", "Object identity unclear."],
    outOfScopeClaims: ["Do not claim scent work ability.", "Do not infer object-name recognition."],
    safetyNotes: ["Use a safe toy.", "Keep the search area clear."],
    prerequisiteActivityIds: ["CT034"],
    nextActivityId: "CT038",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, and route are visible.", "Dog travels toward the toy.", "Dog contacts or picks up the toy according to configured completion rule.", "Owner does not physically guide the dog."],
    skillFamily: "Toy Games",
    level: 4,
  },
  {
    id: "CT038",
    title: "One-Box Search",
    orderIndex: 38,
    lessonGoal: "Teach the dog to investigate the registered box and locate or indicate the configured target area.",
    visibleCheckpoint: "Dog investigates registered TARGET_BOX and locates the visible or partially concealed target item inside or beside the box.",
    tutorialSteps: ["Use the registered TARGET_BOX.", "Keep box, dog, and target-item area visible.", "Begin recording before the dog approaches the box.", "Reward after the dog locates or indicates the configured target area.", "Do not physically direct the dog into the box."],
    cameraAngle: "BOX_DOG_AND_TARGET_ITEM_AREA",
    setupInstructions: ["TARGET_BOX, dog, and target-item area must be visible.", "Visible box must match saved TARGET_BOX photos.", "Search behavior must be visible.", "No physical direction into the box may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BOX"],
    conditionalReferenceRules: ["Visible box must match saved TARGET_BOX reference photos."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Box matches TARGET_BOX.", "Dog approaches box.", "Dog visibly investigates box.", "Dog locates or indicates configured target area."],
    failCriteria: ["Dog does not investigate box.", "Dog investigates wrong box.", "Owner physically directs dog into box."],
    needsReviewCriteria: ["Box cropped.", "Target area hidden.", "Search behavior unclear.", "Box identity unclear."],
    outOfScopeClaims: ["Do not claim scent-detection ability generally.", "Do not infer search reliability outside the clip."],
    safetyNotes: ["Use a safe box without sharp edges.", "Do not trap the dog inside the box."],
    prerequisiteActivityIds: ["CT037"],
    nextActivityId: "CT039",
    orderedVisibleActions: ["Target dog, registered TARGET_BOX, and target-item area are visible before search.", "Dog approaches the box.", "Dog visibly investigates the box.", "Dog locates or indicates configured target area without physical direction."],
    skillFamily: "Search Games",
    level: 4,
  },
  {
    id: "CT039",
    title: "Cone Weave",
    orderIndex: 39,
    lessonGoal: "Teach the dog to follow a visible weave path through registered cone markers.",
    visibleCheckpoint: "Dog follows a visible weave path through registered TARGET_CONE markers.",
    tutorialSteps: ["Use the registered TARGET_CONE marker set.", "Keep cones, dog, owner, and path visible.", "Begin recording before the weave starts.", "Reward after the dog passes required markers in order.", "Do not drag the dog through the route."],
    cameraAngle: "WIDE_CONES_DOG_OWNER_AND_PATH",
    setupInstructions: ["TARGET_CONE markers, dog, owner, and path must be visible.", "Visible cones must match saved TARGET_CONE set reference photos.", "Marker order must be judgeable.", "No physical dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CONE"],
    conditionalReferenceRules: ["Visible cone markers must match saved TARGET_CONE reference photos."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Cones match TARGET_CONE set.", "Dog follows configured weave route.", "Dog passes required markers in order.", "No physical dragging occurs."],
    failCriteria: ["Route order is incorrect.", "Cone markers are skipped.", "Dog leaves route.", "Owner drags dog."],
    needsReviewCriteria: ["Cone route cropped.", "Marker order unclear.", "Dog hidden.", "Cone identity unclear."],
    outOfScopeClaims: ["Do not infer agility skill generally.", "Do not claim formal weave-pole performance."],
    safetyNotes: ["Use stable lightweight cones.", "Keep spacing comfortable and safe."],
    prerequisiteActivityIds: ["CT014"],
    nextActivityId: "CT040",
    orderedVisibleActions: ["Target dog, registered TARGET_CONE markers, owner, and path are visible before weave.", "Dog enters configured weave route.", "Dog passes required cone markers in order.", "Dog completes route without dragging."],
    skillFamily: "Obstacle Games",
    level: 4,
  },
  {
    id: "CT040",
    title: "Ground Poles",
    orderIndex: 40,
    lessonGoal: "Teach the dog to travel across or through a visible ground-pole setup while stepping over required poles.",
    visibleCheckpoint: "Dog travels across or through a visible ground-pole setup while stepping over poles according to configured route.",
    tutorialSteps: ["Set up safe low ground poles.", "Register CUSTOM_OBJECT only when the saved ground-pole object flow is required.", "Keep poles, dog paws, and route visible.", "Begin recording before the route starts.", "Reward after the dog steps over required poles without lifting or dragging."],
    cameraAngle: "GROUND_POLES_DOG_PAWS_AND_ROUTE",
    setupInstructions: ["Poles, dog paws, and route must be visible.", "If registered ground-pole objects are required, object identity must be matchable.", "Required pole steps must be visible.", "No dragging or lifting may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["CUSTOM_OBJECT is required only when registered ground-pole objects are required; if registered setup identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Ground-pole setup is visible.", "Dog travels through route.", "Dog steps over required poles.", "No dragging or lifting occurs."],
    failCriteria: ["Dog avoids route.", "Dog does not step over required poles.", "Owner physically moves dog through setup."],
    needsReviewCriteria: ["Paws hidden.", "Poles cropped.", "Route unclear.", "Setup identity unclear when registered."],
    outOfScopeClaims: ["Do not infer agility skill generally.", "Do not infer physical fitness."],
    safetyNotes: ["Use low stable poles.", "Keep spacing safe and avoid slippery surfaces."],
    prerequisiteActivityIds: ["CT039"],
    nextActivityId: "CT041",
    orderedVisibleActions: ["Target dog, paws, ground-pole setup, and route are visible before entry.", "Dog travels across or through configured route.", "Dog steps over required poles.", "Owner does not drag, lift, or physically move the dog."],
    skillFamily: "Obstacle Games",
    level: 4,
  },
];

export const CT031_CT040: BatchActivity[] = SPECS.map(makeActivity);
