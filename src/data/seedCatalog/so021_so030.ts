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
- Paws required: NO
- Hips required: ${spec.id === "SO024" ? "YES" : "NO"}
- Owner or handler in frame required: ${spec.ownerRequiredInFrame ? "YES" : "NO"}
- Target object in frame required: NO
- Destination in frame required: NO
${list(spec.setupInstructions)}

REQUIRED REFERENCES
- DOG_PROFILE

AUDIO RULE
Audio is required. If the recall cue, whistle pattern, release cue, or timing audio is missing or unusable, return NEEDS_REVIEW.

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
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, required audio, relevant action visible from start to finish, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: spec.fullDogBodyRequired,
    pawsRequired: false,
    hipsRequired: spec.id === "SO024",
    ownerRequiredInFrame: spec.ownerRequiredInFrame,
    audioRequired: true,
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
    whyItMatters: "This activity builds one observable recall behavior without claiming reliability outside the submitted clip.",
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
    xpReward: spec.orderIndex >= 27 ? 120 : spec.orderIndex >= 23 ? 110 : 105,
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
    audioRequired: true,
    fps: spec.fps,
    prerequisiteActivityId,
    nextActivityId: spec.nextActivityId,
    orderedVisibleActions: spec.orderedVisibleActions,
  };
};

const sharedRecallOutOfScope = [
  "Do not claim one successful clip proves reliable recall.",
  "Do not claim outdoor or off-leash reliability outside the submitted setup.",
];

const sharedRecallSafety = [
  "Use a safe enclosed area or visibly attached long line when specified.",
  "Never encourage off-leash testing near traffic.",
  "Keep recall path clear and safe.",
];

