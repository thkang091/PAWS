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
- Owner or handler in frame required: ${spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")) ? "YES" : "NO"}
${list(spec.setupInstructions)}

SAVED REFERENCES
${list(spec.requiredReferenceAssets)}

AUDIO RULE
${spec.audioRequired ? "Audio is required. If required cue timing is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is judged. Do not fail solely because audio is absent."}

FPS
${spec.fps}

CLIP RANGE
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
    hipsRequired: ["CT021", "CT022", "CT024", "CT025", "CT026", "CT027"].includes(spec.id),
    ownerRequiredInFrame: spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")),
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: ["CT021", "CT022", "CT023", "CT024"].includes(spec.id),
    destinationRequiredInFrame: ["CT021", "CT022", "CT023", "CT024", "CT025", "CT026", "CT027", "CT030"].includes(spec.id),
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
    xpReward: spec.orderIndex >= 28 ? 150 : spec.orderIndex >= 25 ? 145 : 140,
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
    id: "CT021",
    title: "Platform Pivot: Quarter Turn",
    orderIndex: 21,
    lessonGoal: "Teach the dog to keep front paws on the registered platform while rear paws pivot approximately a quarter turn.",
    visibleCheckpoint: "Dog keeps front paws on registered TARGET_PLATFORM while rear paws move around platform to complete approximately a quarter turn.",
    tutorialSteps: ["Use the registered TARGET_PLATFORM.", "Keep platform, all paws, and dog body visible.", "Begin recording before pivot starts.", "Reward after the rear paws complete approximately a quarter turn.", "Do not rotate the dog physically."],
    cameraAngle: "FULL_PLATFORM_ALL_PAWS_PIVOT",
    setupInstructions: ["TARGET_PLATFORM, all paws, and dog body must be visible.", "Visible platform must match saved TARGET_PLATFORM photos.", "Pivot angle must be judgeable.", "No physical rotation may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_PLATFORM"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Platform matches TARGET_PLATFORM.", "Front paws remain on platform.", "Rear paws visibly move around platform.", "Approximately quarter-turn pivot completes.", "No physical forcing occurs."],
    failCriteria: ["Front paws leave platform.", "Rear paws do not move around target.", "Pivot direction or amount is clearly incorrect.", "Owner physically rotates dog."],
    needsReviewCriteria: ["Paws hidden.", "Pivot angle unclear.", "Platform cropped.", "Dog body obscured."],
    outOfScopeClaims: ["Do not claim finished pivot fluency.", "Do not infer rear-end awareness outside the clip."],
    safetyNotes: ["Use a stable non-slip platform.", "Keep pivot movement slow and comfortable."],
    prerequisiteActivityIds: ["CT020"],
    nextActivityId: "CT022",
    orderedVisibleActions: ["Target dog, registered TARGET_PLATFORM, all paws, and body are visible before pivot.", "Front paws stay on the platform.", "Rear paws move around the platform.", "Approximately quarter-turn pivot completes without physical rotation."],
    skillFamily: "Platform Tricks",
    level: 3,
  },
  {
    id: "CT022",
    title: "Platform Pivot: Half Turn",
    orderIndex: 22,
    lessonGoal: "Teach the dog to keep front paws on the registered platform while rear paws pivot approximately a half turn.",
    visibleCheckpoint: "Dog keeps front paws on registered TARGET_PLATFORM while rear paws move around platform to complete approximately a half turn.",
    tutorialSteps: ["Use the registered platform.", "Keep platform and paws visible.", "Begin recording before pivot starts.", "Reward after approximately a half-turn pivot.", "Do not physically rotate the dog."],
    cameraAngle: "FULL_PLATFORM_AND_PAWS_PIVOT",
    setupInstructions: ["TARGET_PLATFORM and paws must be visible.", "Visible platform must match saved TARGET_PLATFORM photos.", "Pivot angle must be judgeable.", "No physical forcing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_PLATFORM"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Platform matches TARGET_PLATFORM.", "Front paws remain on target.", "Rear paws circle around platform.", "Approximately half-turn pivot completes.", "No forcing occurs."],
    failCriteria: ["Front paws leave target.", "Pivot is incomplete.", "Owner physically rotates dog."],
    needsReviewCriteria: ["Angle unclear.", "Paws hidden.", "Platform identity unclear."],
    outOfScopeClaims: ["Do not claim finished pivot fluency.", "Do not infer physical fitness."],
    safetyNotes: ["Use a stable non-slip platform.", "Stop if the dog appears physically uncomfortable."],
    prerequisiteActivityIds: ["CT021"],
    nextActivityId: "CT023",
    orderedVisibleActions: ["Target dog, registered TARGET_PLATFORM, and paws are visible before pivot.", "Front paws remain on target.", "Rear paws circle around platform.", "Approximately half-turn pivot completes without forcing."],
    skillFamily: "Platform Tricks",
    level: 3,
  },
  {
    id: "CT023",
    title: "Front Paws on Platform",
    orderIndex: 23,
    lessonGoal: "Teach the dog to voluntarily place both front paws on the registered platform while rear paws remain on the ground.",
    visibleCheckpoint: "Dog voluntarily places both front paws onto registered TARGET_PLATFORM while rear paws remain on ground.",
    tutorialSteps: ["Use the registered TARGET_PLATFORM.", "Keep platform and all paws visible.", "Begin recording before the dog steps onto the target.", "Reward after both front paws contact the platform.", "Do not lift the dog into position."],
    cameraAngle: "PLATFORM_AND_ALL_PAWS_VISIBLE",
    setupInstructions: ["TARGET_PLATFORM and all paws must be visible.", "Visible platform must match saved TARGET_PLATFORM photos.", "Rear paws must remain visible on the ground.", "No lifting or forcing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_PLATFORM"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "Platform matches TARGET_PLATFORM.", "Both front paws contact platform.", "Rear paws remain on ground.", "No lifting or forcing occurs."],
    failCriteria: ["Fewer than two front paws contact platform.", "Dog climbs fully onto target when front-paws-only is required.", "Owner lifts dog into position."],
    needsReviewCriteria: ["Paws hidden.", "Platform cropped.", "Target identity unclear."],
    outOfScopeClaims: ["Do not claim generalized platform confidence.", "Do not infer comfort with all surfaces."],
    safetyNotes: ["Use a stable low platform.", "Keep the surface non-slip."],
    prerequisiteActivityIds: ["CT004"],
    nextActivityId: "CT024",
    orderedVisibleActions: ["Target dog, registered TARGET_PLATFORM, and all paws are visible before entry.", "Dog voluntarily places both front paws on platform.", "Rear paws remain on the ground.", "Owner does not lift or force the dog."],
    skillFamily: "Platform Tricks",
    level: 3,
  },
  {
    id: "CT024",
    title: "Rear-Foot Target",
    orderIndex: 24,
    lessonGoal: "Teach the dog to place at least one rear paw on the registered platform or rear-foot target surface.",
    visibleCheckpoint: "Dog places at least one rear paw onto the registered TARGET_PLATFORM or rear-foot target surface.",
    tutorialSteps: ["Use the registered TARGET_PLATFORM or rear-foot target.", "Use a side or rear view.", "Keep rear paws and target visible.", "Begin recording before rear paw contact.", "Reward voluntary rear-paw contact without moving the paw."],
    cameraAngle: "SIDE_OR_REAR_REAR_PAWS_AND_TARGET",
    setupInstructions: ["Rear paws and TARGET_PLATFORM target must be visible.", "Visible target must match saved TARGET_PLATFORM photos.", "Rear-paw contact must be visible.", "No lifting or pushing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_PLATFORM"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Target matches TARGET_PLATFORM.", "Rear paw visibly contacts target.", "Contact is voluntary.", "No lifting or pushing occurs."],
    failCriteria: ["Only front paws touch target.", "No rear-paw contact occurs.", "Owner physically moves paw onto target."],
    needsReviewCriteria: ["Rear paws hidden.", "Target cropped.", "Contact unclear."],
    outOfScopeClaims: ["Do not infer mobility or fitness.", "Do not claim rear-foot targeting reliability outside the clip."],
    safetyNotes: ["Use a stable non-slip target.", "Keep movement slow and comfortable."],
    prerequisiteActivityIds: ["CT023"],
    nextActivityId: "CT025",
    orderedVisibleActions: ["Target dog, rear paws, and registered TARGET_PLATFORM are visible before contact.", "Dog voluntarily moves a rear paw toward target.", "At least one rear paw contacts the target.", "Owner does not lift or push the paw."],
    skillFamily: "Platform Tricks",
    level: 3,
  },
  {
    id: "CT025",
    title: "Crawl: 2 Feet",
    orderIndex: 25,
    lessonGoal: "Teach the dog to move forward in a low crawl posture for approximately 2 feet.",
    visibleCheckpoint: "Dog moves forward in a low crawl posture for approximately 2 feet.",
    tutorialSteps: ["Use a side full-body view.", "Keep torso, elbows, hips, and route visible.", "Begin recording before the crawl starts.", "Reward after approximately 2 feet of low forward travel.", "Do not drag or push the dog."],
    cameraAngle: "SIDE_FULL_BODY_LOW_CRAWL_ROUTE",
    setupInstructions: ["Torso, elbows, hips, and route must be visible.", "Dog must begin before or at the start of the crawl route.", "Approximate travel distance must be judgeable.", "No dragging or pushing may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog body remains low.", "Forward travel is visible.", "Approximately 2 feet are completed.", "No dragging or pushing occurs."],
    failCriteria: ["Dog stands and walks normally.", "Travel distance is clearly insufficient.", "Owner physically pulls dog."],
    needsReviewCriteria: ["Torso hidden.", "Route cropped.", "Distance unclear.", "Dog begins mid-crawl."],
    outOfScopeClaims: ["Do not infer physical fitness.", "Do not claim a finished crawl cue."],
    safetyNotes: ["Use a soft non-slip surface.", "Stop if the dog appears physically uncomfortable."],
    prerequisiteActivityIds: ["CT009"],
    nextActivityId: "CT026",
    orderedVisibleActions: ["Target dog, torso, elbows, hips, and crawl route are visible before movement.", "Dog moves forward while body remains low.", "Dog completes approximately 2 feet of forward crawl.", "Owner does not drag or push the dog."],
    skillFamily: "Floor Tricks",
    level: 3,
  },
  {
    id: "CT026",
    title: "Roll Over",
    orderIndex: 26,
    lessonGoal: "Teach the dog to complete one visible full roll across the body from a down or side posture.",
    visibleCheckpoint: "Dog begins in a down or side posture and completes one visible full roll across the body.",
    tutorialSteps: ["Use a soft non-slip surface.", "Keep full body and roll route visible.", "Begin recording before the roll starts.", "Reward after the full roll completes.", "Stop if the dog appears physically uncomfortable."],
    cameraAngle: "FULL_BODY_SIDE_VIEW_ROLL_ROUTE",
    setupInstructions: ["Full dog body and roll route must be visible.", "Dog must begin in visible down or side posture.", "Recording must begin before roll starts.", "No physical rolling may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins in visible down or side posture.", "Body rotates visibly.", "Dog completes full roll.", "No physical forcing occurs."],
    failCriteria: ["Roll is incomplete.", "Dog only lies on side.", "Owner physically rolls dog."],
    needsReviewCriteria: ["Body cropped.", "Roll begins before recording.", "Rotation hidden."],
    outOfScopeClaims: ["Do not infer physical fitness.", "Do not claim roll-over reliability outside the clip."],
    safetyNotes: ["Use soft non-slip surface.", "Stop if dog appears physically uncomfortable."],
    prerequisiteActivityIds: ["CT009"],
    nextActivityId: "CT027",
    orderedVisibleActions: ["Target dog begins in visible down or side posture with full body and route visible.", "Dog body rotates across the body.", "Dog completes one full roll.", "Owner does not physically roll the dog."],
    skillFamily: "Floor Tricks",
    level: 3,
  },
  {
    id: "CT027",
    title: "Play Dead",
    orderIndex: 27,
    lessonGoal: "Teach the dog to move into a visible side-lying posture and remain there briefly.",
    visibleCheckpoint: "Dog moves into a visible side-lying posture and remains there briefly.",
    tutorialSteps: ["Use a full-body side view.", "Keep torso and paws visible.", "Begin recording before the side-lying posture is established.", "Reward after side posture remains visible briefly.", "Do not physically position the dog."],
    cameraAngle: "FULL_BODY_SIDE_VIEW_SIDE_LYING",
    setupInstructions: ["Full dog body, torso, and paws must be visible.", "Recording must begin before side posture is established.", "Side-lying posture must be distinguishable from ordinary down.", "No physical positioning may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog transitions into side-lying posture.", "Posture remains visible briefly.", "No physical forcing occurs."],
    failCriteria: ["Dog remains standing or seated.", "Dog only enters ordinary down posture.", "Owner physically positions dog."],
    needsReviewCriteria: ["Body cropped.", "Side posture unclear.", "Clip begins after posture is already established."],
    outOfScopeClaims: ["Do not infer emotional state.", "Do not claim play-dead reliability outside the clip."],
    safetyNotes: ["Use a comfortable non-slip surface.", "Stop if the dog appears physically uncomfortable."],
    prerequisiteActivityIds: ["CT026"],
    nextActivityId: "CT028",
    orderedVisibleActions: ["Target dog is visible before side-lying posture is established.", "Dog transitions into side-lying posture.", "Side-lying posture remains visible briefly.", "Owner does not physically position the dog."],
    skillFamily: "Floor Tricks",
    level: 3,
  },
  {
    id: "CT028",
    title: "Wave",
    orderIndex: 28,
    lessonGoal: "Teach the dog to lift one front paw visibly without contacting the owner's hand.",
    visibleCheckpoint: "Dog lifts one front paw visibly without contacting the owner's hand.",
    tutorialSteps: ["Keep front paws visible.", "Begin recording before paw lift.", "Cue or lure a paw lift without hand contact.", "Reward after the paw remains off floor briefly.", "Do not manually lift the paw."],
    cameraAngle: "FRONT_PAWS_VISIBLE",
    setupInstructions: ["Front paws must be visible.", "Owner hand must not obscure the paw action.", "Paw lift must be distinguishable from shake contact.", "No forced lifting may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 12,
    passCriteria: ["Dog matches DOG_PROFILE.", "One front paw lifts visibly.", "Paw remains off floor briefly.", "No owner-hand contact is required.", "No forced lifting occurs."],
    failCriteria: ["Paw never lifts.", "Owner manually lifts paw.", "Behavior is only a shake with sustained hand contact."],
    needsReviewCriteria: ["Paw hidden.", "Owner hand obscures action.", "Lift unclear."],
    outOfScopeClaims: ["Do not claim a finished wave cue.", "Do not infer paw-target reliability outside the clip."],
    safetyNotes: ["Keep hand movement gentle.", "Do not pull the paw upward."],
    prerequisiteActivityIds: ["CT003"],
    nextActivityId: "CT029",
    orderedVisibleActions: ["Target dog and front paws are visible before lift.", "Dog lifts one front paw.", "Paw remains off floor briefly without required owner-hand contact.", "Owner does not manually lift the paw."],
    skillFamily: "Paw Tricks",
    level: 3,
  },
  {
    id: "CT029",
    title: "Cross Paws",
    orderIndex: 29,
    lessonGoal: "Teach the dog to place one front paw across or over the other front paw.",
    visibleCheckpoint: "Dog visibly places one front paw across or over the other front paw.",
    tutorialSteps: ["Use a close front-paw view.", "Keep both front paws visible.", "Begin recording before crossing occurs.", "Reward after the crossed position is visible briefly.", "Do not manually place the paw."],
    cameraAngle: "CLOSE_FRONT_PAW_VIEW",
    setupInstructions: ["Both front paws must be visible.", "Camera angle must show crossing clearly.", "Contact or crossing moment must be visible.", "No manual placement may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Both front paws are visible.", "One paw crosses over the other.", "Crossed position is visible briefly.", "No manual placement occurs."],
    failCriteria: ["Paws remain uncrossed.", "Owner physically places paw.", "Crossing cannot be established."],
    needsReviewCriteria: ["Paws cropped.", "Angle unclear.", "Contact moment hidden."],
    outOfScopeClaims: ["Do not claim cross-paws reliability.", "Do not infer cue understanding outside the clip."],
    safetyNotes: ["Use a comfortable surface.", "Do not twist or place the paw by hand."],
    prerequisiteActivityIds: ["CT028"],
    nextActivityId: "CT030",
    orderedVisibleActions: ["Target dog and both front paws are visible before crossing.", "One front paw moves across or over the other.", "Crossed position is visible briefly.", "Owner does not manually place the paw."],
    skillFamily: "Paw Tricks",
    level: 3,
  },
  {
    id: "CT030",
    title: "Peekaboo",
    orderIndex: 30,
    lessonGoal: "Teach the dog to move into a peekaboo position between or behind the owner's legs with head through the configured opening.",
    visibleCheckpoint: "Dog moves into a visible peekaboo position between or behind owner's legs with head appearing through the configured opening.",
    tutorialSteps: ["Choose the configured peekaboo opening.", "Keep owner legs, dog head, and dog path visible.", "Begin recording before dog enters position.", "Reward after final head position is visible.", "Do not pull or lift the dog into place."],
    cameraAngle: "OWNER_LEGS_DOG_HEAD_AND_PATH",
    setupInstructions: ["Owner legs, dog head, and dog path must be visible.", "Configured opening must be visible.", "Final head position must be clear.", "No physical pulling or lifting may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog moves into configured position.", "Dog head appears through expected opening.", "Final position is visible.", "No physical pulling or lifting occurs."],
    failCriteria: ["Dog remains outside position.", "Dog moves beside owner instead.", "Owner physically places dog."],
    needsReviewCriteria: ["Owner legs cropped.", "Dog path hidden.", "Head position unclear."],
    outOfScopeClaims: ["Do not claim generalized handler-position reliability.", "Do not infer emotional comfort."],
    safetyNotes: ["Keep stance stable and comfortable.", "Do not trap, pull, or lift the dog."],
    prerequisiteActivityIds: ["CT012"],
    nextActivityId: "CT031",
    orderedVisibleActions: ["Target dog starts outside peekaboo position with owner legs, dog head, and path visible.", "Dog moves into the configured position.", "Dog head appears through the expected opening.", "Final position is visible without pulling or lifting."],
    skillFamily: "Handler-Position Tricks",
    level: 3,
  },
];

export const CT021_CT030: BatchActivity[] = SPECS.map(makeActivity);
