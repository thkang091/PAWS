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
- Owner or handler in frame required: YES
- Leash required in frame: YES
${list(spec.setupInstructions)}

REFERENCE RULES
${list(spec.requiredReferenceAssets)}
${list(spec.conditionalReferenceRules)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If required cue timing, release cue, return cue, recall cue, or walk sequence audio is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is judged. If cue timing is part of the submitted attempt and audio is unclear, return NEEDS_REVIEW."}

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
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, required audio when applicable, relevant action visible from start to finish, required saved references matching the visible dog and objects, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;

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
    whyItMatters: "This activity combines observable walking skills without claiming real-world reliability outside the submitted clip.",
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
    xpReward: spec.orderIndex >= 50 ? 165 : spec.orderIndex >= 46 ? 155 : 150,
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
    id: "BW041",
    title: "Walk -> Sniff -> Return",
    orderIndex: 41,
    lessonGoal: "Teach the dog to walk with owner, access a visible sniff area after release, and return toward owner after a return cue.",
    visibleCheckpoint: "Dog walks with owner, receives audible sniff-release cue, accesses visible sniff area, receives audible return cue, disengages, and returns toward owner.",
    tutorialSteps: ["Choose a safe visible sniff area.", "Keep dog, owner, leash, route, and sniff area visible.", "Begin recording during the walking phase.", "Give one audible sniff-release cue.", "Give one audible return cue and reward after the dog returns toward owner."],
    cameraAngle: "WIDE_ROUTE_WITH_SNIFF_AREA",
    setupInstructions: ["Dog, owner, leash, route, and sniff area must be visible.", "Audio is required for sniff-release and return cues.", "Dog path to and from the sniff area must remain visible.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional saved object reference is required for a generic visible sniff area."],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: ["Dog matches DOG_PROFILE.", "Walking phase is visible.", "Sniff-release cue is audible.", "Dog reaches sniff area after cue.", "Return cue is audible.", "Dog disengages and returns toward owner.", "No dragging occurs."],
    failCriteria: ["Dog accesses sniff area before release.", "Dog does not disengage after return cue.", "Owner drags dog away.", "Sequence order is incorrect."],
    needsReviewCriteria: ["Audio unclear.", "Sniff area hidden.", "Dog path cropped.", "Return unclear.", "Leash hidden."],
    outOfScopeClaims: ["Do not claim generalized recall.", "Do not claim off-leash reliability."],
    safetyNotes: ["Use a safe sniff area.", "Do not drag the dog away from the sniff area."],
    prerequisiteActivityIds: ["BW017", "BW018"],
    nextActivityId: "BW042",
    orderedVisibleActions: ["Target dog, owner, leash, route, and sniff area are visible during walking.", "Sniff-release cue is audible.", "Dog reaches the sniff area after the cue.", "Return cue is audible.", "Dog disengages and returns toward owner without dragging."],
    skillFamily: "Better Walks Routines",
    level: 4,
  },
  {
    id: "BW042",
    title: "Doorway Wait -> Loose Leash",
    orderIndex: 42,
    lessonGoal: "Teach the dog to wait behind a registered doorway threshold, exit after release, and begin a loose-leash walking segment.",
    visibleCheckpoint: "Dog waits behind registered doorway threshold, exits only after audible release cue, then begins a visible loose-leash walking segment.",
    tutorialSteps: ["Use the registered doorway reference.", "Keep threshold, dog, owner, leash, and route visible.", "Begin with dog behind threshold.", "Give one audible release cue.", "Walk forward with a slack leash segment."],
    cameraAngle: "WIDE_DOORWAY_TO_ROUTE",
    setupInstructions: ["TARGET_DOORWAY threshold, dog, owner, leash, and route must be visible.", "Audio is required for the release cue.", "Walking segment must show leash slack or lack of sustained tension.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY"],
    conditionalReferenceRules: ["Visible doorway must match saved TARGET_DOORWAY reference photos."],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: ["Dog matches DOG_PROFILE.", "Doorway matches TARGET_DOORWAY.", "Dog waits behind threshold.", "Release cue is audible.", "Dog exits only after cue.", "Leash remains slack during walking segment.", "No dragging occurs."],
    failCriteria: ["Early doorway exit.", "Sustained leash tension.", "Restraint or dragging occurs."],
    needsReviewCriteria: ["Threshold hidden.", "Audio unclear.", "Leash hidden.", "Route cropped.", "Doorway identity unclear."],
    outOfScopeClaims: ["Do not claim traffic safety.", "Do not claim exterior-door reliability."],
    safetyNotes: ["Use a safe doorway and route.", "Do not test near traffic-facing exits."],
    prerequisiteActivityIds: ["BW019", "BW006"],
    nextActivityId: "BW043",
    orderedVisibleActions: ["Target dog, owner, leash, route, and registered doorway threshold are visible.", "Dog waits behind the threshold.", "Release cue is audible.", "Dog exits only after the cue.", "Dog begins loose-leash walking without dragging."],
    skillFamily: "Better Walks Routines",
    level: 4,
  },
  {
    id: "BW043",
    title: "Loose Leash -> Object Pass",
    orderIndex: 43,
    lessonGoal: "Teach the dog to maintain loose-leash walking while passing a visible staged object without contact.",
    visibleCheckpoint: "Dog completes visible loose-leash walking segment and passes a visible staged object without contacting it or leaving route.",
    tutorialSteps: ["Place one safe staged object near the route.", "Keep dog, owner, leash, route, and object visible.", "Begin recording before the loose-leash segment.", "Walk past the object without dragging.", "Reward after passing with no contact."],
    cameraAngle: "WIDE_ROUTE_WITH_STAGED_OBJECT",
    setupInstructions: ["Dog, owner, leash, route, and object must be visible.", "Use CUSTOM_OBJECT only when a specific staged object is registered.", "Object pass moment must remain visible.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["If a specific staged object is registered for this attempt, visible object must match saved CUSTOM_OBJECT photos; if identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: ["Dog matches DOG_PROFILE.", "Leash remains slack.", "Dog remains on route.", "Object pass is visible.", "No object contact occurs.", "No dragging occurs."],
    failCriteria: ["Sustained pulling occurs.", "Dog leaves route toward object.", "Object contact occurs.", "Owner drags dog."],
    needsReviewCriteria: ["Leash hidden.", "Object cropped.", "Path unclear.", "Pass moment hidden.", "Object identity unclear when registration is required."],
    outOfScopeClaims: ["Do not claim generalized distraction handling.", "Do not claim behavior around all objects."],
    safetyNotes: ["Use a safe object.", "Keep the pass distance comfortable."],
    prerequisiteActivityIds: ["BW032", "BW029"],
    nextActivityId: "BW044",
    orderedVisibleActions: ["Target dog, owner, leash, route, and staged object are visible.", "Dog completes a loose-leash walking segment.", "Dog passes the visible object while remaining on route.", "Dog avoids contact and is not dragged."],
    skillFamily: "Better Walks Routines",
    level: 4,
  },
  {
    id: "BW044",
    title: "Loose Leash -> Curb Pause",
    orderIndex: 44,
    lessonGoal: "Teach the dog to walk on loose leash and pause before a visible curb or safe simulated boundary.",
    visibleCheckpoint: "Dog completes visible loose-leash walking segment and pauses before a visible curb or safe simulated boundary.",
    tutorialSteps: ["Choose a safe curb or simulated boundary.", "Keep dog, owner, leash, route, and boundary visible.", "Begin recording before the walking segment.", "Walk toward the boundary with slack leash.", "Pause before the boundary and reward."],
    cameraAngle: "WIDE_ROUTE_WITH_CURB_OR_BOUNDARY",
    setupInstructions: ["Dog, owner, leash, route, and curb boundary must be visible.", "Boundary may be a safe simulated curb-like line.", "Pause timing must be visible.", "No dragging or blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No saved object reference is required for a visible curb or simulated boundary."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: ["Dog matches DOG_PROFILE.", "Leash remains slack.", "Dog walks route.", "Curb boundary is visible.", "Dog pauses before boundary.", "No dragging occurs."],
    failCriteria: ["Sustained pulling occurs.", "Dog crosses without pause.", "Owner drags or blocks dog."],
    needsReviewCriteria: ["Curb hidden.", "Leash hidden.", "Pause timing unclear.", "Safety unclear."],
    outOfScopeClaims: ["Do not claim road safety.", "Do not claim traffic reliability."],
    safetyNotes: ["Use a safe curb or simulated boundary.", "Never test near active traffic."],
    prerequisiteActivityIds: ["BW022", "BW029"],
    nextActivityId: "BW045",
    orderedVisibleActions: ["Target dog, owner, leash, route, and curb or simulated boundary are visible.", "Dog completes a loose-leash walking segment.", "Dog approaches the boundary.", "Dog pauses before crossing without dragging or blocking."],
    skillFamily: "Better Walks Routines",
    level: 4,
  },
  {
    id: "BW045",
    title: "Loose Leash -> U-Turn -> Recall",
    orderIndex: 45,
    lessonGoal: "Teach the dog to combine loose-leash walking, an audible U-turn cue, and an audible recall cue.",
    visibleCheckpoint: "Dog completes visible loose-leash segment, follows audible U-turn cue, continues in new direction, then returns to owner after audible recall cue.",
    tutorialSteps: ["Choose a safe visible route.", "Keep dog, owner, leash, and route visible.", "Begin recording before walking.", "Give one audible U-turn cue and continue in the new direction.", "Give one audible recall cue and reward after return."],
    cameraAngle: "WIDE_ROUTE_U_TURN_RECALL",
    setupInstructions: ["Dog, owner, leash, and route must be visible.", "Audio is required for U-turn and recall cues.", "Turn and recall arrival must remain visible.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional saved object reference is required."],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 15,
    maxClipSeconds: 35,
    passCriteria: ["Dog matches DOG_PROFILE.", "Leash remains slack.", "U-turn cue is audible.", "Dog follows turn.", "Recall cue is audible.", "Dog returns to owner.", "No dragging occurs."],
    failCriteria: ["Sustained pulling occurs.", "U-turn fails.", "Recall fails.", "Movement occurs only before cue.", "Owner drags dog."],
    needsReviewCriteria: ["Audio unclear.", "Turn cropped.", "Route hidden.", "Recall arrival cropped.", "Leash hidden."],
    outOfScopeClaims: ["Do not claim off-leash reliability.", "Do not claim emergency U-turn reliability."],
    safetyNotes: ["Use a safe visible route.", "Do not practice near traffic."],
    prerequisiteActivityIds: ["BW040", "BW037"],
    nextActivityId: "BW046",
    orderedVisibleActions: ["Target dog, owner, leash, and route are visible during loose-leash walking.", "U-turn cue is audible.", "Dog follows the U-turn and continues in the new direction.", "Recall cue is audible.", "Dog returns to owner without dragging."],
    skillFamily: "Better Walks Routines",
    level: 4,
  },
  {
    id: "BW046",
    title: "Quiet-Route Sequence",
    orderIndex: 46,
    lessonGoal: "Teach the dog to complete a quiet-route sequence with start release, loose leash, stop, check-in, and continued walking.",
    visibleCheckpoint: "Dog completes a quiet-route sequence: start walking after release, maintain loose leash, complete one stop, complete one check-in, and continue walking.",
    tutorialSteps: ["Choose a quiet safe route.", "Keep dog, owner, leash, and path visible.", "Begin recording before the release or walking start.", "Complete one stop and one check-in.", "Continue walking and reward the completed sequence."],
    cameraAngle: "WIDE_QUIET_ROUTE_SEQUENCE",
    setupInstructions: ["Quiet safe route, dog, owner, leash, and path must be visible.", "Audio is required only when release cue timing is part of the attempt.", "Stop and check-in moments must be visible.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional saved object reference is required."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 15,
    maxClipSeconds: 35,
    passCriteria: ["Dog matches DOG_PROFILE.", "Release-before-motion order is correct when release is used.", "Leash remains slack.", "Stop is visible.", "Check-in is visible.", "Dog continues route.", "No dragging occurs."],
    failCriteria: ["Early movement before release when release is used.", "Sustained pulling occurs.", "Stop or check-in is missing.", "Dragging occurs."],
    needsReviewCriteria: ["Leash hidden.", "Route cropped.", "Audio unclear when release timing is judged.", "Check-in moment hidden."],
    outOfScopeClaims: ["Do not claim busy-route reliability.", "Do not claim long-term loose-leash reliability."],
    safetyNotes: ["Use a quiet safe route.", "Keep the sequence low intensity."],
    prerequisiteActivityIds: ["BW009", "BW011", "BW029"],
    nextActivityId: "BW047",
    orderedVisibleActions: ["Target dog, owner, leash, and quiet safe route are visible.", "Dog starts walking after release when release is used.", "Dog maintains loose leash.", "Dog completes one visible stop.", "Dog completes one visible check-in.", "Dog continues walking without dragging."],
    skillFamily: "Better Walks Routines",
    level: 5,
  },
  {
    id: "BW047",
    title: "Outdoor-Route Sequence",
    orderIndex: 47,
    lessonGoal: "Teach the dog to complete a safe outdoor route sequence with loose leash, direction change, boundary pause, and continued walking.",
    visibleCheckpoint: "Dog completes a safe outdoor route sequence: loose-leash walking, one direction change, one curb pause or boundary pause, and continued route.",
    tutorialSteps: ["Choose a quiet safe outdoor route.", "Keep dog, owner, leash, route, and boundary visible.", "Begin recording before walking.", "Complete one direction change.", "Pause at the boundary, then continue the route."],
    cameraAngle: "WIDE_SAFE_OUTDOOR_ROUTE_SEQUENCE",
    setupInstructions: ["Quiet safe outdoor route must be visible.", "Dog, owner, leash, route, and boundary must be visible.", "Direction change and boundary pause must remain visible.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional saved object reference is required for a visible outdoor boundary."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 15,
    maxClipSeconds: 40,
    passCriteria: ["Dog matches DOG_PROFILE.", "Route is visibly safe.", "Leash remains slack.", "Turn is completed.", "Pause is completed.", "Route continues.", "No dragging occurs."],
    failCriteria: ["Sustained pulling occurs.", "Turn fails.", "Dog crosses boundary without pause.", "Setup is unsafe.", "Dragging occurs."],
    needsReviewCriteria: ["Route safety unclear.", "Leash hidden.", "Turn or boundary cropped.", "Dog path unclear."],
    outOfScopeClaims: ["Do not claim busy-street reliability.", "Do not claim traffic safety."],
    safetyNotes: ["Use a quiet safe outdoor route.", "Do not practice near active traffic."],
    prerequisiteActivityIds: ["BW030", "BW044"],
    nextActivityId: "BW048",
    orderedVisibleActions: ["Target dog, owner, leash, quiet safe outdoor route, and boundary are visible.", "Dog completes loose-leash walking.", "Dog completes one direction change.", "Dog pauses at the curb or boundary.", "Dog continues the route without dragging."],
    skillFamily: "Better Walks Routines",
    level: 5,
  },
  {
    id: "BW048",
    title: "Walk -> Stop -> Check-In",
    orderIndex: 48,
    lessonGoal: "Teach the dog to stop with owner during a walk and visibly orient toward owner.",
    visibleCheckpoint: "Dog walks with owner, owner visibly stops, dog stops, and dog visibly orients toward owner.",
    tutorialSteps: ["Choose a safe visible route.", "Keep owner, dog, leash, route, and dog head visible.", "Begin recording before walking.", "Owner stops visibly.", "Reward after the dog stops and orients toward owner."],
    cameraAngle: "WIDE_ROUTE_HEAD_VISIBLE",
    setupInstructions: ["Owner, dog, leash, route, and dog head must be visible.", "Owner stop and dog orientation must be visible.", "Leash must remain visible.", "No physical positioning may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional saved object reference is required."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Walking phase is visible.", "Owner stop is visible.", "Dog stops.", "Dog orients toward owner.", "Leash remains visible."],
    failCriteria: ["Dog continues pulling.", "Dog does not stop.", "Dog never orients toward owner.", "Owner physically positions dog."],
    needsReviewCriteria: ["Dog head hidden.", "Leash hidden.", "Stop timing unclear.", "Owner cropped."],
    outOfScopeClaims: ["Do not claim generalized attention.", "Do not claim formal heel behavior."],
    safetyNotes: ["Use a safe route.", "Do not physically position the dog."],
    prerequisiteActivityIds: ["BW009", "BW010"],
    nextActivityId: "BW049",
    orderedVisibleActions: ["Target dog, owner, leash, route, and dog head are visible.", "Dog walks with owner.", "Owner visibly stops.", "Dog stops.", "Dog visibly orients toward owner without physical positioning."],
    skillFamily: "Better Walks Routines",
    level: 5,
  },
  {
    id: "BW049",
    title: "Walk -> Pass Object -> Check-In",
    orderIndex: 49,
    lessonGoal: "Teach the dog to walk past a visible staged object and check in with owner afterward.",
    visibleCheckpoint: "Dog walks with owner, passes visible staged object, and visibly checks in with owner afterward.",
    tutorialSteps: ["Place one safe staged object near the route.", "Keep object, dog, owner, leash, and route visible.", "Begin recording before the pass.", "Walk past without contact.", "Reward after the dog checks in after the pass."],
    cameraAngle: "WIDE_ROUTE_OBJECT_CHECK_IN",
    setupInstructions: ["Object, dog, owner, leash, and route must be visible.", "Use CUSTOM_OBJECT only when a specific staged object is registered.", "Dog head and post-pass check-in must be visible.", "No dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["If a specific staged object is registered for this attempt, visible object must match saved CUSTOM_OBJECT photos; if identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog remains on route.", "Object pass is visible.", "No contact occurs.", "Dog visibly orients toward owner after pass.", "No dragging occurs."],
    failCriteria: ["Dog contacts object.", "Dog leaves route.", "No post-pass check-in.", "Owner drags dog."],
    needsReviewCriteria: ["Object hidden.", "Dog head hidden.", "Route cropped.", "Leash hidden.", "Timing unclear.", "Object identity unclear when registration is required."],
    outOfScopeClaims: ["Do not claim generalized distraction handling.", "Do not claim behavior around all objects."],
    safetyNotes: ["Use a safe staged object.", "Keep route distance comfortable."],
    prerequisiteActivityIds: ["BW043", "BW048"],
    nextActivityId: "BW050",
    orderedVisibleActions: ["Target dog, owner, leash, route, and staged object are visible.", "Dog walks with owner and passes the object.", "Dog avoids contact and stays on route.", "Dog visibly checks in with owner after the pass.", "No dragging occurs."],
    skillFamily: "Better Walks Routines",
    level: 5,
  },
  {
    id: "BW050",
    title: "Better-Walks Final Routine",
    orderIndex: 50,
    lessonGoal: "Verify a narrow visible better-walks routine containing core start, walking, turn, stop, check-in, pass or pause, and optional recall components.",
    visibleCheckpoint: "A clearly segmented single clip or short clip set contains doorway wait or start-on-release, loose-leash walking, one direction change, one stop, one check-in, one object pass or curb pause, and optional recall on a safe setup.",
    tutorialSteps: ["Choose a safe route and only the components being verified.", "Keep dog, owner, leash, route, and required boundary or object visible.", "Record a clearly segmented single clip or short clip set.", "Include cue audio where cue timing matters.", "End after all required visible routine components are complete."],
    cameraAngle: "SEGMENTED_WIDE_ROUTE_FINAL_ROUTINE",
    setupInstructions: ["Dog, owner, leash, route, and required boundary or object must be visible.", "Use clearly segmented single clip or clip set.", "Audio is required where cue timing matters.", "Maximum combined duration is 60 seconds.", "No unsafe handling or dragging may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["If a doorway component is included, visible doorway must match saved TARGET_DOORWAY reference photos.", "If a cone component is included, visible cone must match saved TARGET_CONE reference photos.", "If a staged object component is registered, visible object must match saved CUSTOM_OBJECT photos.", "If any required reference object identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 15,
    maxClipSeconds: 60,
    passCriteria: ["Dog matches DOG_PROFILE.", "Every required visible segment passes.", "Leash remains visible.", "No unsafe handling occurs.", "No dragging occurs.", "Required saved references match when applicable."],
    failCriteria: ["Any required segment clearly fails.", "Sustained pulling occurs.", "Direction change fails.", "Boundary pause fails.", "Check-in fails.", "Setup is unsafe.", "Dragging occurs."],
    needsReviewCriteria: ["Required segment missing.", "Leash hidden.", "Route safety unclear.", "Reference object unclear.", "Audio unclear when required.", "Sequence cropped."],
    outOfScopeClaims: ["Do not claim real-world traffic safety.", "Do not claim permanent loose-leash reliability.", "Do not claim off-leash reliability."],
    safetyNotes: ["Use only a safe route.", "Do not test near traffic.", "Keep the routine narrow and observable."],
    prerequisiteActivityIds: ["BW047", "BW049"],
    nextActivityId: null,
    orderedVisibleActions: ["Target dog, owner, leash, route, and required boundary or object are visible in a clearly segmented routine.", "Doorway wait or start-on-release segment is completed.", "Loose-leash walking segment is completed.", "One direction change is completed.", "One stop and one check-in are completed.", "One object pass or curb pause is completed.", "Optional recall is shown only in a safe setup when included."],
    skillFamily: "Better Walks Routines",
    level: 5,
  },
];

export const BW041_BW050: BatchActivity[] = SPECS.map(makeActivity);
