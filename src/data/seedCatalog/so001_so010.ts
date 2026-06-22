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
  prerequisiteActivityId: string | null;
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
${spec.prerequisiteActivityId ? `Prerequisite activity ${spec.prerequisiteActivityId} has been passed. ` : ""}${spec.orderedVisibleActions[0]}

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

REQUIRED DOG_PROFILE REFERENCES
- DOG_PROFILE

AUDIO RULE
${spec.audioRequired ? "Audio is required. If the marker, name cue, or required timing audio is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is being judged. Do not fail solely because audio is absent; return NEEDS_REVIEW only if timing cannot be judged without audio."}

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
    prerequisites: spec.prerequisiteActivityId ? [spec.prerequisiteActivityId] : [],
    regressionActivityId: spec.prerequisiteActivityId,
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
    xpReward: spec.orderIndex >= 8 ? 80 : spec.orderIndex >= 4 ? 70 : 60,
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
    id: "SO001",
    title: "Marker + Reward Delivery",
    orderIndex: 1,
    lessonGoal: "Teach the owner to deliver a visible reward promptly after one consistent audible marker word or click.",
    visibleCheckpoint: "One audible marker word or click occurs, followed promptly by visible reward delivery to the target dog.",
    tutorialSteps: [
      "Prepare small safe rewards.",
      "Position the phone so the dog and reward-delivery hand remain visible.",
      "Start recording before the marker sound.",
      "Say the marker word once or use one click.",
      "Deliver a reward promptly after the marker.",
      "End the short repetition.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Dog must be visible.",
      "Owner reward hand must be visible.",
      "Audio is required.",
      "Begin recording before marker.",
    ],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "DOG_PROFILE identity matches visible dog.",
      "One audible marker word or click is detectable.",
      "Reward delivery begins promptly after marker.",
      "Reward is visibly delivered to target dog.",
      "No visible reward is delivered before marker.",
      "Marker-to-reward sequence is fully visible.",
    ],
    failCriteria: [
      "Clip is clear and scorable but reward occurs before marker.",
      "Marker occurs but no reward follows.",
      "Reward is delivered to another dog.",
      "Reward delivery is visibly delayed beyond the configured acceptable interval.",
    ],
    needsReviewCriteria: [
      "Audio missing or unclear.",
      "Marker timing unclear.",
      "Reward hand cropped.",
      "Reward delivery hidden.",
      "Target dog identity unclear.",
      "Clip begins after marker.",
      "Multiple dogs make identity ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not claim marker conditioning has been learned.",
      "Do not infer owner intent.",
      "Do not infer long-term training quality.",
    ],
    safetyNotes: [
      "Use a safe small reward.",
      "Avoid repeated overfeeding.",
    ],
    prerequisiteActivityId: null,
    nextActivityId: "SO002",
    orderedVisibleActions: [
      "Target dog and owner reward hand are visible before the marker.",
      "One marker word or click is audible.",
      "Reward delivery begins promptly after the marker.",
      "Reward is visibly delivered to the target dog.",
    ],
    skillFamily: "Marker and Attention Foundations",
    level: 1,
    fullDogBodyRequired: false,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO002",
    title: "Name Response Indoors",
    orderIndex: 2,
    lessonGoal: "Teach the dog to visibly orient toward the owner after one audible name cue indoors.",
    visibleCheckpoint: "After one audible name cue, the dog visibly turns head or body toward the owner within 2 seconds.",
    tutorialSteps: [
      "Place the phone so the dog and owner remain visible.",
      "Begin when the dog is not already staring directly at the owner.",
      "Start recording before saying the dog's name.",
      "Say the name once.",
      "Reward visible orientation toward the owner.",
      "Keep the repetition short.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Dog must be visible.",
      "Owner must be visible.",
      "Audio is required.",
      "Begin recording before cue.",
    ],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 10,
    passCriteria: [
      "Dog matches DOG_PROFILE photos.",
      "One audible name cue occurs.",
      "Dog visibly turns head or body toward owner after cue.",
      "Orientation occurs within 2 seconds.",
      "Dog and owner remain visible through response.",
    ],
    failCriteria: [
      "Clip is scorable but dog does not orient after cue.",
      "Dog visibly turns away and never reorients within valid window.",
      "Dog response happens only before cue.",
    ],
    needsReviewCriteria: [
      "Name cue inaudible.",
      "Dog already facing owner continuously before cue.",
      "Dog cropped.",
      "Owner cropped.",
      "Response timing unclear.",
      "Multiple dogs ambiguous.",
      "Clip starts after cue.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized attention.",
      "Do not infer emotional engagement.",
      "Do not claim outdoor reliability.",
    ],
    safetyNotes: [
      "Say the name once.",
      "Do not repeatedly shout the name.",
    ],
    prerequisiteActivityId: "SO001",
    nextActivityId: "SO003",
    orderedVisibleActions: [
      "Target dog and owner are visible, and dog is not already staring directly at owner.",
      "One name cue is audible.",
      "Dog turns head or body toward owner after the cue.",
      "Orientation occurs within 2 seconds while dog and owner remain visible.",
    ],
    skillFamily: "Marker and Attention Foundations",
    level: 1,
    fullDogBodyRequired: false,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO003",
    title: "Name Response with Mild Distraction",
    orderIndex: 3,
    lessonGoal: "Teach the dog to visibly orient toward the owner after one name cue while a mild visible distraction is present.",
    visibleCheckpoint: "The dog begins oriented toward or aware of a mild visible staged distraction, receives one audible name cue, and visibly turns toward the owner within 2 seconds.",
    tutorialSteps: [
      "Choose a mild safe distraction such as a stationary toy several feet away.",
      "Keep the dog, owner, and distraction visible.",
      "Start recording before the name cue.",
      "Say the dog's name once.",
      "Reward visible orientation toward owner.",
      "Stop before the distraction becomes too difficult.",
    ],
    cameraAngle: "WIDE_ROOM_OWNER_AND_DOG",
    setupInstructions: [
      "Dog must be visible.",
      "Owner must be visible.",
      "Mild distraction must be visible.",
      "Audio is required.",
      "Begin recording before cue.",
    ],
    audioRequired: true,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Mild distraction remains visible.",
      "One audible name cue occurs.",
      "Dog visibly orients toward owner after cue.",
      "Response occurs within 2 seconds.",
      "Relevant sequence is visible.",
    ],
    failCriteria: [
      "Dog remains oriented only toward distraction.",
      "No post-cue orientation occurs.",
      "Dog response occurs only before cue.",
    ],
    needsReviewCriteria: [
      "Distraction hidden.",
      "Dog already staring at owner before cue.",
      "Cue inaudible.",
      "Owner cropped.",
      "Dog cropped.",
      "Timing unclear.",
      "Multiple dogs ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not claim distraction-proof attention.",
      "Do not claim outdoor reliability.",
      "Do not infer emotional state.",
    ],
    safetyNotes: [
      "Use only a mild distraction.",
      "Reduce difficulty if dog cannot respond.",
    ],
    prerequisiteActivityId: "SO002",
    nextActivityId: "SO004",
    orderedVisibleActions: [
      "Target dog, owner, and mild visible staged distraction are visible before the cue.",
      "Dog begins oriented toward or aware of the mild distraction.",
      "One name cue is audible.",
      "Dog turns toward owner within 2 seconds after the cue.",
    ],
    skillFamily: "Marker and Attention Foundations",
    level: 1,
    fullDogBodyRequired: false,
    pawsRequired: false,
    hipsRequired: false,
    ownerRequiredInFrame: true,
  },
  {
    id: "SO004",
    title: "Sit Introduction",
    orderIndex: 4,
    lessonGoal: "Teach the dog to visibly transition from standing into a seated posture.",
    visibleCheckpoint: "The dog begins standing, lowers hindquarters, hips contact the floor, front paws remain grounded, and the seated posture remains visible for at least 1 second.",
    tutorialSteps: [
      "Position the phone from the side so the dog's hips and paws remain visible.",
      "Begin with the dog standing.",
      "Use a reward lure or cue without pushing the dog.",
      "Reward after the hips contact the floor.",
      "Keep the repetition short.",
    ],
    cameraAngle: "SIDE_FULL_BODY",
    setupInstructions: [
      "Full dog body must be visible.",
      "Hips must be visible.",
      "Front paws must be visible.",
      "Audio is optional unless cue timing is judged.",
    ],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Dog visibly begins standing.",
      "Hindquarters visibly lower.",
      "Hips contact floor.",
      "Front paws remain grounded.",
      "Seated posture holds for at least 1 second.",
      "No visible physical forcing occurs.",
    ],
    failCriteria: [
      "Hips never contact floor.",
      "Dog lies down instead of sitting.",
      "Dog remains standing.",
      "Owner pushes dog into sit.",
    ],
    needsReviewCriteria: [
      "Hips cropped.",
      "Paws cropped.",
      "Transition begins before recording.",
      "Dog body hidden.",
      "Dog identity unclear.",
      "Multiple dogs ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized obedience.",
      "Do not claim jumping is solved.",
      "Do not infer intent.",
    ],
    safetyNotes: [
      "Never push the dog's hips downward.",
      "Use a non-slip surface.",
    ],
    prerequisiteActivityId: "SO003",
    nextActivityId: "SO005",
    orderedVisibleActions: [
      "Target dog is visible from the side and begins standing.",
      "Dog lowers hindquarters.",
      "Hips contact the floor while front paws remain grounded.",
      "Seated posture remains visible for at least 1 second without physical forcing.",
    ],
    skillFamily: "Position Foundations",
    level: 1,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: false,
  },
  {
    id: "SO005",
    title: "Sit Hold: 3 Seconds",
    orderIndex: 5,
    lessonGoal: "Teach the dog to remain visibly seated for at least 3 seconds.",
    visibleCheckpoint: "The dog remains continuously in a seated posture for at least 3 seconds.",
    tutorialSteps: [
      "Use a non-slip surface.",
      "Position the phone so hips and paws stay visible.",
      "Ask for sit.",
      "Begin timing when hips contact floor.",
      "Reward after a continuous 3-second hold.",
    ],
    cameraAngle: "SIDE_FULL_BODY",
    setupInstructions: [
      "Dog hips and paws must be visible.",
      "Seated posture must remain visible.",
      "Audio is optional.",
      "Clip must be long enough to score the 3-second hold.",
    ],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 6,
    maxClipSeconds: 12,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Seated posture is clearly visible.",
      "Hips remain on floor.",
      "Front paws remain grounded.",
      "Continuous hold reaches at least 3 seconds.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog stands before 3 seconds.",
      "Dog lies down before 3 seconds.",
      "Owner physically holds dog in sit.",
    ],
    needsReviewCriteria: [
      "Hips cropped.",
      "Paws hidden.",
      "Duration unclear.",
      "Clip too short.",
      "Dog partially hidden.",
    ],
    outOfScopeClaims: [
      "Do not claim long-term sit reliability.",
      "Do not infer emotional state.",
    ],
    safetyNotes: [
      "Keep duration easy.",
      "Avoid physical restraint.",
    ],
    prerequisiteActivityId: "SO004",
    nextActivityId: "SO006",
    orderedVisibleActions: [
      "Target dog is visible in a seated posture with hips and paws visible.",
      "Timing begins when hips are on the floor.",
      "Dog remains seated continuously for at least 3 seconds.",
      "No physical restraint occurs.",
    ],
    skillFamily: "Position Foundations",
    level: 1,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: false,
  },
  {
    id: "SO006",
    title: "Sit Hold: 5 Seconds",
    orderIndex: 6,
    lessonGoal: "Extend the visible sit hold duration to at least 5 seconds.",
    visibleCheckpoint: "The dog remains continuously seated for at least 5 seconds.",
    tutorialSteps: [
      "Use the same safe setup as SO005.",
      "Ask for sit.",
      "Begin timing when hips contact floor.",
      "Wait for a continuous 5-second hold.",
      "Reward success.",
    ],
    cameraAngle: "SIDE_FULL_BODY",
    setupInstructions: [
      "Hips and paws must be visible.",
      "Seated posture must remain visible.",
      "Audio is optional.",
      "Clip must be long enough to score the 5-second hold.",
    ],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 8,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Seated posture remains visible.",
      "Hips remain on floor continuously.",
      "Front paws remain grounded.",
      "Continuous hold reaches 5 seconds.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog stands before 5 seconds.",
      "Dog lies down before 5 seconds.",
      "Owner restrains dog physically.",
    ],
    needsReviewCriteria: [
      "Hips hidden.",
      "Paws cropped.",
      "Duration unclear.",
      "Clip too short.",
      "Dog partially hidden.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized sit reliability.",
      "Do not claim impulse control outside submitted clip.",
    ],
    safetyNotes: [
      "Increase duration gradually.",
      "Keep repetition short.",
    ],
    prerequisiteActivityId: "SO005",
    nextActivityId: "SO007",
    orderedVisibleActions: [
      "Target dog is visible in a seated posture with hips and paws visible.",
      "Timing begins when hips are on the floor.",
      "Dog remains seated continuously for at least 5 seconds.",
      "No physical restraint occurs.",
    ],
    skillFamily: "Position Foundations",
    level: 1,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: false,
  },
  {
    id: "SO007",
    title: "Down Introduction",
    orderIndex: 7,
    lessonGoal: "Teach the dog to visibly transition into a down posture.",
    visibleCheckpoint: "The dog begins in sit or stand, lowers front body, elbows contact floor, torso lowers, and down posture remains visible for at least 1 second.",
    tutorialSteps: [
      "Position phone from the side.",
      "Keep elbows, torso, hips, and paws visible.",
      "Begin with dog sitting or standing.",
      "Use a reward lure or cue without pushing.",
      "Reward after elbows and torso lower to floor.",
    ],
    cameraAngle: "SIDE_FULL_BODY",
    setupInstructions: [
      "Elbows must be visible.",
      "Torso must be visible.",
      "Hips and paws must be visible.",
      "Audio is optional unless cue timing is judged.",
    ],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Dog starts in sit or stand.",
      "Front body lowers visibly.",
      "Elbows contact floor.",
      "Torso lowers into down.",
      "Down posture holds at least 1 second.",
      "No physical forcing occurs.",
    ],
    failCriteria: [
      "Dog remains sitting or standing.",
      "Elbows never reach floor.",
      "Owner pushes dog into down.",
      "Requested transition is visibly incomplete.",
    ],
    needsReviewCriteria: [
      "Elbows hidden.",
      "Torso cropped.",
      "Dog already down at clip start.",
      "Transition hidden.",
      "Multiple dogs ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not claim emotional calmness.",
      "Do not claim generalized obedience.",
    ],
    safetyNotes: [
      "Use a non-slip surface.",
      "Never physically force down posture.",
    ],
    prerequisiteActivityId: "SO006",
    nextActivityId: "SO008",
    orderedVisibleActions: [
      "Target dog is visible from the side and starts in sit or stand.",
      "Dog lowers the front body.",
      "Elbows contact the floor and torso lowers into down.",
      "Down posture remains visible for at least 1 second without physical forcing.",
    ],
    skillFamily: "Position Foundations",
    level: 1,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: false,
  },
  {
    id: "SO008",
    title: "Down Hold: 3 Seconds",
    orderIndex: 8,
    lessonGoal: "Teach the dog to remain visibly in a down posture for at least 3 seconds.",
    visibleCheckpoint: "The dog remains continuously in a visible down posture for at least 3 seconds.",
    tutorialSteps: [
      "Position phone so elbows and torso remain visible.",
      "Ask for down.",
      "Begin timing after elbows and torso reach floor.",
      "Wait for a continuous 3-second hold.",
      "Reward success.",
    ],
    cameraAngle: "SIDE_FULL_BODY",
    setupInstructions: [
      "Elbows and torso must be visible.",
      "Down posture must remain visible.",
      "Audio is optional.",
      "Clip must be long enough to score the 3-second hold.",
    ],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 6,
    maxClipSeconds: 12,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Elbows and torso remain lowered.",
      "Down posture remains visible.",
      "Continuous hold reaches at least 3 seconds.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog stands or sits before 3 seconds.",
      "Down posture is not maintained.",
      "Owner restrains dog physically.",
    ],
    needsReviewCriteria: [
      "Elbows hidden.",
      "Torso cropped.",
      "Duration unclear.",
      "Clip too short.",
      "Dog partially obscured.",
    ],
    outOfScopeClaims: [
      "Do not infer emotional calmness.",
      "Do not claim long-term down reliability.",
    ],
    safetyNotes: [
      "Keep hold easy.",
      "Use a comfortable surface.",
    ],
    prerequisiteActivityId: "SO007",
    nextActivityId: "SO009",
    orderedVisibleActions: [
      "Target dog is visible in down posture with elbows and torso lowered.",
      "Timing begins after elbows and torso reach the floor.",
      "Dog remains in down posture continuously for at least 3 seconds.",
      "No physical restraint occurs.",
    ],
    skillFamily: "Position Foundations",
    level: 1,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: false,
  },
  {
    id: "SO009",
    title: "Down Hold: 5 Seconds",
    orderIndex: 9,
    lessonGoal: "Extend the visible down hold duration to at least 5 seconds.",
    visibleCheckpoint: "The dog remains continuously in a visible down posture for at least 5 seconds.",
    tutorialSteps: [
      "Use the same safe setup as SO008.",
      "Ask for down.",
      "Begin timing after elbows and torso reach floor.",
      "Wait for a continuous 5-second hold.",
      "Reward success.",
    ],
    cameraAngle: "SIDE_FULL_BODY",
    setupInstructions: [
      "Elbows and torso must be visible.",
      "Down posture must remain visible.",
      "Audio is optional.",
      "Clip must be long enough to score the 5-second hold.",
    ],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 8,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Down posture remains clearly visible.",
      "Elbows and torso remain lowered.",
      "Continuous hold reaches at least 5 seconds.",
      "No restraint occurs.",
    ],
    failCriteria: [
      "Dog rises before 5 seconds.",
      "Dog changes out of down before duration completes.",
      "Owner restrains dog.",
    ],
    needsReviewCriteria: [
      "Elbows hidden.",
      "Torso hidden.",
      "Duration unclear.",
      "Clip too short.",
      "Dog partially cropped.",
    ],
    outOfScopeClaims: [
      "Do not infer relaxation.",
      "Do not claim generalized obedience.",
    ],
    safetyNotes: [
      "Increase duration gradually.",
      "Do not physically force position.",
    ],
    prerequisiteActivityId: "SO008",
    nextActivityId: "SO010",
    orderedVisibleActions: [
      "Target dog is visible in down posture with elbows and torso lowered.",
      "Timing begins after elbows and torso reach the floor.",
      "Dog remains in down posture continuously for at least 5 seconds.",
      "No physical restraint occurs.",
    ],
    skillFamily: "Position Foundations",
    level: 1,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: false,
  },
  {
    id: "SO010",
    title: "Stand Introduction",
    orderIndex: 10,
    lessonGoal: "Teach the dog to visibly transition from sit or down into a stable four-paw stand.",
    visibleCheckpoint: "The dog begins sitting or lying down, transitions into standing, and all four paws support the body visibly for at least 1 second.",
    tutorialSteps: [
      "Position phone from the side so all paws remain visible.",
      "Begin with dog in sit or down.",
      "Use a reward lure or cue.",
      "Reward after the dog reaches a stable stand.",
      "Keep the session short.",
    ],
    cameraAngle: "SIDE_FULL_BODY",
    setupInstructions: [
      "All paws must be visible.",
      "Hips must be visible.",
      "Audio is optional unless cue timing is judged.",
      "Use a side view from start through stable stand.",
    ],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Dog visibly begins in sit or down.",
      "Dog rises into standing posture.",
      "All four paws visibly support body.",
      "Stable stand remains visible for at least 1 second.",
      "No physical forcing occurs.",
    ],
    failCriteria: [
      "Dog remains seated or down.",
      "Dog does not reach stable standing posture.",
      "Owner lifts or physically moves dog into stand.",
    ],
    needsReviewCriteria: [
      "Paws cropped.",
      "Transition hidden.",
      "Dog already standing at clip start.",
      "Hips hidden.",
      "Dog partially obscured.",
    ],
    outOfScopeClaims: [
      "Do not infer physical fitness.",
      "Do not claim medical mobility.",
      "Do not claim generalized obedience.",
    ],
    safetyNotes: [
      "Use a non-slip surface.",
      "Stop if dog appears physically uncomfortable.",
    ],
    prerequisiteActivityId: "SO009",
    nextActivityId: "SO011",
    orderedVisibleActions: [
      "Target dog is visible from the side and begins in sit or down.",
      "Dog transitions upward from sit or down.",
      "All four paws visibly support the body in a standing posture.",
      "Stable stand remains visible for at least 1 second without physical forcing.",
    ],
    skillFamily: "Position Foundations",
    level: 1,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: true,
    ownerRequiredInFrame: false,
  },
];

export const SO001_SO010: BatchActivity[] = SPECS.map(makeActivity);
