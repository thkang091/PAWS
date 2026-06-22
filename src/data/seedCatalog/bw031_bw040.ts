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

REFERENCE RULES
${list(spec.requiredReferenceAssets)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If the cue, whistle, recall cue, or timing audio is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is judged. If cue timing is part of the attempt and audio is unclear, return NEEDS_REVIEW."}

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
    hipsRequired: spec.id === "BW039",
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
    xpReward: spec.orderIndex >= 37 ? 145 : spec.orderIndex >= 34 ? 135 : 130,
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
    id: "BW031",
    title: "Loose-Leash Route with Two Turns",
    orderIndex: 31,
    lessonGoal: "Teach the dog to complete a visible loose-leash route with two owner direction changes.",
    visibleCheckpoint: "Dog completes a visible loose-leash route with owner and follows two visible direction changes.",
    tutorialSteps: ["Choose a safe visible route.", "Keep route, owner, dog, and leash visible.", "Begin recording before walking starts.", "Complete two visible direction changes.", "Reward after the route is completed without sustained leash tension."],
    cameraAngle: "WIDE_ROUTE_WITH_TWO_TURNS",
    setupInstructions: ["Route, owner, dog, and leash must be visible.", "Both turns must remain visible.", "Leash slack or lack of sustained tension must be visible.", "Use 3-5 FPS for route and turn evidence."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 15,
    maxClipSeconds: 35,
    passCriteria: ["Dog matches DOG_PROFILE.", "Leash remains slack or without sustained tension.", "Dog completes route.", "First turn is completed.", "Second turn is completed.", "No dragging occurs."],
    failCriteria: ["Sustained pulling occurs.", "Dog fails either turn.", "Owner drags dog.", "Route is not completed."],
    needsReviewCriteria: ["Leash hidden.", "Either turn cropped.", "Route unclear.", "Dog path hidden."],
    outOfScopeClaims: ["Do not claim generalized outdoor walking reliability.", "Do not claim busy-route reliability."],
    safetyNotes: ["Use a safe route.", "Do not drag the dog through turns."],
    prerequisiteActivityIds: ["BW030"],
    nextActivityId: "BW032",
    orderedVisibleActions: ["Target dog, owner, leash, and route are visible before walking starts.", "Dog walks with owner while leash remains slack or without sustained tension.", "Dog follows the first visible direction change.", "Dog follows the second visible direction change.", "Dog completes the visible route without dragging."],
    skillFamily: "Route Challenges",
    level: 3,
  },
  {
    id: "BW032",
    title: "Pass a Stationary Object",
    orderIndex: 32,
    lessonGoal: "Teach the dog to walk past one visible stationary staged object while staying on route.",
    visibleCheckpoint: "Dog walks past one visible stationary staged object while staying on route and without contacting the object.",
    tutorialSteps: ["Place one safe stationary object on or near the route.", "Keep dog, owner, leash, route, and object visible.", "Begin recording before the pass.", "Walk past the object without dragging.", "Reward after passing with no contact."],
    cameraAngle: "WIDE_ROUTE_WITH_STATIONARY_OBJECT",
    setupInstructions: ["Dog, owner, leash, route, and object must be visible.", "Use CUSTOM_OBJECT only when a specific staged object is registered.", "Pass distance and dog path must be visible.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Object is visible.", "Dog passes object.", "Dog remains on route.", "No object contact occurs.", "No dragging occurs."],
    failCriteria: ["Dog moves directly to object.", "Dog contacts object.", "Dog leaves route.", "Owner drags dog past."],
    needsReviewCriteria: ["Object hidden.", "Dog path cropped.", "Leash hidden.", "Pass distance unclear."],
    outOfScopeClaims: ["Do not infer behavior around all distractions.", "Do not claim generalized neutrality."],
    safetyNotes: ["Use a safe stationary object.", "Keep pass distance comfortable."],
    prerequisiteActivityIds: ["BW031"],
    nextActivityId: "BW033",
    orderedVisibleActions: ["Target dog, owner, leash, route, and visible stationary object are in frame.", "Dog and owner approach the object.", "Dog passes the object while staying on route.", "Dog avoids contact and is not dragged."],
    skillFamily: "Route Challenges",
    level: 3,
  },
  {
    id: "BW033",
    title: "Pass a Moving Object at Distance",
    orderIndex: 33,
    lessonGoal: "Teach the dog to walk past a visible moving staged object at a safe distance while staying on route.",
    visibleCheckpoint: "Dog walks past a visible moving staged object at a safe distance while staying on route.",
    tutorialSteps: ["Use a quiet safe setup.", "Keep moving object, dog, owner, leash, and route visible.", "Begin recording before the pass.", "Maintain a safe passing distance.", "Reward after passing without lunging or dragging."],
    cameraAngle: "WIDE_SAFE_ROUTE_WITH_MOVING_OBJECT",
    setupInstructions: ["Quiet safe setup must be visible.", "Moving object, dog, owner, leash, and route must be visible.", "Use CUSTOM_OBJECT only when a specific staged moving object is registered.", "Safe passing distance must be maintained."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Moving object is visible.", "Safe passing distance is maintained.", "Dog remains with owner.", "No lunging or dragging occurs.", "Leash remains visible."],
    failCriteria: ["Dog lunges toward moving object.", "Dog leaves route toward object.", "Owner drags dog away.", "Setup is visibly unsafe."],
    needsReviewCriteria: ["Moving object cropped.", "Distance unclear.", "Dog route hidden.", "Leash hidden.", "Safety unclear."],
    outOfScopeClaims: ["Do not claim generalized reactivity improvement.", "Do not claim behavior around all moving objects."],
    safetyNotes: ["Use a quiet safe setup.", "Keep distance comfortable."],
    prerequisiteActivityIds: ["BW032"],
    nextActivityId: "BW034",
    orderedVisibleActions: ["Target dog, owner, leash, route, and moving object are visible.", "Dog and owner pass the moving object at a safe distance.", "Dog remains with owner and on route.", "No lunging, dragging, or unsafe setup occurs."],
    skillFamily: "Route Challenges",
    level: 3,
  },
  {
    id: "BW034",
    title: "Pass a Familiar Person Calmly",
    orderIndex: 34,
    lessonGoal: "Teach the dog to walk past a familiar person at a safe distance without jumping, lunging, or leaving route.",
    visibleCheckpoint: "Dog walks past a visible familiar person at a safe distance without jumping, lunging, or leaving route.",
    tutorialSteps: ["Use a visible familiar person.", "Keep dog, owner, leash, route, and person visible.", "Begin recording before the pass.", "Walk past at a safe distance.", "Reward after passing without jumping or lunging."],
    cameraAngle: "WIDE_ROUTE_WITH_PERSON",
    setupInstructions: ["Dog, owner, leash, route, and familiar person must be visible.", "Pass distance must be visible.", "Dog path must remain visible.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Familiar person is visible.", "Dog passes person.", "Dog remains on route.", "No jumping or lunging occurs.", "No dragging occurs."],
    failCriteria: ["Dog jumps on person.", "Dog lunges toward person.", "Dog leaves route.", "Owner drags dog away."],
    needsReviewCriteria: ["Person cropped.", "Dog path hidden.", "Leash hidden.", "Pass distance unclear."],
    outOfScopeClaims: ["Do not claim stranger reliability.", "Do not claim crowded-area reliability."],
    safetyNotes: ["Use a familiar person and safe distance.", "Do not force the pass."],
    prerequisiteActivityIds: ["BW033"],
    nextActivityId: "BW035",
    orderedVisibleActions: ["Target dog, owner, leash, route, and familiar person are visible.", "Dog and owner approach the familiar person at a safe distance.", "Dog passes the person while remaining on route.", "No jumping, lunging, or dragging occurs."],
    skillFamily: "Passing People",
    level: 3,
  },
  {
    id: "BW035",
    title: "Pass a Person at Comfortable Distance",
    orderIndex: 35,
    lessonGoal: "Teach the dog to pass a visible person at a clearly safe comfortable distance while remaining on route.",
    visibleCheckpoint: "Dog walks past a visible person at a clearly safe comfortable distance while remaining on route.",
    tutorialSteps: ["Choose a quiet route.", "Keep dog, owner, leash, person, and path visible.", "Begin recording before the pass.", "Maintain a comfortable distance.", "Reward after the dog continues route without lunging or dragging."],
    cameraAngle: "WIDE_QUIET_ROUTE_WITH_PERSON",
    setupInstructions: ["Quiet route must be visible.", "Dog, owner, leash, person, and path must be visible.", "Safe comfortable distance must be visible.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Person is visible.", "Safe distance is maintained.", "Dog continues route.", "No lunging or dragging occurs.", "Leash remains visible."],
    failCriteria: ["Dog lunges.", "Dog moves directly toward person.", "Owner drags dog.", "Distance becomes visibly unsafe."],
    needsReviewCriteria: ["Distance unclear.", "Person hidden.", "Route cropped.", "Leash hidden.", "Safety unclear."],
    outOfScopeClaims: ["Do not claim behavior around crowded areas.", "Do not claim stranger reliability in all settings."],
    safetyNotes: ["Use a comfortable distance.", "Avoid crowded or unsafe areas."],
    prerequisiteActivityIds: ["BW034"],
    nextActivityId: "BW036",
    orderedVisibleActions: ["Target dog, owner, leash, path, and person are visible.", "Dog and owner pass at a clearly safe comfortable distance.", "Dog continues on route.", "No lunging, dragging, or unsafe distance occurs."],
    skillFamily: "Passing People",
    level: 3,
  },
  {
    id: "BW036",
    title: "Walk Toward Owner After Distraction",
    orderIndex: 36,
    lessonGoal: "Teach the dog to disengage from a mild visible distraction after one audible cue and walk toward owner.",
    visibleCheckpoint: "Dog begins oriented toward a mild visible distraction, receives one audible cue, turns away from distraction, and walks toward owner.",
    tutorialSteps: ["Set up a mild visible distraction.", "Keep dog, owner, leash, distraction, and route visible.", "Begin recording while dog is oriented toward the distraction.", "Give one audible cue.", "Reward after dog turns away and walks toward owner."],
    cameraAngle: "WIDE_ROUTE_WITH_MILD_DISTRACTION",
    setupInstructions: ["Dog, owner, leash, mild distraction, and route must be visible.", "Audio is required.", "Dog must begin oriented toward the distraction.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Distraction is visible.", "Cue is audible.", "Dog disengages after cue.", "Dog walks toward owner.", "No dragging occurs."],
    failCriteria: ["Dog remains fixed on distraction.", "Dog travels toward distraction.", "Owner drags dog away.", "Response occurs only before cue."],
    needsReviewCriteria: ["Distraction hidden.", "Audio unclear.", "Owner cropped.", "Route hidden.", "Timing unclear."],
    outOfScopeClaims: ["Do not claim distraction-proof behavior.", "Do not claim generalized attention outdoors."],
    safetyNotes: ["Use only a mild distraction.", "Keep the route safe and low intensity."],
    prerequisiteActivityIds: ["BW018"],
    nextActivityId: "BW037",
    orderedVisibleActions: ["Target dog, owner, leash, mild distraction, and route are visible.", "Dog begins oriented toward the mild distraction.", "One cue is audible.", "Dog turns away from the distraction after the cue.", "Dog walks toward owner without dragging."],
    skillFamily: "Walk Recalls and Stops",
    level: 3,
  },
  {
    id: "BW037",
    title: "Long-Line Recall During Walk",
    orderIndex: 37,
    lessonGoal: "Teach the dog to return to owner during a safe walk setup after one audible recall cue while a visible long line remains attached.",
    visibleCheckpoint: "During a safe walk setup, one audible recall cue occurs, dog turns toward owner, and returns while a visible long line remains attached.",
    tutorialSteps: ["Use a safe route with a visible long line attached.", "Keep owner, dog, path, leash, and long line visible.", "Begin recording before recall cue.", "Give one audible recall cue.", "Reward after dog reaches owner area without forceful reeling."],
    cameraAngle: "WIDE_SAFE_ROUTE_WITH_LONG_LINE",
    setupInstructions: ["Safe route must be visible.", "Owner, dog, path, leash, and long line must be visible.", "Audio is required.", "Long line must remain attached and visible.", "Owner must not reel dog in forcefully."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Long line is visible.", "Recall cue is audible.", "Dog reorients after cue.", "Dog travels toward owner.", "Dog reaches owner area."],
    failCriteria: ["Dog does not return.", "Dog moves away.", "Movement occurs only before cue.", "Owner reels dog in forcefully."],
    needsReviewCriteria: ["Long line hidden.", "Audio unclear.", "Path cropped.", "Arrival hidden.", "Setup safety unclear."],
    outOfScopeClaims: ["Do not claim off-leash reliability.", "Do not claim real-world recall reliability."],
    safetyNotes: ["Use a safe route.", "Keep the long line visible and attached.", "Do not practice near traffic."],
    prerequisiteActivityIds: ["SO021", "BW036"],
    nextActivityId: "BW038",
    orderedVisibleActions: ["Target dog, owner, leash, path, and visible attached long line are in frame.", "One recall cue is audible.", "Dog reorients toward owner after the cue.", "Dog travels toward owner on the long line.", "Dog reaches the owner area without forceful reeling."],
    skillFamily: "Walk Recalls and Stops",
    level: 3,
  },
  {
    id: "BW038",
    title: "Whistle Recall During Safe Walk",
    orderIndex: 38,
    lessonGoal: "Teach the dog to return to owner during a safe walk setup after an audible whistle.",
    visibleCheckpoint: "During a safe route setup, audible whistle occurs, dog reorients, travels toward owner, and reaches owner area.",
    tutorialSteps: ["Use a safe quiet route or long line.", "Keep dog, owner, route, and leash visible.", "Begin recording before whistle.", "Give one audible whistle.", "Reward after dog reaches owner area without dragging."],
    cameraAngle: "WIDE_SAFE_ROUTE_OR_LONG_LINE",
    setupInstructions: ["Safe quiet route or long line setup must be visible.", "Dog, owner, route, and leash must be visible.", "Audio is required.", "Setup safety must be clear."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Whistle is audible.", "Dog reorients after whistle.", "Dog travels toward owner.", "Arrival is visible.", "Setup is safe."],
    failCriteria: ["Dog ignores whistle.", "Dog moves away.", "Movement occurs only before whistle.", "Owner drags dog back."],
    needsReviewCriteria: ["Whistle unclear.", "Route hidden.", "Leash hidden.", "Arrival cropped.", "Setup safety unclear."],
    outOfScopeClaims: ["Do not claim off-leash reliability.", "Do not claim whistle recall reliability outside the clip."],
    safetyNotes: ["Use a safe quiet route or long line.", "Do not practice near traffic."],
    prerequisiteActivityIds: ["SO027", "BW037"],
    nextActivityId: "BW039",
    orderedVisibleActions: ["Target dog, owner, leash, and safe route or long-line setup are visible before whistle.", "One whistle is audible.", "Dog reorients toward owner after the whistle.", "Dog travels toward owner.", "Dog reaches the owner area without dragging."],
    skillFamily: "Walk Recalls and Stops",
    level: 3,
  },
  {
    id: "BW039",
    title: "Walk -> Stop -> Sit",
    orderIndex: 39,
    lessonGoal: "Teach the dog to stop after owner stops during a walk and then sit visibly.",
    visibleCheckpoint: "Dog walks with owner, owner visibly stops, and dog visibly sits after stopping.",
    tutorialSteps: ["Keep dog, owner, leash, hips, and route visible.", "Begin recording before the walking phase.", "Owner stops visibly.", "Dog stops and sits.", "Reward after hips contact the floor without forcing."],
    cameraAngle: "WIDE_ROUTE_WITH_HIPS_VISIBLE",
    setupInstructions: ["Dog, owner, leash, hips, and route must be visible.", "Walking phase and owner stop must be visible.", "Dog sit timing must be visible.", "No physical forcing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Walking phase is visible.", "Owner stop is visible.", "Dog stops.", "Hips contact floor.", "Sit is visible.", "No physical forcing occurs."],
    failCriteria: ["Dog continues walking.", "Dog does not sit.", "Owner pushes dog into sit.", "Owner drags dog to stop."],
    needsReviewCriteria: ["Hips hidden.", "Leash hidden.", "Owner stop unclear.", "Dog cropped."],
    outOfScopeClaims: ["Do not claim generalized automatic sit behavior.", "Do not claim formal heel behavior."],
    safetyNotes: ["Use a safe route.", "Do not push the dog into sit."],
    prerequisiteActivityIds: ["BW010", "SO004"],
    nextActivityId: "BW040",
    orderedVisibleActions: ["Target dog, owner, leash, route, and hips are visible before walking starts.", "Dog walks with owner.", "Owner visibly stops.", "Dog stops and sits with hips contacting the floor.", "No pushing or dragging occurs."],
    skillFamily: "Walk Recalls and Stops",
    level: 3,
  },
  {
    id: "BW040",
    title: "Walk -> U-Turn -> Continue",
    orderIndex: 40,
    lessonGoal: "Teach the dog to walk with owner, follow one visible U-turn, and continue in the new direction.",
    visibleCheckpoint: "Dog walks with owner, follows one visible U-turn, and continues walking in the new direction.",
    tutorialSteps: ["Keep route, dog, owner, and leash visible.", "Begin recording before walking phase.", "Walk forward briefly.", "Complete one visible U-turn.", "Continue in the new direction without dragging."],
    cameraAngle: "WIDE_ROUTE_WITH_U_TURN",
    setupInstructions: ["Route, dog, owner, and leash must be visible.", "Audio is required only when U-turn cue timing is judged.", "U-turn and continued route must be visible.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Walking phase is visible.", "U-turn is visible.", "Dog follows turn.", "Dog continues new route.", "No dragging occurs."],
    failCriteria: ["Dog fails turn.", "Dog continues old direction.", "Owner drags dog.", "Dog does not continue after turn."],
    needsReviewCriteria: ["Route cropped.", "Leash hidden.", "Turn timing unclear.", "Audio unclear when required."],
    outOfScopeClaims: ["Do not claim emergency reliability.", "Do not claim generalized U-turn reliability."],
    safetyNotes: ["Use a safe route.", "Do not drag the dog around the turn."],
    prerequisiteActivityIds: ["BW014", "BW030"],
    nextActivityId: "BW041",
    orderedVisibleActions: ["Target dog, owner, leash, and route are visible before walking starts.", "Dog walks with owner.", "Owner performs one visible U-turn.", "Dog follows the turn.", "Dog continues walking in the new direction without dragging."],
    skillFamily: "Walk Recalls and Stops",
    level: 3,
  },
];

export const BW031_BW040: BatchActivity[] = SPECS.map(makeActivity);
