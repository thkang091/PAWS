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

AUDIO RULE
${spec.audioRequired ? "Audio is required. If the drop cue or required cue timing is missing or unusable, return NEEDS_REVIEW." : "Audio is optional unless cue timing is judged. If a spoken toy-name cue or cue timing is part of the submitted attempt and audio is unclear, return NEEDS_REVIEW."}

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
Return strict JSON only with this exact shape: {"activityId":"string","verdict":"PASS | FAIL | NEEDS_REVIEW","confidence":0.0,"observations":["string"],"missingEvidence":["string"],"retryInstruction":"string | null"}. PASS requires the visible checkpoint, required audio when applicable, relevant action visible from start to finish, required saved references matching visible dog and objects, and target dog matching DOG_PROFILE photos. Missing evidence is never FAIL. Owner confirmation is not evidence. Do not fabricate observations, reference matches, confidence, URLs, verdicts, or semantic accuracy.`;

const makeActivity = (spec: ActivitySpec): BatchActivity => {
  const recordingRequirements = {
    cameraAngle: spec.cameraAngle,
    fullDogBodyRequired: true,
    pawsRequired: true,
    hipsRequired: false,
    ownerRequiredInFrame: spec.setupInstructions.some((item) => item.toLowerCase().includes("owner")),
    audioRequired: spec.audioRequired,
    targetObjectRequiredInFrame: true,
    destinationRequiredInFrame: true,
    setupInstructions: spec.setupInstructions,
  };
  const prerequisiteActivityId = spec.prerequisiteActivityIds[0] ?? null;
  const activity: SeedActivity = {
    id: spec.id,
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    sequenceNumber: spec.orderIndex,
    level: spec.level,
    title: spec.title,
    skillFamily: spec.skillFamily,
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: spec.lessonGoal,
    whyItMatters: "This activity verifies one visible household helper task without claiming generalized assistance outside the submitted clip.",
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
  return { ...activity, orderIndex: spec.orderIndex, recordingSetup: recordingRequirements, audioRequired: spec.audioRequired, fps: spec.fps, prerequisiteActivityId, nextActivityId: spec.nextActivityId, orderedVisibleActions: spec.orderedVisibleActions };
};

const SPECS: ActivitySpec[] = [
  {
    id: "HH011",
    title: "Drop Toy Near Owner",
    orderIndex: 11,
    lessonGoal: "Teach the dog to release the registered toy near owner after an audible drop cue.",
    visibleCheckpoint: "Dog reaches owner area while holding registered TARGET_TOY and visibly releases toy near owner after audible drop cue.",
    tutorialSteps: ["Use the registered TARGET_TOY.", "Keep owner, dog mouth, toy, and drop area visible.", "Begin recording before the dog reaches owner area.", "Give one audible drop cue.", "Reward after the toy is released near owner without forced removal."],
    cameraAngle: "OWNER_DOG_MOUTH_TOY_AND_DROP_AREA",
    setupInstructions: ["Owner, dog mouth, TARGET_TOY, and drop area must be visible.", "Visible toy must match saved TARGET_TOY photos.", "Audio is required for the drop cue.", "No forced removal may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: true,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Dog reaches owner area while holding toy.", "Drop cue is audible.", "Toy visibly releases near owner.", "No forced removal occurs."],
    failCriteria: ["No release occurs.", "Toy is released far from owner area.", "Owner forcibly removes toy.", "Wrong toy is used."],
    needsReviewCriteria: ["Dog mouth hidden.", "Release hidden.", "Cue unclear.", "Owner area cropped."],
    outOfScopeClaims: ["Do not claim generalized drop reliability.", "Do not infer resource guarding improvement."],
    safetyNotes: ["Use a safe toy.", "Do not pry the toy from the dog."],
    prerequisiteActivityIds: ["HH010"],
    nextActivityId: "HH012",
    orderedVisibleActions: ["Target dog, owner, registered TARGET_TOY, mouth, and drop area are visible.", "Dog reaches owner area while holding toy.", "Audible drop cue occurs.", "Dog releases toy near owner without forced removal."],
    skillFamily: "Tidy-Up Tasks",
    level: 2,
  },
  {
    id: "HH012",
    title: "Drop Toy into Basket",
    orderIndex: 12,
    lessonGoal: "Teach the dog to release the registered toy inside the registered basket boundary.",
    visibleCheckpoint: "Dog carries registered TARGET_TOY to registered TARGET_BASKET and visibly releases toy inside basket boundary.",
    tutorialSteps: ["Use the registered TARGET_TOY and TARGET_BASKET.", "Keep toy, basket, dog mouth, and route visible.", "Begin recording before the carry to basket.", "Reward after the toy is released inside the basket.", "Do not place the toy in the basket by hand."],
    cameraAngle: "TOY_BASKET_DOG_MOUTH_AND_ROUTE",
    setupInstructions: ["TARGET_TOY, TARGET_BASKET, dog mouth, and route must be visible.", "Toy and basket must match saved reference photos.", "Release inside basket boundary must be visible.", "No owner placement may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy matches TARGET_TOY.", "Basket matches TARGET_BASKET.", "Dog carries toy to basket.", "Release occurs inside basket.", "No owner placement occurs."],
    failCriteria: ["Toy is dropped outside basket.", "Wrong basket is used.", "Owner places toy inside.", "No release occurs."],
    needsReviewCriteria: ["Release hidden.", "Basket cropped.", "Object identity unclear.", "Dog mouth hidden."],
    outOfScopeClaims: ["Do not claim full cleanup behavior.", "Do not infer object sorting."],
    safetyNotes: ["Use a stable basket.", "Use a safe toy."],
    prerequisiteActivityIds: ["HH011"],
    nextActivityId: "HH013",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, registered TARGET_BASKET, mouth, and route are visible.", "Dog carries toy to basket.", "Dog releases toy inside basket boundary.", "Owner does not place toy inside."],
    skillFamily: "Tidy-Up Tasks",
    level: 2,
  },
  {
    id: "HH013",
    title: "Put One Toy Away",
    orderIndex: 13,
    lessonGoal: "Teach the dog to retrieve one registered toy and release it inside the registered basket.",
    visibleCheckpoint: "Dog retrieves one registered TARGET_TOY and releases it inside registered TARGET_BASKET.",
    tutorialSteps: ["Use the registered toy and basket.", "Keep toy, basket, dog, and route visible.", "Begin before pickup.", "Record pickup, carry, and release.", "Reward after release inside basket."],
    cameraAngle: "TOY_BASKET_DOG_AND_ROUTE",
    setupInstructions: ["TARGET_TOY, TARGET_BASKET, dog, and route must be visible.", "Toy and basket must match saved references.", "Pickup, carry, and release must be visible.", "Owner must not place toy away."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 25,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy is matched.", "Basket is matched.", "Pickup is visible.", "Carry is visible.", "Release inside basket is visible."],
    failCriteria: ["Wrong toy is selected.", "Toy is dropped outside basket.", "Owner places toy away.", "Route is incomplete."],
    needsReviewCriteria: ["Pickup hidden.", "Release hidden.", "Basket cropped.", "Toy identity unclear."],
    outOfScopeClaims: ["Do not claim generalized cleanup.", "Do not infer independent household chore behavior."],
    safetyNotes: ["Use safe toys and a stable basket.", "Keep the route clear."],
    prerequisiteActivityIds: ["HH012"],
    nextActivityId: "HH014",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, registered TARGET_BASKET, and route are visible.", "Dog picks up the toy.", "Dog carries the toy to basket.", "Dog releases toy inside basket."],
    skillFamily: "Tidy-Up Tasks",
    level: 2,
  },
  {
    id: "HH014",
    title: "Put Two Toys Away",
    orderIndex: 14,
    lessonGoal: "Teach the dog to place two registered toys into the registered basket in two visible repetitions.",
    visibleCheckpoint: "Dog retrieves and places two registered toys into registered basket in two visible repetitions.",
    tutorialSteps: ["Use two registered toys and the registered basket.", "Keep route visible across both repetitions.", "Record separate short clips or one clear clip.", "Capture two pickups, carries, and releases.", "Keep combined duration within 40 seconds."],
    cameraAngle: "TWO_TOYS_BASKET_AND_ROUTE",
    setupInstructions: ["Two registered TARGET_TOY items, TARGET_BASKET, dog, and route must be visible as needed.", "Two repetitions must be visible.", "Maximum combined duration is 40 seconds.", "Owner must not perform placement."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 10,
    maxClipSeconds: 40,
    passCriteria: ["Dog matches DOG_PROFILE.", "Both toys are matched.", "Two pickups are visible.", "Two carries are visible.", "Both releases occur inside basket."],
    failCriteria: ["One toy is missing.", "One release occurs outside basket.", "Owner performs placement.", "Wrong toy is used."],
    needsReviewCriteria: ["One repetition cropped.", "Object identity unclear.", "Basket hidden.", "Clip sequence unclear."],
    outOfScopeClaims: ["Do not claim generalized cleanup.", "Do not infer toy-name understanding."],
    safetyNotes: ["Use safe toys.", "Keep the basket stable and route clear."],
    prerequisiteActivityIds: ["HH013"],
    nextActivityId: "HH015",
    orderedVisibleActions: ["Target dog, two registered toys, registered basket, and route are visible across the sequence.", "First pickup, carry, and basket release complete.", "Second pickup, carry, and basket release complete.", "Owner does not perform placement."],
    skillFamily: "Tidy-Up Tasks",
    level: 2,
  },
  {
    id: "HH015",
    title: "Put Three Toys Away",
    orderIndex: 15,
    lessonGoal: "Teach the dog to place three registered toys into the registered basket in three visible repetitions.",
    visibleCheckpoint: "Dog retrieves and places three registered toys into registered basket in three visible repetitions.",
    tutorialSteps: ["Use three registered toys and the registered basket.", "Prefer separate short clips.", "Keep basket and route visible for each repetition.", "Capture three pickups, carries, and releases.", "Keep combined duration within 60 seconds."],
    cameraAngle: "THREE_TOYS_BASKET_AND_ROUTE",
    setupInstructions: ["Three registered TARGET_TOY items, TARGET_BASKET, dog, and route must be visible as needed.", "Three repetitions must be visible.", "Maximum combined duration is 60 seconds.", "Owner must not perform placement."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 15,
    maxClipSeconds: 60,
    passCriteria: ["Dog matches DOG_PROFILE.", "Three registered toys are matched.", "Three pickups are visible.", "Three carries are visible.", "Three releases inside basket are visible."],
    failCriteria: ["Any toy is missing.", "Any release occurs outside basket.", "Wrong toy is selected.", "Owner performs placement."],
    needsReviewCriteria: ["Repetition missing.", "Basket cropped.", "Toy identity unclear.", "Sequence ambiguous."],
    outOfScopeClaims: ["Do not claim generalized cleanup.", "Do not infer chore reliability outside the clip."],
    safetyNotes: ["Use safe toys.", "Stop before fatigue or frustration."],
    prerequisiteActivityIds: ["HH014"],
    nextActivityId: "HH016",
    orderedVisibleActions: ["Target dog, three registered toys, registered basket, and route are visible across the sequence.", "First toy pickup, carry, and basket release complete.", "Second toy pickup, carry, and basket release complete.", "Third toy pickup, carry, and basket release complete.", "Owner does not perform placement."],
    skillFamily: "Tidy-Up Tasks",
    level: 2,
  },
  {
    id: "HH016",
    title: "Retrieve Named Toy from Two Options",
    orderIndex: 16,
    lessonGoal: "Teach the dog to select and retrieve the correct registered target toy from two visible options.",
    visibleCheckpoint: "Two registered toys are visible, one target toy is specified, and dog selects and retrieves the correct TARGET_TOY.",
    tutorialSteps: ["Place two registered toys visibly.", "Keep dog and owner visible.", "Give the spoken toy-name cue if used.", "Record selection, pickup, and return start.", "Do not physically direct the dog to the correct toy."],
    cameraAngle: "TWO_TOYS_DOG_AND_OWNER",
    setupInstructions: ["Both registered toys, dog, and owner must be visible.", "Target toy must match saved TARGET_TOY photos.", "Audio is required when spoken toy-name cue is judged.", "No physical direction may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Both registered toys are visible.", "Target cue is audible when used.", "Dog selects correct target toy.", "Pickup is visible.", "Return begins."],
    failCriteria: ["Dog selects wrong toy.", "No selection occurs.", "Owner physically directs dog to correct toy."],
    needsReviewCriteria: ["Toy identity unclear.", "One toy hidden.", "Audio unclear when required.", "Pickup obscured."],
    outOfScopeClaims: ["Do not claim language comprehension generally.", "Do not infer object-name reliability."],
    safetyNotes: ["Use safe toys.", "Keep the setup low distraction."],
    prerequisiteActivityIds: ["HH010"],
    nextActivityId: "HH017",
    orderedVisibleActions: ["Target dog, owner, and two registered toys are visible.", "One target toy is specified by configured cue when used.", "Dog selects the correct target toy.", "Dog picks it up and begins return without physical direction."],
    skillFamily: "Toy Selection Tasks",
    level: 2,
  },
  {
    id: "HH017",
    title: "Retrieve Named Toy from Three Options",
    orderIndex: 17,
    lessonGoal: "Teach the dog to select and retrieve the correct registered target toy from three visible options.",
    visibleCheckpoint: "Three registered toys are visible, one target toy is specified, and dog selects and retrieves correct TARGET_TOY.",
    tutorialSteps: ["Place three registered toys visibly.", "Keep dog and owner visible.", "Give the target cue if used.", "Record selection, pickup, and return start.", "Do not guide the dog physically."],
    cameraAngle: "THREE_TOYS_DOG_AND_OWNER",
    setupInstructions: ["All three toys, dog, and owner must be visible.", "Correct target toy must match saved TARGET_TOY photos.", "Audio is required when cue timing is judged.", "No physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 22,
    passCriteria: ["Dog matches DOG_PROFILE.", "Three toys are visible.", "Correct target toy is selected.", "Pickup is visible.", "Return begins.", "No physical guidance occurs."],
    failCriteria: ["Wrong toy is selected.", "No selection occurs.", "Owner guides dog."],
    needsReviewCriteria: ["Toy identities unclear.", "One toy cropped.", "Audio unclear.", "Selection hidden."],
    outOfScopeClaims: ["Do not claim broad object-name understanding.", "Do not claim language comprehension generally."],
    safetyNotes: ["Use safe toys.", "Keep options spaced safely."],
    prerequisiteActivityIds: ["HH016"],
    nextActivityId: "HH018",
    orderedVisibleActions: ["Target dog, owner, and three registered toys are visible.", "One target toy is specified when cue is used.", "Dog selects the correct target toy.", "Dog picks it up and begins return without physical guidance."],
    skillFamily: "Toy Selection Tasks",
    level: 2,
  },
  {
    id: "HH018",
    title: "Find Visible Toy",
    orderIndex: 18,
    lessonGoal: "Teach the dog to travel to the registered toy visible in the room and contact or pick it up.",
    visibleCheckpoint: "Dog travels to registered TARGET_TOY visible in room and contacts or picks it up according to configured completion rule.",
    tutorialSteps: ["Use the registered TARGET_TOY.", "Keep toy, dog, and path visible.", "Begin recording before the dog starts toward the toy.", "Reward after contact or pickup according to the configured rule.", "Do not move the dog to the toy."],
    cameraAngle: "VISIBLE_TOY_DOG_AND_PATH",
    setupInstructions: ["TARGET_TOY, dog, and path must be visible.", "Visible toy must match saved TARGET_TOY photos.", "Configured completion rule must be clear: contact or pickup.", "No owner physical guidance may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 6,
    maxClipSeconds: 15,
    passCriteria: ["Dog matches DOG_PROFILE.", "Toy is matched.", "Dog travels to toy.", "Configured contact or pickup occurs.", "No owner physical guidance occurs."],
    failCriteria: ["Wrong object is selected.", "Dog does not reach toy.", "Owner moves dog to toy."],
    needsReviewCriteria: ["Toy hidden.", "Path cropped.", "Identity unclear."],
    outOfScopeClaims: ["Do not claim scent-detection ability.", "Do not infer search reliability."],
    safetyNotes: ["Use a safe toy.", "Keep path clear."],
    prerequisiteActivityIds: ["HH017"],
    nextActivityId: "HH019",
    orderedVisibleActions: ["Target dog, registered TARGET_TOY, and path are visible before search.", "Dog travels to the toy.", "Dog contacts or picks up the toy according to configured completion rule.", "Owner does not physically guide the dog."],
    skillFamily: "Search Tasks",
    level: 2,
  },
  {
    id: "HH019",
    title: "Find Partially Hidden Toy",
    orderIndex: 19,
    lessonGoal: "Teach the dog to locate the registered toy when partially concealed but still visually scorable.",
    visibleCheckpoint: "Dog locates registered TARGET_TOY when partially concealed but still sufficiently visible for scoring.",
    tutorialSteps: ["Use the registered TARGET_TOY.", "Keep toy location area and dog path visible.", "Use only partial concealment.", "Begin recording before the dog starts searching.", "Reward after contact or pickup is visible."],
    cameraAngle: "PARTIALLY_HIDDEN_TOY_AREA_AND_DOG_PATH",
    setupInstructions: ["Toy location area and dog path must be visible.", "Registered toy identity must remain matchable.", "Toy must not be fully hidden.", "Owner must not reveal or place toy during attempt."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_TOY"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Registered toy identity remains matchable.", "Dog searches visible area.", "Dog locates toy.", "Contact or pickup is visible."],
    failCriteria: ["Dog does not locate toy.", "Dog selects wrong item.", "Owner reveals or places toy during attempt."],
    needsReviewCriteria: ["Toy fully hidden.", "Identity impossible to confirm.", "Search path cropped.", "Contact hidden."],
    outOfScopeClaims: ["Do not claim scent-detection ability generally.", "Do not infer professional search reliability."],
    safetyNotes: ["Use safe partial concealment.", "Avoid frustrating or impossible hides."],
    prerequisiteActivityIds: ["HH018"],
    nextActivityId: "HH020",
    orderedVisibleActions: ["Target dog, partially concealed registered TARGET_TOY area, and dog path are visible.", "Dog searches the visible area.", "Dog locates the registered toy.", "Dog contacts or picks up toy without owner revealing it."],
    skillFamily: "Search Tasks",
    level: 2,
  },
  {
    id: "HH020",
    title: "One-Box Search",
    orderIndex: 20,
    lessonGoal: "Teach the dog to investigate the registered box and locate or indicate a target item area.",
    visibleCheckpoint: "Dog investigates registered TARGET_BOX and locates target item placed visibly or partially concealed inside or beside box.",
    tutorialSteps: ["Use the registered TARGET_BOX.", "Keep box, target-item area, and dog visible.", "Begin recording before the dog approaches the box.", "Reward after the dog locates or indicates the configured target area.", "Do not physically guide the dog to the target area."],
    cameraAngle: "BOX_TARGET_ITEM_AREA_AND_DOG",
    setupInstructions: ["TARGET_BOX, target-item area, and dog must be visible.", "Visible box must match saved TARGET_BOX photos.", "Investigation behavior must be visible.", "No physical guidance to target area may occur."],
    requiredReferenceAssets: ["DOG_PROFILE", "TARGET_BOX"],
    audioRequired: false,
    fps: 5,
    minClipSeconds: 8,
    maxClipSeconds: 20,
    passCriteria: ["Dog matches DOG_PROFILE.", "Box matches TARGET_BOX.", "Dog approaches box.", "Dog visibly investigates.", "Dog locates or indicates configured target area."],
    failCriteria: ["Dog does not investigate box.", "Dog investigates wrong box.", "Owner physically guides dog to target area."],
    needsReviewCriteria: ["Box hidden.", "Target area cropped.", "Investigation unclear.", "Box identity unclear."],
    outOfScopeClaims: ["Do not claim professional scent-work ability.", "Do not infer broad search reliability."],
    safetyNotes: ["Use a safe box without sharp edges.", "Do not trap the dog inside the box."],
    prerequisiteActivityIds: ["HH019"],
    nextActivityId: "HH021",
    orderedVisibleActions: ["Target dog, registered TARGET_BOX, and target-item area are visible before approach.", "Dog approaches the box.", "Dog visibly investigates.", "Dog locates or indicates the configured target area without physical guidance."],
    skillFamily: "Search Tasks",
    level: 2,
  },
];

export const HH011_HH020: BatchActivity[] = SPECS.map(makeActivity);
