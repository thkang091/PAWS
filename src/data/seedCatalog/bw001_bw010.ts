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
  ownerRequiredInFrame: boolean;
  leashRequiredInFrame: boolean;
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
- Owner or handler in frame required: ${spec.ownerRequiredInFrame ? "YES" : "NO"}
- Leash required in frame: ${spec.leashRequiredInFrame ? "YES" : "NO"}
${list(spec.setupInstructions)}

SAVED REFERENCE-PHOTO RULES
${list(spec.requiredReferenceAssets)}

AUDIO RULE
${spec.audioRequired ? "Audio is required when cue timing is judged. If the configured cue or timing audio is missing or unusable, return NEEDS_REVIEW." : "Audio is optional. Do not fail solely because audio is absent."}

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
    pawsRequired: spec.id !== "BW001" && spec.id !== "BW002",
    hipsRequired: false,
    ownerRequiredInFrame: spec.ownerRequiredInFrame,
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: spec.id === "BW001" || spec.id === "BW002" || spec.leashRequiredInFrame,
    destinationRequiredInFrame: spec.id.startsWith("BW00") && !["BW001", "BW002"].includes(spec.id),
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
    xpReward: spec.orderIndex >= 7 ? 85 : 75,
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
    id: "BW001",
    title: "Calm Harness Setup",
    orderIndex: 1,
    lessonGoal: "Teach the dog to remain visible while the owner places and secures the harness without obvious forced restraint.",
    visibleCheckpoint: "Owner visibly places and secures the harness while the dog remains visible and no obvious forced restraint occurs.",
    tutorialSteps: [
      "Use a medium or close body view.",
      "Keep the harness visible before placement.",
      "Begin recording before harness setup starts.",
      "Place and secure the harness without dragging, pinning, lifting, or forcing.",
      "Keep fastening points visible when possible.",
    ],
    cameraAngle: "MEDIUM_OR_CLOSE_BODY_VIEW",
    setupInstructions: [
      "Harness must be visible.",
      "Fastening points should be visible when possible.",
      "Target dog must remain visible.",
      "Use CUSTOM_OBJECT only if the saved-gear workflow requires harness registration.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 25,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Harness placement visibly completes.",
      "Fastening step is visible.",
      "No dragging, pinning, lifting, or forced restraint occurs.",
      "Target dog remains visible.",
    ],
    failCriteria: [
      "Harness setup remains incomplete.",
      "Visible forced restraint occurs.",
      "Owner drags or pins dog into position.",
    ],
    needsReviewCriteria: [
      "Harness hidden.",
      "Buckle step obscured.",
      "Dog cropped.",
      "Clip too short.",
      "Dog identity unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim emotional comfort.",
      "Do not claim walk readiness.",
    ],
    safetyNotes: [
      "Use properly fitted gear.",
      "Stop if the dog struggles.",
    ],
    prerequisiteActivityIds: [],
    nextActivityId: "BW002",
    orderedVisibleActions: [
      "Target dog and harness are visible before setup begins.",
      "Owner places harness on the dog.",
      "Owner visibly secures the harness fastening step.",
      "Harness setup completes without dragging, pinning, lifting, or forced restraint.",
    ],
    skillFamily: "Walk Gear Foundations",
    level: 1,
    fullDogBodyRequired: false,
    ownerRequiredInFrame: true,
    leashRequiredInFrame: false,
  },
  {
    id: "BW002",
    title: "Calm Leash Clipping",
    orderIndex: 2,
    lessonGoal: "Teach the dog to remain visible while the leash is clipped to collar or harness without obvious forced restraint.",
    visibleCheckpoint: "Owner visibly clips leash to collar or harness while dog remains visible and no obvious forced restraint occurs.",
    tutorialSteps: [
      "Use a close view of the leash clip point.",
      "Keep dog neck or harness attachment point visible.",
      "Keep the leash and owner hand visible.",
      "Begin recording before clipping starts.",
      "Clip the leash without dragging or forced restraint.",
    ],
    cameraAngle: "CLOSE_LEASH_CLIP_POINT",
    setupInstructions: [
      "Leash clip point must be visible.",
      "Dog neck or harness attachment point must be visible.",
      "Owner hand and leash must remain visible.",
      "Use CUSTOM_OBJECT only if the saved-gear workflow requires leash registration.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Leash clip visibly attaches.",
      "Leash remains visible.",
      "No dragging or forced restraint occurs.",
    ],
    failCriteria: [
      "Clipping action does not complete.",
      "Owner physically restrains or drags dog.",
      "Leash is not attached.",
    ],
    needsReviewCriteria: [
      "Clip point hidden.",
      "Leash cropped.",
      "Owner hand blocks view.",
      "Dog cropped.",
    ],
    outOfScopeClaims: [
      "Do not claim handling comfort.",
      "Do not claim walk readiness.",
    ],
    safetyNotes: [
      "Use properly fitted collar or harness.",
      "Do not pin the dog for clipping.",
    ],
    prerequisiteActivityIds: ["BW001"],
    nextActivityId: "BW003",
    orderedVisibleActions: [
      "Target dog, leash, owner hand, and attachment point are visible before clipping.",
      "Owner moves leash clip to collar or harness attachment point.",
      "Leash clip visibly attaches.",
      "No dragging or forced restraint occurs.",
    ],
    skillFamily: "Walk Gear Foundations",
    level: 1,
    fullDogBodyRequired: false,
    ownerRequiredInFrame: true,
    leashRequiredInFrame: true,
  },
  {
    id: "BW003",
    title: "Follow-Me Indoors: 5 Steps",
    orderIndex: 3,
    lessonGoal: "Teach the dog to follow the visible owner indoors for at least 5 consecutive owner steps.",
    visibleCheckpoint: "Dog follows visible owner indoors for at least 5 consecutive owner steps.",
    tutorialSteps: [
      "Use a wide room or hallway view.",
      "Keep owner, dog, and path visible.",
      "Begin recording before movement starts.",
      "Owner takes at least 5 visible steps.",
      "Reward while the dog follows in the same travel direction.",
    ],
    cameraAngle: "WIDE_ROOM_OR_HALLWAY_ROUTE",
    setupInstructions: [
      "Owner, dog, and path must be visible.",
      "Owner feet must be visible for step counting.",
      "Dog path must be visible.",
      "No leash dragging may occur.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Owner takes at least 5 visible steps.",
      "Dog follows in the same travel direction.",
      "Dog remains within a reasonable following distance.",
      "No leash dragging occurs.",
    ],
    failCriteria: [
      "Dog does not follow.",
      "Dog travels in another direction.",
      "Owner visibly drags dog.",
    ],
    needsReviewCriteria: [
      "Owner feet cropped.",
      "Dog path hidden.",
      "Step count unclear.",
      "Clip starts after movement begins.",
    ],
    outOfScopeClaims: [
      "Do not claim loose-leash walking yet.",
      "Do not claim outdoor walking reliability.",
    ],
    safetyNotes: [
      "Use a clear indoor path.",
      "Avoid pulling the dog.",
    ],
    prerequisiteActivityIds: ["BW002"],
    nextActivityId: "BW004",
    orderedVisibleActions: [
      "Target dog, owner, owner feet, and indoor path are visible before movement starts.",
      "Owner takes at least 5 consecutive visible steps.",
      "Dog follows in the same travel direction.",
      "Dog remains reasonably near owner without leash dragging.",
    ],
    skillFamily: "Indoor Following",
    level: 1,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
    leashRequiredInFrame: false,
  },
  {
    id: "BW004",
    title: "Follow-Me Indoors: 10 Steps",
    orderIndex: 4,
    lessonGoal: "Teach the dog to follow the visible owner indoors for at least 10 consecutive owner steps.",
    visibleCheckpoint: "Dog follows visible owner indoors for at least 10 consecutive owner steps.",
    tutorialSteps: [
      "Use a wide room or hallway view.",
      "Keep owner, dog, and path visible.",
      "Begin recording before movement starts.",
      "Owner completes at least 10 visible steps.",
      "Reward while the dog follows in the same travel direction.",
    ],
    cameraAngle: "WIDE_ROOM_OR_HALLWAY_ROUTE",
    setupInstructions: [
      "Owner, dog, and path must be visible.",
      "Owner feet must be visible for step counting.",
      "Dog must remain visible.",
      "No dragging may occur.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Owner completes at least 10 visible steps.",
      "Dog follows in the same travel direction.",
      "Dog remains reasonably near owner.",
      "No dragging occurs.",
    ],
    failCriteria: [
      "Dog stops following.",
      "Dog leaves route.",
      "Owner drags dog.",
    ],
    needsReviewCriteria: [
      "Path cropped.",
      "Step count unclear.",
      "Dog hidden.",
      "Owner feet hidden.",
    ],
    outOfScopeClaims: [
      "Do not claim loose-leash walking yet.",
      "Do not claim outdoor walking reliability.",
    ],
    safetyNotes: [
      "Use a clear indoor route.",
      "Avoid dragging or pulling the dog.",
    ],
    prerequisiteActivityIds: ["BW003"],
    nextActivityId: "BW005",
    orderedVisibleActions: [
      "Target dog, owner, owner feet, and indoor path are visible before movement starts.",
      "Owner completes at least 10 visible steps.",
      "Dog follows in the same travel direction.",
      "Dog remains reasonably near owner without dragging.",
    ],
    skillFamily: "Indoor Following",
    level: 1,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
    leashRequiredInFrame: false,
  },
  {
    id: "BW005",
    title: "Loose Leash Indoors: 5 Steps",
    orderIndex: 5,
    lessonGoal: "Teach the dog to walk with the owner indoors for at least 5 visible steps while the leash remains slack or without sustained tension.",
    visibleCheckpoint: "Dog walks with owner indoors for at least 5 visible steps while the leash remains slack or without sustained tension.",
    tutorialSteps: [
      "Use a wide indoor route view.",
      "Keep owner, dog, leash, and path visible.",
      "Begin recording before movement starts.",
      "Walk at least 5 visible steps.",
      "Reward after the dog travels with the owner without sustained leash tension.",
    ],
    cameraAngle: "WIDE_INDOOR_ROUTE_WITH_LEASH",
    setupInstructions: [
      "Owner, dog, leash, and path must be visible.",
      "Step count must be visible.",
      "Leash slack or lack of sustained tension must be visible.",
      "Owner must not pull dog forward.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "At least 5 visible steps are completed.",
      "Leash remains visibly slack or without sustained tension.",
      "Dog travels with owner.",
      "Owner does not pull dog forward.",
    ],
    failCriteria: [
      "Leash remains visibly taut for sustained interval.",
      "Dog repeatedly pulls owner.",
      "Owner drags dog.",
      "Route is not completed.",
    ],
    needsReviewCriteria: [
      "Leash hidden.",
      "Step count unclear.",
      "Dog cropped.",
      "Route cropped.",
    ],
    outOfScopeClaims: [
      "Do not claim outdoor leash manners.",
      "Do not claim generalized walking reliability.",
    ],
    safetyNotes: [
      "Use a safe indoor route.",
      "Avoid leash corrections or dragging.",
    ],
    prerequisiteActivityIds: ["BW004"],
    nextActivityId: "BW006",
    orderedVisibleActions: [
      "Target dog, owner, leash, and indoor path are visible before movement starts.",
      "Owner and dog complete at least 5 visible steps.",
      "Leash remains slack or without sustained tension.",
      "Dog travels with owner without being pulled forward.",
    ],
    skillFamily: "Loose Leash Foundations",
    level: 1,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
    leashRequiredInFrame: true,
  },
  {
    id: "BW006",
    title: "Loose Leash Indoors: 10 Steps",
    orderIndex: 6,
    lessonGoal: "Extend indoor loose-leash walking to at least 10 visible steps without sustained leash tension.",
    visibleCheckpoint: "Dog walks with owner indoors for at least 10 visible steps while leash remains slack or without sustained tension.",
    tutorialSteps: [
      "Use a wide indoor route view.",
      "Keep the leash visible.",
      "Begin recording before movement starts.",
      "Walk at least 10 visible steps.",
      "Reward after the dog moves with the owner without sustained leash tension.",
    ],
    cameraAngle: "WIDE_INDOOR_ROUTE_WITH_LEASH",
    setupInstructions: [
      "Leash must be visible.",
      "Owner, dog, and route must be visible.",
      "Step count must be visible.",
      "Owner must not drag the dog.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "10 visible steps are completed.",
      "Leash remains slack or without sustained tension.",
      "Dog moves with owner.",
    ],
    failCriteria: [
      "Sustained leash tension occurs.",
      "Dog repeatedly pulls.",
      "Owner drags dog.",
    ],
    needsReviewCriteria: [
      "Leash hidden.",
      "Route cropped.",
      "Steps unclear.",
      "Dog cropped.",
    ],
    outOfScopeClaims: [
      "Do not claim outdoor leash manners.",
      "Do not claim generalized walking reliability.",
    ],
    safetyNotes: [
      "Use a clear indoor route.",
      "Avoid leash corrections or dragging.",
    ],
    prerequisiteActivityIds: ["BW005"],
    nextActivityId: "BW007",
    orderedVisibleActions: [
      "Target dog, owner, visible leash, and indoor route are visible before movement starts.",
      "Owner and dog complete at least 10 visible steps.",
      "Leash remains slack or without sustained tension.",
      "Dog moves with owner without being dragged.",
    ],
    skillFamily: "Loose Leash Foundations",
    level: 1,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
    leashRequiredInFrame: true,
  },
  {
    id: "BW007",
    title: "Loose Leash Hallway: 10 Steps",
    orderIndex: 7,
    lessonGoal: "Teach the dog to walk through a hallway for at least 10 visible steps while the leash remains slack.",
    visibleCheckpoint: "Dog walks with owner through a hallway for at least 10 visible steps while leash remains slack or without sustained tension.",
    tutorialSteps: [
      "Use a visible hallway route.",
      "Keep dog, owner, and leash visible.",
      "Begin recording before hallway movement starts.",
      "Walk at least 10 visible steps through the hallway.",
      "Reward after the dog stays with owner without sustained pulling.",
    ],
    cameraAngle: "WIDE_HALLWAY_ROUTE_WITH_LEASH",
    setupInstructions: [
      "Hallway route must be visible.",
      "Dog, owner, and leash must be visible.",
      "Step count must be visible.",
      "Owner must not drag the dog.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Hallway route is visible.",
      "At least 10 steps are completed.",
      "Leash remains slack.",
      "Dog stays with owner.",
    ],
    failCriteria: [
      "Sustained pulling occurs.",
      "Dog leaves route.",
      "Owner drags dog.",
    ],
    needsReviewCriteria: [
      "Hallway route hidden.",
      "Leash obscured.",
      "Dog cropped.",
      "Step count unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim outdoor leash manners.",
      "Do not claim generalized walking reliability.",
    ],
    safetyNotes: [
      "Use a safe hallway.",
      "Avoid leash corrections or dragging.",
    ],
    prerequisiteActivityIds: ["BW006"],
    nextActivityId: "BW008",
    orderedVisibleActions: [
      "Target dog, owner, visible leash, and hallway route are visible before movement starts.",
      "Owner and dog complete at least 10 visible hallway steps.",
      "Leash remains slack or without sustained tension.",
      "Dog stays with owner and remains on route.",
    ],
    skillFamily: "Loose Leash Hallway",
    level: 1,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
    leashRequiredInFrame: true,
  },
  {
    id: "BW008",
    title: "Loose Leash Hallway: 20 Steps",
    orderIndex: 8,
    lessonGoal: "Extend hallway loose-leash walking to at least 20 visible steps without sustained leash tension.",
    visibleCheckpoint: "Dog walks with owner through hallway for at least 20 visible steps while leash remains slack or without sustained tension.",
    tutorialSteps: [
      "Use a visible hallway route.",
      "Keep dog, owner, and leash visible.",
      "Begin recording before hallway movement starts.",
      "Walk at least 20 visible steps through the hallway.",
      "Reward after the dog remains with owner without sustained pulling.",
    ],
    cameraAngle: "WIDE_HALLWAY_ROUTE_WITH_LEASH",
    setupInstructions: [
      "Hallway route must be visible.",
      "Dog, owner, and leash must be visible.",
      "Step count must be visible.",
      "Clip must be long enough to score 20 steps.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 12,
    maxClipSeconds: 30,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "20 visible steps are completed.",
      "Leash remains slack.",
      "Dog remains with owner.",
    ],
    failCriteria: [
      "Sustained pulling occurs.",
      "Dog leaves route.",
      "Owner drags dog.",
    ],
    needsReviewCriteria: [
      "Leash hidden.",
      "Route cropped.",
      "Step count unclear.",
      "Clip too short.",
    ],
    outOfScopeClaims: [
      "Do not claim outdoor leash manners.",
      "Do not claim generalized walking reliability.",
    ],
    safetyNotes: [
      "Use a safe hallway.",
      "Avoid leash corrections or dragging.",
    ],
    prerequisiteActivityIds: ["BW007"],
    nextActivityId: "BW009",
    orderedVisibleActions: [
      "Target dog, owner, visible leash, and hallway route are visible before movement starts.",
      "Owner and dog complete at least 20 visible hallway steps.",
      "Leash remains slack or without sustained tension.",
      "Dog remains with owner and on route.",
    ],
    skillFamily: "Loose Leash Hallway",
    level: 1,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
    leashRequiredInFrame: true,
  },
  {
    id: "BW009",
    title: "Check-In During Walk",
    orderIndex: 9,
    lessonGoal: "Teach the dog to visibly orient toward owner during an indoor or quiet safe route walk.",
    visibleCheckpoint: "While walking indoors or on a quiet safe route, dog visibly turns head or body toward owner after one configured cue or during a defined check-in moment.",
    tutorialSteps: [
      "Use a visible indoor or quiet safe route.",
      "Keep owner, dog, leash, and route visible.",
      "Begin recording before the check-in moment.",
      "Use the configured cue if cue timing is being judged.",
      "Reward visible orientation toward the owner.",
    ],
    cameraAngle: "WIDE_ROUTE_WITH_LEASH",
    setupInstructions: [
      "Owner, dog, leash, and route must be visible.",
      "Dog head or body orientation must be visible.",
      "Audio is required only when cue timing is judged.",
      "Leash must remain visible.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Dog is walking or paused on route.",
      "Dog visibly orients toward owner.",
      "Orientation occurs after cue when cue is used.",
      "Leash remains visible.",
    ],
    failCriteria: [
      "Dog never orients toward owner.",
      "Response occurs only before cue.",
      "Owner physically turns dog.",
    ],
    needsReviewCriteria: [
      "Dog head hidden.",
      "Owner hidden.",
      "Cue inaudible when required.",
      "Timing unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized attention outdoors.",
      "Do not claim generalized walking reliability.",
    ],
    safetyNotes: [
      "Use an indoor or quiet safe route.",
      "Do not physically turn the dog.",
    ],
    prerequisiteActivityIds: ["BW008"],
    nextActivityId: "BW010",
    orderedVisibleActions: [
      "Target dog, owner, leash, and route are visible before the check-in moment.",
      "Dog is walking or paused on the route.",
      "Configured cue occurs when cue timing is being judged.",
      "Dog visibly turns head or body toward owner.",
    ],
    skillFamily: "Walking Attention",
    level: 1,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
    leashRequiredInFrame: true,
  },
  {
    id: "BW010",
    title: "Stop When Owner Stops",
    orderIndex: 10,
    lessonGoal: "Teach the dog to stop shortly after the owner visibly stops walking without dragging or physical blocking.",
    visibleCheckpoint: "Owner visibly stops walking and dog visibly stops movement shortly afterward without being dragged or physically blocked.",
    tutorialSteps: [
      "Use a wide route view.",
      "Keep dog, owner, leash, and path visible.",
      "Begin recording before the stop.",
      "Owner visibly stops walking.",
      "Reward after the dog stops shortly afterward without dragging or blocking.",
    ],
    cameraAngle: "WIDE_ROUTE_WITH_LEASH",
    setupInstructions: [
      "Dog, owner, leash, and path must be visible.",
      "Owner feet must be visible.",
      "Owner stop and dog stop timing must be clear.",
      "No physical blocking or dragging may occur.",
    ],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: [
      "Dog matches DOG_PROFILE.",
      "Owner stop is visible.",
      "Dog stops after owner stop.",
      "Leash remains visible.",
      "No dragging or blocking occurs.",
    ],
    failCriteria: [
      "Dog continues pulling forward.",
      "Dog does not stop.",
      "Owner physically blocks or drags dog.",
    ],
    needsReviewCriteria: [
      "Owner feet hidden.",
      "Leash hidden.",
      "Timing unclear.",
      "Path cropped.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized walking reliability.",
      "Do not claim outdoor leash manners.",
    ],
    safetyNotes: [
      "Use a safe route.",
      "Avoid abrupt leash corrections.",
    ],
    prerequisiteActivityIds: ["BW009"],
    nextActivityId: "BW011",
    orderedVisibleActions: [
      "Target dog, owner, leash, and path are visible before the stop.",
      "Owner visibly stops walking.",
      "Dog stops movement shortly after the owner stop.",
      "No dragging or physical blocking occurs.",
    ],
    skillFamily: "Walking Attention",
    level: 1,
    fullDogBodyRequired: true,
    ownerRequiredInFrame: true,
    leashRequiredInFrame: true,
  },
];

export const BW001_BW010: BatchActivity[] = SPECS.map(makeActivity);