const SPECS: ActivitySpec[] = [
  {
    id: "SO021",
    title: "Recall: 15 Feet on Long Line",
    orderIndex: 21,
    lessonGoal: "Teach the dog to recall approximately 15 feet while a long line is visibly attached.",
    visibleCheckpoint: "Audible recall cue, dog reorients, travels toward owner, and arrives, with visible long line attached.",
    tutorialSteps: [
      "Use a safe enclosed area with a visibly attached long line.",
      "Position the camera so dog start point, path, owner, and long line are visible.",
      "Begin recording before the recall cue.",
      "Give one audible recall cue.",
      "Reward after the dog reaches the owner area.",
    ],
    cameraAngle: "WIDE_RECALL_LONG_LINE",
    setupInstructions: [
      "Dog start point, path, owner, and long line must be visible.",
      "Long line must be attached and visible.",
      "Audio is required.",
      "Start distance should be approximately 15 feet.",
    ],
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 22,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Long line is visible.",
      "Recall cue is audible.",
      "Dog reorients after cue.",
      "Dog reaches owner area.",
    ],
    failCriteria: [
      "No recall occurs.",
      "Dog travels away.",
      "Movement occurs only before cue.",
    ],
    needsReviewCriteria: [
      "Line hidden.",
      "Audio unclear.",
      "Path cropped.",
      "Distance unclear.",
      "Owner cropped.",
    ],
    outOfScopeClaims: sharedRecallOutOfScope,
    safetyNotes: sharedRecallSafety,
    prerequisiteActivityIds: ["SO020"],
    nextActivityId: "SO022",
    orderedVisibleActions: [
      "Target dog, owner, start point, path, and attached long line are visible before the cue.",
      "One recall cue is audible.",
      "Dog reorients toward owner after the cue.",
      "Dog travels toward owner on the visible long line.",
      "Dog arrives at the owner area.",
    ],
    skillFamily: "Long-Line Recall",
    level: 3,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO022",
    title: "Recall: 20 Feet on Long Line",
    orderIndex: 22,
    lessonGoal: "Extend long-line recall to approximately 20 feet with the long line visible.",
    visibleCheckpoint: "Audible recall cue, dog reorients, travels approximately 20 feet toward owner, and arrives with visible long line attached.",
    tutorialSteps: [
      "Use a safe enclosed area with the long line visibly attached.",
      "Position the camera so the long line, dog, path, and owner are visible.",
      "Begin recording before the recall cue.",
      "Give one audible recall cue.",
      "Reward after the dog reaches the owner after the cue.",
    ],
    cameraAngle: "WIDE_RECALL_LONG_LINE",
    setupInstructions: [
      "Visible long line is required.",
      "Dog start point, path, and owner must be visible.",
      "Audio is required.",
      "Start distance should be approximately 20 feet.",
    ],
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 25,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Long line is visible.",
      "Recall cue is audible.",
      "Dog reaches owner after cue.",
    ],
    failCriteria: [
      "No arrival occurs.",
      "Dog travels in the wrong direction.",
      "Motion occurs only before cue.",
    ],
    needsReviewCriteria: [
      "Distance unclear.",
      "Line hidden.",
      "Owner cropped.",
      "Path hidden.",
      "Audio unclear.",
    ],
    outOfScopeClaims: sharedRecallOutOfScope,
    safetyNotes: sharedRecallSafety,
    prerequisiteActivityIds: ["SO021"],
    nextActivityId: "SO023",
    orderedVisibleActions: [
      "Target dog, visible long line, owner, and recall path are visible before the cue.",
      "One recall cue is audible.",
      "Dog reorients or begins toward owner after the cue.",
      "Dog travels approximately 20 feet toward owner.",
      "Dog arrives at the owner area after the cue.",
    ],
    skillFamily: "Long-Line Recall",
    level: 3,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO023",
    title: "Recall + Collar Touch",
    orderIndex: 23,
    lessonGoal: "Teach the dog to arrive after recall and accept a gentle visible collar touch without pulling or dragging.",
    visibleCheckpoint: "Audible recall, dog arrives, and owner gently touches visible collar.",
    tutorialSteps: [
      "Use a wide-to-medium view with travel path and collar-touch area visible.",
      "Begin recording before the recall cue.",
      "Give one audible recall cue.",
      "After the dog arrives, gently touch the visible collar.",
      "Reward without pulling or dragging the dog.",
    ],
    cameraAngle: "WIDE_TO_MEDIUM_RECALL_OWNER_AREA",
    setupInstructions: [
      "Travel path and collar-touch area must be visible.",
      "Audio is required.",
      "Collar area must be visible for the touch.",
      "No grabbing, pulling, or dragging may occur.",
    ],
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Recall sequence passes.",
      "Dog arrives.",
      "Gentle collar touch is visible.",
      "No pulling or forced restraint occurs.",
    ],
    failCriteria: [
      "Dog does not arrive.",
      "Collar touch does not occur.",
      "Owner visibly grabs or drags dog.",
    ],
    needsReviewCriteria: [
      "Collar area hidden.",
      "Path hidden.",
      "Audio unclear.",
      "Arrival obscured.",
    ],
    outOfScopeClaims: [
      "Do not infer handling comfort.",
      ...sharedRecallOutOfScope,
    ],
    safetyNotes: [
      "Touch gently and briefly.",
      "Do not pull or restrain the dog by the collar.",
      "Use a safe recall path.",
    ],
    prerequisiteActivityIds: ["SO022"],
    nextActivityId: "SO024",
    orderedVisibleActions: [
      "Target dog, owner, travel path, and collar-touch area are visible before the cue.",
      "One recall cue is audible.",
      "Dog travels to and arrives at the owner area.",
      "Owner gently touches the visible collar.",
      "No grabbing, pulling, or dragging occurs.",
    ],
    skillFamily: "Recall Finish",
    level: 3,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO024",
    title: "Recall + Brief Sit",
    orderIndex: 24,
    lessonGoal: "Teach the dog to arrive after recall and briefly sit in the owner area.",
    visibleCheckpoint: "Audible recall, dog reaches owner, and dog visibly sits briefly.",
    tutorialSteps: [
      "Use a wide view with dog path, owner area, and hips visible.",
      "Begin recording before the recall cue.",
      "Give one audible recall cue.",
      "After arrival, cue or lure a brief sit without forcing.",
      "Reward after hips visibly contact the floor.",
    ],
    cameraAngle: "WIDE_RECALL_OWNER_AREA",
    setupInstructions: [
      "Dog path, owner area, and hips must be visible.",
      "Audio is required.",
      "Arrival and sit timing must be visible.",
      "No physical forcing may create the sit.",
    ],
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Recall sequence passes.",
      "Dog arrives.",
      "Hips visibly contact floor.",
      "Sit posture is visible briefly.",
    ],
    failCriteria: [
      "Dog does not arrive.",
      "Dog does not sit.",
      "Owner forces sit.",
    ],
    needsReviewCriteria: [
      "Hips hidden.",
      "Audio unclear.",
      "Arrival hidden.",
      "Sit timing unclear.",
    ],
    outOfScopeClaims: sharedRecallOutOfScope,
    safetyNotes: [
      "Use a safe recall path.",
      "Do not push the dog into a sit.",
      "Keep the sit brief.",
    ],
    prerequisiteActivityIds: ["SO023"],
    nextActivityId: "SO025",
    orderedVisibleActions: [
      "Target dog, owner area, travel path, and hips are visible before the cue.",
      "One recall cue is audible.",
      "Dog travels to and arrives at the owner area.",
      "Dog's hips visibly contact the floor.",
      "Brief sit posture is visible without forcing.",
    ],
    skillFamily: "Recall Finish",
    level: 3,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO025",
    title: "Recall + Release Back to Exploration",
    orderIndex: 25,
    lessonGoal: "Teach the dog that recall can be followed by an audible release back to visible exploration.",
    visibleCheckpoint: "Audible recall, arrival, audible release cue, and dog visibly leaves owner area toward exploration area.",
    tutorialSteps: [
      "Use a wide view with owner, dog, and exploration direction visible.",
      "Begin recording before the recall cue.",
      "Give one audible recall cue.",
      "After arrival, give one audible release cue.",
      "Reward or allow the dog to leave owner area only after release.",
    ],
    cameraAngle: "WIDE_RECALL_RELEASE_AREA",
    setupInstructions: [
      "Owner, dog, and exploration direction must be visible.",
      "Recall cue and release cue must be audible.",
      "Route away from owner area must be visible.",
      "Dog must not leave before the release cue.",
    ],
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 22,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Recall cue is audible.",
      "Dog arrives.",
      "Release cue is audible.",
      "Dog leaves owner area only after release.",
    ],
    failCriteria: [
      "Dog does not recall.",
      "Dog leaves before release.",
      "No release event is visible.",
    ],
    needsReviewCriteria: [
      "Audio unclear.",
      "Route hidden.",
      "Release timing unclear.",
      "Arrival obscured.",
    ],
    outOfScopeClaims: sharedRecallOutOfScope,
    safetyNotes: [
      "Use a safe enclosed area or long line.",
      "Never release near traffic.",
      "Keep the exploration direction safe and visible.",
    ],
    prerequisiteActivityIds: ["SO024", "SO015"],
    nextActivityId: "SO026",
    orderedVisibleActions: [
      "Target dog, owner, and exploration direction are visible before recall.",
      "One recall cue is audible.",
      "Dog arrives at the owner area.",
      "One release cue is audible.",
      "Dog leaves owner area toward exploration only after the release cue.",
    ],
    skillFamily: "Recall Finish",
    level: 3,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO026",
    title: "Whistle Jackpot Conditioning",
    orderIndex: 26,
    lessonGoal: "Teach the owner to pair one audible whistle pattern with prompt high-value reward delivery.",
    visibleCheckpoint: "One audible whistle pattern is followed promptly by visible high-value reward delivery.",
    tutorialSteps: [
      "Prepare a high-value safe reward.",
      "Position the camera so dog and reward hand are visible.",
      "Begin recording before the whistle pattern.",
      "Give one audible whistle pattern.",
      "Promptly deliver the reward to the target dog without requiring travel.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Dog and reward hand must be visible.",
      "Audio is required.",
      "Begin recording before the whistle.",
      "Travel or recall is not required for this conditioning activity.",
    ],
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Whistle is clearly audible.",
      "Reward is visibly delivered promptly after whistle.",
      "Reward is delivered to target dog.",
    ],
    failCriteria: [
      "Reward occurs before whistle.",
      "No reward follows whistle.",
      "Reward is delivered to a different dog.",
    ],
    needsReviewCriteria: [
      "Whistle unclear.",
      "Reward hand cropped.",
      "Timing unclear.",
      "Dog identity unclear.",
      "Multiple dogs make identity ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not claim whistle recall has been learned.",
      "Do not infer long-term whistle conditioning.",
    ],
    safetyNotes: [
      "Use a safe high-value reward.",
      "Avoid overfeeding.",
    ],
    prerequisiteActivityIds: ["SO001"],
    nextActivityId: "SO027",
    orderedVisibleActions: [
      "Target dog and reward hand are visible before the whistle pattern.",
      "One whistle pattern is audible.",
      "Reward delivery begins promptly after the whistle.",
      "Reward is visibly delivered to the target dog without requiring travel.",
    ],
    skillFamily: "Whistle Recall",
    level: 3,
    fullDogBodyRequired: false,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO027",
    title: "Whistle Recall: 6 Feet",
    orderIndex: 27,
    lessonGoal: "Teach the dog to recall approximately 6 feet after an audible whistle.",
    visibleCheckpoint: "Audible whistle, dog reorients, travels toward owner, and arrives.",
    tutorialSteps: [
      "Use a wide view with owner, dog, and route visible.",
      "Begin recording before the whistle.",
      "Give one audible whistle pattern.",
      "Let the dog reorient and travel to owner.",
      "Reward after arrival.",
    ],
    cameraAngle: "WIDE_RECALL_ROUTE",
    setupInstructions: [
      "Owner, dog, and route must be visible.",
      "Audio is required.",
      "Start distance should be approximately 6 feet.",
      "Movement must begin after the whistle.",
    ],
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Whistle is audible.",
      "Post-whistle orientation is visible.",
      "Dog travels toward owner after the whistle.",
      "Dog reaches owner.",
    ],
    failCriteria: [
      "No recall occurs.",
      "Dog travels away.",
      "Movement occurs only before whistle.",
    ],
    needsReviewCriteria: [
      "Whistle unclear.",
      "Route hidden.",
      "Owner cropped.",
      "Distance unclear.",
    ],
    outOfScopeClaims: sharedRecallOutOfScope,
    safetyNotes: sharedRecallSafety,
    prerequisiteActivityIds: ["SO026"],
    nextActivityId: "SO028",
    orderedVisibleActions: [
      "Target dog, owner, and route are visible before the whistle.",
      "One whistle pattern is audible.",
      "Dog reorients toward owner after the whistle.",
      "Dog travels approximately 6 feet toward owner.",
      "Dog reaches the owner area.",
    ],
    skillFamily: "Whistle Recall",
    level: 3,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO028",
    title: "Whistle Recall: 10 Feet",
    orderIndex: 28,
    lessonGoal: "Teach the dog to recall approximately 10 feet after an audible whistle.",
    visibleCheckpoint: "Audible whistle, dog reorients, travels approximately 10 feet toward owner, and arrives.",
    tutorialSteps: [
      "Use a wide view with owner, dog, and route visible.",
      "Begin recording before the whistle.",
      "Set the dog approximately 10 feet away.",
      "Give one audible whistle pattern.",
      "Reward after the dog reaches the owner area.",
    ],
    cameraAngle: "WIDE_RECALL_ROUTE",
    setupInstructions: [
      "Owner, dog, and route must be visible.",
      "Audio is required.",
      "Start distance should be approximately 10 feet.",
      "Dog motion toward owner must begin after the whistle.",
    ],
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 18,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Whistle is audible.",
      "Post-whistle orientation is visible.",
      "Dog travels toward owner after the whistle.",
      "Dog reaches owner area.",
    ],
    failCriteria: [
      "No recall occurs.",
      "Dog travels away.",
      "Movement occurs only before whistle.",
    ],
    needsReviewCriteria: [
      "Whistle unclear.",
      "Route hidden.",
      "Owner cropped.",
      "Distance unclear.",
      "Clip begins after movement.",
    ],
    outOfScopeClaims: sharedRecallOutOfScope,
    safetyNotes: sharedRecallSafety,
    prerequisiteActivityIds: ["SO027"],
    nextActivityId: "SO029",
    orderedVisibleActions: [
      "Target dog, owner, and approximately 10-foot route are visible before the whistle.",
      "One whistle pattern is audible.",
      "Dog reorients toward owner after the whistle.",
      "Dog travels toward owner only after the whistle.",
      "Dog reaches the owner area.",
    ],
    skillFamily: "Whistle Recall",
    level: 3,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO029",
    title: "Whistle Recall: 15 Feet",
    orderIndex: 29,
    lessonGoal: "Teach the dog to recall approximately 15 feet after an audible whistle in a safe enclosed area.",
    visibleCheckpoint: "Audible whistle, dog reorients, travels approximately 15 feet toward owner, and arrives in a safe enclosed area.",
    tutorialSteps: [
      "Use a safe enclosed area.",
      "Position the camera so owner, dog, and route are visible.",
      "Begin recording before the whistle.",
      "Give one audible whistle pattern.",
      "Reward after the dog reaches the owner area.",
    ],
    cameraAngle: "WIDE_SAFE_RECALL_AREA",
    setupInstructions: [
      "Safe enclosed area must be visible or clearly represented by the setup.",
      "Owner, dog, and route must be visible.",
      "Audio is required.",
      "Start distance should be approximately 15 feet.",
      "Dog motion toward owner must begin after the whistle.",
    ],
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 22,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Whistle is audible.",
      "Post-whistle orientation is visible.",
      "Dog travels toward owner after the whistle.",
      "Dog reaches owner area.",
    ],
    failCriteria: [
      "No recall occurs.",
      "Dog travels away.",
      "Movement occurs only before whistle.",
    ],
    needsReviewCriteria: [
      "Whistle unclear.",
      "Route hidden.",
      "Owner cropped.",
      "Distance unclear.",
      "Safe setup unclear.",
    ],
    outOfScopeClaims: sharedRecallOutOfScope,
    safetyNotes: sharedRecallSafety,
    prerequisiteActivityIds: ["SO028"],
    nextActivityId: "SO030",
    orderedVisibleActions: [
      "Target dog, owner, and approximately 15-foot route are visible in a safe enclosed setup before the whistle.",
      "One whistle pattern is audible.",
      "Dog reorients toward owner after the whistle.",
      "Dog travels toward owner only after the whistle.",
      "Dog reaches the owner area.",
    ],
    skillFamily: "Whistle Recall",
    level: 3,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO030",
    title: "Whistle Recall: 20 Feet",
    orderIndex: 30,
    lessonGoal: "Teach the dog to recall approximately 20 feet after an audible whistle in a safe setup.",
    visibleCheckpoint: "Audible whistle, dog reorients, travels approximately 20 feet toward owner, and arrives in a safe enclosed area or on long line.",
    tutorialSteps: [
      "Use a safe enclosed area or visibly attached long line.",
      "Position the camera so owner, dog, and route are visible.",
      "Begin recording before the whistle.",
      "Give one audible whistle pattern.",
      "Reward after the dog reaches the owner area.",
    ],
    cameraAngle: "WIDE_SAFE_RECALL_AREA",
    setupInstructions: [
      "Safe enclosed area or long line must be visible.",
      "Owner, dog, and route must be visible.",
      "Audio is required.",
      "Start distance should be approximately 20 feet.",
      "Dog motion toward owner must begin after the whistle.",
    ],
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 25,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Whistle is audible.",
      "Post-whistle orientation is visible.",
      "Dog travels toward owner after the whistle.",
      "Dog reaches owner area.",
    ],
    failCriteria: [
      "No recall occurs.",
      "Dog travels to the wrong destination.",
      "Movement occurs only before whistle.",
    ],
    needsReviewCriteria: [
      "Distance unclear.",
      "Whistle unclear.",
      "Route hidden.",
      "Safe setup or long line unclear.",
      "Clip too short.",
    ],
    outOfScopeClaims: sharedRecallOutOfScope,
    safetyNotes: sharedRecallSafety,
    prerequisiteActivityIds: ["SO029"],
    nextActivityId: "SO031",
    orderedVisibleActions: [
      "Target dog, owner, and approximately 20-foot route are visible in a safe enclosed setup or on a visible long line before the whistle.",
      "One whistle pattern is audible.",
      "Dog reorients toward owner after the whistle.",
      "Dog travels toward owner only after the whistle.",
      "Dog reaches the owner area.",
    ],
    skillFamily: "Whistle Recall",
    level: 3,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
  },
];

export const SO021_SO030: BatchActivity[] = SPECS.map(makeActivity);
