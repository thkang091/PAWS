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
- Target object in frame required: NO
- Destination in frame required: NO
${list(spec.setupInstructions)}

REQUIRED REFERENCES
- DOG_PROFILE

AUDIO RULE
${spec.audioRequired ? "Audio is required. If the release cue, recall cue, or required timing audio is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is being judged. Do not fail solely because audio is absent; return NEEDS_REVIEW only if timing cannot be judged without audio."}

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
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, required audio when applicable, relevant action visible from start to finish, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, or semantic accuracy.`;

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: spec.fullDogBodyRequired,
    pawsRequired: spec.pawsRequired,
    hipsRequired: spec.hipsRequired,
    ownerRequiredInFrame: spec.ownerRequiredInFrame,
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: false,
    destinationRequiredInFrame: false,
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
    requiredReferenceAssets: ["DOG_PROFILE"],
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
    xpReward: spec.orderIndex >= 18 ? 100 : spec.orderIndex >= 15 ? 90 : 85,
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
    id: "SO011",
    title: "Stand Hold: 3 Seconds",
    orderIndex: 11,
    lessonGoal: "Teach the dog to remain in a visible stable four-paw standing posture for at least 3 seconds.",
    visibleCheckpoint: "Dog remains in a visible stable four-paw standing posture for at least 3 seconds.",
    tutorialSteps: [
      "Use a side full-body view.",
      "Keep all paws visible.",
      "Begin recording before the stand hold starts.",
      "Start timing when all four paws support the body.",
      "Reward after a continuous 3-second stand hold.",
    ],
    cameraAngle: "SIDE_FULL_BODY",
    setupInstructions: [
      "Side full-body view is required.",
      "All paws must remain visible.",
      "Clip must be long enough to score a 3-second stand hold.",
      "No physical restraint may hold the dog in position.",
    ],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 6,
    maxClipSeconds: 12,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Dog starts or reaches standing posture.",
      "All four paws support body visibly.",
      "Stand remains continuous for at least 3 seconds.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog sits or lies down before 3 seconds.",
      "Owner physically holds dog in position.",
    ],
    needsReviewCriteria: [
      "Paws cropped.",
      "Duration unclear.",
      "Dog hidden.",
      "Clip too short.",
    ],
    outOfScopeClaims: [
      "Do not infer physical fitness.",
      "Do not claim medical mobility.",
    ],
    safetyNotes: [
      "Use a non-slip surface.",
      "Keep the hold duration easy.",
    ],
    prerequisiteActivityIds: ["SO010"],
    nextActivityId: "SO012",
    orderedVisibleActions: [
      "Target dog is visible in side full-body view before the stand hold starts.",
      "Dog starts or reaches a four-paw standing posture.",
      "All four paws visibly support the body.",
      "Dog remains standing continuously for at least 3 seconds without physical restraint.",
    ],
    skillFamily: "Position Transitions",
    level: 2,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: false,
  },
  {
    id: "SO012",
    title: "Sit -> Down",
    orderIndex: 12,
    lessonGoal: "Teach the dog to transition visibly from a seated posture into a down posture.",
    visibleCheckpoint: "Dog begins seated and visibly transitions into down posture.",
    tutorialSteps: [
      "Use a side full-body view.",
      "Keep hips, elbows, torso, and paws visible.",
      "Begin with the dog seated.",
      "Cue or lure down without pushing.",
      "Reward after elbows contact the floor and torso lowers.",
    ],
    cameraAngle: "SIDE_FULL_BODY",
    setupInstructions: [
      "Hips, elbows, torso, and paws must be visible.",
      "Dog must start seated.",
      "Transition must begin after recording starts.",
      "No physical forcing may move the dog into position.",
    ],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Dog starts seated.",
      "Front body lowers.",
      "Elbows contact floor.",
      "Torso lowers into down.",
      "No physical forcing occurs.",
    ],
    failCriteria: [
      "Dog remains seated.",
      "Dog stands instead of moving down.",
      "Owner pushes dog into position.",
    ],
    needsReviewCriteria: [
      "Elbows hidden.",
      "Torso cropped.",
      "Transition begins before recording.",
      "Dog already down at clip start.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized obedience.",
      "Do not infer emotional calmness.",
    ],
    safetyNotes: [
      "Use a non-slip surface.",
      "Do not push the dog down.",
    ],
    prerequisiteActivityIds: ["SO007"],
    nextActivityId: "SO013",
    orderedVisibleActions: [
      "Target dog is visible from the side and starts seated.",
      "Dog lowers front body from the seated posture.",
      "Elbows contact the floor.",
      "Torso lowers into down without physical forcing.",
    ],
    skillFamily: "Position Transitions",
    level: 2,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: false,
  },
  {
    id: "SO013",
    title: "Down -> Stand",
    orderIndex: 13,
    lessonGoal: "Teach the dog to transition visibly from down into a stable four-paw stand.",
    visibleCheckpoint: "Dog begins in visible down posture and rises into stable four-paw stand.",
    tutorialSteps: [
      "Use a side full-body view.",
      "Keep elbows, torso, hips, and paws visible.",
      "Begin with the dog in down posture.",
      "Cue or lure the dog to stand without lifting.",
      "Reward after all four paws support a stable stand.",
    ],
    cameraAngle: "SIDE_FULL_BODY",
    setupInstructions: [
      "Elbows, torso, hips, and paws must be visible.",
      "Dog must start in down posture.",
      "Transition must be visible from the start.",
      "No lifting or physical moving may occur.",
    ],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Dog starts down.",
      "Dog rises visibly.",
      "All four paws support body.",
      "Stable standing posture is visible briefly.",
      "No forcing occurs.",
    ],
    failCriteria: [
      "Dog remains down.",
      "Dog moves only into sit.",
      "Owner lifts or physically moves dog.",
    ],
    needsReviewCriteria: [
      "Start posture hidden.",
      "Paws cropped.",
      "Transition unclear.",
      "Clip starts after movement begins.",
    ],
    outOfScopeClaims: [
      "Do not infer physical fitness.",
      "Do not claim generalized obedience.",
    ],
    safetyNotes: [
      "Use a non-slip surface.",
      "Stop if dog appears physically uncomfortable.",
    ],
    prerequisiteActivityIds: ["SO011", "SO012"],
    nextActivityId: "SO014",
    orderedVisibleActions: [
      "Target dog is visible from the side and starts in down posture.",
      "Dog rises visibly from down.",
      "All four paws support the body.",
      "Stable standing posture is visible briefly without forcing.",
    ],
    skillFamily: "Position Transitions",
    level: 2,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: false,
  },
  {
    id: "SO014",
    title: "Sit -> Down -> Stand",
    orderIndex: 14,
    lessonGoal: "Teach the dog to perform the ordered sit, down, stand position sequence.",
    visibleCheckpoint: "Dog visibly performs the ordered sequence: sit, down, stand.",
    tutorialSteps: [
      "Use a side full-body view.",
      "Keep hips, elbows, torso, and paws visible.",
      "Begin recording before the sequence starts.",
      "Cue or lure sit to down to stand in that order.",
      "Reward after the final stable stand.",
    ],
    cameraAngle: "SIDE_FULL_BODY",
    setupInstructions: [
      "Hips, elbows, torso, and paws must be visible.",
      "All three positions must be visible.",
      "Sequence must start after recording begins.",
      "No physical forcing may move the dog.",
    ],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "All three positions are visible.",
      "Order is correct.",
      "Each posture is visibly established.",
      "No physical forcing occurs.",
    ],
    failCriteria: [
      "Wrong order.",
      "One required position is missing.",
      "Owner physically moves dog.",
    ],
    needsReviewCriteria: [
      "Transition hidden.",
      "Body parts cropped.",
      "Sequence starts before recording.",
      "Timing unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized obedience.",
      "Do not infer intent.",
    ],
    safetyNotes: [
      "Use a non-slip surface.",
      "Keep the sequence short.",
    ],
    prerequisiteActivityIds: ["SO012", "SO013"],
    nextActivityId: "SO015",
    orderedVisibleActions: [
      "Target dog is visible from the side before the sequence starts.",
      "Dog is visibly established in sit.",
      "Dog transitions into down.",
      "Dog transitions from down into stand.",
      "The ordered sit to down to stand sequence completes without physical forcing.",
    ],
    skillFamily: "Position Transitions",
    level: 2,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: false,
  },
  {
    id: "SO015",
    title: "Release Cue",
    orderIndex: 15,
    lessonGoal: "Teach the dog to hold a configured position until one audible release cue.",
    visibleCheckpoint: "Dog remains in configured position before one audible release cue and moves only after cue.",
    tutorialSteps: [
      "Choose a configured start position the dog can hold.",
      "Position the camera so dog and owner remain visible.",
      "Begin recording before the release cue.",
      "Give one audible release cue.",
      "Reward after movement begins only after the cue.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Dog and owner must be visible.",
      "Audio is required.",
      "Begin recording before cue.",
      "No physical restraint may hold the dog in position.",
    ],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Dog holds start position.",
      "Release cue is audible.",
      "Movement begins only after cue.",
      "No restraint occurs.",
    ],
    failCriteria: [
      "Dog exits position before cue.",
      "Dog does not move after cue when clip is otherwise scorable.",
      "Owner physically moves dog.",
    ],
    needsReviewCriteria: [
      "Audio unclear.",
      "Dog cropped.",
      "Owner cropped.",
      "Timing unclear.",
      "Clip starts after cue.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized impulse control.",
      "Do not infer long-term release reliability.",
    ],
    safetyNotes: [
      "Use one clear release cue.",
      "Do not physically hold the dog.",
    ],
    prerequisiteActivityIds: ["SO005"],
    nextActivityId: "SO016",
    orderedVisibleActions: [
      "Target dog and owner are visible while dog holds a configured start position.",
      "Dog remains in position before the release cue.",
      "One release cue is audible.",
      "Dog begins moving only after the cue without physical restraint.",
    ],
    skillFamily: "Release and Targeting",
    level: 2,
    fullDogBodyRequired: true,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO016",
    title: "Hand Target",
    orderIndex: 16,
    lessonGoal: "Teach the dog to visibly touch the owner's open palm with nose.",
    visibleCheckpoint: "Dog visibly touches owner's open palm with nose.",
    tutorialSteps: [
      "Use a close view of dog nose and owner's open palm.",
      "Begin recording before the hand is presented.",
      "Present the open palm without pressing into the dog.",
      "Reward after nose-to-palm contact.",
      "Keep the repetition short.",
    ],
    cameraAngle: "CLOSE_DOG_NOSE_AND_HAND",
    setupInstructions: [
      "Dog nose and palm must be visible.",
      "Contact must be visible.",
      "No physical pushing may create the contact.",
      "Audio is optional.",
    ],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 4,
    maxClipSeconds: 10,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Palm is visible.",
      "Dog nose visibly contacts palm.",
      "No physical pushing occurs.",
    ],
    failCriteria: [
      "Dog does not contact palm.",
      "Owner presses hand into dog's nose.",
    ],
    needsReviewCriteria: [
      "Nose hidden.",
      "Palm cropped.",
      "Contact obscured.",
      "Dog identity unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized targeting reliability.",
      "Do not infer dog intent.",
    ],
    safetyNotes: [
      "Keep the hand still and open.",
      "Do not press into the dog's face.",
    ],
    prerequisiteActivityIds: ["SO002"],
    nextActivityId: "SO017",
    orderedVisibleActions: [
      "Target dog nose and owner's open palm are visible before contact.",
      "Owner presents an open palm.",
      "Dog moves nose toward palm.",
      "Dog nose visibly contacts palm without physical pushing.",
    ],
    skillFamily: "Release and Targeting",
    level: 2,
    fullDogBodyRequired: false,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO017",
    title: "Hand Target with Both Hands",
    orderIndex: 17,
    lessonGoal: "Teach the dog to nose-target left palm and right palm in the configured order.",
    visibleCheckpoint: "Dog visibly nose-targets left palm and right palm in the configured order.",
    tutorialSteps: [
      "Use a close or medium view.",
      "Keep both hands and dog nose visible.",
      "Begin recording before the first hand target.",
      "Present the first palm, then the second palm in the configured order.",
      "Reward after both contacts occur without pushing.",
    ],
    cameraAngle: "CLOSE_DOG_NOSE_AND_HANDS",
    setupInstructions: [
      "Both hands and dog nose must be visible.",
      "Order of palm presentation and contact must be visible.",
      "No physical pushing may create contact.",
      "Audio is optional.",
    ],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "First palm contact is visible.",
      "Second palm contact is visible.",
      "Configured order is followed.",
      "No physical pushing occurs.",
    ],
    failCriteria: [
      "Only one hand is contacted.",
      "Wrong order when order is required.",
      "Owner presses hands into dog's nose.",
    ],
    needsReviewCriteria: [
      "One hand cropped.",
      "Dog nose hidden.",
      "Order unclear.",
      "Contact obscured.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized targeting reliability.",
      "Do not infer dog intent.",
    ],
    safetyNotes: [
      "Keep hands gentle and still.",
      "Do not press hands into the dog's face.",
    ],
    prerequisiteActivityIds: ["SO016"],
    nextActivityId: "SO018",
    orderedVisibleActions: [
      "Target dog nose and both owner palms are visible before the first target.",
      "Dog nose visibly contacts the first configured palm.",
      "Dog nose visibly contacts the second configured palm.",
      "Contacts occur in configured order without physical pushing.",
    ],
    skillFamily: "Release and Targeting",
    level: 2,
    fullDogBodyRequired: false,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO018",
    title: "Recall: 6 Feet Indoors",
    orderIndex: 18,
    lessonGoal: "Teach the dog to reorient and travel approximately 6 feet to the owner after one audible recall cue indoors.",
    visibleCheckpoint: "After one audible recall cue, dog visibly turns toward owner, travels approximately 6 feet, and reaches owner area.",
    tutorialSteps: [
      "Use a wide indoor room view.",
      "Keep dog start position, travel path, and owner visible.",
      "Begin recording before the recall cue.",
      "Give one audible recall cue.",
      "Reward after the dog reaches the owner area.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Dog start position, travel path, and owner must be visible.",
      "Audio is required.",
      "Start distance should be approximately 6 feet.",
      "Begin recording before cue.",
    ],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Recall cue is audible.",
      "Dog is not already traveling toward owner before cue.",
      "Dog visibly reorients after cue.",
      "Dog travels toward owner.",
      "Dog reaches visible owner area.",
    ],
    failCriteria: [
      "Dog remains stationary.",
      "Dog travels away.",
      "Dog approaches another person.",
      "Movement occurs only before cue.",
    ],
    needsReviewCriteria: [
      "Audio unclear.",
      "Path hidden.",
      "Owner cropped.",
      "Start distance unclear.",
      "Clip begins after movement.",
    ],
    outOfScopeClaims: [
      "Do not claim reliable recall outside the clip.",
      "Do not claim outdoor recall reliability.",
    ],
    safetyNotes: [
      "Use a safe indoor path.",
      "Do not call the dog through hazards.",
    ],
    prerequisiteActivityIds: ["SO002"],
    nextActivityId: "SO019",
    orderedVisibleActions: [
      "Target dog, owner, start position, and travel path are visible before the recall cue.",
      "One recall cue is audible.",
      "Dog reorients toward owner after the cue.",
      "Dog travels approximately 6 feet toward owner.",
      "Dog reaches the visible owner area.",
    ],
    skillFamily: "Recall Foundations",
    level: 2,
    fullDogBodyRequired: true,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO019",
    title: "Recall: 10 Feet Indoors",
    orderIndex: 19,
    lessonGoal: "Extend indoor recall to approximately 10 feet after one audible recall cue.",
    visibleCheckpoint: "After one audible recall cue, dog visibly orients toward owner, travels approximately 10 feet, and reaches owner area.",
    tutorialSteps: [
      "Use a wide indoor room view.",
      "Keep dog start position, travel path, and owner visible.",
      "Begin recording before the recall cue.",
      "Give one audible recall cue.",
      "Reward after arrival at the owner area.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Dog start position, travel path, and owner must be visible.",
      "Audio is required.",
      "Start distance should be approximately 10 feet.",
      "Begin recording before cue.",
    ],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 18,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Recall cue is audible.",
      "Post-cue orientation is visible.",
      "Dog travels toward owner.",
      "Dog arrives at owner area.",
    ],
    failCriteria: [
      "No arrival occurs.",
      "Dog travels away.",
      "Movement occurs only before cue.",
    ],
    needsReviewCriteria: [
      "Start distance unclear.",
      "Audio missing.",
      "Travel path cropped.",
      "Owner cropped.",
      "Clip begins after movement.",
    ],
    outOfScopeClaims: [
      "Do not claim reliable recall outside the clip.",
      "Do not claim outdoor recall reliability.",
    ],
    safetyNotes: [
      "Use a safe indoor path.",
      "Keep the distance manageable.",
    ],
    prerequisiteActivityIds: ["SO018"],
    nextActivityId: "SO020",
    orderedVisibleActions: [
      "Target dog, owner, start position, and travel path are visible before the recall cue.",
      "One recall cue is audible.",
      "Dog visibly orients toward owner after the cue.",
      "Dog travels approximately 10 feet toward owner.",
      "Dog arrives at the owner area.",
    ],
    skillFamily: "Recall Foundations",
    level: 2,
    fullDogBodyRequired: true,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO020",
    title: "Recall: 15 Feet Indoors",
    orderIndex: 20,
    lessonGoal: "Extend indoor recall to approximately 15 feet after one audible recall cue.",
    visibleCheckpoint: "After one audible recall cue, dog visibly orients toward owner, travels approximately 15 feet indoors, and reaches owner area.",
    tutorialSteps: [
      "Use a wide indoor room view.",
      "Keep the route, dog, and owner visible.",
      "Begin recording before the recall cue.",
      "Give one audible recall cue.",
      "Reward after arrival at the owner area.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Route, dog, and owner must be visible.",
      "Audio is required.",
      "Start distance should be approximately 15 feet indoors.",
      "Begin recording before cue.",
    ],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Recall cue is audible.",
      "Post-cue orientation is visible.",
      "Visible travel occurs.",
      "Dog arrives at owner area.",
    ],
    failCriteria: [
      "No recall occurs.",
      "Dog travels to the wrong destination.",
      "Movement occurs only before cue.",
    ],
    needsReviewCriteria: [
      "Distance unclear.",
      "Audio unclear.",
      "Route hidden.",
      "Clip too short.",
      "Clip begins after movement.",
    ],
    outOfScopeClaims: [
      "Do not claim reliable recall outside the clip.",
      "Do not claim outdoor recall reliability.",
    ],
    safetyNotes: [
      "Use a safe indoor route.",
      "Avoid slippery floors or obstacles.",
    ],
    prerequisiteActivityIds: ["SO019"],
    nextActivityId: "SO021",
    orderedVisibleActions: [
      "Target dog, owner, and indoor route are visible before the recall cue.",
      "One recall cue is audible.",
      "Dog visibly orients toward owner after the cue.",
      "Dog travels approximately 15 feet indoors.",
      "Dog arrives at the visible owner area.",
    ],
    skillFamily: "Recall Foundations",
    level: 2,
    fullDogBodyRequired: true,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
  },
];

export const SO011_SO020: BatchActivity[] = SPECS.map(makeActivity);
