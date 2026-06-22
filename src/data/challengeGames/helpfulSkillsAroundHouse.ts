import { CHALLENGE_GAME_ECONOMY } from "@/config/economy";
import type { ChallengeGame } from "@/types/domain";

type HelpfulSkillsChallengeSpec = Omit<ChallengeGame, "economy" | "maxStars" | "verifierPrompt"> & {
  expectedStartState: string;
  visibleCheckpoint: string;
  orderedVisibleActions: string[];
  passCriteria: string[];
  failCriteria: string[];
  needsReviewCriteria: string[];
  outOfScopeClaims: string[];
};

const responseShape = `{
  "verdict": "PASS | FAIL | NEEDS_REVIEW",
  "confidence": 0.0,
  "summary": "string",
  "observedCheckpoints": ["string"],
  "missingCheckpoints": ["string"],
  "safetyFlags": ["string"]
}`;

const list = (items: string[]) => items.map((item) => `- ${item}`).join("\n");

const buildVerifierPrompt = (game: HelpfulSkillsChallengeSpec): string => `You are reviewing one short continuous phone video for a PAWS Challenge Game.

CHALLENGE GAME ID: ${game.id}
CHALLENGE GAME TITLE: ${game.title}
CATEGORY: HELPFUL_SKILLS_AROUND_THE_HOUSE
EXPECTED START STATE:
${game.expectedStartState}

VISIBLE CHECKPOINT:
${game.visibleCheckpoint}

RECORDING SETUP:
${list(game.recordingSetup)}

REQUIRED SAVED REFERENCE PHOTOS:
- DOG_PROFILE must match the visible target dog.
- Use one obvious visible prop whenever possible.
- Toy, basket, mat, target, person, or destination evidence must remain visible when it is part of the challenge.
Only submitted video evidence may support PASS.

AUDIO RULE:
Audio is optional for this Challenge Game. Do not require audio to issue PASS. If a sound is present, use it only as supporting context.

FPS:
Review at the activity-appropriate visual sampling rate from the video review pipeline. Do not require custom object detection, exact object localization, pose estimation, or synthetic landmarks.

CLIP-DURATION RANGE:
${game.clipDurationSeconds.min}-${game.clipDurationSeconds.max} seconds.

ORDERED VISIBLE ACTIONS:
${list(game.orderedVisibleActions)}

PASS CRITERIA:
${list(game.passCriteria)}

FAIL CRITERIA:
${list(game.failCriteria)}

NEEDS_REVIEW CRITERIA:
${list(game.needsReviewCriteria)}

OUT-OF-SCOPE CLAIMS:
${list(game.outOfScopeClaims)}

SAFETY NOTES:
${list(game.safetyNotes ?? [])}

DECISION RULES:
- PASS only when the visible checkpoint is clearly completed by the target dog in the submitted video.
- FAIL only when the clip is clear and scorable and the required visible checkpoint is clearly not completed.
- NEEDS_REVIEW when evidence is missing, cropped, ambiguous, too dark, too short, or not scorable.
- Missing evidence is never FAIL.
- If the toy, prop, destination, basket, mat, target, person, or release location is blocked, return NEEDS_REVIEW.
- Use only real visible evidence from the submitted video.

JSON-ONLY RESPONSE INSTRUCTION:
Return strict JSON only, with no markdown, no commentary, and exactly this shape:
${responseShape}`;

