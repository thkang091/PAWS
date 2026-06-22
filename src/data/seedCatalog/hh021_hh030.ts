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
${spec.audioRequired ? "Audio is required. If required ring audio, spoken cue, or cue timing is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is judged. If a spoken person cue, spoken object cue, or cue timing is part of the submitted attempt and audio is unclear, return NEEDS_REVIEW."}

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
    xpReward: spec.orderIndex >= 28 ? 155 : spec.orderIndex >= 24 ? 150 : 145,
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
    id: "HH021",
    title: "Multi-Box Search",
    orderIndex: 21,
    lessonGoal: "Teach the dog to investigate a visible multi-box setup and locate or indicate the configured target box or area.",
    visibleCheckpoint: "Dog investigates a visible setup containing multiple registered boxes and locates the configured target area.",
    tutorialSteps: ["Use multiple registered TARGET_BOX items.", "Keep boxes, dog, and search area visible.", "Begin recording before the dog enters the search area.", "Let the dog investigate without physical guidance.", "Reward after the dog locates or indicates the configured target area."],
    cameraAngle: "MULTIPLE_BOXES_DOG_AND_SEARCH_AREA",
    setupInstructions: ["Multiple TARGET_BOX items, dog, and search area must be visible.", "Registered boxes must match saved TARGET_BOX photos.", "Dog search path and target indication must be visible.", "No owner physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BOX"],
    conditionalReferenceRules: ["All registered boxes visible in the attempt must be matchable to saved TARGET_BOX references; unclear box identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Registered boxes are visible.", "Dog investigates multiple boxes or search area.", "Dog locates or indicates configured target box or target area.", "No owner physical guidance occurs."],
    failCriteria: ["Dog does not investigate search area.", "Dog indicates the wrong box when target box is configured.", "Owner physically directs dog to correct box."],
    needsReviewCriteria: ["Boxes cropped.", "Box identity unclear.", "Dog search path hidden.", "Target indication unclear."],
    outOfScopeClaims: ["Do not claim professional scent-detection ability.", "Do not infer broad search reliability."],
    safetyNotes: ["Use safe boxes without sharp edges.", "Do not trap the dog inside boxes."],
    prerequisiteActivityIds: ["HH020"],
    nextActivityId: "HH022",
    orderedVisibleActions: ["Target dog, multiple registered TARGET_BOX items, and search area are visible.", "Dog investigates multiple boxes or the search area.", "Dog locates or indicates the configured target box or area.", "Owner does not physically guide the dog."],
    skillFamily: "Search Tasks",
    level: 3,
  },
  {
    id: "HH022",
    title: "Find Family Member in Same Room",
    orderIndex: 22,
    lessonGoal: "Teach the dog to travel to a specified visible family member in the same room.",
    visibleCheckpoint: "Dog visibly travels to the specified visible family member in the same room.",
    tutorialSteps: ["Keep dog, target family member, and route visible.", "Begin with the dog away from the target person.", "Give the spoken person cue if used.", "Record travel to the target person.", "Reward after the dog reaches the person area."],
    cameraAngle: "DOG_TARGET_PERSON_AND_ROUTE",
    setupInstructions: ["Dog, target family member, and route must be visible.", "Audio is required when spoken person cue timing is judged.", "Multiple people must be distinguishable when present.", "No owner physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional saved person reference is required; if multiple people make the target ambiguous, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Target person is visible.", "Cue is audible when required.", "Dog travels toward specified person.", "Dog reaches person area.", "No owner physical guidance occurs."],
    failCriteria: ["Dog travels to wrong person.", "Dog does not reach target person.", "Owner physically directs dog."],
    needsReviewCriteria: ["Person cropped.", "Route hidden.", "Cue unclear when required.", "Multiple people ambiguous."],
    outOfScopeClaims: ["Do not claim broad person-name comprehension.", "Do not infer generalized search ability."],
    safetyNotes: ["Use a familiar safe room.", "Do not pressure the dog toward anyone."],
    prerequisiteActivityIds: ["HH001"],
    nextActivityId: "HH023",
    orderedVisibleActions: ["Target dog, specified visible family member, and route are visible.", "Cue occurs when used.", "Dog travels toward the specified person.", "Dog reaches the person area without physical guidance."],
    skillFamily: "Family-Member Tasks",
    level: 3,
  },
  {
    id: "HH023",
    title: "Find Family Member in Next Room",
    orderIndex: 23,
    lessonGoal: "Teach the dog to travel through a visible route to a specified family member in an adjacent room.",
    visibleCheckpoint: "Dog begins in one room, travels through visible route, and reaches the specified family member in the adjacent room.",
    tutorialSteps: ["Set up an adjacent-room route.", "Keep start area, doorway route, and destination person visible when possible.", "Begin with dog away from the target person.", "Give the spoken cue if used.", "Reward after dog reaches the specified person area."],
    cameraAngle: "START_AREA_DOORWAY_ROUTE_AND_DESTINATION_PERSON",
    setupInstructions: ["Start area, doorway route, and destination person should be visible when possible.", "Audio is required when spoken cue timing is judged.", "Room transition must be scorable.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional saved person reference is required; if target person identity is ambiguous, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins away from target person.", "Dog travels through visible route.", "Dog reaches specified person area.", "No physical guidance occurs."],
    failCriteria: ["Dog reaches wrong person.", "Dog does not complete route.", "Owner physically leads dog to person."],
    needsReviewCriteria: ["Route hidden.", "Destination person cropped.", "Transition between rooms unclear.", "Cue unclear when required."],
    outOfScopeClaims: ["Do not claim generalized search ability.", "Do not claim person-name comprehension."],
    safetyNotes: ["Use a safe clear route.", "Avoid stairs or obstacles for this early version."],
    prerequisiteActivityIds: ["HH022"],
    nextActivityId: "HH024",
    orderedVisibleActions: ["Target dog begins away from the specified family member.", "Dog travels through visible route or doorway transition.", "Dog reaches the specified person area.", "Owner does not physically lead the dog."],
    skillFamily: "Family-Member Tasks",
    level: 3,
  },
  {
    id: "HH024",
    title: "Deliver Toy to Family Member",
    orderIndex: 24,
    lessonGoal: "Teach the dog to carry the registered target toy to the specified visible family member.",
    visibleCheckpoint: "Dog carries registered TARGET_TOY to the specified visible family member and reaches that person while holding the toy.",
    tutorialSteps: ["Use the registered TARGET_TOY.", "Keep dog, toy, target person, and route visible.", "Begin recording before the carry starts.", "Reward after the dog reaches the specified person while holding the toy.", "Do not physically guide the dog."],
    cameraAngle: "DOG_TOY_TARGET_PERSON_AND_ROUTE",
    setupInstructions: ["Dog, TARGET_TOY, target person, and route must be visible.", "Visible toy must match saved TARGET_TOY photos.", "Dog mouth and arrival must be visible.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    conditionalReferenceRules: ["If multiple people are visible and target person is ambiguous, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Dog carries toy.", "Dog reaches specified person area.", "Toy remains visibly held until arrival.", "No physical guidance occurs."],
    failCriteria: ["Wrong toy is used.", "Dog reaches wrong person.", "Toy is dropped before arrival.", "Owner physically guides dog."],
    needsReviewCriteria: ["Toy hidden.", "Target person unclear.", "Route cropped.", "Dog mouth obscured."],
    outOfScopeClaims: ["Do not claim generalized delivery reliability.", "Do not infer person-name comprehension."],
    safetyNotes: ["Use a safe toy.", "Keep the route clear."],
    prerequisiteActivityIds: ["HH010", "HH022"],
    nextActivityId: "HH025",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, specified family member, and route are visible.", "Dog carries the toy.", "Dog travels to the specified person.", "Dog reaches the person area while still holding toy without physical guidance."],
    skillFamily: "Family-Member Tasks",
    level: 3,
  },
  {
    id: "HH025",
    title: "Carry Lightweight Object",
    orderIndex: 25,
    lessonGoal: "Teach the dog to carry a safe lightweight object for a configured short distance.",
    visibleCheckpoint: "Dog carries a registered lightweight safe object visibly for the configured short distance.",
    tutorialSteps: ["Choose a lightweight safe object.", "Register CUSTOM_OBJECT when the object-registration flow is used.", "Keep dog mouth, object, and route visible.", "Begin before or as the carry starts.", "Reward after the configured short distance."],
    cameraAngle: "DOG_MOUTH_OBJECT_AND_ROUTE",
    setupInstructions: ["Dog mouth, object, and route must be visible.", "Object must be lightweight and safe.", "Object identity must be matchable when registered.", "No physical assistance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["CUSTOM_OBJECT is required when the carried lightweight object is registered; if registered object identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Object matches registered CUSTOM_OBJECT when required.", "Dog holds object visibly.", "Configured short distance completes.", "No physical assistance occurs."],
    failCriteria: ["Object is dropped before distance completes.", "Wrong object is carried.", "Owner physically moves dog or object."],
    needsReviewCriteria: ["Object hidden.", "Dog mouth obscured.", "Route cropped.", "Distance unclear.", "Object identity unclear."],
    outOfScopeClaims: ["Do not claim service-task reliability.", "Do not infer suitability for carrying all household objects."],
    safetyNotes: ["Use only lightweight safe objects.", "Avoid sharp, breakable, toxic, or heavy items."],
    prerequisiteActivityIds: ["HH007"],
    nextActivityId: "HH026",
    orderedVisibleActions: ["Target dog, lightweight object, dog mouth, and route are visible.", "Dog holds the object visibly.", "Dog carries the object for the configured short distance.", "Owner does not physically assist."],
    skillFamily: "Object Carry Tasks",
    level: 3,
  },
  {
    id: "HH026",
    title: "Carry Object to Mat",
    orderIndex: 26,
    lessonGoal: "Teach the dog to carry a lightweight object to the registered mat boundary.",
    visibleCheckpoint: "Dog carries registered lightweight object to registered TARGET_MAT and reaches the mat boundary while holding the object.",
    tutorialSteps: ["Use a lightweight safe object and the registered TARGET_MAT.", "Register CUSTOM_OBJECT when object-registration is used.", "Keep object, dog mouth, route, and full mat visible.", "Begin before the carry starts.", "Reward when the dog reaches the mat boundary while holding the object."],
    cameraAngle: "OBJECT_DOG_MOUTH_ROUTE_AND_FULL_MAT",
    setupInstructions: ["Object, dog mouth, route, and full TARGET_MAT must be visible.", "Visible mat must match saved TARGET_MAT photos.", "Object identity must be matchable when registered.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    conditionalReferenceRules: ["CUSTOM_OBJECT is required when the carried lightweight object is registered; if registered object identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Object matches registered reference.", "Mat matches TARGET_MAT.", "Dog carries object to mat.", "Dog reaches mat boundary while holding object.", "No physical guidance occurs."],
    failCriteria: ["Wrong object is used.", "Dog drops object before mat.", "Dog travels to wrong destination.", "Owner physically guides dog."],
    needsReviewCriteria: ["Object hidden.", "Mat cropped.", "Route unclear.", "Dog mouth hidden."],
    outOfScopeClaims: ["Do not claim service-task reliability.", "Do not infer generalized delivery behavior."],
    safetyNotes: ["Use only lightweight safe objects.", "Keep route clear and mat stable."],
    prerequisiteActivityIds: ["HH025", "HH002"],
    nextActivityId: "HH027",
    orderedVisibleActions: ["Target dog, object, dog mouth, route, and registered TARGET_MAT are visible.", "Dog carries object along route.", "Dog reaches mat boundary while still holding object.", "Owner does not physically guide dog."],
    skillFamily: "Object Carry Tasks",
    level: 3,
  },
  {
    id: "HH027",
    title: "Place Object into Basket",
    orderIndex: 27,
    lessonGoal: "Teach the dog to carry a lightweight object to the registered basket and release it inside.",
    visibleCheckpoint: "Dog carries registered lightweight object to registered TARGET_BASKET and visibly releases it inside basket boundary.",
    tutorialSteps: ["Use a lightweight safe object and registered TARGET_BASKET.", "Register CUSTOM_OBJECT when object-registration is used.", "Keep object, dog mouth, basket, and route visible.", "Begin before carry starts.", "Reward after release inside basket boundary."],
    cameraAngle: "OBJECT_DOG_MOUTH_BASKET_AND_ROUTE",
    setupInstructions: ["Object, dog mouth, TARGET_BASKET, and route must be visible.", "Visible basket must match saved TARGET_BASKET photos.", "Object identity must be matchable when registered.", "No owner placement may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BASKET"],
    conditionalReferenceRules: ["CUSTOM_OBJECT is required when the carried lightweight object is registered; if registered object identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Object matches registered reference.", "Basket matches TARGET_BASKET.", "Dog carries object to basket.", "Dog releases object inside basket boundary.", "No owner placement occurs."],
    failCriteria: ["Object is dropped outside basket.", "Wrong basket is used.", "Owner places object into basket.", "No visible release occurs."],
    needsReviewCriteria: ["Release hidden.", "Basket cropped.", "Object identity unclear.", "Dog mouth hidden."],
    outOfScopeClaims: ["Do not claim service-task reliability.", "Do not infer generalized cleanup behavior."],
    safetyNotes: ["Use only lightweight safe objects.", "Keep the basket stable."],
    prerequisiteActivityIds: ["HH026"],
    nextActivityId: "HH028",
    orderedVisibleActions: ["Target dog, object, dog mouth, registered TARGET_BASKET, and route are visible.", "Dog carries object to basket.", "Dog releases object inside basket boundary.", "Owner does not place object into basket."],
    skillFamily: "Object Carry Tasks",
    level: 3,
  },
  {
    id: "HH028",
    title: "Touch Target Button",
    orderIndex: 28,
    lessonGoal: "Teach the dog to touch the registered target button with nose or paw according to configured mode.",
    visibleCheckpoint: "Dog visibly touches registered TARGET_BUTTON with nose or paw according to configured mode.",
    tutorialSteps: ["Use the registered TARGET_BUTTON.", "Keep button and configured contact body part visible.", "Begin recording before contact.", "Reward after visible contact.", "Do not physically press the dog into the button."],
    cameraAngle: "BUTTON_AND_CONTACT_BODY_PART",
    setupInstructions: ["TARGET_BUTTON and contact body part must be visible.", "Visible button must match saved TARGET_BUTTON photos.", "Configured nose or paw mode must be clear.", "No owner-forced contact may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BUTTON"],
    conditionalReferenceRules: ["Visible button must match saved TARGET_BUTTON reference photos."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Button matches TARGET_BUTTON.", "Configured nose or paw contact occurs visibly.", "No owner-forced contact occurs."],
    failCriteria: ["Dog does not touch button.", "Dog contacts wrong object.", "Owner physically presses dog into button."],
    needsReviewCriteria: ["Button cropped.", "Contact point hidden.", "Object identity unclear.", "Touch moment obscured."],
    outOfScopeClaims: ["Do not claim button communication.", "Do not infer semantic button understanding."],
    safetyNotes: ["Use a stable safe button.", "Do not push the dog into it."],
    prerequisiteActivityIds: ["HH001"],
    nextActivityId: "HH029",
    orderedVisibleActions: ["Target dog, registered TARGET_BUTTON, and configured contact body part are visible.", "Dog moves nose or paw toward button.", "Dog visibly touches button.", "Owner does not force contact."],
    skillFamily: "Button and Bell Tasks",
    level: 3,
  },
  {
    id: "HH029",
    title: "Push Target Button",
    orderIndex: 29,
    lessonGoal: "Teach the dog to apply contact to the registered button and produce visible movement or activation.",
    visibleCheckpoint: "Dog visibly applies contact to registered TARGET_BUTTON and produces visible button movement or activation response.",
    tutorialSteps: ["Use the registered TARGET_BUTTON.", "Keep button and contact body part visible.", "Begin before contact.", "Record button movement or activation response.", "Reward after visible activation without owner activation."],
    cameraAngle: "BUTTON_CONTACT_AND_ACTIVATION_RESPONSE",
    setupInstructions: ["TARGET_BUTTON, contact body part, and activation response must be visible.", "Visible button must match saved TARGET_BUTTON photos.", "Activation response must be judgeable.", "Owner must not activate the button."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BUTTON"],
    conditionalReferenceRules: ["Visible button must match saved TARGET_BUTTON reference photos."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Button matches TARGET_BUTTON.", "Dog contact visibly occurs.", "Button movement or configured activation response is visible.", "No owner-forced contact occurs."],
    failCriteria: ["Dog touches but does not activate button when activation is required.", "Wrong object is contacted.", "Owner activates button."],
    needsReviewCriteria: ["Activation response hidden.", "Button cropped.", "Contact unclear.", "Object identity unclear."],
    outOfScopeClaims: ["Do not claim button communication.", "Do not infer semantic button meaning."],
    safetyNotes: ["Use a safe stable button.", "Keep volume or activation response comfortable."],
    prerequisiteActivityIds: ["HH028"],
    nextActivityId: "HH030",
    orderedVisibleActions: ["Target dog, registered TARGET_BUTTON, contact body part, and activation response area are visible.", "Dog contacts the button.", "Button movement or configured activation response occurs.", "Owner does not activate button."],
    skillFamily: "Button and Bell Tasks",
    level: 3,
  },
  {
    id: "HH030",
    title: "Ring Target Bell",
    orderIndex: 30,
    lessonGoal: "Teach the dog to contact the registered bell so bell movement or an audible ring occurs.",
    visibleCheckpoint: "Dog visibly contacts registered TARGET_BELL and bell movement or audible ring occurs.",
    tutorialSteps: ["Use the registered TARGET_BELL.", "Keep bell and contact area visible.", "Begin recording before contact.", "Capture audio for the bell ring.", "Reward after dog contact causes bell movement or ring."],
    cameraAngle: "BELL_AND_CONTACT_AREA",
    setupInstructions: ["TARGET_BELL and contact area must be visible.", "Visible bell must match saved TARGET_BELL photos.", "Audio is required.", "Owner must not ring bell or push dog into bell."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BELL"],
    conditionalReferenceRules: ["Visible bell must match saved TARGET_BELL reference photos."],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Bell matches TARGET_BELL.", "Dog contact visibly occurs.", "Bell moves or audible ring is detected.", "No owner-forced contact occurs."],
    failCriteria: ["Dog does not contact bell.", "Owner rings bell instead.", "Wrong object is contacted.", "Owner physically pushes dog into bell."],
    needsReviewCriteria: ["Bell hidden.", "Contact obscured.", "Ring audio unclear.", "Bell identity unclear."],
    outOfScopeClaims: ["Do not claim bell communication.", "Do not infer alerting or service behavior."],
    safetyNotes: ["Use a stable safe bell.", "Keep bell volume comfortable."],
    prerequisiteActivityIds: ["HH029"],
    nextActivityId: "HH031",
    orderedVisibleActions: ["Target dog, registered TARGET_BELL, and contact area are visible.", "Dog contacts the bell.", "Bell movement or audible ring occurs.", "Owner does not ring bell or force contact."],
    skillFamily: "Button and Bell Tasks",
    level: 3,
  },
];

export const HH021_HH030: BatchActivity[] = SPECS.map(makeActivity);
