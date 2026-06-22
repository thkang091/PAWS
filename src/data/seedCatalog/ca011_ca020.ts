import type { CompletedSeedActivity, SeedActivity } from "./bh001_bh010";

type BatchActivity = CompletedSeedActivity & { orderedVisibleActions: string[]; referenceSetupOnly: boolean };

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
  referenceSetupOnly?: boolean;
};

const list = (items: string[]): string => items.map((item) => `- ${item}`).join("\n");

const calmScopeRules = [
  "Gemini may verify only visible behavior during the submitted clip.",
  "Do not infer emotional calmness, comfort, anxiety diagnosis, treatment success, long-term alone-time tolerance, or safety outside the submitted clip.",
  "Visible vocalization may be noted only when audio is present.",
];

const promptFor = (spec: ActivitySpec): string => {
  if (spec.referenceSetupOnly) {
    return `PAWS REFERENCE-SETUP VALIDATION PROMPT

ACTIVITY ID
${spec.id}

ACTIVITY TITLE
${spec.title}

EXPECTED START STATE
Prerequisite activity or activities ${spec.prerequisiteActivityIds.join(", ")} have been passed. User is registering one safe enrichment object reference photo before enrichment pass-gated activities.

VISIBLE CHECKPOINT
${spec.visibleCheckpoint}

RECORDING SETUP
- Quest type: REFERENCE_SETUP
- This activity is not a video pass gate.
${list(spec.setupInstructions)}

REQUIRED REFERENCES
${list(spec.requiredReferenceAssets)}
${list(spec.conditionalReferenceRules)}

AUDIO RULE
Audio is not required because ${spec.id} validates saved reference-photo setup only.

FPS
${spec.fps}

CLIP-DURATION RANGE
${spec.minClipSeconds}-${spec.maxClipSeconds} seconds; no user video is required for ${spec.id}.

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
Use the existing reference-photo validation flow only. Do not create an invented video verdict, invented reference-photo URL, or semantic accuracy claim. Missing evidence returns NEEDS_REVIEW, not FAIL. Owner confirmation is not evidence. Return strict JSON only with this exact shape when validation is requested: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}.`;
  }

  return `PAWS GEMINI 2.5 FLASH VERIFIER PROMPT

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

REQUIRED REFERENCES
${list(spec.requiredReferenceAssets)}
${list(spec.conditionalReferenceRules)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If required cue timing or audible evidence is missing or unusable, return NEEDS_REVIEW." : "Audio is optional. Visible vocalization may be noted only when audio is present; missing optional audio is not FAIL."}

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

CALM ALONE TIME SCOPE RULES
${list(calmScopeRules)}

JSON-ONLY RESPONSE INSTRUCTION
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, relevant action visible from start to finish, required saved references matching visible dog and objects, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;
};

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: false,
    ownerRequiredInFrame: spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")),
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: spec.requiredReferenceAssets.some((asset) => asset !== "DOG_PROFILE"),
    destinationRequiredInFrame: !spec.referenceSetupOnly,
    setupInstructions: spec.setupInstructions,
  };
  const prerequisiteActivityId = spec.prerequisiteActivityIds[0] ?? null;
  const activity: SeedActivity = {
    id: spec.id,
    category: "CALM_ALONE_TIME",
    sequenceNumber: spec.orderIndex,
    level: spec.level,
    title: spec.title,
    skillFamily: spec.skillFamily,
    questContentType: spec.referenceSetupOnly ? "REFERENCE_SETUP" : "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity verifies a narrow visible alone-time foundation without inferring feelings, anxiety status, or generalization outside the submitted evidence.",
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
    xpReward: spec.orderIndex >= 18 ? 140 : spec.orderIndex >= 14 ? 135 : 130,
    coinReward: 0,
    starsAvailable: 3,
    recommendedFps: spec.fps,
    minClipSeconds: spec.minClipSeconds,
    maxClipSeconds: spec.maxClipSeconds,
    vlmPrompt: promptFor(spec),
  };
  return { ...activity, orderIndex: spec.orderIndex, recordingSetup: recordingRequirements, audioRequired: spec.audioRequired, fps: spec.fps, prerequisiteActivityId, nextActivityId: spec.nextActivityId, orderedVisibleActions: spec.orderedVisibleActions, referenceSetupOnly: Boolean(spec.referenceSetupOnly) };
};

const safeZoneReferenceRule = "The safe-zone boundary must match saved TARGET_MAT or TARGET_CRATE depending on selected safe-zone type; if the selected safe-zone object cannot be matched confidently, return NEEDS_REVIEW.";

const SPECS: ActivitySpec[] = [
  {
    id: "CA011",
    title: "Settle on Mat: 1 Minute",
    orderIndex: 11,
    lessonGoal: "Teach the dog to remain inside the registered mat boundary in a visible resting posture for 60 seconds.",
    visibleCheckpoint: "Dog remains inside registered TARGET_MAT boundary in visible resting posture for at least 60 seconds.",
    tutorialSteps: ["Use the registered TARGET_MAT.", "Keep the full mat visible.", "Keep the dog visible continuously.", "Begin timing when the dog is inside the mat boundary.", "Record a continuous 60-second resting posture without restraint."],
    cameraAngle: "FULL_MAT_AND_CONTINUOUS_DOG_VIEW",
    setupInstructions: ["Full TARGET_MAT must be visible.", "Dog must be visible continuously.", "Clip must be long enough to score 60 seconds.", "No restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    conditionalReferenceRules: ["Visible mat must match saved TARGET_MAT photos; unclear mat identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 1,
    minClipSeconds: 65,
    maxClipSeconds: 85,
    passCriteria: ["Dog matches DOG_PROFILE.", "Mat matches TARGET_MAT.", "Dog stays inside boundary.", "Resting posture is visible.", "Continuous 60-second interval completes.", "No restraint occurs."],
    failCriteria: ["Dog exits early.", "Dog does not maintain resting posture.", "Owner physically restrains dog."],
    needsReviewCriteria: ["Mat cropped.", "Dog hidden.", "Duration unclear.", "Clip too short."],
    outOfScopeClaims: ["Do not claim anxiety improvement.", "Do not infer emotional state.", "Do not claim long-term alone-time tolerance."],
    safetyNotes: ["Use a stable mat.", "Keep the surface comfortable.", "Do not restrain the dog."],
    prerequisiteActivityIds: ["CA010"],
    nextActivityId: "CA012",
    orderedVisibleActions: ["Target dog is inside registered TARGET_MAT boundary.", "Full mat and dog remain visible continuously.", "Dog maintains visible resting posture.", "Continuous 60-second interval completes without restraint."],
    skillFamily: "Mat Settle",
    level: 2,
  },
  {
    id: "CA012",
    title: "Resting Posture on Mat: 30 Seconds",
    orderIndex: 12,
    lessonGoal: "Teach the dog to enter or remain inside the registered mat and maintain visible resting posture for 30 seconds.",
    visibleCheckpoint: "Dog enters or remains inside registered TARGET_MAT and maintains visible resting posture for at least 30 seconds.",
    tutorialSteps: ["Use the registered TARGET_MAT.", "Keep dog and full mat visible.", "Begin timing when the dog is inside the boundary.", "Record a continuous 30-second resting posture.", "Avoid restraint."],
    cameraAngle: "DOG_AND_FULL_MAT_CONTINUOUS_VIEW",
    setupInstructions: ["Dog and full TARGET_MAT must be visible.", "Posture and duration must be scorable.", "Clip must be long enough to score 30 seconds.", "No restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    conditionalReferenceRules: ["Visible mat must match saved TARGET_MAT photos; unclear mat identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 1,
    minClipSeconds: 35,
    maxClipSeconds: 50,
    passCriteria: ["Dog matches DOG_PROFILE.", "Mat is matched.", "Dog is inside boundary.", "Resting posture is visible continuously.", "30-second interval completes."],
    failCriteria: ["Dog exits early.", "Dog remains standing or pacing without resting posture.", "Restraint occurs."],
    needsReviewCriteria: ["Posture unclear.", "Mat cropped.", "Dog hidden.", "Duration unclear."],
    outOfScopeClaims: ["Do not infer emotional state.", "Do not claim comfort.", "Do not claim treatment success."],
    safetyNotes: ["Use a stable mat.", "Keep duration achievable."],
    prerequisiteActivityIds: ["CA011"],
    nextActivityId: "CA013",
    orderedVisibleActions: ["Target dog enters or is inside registered TARGET_MAT boundary.", "Dog and full mat remain visible.", "Dog maintains visible resting posture.", "Continuous 30-second interval completes."],
    skillFamily: "Mat Settle",
    level: 2,
  },
  {
    id: "CA013",
    title: "Enrichment-Object Setup",
    orderIndex: 13,
    lessonGoal: "Require the user to register one safe enrichment object before enrichment activities.",
    visibleCheckpoint: "A valid saved enrichment-object reference photo exists for one CUSTOM_OBJECT appropriate for supervised dog use.",
    tutorialSteps: ["Choose one supervised enrichment object such as a food puzzle, lick mat, safe chew, or stuffed toy.", "Register the object as CUSTOM_OBJECT.", "Keep the entire object visible in the photo.", "Use adequate lighting and avoid severe cropping.", "Avoid unsafe or unsuitable objects."],
    cameraAngle: "REFERENCE_PHOTO_ENRICHMENT_OBJECT",
    setupInstructions: ["Entire object must be visible.", "Lighting must be adequate.", "Object must not be severely cropped.", "Use one primary object per saved reference.", "Item should appear appropriate for supervised dog use."],
    requiredReferenceAssets: ["DOG_PROFILE", "CUSTOM_OBJECT"],
    conditionalReferenceRules: ["CUSTOM_OBJECT is required for the registered enrichment object.", "CA013 uses existing reference-photo validation flow rather than Gemini video review."],
    audioRequired: false,
    fps: 0,
    minClipSeconds: 0,
    maxClipSeconds: 0,
    passCriteria: ["DOG_PROFILE reference exists.", "Valid enrichment-object reference photo exists.", "CUSTOM_OBJECT reference is stored.", "Object appears appropriate for supervised dog use."],
    failCriteria: ["Do not use FAIL for missing photo evidence."],
    needsReviewCriteria: ["Image missing.", "Object severely cropped.", "Image blurry.", "Object identity unclear.", "Object appears unsafe or unsuitable."],
    outOfScopeClaims: ["Do not claim enrichment reduced anxiety.", "Do not claim treatment success.", "Do not infer emotional comfort."],
    safetyNotes: ["User remains responsible for choosing dog-safe enrichment.", "Avoid choking hazards.", "Supervise new items."],
    prerequisiteActivityIds: ["CA012"],
    nextActivityId: "CA014",
    orderedVisibleActions: ["User registers one enrichment CUSTOM_OBJECT reference photo.", "Entire object is visible.", "Photo has adequate lighting.", "Reference setup is stored for later matching."],
    skillFamily: "Enrichment Setup",
    level: 2,
    referenceSetupOnly: true,
  },
  {
    id: "CA014",
    title: "Interact with Enrichment Object",
    orderIndex: 14,
    lessonGoal: "Teach the dog to visibly interact with the registered enrichment object.",
    visibleCheckpoint: "Dog visibly interacts with registered enrichment CUSTOM_OBJECT.",
    tutorialSteps: ["Use the registered enrichment CUSTOM_OBJECT.", "Keep object, dog face, and dog front body visible.", "Begin before interaction starts.", "Record visible contact or manipulation.", "Do not force the object into the dog."],
    cameraAngle: "OBJECT_DOG_FACE_AND_FRONT_BODY",
    setupInstructions: ["Enrichment CUSTOM_OBJECT, dog face, and dog front body must be visible.", "Object must match saved reference photos.", "Interaction moment must be visible.", "No owner-forced interaction may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "CUSTOM_OBJECT"],
    conditionalReferenceRules: ["Enrichment object must match registered CUSTOM_OBJECT; unclear object identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Enrichment object matches registered reference.", "Dog visibly contacts or manipulates object.", "Interaction remains visible briefly.", "No owner-forced interaction occurs."],
    failCriteria: ["Dog does not interact.", "Wrong object is used.", "Owner physically pushes object into dog."],
    needsReviewCriteria: ["Object hidden.", "Dog face cropped.", "Object identity unclear.", "Interaction moment obscured."],
    outOfScopeClaims: ["Do not claim enrichment reduced anxiety.", "Do not infer emotional comfort.", "Do not claim treatment success."],
    safetyNotes: ["Use supervised dog-safe enrichment.", "Remove unsafe or damaged items."],
    prerequisiteActivityIds: ["CA013"],
    nextActivityId: "CA015",
    orderedVisibleActions: ["Target dog, dog face, front body, and registered enrichment CUSTOM_OBJECT are visible.", "Dog contacts or manipulates the object.", "Interaction remains visible briefly.", "Owner does not force interaction."],
    skillFamily: "Enrichment Interaction",
    level: 2,
  },
  {
    id: "CA015",
    title: "Stay in Safe Zone with Enrichment: 30 Seconds",
    orderIndex: 15,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary with registered enrichment visible for 30 seconds.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary with registered enrichment object visible for at least 30 seconds.",
    tutorialSteps: ["Use the registered safe zone and enrichment CUSTOM_OBJECT.", "Keep full safe-zone boundary visible.", "Keep enrichment object and dog visible continuously.", "Begin timing when dog is inside the zone.", "Record a 30-second interval without blocking exit."],
    cameraAngle: "FULL_SAFE_ZONE_ENRICHMENT_OBJECT_AND_DOG",
    setupInstructions: ["Full safe-zone boundary must be visible.", "Enrichment object must be visible.", "Dog must be visible continuously.", "No restraint or exit blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "CUSTOM_OBJECT"],
    conditionalReferenceRules: [safeZoneReferenceRule, "Registered enrichment object must match CUSTOM_OBJECT; unclear enrichment identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 1,
    minClipSeconds: 35,
    maxClipSeconds: 50,
    passCriteria: ["Dog matches DOG_PROFILE.", "Safe zone is matched.", "Enrichment object is matched.", "Dog remains inside zone for 30 seconds.", "No restraint occurs."],
    failCriteria: ["Dog exits safe zone before duration.", "Enrichment object is absent.", "Owner physically blocks exit."],
    needsReviewCriteria: ["Safe-zone boundary cropped.", "Object hidden.", "Dog hidden.", "Duration unclear."],
    outOfScopeClaims: ["Do not claim dog feels comfortable alone.", "Do not infer emotional calmness.", "Do not claim anxiety improvement."],
    safetyNotes: ["Use supervised dog-safe enrichment.", "Do not block exit.", "Remove unsafe items."],
    prerequisiteActivityIds: ["CA014"],
    nextActivityId: "CA016",
    orderedVisibleActions: ["Target dog is inside matched registered safe-zone boundary with registered enrichment CUSTOM_OBJECT visible.", "Full safe-zone boundary, dog, and enrichment object remain visible.", "Dog remains inside zone for at least 30 seconds.", "No restraint or exit blocking occurs."],
    skillFamily: "Safe-Zone Enrichment",
    level: 2,
  },
  {
    id: "CA016",
    title: "Owner Steps 1 Foot Away",
    orderIndex: 16,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner steps about 1 foot away.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner visibly steps approximately 1 foot away.",
    tutorialSteps: ["Use the registered safe zone.", "Keep dog, owner, and safe-zone boundary visible.", "Begin with dog inside the zone.", "Owner steps approximately 1 foot away.", "Reward after dog remains inside during the movement."],
    cameraAngle: "DOG_OWNER_AND_SAFE_ZONE_BOUNDARY",
    setupInstructions: ["Dog, owner, and safe-zone boundary must be visible.", "Owner step-away movement must be visible.", "Approximate distance must be scorable.", "No restraint or blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog starts inside zone.", "Owner step-away is visible.", "Dog remains inside zone during movement.", "No restraint occurs."],
    failCriteria: ["Dog exits zone immediately.", "Owner physically blocks dog.", "Owner movement is not performed."],
    needsReviewCriteria: ["Owner movement cropped.", "Boundary hidden.", "Dog hidden.", "Distance unclear."],
    outOfScopeClaims: ["Do not infer emotional calmness.", "Do not claim comfort.", "Do not claim alone-time tolerance."],
    safetyNotes: ["Keep the distance easy.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA015"],
    nextActivityId: "CA017",
    orderedVisibleActions: ["Target dog starts inside matched registered safe-zone boundary.", "Owner is visible near the safe zone.", "Owner steps approximately 1 foot away.", "Dog remains inside safe zone without restraint."],
    skillFamily: "Owner Distance",
    level: 2,
  },
  {
    id: "CA017",
    title: "Owner Steps 3 Feet Away",
    orderIndex: 17,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner steps about 3 feet away.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner visibly steps approximately 3 feet away.",
    tutorialSteps: ["Use the registered safe zone.", "Keep dog, owner, and safe zone visible.", "Begin with dog inside the zone.", "Owner moves approximately 3 feet away.", "Reward after dog remains inside during the movement."],
    cameraAngle: "DOG_OWNER_AND_SAFE_ZONE",
    setupInstructions: ["Dog, owner, and safe zone must be visible.", "Owner movement must be visible.", "Approximate 3-foot distance must be scorable.", "No physical blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog starts inside zone.", "Owner visibly moves approximately 3 feet away.", "Dog remains inside zone.", "No restraint occurs."],
    failCriteria: ["Dog exits zone during movement.", "Owner blocks dog physically.", "Required movement is not completed."],
    needsReviewCriteria: ["Distance unclear.", "Owner cropped.", "Zone boundary hidden.", "Dog hidden."],
    outOfScopeClaims: ["Do not infer alone-time tolerance.", "Do not infer emotional calmness.", "Do not claim treatment success."],
    safetyNotes: ["Increase distance gradually.", "Do not block exit."],
    prerequisiteActivityIds: ["CA016"],
    nextActivityId: "CA018",
    orderedVisibleActions: ["Target dog starts inside matched registered safe-zone boundary.", "Owner is visible near the safe zone.", "Owner moves approximately 3 feet away.", "Dog remains inside safe zone without restraint."],
    skillFamily: "Owner Distance",
    level: 2,
  },
  {
    id: "CA018",
    title: "Owner Walks to Doorway",
    orderIndex: 18,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner walks to an interior doorway.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner visibly walks to an interior doorway.",
    tutorialSteps: ["Use the registered safe zone and an interior doorway.", "Keep safe zone, dog, owner, and doorway visible.", "Begin with dog inside the zone.", "Owner walks to the doorway.", "Reward if dog remains inside zone without blocking."],
    cameraAngle: "SAFE_ZONE_DOG_OWNER_AND_DOORWAY",
    setupInstructions: ["Safe zone, dog, owner, and doorway must be visible.", "Owner route to doorway must be visible.", "Use an interior doorway.", "No physical blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog starts inside zone.", "Owner walks to doorway.", "Dog remains inside zone.", "No restraint occurs."],
    failCriteria: ["Dog exits zone and follows owner.", "Owner physically blocks dog.", "Doorway movement is not completed."],
    needsReviewCriteria: ["Doorway hidden.", "Dog cropped.", "Owner route hidden.", "Zone cropped."],
    outOfScopeClaims: ["Do not infer dog can remain alone.", "Do not infer emotional comfort.", "Do not claim long-term tolerance."],
    safetyNotes: ["Use an interior doorway.", "Do not test near unsafe exits.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA017"],
    nextActivityId: "CA019",
    orderedVisibleActions: ["Target dog starts inside matched registered safe-zone boundary.", "Owner, safe zone, dog, and interior doorway are visible.", "Owner walks to doorway.", "Dog remains inside safe zone without restraint."],
    skillFamily: "Owner Distance",
    level: 2,
  },
  {
    id: "CA019",
    title: "Owner Exits Frame: 1 Second",
    orderIndex: 19,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner briefly exits camera frame.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner exits camera frame for at least 1 second and then reappears.",
    tutorialSteps: ["Use the registered safe zone.", "Keep dog and safe zone visible continuously.", "Show owner before exit.", "Owner exits frame for at least 1 second and returns.", "Do not physically block the dog."],
    cameraAngle: "DOG_SAFE_ZONE_AND_OWNER_EXIT_RETURN",
    setupInstructions: ["Dog and safe zone must be visible continuously.", "Owner must be visible before exit and after return.", "Owner out-of-frame interval must be scorable.", "No restraint or blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Owner visibly exits frame.", "Owner remains out of frame at least 1 second.", "Dog remains inside safe zone.", "Owner returns visibly.", "No restraint occurs."],
    failCriteria: ["Dog exits safe zone before owner returns.", "Owner never exits frame.", "Owner physically blocks dog."],
    needsReviewCriteria: ["Dog hidden.", "Safe zone cropped.", "Owner exit timing unclear.", "Clip ends before owner returns."],
    outOfScopeClaims: ["Do not claim separation tolerance.", "Do not infer emotional state.", "Do not claim dog can be left alone."],
    safetyNotes: ["Keep the absence brief.", "Return before increasing difficulty.", "Do not block exit."],
    prerequisiteActivityIds: ["CA018"],
    nextActivityId: "CA020",
    orderedVisibleActions: ["Target dog starts inside matched registered safe-zone boundary.", "Owner is visible before exit.", "Owner exits camera frame for at least 1 second.", "Dog remains inside zone.", "Owner returns visibly."],
    skillFamily: "Owner Out of Frame",
    level: 2,
  },
  {
    id: "CA020",
    title: "Owner Exits Frame: 3 Seconds",
    orderIndex: 20,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner exits camera frame for 3 seconds.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner exits camera frame for at least 3 seconds and returns.",
    tutorialSteps: ["Use the registered safe zone.", "Keep dog and safe-zone boundary visible continuously.", "Show owner before exit.", "Owner exits frame for at least 3 seconds and returns.", "Do not physically block the dog."],
    cameraAngle: "DOG_SAFE_ZONE_BOUNDARY_AND_OWNER_EXIT_RETURN",
    setupInstructions: ["Dog and safe-zone boundary must be visible continuously.", "Owner must be visible before exit and after return.", "Owner out-of-frame interval must be scorable.", "No physical blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 10,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Owner exits frame.", "Owner remains out of frame at least 3 seconds.", "Dog remains inside zone.", "Owner returns visibly.", "No restraint occurs."],
    failCriteria: ["Dog exits zone before return.", "Owner does not remain out of frame for duration.", "Physical blocking occurs."],
    needsReviewCriteria: ["Timing unclear.", "Dog hidden.", "Zone cropped.", "Return not visible."],
    outOfScopeClaims: ["Do not infer emotional state.", "Do not claim separation tolerance.", "Do not claim safety outside submitted clip."],
    safetyNotes: ["Keep the absence brief.", "Do not use unsafe exits.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA019"],
    nextActivityId: "CA021",
    orderedVisibleActions: ["Target dog starts inside matched registered safe-zone boundary.", "Owner is visible before exit.", "Owner exits camera frame for at least 3 seconds.", "Dog remains inside zone.", "Owner returns visibly without restraint."],
    skillFamily: "Owner Out of Frame",
    level: 2,
  },
];

export const CA011_CA020: BatchActivity[] = SPECS.map(makeActivity);
