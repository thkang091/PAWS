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
- Owner or handler in frame required: ${spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")) ? "YES" : "NO"}
${list(spec.setupInstructions)}

REQUIRED SAVED REFERENCES
${list(spec.requiredReferenceAssets)}
${list(spec.conditionalReferenceRules)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If required cue timing is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is judged. Do not fail solely because audio is absent."}

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
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, required audio when applicable, relevant action visible from start to finish, required saved references matching visible dog and objects when applicable, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: ["CT009", "CT010"].includes(spec.id),
    ownerRequiredInFrame: spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")),
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: ["CT004", "CT005"].includes(spec.id),
    destinationRequiredInFrame: ["CT004", "CT005", "CT006", "CT007", "CT008", "CT010"].includes(spec.id),
    setupInstructions: spec.setupInstructions,
  };
  const prerequisiteActivityId = spec.prerequisiteActivityIds[0] ?? null;
  const activity: SeedActivity = {
    id: spec.id,
    category: "COOL_TRICKS_AND_GAMES",
    sequenceNumber: spec.orderIndex,
    level: spec.level,
    title: spec.title,
    skillFamily: spec.skillFamily,
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity verifies one visible trick behavior in the submitted clip without claiming generalized performance.",
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
    xpReward: spec.orderIndex >= 9 ? 115 : spec.orderIndex >= 4 ? 105 : 95,
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
    id: "CT001",
    title: "Hand Target",
    orderIndex: 1,
    lessonGoal: "Teach the dog to visibly touch the owner's open palm with the nose.",
    visibleCheckpoint: "Dog visibly touches owner's open palm with nose.",
    tutorialSteps: ["Present an open palm near the dog.", "Keep dog nose and palm visible.", "Begin recording before the dog moves to the palm.", "Reward after nose contact.", "Keep the repetition short."],
    cameraAngle: "CLOSE_NOSE_AND_PALM",
    setupInstructions: ["Dog nose and owner's open palm must be visible.", "Contact moment must remain unobscured.", "Do not press palm into the dog's nose."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 4,
    maxClipSeconds: 10,
    passCriteria: ["Dog matches DOG_PROFILE.", "Palm is visible.", "Nose contact is visible.", "No physical pushing occurs."],
    failCriteria: ["Dog does not contact palm.", "Owner presses palm into dog's nose."],
    needsReviewCriteria: ["Nose hidden.", "Palm cropped.", "Contact obscured."],
    outOfScopeClaims: ["Do not claim generalized targeting reliability.", "Do not infer cue understanding outside the clip."],
    safetyNotes: ["Keep hand movement gentle.", "Do not push into the dog's face."],
    prerequisiteActivityIds: [],
    nextActivityId: "CT002",
    orderedVisibleActions: ["Target dog and owner's open palm are visible before contact.", "Dog moves nose toward palm.", "Dog nose visibly contacts palm.", "No physical pushing occurs."],
    skillFamily: "Foundation Tricks",
    level: 1,
  },
  {
    id: "CT002",
    title: "Shake Paw",
    orderIndex: 2,
    lessonGoal: "Teach the dog to lift one front paw into or against the owner's visible hand.",
    visibleCheckpoint: "Dog lifts one front paw and places it into or against owner's visible hand.",
    tutorialSteps: ["Keep the dog's front paws and owner's hand visible.", "Offer the hand at an easy height.", "Begin recording before paw movement.", "Reward after paw-to-hand contact.", "Do not manually lift the paw."],
    cameraAngle: "CLOSE_FRONT_PAWS_AND_OWNER_HAND",
    setupInstructions: ["Dog front paws and owner's hand must be visible.", "Paw lift and contact must be visible.", "Owner must not forcibly lift the paw."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "One front paw visibly lifts.", "Paw contacts owner's hand.", "Contact occurs without owner forcibly lifting paw."],
    failCriteria: ["No paw lift occurs.", "Wrong body part contacts hand.", "Owner manually lifts paw."],
    needsReviewCriteria: ["Paw hidden.", "Hand cropped.", "Contact unclear."],
    outOfScopeClaims: ["Do not claim the dog knows a verbal shake cue.", "Do not claim generalized trick reliability."],
    safetyNotes: ["Keep the hand low and comfortable.", "Do not pull or twist the paw."],
    prerequisiteActivityIds: ["CT001"],
    nextActivityId: "CT003",
    orderedVisibleActions: ["Target dog, front paws, and owner's hand are visible.", "Dog lifts one front paw.", "Lifted paw contacts owner's hand.", "Owner does not manually lift or force paw movement."],
    skillFamily: "Paw Tricks",
    level: 1,
  },
  {
    id: "CT003",
    title: "High Five",
    orderIndex: 3,
    lessonGoal: "Teach the dog to lift one front paw to contact the owner's raised open palm.",
    visibleCheckpoint: "Dog lifts one front paw and visibly contacts owner's raised open palm.",
    tutorialSteps: ["Raise an open palm at a comfortable height.", "Keep raised palm and front paws visible.", "Begin recording before paw movement.", "Reward after paw-to-palm contact.", "Avoid grabbing the paw."],
    cameraAngle: "MEDIUM_RAISED_PALM_AND_FRONT_PAWS",
    setupInstructions: ["Raised palm and dog front paws must be visible.", "Contact moment must remain visible.", "Owner must not grab or move the paw into place."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Raised palm is visible.", "Front paw lifts.", "Paw contacts palm.", "No forced paw movement occurs."],
    failCriteria: ["No paw contact occurs.", "Owner grabs paw.", "Paw never reaches raised hand."],
    needsReviewCriteria: ["Paw cropped.", "Palm hidden.", "Contact moment unclear."],
    outOfScopeClaims: ["Do not claim reliable high-five on cue.", "Do not infer intent beyond visible contact."],
    safetyNotes: ["Use a comfortable palm height.", "Avoid pulling the paw upward."],
    prerequisiteActivityIds: ["CT002"],
    nextActivityId: "CT004",
    orderedVisibleActions: ["Target dog, raised palm, and front paws are visible.", "Dog lifts one front paw.", "Dog paw contacts the raised open palm.", "Owner does not grab or force the paw."],
    skillFamily: "Paw Tricks",
    level: 1,
  },
  {
    id: "CT004",
    title: "Paws Up",
    orderIndex: 4,
    lessonGoal: "Teach the dog to place both front paws on a registered platform or visible stable target surface.",
    visibleCheckpoint: "Dog places both front paws onto registered TARGET_PLATFORM or visible stable target surface.",
    tutorialSteps: ["Use a stable target surface.", "Register TARGET_PLATFORM when using the saved platform flow.", "Keep front paws and platform visible.", "Begin recording before paws move onto the target.", "Reward after both front paws contact the target."],
    cameraAngle: "MEDIUM_FRONT_PAWS_AND_PLATFORM",
    setupInstructions: ["Dog front paws and platform or stable target surface must be visible.", "Rear paws must remain visible enough to confirm they stay on the ground.", "If TARGET_PLATFORM is registered, object identity must be matchable.", "Do not lift the dog into position."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["TARGET_PLATFORM is required when paws-up uses a registered object or platform; if registered platform identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Platform matches TARGET_PLATFORM when registered.", "Both front paws visibly contact target.", "Rear paws remain on ground.", "No lifting or forcing occurs."],
    failCriteria: ["Fewer than two front paws contact target.", "Dog climbs fully onto target when front-paws-only is required.", "Owner lifts dog into position."],
    needsReviewCriteria: ["Paws hidden.", "Platform cropped.", "Object identity unclear.", "Dog body obscured."],
    outOfScopeClaims: ["Do not claim generalized platform confidence.", "Do not infer comfort with all surfaces."],
    safetyNotes: ["Use a stable non-slip target.", "Keep the target low and safe."],
    prerequisiteActivityIds: ["CT003"],
    nextActivityId: "CT005",
    orderedVisibleActions: ["Target dog, front paws, rear paws, and platform or target surface are visible.", "Dog approaches the target.", "Both front paws contact the target.", "Rear paws remain on the ground and owner does not lift the dog."],
    skillFamily: "Platform Tricks",
    level: 1,
  },
  {
    id: "CT005",
    title: "Paws-Up Hold: 3 Seconds",
    orderIndex: 5,
    lessonGoal: "Teach the dog to keep both front paws on a registered platform or visible stable target for at least 3 seconds.",
    visibleCheckpoint: "Dog keeps both front paws on registered TARGET_PLATFORM continuously for at least 3 seconds.",
    tutorialSteps: ["Use the same stable target setup.", "Keep platform and all paws visible.", "Begin timing once both front paws are on the target.", "Reward after a continuous 3-second hold.", "Do not hold the dog in place."],
    cameraAngle: "MEDIUM_ALL_PAWS_AND_PLATFORM",
    setupInstructions: ["Platform and all paws must be visible.", "If TARGET_PLATFORM is registered, object identity must be matchable.", "Hold duration must be visible.", "No physical restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["TARGET_PLATFORM is required when paws-up hold uses a registered object or platform; if registered platform identity is unclear, return NEEDS_REVIEW."],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 6,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Platform matches TARGET_PLATFORM when registered.", "Both front paws remain on target.", "3-second hold is completed.", "No physical restraint occurs."],
    failCriteria: ["Paw leaves target before 3 seconds.", "Owner holds dog in position."],
    needsReviewCriteria: ["Paw hidden.", "Duration unclear.", "Platform cropped.", "Clip too short."],
    outOfScopeClaims: ["Do not claim long-duration hold reliability.", "Do not infer comfort on all objects."],
    safetyNotes: ["Use a stable non-slip target.", "Keep duration short and easy."],
    prerequisiteActivityIds: ["CT004"],
    nextActivityId: "CT006",
    orderedVisibleActions: ["Target dog, platform, and all paws are visible.", "Both front paws are on the target.", "Both front paws remain on the target continuously for at least 3 seconds.", "Owner does not physically restrain the dog."],
    skillFamily: "Platform Tricks",
    level: 1,
  },
  {
    id: "CT006",
    title: "Spin Clockwise",
    orderIndex: 6,
    lessonGoal: "Teach the dog to complete one visible clockwise rotation.",
    visibleCheckpoint: "Dog completes one visible clockwise rotation.",
    tutorialSteps: ["Use a safe non-slip area.", "Keep the full dog body and path visible.", "Begin recording before the spin starts.", "Cue or lure one clockwise rotation.", "Reward after the full rotation completes."],
    cameraAngle: "WIDE_FULL_BODY_SPIN_PATH",
    setupInstructions: ["Full dog body and path must be visible.", "Clockwise direction must be judgeable from the camera angle.", "Recording must begin before rotation starts.", "No physical rotation may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins visible.", "Dog rotates clockwise.", "Full rotation completes.", "No physical forcing occurs."],
    failCriteria: ["Wrong rotation direction.", "Incomplete turn.", "Owner physically rotates dog."],
    needsReviewCriteria: ["Body cropped.", "Direction unclear.", "Rotation starts before clip."],
    outOfScopeClaims: ["Do not claim the dog knows a verbal spin cue.", "Do not infer performance in different spaces."],
    safetyNotes: ["Use a non-slip surface.", "Stop if the dog appears unsteady."],
    prerequisiteActivityIds: ["CT001"],
    nextActivityId: "CT007",
    orderedVisibleActions: ["Target dog and full spin path are visible before rotation.", "Dog starts the clockwise rotation.", "Dog completes one full clockwise rotation.", "Owner does not physically rotate the dog."],
    skillFamily: "Movement Tricks",
    level: 1,
  },
  {
    id: "CT007",
    title: "Spin Counterclockwise",
    orderIndex: 7,
    lessonGoal: "Teach the dog to complete one visible counterclockwise rotation.",
    visibleCheckpoint: "Dog completes one visible counterclockwise rotation.",
    tutorialSteps: ["Use a safe non-slip area.", "Keep full dog body and path visible.", "Begin recording before movement starts.", "Cue or lure one counterclockwise rotation.", "Reward after the full rotation completes."],
    cameraAngle: "WIDE_FULL_BODY_SPIN_PATH",
    setupInstructions: ["Full dog body and route must be visible.", "Counterclockwise direction must be judgeable from the camera angle.", "Recording must begin before rotation starts.", "No physical rotation may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog rotates counterclockwise.", "Full rotation completes.", "No physical forcing occurs."],
    failCriteria: ["Clockwise direction only.", "Incomplete turn.", "Owner physically rotates dog."],
    needsReviewCriteria: ["Route hidden.", "Direction unclear.", "Body cropped."],
    outOfScopeClaims: ["Do not claim the dog can spin both directions reliably.", "Do not infer cue understanding outside the clip."],
    safetyNotes: ["Use a non-slip surface.", "Avoid repeated fast spins."],
    prerequisiteActivityIds: ["CT006"],
    nextActivityId: "CT008",
    orderedVisibleActions: ["Target dog and full spin route are visible before rotation.", "Dog starts the counterclockwise rotation.", "Dog completes one full counterclockwise rotation.", "Owner does not physically rotate the dog."],
    skillFamily: "Movement Tricks",
    level: 1,
  },
  {
    id: "CT008",
    title: "Double Spin",
    orderIndex: 8,
    lessonGoal: "Teach the dog to complete two consecutive visible rotations in the configured direction.",
    visibleCheckpoint: "Dog completes two consecutive visible rotations in configured direction.",
    tutorialSteps: ["Choose the configured spin direction.", "Keep the full dog body and path visible continuously.", "Begin recording before the first spin starts.", "Cue or lure two consecutive rotations.", "Reward after the second full rotation completes."],
    cameraAngle: "WIDE_FULL_BODY_DOUBLE_SPIN_PATH",
    setupInstructions: ["Full dog body and path must be visible continuously.", "Configured direction must be judgeable.", "Both rotations must be countable.", "No physical rotation may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "First full rotation is visible.", "Second full rotation is visible.", "Both rotations are consecutive.", "Configured direction is followed.", "No forcing occurs."],
    failCriteria: ["Only one rotation completes.", "Wrong direction.", "Owner physically rotates dog."],
    needsReviewCriteria: ["Path cropped.", "Rotation count unclear.", "Clip starts mid-spin."],
    outOfScopeClaims: ["Do not claim fluent trick chains.", "Do not infer cue reliability outside the clip."],
    safetyNotes: ["Use a non-slip surface.", "Avoid repeated fast spins if the dog appears unsteady."],
    prerequisiteActivityIds: ["CT006", "CT007"],
    nextActivityId: "CT009",
    orderedVisibleActions: ["Target dog and full rotation path are visible before the first spin.", "Dog completes the first full rotation in the configured direction.", "Dog immediately completes the second full rotation in the configured direction.", "Owner does not physically rotate the dog."],
    skillFamily: "Movement Tricks",
    level: 1,
  },
  {
    id: "CT009",
    title: "Bow",
    orderIndex: 9,
    lessonGoal: "Teach the dog to lower the front body while the rear remains elevated in a visible bow posture.",
    visibleCheckpoint: "Dog lowers front body and elbows while rear remains elevated in a visible bow posture.",
    tutorialSteps: ["Use a side full-body camera angle.", "Keep elbows, torso, hips, and paws visible.", "Begin recording before the dog lowers.", "Reward after bow posture is visible briefly.", "Avoid pushing the dog into position."],
    cameraAngle: "SIDE_FULL_BODY_BOW",
    setupInstructions: ["Elbows, torso, hips, and paws must be visible.", "Rear elevation must be visible.", "Bow posture must be distinguishable from a down.", "No physical positioning may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Front body lowers.", "Elbows visibly lower.", "Rear remains elevated.", "Bow posture is visible briefly.", "No forcing occurs."],
    failCriteria: ["Dog lies fully down.", "Dog remains standing.", "Owner physically positions dog."],
    needsReviewCriteria: ["Hips hidden.", "Elbows cropped.", "Posture unclear."],
    outOfScopeClaims: ["Do not infer stretching or physical fitness.", "Do not claim a finished bow cue."],
    safetyNotes: ["Use a comfortable surface.", "Stop if the dog appears physically uncomfortable."],
    prerequisiteActivityIds: ["CT001"],
    nextActivityId: "CT010",
    orderedVisibleActions: ["Target dog is visible from the side with elbows, torso, hips, and paws in frame.", "Dog lowers the front body.", "Elbows lower while rear remains elevated.", "Bow posture is visible briefly without physical positioning."],
    skillFamily: "Movement Tricks",
    level: 1,
  },
  {
    id: "CT010",
    title: "Back Up: 2 Steps",
    orderIndex: 10,
    lessonGoal: "Teach the dog to move backward for at least two consecutive visible steps.",
    visibleCheckpoint: "Dog visibly moves backward for at least 2 consecutive steps.",
    tutorialSteps: ["Use a side or rear full-body view.", "Keep paws and path visible.", "Begin recording before backward movement starts.", "Cue or lure backward movement without pushing.", "Reward after at least two backward steps."],
    cameraAngle: "SIDE_OR_REAR_FULL_BODY_BACKUP",
    setupInstructions: ["Paws and path must be visible.", "Dog must remain facing generally forward while backing.", "Step count must be judgeable.", "No physical pushing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: ["No additional object reference is required."],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins visible.", "At least 2 backward steps occur.", "Dog remains facing generally forward.", "No physical pushing occurs."],
    failCriteria: ["Dog moves forward.", "Fewer than 2 backward steps occur.", "Owner pushes dog backward."],
    needsReviewCriteria: ["Paws hidden.", "Path cropped.", "Step count unclear.", "Dog turns around instead of backing up."],
    outOfScopeClaims: ["Do not claim formal backup reliability.", "Do not infer rear-end awareness outside the clip."],
    safetyNotes: ["Use a clear non-slip path.", "Do not push the dog backward."],
    prerequisiteActivityIds: ["CT001"],
    nextActivityId: "CT011",
    orderedVisibleActions: ["Target dog, paws, and backup path are visible before movement.", "Dog begins moving backward.", "At least two consecutive backward steps occur.", "Dog remains generally facing forward and owner does not push the dog."],
    skillFamily: "Movement Tricks",
    level: 1,
  },
];

export const CT001_CT010: BatchActivity[] = SPECS.map(makeActivity);
