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

const calmScopeRules = [
  "Verify only visible or audible evidence from the submitted clip.",
  "Do not infer that the dog feels calm, feels safe, is comfortable alone, has or does not have separation anxiety, treatment worked, the dog is ready to stay home alone, or behavior will generalize beyond submitted clip.",
  "Audible vocalization may be noted only when audio is present.",
];

const safeZoneReferenceRule = "Registered safe-zone reference is required: TARGET_MAT or TARGET_CRATE depending on selected safe-zone type; if the selected safe-zone boundary cannot be matched confidently, return NEEDS_REVIEW.";

const promptFor = (spec: ActivitySpec): string => `PAWS GEMINI 2.5 FLASH VERIFIER PROMPT

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
- Owner or handler in frame required: YES
${list(spec.setupInstructions)}

REQUIRED SAVED REFERENCES
${list(spec.requiredReferenceAssets)}
${list(spec.conditionalReferenceRules)}

AUDIO RULE
${spec.audioRequired ? "Audio is required when cue timing is judged. If required cue timing is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is judged. Audible vocalization may be noted only when audio is present; missing optional audio is not FAIL."}

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
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, required audio when applicable, relevant action visible from start to finish, required saved references matching visible dog and objects, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;

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
    category: "CALM_ALONE_TIME",
    sequenceNumber: spec.orderIndex,
    level: spec.level,
    title: spec.title,
    skillFamily: spec.skillFamily,
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity verifies a narrow visible calm-alone-time step without inferring feelings, anxiety status, or generalization outside the submitted evidence.",
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
    xpReward: spec.orderIndex >= 49 ? 185 : spec.orderIndex >= 46 ? 180 : 175,
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
    id: "CA041",
    title: "Pick Up Keys Without Leaving",
    orderIndex: 41,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner picks up keys and stays inside the room.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner visibly picks up keys and remains inside room.",
    tutorialSteps: ["Use the registered safe zone.", "Keep dog, safe zone, owner, and keys visible.", "Begin with dog inside the boundary.", "Owner visibly picks up keys.", "Owner remains inside room and does not block the dog."],
    cameraAngle: "DOG_SAFE_ZONE_OWNER_AND_KEYS",
    setupInstructions: ["Dog, safe zone, owner, and keys must be visible.", "Owner hand and key pickup must be visible.", "Owner must remain inside room.", "No physical blocking or restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule, "CUSTOM_OBJECT is required only if keys are registered as a reference object; unclear registered key identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 8,
    maxClipSeconds: 18,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog starts inside safe zone.", "Owner visibly picks up keys.", "Owner remains inside room.", "Dog remains inside safe-zone boundary.", "No restraint occurs."],
    failCriteria: ["Dog exits safe zone during key pickup.", "Owner physically blocks dog.", "Key pickup does not occur."],
    needsReviewCriteria: ["Keys hidden.", "Owner hand cropped.", "Safe-zone boundary hidden.", "Dog cropped.", "Action unclear."],
    outOfScopeClaims: ["Do not infer departure tolerance.", "Do not infer emotional state.", "Do not claim behavior generalizes."],
    safetyNotes: ["Keep keys away from chewing.", "Do not block the dog.", "Use a safe interior setup."],
    prerequisiteActivityIds: ["CA033"],
    nextActivityId: "CA042",
    orderedVisibleActions: ["Target dog starts inside matched registered safe-zone boundary.", "Owner and keys are visible.", "Owner visibly picks up keys and remains inside room.", "Dog remains inside boundary without restraint."],
    skillFamily: "Departure Signals",
    level: 5,
  },
  {
    id: "CA042",
    title: "Put On Shoes Without Leaving",
    orderIndex: 42,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner puts on or adjusts shoes and stays inside the room.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner visibly puts on or adjusts shoes and remains inside room.",
    tutorialSteps: ["Use the registered safe zone.", "Keep dog, owner, shoes, and safe-zone boundary visible.", "Begin with dog inside the boundary.", "Owner visibly puts on or adjusts shoes.", "Owner remains inside room and does not block the dog."],
    cameraAngle: "DOG_OWNER_SHOES_AND_SAFE_ZONE_BOUNDARY",
    setupInstructions: ["Dog, owner, shoes, and safe-zone boundary must be visible.", "Owner feet and shoe action must be visible.", "Owner must remain inside room.", "No physical blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE"],
    conditionalReferenceRules: [safeZoneReferenceRule, "CUSTOM_OBJECT is required only if shoes are registered as a reference object; unclear registered shoe identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Dog begins inside safe zone.", "Owner visibly puts on or adjusts shoes.", "Dog remains inside boundary.", "No restraint occurs."],
    failCriteria: ["Dog exits safe zone.", "Owner blocks dog physically.", "Shoe action does not occur."],
    needsReviewCriteria: ["Owner feet cropped.", "Shoes hidden.", "Safe zone cropped.", "Dog hidden."],
    outOfScopeClaims: ["Do not infer emotional state.", "Do not claim departure tolerance.", "Do not claim treatment success."],
    safetyNotes: ["Keep shoes out of chewing range.", "Do not block the dog.", "Keep setup safe."],
    prerequisiteActivityIds: ["CA041"],
    nextActivityId: "CA043",
    orderedVisibleActions: ["Target dog starts inside matched safe-zone boundary.", "Owner and shoes are visible.", "Owner visibly puts on or adjusts shoes.", "Dog remains inside boundary without restraint."],
    skillFamily: "Departure Signals",
    level: 5,
  },
  {
    id: "CA043",
    title: "Touch Door Handle Without Leaving",
    orderIndex: 43,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner touches the registered doorway handle area without leaving.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner walks to registered doorway and visibly touches door handle without leaving.",
    tutorialSteps: ["Use the registered safe zone and TARGET_DOORWAY.", "Keep dog, owner, safe zone, doorway, and handle area visible.", "Begin with dog inside boundary.", "Owner touches the door handle without leaving the room.", "Do not physically block the dog."],
    cameraAngle: "DOG_OWNER_SAFE_ZONE_DOORWAY_AND_HANDLE",
    setupInstructions: ["Dog, owner, safe zone, doorway, and handle area must be visible.", "TARGET_DOORWAY must match saved reference photos.", "Owner hand and handle touch must be visible.", "Owner must not leave room."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Doorway matches TARGET_DOORWAY.", "Dog remains inside safe zone.", "Owner visibly touches handle.", "Owner does not leave room.", "No restraint occurs."],
    failCriteria: ["Dog exits zone.", "Owner physically blocks dog.", "Handle-touch step does not occur."],
    needsReviewCriteria: ["Doorway identity unclear.", "Handle hidden.", "Owner hand cropped.", "Dog hidden.", "Zone boundary cropped."],
    outOfScopeClaims: ["Do not infer alone-time readiness.", "Do not infer emotional state.", "Do not claim behavior generalizes."],
    safetyNotes: ["Use an interior doorway.", "Do not practice near unsafe exits.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA042"],
    nextActivityId: "CA044",
    orderedVisibleActions: ["Target dog starts inside matched safe-zone boundary.", "Owner and registered TARGET_DOORWAY are visible.", "Owner visibly touches door handle area without leaving room.", "Dog remains inside boundary without restraint."],
    skillFamily: "Doorway Departure Signals",
    level: 5,
  },
  {
    id: "CA044",
    title: "Open Door -> Close Door -> Remain Inside",
    orderIndex: 44,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner opens and closes the registered interior door without exiting.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner opens registered interior door and closes it without exiting.",
    tutorialSteps: ["Use the registered safe zone and TARGET_DOORWAY.", "Keep dog, owner, doorway, door motion, and safe zone visible.", "Begin with dog inside boundary.", "Owner opens and closes the door without exiting.", "Do not physically block the dog."],
    cameraAngle: "DOG_OWNER_DOORWAY_DOOR_MOTION_AND_SAFE_ZONE",
    setupInstructions: ["Dog, owner, doorway, door motion, and safe zone must be visible.", "TARGET_DOORWAY must match saved reference photos.", "Open-close sequence must be visible.", "Owner must remain inside room."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 10,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Doorway matches TARGET_DOORWAY.", "Owner opens door.", "Owner closes door.", "Owner remains inside room.", "Dog remains inside safe zone.", "No restraint occurs."],
    failCriteria: ["Dog exits safe zone during door motion.", "Owner blocks dog physically.", "Open-close sequence incomplete."],
    needsReviewCriteria: ["Door motion hidden.", "Doorway cropped.", "Dog hidden.", "Safe-zone boundary unclear."],
    outOfScopeClaims: ["Do not claim departure desensitization success.", "Do not infer emotional state.", "Do not claim treatment worked."],
    safetyNotes: ["Use an interior door.", "Keep door movement gentle.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA043"],
    nextActivityId: "CA045",
    orderedVisibleActions: ["Target dog starts inside matched safe-zone boundary.", "Owner and registered TARGET_DOORWAY are visible.", "Owner opens and closes door without exiting.", "Dog remains inside boundary without restraint."],
    skillFamily: "Doorway Departure Signals",
    level: 5,
  },
  {
    id: "CA045",
    title: "Open Door -> Brief Step-Out",
    orderIndex: 45,
    lessonGoal: "Teach the dog to remain inside the registered safe-zone boundary while owner briefly steps out through the registered interior door and returns.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary while owner opens registered interior door, briefly steps out, and visibly returns.",
    tutorialSteps: ["Use the registered safe zone and TARGET_DOORWAY.", "Keep dog, safe zone, doorway, and owner visible before exit and after return.", "Begin with dog inside boundary.", "Owner opens door, briefly steps out, and returns.", "Do not physically block the dog."],
    cameraAngle: "DOG_SAFE_ZONE_DOORWAY_OWNER_STEP_OUT_RETURN",
    setupInstructions: ["Dog, safe zone, doorway, and owner must be visible before exit and after return.", "TARGET_DOORWAY must match saved reference photos.", "Owner step-out and return must be visible.", "No physical blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY"],
    conditionalReferenceRules: [safeZoneReferenceRule],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 12,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Doorway matches TARGET_DOORWAY.", "Owner opens door.", "Owner briefly steps out.", "Owner returns visibly.", "Dog remains inside safe zone.", "No restraint occurs."],
    failCriteria: ["Dog exits safe zone.", "Owner does not step out.", "Owner does not return.", "Owner physically blocks dog."],
    needsReviewCriteria: ["Doorway hidden.", "Owner return cropped.", "Safe zone cropped.", "Dog hidden.", "Timing unclear."],
    outOfScopeClaims: ["Do not infer long-term alone-time tolerance.", "Do not infer emotional state.", "Do not claim dog is ready to stay home alone."],
    safetyNotes: ["Use an interior doorway.", "Keep step-out brief.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA044"],
    nextActivityId: "CA046",
    orderedVisibleActions: ["Target dog starts inside matched safe-zone boundary.", "Owner opens registered doorway.", "Owner briefly steps out.", "Owner visibly returns.", "Dog remains inside safe zone without blocking."],
    skillFamily: "Doorway Departure Signals",
    level: 5,
  },
  {
    id: "CA046",
    title: "Mat -> Owner Exits -> Owner Returns",
    orderIndex: 46,
    lessonGoal: "Teach the dog to remain on the registered mat while owner exits frame for the configured interval and returns.",
    visibleCheckpoint: "Dog remains on registered TARGET_MAT while owner exits frame for configured interval and returns.",
    tutorialSteps: ["Use the registered TARGET_MAT.", "Keep full mat and dog visible continuously.", "Show owner before exit and after return.", "Owner exits frame for configured interval.", "Owner returns visibly without blocking the dog."],
    cameraAngle: "FULL_MAT_DOG_OWNER_EXIT_RETURN",
    setupInstructions: ["Full TARGET_MAT and dog must be visible continuously.", "Owner must be visible before exit and after return.", "Configured absence interval must be scorable.", "No physical blocking may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_MAT"],
    conditionalReferenceRules: ["Visible mat must match saved TARGET_MAT photos; unclear mat identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 15,
    maxClipSeconds: 40,
    passCriteria: ["Dog matches DOG_PROFILE.", "Mat matches TARGET_MAT.", "Dog remains inside mat boundary.", "Owner exits frame.", "Configured absence interval completes.", "Owner returns visibly.", "No restraint occurs."],
    failCriteria: ["Dog exits mat before return.", "Owner returns before configured interval.", "Owner physically blocks dog."],
    needsReviewCriteria: ["Mat cropped.", "Dog hidden.", "Owner exit or return unclear.", "Timing unclear."],
    outOfScopeClaims: ["Do not claim dog feels comfortable alone.", "Do not infer emotional state.", "Do not claim behavior generalizes."],
    safetyNotes: ["Use a stable mat.", "Keep absence brief.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA028", "CA039"],
    nextActivityId: "CA047",
    orderedVisibleActions: ["Target dog starts on matched registered TARGET_MAT.", "Owner is visible before exit.", "Owner exits frame for configured interval.", "Dog remains inside mat boundary.", "Owner returns visibly without restraint."],
    skillFamily: "Mat Departure Routine",
    level: 5,
  },
  {
    id: "CA047",
    title: "Crate -> Owner Exits -> Owner Returns",
    orderIndex: 47,
    lessonGoal: "Teach the dog to remain inside the registered open crate while owner exits frame for the configured interval and returns.",
    visibleCheckpoint: "Dog remains inside registered open TARGET_CRATE while owner exits frame for configured interval and returns.",
    tutorialSteps: ["Use the registered TARGET_CRATE.", "Keep crate entrance, open door, and dog visible continuously.", "Show owner before exit and after return.", "Owner exits frame for configured interval.", "Crate door remains open throughout."],
    cameraAngle: "CRATE_OPEN_DOOR_DOG_OWNER_EXIT_RETURN",
    setupInstructions: ["Crate entrance and open door must be visible.", "Dog must be visible continuously.", "Owner must be visible before exit and after return.", "Configured absence interval must be scorable.", "No blocking or restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_CRATE"],
    conditionalReferenceRules: ["Visible crate must match saved TARGET_CRATE photos; unclear crate identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 15,
    maxClipSeconds: 40,
    passCriteria: ["Dog matches DOG_PROFILE.", "Crate matches TARGET_CRATE.", "Crate door remains open.", "Dog remains inside crate.", "Owner exits frame.", "Configured absence interval completes.", "Owner returns visibly.", "No blocking or restraint occurs."],
    failCriteria: ["Dog exits crate before return.", "Crate door closes.", "Owner physically blocks exit.", "Owner returns too early."],
    needsReviewCriteria: ["Crate entrance hidden.", "Door position unclear.", "Dog hidden.", "Timing unclear.", "Owner return cropped."],
    outOfScopeClaims: ["Do not claim crate comfort.", "Do not infer emotional safety.", "Do not claim alone-time readiness."],
    safetyNotes: ["Keep crate door open.", "Do not block exit.", "Return before increasing difficulty."],
    prerequisiteActivityIds: ["CA040"],
    nextActivityId: "CA048",
    orderedVisibleActions: ["Target dog starts inside matched registered open TARGET_CRATE.", "Owner is visible before exit.", "Owner exits frame for configured interval.", "Dog remains inside crate with door open.", "Owner returns visibly without blocking."],
    skillFamily: "Crate Departure Routine",
    level: 5,
  },
  {
    id: "CA048",
    title: "Enrichment -> Owner Exits -> Owner Returns",
    orderIndex: 48,
    lessonGoal: "Teach the dog to remain inside the registered safe zone with enrichment visible while owner exits frame for the configured interval and returns.",
    visibleCheckpoint: "Dog remains inside registered safe-zone boundary with registered enrichment object visible while owner exits frame for configured interval and returns.",
    tutorialSteps: ["Use registered enrichment CUSTOM_OBJECT and selected safe zone.", "Keep dog, safe zone, enrichment object, and owner visible before exit and after return.", "Begin with dog inside boundary.", "Owner exits frame for configured interval.", "Owner returns visibly without blocking."],
    cameraAngle: "DOG_SAFE_ZONE_ENRICHMENT_OWNER_EXIT_RETURN",
    setupInstructions: ["Dog, safe zone, enrichment object, and owner must be visible before exit and after return.", "Configured interval must be scorable.", "Object identity and safe-zone boundary must be visible.", "No restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "CUSTOM_OBJECT"],
    conditionalReferenceRules: [safeZoneReferenceRule, "Registered enrichment object must match saved CUSTOM_OBJECT photos; unclear enrichment identity returns NEEDS_REVIEW."],
    audioRequired: false,
    fps: 2,
    minClipSeconds: 15,
    maxClipSeconds: 40,
    passCriteria: ["Dog matches DOG_PROFILE.", "Enrichment object matches saved reference.", "Safe zone matches registered reference.", "Dog remains inside boundary.", "Owner exits frame.", "Configured interval completes.", "Owner returns visibly.", "No restraint occurs."],
    failCriteria: ["Dog exits safe zone before return.", "Enrichment object is absent.", "Wrong object is used.", "Owner physically blocks dog.", "Owner returns too early."],
    needsReviewCriteria: ["Enrichment object hidden.", "Safe zone cropped.", "Dog hidden.", "Timing unclear.", "Owner return hidden."],
    outOfScopeClaims: ["Do not claim anxiety improvement.", "Do not infer emotional state.", "Do not claim treatment worked."],
    safetyNotes: ["Use supervised dog-safe enrichment.", "Remove unsafe items.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA038"],
    nextActivityId: "CA049",
    orderedVisibleActions: ["Target dog starts inside matched safe-zone boundary with registered enrichment CUSTOM_OBJECT visible.", "Owner is visible before exit.", "Owner exits frame for configured interval.", "Dog remains inside boundary with enrichment visible.", "Owner returns visibly without restraint."],
    skillFamily: "Enrichment Departure Routine",
    level: 5,
  },
  {
    id: "CA049",
    title: "Safe-Zone Departure Routine",
    orderIndex: 49,
    lessonGoal: "Verify a narrow visible safe-zone departure routine with entry, hold, departure signal, brief exit, return, and continued boundary hold.",
    visibleCheckpoint: "Dog completes a visible routine: enters registered safe zone, holds position inside zone, owner performs departure signal, owner briefly exits frame or doorway, owner returns, and dog remains inside zone throughout required interval.",
    tutorialSteps: ["Use the registered safe zone and TARGET_DOORWAY when doorway is relevant.", "Keep safe zone, dog, owner, and doorway visible when relevant.", "Record voluntary entry and hold.", "Owner picks up keys or touches doorway, briefly exits, and returns.", "Dog remains inside boundary throughout."],
    cameraAngle: "SAFE_ZONE_DOG_OWNER_AND_DOORWAY_ROUTINE",
    setupInstructions: ["Safe zone, dog, owner, and doorway must be visible when relevant.", "Audio is optional unless cue timing is judged.", "Use 1-3 FPS depending on configured duration.", "Departure signal, brief exit, and return must be visible.", "No restraint may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY"],
    conditionalReferenceRules: [safeZoneReferenceRule, "CUSTOM_OBJECT is required if keys are registered as a reference object."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 20,
    maxClipSeconds: 50,
    passCriteria: ["Dog matches DOG_PROFILE.", "Registered safe zone is matched.", "Voluntary entry is visible.", "Hold interval is visible.", "Owner departure signal is visible.", "Brief exit is visible.", "Return is visible.", "Dog remains inside boundary.", "No restraint occurs."],
    failCriteria: ["Dog exits safe zone before return.", "Owner physically blocks dog.", "Required departure sequence incomplete.", "Registered safe zone mismatch."],
    needsReviewCriteria: ["Safe-zone boundary cropped.", "Owner exit hidden.", "Owner return hidden.", "Dog hidden.", "Sequence unclear.", "Timing unclear."],
    outOfScopeClaims: ["Do not claim dog is ready to stay alone.", "Do not infer emotional state.", "Do not claim behavior generalizes."],
    safetyNotes: ["Use a safe interior routine.", "Keep exit brief.", "Do not block the dog."],
    prerequisiteActivityIds: ["CA045", "CA046", "CA047"],
    nextActivityId: "CA050",
    orderedVisibleActions: ["Target dog voluntarily enters matched registered safe zone.", "Dog holds position inside zone.", "Owner performs departure signal such as keys or doorway touch.", "Owner briefly exits frame or doorway and returns.", "Dog remains inside boundary throughout without restraint."],
    skillFamily: "Final Departure Routine",
    level: 5,
  },
  {
    id: "CA050",
    title: "Calm-Alone-Time Final Routine",
    orderIndex: 50,
    lessonGoal: "Verify a clearly segmented final calm-alone-time routine using selected registered safe-zone, doorway, and optional enrichment components.",
    visibleCheckpoint: "A clearly segmented single clip or short clip set includes voluntary safe-zone or open-crate entry, visible hold, owner departure signal, brief owner exit, owner return, dog remaining inside registered zone through required interval, and optional enrichment when configured.",
    tutorialSteps: ["Use a clearly segmented single clip or short clip set.", "Keep DOG_PROFILE evidence and selected registered safe-zone references visible.", "Include doorway sequence when configured.", "Include registered enrichment CUSTOM_OBJECT when configured.", "Keep maximum combined duration to 60 seconds."],
    cameraAngle: "SEGMENTED_CALM_ALONE_TIME_FINAL_ROUTINE",
    setupInstructions: ["Clearly segmented single clip or short clip set is required.", "DOG_PROFILE is always required.", "TARGET_MAT or TARGET_CRATE is required.", "TARGET_DOORWAY is required when doorway sequence is used.", "Registered CUSTOM_OBJECT is required when enrichment object is used.", "Use component-appropriate FPS.", "Maximum combined duration is 60 seconds."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_DOORWAY"],
    conditionalReferenceRules: [safeZoneReferenceRule, "CUSTOM_OBJECT is required when enrichment component is included.", "TARGET_DOORWAY must match saved reference photos when doorway sequence is used."],
    audioRequired: false,
    fps: 3,
    minClipSeconds: 20,
    maxClipSeconds: 60,
    passCriteria: ["Dog matches DOG_PROFILE.", "Every required visible segment passes.", "Registered reference objects match.", "Dog identity remains clear.", "Dog remains inside registered boundary during required interval.", "No forced entry occurs.", "No physical blocking occurs.", "No restraint occurs."],
    failCriteria: ["Dog exits zone before required interval ends.", "Dog is forced into zone.", "Owner blocks dog physically.", "Required departure or return segment clearly fails.", "Wrong registered object is used."],
    needsReviewCriteria: ["Any required segment missing.", "Dog hidden.", "Safe-zone boundary cropped.", "Object identity unclear.", "Owner exit or return hidden.", "Sequence ambiguous.", "Required audio unclear."],
    outOfScopeClaims: ["Do not claim dog feels calm.", "Do not claim dog is cured.", "Do not claim dog no longer has separation anxiety.", "Do not claim dog is safe to leave alone indefinitely.", "Do not claim dog's behavior will generalize outside submitted clips."],
    safetyNotes: ["Use only safe interior setups.", "Keep absence brief.", "Do not force entry.", "Do not block or restrain the dog."],
    prerequisiteActivityIds: ["CA049"],
    nextActivityId: null,
    orderedVisibleActions: ["Target dog completes voluntary safe-zone or open-crate entry.", "Dog holds inside matched registered zone.", "Owner performs visible departure signal.", "Owner briefly exits and returns.", "Dog remains inside registered zone through required interval.", "Optional enrichment component is visible when configured."],
    skillFamily: "Final Calm-Alone Routine",
    level: 5,
  },
];

export const CA041_CA050: BatchActivity[] = SPECS.map(makeActivity);
