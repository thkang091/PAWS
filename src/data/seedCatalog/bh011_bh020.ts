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
  prerequisiteActivityId: string | null;
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
${spec.prerequisiteActivityId ? `Prerequisite activity ${spec.prerequisiteActivityId} has been passed. ` : ""}${spec.orderedVisibleActions[0]}

VISIBLE CHECKPOINT
${spec.visibleCheckpoint}

RECORDING SETUP
- Camera angle: ${spec.cameraAngle}
${list(spec.setupInstructions)}

REQUIRED SAVED REFERENCE PHOTOS
${list(spec.requiredReferenceAssets)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If the release cue or required cue timing is inaudible, return NEEDS_REVIEW." : "Audio is optional. Do not fail solely because audio is absent."}

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
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: false,
    ownerRequiredInFrame: spec.audioRequired || spec.id === "BH013",
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
    setupInstructions: spec.setupInstructions,
  };
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
    prerequisites: spec.prerequisiteActivityId ? [spec.prerequisiteActivityId] : [],
    regressionActivityId: spec.prerequisiteActivityId,
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
    xpReward: spec.orderIndex >= 18 ? 85 : spec.orderIndex >= 14 ? 80 : 70,
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
    prerequisiteActivityId: spec.prerequisiteActivityId,
    nextActivityId: spec.nextActivityId,
    orderedVisibleActions: spec.orderedVisibleActions,
  };
};