const specs: HelpfulSkillsChallengeSpec[] = [
  {
    id: "GAME_HS_001",
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    title: "Bring the Toy",
    subtitle: "Bring a visible toy toward the owner.",
    description: "The dog brings a visible toy toward owner.",
    difficulty: "easy",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep dog, owner or destination area, toy, and route visible.",
      "Begin before the dog starts bringing the toy.",
      "Use a safe toy and clear route.",
    ],
    userInstructions: [
      "Start with the dog and toy visible.",
      "Invite the dog to bring the toy.",
      "Reward when the dog reaches the owner or destination area.",
    ],
    clipDurationSeconds: { min: 6, max: 20 },
    requiredMasteredActivityIds: ["HH010"],
    expectedStartState: "Dog starts with access to a visible safe toy and a visible owner or destination area.",
    visibleCheckpoint: "Dog carries or moves the toy toward owner and reaches owner or destination area.",
    orderedVisibleActions: [
      "Dog and toy are visible.",
      "Dog carries or moves the toy toward owner.",
      "Dog reaches the owner or destination area.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog carries or moves toy toward owner.",
      "Dog reaches owner or destination area.",
    ],
    failCriteria: ["Dog does not bring toy."],
    needsReviewCriteria: ["Toy is blocked.", "Dog path is hidden.", "Destination area is unclear."],
    outOfScopeClaims: [
      "Do not claim formal retrieve reliability.",
      "Do not claim exact object localization.",
      "Do not infer service-task reliability.",
    ],
    safetyNotes: ["Use a safe toy.", "Keep the route clear."],
  },
  {
    id: "GAME_HS_002",
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    title: "Drop Toy Near Owner",
    subtitle: "Release a toy near the owner.",
    description: "The dog releases a toy near owner.",
    difficulty: "easy",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep dog mouth, toy, owner area, and release location visible.",
      "Begin while the dog has or approaches with the toy.",
      "Do not forcibly remove the toy.",
    ],
    userInstructions: ["Start with the dog holding the toy.", "Ask for the drop if desired.", "Reward after release near owner."],
    clipDurationSeconds: { min: 5, max: 20 },
    requiredMasteredActivityIds: ["HH011"],
    expectedStartState: "Dog begins with a visible toy near or approaching the owner area.",
    visibleCheckpoint: "Dog visibly releases the toy near owner.",
    orderedVisibleActions: [
      "Dog begins with toy.",
      "Dog is near owner or owner area.",
      "Dog visibly releases toy near owner.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog begins with toy.",
      "Dog visibly releases toy near owner.",
    ],
    failCriteria: ["Dog does not release toy."],
    needsReviewCriteria: ["Release location is unclear.", "Toy release is hidden.", "Dog mouth is cropped."],
    outOfScopeClaims: [
      "Do not claim generalized drop reliability.",
      "Do not claim resource guarding improvement.",
      "Do not infer service-task reliability.",
    ],
    safetyNotes: ["Use a safe toy.", "Do not pry the toy from the dog."],
  },
  {
    id: "GAME_HS_003",
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    title: "Toy Box Drop",
    subtitle: "Drop one toy into a visible basket or toy box.",
    description: "The dog drops one toy into a visible basket or toy box.",
    difficulty: "medium",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep dog, toy, basket or toy box, and release moment visible.",
      "Begin before the dog reaches the basket.",
      "Do not place the toy in the basket by hand.",
    ],
    userInstructions: ["Set out one visible basket or toy box.", "Have the dog bring the toy.", "Reward after the toy ends inside the basket."],
    clipDurationSeconds: { min: 6, max: 25 },
    requiredMasteredActivityIds: ["HH012"],
    expectedStartState: "Dog has or approaches with one visible toy and the basket or toy box is visible.",
    visibleCheckpoint: "Dog releases toy and the toy visibly ends inside basket.",
    orderedVisibleActions: [
      "Dog and toy are visible.",
      "Basket or toy box is visible.",
      "Dog releases toy.",
      "Toy ends inside basket.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog releases toy.",
      "Toy visibly ends inside basket.",
    ],
    failCriteria: ["Toy does not land inside basket."],
    needsReviewCriteria: ["Toy or basket is blocked.", "Release moment is hidden.", "Final toy location is unclear."],
    outOfScopeClaims: [
      "Do not claim generalized cleanup.",
      "Do not claim exact object localization.",
      "Do not infer independent chore behavior.",
    ],
    safetyNotes: ["Use a stable basket.", "Use a safe toy."],
  },
  {
    id: "GAME_HS_004",
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    title: "Carry Toy to Mat",
    subtitle: "Carry a visible toy to a visible mat.",
    description: "The dog carries a visible toy to a visible mat.",
    difficulty: "medium",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep toy, dog mouth, route, and mat visible.",
      "Start with dog away from the mat.",
      "Use a safe flat mat and clear route.",
    ],
    userInstructions: ["Start with the dog away from the mat with the toy.", "Invite the dog toward the mat.", "Reward when the dog reaches the mat area while carrying the toy."],
    clipDurationSeconds: { min: 6, max: 20 },
    requiredMasteredActivityIds: ["HH026"],
    expectedStartState: "Dog starts away from the visible mat while carrying or picking up a visible toy.",
    visibleCheckpoint: "Dog starts away from mat with toy and reaches mat area while carrying toy.",
    orderedVisibleActions: [
      "Dog starts away from mat with toy.",
      "Dog carries toy toward mat.",
      "Dog reaches mat area while carrying toy.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog starts away from mat with toy.",
      "Dog reaches mat area while carrying toy.",
    ],
    failCriteria: ["Dog never reaches mat area."],
    needsReviewCriteria: ["Toy or mat is unclear.", "Dog mouth is hidden.", "Route is cropped."],
    outOfScopeClaims: [
      "Do not claim generalized delivery behavior.",
      "Do not claim exact object localization.",
      "Do not infer mat-stay reliability.",
    ],
    safetyNotes: ["Use a safe toy.", "Keep mat flat and route clear."],
  },
  {
    id: "GAME_HS_005",
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    title: "Pick Up the Toy",
    subtitle: "Pick up one visible toy from the floor.",
    description: "The dog picks up one visible toy from floor.",
    difficulty: "easy",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep toy, dog mouth, and floor area visible.",
      "Begin with the toy on the floor.",
      "Use a safe toy.",
    ],
    userInstructions: ["Place one toy on the floor.", "Start recording before pickup.", "Reward after the dog visibly picks up the toy."],
    clipDurationSeconds: { min: 4, max: 15 },
    requiredMasteredActivityIds: ["HH009"],
    expectedStartState: "One visible toy begins on the floor and the dog is visible before pickup.",
    visibleCheckpoint: "Toy begins on floor and dog visibly picks up toy.",
    orderedVisibleActions: [
      "Toy begins on floor.",
      "Dog moves to the toy.",
      "Dog visibly picks up toy.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Toy begins on floor.",
      "Dog visibly picks up toy.",
    ],
    failCriteria: ["Dog does not pick up toy."],
    needsReviewCriteria: ["Pickup is blocked.", "Toy is hidden.", "Dog mouth is cropped."],
    outOfScopeClaims: [
      "Do not claim formal retrieve reliability.",
      "Do not claim object-name understanding.",
      "Do not claim exact object localization.",
    ],
    safetyNotes: ["Use a safe toy.", "Keep the floor clear."],
  },
  {
    id: "GAME_HS_006",
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    title: "Touch the Target",
    subtitle: "Touch a visible target with the nose.",
    description: "The dog touches a visible target with nose.",
    difficulty: "easy",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep target and dog nose visible.",
      "Begin before the dog moves to the target.",
      "Do not press the target into the dog.",
    ],
    userInstructions: ["Present a visible safe target.", "Let the dog move toward it.", "Reward after nose contact."],
    clipDurationSeconds: { min: 4, max: 15 },
    requiredMasteredActivityIds: ["HH001"],
    expectedStartState: "Dog and visible target are in frame before contact.",
    visibleCheckpoint: "Dog nose reaches target.",
    orderedVisibleActions: [
      "Target and dog nose are visible.",
      "Dog moves nose toward target.",
      "Dog nose reaches target.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog nose reaches target.",
    ],
    failCriteria: ["No visible target touch."],
    needsReviewCriteria: ["Target or nose is blocked.", "Contact moment is unclear."],
    outOfScopeClaims: [
      "Do not claim generalized target reliability.",
      "Do not infer helper-task readiness.",
      "Do not claim exact object localization.",
    ],
    safetyNotes: ["Use a safe target.", "Do not push into the dog's face."],
  },
  {
    id: "GAME_HS_007",
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    title: "Go to the Mat",
    subtitle: "Move to a visible mat and stay briefly.",
    description: "The dog moves to visible mat and stays briefly.",
    difficulty: "easy",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep dog, route, and full mat visible.",
      "Begin with the dog off the mat.",
      "Use a safe stable mat.",
    ],
    userInstructions: ["Start with dog off the mat.", "Cue or invite the dog to the mat.", "Reward after the dog remains at least 5 seconds."],
    clipDurationSeconds: { min: 6, max: 20 },
    requiredMasteredActivityIds: ["HH002"],
    expectedStartState: "Dog starts off the visible mat with route and mat in frame.",
    visibleCheckpoint: "Dog starts off mat, reaches mat, and remains at least 5 seconds.",
    orderedVisibleActions: [
      "Dog starts off mat.",
      "Dog reaches mat.",
      "Dog remains at least 5 seconds.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog starts off mat.",
      "Dog reaches mat.",
      "Dog remains at least 5 seconds.",
    ],
    failCriteria: ["Dog does not reach mat.", "Dog immediately leaves."],
    needsReviewCriteria: ["Mat is blocked.", "Dog leaves frame.", "Hold duration is unclear."],
    outOfScopeClaims: [
      "Do not claim relaxation.",
      "Do not claim long-duration mat reliability.",
      "Do not claim exact object localization.",
    ],
    safetyNotes: ["Use a stable non-slip mat.", "Do not drag the dog onto the mat."],
  },
  {
    id: "GAME_HS_008",
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    title: "Bring Toy and Sit",
    subtitle: "Bring a toy toward owner and then sit.",
    description: "The dog brings toy toward owner and then sits.",
    difficulty: "hard",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep dog, toy, owner area, route, and final hips visible.",
      "Begin before the toy return.",
      "Do not force the sit.",
    ],
    userInstructions: ["Have the dog bring a visible toy.", "Ask for or wait for a sit near owner.", "Reward after the sit is visible."],
    clipDurationSeconds: { min: 8, max: 25 },
    requiredMasteredActivityIds: ["HH010"],
    expectedStartState: "Dog starts with or moves toward a visible toy before returning toward owner.",
    visibleCheckpoint: "Dog returns toward owner with toy and visibly sits near owner.",
    orderedVisibleActions: [
      "Dog returns toward owner with toy.",
      "Dog reaches owner area.",
      "Dog visibly sits near owner.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog returns toward owner with toy.",
      "Dog visibly sits near owner.",
    ],
    failCriteria: ["Toy return or sit is missing."],
    needsReviewCriteria: ["Final sit is blocked.", "Toy is hidden.", "Dog hips are cropped."],
    outOfScopeClaims: [
      "Do not claim formal retrieve finish.",
      "Do not infer obedience reliability outside the clip.",
      "Do not claim service-task reliability.",
    ],
    safetyNotes: ["Use a safe toy.", "Do not push the dog into a sit."],
  },
  {
    id: "GAME_HS_009",
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    title: "Two-Toy Cleanup",
    subtitle: "Place two visible toys into a basket in one clip.",
    description: "The dog places two visible toys into basket in one clip.",
    difficulty: "hard",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep two toys, basket, dog, and route visible across both cleanup actions.",
      "Begin before the first cleanup action.",
      "Do not place the toys in the basket by hand.",
    ],
    userInstructions: ["Set out two visible safe toys and one basket.", "Record both toy placements.", "Reward after two toys end inside the basket."],
    clipDurationSeconds: { min: 12, max: 40 },
    requiredMasteredActivityIds: ["HH014"],
    expectedStartState: "Two visible toys and a visible basket are available before the cleanup sequence.",
    visibleCheckpoint: "Two toys visibly end inside basket.",
    orderedVisibleActions: [
      "First toy cleanup action is visible.",
      "First toy ends inside basket.",
      "Second toy cleanup action is visible.",
      "Second toy ends inside basket.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Two toys visibly end inside basket.",
    ],
    failCriteria: ["Fewer than two toys end inside basket."],
    needsReviewCriteria: ["One cleanup action is blocked.", "Basket is hidden.", "Toy final location is unclear."],
    outOfScopeClaims: [
      "Do not claim generalized cleanup.",
      "Do not infer chore reliability outside the clip.",
      "Do not claim exact object localization.",
    ],
    safetyNotes: ["Use safe toys.", "Keep the basket stable and route clear."],
  },
  {
    id: "GAME_HS_010",
    category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    title: "Toy Delivery to Person",
    subtitle: "Carry a toy toward a visible person.",
    description: "The dog carries toy toward a visible person.",
    difficulty: "medium",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep dog, toy, route, and destination person visible.",
      "Begin before the dog approaches the person.",
      "Use a safe toy and clear route.",
    ],
    userInstructions: ["Start with dog and toy visible.", "Invite delivery to the visible person.", "Reward when the dog reaches the destination area."],
    clipDurationSeconds: { min: 6, max: 20 },
    requiredMasteredActivityIds: ["HH024"],
    expectedStartState: "Dog starts with or near a visible toy and a visible destination person is in frame.",
    visibleCheckpoint: "Dog carries toy toward person and reaches destination area.",
    orderedVisibleActions: [
      "Dog carries toy toward person.",
      "Person remains visible.",
      "Dog reaches destination area.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog carries toy toward person.",
      "Dog reaches destination area.",
    ],
    failCriteria: ["Dog does not approach person with toy."],
    needsReviewCriteria: ["Person or toy is blocked.", "Route is cropped.", "Destination area is unclear."],
    outOfScopeClaims: [
      "Do not claim generalized delivery reliability.",
      "Do not infer person-name comprehension.",
      "Do not claim service-task reliability.",
    ],
    safetyNotes: ["Use a safe toy.", "Keep the route clear and low pressure."],
  },
];

export const HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES: ChallengeGame[] = specs.map((game) => ({
  ...game,
  category: "HELPFUL_SKILLS_AROUND_THE_HOUSE",
  economy: CHALLENGE_GAME_ECONOMY[game.difficulty],
  maxStars: 3,
  verifierPrompt: buildVerifierPrompt(game),
}));
