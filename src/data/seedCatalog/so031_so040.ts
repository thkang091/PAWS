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
  hipsRequired: boolean;
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
- Hips required: ${spec.hipsRequired ? "YES" : "NO"}
- Owner or handler in frame required: ${spec.ownerRequiredInFrame ? "YES" : "NO"}
- Target object in frame required: ${spec.targetObjectRequiredInFrame ? "YES" : "NO"}
- Destination in frame required: ${spec.destinationRequiredInFrame ? "YES" : "NO"}
${list(spec.setupInstructions)}

REQUIRED REFERENCES
${list(spec.requiredReferenceAssets)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If the required cue, release cue, drop cue, or timing audio is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is being judged. Do not fail solely because audio is absent; return NEEDS_REVIEW only if timing cannot be judged without audio."}

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
    fullDogBodyRequired: spec.fullDogBodyRequired,
    pawsRequired: spec.pawsRequired,
    hipsRequired: spec.hipsRequired,
    ownerRequiredInFrame: spec.ownerRequiredInFrame,
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: spec.targetObjectRequiredInFrame,
    destinationRequiredInFrame: spec.destinationRequiredInFrame,
    setupInstructions: spec.setupInstructions,
  };
  const prerequisiteActivityId = spec.prerequisiteActivityIds[0] ?? null;
  const activity: SeedActivity = {
    id: spec.id,
    category: "SAFETY_AND_OBEDIENCE",
    sequenceNumber: spec.orderIndex,
    level: spec.level,
    title: spec.title,
    skillFamily: spec.skillFamily,
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity builds one observable safety or obedience behavior without claiming broader reliability outside the submitted clip.",
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
    xpReward: spec.orderIndex >= 39 ? 135 : spec.orderIndex >= 35 ? 125 : 120,
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
    id: "SO031",
    title: "Emergency Recall Conditioning",
    orderIndex: 31,
    lessonGoal: "Pair one audible emergency-recall cue with prompt visible jackpot reward delivery.",
    visibleCheckpoint: "One audible emergency-recall cue is followed promptly by visible jackpot reward delivery.",
    tutorialSteps: [
      "Prepare a safe high-value jackpot reward.",
      "Position the camera so the dog and reward hand are visible.",
      "Begin recording before the emergency-recall cue.",
      "Give one audible emergency-recall cue.",
      "Promptly deliver the jackpot reward to the target dog.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Dog and reward hand must be visible.",
      "Audio is required.",
      "Begin recording before the emergency cue.",
      "Distance travel is not required for this conditioning activity.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Emergency cue is audible.",
      "Reward is delivered promptly afterward.",
      "Reward reaches target dog.",
    ],
    failCriteria: [
      "Reward occurs before cue.",
      "No reward follows cue.",
      "Reward is delivered to wrong dog.",
    ],
    needsReviewCriteria: [
      "Cue unclear.",
      "Reward hidden.",
      "Timing unclear.",
      "Dog identity unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim emergency recall is learned.",
      "Do not claim real-world emergency reliability.",
    ],
    safetyNotes: [
      "Use a safe high-value reward.",
      "Avoid overfeeding.",
    ],
    prerequisiteActivityIds: ["SO001"],
    nextActivityId: "SO032",
    orderedVisibleActions: [
      "Target dog and reward hand are visible before the emergency-recall cue.",
      "One emergency-recall cue is audible.",
      "Jackpot reward delivery begins promptly after the cue.",
      "Reward is visibly delivered to the target dog without requiring distance travel.",
    ],
    skillFamily: "Emergency Recall",
    level: 3,
    fullDogBodyRequired: false,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: false,
  },
  {
    id: "SO032",
    title: "Emergency Recall: Short Safe Distance",
    orderIndex: 32,
    lessonGoal: "Teach the dog to travel to the owner from a short safe distance after an audible emergency cue.",
    visibleCheckpoint: "Audible emergency cue, dog travels toward owner, and dog arrives.",
    tutorialSteps: [
      "Use a safe enclosed setup.",
      "Keep the dog, path, and owner visible.",
      "Begin recording before the emergency cue.",
      "Give one audible emergency cue.",
      "Reward when the dog reaches the owner area.",
    ],
    cameraAngle: "WIDE_SAFE_RECALL_AREA",
    setupInstructions: [
      "Safe enclosed setup must be visible or clearly represented.",
      "Dog, path, and owner must be visible.",
      "Audio is required.",
      "Movement toward owner must begin after the cue.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Emergency cue is audible.",
      "Dog reorients after cue.",
      "Dog reaches owner.",
    ],
    failCriteria: [
      "No recall occurs.",
      "Dog travels away.",
      "Motion occurs only before cue.",
    ],
    needsReviewCriteria: [
      "Audio unclear.",
      "Route hidden.",
      "Setup unsafe or unclear.",
      "Owner cropped.",
    ],
    outOfScopeClaims: [
      "Do not claim real-world emergency reliability.",
      "Do not claim off-leash reliability.",
    ],
    safetyNotes: [
      "Use only a safe enclosed setup.",
      "Never test near traffic.",
      "Keep the route clear.",
    ],
    prerequisiteActivityIds: ["SO031"],
    nextActivityId: "SO033",
    orderedVisibleActions: [
      "Target dog, path, and owner are visible in a safe setup before the emergency cue.",
      "One emergency cue is audible.",
      "Dog reorients toward owner after the cue.",
      "Dog travels toward owner.",
      "Dog arrives at the owner area.",
    ],
    skillFamily: "Emergency Recall",
    level: 3,
    fullDogBodyRequired: true,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: true,
  },
  {
    id: "SO033",
    title: "Emergency U-Turn Introduction",
    orderIndex: 33,
    lessonGoal: "Teach the dog to follow the owner's direction change after one audible U-turn cue.",
    visibleCheckpoint: "After one audible U-turn cue, dog visibly follows owner's direction change.",
    tutorialSteps: [
      "Use a visible leash in a safe route.",
      "Keep the dog, owner, route, and leash visible.",
      "Begin recording before the U-turn cue.",
      "Give one audible U-turn cue.",
      "Owner changes direction and rewards after the dog follows.",
    ],
    cameraAngle: "WIDE_LEASHED_ROUTE",
    setupInstructions: [
      "Dog, owner, route, and leash must be visible.",
      "Audio is required.",
      "Owner direction change must be visible.",
      "Leash must not be used to drag the dog.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Cue is audible.",
      "Owner changes direction.",
      "Dog follows new direction.",
      "Leash remains visible.",
    ],
    failCriteria: [
      "Dog does not follow.",
      "Dog continues opposite direction.",
      "Owner drags dog.",
    ],
    needsReviewCriteria: [
      "Route hidden.",
      "Leash cropped.",
      "Audio unclear.",
      "Turn timing unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim emergency U-turn reliability in real-world hazards.",
      "Do not infer leash walking skill.",
    ],
    safetyNotes: [
      "Use a safe low-distraction route.",
      "Do not drag the dog with the leash.",
    ],
    prerequisiteActivityIds: ["SO016"],
    nextActivityId: "SO034",
    orderedVisibleActions: [
      "Target dog, owner, route, and leash are visible before the U-turn cue.",
      "One U-turn cue is audible.",
      "Owner visibly changes direction.",
      "Dog follows the owner's new direction without dragging.",
    ],
    skillFamily: "Emergency U-Turn",
    level: 3,
    fullDogBodyRequired: true,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "SO034",
    title: "Emergency U-Turn with Mild Distraction",
    orderIndex: 34,
    lessonGoal: "Teach the dog to follow the owner away from a mild visible distraction after one audible U-turn cue.",
    visibleCheckpoint: "Visible mild distraction present, audible U-turn cue, and dog follows owner away from distraction.",
    tutorialSteps: [
      "Set up a mild visible distraction.",
      "Keep the distraction, leash, dog, owner, and route visible.",
      "Begin recording before the U-turn cue.",
      "Give one audible U-turn cue.",
      "Owner turns away from the distraction and rewards after the dog follows without dragging.",
    ],
    cameraAngle: "WIDE_LEASHED_ROUTE_WITH_DISTRACTION",
    setupInstructions: [
      "Distraction, leash, dog, owner, and route must be visible.",
      "Audio is required.",
      "Owner must turn away from the distraction.",
      "No dragging may occur.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Distraction is visible.",
      "Cue is audible.",
      "Dog follows owner away.",
      "No dragging occurs.",
    ],
    failCriteria: [
      "Dog remains fixed on distraction.",
      "Dog moves toward distraction.",
      "Owner drags dog.",
    ],
    needsReviewCriteria: [
      "Distraction hidden.",
      "Leash cropped.",
      "Audio unclear.",
      "Route unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim distraction-proof behavior.",
      "Do not claim real-world emergency reliability.",
    ],
    safetyNotes: [
      "Use only a mild distraction.",
      "Keep the route safe.",
      "Do not drag the dog.",
    ],
    prerequisiteActivityIds: ["SO033"],
    nextActivityId: "SO035",
    orderedVisibleActions: [
      "Target dog, owner, leash, route, and mild distraction are visible before the U-turn cue.",
      "One U-turn cue is audible.",
      "Owner turns away from the distraction.",
      "Dog follows owner away from the distraction without dragging.",
    ],
    skillFamily: "Emergency U-Turn",
    level: 3,
    fullDogBodyRequired: true,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "SO035",
    title: "Doorway Wait: 3 Seconds",
    orderIndex: 35,
    lessonGoal: "Teach the dog to remain behind the registered doorway threshold for 3 seconds and cross only after release.",
    visibleCheckpoint: "Dog remains behind registered TARGET_DOORWAY threshold for at least 3 seconds and crosses only after audible release.",
    tutorialSteps: [
      "Use the registered TARGET_DOORWAY.",
      "Keep the threshold, owner, and dog visible.",
      "Begin recording before the wait starts.",
      "Wait for a continuous 3-second hold.",
      "Give one audible release cue and reward crossing only after release.",
    ],
    cameraAngle: "VISIBLE_TARGET_DOORWAY",
    setupInstructions: [
      "Threshold must be visible.",
      "Owner and dog must be visible.",
      "Audio is required.",
      "Dog must cross only after the release cue.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY"],
    audioRequired: true,
    fps: 2,
    minClipSeconds: 7,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Doorway matches TARGET_DOORWAY reference photos.",
      "3-second hold is completed.",
      "Release is audible.",
      "Crossing occurs after release only.",
    ],
    failCriteria: [
      "Early crossing occurs.",
      "No hold occurs.",
      "Restraint is used.",
    ],
    needsReviewCriteria: [
      "Threshold hidden.",
      "Timing unclear.",
      "Audio unclear.",
      "Doorway identity unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim exterior-door safety.",
      "Do not infer generalized impulse control.",
    ],
    safetyNotes: [
      "Use an interior doorway.",
      "Do not practice near traffic-facing exits.",
      "Do not physically restrain the dog.",
    ],
    prerequisiteActivityIds: ["SO015"],
    nextActivityId: "SO036",
    orderedVisibleActions: [
      "Target dog, owner, and registered TARGET_DOORWAY threshold are visible before the wait starts.",
      "Dog remains behind the doorway threshold for at least 3 seconds.",
      "One release cue is audible.",
      "Dog crosses the threshold only after the release cue.",
    ],
    skillFamily: "Doorway Safety",
    level: 3,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "SO036",
    title: "Doorway Wait: 5 Seconds",
    orderIndex: 36,
    lessonGoal: "Extend the registered doorway wait to a continuous 5-second hold before release.",
    visibleCheckpoint: "Dog remains behind registered TARGET_DOORWAY threshold for at least 5 seconds and crosses only after audible release.",
    tutorialSteps: [
      "Use the registered TARGET_DOORWAY.",
      "Keep the threshold, owner, and dog visible.",
      "Begin recording before the wait starts.",
      "Wait for a continuous 5-second hold.",
      "Give one audible release cue and reward crossing only after release.",
    ],
    cameraAngle: "VISIBLE_TARGET_DOORWAY",
    setupInstructions: [
      "TARGET_DOORWAY threshold must remain visible.",
      "Dog and owner must remain visible.",
      "Audio is required.",
      "Dog must cross only after the release cue.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY"],
    audioRequired: true,
    fps: 2,
    minClipSeconds: 9,
    maxClipSeconds: 18,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Doorway matches TARGET_DOORWAY reference photos.",
      "5-second hold is completed.",
      "Release is audible.",
      "Crossing occurs after release only.",
    ],
    failCriteria: [
      "Early crossing occurs.",
      "Hold is insufficient.",
      "Restraint is used.",
    ],
    needsReviewCriteria: [
      "Threshold cropped.",
      "Duration unclear.",
      "Audio unclear.",
      "Doorway identity unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim exterior-door safety.",
      "Do not infer generalized impulse control.",
    ],
    safetyNotes: [
      "Use an interior doorway.",
      "Keep the duration achievable.",
      "Do not physically restrain the dog.",
    ],
    prerequisiteActivityIds: ["SO035"],
    nextActivityId: "SO037",
    orderedVisibleActions: [
      "Target dog, owner, and registered TARGET_DOORWAY threshold are visible before the wait starts.",
      "Dog remains behind the doorway threshold for at least 5 continuous seconds.",
      "One release cue is audible.",
      "Dog crosses the threshold only after the release cue.",
    ],
    skillFamily: "Doorway Safety",
    level: 3,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "SO037",
    title: "Leave Closed Hand",
    orderIndex: 37,
    lessonGoal: "Teach the dog to visibly disengage from the owner's closed hand.",
    visibleCheckpoint: "Dog disengages visibly from owner's closed hand.",
    tutorialSteps: [
      "Use a close view of dog nose and closed hand.",
      "Begin recording before the interaction starts.",
      "Present the closed hand without pushing the dog away.",
      "Wait for the dog to move nose away.",
      "Reward after brief visible disengagement.",
    ],
    cameraAngle: "CLOSE_DOG_NOSE_AND_HAND",
    setupInstructions: [
      "Dog nose and closed hand must be visible.",
      "Interaction must start after recording begins.",
      "Audio is optional.",
      "Owner must not push the dog away.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Dog initially investigates or orients toward the closed hand.",
      "Dog moves nose away.",
      "Visible brief disengagement occurs.",
    ],
    failCriteria: [
      "Persistent pawing or mouthing occurs.",
      "Owner pushes dog away.",
    ],
    needsReviewCriteria: [
      "Nose hidden.",
      "Hand cropped.",
      "Interaction starts before recording.",
      "Timing unclear.",
    ],
    outOfScopeClaims: [
      "Do not infer generalized impulse control.",
      "Do not claim food safety reliability.",
    ],
    safetyNotes: [
      "Keep the hand closed and still.",
      "Do not push the dog's face away.",
    ],
    prerequisiteActivityIds: [],
    nextActivityId: "SO038",
    orderedVisibleActions: [
      "Target dog nose and owner's closed hand are visible before interaction begins.",
      "Dog investigates or orients toward the closed hand.",
      "Dog moves nose away from the hand.",
      "Brief disengagement remains visible without pushing.",
    ],
    skillFamily: "Leave It and Drop",
    level: 3,
    fullDogBodyRequired: false,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: false,
  },
  {
    id: "SO038",
    title: "Leave Visible Floor Food",
    orderIndex: 38,
    lessonGoal: "Teach the dog to visibly disengage from staged visible floor food without accessing it.",
    visibleCheckpoint: "Dog visibly disengages from staged visible floor food and does not access it.",
    tutorialSteps: [
      "Stage visible dog-safe floor food.",
      "Keep the dog and food visible.",
      "Begin recording before the dog engages with the food.",
      "Wait for the dog to disengage without physically blocking.",
      "Reward after no contact or consumption occurs.",
    ],
    cameraAngle: "CLOSE_DOG_NOSE_AND_OBJECT",
    setupInstructions: [
      "Dog and visible staged-food setup must be visible.",
      "Dog nose must be visible.",
      "Audio is optional.",
      "Owner must not physically block the dog.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Food is visible.",
      "Dog disengages.",
      "No contact or consumption occurs.",
    ],
    failCriteria: [
      "Dog accesses food.",
      "Dog remains persistently engaged.",
      "Owner physically blocks dog.",
    ],
    needsReviewCriteria: [
      "Food hidden.",
      "Dog nose hidden.",
      "Timing unclear.",
      "Dog identity unclear.",
    ],
    outOfScopeClaims: [
      "Do not infer generalized impulse control.",
      "Do not claim outdoor food avoidance.",
    ],
    safetyNotes: [
      "Use dog-safe food.",
      "Avoid conflict around food.",
      "Do not physically block or push the dog.",
    ],
    prerequisiteActivityIds: ["SO037"],
    nextActivityId: "SO039",
    orderedVisibleActions: [
      "Target dog and staged visible floor food are in frame before engagement.",
      "Dog notices or engages with the visible floor food.",
      "Dog visibly disengages from the food.",
      "Dog does not contact or consume the food.",
    ],
    skillFamily: "Leave It and Drop",
    level: 3,
    fullDogBodyRequired: false,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: false,
  },
  {
    id: "SO039",
    title: "Drop Low-Value Toy",
    orderIndex: 39,
    lessonGoal: "Teach the dog to release a registered low-value toy after an audible drop cue.",
    visibleCheckpoint: "Dog releases registered TARGET_TOY after audible drop cue.",
    tutorialSteps: [
      "Use the registered low-value TARGET_TOY.",
      "Keep the dog mouth and toy visible.",
      "Begin recording before the drop cue.",
      "Give one audible drop cue.",
      "Reward voluntary release without forced removal.",
    ],
    cameraAngle: "CLOSE_DOG_MOUTH_AND_OBJECT",
    setupInstructions: [
      "Dog mouth and toy must be visible.",
      "Audio is required.",
      "Toy must match TARGET_TOY reference photos.",
      "No forced removal may occur.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Toy matches TARGET_TOY reference photos.",
      "Cue is audible.",
      "Voluntary release occurs after cue.",
      "No forced removal occurs.",
    ],
    failCriteria: [
      "No release occurs.",
      "Release occurs only before cue.",
      "Forced removal occurs.",
    ],
    needsReviewCriteria: [
      "Dog mouth hidden.",
      "Toy identity unclear.",
      "Cue inaudible.",
      "Release obscured.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized drop reliability.",
      "Do not infer resource guarding status.",
    ],
    safetyNotes: [
      "Use a low-value safe toy.",
      "Do not pry the toy from the dog's mouth.",
    ],
    prerequisiteActivityIds: [],
    nextActivityId: "SO040",
    orderedVisibleActions: [
      "Target dog and registered TARGET_TOY are visible before the drop cue.",
      "One drop cue is audible.",
      "Dog voluntarily releases the toy after the cue.",
      "No forced removal occurs.",
    ],
    skillFamily: "Leave It and Drop",
    level: 3,
    fullDogBodyRequired: false,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: false,
  },
  {
    id: "SO040",
    title: "Drop Exciting Toy",
    orderIndex: 40,
    lessonGoal: "Teach the dog to release a registered higher-value toy after an audible drop cue.",
    visibleCheckpoint: "Dog releases a registered higher-value TARGET_TOY after audible drop cue.",
    tutorialSteps: [
      "Use the registered higher-value TARGET_TOY.",
      "Keep the dog mouth and toy visible.",
      "Begin recording before the drop cue.",
      "Give one audible drop cue.",
      "Reward voluntary release without forced removal.",
    ],
    cameraAngle: "CLOSE_DOG_MOUTH_AND_OBJECT",
    setupInstructions: [
      "Dog mouth and toy must be visible.",
      "Audio is required.",
      "Toy must match TARGET_TOY reference photos.",
      "No forced removal may occur.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Registered toy matches TARGET_TOY reference photos.",
      "Cue is audible.",
      "Release occurs after cue.",
      "No forced removal occurs.",
    ],
    failCriteria: [
      "No release occurs.",
      "Wrong toy is used.",
      "Forced removal occurs.",
    ],
    needsReviewCriteria: [
      "Mouth hidden.",
      "Toy unclear.",
      "Audio missing.",
      "Release obscured.",
    ],
    outOfScopeClaims: [
      "Do not claim resource guarding improvement.",
      "Do not claim generalized drop reliability.",
    ],
    safetyNotes: [
      "Use a safe toy.",
      "Do not pry the toy from the dog's mouth.",
      "Stop if guarding behavior appears.",
    ],
    prerequisiteActivityIds: ["SO039"],
    nextActivityId: "SO041",
    orderedVisibleActions: [
      "Target dog and registered higher-value TARGET_TOY are visible before the drop cue.",
      "One drop cue is audible.",
      "Dog releases the toy after the cue.",
      "No forced removal occurs.",
    ],
    skillFamily: "Leave It and Drop",
    level: 3,
    fullDogBodyRequired: false,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: false,
  },
];

export const SO031_SO040: BatchActivity[] = SPECS.map(makeActivity);
