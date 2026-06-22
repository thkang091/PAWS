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
${spec.audioRequired ? "Audio is required. If the required cue, doorbell, drop cue, release cue, or timing audio is missing or unusable, return NEEDS_REVIEW." : "Audio is optional for this activity. Do not fail solely because audio is absent; return NEEDS_REVIEW only if the submitted attempt depends on cue timing that cannot be judged without audio."}

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
    whyItMatters: "This activity combines previously verified household behaviors into one narrow, observable routine without claiming broader reliability outside the submitted clip.",
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
    xpReward: spec.id === "BH050" ? 150 : spec.orderIndex >= 47 ? 130 : 120,
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
    id: "BH041",
    title: "Follow Owner to Mat",
    orderIndex: 41,
    lessonGoal: "Teach the dog to follow the visible owner to the registered mat and enter the boundary.",
    visibleCheckpoint: "Dog follows visible owner to registered TARGET_MAT and places at least two paws inside boundary.",
    tutorialSteps: [
      "Use the registered TARGET_MAT.",
      "Position the camera so the owner, dog, path, and mat are visible.",
      "Begin recording before the owner starts moving.",
      "Have the owner move toward the mat without pulling or pushing the dog.",
      "Reward after the dog places at least two paws inside the mat boundary.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Owner, dog, travel path, and full mat must be visible.",
      "Dog movement must be visible from start through mat entry.",
      "No dragging, pushing, leash tension, or physical guidance may move the dog.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Mat matches TARGET_MAT reference photos.",
      "Dog follows owner.",
      "Dog enters mat boundary with at least two paws.",
      "No physical guidance occurs.",
    ],
    failCriteria: [
      "Dog does not follow.",
      "Dog does not enter mat.",
      "Owner drags dog.",
    ],
    needsReviewCriteria: [
      "Path hidden.",
      "Mat cropped.",
      "Owner cropped.",
      "Dog movement unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized follow behavior.",
      "Do not infer relaxation on the mat.",
    ],
    safetyNotes: [
      "Keep the path short and clear.",
      "Do not pull or push the dog.",
      "Use a stable mat.",
    ],
    prerequisiteActivityIds: ["BH007"],
    nextActivityId: "BH042",
    orderedVisibleActions: [
      "Target dog, owner, path, and registered TARGET_MAT are visible before movement begins.",
      "Owner visibly moves toward the mat.",
      "Dog follows the owner along the visible path.",
      "Dog places at least two paws inside the mat boundary without physical guidance.",
    ],
    skillFamily: "Home Routine Chains",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: true,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH042",
    title: "Place -> Release -> Return to Mat",
    orderIndex: 42,
    lessonGoal: "Teach the dog to leave the registered mat only after release and return after the configured return cue.",
    visibleCheckpoint: "Dog begins on registered mat, waits, exits only after audible release, and returns to mat after configured return cue.",
    tutorialSteps: [
      "Use the registered TARGET_MAT.",
      "Keep the full mat, owner, and dog visible.",
      "Begin with the dog on the mat.",
      "Give one audible release cue and allow exit.",
      "Give the configured return cue and reward after the dog returns to the mat.",
    ],
    cameraAngle: "VISIBLE_TARGET_ZONE",
    setupInstructions: [
      "Full mat must remain visible.",
      "Owner and dog must be visible.",
      "Release cue and return cue must be audible.",
      "Dog path off and back to the mat must be visible.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Mat matches TARGET_MAT reference photos.",
      "Dog exits only after release.",
      "Dog returns after return cue.",
    ],
    failCriteria: [
      "Dog exits before release.",
      "Dog does not return.",
      "Owner physically guides dog.",
    ],
    needsReviewCriteria: [
      "Audio unclear.",
      "Timing unclear.",
      "Mat cropped.",
      "Dog path hidden.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized place reliability.",
      "Do not infer emotional calmness.",
    ],
    safetyNotes: [
      "Use clear cues.",
      "Keep distance short.",
      "Do not physically guide the dog back to the mat.",
    ],
    prerequisiteActivityIds: ["BH008", "BH006"],
    nextActivityId: "BH043",
    orderedVisibleActions: [
      "Target dog begins on the registered TARGET_MAT with the full mat visible.",
      "Dog waits on the mat before release.",
      "One release cue is audible and dog exits only after it.",
      "One return cue is audible.",
      "Dog returns to the registered mat after the return cue without physical guidance.",
    ],
    skillFamily: "Home Routine Chains",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: true,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH043",
    title: "Doorbell -> Mat",
    orderIndex: 43,
    lessonGoal: "Teach the dog to travel to the registered mat after an audible doorbell sound.",
    visibleCheckpoint: "Audible doorbell sound occurs and dog travels to registered TARGET_MAT.",
    tutorialSteps: [
      "Use the registered TARGET_MAT.",
      "Position the camera so the dog start area and mat are visible.",
      "Begin recording before the doorbell sound.",
      "Play or ring one audible doorbell sound.",
      "Reward after the dog enters the mat after the sound.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Dog start area and mat must be visible.",
      "Doorbell sound must be audible.",
      "Dog path to mat must remain visible.",
      "Begin recording before the doorbell sound.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Doorbell is audible.",
      "Mat matches TARGET_MAT reference photos.",
      "Dog enters mat after sound.",
    ],
    failCriteria: [
      "Dog moves elsewhere.",
      "Dog does not enter mat.",
      "Movement occurs only before sound.",
    ],
    needsReviewCriteria: [
      "Audio missing.",
      "Path hidden.",
      "Mat unclear.",
      "Dog start area cropped.",
    ],
    outOfScopeClaims: [
      "Do not claim barking is solved.",
      "Do not claim generalized doorbell reliability.",
    ],
    safetyNotes: [
      "Use a manageable doorbell volume.",
      "Avoid repeated stressful doorbell trials.",
      "Keep the mat path clear.",
    ],
    prerequisiteActivityIds: ["BH023"],
    nextActivityId: "BH044",
    orderedVisibleActions: [
      "Target dog start area and registered TARGET_MAT are visible before the sound.",
      "One doorbell sound is audible.",
      "Dog travels toward the registered mat after the sound.",
      "Dog enters the mat boundary.",
    ],
    skillFamily: "Home Routine Chains",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: true,
    ownerRequiredInFrame: false,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH044",
    title: "Mat -> Hold -> Release",
    orderIndex: 44,
    lessonGoal: "Teach the dog to hold inside the registered mat boundary and exit only after release.",
    visibleCheckpoint: "Dog remains inside TARGET_MAT boundary for configured hold interval and exits only after audible release cue.",
    tutorialSteps: [
      "Use the registered TARGET_MAT.",
      "Keep the full mat visible.",
      "Begin recording before the hold interval starts.",
      "Wait for the configured hold interval.",
      "Give one audible release cue and reward after the dog exits only after release.",
    ],
    cameraAngle: "VISIBLE_TARGET_ZONE",
    setupInstructions: [
      "Full mat boundary must remain visible.",
      "Release cue must be audible.",
      "Configured hold interval and exit must be visible.",
      "No physical restraint may hold the dog on the mat.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    audioRequired: true,
    fps: 2,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Mat matches TARGET_MAT reference photos.",
      "Hold interval is completed.",
      "Dog exits after release only.",
    ],
    failCriteria: [
      "Dog exits before hold or cue.",
      "Physical restraint occurs.",
    ],
    needsReviewCriteria: [
      "Duration unclear.",
      "Mat cropped.",
      "Audio unclear.",
      "Dog hidden during hold or exit.",
    ],
    outOfScopeClaims: [
      "Do not infer emotional calmness.",
      "Do not claim generalized place reliability.",
    ],
    safetyNotes: [
      "Use a reachable hold interval.",
      "Do not physically hold the dog in place.",
      "Keep the mat comfortable.",
    ],
    prerequisiteActivityIds: ["BH024"],
    nextActivityId: "BH045",
    orderedVisibleActions: [
      "Target dog is inside the registered TARGET_MAT boundary before the hold starts.",
      "Dog remains inside the mat boundary for the configured hold interval.",
      "One release cue is audible.",
      "Dog exits the mat only after the release cue.",
    ],
    skillFamily: "Home Routine Chains",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: true,
    ownerRequiredInFrame: false,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH045",
    title: "Place -> Wait -> Release",
    orderIndex: 45,
    lessonGoal: "Teach the dog to enter the registered mat, wait for the configured interval, and exit only after release.",
    visibleCheckpoint: "Dog enters registered mat, waits for configured interval, and exits only after audible release cue.",
    tutorialSteps: [
      "Use the registered TARGET_MAT.",
      "Keep the mat visible before entry.",
      "Begin recording before the dog enters.",
      "Let the dog enter the mat and wait for the configured interval.",
      "Give one audible release cue and reward after the dog exits only after release.",
    ],
    cameraAngle: "VISIBLE_TARGET_ZONE",
    setupInstructions: [
      "Mat must be visible before entry and through exit.",
      "Entry, hold, release cue, and exit must be visible.",
      "Release cue must be audible.",
      "Use 2-3 FPS for the hold and release evidence.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Mat matches TARGET_MAT reference photos.",
      "Entry is visible.",
      "Hold is visible.",
      "Release is audible.",
      "Dog exits after release only.",
    ],
    failCriteria: [
      "Dog exits early.",
      "Dog never enters mat.",
      "Restraint occurs.",
    ],
    needsReviewCriteria: [
      "Mat cropped.",
      "Audio missing.",
      "Timing unclear.",
      "Dog hidden during entry, hold, or exit.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized place reliability.",
      "Do not infer relaxation.",
    ],
    safetyNotes: [
      "Keep the wait interval realistic.",
      "Do not physically hold the dog on the mat.",
      "Release clearly before rewarding the exit.",
    ],
    prerequisiteActivityIds: ["BH042"],
    nextActivityId: "BH046",
    orderedVisibleActions: [
      "Target dog and registered TARGET_MAT are visible before entry.",
      "Dog enters the registered mat.",
      "Dog waits on the mat for the configured interval.",
      "One release cue is audible.",
      "Dog exits only after the release cue.",
    ],
    skillFamily: "Home Routine Chains",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: true,
    ownerRequiredInFrame: false,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH046",
    title: "Wait -> Release -> Bowl",
    orderIndex: 46,
    lessonGoal: "Teach the dog to wait away from the registered bowl and approach only after audible release.",
    visibleCheckpoint: "Dog remains away from registered TARGET_BOWL, waits for configured interval, and approaches only after audible release.",
    tutorialSteps: [
      "Use the registered TARGET_BOWL.",
      "Position the camera so the bowl and dog are visible.",
      "Begin recording before the wait interval.",
      "Wait for the configured interval.",
      "Give one audible release cue and allow approach only after cue.",
    ],
    cameraAngle: "VISIBLE_OBJECT_AND_DESTINATION",
    setupInstructions: [
      "Bowl and dog must be visible.",
      "Release cue must be audible.",
      "Approach timing must be visible.",
      "Use 2-3 FPS for the wait and release evidence.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BOWL"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 20,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Bowl matches TARGET_BOWL reference photos.",
      "Hold interval is completed.",
      "Release is audible.",
      "Approach occurs after cue.",
    ],
    failCriteria: [
      "Dog reaches bowl before cue.",
      "Restraint is used.",
      "Wrong bowl is used.",
    ],
    needsReviewCriteria: [
      "Bowl hidden.",
      "Audio unclear.",
      "Timing unclear.",
      "Dog path hidden.",
    ],
    outOfScopeClaims: [
      "Do not claim long-term meal manners.",
      "Do not infer food guarding status.",
    ],
    safetyNotes: [
      "Avoid conflict around food.",
      "Do not physically block or hold the dog.",
      "Stop if guarding behavior appears.",
    ],
    prerequisiteActivityIds: ["BH020"],
    nextActivityId: "BH047",
    orderedVisibleActions: [
      "Target dog and registered TARGET_BOWL are visible before the wait interval.",
      "Dog remains away from the bowl for the configured interval.",
      "One release cue is audible.",
      "Dog approaches the bowl only after the release cue.",
    ],
    skillFamily: "Home Routine Chains",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: false,
    ownerRequiredInFrame: false,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH047",
    title: "Trade -> Drop -> Settle",
    orderIndex: 47,
    lessonGoal: "Teach the dog to release a registered toy during trade, complete the drop cue, move to the registered mat, and settle.",
    visibleCheckpoint: "Dog releases registered TARGET_TOY during trade, completes drop cue, moves to TARGET_MAT, and enters visible settle posture.",
    tutorialSteps: [
      "Use the registered TARGET_TOY and TARGET_MAT.",
      "Position the camera so the dog, toy, and mat are visible.",
      "Begin recording before the trade and drop sequence.",
      "Give the drop cue with audio available.",
      "Reward after voluntary release, mat travel, and visible settle posture.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_DOG_AND_OBJECTS",
    setupInstructions: [
      "Dog, toy, and mat must be visible.",
      "Audio is required for the drop cue.",
      "Use 5 FPS during toy release and 3 FPS during mat travel.",
      "Do not forcibly remove the toy.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY", "TARGET_MAT"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Toy matches TARGET_TOY reference photos.",
      "Voluntary release is visible.",
      "Mat matches TARGET_MAT reference photos.",
      "Settle posture is visible.",
      "No forced removal occurs.",
    ],
    failCriteria: [
      "Forced toy removal occurs.",
      "No drop occurs.",
      "No mat travel occurs.",
      "No settle occurs.",
    ],
    needsReviewCriteria: [
      "Toy hidden.",
      "Mat hidden.",
      "Audio missing.",
      "Sequence unclear.",
      "Dog mouth hidden during release.",
    ],
    outOfScopeClaims: [
      "Do not claim resource guarding recovery.",
      "Do not infer emotional regulation.",
    ],
    safetyNotes: [
      "Use a safe toy and fair trade.",
      "Do not pry the toy from the dog.",
      "Stop if guarding behavior appears.",
    ],
    prerequisiteActivityIds: ["BH028", "BH036"],
    nextActivityId: "BH048",
    orderedVisibleActions: [
      "Target dog, registered TARGET_TOY, and registered TARGET_MAT are visible before the sequence.",
      "Dog releases the registered toy during the trade sequence.",
      "Drop cue is audible and completed without forced removal.",
      "Dog moves to the registered mat.",
      "Dog enters a visible settle posture.",
    ],
    skillFamily: "Final Home Routine Chains",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH048",
    title: "Doorway -> Mat",
    orderIndex: 48,
    lessonGoal: "Teach the dog to wait behind a registered doorway, cross after release, and travel to the registered mat.",
    visibleCheckpoint: "Dog waits behind registered TARGET_DOORWAY, crosses only after audible release, and travels to registered TARGET_MAT.",
    tutorialSteps: [
      "Use the registered TARGET_DOORWAY and TARGET_MAT.",
      "Position the camera so the doorway, mat, dog, and owner are visible.",
      "Begin recording before the doorway wait.",
      "Give one audible release cue.",
      "Reward after the dog crosses after release and travels to the mat.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_DOG_AND_OBJECTS",
    setupInstructions: [
      "Doorway, mat, dog, and owner must be visible.",
      "Doorway threshold and dog path to mat must be visible.",
      "Release cue must be audible.",
      "No physical restraint may hold the dog back.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY", "TARGET_MAT"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 12,
    maxClipSeconds: 25,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Doorway matches TARGET_DOORWAY reference photos.",
      "Mat matches TARGET_MAT reference photos.",
      "Dog waits behind the threshold.",
      "Release is audible.",
      "Dog travels to mat.",
    ],
    failCriteria: [
      "Dog crosses early.",
      "Dog does not reach mat.",
      "Restraint occurs.",
    ],
    needsReviewCriteria: [
      "Threshold hidden.",
      "Audio unclear.",
      "Path hidden.",
      "Mat unclear.",
      "Doorway identity unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim exterior-door reliability.",
      "Do not imply safety near roads.",
    ],
    safetyNotes: [
      "Use an interior doorway.",
      "Keep the path to mat clear.",
      "Do not practice near unsafe exits.",
    ],
    prerequisiteActivityIds: ["BH017", "BH041"],
    nextActivityId: "BH049",
    orderedVisibleActions: [
      "Target dog, owner, registered TARGET_DOORWAY, and registered TARGET_MAT are visible before the wait.",
      "Dog waits behind the registered doorway threshold.",
      "One release cue is audible.",
      "Dog crosses the threshold only after the release cue.",
      "Dog travels to the registered mat.",
    ],
    skillFamily: "Final Home Routine Chains",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: true,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH049",
    title: "Meal -> Settle",
    orderIndex: 49,
    lessonGoal: "Teach the dog to wait before the registered bowl, approach after release, then move to the registered mat and settle.",
    visibleCheckpoint: "Dog waits before registered TARGET_BOWL, approaches only after release, and after meal phase moves to registered TARGET_MAT and enters visible settle posture.",
    tutorialSteps: [
      "Use the registered TARGET_BOWL and TARGET_MAT.",
      "Position the camera so the bowl, mat, and dog are visible.",
      "Begin recording before the bowl wait.",
      "Give one audible release cue for bowl access.",
      "After the meal phase, cue or guide without force toward the mat and reward visible settle posture.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_DOG_AND_OBJECTS",
    setupInstructions: [
      "Bowl and mat must be visible.",
      "Dog must remain visible.",
      "Release cue for bowl access must be audible.",
      "Meal-to-settle transition must be visible.",
      "Use 2-3 FPS for wait, release, and settle evidence.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BOWL", "TARGET_MAT"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 15,
    maxClipSeconds: 35,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Bowl matches TARGET_BOWL reference photos.",
      "Wait interval is completed.",
      "Release is audible.",
      "Approach occurs after release.",
      "Mat matches TARGET_MAT reference photos.",
      "Settle is visible.",
    ],
    failCriteria: [
      "Early bowl access occurs.",
      "No settle occurs.",
      "Restraint occurs.",
    ],
    needsReviewCriteria: [
      "Bowl or mat hidden.",
      "Timing unclear.",
      "Audio missing.",
      "Meal-to-settle transition hidden.",
    ],
    outOfScopeClaims: [
      "Do not claim long-term meal manners.",
      "Do not infer food guarding status.",
    ],
    safetyNotes: [
      "Avoid conflict around food.",
      "Do not physically restrain the dog.",
      "Stop if guarding behavior appears.",
    ],
    prerequisiteActivityIds: ["BH046", "BH035"],
    nextActivityId: "BH050",
    orderedVisibleActions: [
      "Target dog, registered TARGET_BOWL, and registered TARGET_MAT are visible before the bowl wait.",
      "Dog waits before the registered bowl.",
      "One release cue is audible.",
      "Dog approaches the bowl only after the release cue.",
      "After the meal phase, dog moves to the registered mat and enters visible settle posture.",
    ],
    skillFamily: "Final Home Routine Chains",
    level: 4,
    fullDogBodyRequired: true,
    pawsRequired: false,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
  {
    id: "BH050",
    title: "Better-Behavior Final Routine",
    orderIndex: 50,
    lessonGoal: "Verify a narrow visible home routine that combines doorway wait, mat behavior, bowl wait or toy drop, and release cue evidence.",
    visibleCheckpoint: "A narrow visible home routine contains doorway wait, mat entry, mat hold, bowl wait or toy drop, and release cue.",
    tutorialSteps: [
      "Prepare the registered doorway, mat, bowl, and toy references needed for the chosen routine.",
      "Record one clearly segmented clip or multiple short clips with component-specific objects visible.",
      "Include doorway wait, mat entry, mat hold, bowl wait or toy drop, and a release cue.",
      "Keep audio available wherever cue timing matters.",
      "Keep the maximum combined duration at 60 seconds.",
    ],
    cameraAngle: "SEGMENTED_HOME_ROUTINE",
    setupInstructions: [
      "Single clip or multiple short clips must be clearly segmented.",
      "Component-specific object references must be visible in their segments.",
      "Audio is required where cue timing matters.",
      "Use component-appropriate FPS for doorway, mat, bowl, and toy segments.",
      "Maximum combined duration is 60 seconds.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT", "TARGET_DOORWAY", "TARGET_BOWL", "TARGET_TOY"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 15,
    maxClipSeconds: 60,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Every required visible segment passes.",
      "All required saved reference objects match.",
      "No unsafe handling occurs.",
    ],
    failCriteria: [
      "Any required visible segment clearly fails.",
      "Early threshold crossing occurs.",
      "Early bowl access occurs.",
      "Forced toy removal occurs.",
      "Physical restraint occurs.",
    ],
    needsReviewCriteria: [
      "Any required segment unclear.",
      "Reference object unclear.",
      "Audio missing when required.",
      "Action sequence cropped.",
      "Multiple dogs make identity ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not claim the dog is permanently calm at home.",
      "Do not claim generalized reliability outside the submitted routine.",
    ],
    safetyNotes: [
      "Use only safe interior setups.",
      "Do not force, drag, pin, or physically restrain the dog.",
      "Stop if food or toy guarding behavior appears.",
    ],
    prerequisiteActivityIds: ["BH048", "BH049"],
    nextActivityId: null,
    orderedVisibleActions: [
      "Target dog and required registered references are visible in their relevant routine segments.",
      "Dog completes a doorway wait segment.",
      "Dog completes mat entry and mat hold segments.",
      "Dog completes either a bowl wait segment or a toy drop segment.",
      "A release cue is audible where cue timing matters.",
    ],
    skillFamily: "Final Home Routine Chains",
    level: 5,
    fullDogBodyRequired: true,
    pawsRequired: true,
    ownerRequiredInFrame: true,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
  },
];

export const BH041_BH050: BatchActivity[] = SPECS.map(makeActivity);
