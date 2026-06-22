import { CHALLENGE_GAME_ECONOMY } from "@/config/economy";
import type { ChallengeGame, ChallengeGameDifficulty, OwnerTrainingGoal } from "@/types/domain";

export type ChallengeGameSpec = Omit<ChallengeGame, "economy" | "maxStars" | "verifierPrompt"> & {
  expectedStartState: string;
  visibleCheckpoint: string;
  orderedVisibleActions: string[];
  passCriteria: string[];
  failCriteria: string[];
  needsReviewCriteria: string[];
  outOfScopeClaims: string[];
  audioRule?: string;
  requiredReferences?: string[];
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

const buildVerifierPrompt = (category: OwnerTrainingGoal, game: ChallengeGameSpec): string => `You are reviewing one short continuous phone video for a PAWS Challenge Game.

CHALLENGE GAME ID: ${game.id}
CHALLENGE GAME TITLE: ${game.title}
CATEGORY: ${category}
EXPECTED START STATE:
${game.expectedStartState}

VISIBLE CHECKPOINT:
${game.visibleCheckpoint}

RECORDING SETUP:
${list(game.recordingSetup)}

REQUIRED SAVED REFERENCE PHOTOS:
${list(game.requiredReferences ?? ["DOG_PROFILE must match the visible target dog."])}
Only submitted video evidence may support PASS.

AUDIO RULE:
${game.audioRule ?? "Audio is optional for this Challenge Game. Do not require audio to issue PASS. If a sound is present, use it only as supporting context."}

FPS:
Review at the visual sampling rate configured by the video review pipeline for this challenge. Do not require pose estimation, synthetic landmarks, medical inference, or emotion inference.

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
- Use only real visible evidence from the submitted video.

JSON-ONLY RESPONSE INSTRUCTION:
Return strict JSON only with this shape:
${responseShape}`;

export const buildChallengeGames = (
  category: OwnerTrainingGoal,
  specs: ChallengeGameSpec[],
): ChallengeGame[] =>
  specs.map((game) => ({
    ...game,
    category,
    economy: CHALLENGE_GAME_ECONOMY[game.difficulty as ChallengeGameDifficulty],
    maxStars: 3,
    verifierPrompt: buildVerifierPrompt(category, game),
  }));
