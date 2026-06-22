import { CHALLENGE_GAME_ECONOMY } from "@/config/economy";
import type { ChallengeGame } from "@/types/domain";

type BetterWalksChallengeSpec = Omit<ChallengeGame, "economy" | "maxStars" | "verifierPrompt"> & {
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

const buildVerifierPrompt = (game: BetterWalksChallengeSpec): string => `You are reviewing one short continuous phone video for a PAWS Challenge Game.

CHALLENGE GAME ID: ${game.id}
CHALLENGE GAME TITLE: ${game.title}
CATEGORY: BETTER_WALKS
EXPECTED START STATE:
${game.expectedStartState}

VISIBLE CHECKPOINT:
${game.visibleCheckpoint}

RECORDING SETUP:
${list(game.recordingSetup)}

REQUIRED SAVED REFERENCE PHOTOS:
- DOG_PROFILE must match the visible target dog.
- Use visible props only when they are part of the challenge.
Only submitted video evidence may support PASS.

AUDIO RULE:
Audio is optional for this Challenge Game. Do not require audio to issue PASS. If a sound is present, use it only as supporting context.

FPS:
Review at the activity-appropriate visual sampling rate from the video review pipeline. Do not require pose estimation, synthetic landmarks, or numeric leash analysis.

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
- Do not evaluate reactivity.
- Another dog, traffic, public streets, and unsafe environments are not part of this challenge.
- Use only real visible evidence from the submitted video.

JSON-ONLY RESPONSE INSTRUCTION:
Return strict JSON only, with no markdown, no commentary, and exactly this shape:
${responseShape}`;

const specs: BetterWalksChallengeSpec[] = [
  {
    id: "GAME_BW_001",
    category: "BETTER_WALKS",
    title: "Walk Five Steps Together",
    subtitle: "Walk near the owner for at least five visible steps.",
    description: "The dog walks near the owner for at least five visible steps.",
    difficulty: "easy",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Use a safe controlled indoor or quiet route.",
      "Keep dog, owner, owner feet, and path visible.",
      "Begin recording before walking starts.",
    ],
    userInstructions: [
      "Start with dog and owner visible.",
      "Walk forward together.",
      "Keep the dog reasonably close for at least five visible owner steps.",
    ],
    clipDurationSeconds: { min: 5, max: 15 },
    requiredMasteredActivityIds: ["BW003"],
    expectedStartState: "Dog and owner are visible before walking starts on a safe controlled route.",
    visibleCheckpoint: "Dog and owner move together for at least five visible steps while the dog stays reasonably close and visible.",
    orderedVisibleActions: [
      "Dog and owner start in frame.",
      "Owner takes at least five visible steps.",
      "Dog moves with the owner in the same direction.",
      "Dog stays reasonably close and visible.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog and owner move together for at least five steps.",
      "Dog stays reasonably close and visible.",
    ],
    failCriteria: ["Five visible steps are not completed."],
    needsReviewCriteria: ["Dog leaves frame.", "Owner feet are hidden.", "Step count is unclear."],
    outOfScopeClaims: [
      "Do not claim loose-leash mastery.",
      "Do not use numeric leash analysis.",
      "Do not claim outdoor reliability.",
    ],
    safetyNotes: ["Use a safe controlled route.", "Do not pull or drag the dog."],
  },
  {
    id: "GAME_BW_002",
    category: "BETTER_WALKS",
    title: "Stop With Me",
    subtitle: "Walk together and stop when the owner stops.",
    description: "The dog walks with the owner and stops when the owner stops.",
    difficulty: "medium",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep dog, owner, owner feet, and path visible.",
      "Begin before the walking segment.",
      "Use a safe controlled route.",
    ],
    userInstructions: [
      "Walk forward with the dog.",
      "Stop clearly.",
      "Reward when the dog stops near you.",
    ],
    clipDurationSeconds: { min: 5, max: 15 },
    requiredMasteredActivityIds: ["BW010"],
    expectedStartState: "Dog and owner are walking together before the owner stop.",
    visibleCheckpoint: "Owner clearly stops and the dog stops near the owner.",
    orderedVisibleActions: [
      "Dog and owner walk together.",
      "Owner clearly stops.",
      "Dog stops near owner.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog and owner walk together.",
      "Owner clearly stops.",
      "Dog stops near owner.",
    ],
    failCriteria: ["Dog continues walking away."],
    needsReviewCriteria: ["Stop cannot be assessed.", "Dog or owner is cropped.", "Timing is unclear."],
    outOfScopeClaims: [
      "Do not claim generalized walk control.",
      "Do not use numeric leash analysis.",
      "Do not evaluate reactivity.",
    ],
    safetyNotes: ["Use a safe controlled route.", "Avoid abrupt leash corrections."],
  },
  {
    id: "GAME_BW_003",
    category: "BETTER_WALKS",
    title: "Left Turn Follow",
    subtitle: "Follow the owner through one visible left turn.",
    description: "The dog follows owner through one visible left turn.",
    difficulty: "easy",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep dog, owner, route, and turn visible.",
      "Begin before the turn.",
      "Use a safe controlled route.",
    ],
    userInstructions: ["Walk forward.", "Turn left once.", "Reward after the dog follows into the new direction."],
    clipDurationSeconds: { min: 5, max: 15 },
    requiredMasteredActivityIds: ["BW012"],
    expectedStartState: "Dog and owner are visible before one left turn on a safe route.",
    visibleCheckpoint: "Owner turns left and the dog follows into the new direction.",
    orderedVisibleActions: [
      "Dog and owner walk or stand before the turn.",
      "Owner turns left.",
      "Dog follows into the new direction.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Owner turns left.",
      "Dog follows into the new direction.",
    ],
    failCriteria: ["Dog does not follow."],
    needsReviewCriteria: ["Turn is blocked.", "Dog path is hidden.", "Direction change is unclear."],
    outOfScopeClaims: [
      "Do not claim heel precision.",
      "Do not use numeric leash analysis.",
      "Do not claim generalized walking reliability.",
    ],
    safetyNotes: ["Use a clear safe path.", "Do not drag the dog through the turn."],
  },
  {
    id: "GAME_BW_004",
    category: "BETTER_WALKS",
    title: "Right Turn Follow",
    subtitle: "Follow the owner through one visible right turn.",
    description: "The dog follows owner through one visible right turn.",
    difficulty: "easy",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep dog, owner, route, and turn visible.",
      "Begin before the turn.",
      "Use a safe controlled route.",
    ],
    userInstructions: ["Walk forward.", "Turn right once.", "Reward after the dog follows into the new direction."],
    clipDurationSeconds: { min: 5, max: 15 },
    requiredMasteredActivityIds: ["BW012"],
    expectedStartState: "Dog and owner are visible before one right turn on a safe route.",
    visibleCheckpoint: "Owner turns right and the dog follows into the new direction.",
    orderedVisibleActions: [
      "Dog and owner walk or stand before the turn.",
      "Owner turns right.",
      "Dog follows into the new direction.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Owner turns right.",
      "Dog follows into the new direction.",
    ],
    failCriteria: ["Dog does not follow."],
    needsReviewCriteria: ["Turn is blocked.", "Dog path is hidden.", "Direction change is unclear."],
    outOfScopeClaims: [
      "Do not claim heel precision.",
      "Do not use numeric leash analysis.",
      "Do not claim generalized walking reliability.",
    ],
    safetyNotes: ["Use a clear safe path.", "Do not drag the dog through the turn."],
  },
  {
    id: "GAME_BW_005",
    category: "BETTER_WALKS",
    title: "U-Turn Follow",
    subtitle: "Follow the owner through one direction reversal.",
    description: "The dog follows owner through one direction reversal.",
    difficulty: "medium",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep dog, owner, and route visible.",
      "Begin before the direction reversal.",
      "Use a safe controlled route.",
    ],
    userInstructions: ["Walk forward.", "Reverse direction once.", "Reward when the dog follows after the turn."],
    clipDurationSeconds: { min: 6, max: 18 },
    requiredMasteredActivityIds: ["BW013"],
    expectedStartState: "Dog and owner are visible before one direction reversal.",
    visibleCheckpoint: "Owner reverses direction and the dog follows after the turn.",
    orderedVisibleActions: [
      "Dog and owner move or set up before the reversal.",
      "Owner reverses direction.",
      "Dog follows after the turn.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Owner reverses direction.",
      "Dog follows after the turn.",
    ],
    failCriteria: ["Dog continues in the original direction."],
    needsReviewCriteria: ["Turn is unclear.", "Dog path is hidden.", "Route is cropped."],
    outOfScopeClaims: [
      "Do not claim emergency reliability.",
      "Do not use numeric leash analysis.",
      "Do not evaluate reactivity.",
    ],
    safetyNotes: ["Use a safe controlled route.", "Do not yank or drag the dog through the turn."],
  },
  {
    id: "GAME_BW_006",
    category: "BETTER_WALKS",
    title: "Walk Around One Cone",
    subtitle: "Follow the owner around one visible cone or household marker.",
    description: "The dog follows owner around one visible cone or household marker.",
    difficulty: "medium",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Use one visible cone or safe household marker.",
      "Keep dog, owner, route, and marker visible.",
      "Use a safe controlled route.",
    ],
    userInstructions: ["Set up one visible marker.", "Walk around the marker with the dog.", "Reward after the route is completed."],
    clipDurationSeconds: { min: 6, max: 20 },
    requiredMasteredActivityIds: ["BW025"],
    expectedStartState: "Dog, owner, and one visible marker are in frame before the route begins.",
    visibleCheckpoint: "Dog and owner complete the route around the marker.",
    orderedVisibleActions: [
      "Dog, owner, and marker are visible.",
      "Dog and owner approach the marker.",
      "Dog and owner travel around the marker.",
      "Route around the marker is completed.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog and owner complete the route around the marker.",
    ],
    failCriteria: ["Route is incomplete."],
    needsReviewCriteria: ["Marker is unclear.", "Dog path is hidden.", "Route completion is unclear."],
    outOfScopeClaims: [
      "Do not claim obstacle mastery.",
      "Do not use numeric leash analysis.",
      "Do not claim heel skill.",
    ],
    safetyNotes: ["Use a stable safe marker.", "Keep the route clear."],
  },
  {
    id: "GAME_BW_007",
    category: "BETTER_WALKS",
    title: "Figure Eight Walk",
    subtitle: "Follow the owner around two markers in a figure-eight route.",
    description: "The dog follows owner around two markers in a figure-eight route.",
    difficulty: "hard",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Use two visible cones or safe household markers.",
      "Keep dog, owner, route, and both markers visible.",
      "Use a safe controlled route with enough space.",
    ],
    userInstructions: [
      "Set up two visible markers.",
      "Walk one recognizable figure eight with the dog.",
      "Reward after the figure-eight route is completed.",
    ],
    clipDurationSeconds: { min: 10, max: 30 },
    requiredMasteredActivityIds: ["BW026"],
    expectedStartState: "Dog, owner, and two markers are visible before the figure-eight route begins.",
    visibleCheckpoint: "Two markers are visible and dog and owner complete one recognizable figure eight.",
    orderedVisibleActions: [
      "Two markers are visible.",
      "Dog and owner enter the route.",
      "Dog and owner travel around both markers in a recognizable figure eight.",
      "One figure-eight route is completed.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Two markers are visible.",
      "Dog and owner complete one recognizable figure eight.",
    ],
    failCriteria: ["Route is incomplete."],
    needsReviewCriteria: ["Dog leaves frame too long.", "Markers are cropped.", "Route pattern is unclear."],
    outOfScopeClaims: [
      "Do not claim advanced heelwork.",
      "Do not use numeric leash analysis.",
      "Do not evaluate reactivity.",
    ],
    safetyNotes: ["Use stable safe markers.", "Keep the route clear and low distraction."],
  },
  {
    id: "GAME_BW_008",
    category: "BETTER_WALKS",
    title: "Doorway Start",
    subtitle: "Wait briefly before starting a controlled walk through a doorway.",
    description: "The dog waits briefly before starting a controlled walk through a doorway.",
    difficulty: "medium",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Use a safe indoor doorway.",
      "Keep dog, owner, doorway boundary, and start path visible.",
      "Do not use a traffic-facing exit.",
    ],
    userInstructions: ["Start behind the doorway boundary.", "Wait at least 3 seconds.", "Release into the walk."],
    clipDurationSeconds: { min: 6, max: 20 },
    requiredMasteredActivityIds: ["BW019"],
    expectedStartState: "Dog starts behind a visible safe doorway boundary before the walk begins.",
    visibleCheckpoint: "Dog waits at least 3 seconds and starts walking after release.",
    orderedVisibleActions: [
      "Dog starts behind the doorway boundary.",
      "Dog waits at least 3 seconds.",
      "Release moment occurs.",
      "Dog starts walking after release.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog waits at least 3 seconds.",
      "Dog starts walking after release.",
    ],
    failCriteria: ["Dog rushes through before release."],
    needsReviewCriteria: ["Doorway boundary is unclear.", "Timing is unclear.", "Dog is hidden."],
    outOfScopeClaims: [
      "Do not claim exterior-door safety.",
      "Do not claim traffic safety.",
      "Do not evaluate reactivity.",
    ],
    safetyNotes: ["Use a safe doorway.", "Do not perform near traffic or public streets."],
  },
  {
    id: "GAME_BW_009",
    category: "BETTER_WALKS",
    title: "Walk to Mat and Stop",
    subtitle: "Walk with owner to a visible mat and stop on or beside it.",
    description: "The dog walks with owner to a visible mat and stops on or beside it.",
    difficulty: "medium",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep dog, owner, path, and visible mat in frame.",
      "Begin before walking starts.",
      "Use a safe controlled route.",
    ],
    userInstructions: ["Start away from the mat.", "Walk toward the mat with the dog.", "Stop on or directly beside the mat."],
    clipDurationSeconds: { min: 6, max: 20 },
    requiredMasteredActivityIds: ["BW010", "BH007"],
    expectedStartState: "Dog and owner start away from a visible mat on a safe route.",
    visibleCheckpoint: "Dog moves toward the mat and stops on or directly beside the mat.",
    orderedVisibleActions: [
      "Dog, owner, path, and mat are visible.",
      "Dog and owner move toward the mat.",
      "Dog stops on or directly beside the mat.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog moves toward mat.",
      "Dog stops on or directly beside mat.",
    ],
    failCriteria: ["Dog does not reach mat area.", "Dog does not stop."],
    needsReviewCriteria: ["Mat or stop is blocked.", "Path is cropped.", "Stop location is unclear."],
    outOfScopeClaims: [
      "Do not claim place reliability.",
      "Do not use numeric leash analysis.",
      "Do not claim outdoor walking reliability.",
    ],
    safetyNotes: ["Use a safe controlled route.", "Keep the mat flat and stable."],
  },
  {
    id: "GAME_BW_010",
    category: "BETTER_WALKS",
    title: "Stop Before the Line",
    subtitle: "Stop before crossing a visible floor line.",
    description: "The dog stops before crossing a visible floor line.",
    difficulty: "medium",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Use tape, chalk, or a safe visual boundary.",
      "Keep dog, owner, route, and boundary line visible.",
      "Do not perform near traffic.",
    ],
    userInstructions: [
      "Set up a visible safe floor line.",
      "Approach the line with the dog.",
      "Stop before the line and wait at least 3 seconds.",
    ],
    clipDurationSeconds: { min: 6, max: 20 },
    requiredMasteredActivityIds: ["BW021"],
    expectedStartState: "Dog and owner start before a visible safe floor line or boundary.",
    visibleCheckpoint: "Dog approaches the line with owner, stops before the line, and waits at least 3 seconds.",
    orderedVisibleActions: [
      "Visible boundary line is in frame.",
      "Dog approaches line with owner.",
      "Dog stops before the line.",
      "Dog waits at least 3 seconds.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog approaches line with owner.",
      "Dog stops before line.",
      "Dog waits at least 3 seconds.",
    ],
    failCriteria: ["Dog crosses before pause."],
    needsReviewCriteria: ["Boundary line is unclear.", "Dog paws are hidden.", "Timing is unclear."],
    outOfScopeClaims: [
      "Do not claim road safety.",
      "Do not claim traffic reliability.",
      "Do not evaluate reactivity.",
    ],
    safetyNotes: ["Use tape, chalk, or a safe visual boundary.", "Do not perform near traffic."],
  },
];

export const BETTER_WALKS_CHALLENGE_GAMES: ChallengeGame[] = specs.map((game) => ({
  ...game,
  category: "BETTER_WALKS",
  economy: CHALLENGE_GAME_ECONOMY[game.difficulty],
  maxStars: 3,
  verifierPrompt: buildVerifierPrompt(game),
}));