const SPECS: ActivitySpec[] = [
  {
    id: "BH011",
    title: "Safe-Zone Entry",
    orderIndex: 11,
    lessonGoal: "Teach the dog to voluntarily enter a registered safe zone.",
    visibleCheckpoint: "The dog begins outside the registered safe-zone boundary, voluntarily travels into the same visible safe zone shown in the saved reference photos, and places at least two paws inside the boundary.",
    tutorialSteps: [
      "Choose a visible mat or open crate as the safe zone.",
      "Register the safe-zone reference photo before recording.",
      "Place the phone so the entire safe-zone boundary stays visible.",
      "Start with the dog outside the boundary.",
      "Encourage voluntary entry without dragging or pushing.",
      "Reward after the dog places at least two paws inside the zone.",
    ],
    cameraAngle: "VISIBLE_TARGET_ZONE",
    setupInstructions: [
      "Entire safe-zone boundary must stay visible.",
      "Dog must be visible from start through entry.",
      "Begin recording before the dog enters.",
      "Use the saved TARGET_MAT or TARGET_CRATE reference that matches the selected safe-zone type.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT_OR_TARGET_CRATE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "Target dog matches DOG_PROFILE references.",
      "Saved safe-zone item matches the visible zone.",
      "Dog begins outside the zone.",
      "Dog voluntarily enters the zone.",
      "At least two paws visibly enter the boundary.",
      "No visible dragging, lifting, pushing, or physical restraint occurs.",
    ],
    failCriteria: [
      "Clip is clear and scorable but dog does not enter the safe zone.",
      "Dog enters a visibly different unregistered zone.",
      "Owner visibly forces dog into the zone.",
    ],
    needsReviewCriteria: [
      "Safe-zone boundary cropped.",
      "Paws hidden.",
      "Dog already inside the zone at clip start.",
      "Saved safe-zone item cannot be matched.",
      "Dog movement path hidden.",
      "Multiple dogs make identity unclear.",
      "Lighting insufficient.",
    ],
    outOfScopeClaims: [
      "Do not claim the dog feels safe.",
      "Do not claim emotional comfort.",
      "Do not claim the dog can remain alone.",
      "Do not claim crate training is complete.",
    ],
    safetyNotes: [
      "Use a stable and comfortable zone.",
      "Never force entry.",
      "Keep repetitions short.",
    ],
    prerequisiteActivityId: "BH007",
    nextActivityId: "BH012",
    orderedVisibleActions: [
      "Dog starts outside the registered safe-zone boundary.",
      "The registered safe zone is fully visible and matches saved reference photos.",
      "Dog voluntarily travels into the safe zone.",
      "At least two paws enter the safe-zone boundary.",
    ],
    skillFamily: "Safe Zone and Crate Foundations",
    level: 1,
  },
  {
    id: "BH012",
    title: "Open-Crate Entry",
    orderIndex: 12,
    lessonGoal: "Teach the dog to voluntarily enter a registered crate while the crate door remains open.",
    visibleCheckpoint: "The dog begins outside the registered crate and voluntarily crosses the crate entrance while the door remains visibly open.",
    tutorialSteps: [
      "Register clear photos of the crate.",
      "Leave the crate door fully open.",
      "Position the phone so the entrance and dog remain visible.",
      "Begin with the dog outside the crate.",
      "Encourage voluntary entry.",
      "Reward entry without closing the door.",
    ],
    cameraAngle: "VISIBLE_TARGET_ZONE",
    setupInstructions: [
      "Full crate entrance must be visible.",
      "Crate door must be visible and open.",
      "Dog must be visible from outside through entry.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CRATE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE references.",
      "Visible crate matches TARGET_CRATE photos.",
      "Crate door remains visibly open.",
      "Dog starts outside crate.",
      "Dog voluntarily crosses crate entrance.",
      "No physical forcing occurs.",
    ],
    failCriteria: [
      "Dog does not enter the crate.",
      "Dog enters a visibly different crate.",
      "Owner pushes, drags, lifts, or restrains dog into crate.",
      "Crate door is visibly closed during entry.",
    ],
    needsReviewCriteria: [
      "Crate entrance cropped.",
      "Crate identity unclear.",
      "Crate door position hidden.",
      "Dog already inside crate at clip start.",
      "Dog movement obscured.",
      "Multiple dogs make identity unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim crate comfort.",
      "Do not infer emotional safety.",
      "Do not claim dog can remain crated alone.",
    ],
    safetyNotes: [
      "Keep crate door open.",
      "Never force entry.",
      "Do not use crate as punishment.",
    ],
    prerequisiteActivityId: "BH011",
    nextActivityId: "BH013",
    orderedVisibleActions: [
      "Dog starts outside the registered crate.",
      "Registered crate entrance and open door are visible.",
      "Dog voluntarily crosses the crate entrance.",
      "Crate door remains open throughout entry.",
    ],
    skillFamily: "Safe Zone and Crate Foundations",
    level: 1,
  },
  {
    id: "BH013",
    title: "Crate Send From 3 Feet",
    orderIndex: 13,
    lessonGoal: "Teach the dog to travel a short distance into the registered open crate.",
    visibleCheckpoint: "The dog starts approximately 3 feet away from the registered open crate and voluntarily travels through the crate entrance.",
    tutorialSteps: [
      "Use the same registered crate from BH012.",
      "Keep the crate door open.",
      "Position the dog approximately 3 feet away.",
      "Record the dog, start position, and crate entrance together.",
      "Give the configured cue if using one.",
      "Reward voluntary entry.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Dog start position must be visible.",
      "Owner must be visible when cue timing is judged.",
      "Crate entrance must be visible.",
      "Crate door must be visibly open.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CRATE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE references.",
      "Visible crate matches TARGET_CRATE.",
      "Dog begins approximately 3 feet away.",
      "Dog voluntarily travels into crate.",
      "Crate door remains open.",
      "If verbal cue timing is part of the attempt, movement begins after the audible cue.",
      "No physical forcing occurs.",
    ],
    failCriteria: [
      "Dog travels to a different destination.",
      "Dog does not enter crate.",
      "Owner physically moves dog into crate.",
      "If audio timing is required, dog movement occurs only before the cue.",
    ],
    needsReviewCriteria: [
      "Start distance cannot be reasonably estimated.",
      "Cue inaudible when required.",
      "Crate entrance cropped.",
      "Movement path hidden.",
      "Crate identity unclear.",
      "Clip begins after dog starts moving.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized crate reliability.",
      "Do not claim independence.",
      "Do not infer emotional comfort.",
    ],
    safetyNotes: [
      "Keep the distance easy.",
      "Leave the door open.",
      "Stop before frustration.",
    ],
    prerequisiteActivityId: "BH012",
    nextActivityId: "BH014",
    orderedVisibleActions: [
      "Dog starts approximately 3 feet from the registered open crate.",
      "Crate entrance and open door remain visible.",
      "Dog voluntarily travels from the start position to the crate.",
      "Dog crosses through the crate entrance.",
    ],
    skillFamily: "Safe Zone and Crate Foundations",
    level: 1,
  },
  {
    id: "BH014",
    title: "Doorway Wait: 1 Second",
    orderIndex: 14,
    lessonGoal: "Teach the dog to remain behind a registered interior doorway threshold until release.",
    visibleCheckpoint: "The dog remains behind the registered threshold for at least 1 second and crosses only after one audible release cue.",
    tutorialSteps: [
      "Register a clear photo of an interior doorway.",
      "Position the camera so the threshold stays visible.",
      "Begin with the dog behind the threshold.",
      "Ask for a short pause.",
      "Give one audible release cue.",
      "Reward crossing only after the release cue.",
    ],
    cameraAngle: "VISIBLE_TARGET_ZONE",
    setupInstructions: [
      "Full threshold must be visible.",
      "Dog and owner must be visible.",
      "Use an interior doorway.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "Dog matches DOG_PROFILE references.",
      "Visible doorway matches TARGET_DOORWAY.",
      "Dog remains behind threshold for at least 1 second.",
      "Release cue is audible.",
      "Dog crosses only after release cue.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog crosses before release cue.",
      "Dog never pauses behind threshold.",
      "Owner physically restrains dog.",
    ],
    needsReviewCriteria: [
      "Threshold cropped.",
      "Dog hidden by door.",
      "Release cue inaudible.",
      "Timing unclear.",
      "Doorway identity unclear.",
      "Multiple dogs make identity unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim exterior-door reliability.",
      "Do not claim safety near traffic.",
      "Do not infer generalized impulse control.",
    ],
    safetyNotes: [
      "Use an interior doorway.",
      "Do not test near traffic-facing exits.",
    ],
    prerequisiteActivityId: "BH013",
    nextActivityId: "BH015",
    orderedVisibleActions: [
      "Dog starts behind the registered interior doorway threshold.",
      "Dog remains behind the threshold for at least 1 second.",
      "One audible release cue occurs.",
      "Dog crosses only after the release cue.",
    ],
    skillFamily: "Doorway Manners",
    level: 2,
  },
  {
    id: "BH015",
    title: "Doorway Wait: 3 Seconds",
    orderIndex: 15,
    lessonGoal: "Extend doorway wait duration to 3 seconds.",
    visibleCheckpoint: "The dog remains behind the registered doorway threshold continuously for at least 3 seconds and crosses only after one audible release cue.",
    tutorialSteps: [
      "Use the same registered doorway from BH014.",
      "Keep the threshold fully visible.",
      "Begin with the dog behind the threshold.",
      "Wait for a continuous 3-second pause.",
      "Give one audible release cue.",
      "Reward crossing only after release.",
    ],
    cameraAngle: "VISIBLE_TARGET_ZONE",
    setupInstructions: [
      "Full threshold must be visible.",
      "Dog and owner must be visible.",
      "Audio must capture the release cue.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY"],
    audioRequired: true,
    fps: 2,
    minClipSeconds: 7,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE references.",
      "Doorway matches TARGET_DOORWAY.",
      "Dog remains behind threshold continuously for at least 3 seconds.",
      "Release cue is audible.",
      "Dog crosses only after release cue.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog crosses before 3 seconds.",
      "Dog crosses before release cue.",
      "Owner physically restrains dog.",
    ],
    needsReviewCriteria: [
      "Threshold cropped.",
      "Dog hidden.",
      "Release cue inaudible.",
      "Duration unclear.",
      "Doorway identity unclear.",
      "Clip too short.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized doorway reliability.",
      "Do not claim exterior-door safety.",
    ],
    safetyNotes: [
      "Use an interior doorway.",
      "Keep difficulty low.",
    ],
    prerequisiteActivityId: "BH014",
    nextActivityId: "BH016",
    orderedVisibleActions: [
      "Dog starts behind the registered doorway threshold.",
      "Dog remains behind the threshold continuously for at least 3 seconds.",
      "One audible release cue occurs.",
      "Dog crosses only after release.",
    ],
    skillFamily: "Doorway Manners",
    level: 2,
  },
  {
    id: "BH016",
    title: "Doorway Wait: 5 Seconds",
    orderIndex: 16,
    lessonGoal: "Extend doorway wait duration to 5 seconds.",
    visibleCheckpoint: "The dog remains behind the registered doorway threshold continuously for at least 5 seconds and crosses only after one audible release cue.",
    tutorialSteps: [
      "Use the registered interior doorway.",
      "Keep the threshold and dog visible.",
      "Begin with the dog behind the threshold.",
      "Wait for a continuous 5-second pause.",
      "Give one audible release cue.",
      "Reward crossing only after release.",
    ],
    cameraAngle: "VISIBLE_TARGET_ZONE",
    setupInstructions: [
      "Full threshold must be visible.",
      "Dog and owner must be visible.",
      "Audio must capture the release cue.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY"],
    audioRequired: true,
    fps: 2,
    minClipSeconds: 9,
    maxClipSeconds: 18,
    passCriteria: [
      "Dog matches DOG_PROFILE references.",
      "Doorway matches TARGET_DOORWAY.",
      "Dog remains behind threshold continuously for at least 5 seconds.",
      "Release cue is audible.",
      "Dog crosses only after release.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog crosses before required duration.",
      "Dog crosses before release cue.",
      "Owner physically restrains dog.",
    ],
    needsReviewCriteria: [
      "Threshold cropped.",
      "Dog hidden.",
      "Duration unclear.",
      "Release cue inaudible.",
      "Doorway identity unclear.",
      "Clip too short.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized doorway safety.",
      "Do not claim impulse control outside the submitted clip.",
    ],
    safetyNotes: [
      "Use an interior doorway.",
      "Do not increase difficulty too quickly.",
    ],
    prerequisiteActivityId: "BH015",
    nextActivityId: "BH017",
    orderedVisibleActions: [
      "Dog starts behind the registered doorway threshold.",
      "Dog remains behind the threshold continuously for at least 5 seconds.",
      "One audible release cue occurs.",
      "Dog crosses only after release.",
    ],
    skillFamily: "Doorway Manners",
    level: 2,
  },
  {
    id: "BH017",
    title: "Doorway Wait While Door Opens Wider",
    orderIndex: 17,
    lessonGoal: "Teach the dog to remain behind the threshold while the visible interior door opens farther.",
    visibleCheckpoint: "The dog remains behind the registered threshold while the door visibly opens wider and crosses only after the audible release cue.",
    tutorialSteps: [
      "Use the same registered interior doorway.",
      "Start with the door partially closed.",
      "Keep the dog, threshold, and door motion visible.",
      "Slowly open the door wider.",
      "Give one release cue after the dog remains behind the threshold.",
      "Reward crossing only after release.",
    ],
    cameraAngle: "VISIBLE_TARGET_ZONE",
    setupInstructions: [
      "Threshold must be visible.",
      "Door movement must be visible.",
      "Dog and owner must be visible.",
      "Audio must capture the release cue.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: [
      "Dog matches DOG_PROFILE references.",
      "Doorway matches TARGET_DOORWAY.",
      "Door movement remains visible.",
      "Dog remains behind threshold while door opens.",
      "Release cue is audible.",
      "Dog crosses only after release.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog crosses before release cue.",
      "Dog crosses while door opens.",
      "Dog lunges through doorway.",
      "Owner physically restrains dog.",
    ],
    needsReviewCriteria: [
      "Door movement cropped.",
      "Threshold cropped.",
      "Dog hidden behind door.",
      "Audio unclear.",
      "Timing unclear.",
      "Doorway identity unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim exterior-door reliability.",
      "Do not imply safety near roads.",
      "Do not infer generalized impulse control.",
    ],
    safetyNotes: [
      "Use an interior doorway.",
      "Keep challenge low intensity.",
      "Do not practice near unsafe exits.",
    ],
    prerequisiteActivityId: "BH016",
    nextActivityId: "BH018",
    orderedVisibleActions: [
      "Dog starts behind the registered threshold.",
      "Interior door visibly opens wider.",
      "Dog remains behind the threshold during door movement.",
      "One audible release cue occurs.",
      "Dog crosses only after release.",
    ],
    skillFamily: "Doorway Manners",
    level: 2,
  },
  {
    id: "BH018",
    title: "Food-Bowl Wait: 1 Second",
    orderIndex: 18,
    lessonGoal: "Teach the dog to pause before accessing a registered food bowl.",
    visibleCheckpoint: "The dog remains away from the registered bowl for at least 1 second and approaches only after one audible release cue.",
    tutorialSteps: [
      "Register a clear photo of the food bowl.",
      "Place the bowl in the visible training area.",
      "Begin with the dog away from the bowl.",
      "Ask for a brief pause.",
      "Give one audible release cue.",
      "Allow bowl access only after release.",
    ],
    cameraAngle: "VISIBLE_OBJECT_AND_DESTINATION",
    setupInstructions: [
      "Bowl must be fully visible.",
      "Dog must be visible.",
      "Owner must be visible if bowl placement occurs in the clip.",
      "Audio must capture the release cue.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BOWL"],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "Dog matches DOG_PROFILE references.",
      "Visible bowl matches TARGET_BOWL.",
      "Dog remains away from bowl for at least 1 second.",
      "Release cue is audible.",
      "Dog approaches only after release.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog reaches bowl before release.",
      "Owner physically blocks or restrains dog.",
      "Visibly different bowl is used.",
    ],
    needsReviewCriteria: [
      "Bowl cropped.",
      "Bowl identity unclear.",
      "Dog path hidden.",
      "Cue inaudible.",
      "Timing unclear.",
      "Multiple dogs ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not infer reduced food guarding.",
      "Do not claim permanent meal manners.",
      "Do not infer emotional state.",
    ],
    safetyNotes: [
      "Avoid conflict around food.",
      "Stop if visible guarding behavior appears.",
    ],
    prerequisiteActivityId: "BH017",
    nextActivityId: "BH019",
    orderedVisibleActions: [
      "Dog starts away from the registered bowl.",
      "Dog remains away from the bowl for at least 1 second.",
      "One audible release cue occurs.",
      "Dog approaches only after release.",
    ],
    skillFamily: "Food-Bowl Manners",
    level: 2,
  },
  {
    id: "BH019",
    title: "Food-Bowl Wait: 3 Seconds",
    orderIndex: 19,
    lessonGoal: "Extend food-bowl wait duration to 3 seconds.",
    visibleCheckpoint: "The dog remains away from the registered food bowl continuously for at least 3 seconds and approaches only after one audible release cue.",
    tutorialSteps: [
      "Use the same registered food bowl.",
      "Keep the bowl and dog visible.",
      "Begin with the dog away from the bowl.",
      "Wait for a continuous 3-second pause.",
      "Give one audible release cue.",
      "Allow access only after release.",
    ],
    cameraAngle: "VISIBLE_OBJECT_AND_DESTINATION",
    setupInstructions: [
      "Bowl must be fully visible.",
      "Dog must be visible.",
      "Audio must capture the release cue.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BOWL"],
    audioRequired: true,
    fps: 2,
    minClipSeconds: 7,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE references.",
      "Visible bowl matches TARGET_BOWL.",
      "Dog remains away for at least 3 seconds.",
      "Release cue is audible.",
      "Dog approaches only after release.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog reaches bowl before required duration.",
      "Dog reaches bowl before release cue.",
      "Owner physically blocks or restrains dog.",
      "Visibly different bowl is used.",
    ],
    needsReviewCriteria: [
      "Bowl cropped.",
      "Bowl identity unclear.",
      "Dog path hidden.",
      "Cue inaudible.",
      "Duration unclear.",
      "Clip too short.",
    ],
    outOfScopeClaims: [
      "Do not infer reduced food guarding.",
      "Do not claim permanent meal manners.",
      "Do not infer emotional state.",
    ],
    safetyNotes: [
      "Avoid conflict around food.",
      "Stop if visible guarding behavior appears.",
    ],
    prerequisiteActivityId: "BH018",
    nextActivityId: "BH020",
    orderedVisibleActions: [
      "Dog starts away from the registered bowl.",
      "Dog remains away from the bowl continuously for at least 3 seconds.",
      "One audible release cue occurs.",
      "Dog approaches only after release.",
    ],
    skillFamily: "Food-Bowl Manners",
    level: 2,
  },
  {
    id: "BH020",
    title: "Food-Bowl Wait: 5 Seconds",
    orderIndex: 20,
    lessonGoal: "Extend food-bowl wait duration to 5 seconds.",
    visibleCheckpoint: "The dog remains away from the registered food bowl continuously for at least 5 seconds and approaches only after one audible release cue.",
    tutorialSteps: [
      "Use the registered food bowl.",
      "Keep the bowl and dog visible.",
      "Begin with the dog away from the bowl.",
      "Wait for a continuous 5-second pause.",
      "Give one audible release cue.",
      "Allow access only after release.",
    ],
    cameraAngle: "VISIBLE_OBJECT_AND_DESTINATION",
    setupInstructions: [
      "Bowl must be fully visible.",
      "Dog must be visible.",
      "Audio must capture the release cue.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BOWL"],
    audioRequired: true,
    fps: 2,
    minClipSeconds: 9,
    maxClipSeconds: 18,
    passCriteria: [
      "Dog matches DOG_PROFILE references.",
      "Bowl matches TARGET_BOWL.",
      "Dog waits at least 5 seconds.",
      "Release cue is audible.",
      "Dog approaches only after release.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog reaches bowl before required duration.",
      "Dog reaches bowl before release.",
      "Owner physically blocks or restrains dog.",
      "Visibly different bowl is used.",
    ],
    needsReviewCriteria: [
      "Bowl cropped.",
      "Bowl identity unclear.",
      "Dog path hidden.",
      "Release cue inaudible.",
      "Duration unclear.",
      "Clip too short.",
    ],
    outOfScopeClaims: [
      "Do not infer reduced food guarding.",
      "Do not claim long-term meal manners.",
      "Do not infer emotional state.",
    ],
    safetyNotes: [
      "Avoid conflict around food.",
      "Stop if visible guarding behavior appears.",
    ],
    prerequisiteActivityId: "BH019",
    nextActivityId: "BH021",
    orderedVisibleActions: [
      "Dog starts away from the registered bowl.",
      "Dog remains away from the bowl continuously for at least 5 seconds.",
      "One audible release cue occurs.",
      "Dog approaches only after release.",
    ],
    skillFamily: "Food-Bowl Manners",
    level: 2,
  },
];

export const BH011_BH020: BatchActivity[] = SPECS.map(makeActivity);
