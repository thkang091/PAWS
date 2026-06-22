import {
  CHALLENGE_GAME_ECONOMY,
  type ChallengeGameDifficulty,
} from "@/config/economy";
import type { ChallengeGame } from "@/types/domain";

type BetterBehaviorChallengeSpec = Omit<
  ChallengeGame,
  "economy" | "maxStars" | "verifierPrompt"
> & {
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

const buildVerifierPrompt = (game: BetterBehaviorChallengeSpec): string => `You are reviewing one short continuous phone video for a PAWS Challenge Game.

CHALLENGE GAME ID: ${game.id}
CHALLENGE GAME TITLE: ${game.title}
CATEGORY: BETTER_BEHAVIOR_AT_HOME
EXPECTED START STATE:
${game.expectedStartState}

VISIBLE CHECKPOINT:
${game.visibleCheckpoint}

RECORDING SETUP:
${list(game.recordingSetup)}

REQUIRED SAVED REFERENCE PHOTOS:
- DOG_PROFILE must match the visible target dog.
${game.requiredMasteredActivityIds.length ? "- Confirm any visible object is consistent with the mastered prerequisite behavior context when the object is relevant.\n" : ""}Only submitted video evidence may support PASS.

AUDIO RULE:
Audio is optional for this Challenge Game. Do not require audio to issue PASS. If a sound is present, use it only as supporting context.

FPS:
Review at the activity-appropriate visual sampling rate from the video review pipeline. Do not require pose estimation or synthetic landmarks.

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
- Do not fabricate semantic accuracy.
- Use only real visible evidence from the submitted video.

JSON-ONLY RESPONSE INSTRUCTION:
Return strict JSON only, with no markdown, no commentary, and exactly this shape:
${responseShape}`;

const specs: BetterBehaviorChallengeSpec[] = [
  {
    id: "GAME_BH_001",
    category: "BETTER_BEHAVIOR_AT_HOME",
    title: "Go to Your Mat",
    subtitle: "Move onto a visible mat and remain there briefly.",
    description: "The owner cues the dog to move onto a visible mat and remain there briefly.",
    difficulty: "easy",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep the dog, path, and mat fully visible.",
      "Begin recording before the dog starts moving.",
      "Use a safe indoor surface with no physical guidance.",
    ],
    userInstructions: [
      "Start with the dog off the mat.",
      "Invite the dog toward the mat.",
      "Reward after the dog is fully on the mat for at least 5 seconds.",
    ],
    clipDurationSeconds: { min: 6, max: 20 },
    requiredMasteredActivityIds: ["BH009"],
    expectedStartState: "The dog starts off the visible mat, with the full mat and travel path visible.",
    visibleCheckpoint: "The dog moves onto the mat and stays on the mat for at least 5 seconds.",
    orderedVisibleActions: [
      "Dog starts outside the mat boundary.",
      "Dog moves toward the mat without being dragged, lifted, or pushed.",
      "Dog gets fully on the mat.",
      "Dog remains on the mat for at least 5 seconds.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog starts off the mat.",
      "Dog moves onto the mat.",
      "Dog stays on the mat for at least 5 seconds.",
      "No physical guidance or restraint occurs.",
    ],
    failCriteria: [
      "Dog never reaches the mat.",
      "Dog immediately leaves the mat.",
      "Owner drags, lifts, or pushes the dog onto the mat.",
    ],
    needsReviewCriteria: [
      "Dog identity is unclear.",
      "Mat boundary is cropped or hidden.",
      "Dog path is hidden.",
      "Video is cut or unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim relaxation.",
      "Do not claim long-term place reliability.",
      "Do not infer emotional state.",
    ],
    safetyNotes: ["Use a stable mat.", "Keep repetitions short.", "Never force entry."],
  },
  {
    id: "GAME_BH_002",
    category: "BETTER_BEHAVIOR_AT_HOME",
    title: "Mat Stay Challenge",
    subtitle: "Hold the mat position with the boundary visible.",
    description: "The dog remains on a visible mat for at least 15 seconds.",
    difficulty: "medium",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep the full mat boundary and dog visible.",
      "Begin recording before the hold interval.",
      "Do not block the dog's body with the camera or owner.",
    ],
    userInstructions: [
      "Set the dog up on the mat.",
      "Let the dog hold position.",
      "Reward after the visible hold interval.",
    ],
    clipDurationSeconds: { min: 16, max: 30 },
    requiredMasteredActivityIds: ["BH010"],
    expectedStartState: "The dog is inside the registered mat boundary before the visible hold interval begins.",
    visibleCheckpoint: "The dog remains on the visible mat continuously for at least 15 seconds.",
    orderedVisibleActions: [
      "Dog is visible inside the mat boundary.",
      "Mat boundary remains visible.",
      "Dog remains on the mat for at least 15 continuous seconds.",
      "No restraint is used to keep the dog on the mat.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Mat boundary remains visible.",
      "Dog remains on the mat for at least 15 seconds.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog clearly leaves the mat before 15 seconds.",
      "Owner physically holds the dog on the mat.",
    ],
    needsReviewCriteria: [
      "Dog or mat is not fully visible.",
      "Hold duration is unclear.",
      "Clip is too short to score.",
    ],
    outOfScopeClaims: [
      "Do not claim anxiety improvement.",
      "Do not claim the dog can stay on the mat indefinitely.",
      "Do not infer calmness beyond the visible hold.",
    ],
    safetyNotes: ["Use a comfortable surface.", "Keep the challenge easy.", "Stop before frustration."],
  },
  {
    id: "GAME_BH_003",
    category: "BETTER_BEHAVIOR_AT_HOME",
    title: "Doorway Wait",
    subtitle: "Wait behind an interior threshold before release.",
    description: "The dog waits behind a doorway boundary until release.",
    difficulty: "medium",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Use an interior doorway only.",
      "Keep the dog, owner, and full threshold visible.",
      "Begin before the dog approaches the threshold.",
    ],
    userInstructions: [
      "Start with the dog behind the doorway threshold.",
      "Ask for a short wait.",
      "Release the dog after the pause.",
    ],
    clipDurationSeconds: { min: 6, max: 18 },
    requiredMasteredActivityIds: ["BH017"],
    expectedStartState: "The dog starts behind a visible interior doorway threshold.",
    visibleCheckpoint: "The dog stays behind the doorway while the door opens, waits at least 5 seconds, and crosses only after release.",
    orderedVisibleActions: [
      "Dog remains behind the visible doorway boundary.",
      "Door opens while the dog remains behind the boundary.",
      "Dog waits at least 5 seconds.",
      "Owner gives a release moment.",
      "Dog crosses after the release moment.",
      "No physical restraint is used.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Threshold remains visible.",
      "Dog stays behind the doorway while the door opens.",
      "Dog waits at least 5 seconds.",
      "Dog crosses only after release.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog rushes through before release.",
      "Owner physically restrains or drags the dog.",
    ],
    needsReviewCriteria: [
      "Doorway boundary cannot be seen clearly.",
      "Timing is unclear.",
      "Dog is hidden by the door or owner.",
      "Clip starts after the crossing begins.",
    ],
    outOfScopeClaims: [
      "Do not claim exterior-door safety.",
      "Do not claim traffic safety.",
      "Do not infer generalized impulse control.",
    ],
    safetyNotes: ["Use an interior doorway.", "Do not practice near traffic-facing exits."],
  },
  {
    id: "GAME_BH_004",
    category: "BETTER_BEHAVIOR_AT_HOME",
    title: "Food Bowl Wait",
    subtitle: "Wait before approaching the food bowl.",
    description: "The dog waits briefly before approaching a visible food bowl.",
    difficulty: "medium",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep the dog and bowl visible.",
      "Begin before the dog approaches the bowl.",
      "Avoid conflict around food.",
    ],
    userInstructions: [
      "Place the bowl where it stays visible.",
      "Start with the dog away from the bowl.",
      "Release the dog after a brief wait.",
    ],
    clipDurationSeconds: { min: 6, max: 18 },
    requiredMasteredActivityIds: ["BH020"],
    expectedStartState: "The dog starts away from a visible food bowl.",
    visibleCheckpoint: "The dog waits at least 5 seconds before approaching the visible food bowl, then approaches only after release.",
    orderedVisibleActions: [
      "Dog is away from the bowl.",
      "Bowl remains visible.",
      "Dog waits at least 5 seconds without accessing the bowl.",
      "Dog approaches after the release moment.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Bowl is visible.",
      "Dog waits at least 5 seconds.",
      "Dog approaches only after release.",
      "No blocking or restraint occurs.",
    ],
    failCriteria: [
      "Dog reaches the bowl before release.",
      "Dog reaches the bowl before release.",
    ],
    needsReviewCriteria: [
      "Bowl or dog is blocked from view.",
      "Timing is unclear.",
      "Multiple dogs make identity ambiguous.",
    ],
    outOfScopeClaims: [
      "Do not infer food guarding status.",
      "Do not claim permanent meal manners.",
      "Do not infer emotional state.",
    ],
    safetyNotes: ["Avoid conflict around food.", "Stop if guarding behavior appears."],
  },
  {
    id: "GAME_BH_005",
    category: "BETTER_BEHAVIOR_AT_HOME",
    title: "Drop the Toy",
    subtitle: "Release a visible toy after the drop cue.",
    description: "The dog releases a visible toy after the owner gives the drop cue.",
    difficulty: "easy",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep the dog's mouth, toy, and owner hand visible.",
      "Begin before the release attempt.",
      "Do not pull the toy from the dog.",
    ],
    userInstructions: [
      "Play briefly with a safe toy.",
      "Ask for the drop.",
      "Reward the voluntary release.",
    ],
    clipDurationSeconds: { min: 5, max: 12 },
    requiredMasteredActivityIds: ["BH026"],
    expectedStartState: "The dog has a visible toy in or near the mouth before the drop attempt.",
    visibleCheckpoint: "The dog voluntarily releases the toy without forced removal.",
    orderedVisibleActions: [
      "Toy is visible with the dog.",
      "Owner gives the drop cue.",
      "Dog releases the toy.",
      "Owner does not pry, pull, or force the release.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Toy and dog mouth area are visible.",
      "Toy release is visible.",
      "Release occurs without forced removal.",
    ],
    failCriteria: [
      "Dog does not release the toy.",
      "Owner forcibly removes the toy.",
      "Toy release cannot be attributed to the challenge because the key moment is not visible.",
    ],
    needsReviewCriteria: [
      "Toy is hidden.",
      "Dog mouth is cropped.",
      "Release is obscured.",
      "Dog identity is unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim resource guarding improvement.",
      "Do not claim treatment success.",
      "Do not infer emotional state.",
    ],
    safetyNotes: ["Use a safe toy.", "Avoid tugging the toy out of the dog's mouth."],
  },
  {
    id: "GAME_BH_006",
    category: "BETTER_BEHAVIOR_AT_HOME",
    title: "Leave the Toy Alone",
    subtitle: "Avoid picking up a visible toy for at least 5 seconds.",
    description: "The dog avoids picking up a visible toy for at least 5 seconds.",
    difficulty: "easy",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep the dog and toy visible.",
      "Begin before the dog moves toward the toy.",
      "Do not hold the dog back.",
    ],
    userInstructions: [
      "Place the toy where it is visible.",
      "Start with the dog away from the toy.",
      "Reward after the dog avoids picking up the toy for at least 5 seconds.",
    ],
    clipDurationSeconds: { min: 6, max: 15 },
    requiredMasteredActivityIds: ["BH037"],
    expectedStartState: "The dog starts away from a visible toy.",
    visibleCheckpoint: "The dog does not pick up the visible toy for at least 5 seconds.",
    orderedVisibleActions: [
      "Toy is visible.",
      "Dog remains visible near or oriented to the toy.",
      "Dog does not pick up the toy for at least 5 seconds.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Toy remains visible.",
      "Dog does not pick up the toy for at least 5 seconds.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog picks up the toy before the wait ends.",
    ],
    needsReviewCriteria: [
      "Toy is hidden.",
      "Toy or dog is not clearly visible.",
      "Dog path is cropped.",
      "Clip starts after the dog is already moving.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized impulse control.",
      "Do not claim permanent toy manners.",
      "Do not infer emotional state.",
    ],
    safetyNotes: ["Use a safe toy.", "Keep the wait short."],
  },
  {
    id: "GAME_BH_007",
    category: "BETTER_BEHAVIOR_AT_HOME",
    title: "Sit for Greeting",
    subtitle: "Remain seated while a familiar person calmly approaches.",
    description: "The dog remains seated while a familiar person calmly approaches.",
    difficulty: "medium",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep the dog, paws, and approaching person visible.",
      "Use a familiar person and safe indoor space.",
      "Do not physically hold the dog down.",
    ],
    userInstructions: [
      "Start with the dog visible before the greeting.",
      "Have the familiar person approach.",
      "Reward after the dog remains seated during the approach.",
    ],
    clipDurationSeconds: { min: 6, max: 20 },
    requiredMasteredActivityIds: ["BH003", "BH022"],
    expectedStartState: "The dog starts seated or transitions into a seated posture before a familiar person approaches.",
    visibleCheckpoint: "The dog remains seated during the familiar-person approach for at least 3 seconds.",
    orderedVisibleActions: [
      "Approaching person becomes visible.",
      "Dog is seated with hips visible.",
      "Greeting interval occurs.",
      "Dog remains seated for at least 3 seconds without restraint.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Approach and greeting interval are visible.",
      "Dog remains seated during the approach for at least 3 seconds.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog visibly jumps.",
      "Dog jumps onto the person.",
      "Dog immediately leaves the seated position.",
    ],
    needsReviewCriteria: [
      "Dog is blocked by the approaching person.",
      "Seated posture cannot be confirmed.",
      "Greeting interval is unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim generalized greeting manners.",
      "Do not claim generalized greeting manners.",
      "Do not infer emotional calmness.",
    ],
    safetyNotes: ["Use a familiar person.", "Keep the greeting low intensity."],
  },
  {
    id: "GAME_BH_008",
    category: "BETTER_BEHAVIOR_AT_HOME",
    title: "Calm After Play",
    subtitle: "Transition from short play to a mat stay.",
    description: "The dog transitions from short play to a mat stay.",
    difficulty: "hard",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep the dog, toy, path, and settle area visible.",
      "Begin during visible play before the drop.",
      "Do not force the toy release or settle posture.",
    ],
    userInstructions: [
      "Play briefly with the toy.",
      "Ask for a drop.",
      "Guide the dog to settle with no physical forcing.",
    ],
    clipDurationSeconds: { min: 12, max: 30 },
    requiredMasteredActivityIds: ["BH036"],
    expectedStartState: "The dog is visibly participating in short toy play before the mat transition.",
    visibleCheckpoint: "The dog participates in short play, moves to the mat after the cue, and stays on the mat for at least 5 seconds.",
    orderedVisibleActions: [
      "Toy play is visible.",
      "Dog moves to the mat after the cue.",
      "Dog stays on the mat for at least 5 seconds.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Dog participates in short play.",
      "Dog moves to the mat after the cue.",
      "Dog stays on the mat for at least 5 seconds.",
      "No physical forcing occurs.",
    ],
    failCriteria: [
      "Dog never reaches the mat.",
      "Dog immediately leaves the mat.",
    ],
    needsReviewCriteria: [
      "Play-to-mat transition cannot be assessed.",
      "Dog or mat is hidden.",
      "Hold duration is unclear.",
    ],
    outOfScopeClaims: [
      "Do not infer emotional regulation.",
      "Do not claim resource guarding recovery.",
      "Do not claim permanent calmness.",
    ],
    safetyNotes: ["Use a safe toy.", "Stop before arousal escalates.", "Do not force a down posture."],
  },
  {
    id: "GAME_BH_009",
    category: "BETTER_BEHAVIOR_AT_HOME",
    title: "Open Crate Entry",
    subtitle: "Voluntarily enter an open crate or visible safe-zone area.",
    description: "The dog voluntarily enters an open crate or visible safe-zone area after a cue.",
    difficulty: "easy",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep the dog and crate entrance visible.",
      "Keep the crate door visibly open.",
      "Begin before the dog enters.",
    ],
    userInstructions: [
      "Leave the crate door open.",
      "Start with the dog outside the crate.",
      "Reward voluntary entry without closing the door.",
    ],
    clipDurationSeconds: { min: 5, max: 15 },
    requiredMasteredActivityIds: ["BH012"],
    expectedStartState: "The dog starts outside a visible open crate or safe-zone area.",
    visibleCheckpoint: "The dog voluntarily enters the open crate or visible safe-zone area.",
    orderedVisibleActions: [
      "Dog starts outside the crate or safe-zone area.",
      "Open crate or safe-zone area remains visible.",
      "Dog enters voluntarily.",
      "No pushing, lifting, dragging, or door closing occurs.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Open crate or safe-zone area is visible.",
      "Dog voluntarily enters the open crate or safe-zone area.",
      "No physical forcing occurs.",
    ],
    failCriteria: [
      "Dog does not enter.",
      "Owner pushes, drags, or lifts the dog into the crate.",
      "Dog is physically forced into the area.",
    ],
    needsReviewCriteria: [
      "Entry cannot be seen clearly.",
      "Dog is already inside at clip start.",
      "Dog movement is obscured.",
    ],
    outOfScopeClaims: [
      "Do not claim crate comfort.",
      "Do not claim the dog can remain crated alone.",
      "Do not infer emotional safety.",
    ],
    safetyNotes: ["Keep the crate door open.", "Never force entry.", "Do not use the crate as punishment."],
  },
  {
    id: "GAME_BH_010",
    category: "BETTER_BEHAVIOR_AT_HOME",
    title: "Door Open Mat Stay",
    subtitle: "Stay on the mat while an interior door opens.",
    description: "The dog remains on a visible mat while the owner opens a nearby door.",
    difficulty: "hard",
    recordingSetup: [
      "Use one short continuous phone video.",
      "Keep the dog, mat, threshold area, and door motion visible.",
      "Use an interior doorway only.",
      "Begin before the door opens wider.",
    ],
    userInstructions: [
      "Set the dog on the mat.",
      "Open the interior door wider while the dog holds.",
      "Reward the dog for staying on the mat.",
    ],
    clipDurationSeconds: { min: 8, max: 25 },
    requiredMasteredActivityIds: ["BH010", "BH017"],
    expectedStartState: "The dog starts on the mat before the interior door opens wider.",
    visibleCheckpoint: "The dog stays on the mat while the door opens and stays for at least 5 seconds.",
    orderedVisibleActions: [
      "Dog starts on the mat.",
      "Mat boundary remains visible.",
      "Interior door movement is visible.",
      "Dog remains on the mat during the door movement.",
      "Dog stays on the mat for at least 5 seconds.",
      "No physical restraint occurs.",
    ],
    passCriteria: [
      "DOG_PROFILE identity matches the visible dog.",
      "Mat and interior door movement are visible.",
      "Dog stays on the mat while the door opens.",
      "Dog stays for at least 5 seconds.",
      "No physical restraint occurs.",
    ],
    failCriteria: [
      "Dog immediately leaves the mat when the door opens.",
    ],
    needsReviewCriteria: [
      "Dog, mat, or door is not visible clearly.",
      "Hold duration is unclear.",
    ],
    outOfScopeClaims: [
      "Do not claim exterior-door reliability.",
      "Do not imply safety near roads.",
      "Do not claim the dog is permanently calm at home.",
    ],
    safetyNotes: ["Use an interior doorway.", "Keep the door challenge low intensity.", "Do not practice near unsafe exits."],
  },
];

export const BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES: ChallengeGame[] = specs.map((game) => ({
  ...game,
  category: "BETTER_BEHAVIOR_AT_HOME",
  economy: CHALLENGE_GAME_ECONOMY[game.difficulty],
  maxStars: 3,
  verifierPrompt: buildVerifierPrompt(game),
}));

export const BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAME_DIFFICULTY_COUNTS: Record<
  Exclude<ChallengeGameDifficulty, "featured">,
  number
> = {
  easy: BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES.filter((game) => game.difficulty === "easy").length,
  medium: BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES.filter((game) => game.difficulty === "medium").length,
  hard: BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES.filter((game) => game.difficulty === "hard").length,
};
