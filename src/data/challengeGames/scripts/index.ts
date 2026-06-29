//gameid와 script, result 연결하는 라우터

import {
  doorStepAwayScript,
  matPauseScript,
  settleSnapshotScript,
  type ChallengeScript,
} from "@/data/challengeGames/scripts/overlayinstruction";

export type ChallengeResultConfig = {
  gameId: string;
  title: string;
  shortSummary: string;
  practiceScore: number;
  challengeScore: number;
  mockRank: number;
  leaderboardLabel: string;
  goldTierLabel: string;
  strengths: string[];
  improvements: string[];
};

const DEFAULT_SCRIPT = settleSnapshotScript;

const SCRIPT_BY_GAME_ID: Record<string, ChallengeScript> = {
  GAME_CA_001: settleSnapshotScript,
  GAME_CA_002: doorStepAwayScript,
  GAME_CA_003: matPauseScript,
};

const RESULT_CONFIG_BY_GAME_ID: Record<string, ChallengeResultConfig> = {
  GAME_CA_001: {
    gameId: "GAME_CA_001",
    title: "Settle Snapshot",
    shortSummary: "Rested in one place while staying visible.",
    practiceScore: 76,
    challengeScore: 82,
    mockRank: 38,
    leaderboardLabel: "Calm Alone Time · Settle Board",
    goldTierLabel: "Top 50 tier",
    strengths: [
      "Dog stayed in the same resting area.",
      "Body remained mostly visible during the clip.",
      "Calm posture was maintained long enough for scoring.",
    ],
    improvements: [
      "Keep the camera angle lower next time.",
      "Try to reduce background movement around the dog.",
    ],
  },

  GAME_CA_002: {
    gameId: "GAME_CA_002",
    title: "Door Step Away",
    shortSummary: "Stayed in place while the owner briefly stepped away.",
    practiceScore: 84,
    challengeScore: 87,
    mockRank: 21,
    leaderboardLabel: "Calm Alone Time · Step Away Board",
    goldTierLabel: "Top 50 tier",
    strengths: [
      "Dog remained in the target area after the owner moved.",
      "Owner movement was visible enough for review.",
      "Dog stayed calm during the short wait.",
    ],
    improvements: [
      "Keep the doorway and dog visible in the same frame.",
      "Step away a little more slowly for a cleaner attempt.",
    ],
  },

  GAME_CA_003: {
    gameId: "GAME_CA_003",
    title: "Mat Pause",
    shortSummary: "Moved to the mat and paused there during the challenge.",
    practiceScore: 88,
    challengeScore: 93,
    mockRank: 8,
    leaderboardLabel: "Calm Alone Time · Mat Pause Board",
    goldTierLabel: "Top 10 tier",
    strengths: [
      "Dog reached the mat area successfully.",
      "Mat boundary stayed visible during the attempt.",
      "Dog held the pause with minimal movement.",
    ],
    improvements: [
      "Make sure the full mat is visible before starting.",
      "Reward after the timer ends, not during the pause.",
    ],
  },
};

const DEFAULT_RESULT_CONFIG = RESULT_CONFIG_BY_GAME_ID.GAME_CA_001;

export const getChallengeScriptByGameId = (
  gameId: string | undefined,
): ChallengeScript => {
  if (!gameId) return DEFAULT_SCRIPT;

  return SCRIPT_BY_GAME_ID[gameId] ?? DEFAULT_SCRIPT;
};

export const getChallengeResultConfigByGameId = (
  gameId: string | undefined,
): ChallengeResultConfig => {
  if (!gameId) return DEFAULT_RESULT_CONFIG;

  return RESULT_CONFIG_BY_GAME_ID[gameId] ?? DEFAULT_RESULT_CONFIG;
};

export const getChallengeScoreByGameId = (
  gameId: string | undefined,
  mode: string | undefined,
) => {
  const config = getChallengeResultConfigByGameId(gameId);

  return mode === "challenge" ? config.challengeScore : config.practiceScore;
};

export const getGoldForScore = (score: number, mode: string | undefined) => {
  if (mode !== "challenge") return 0;

  if (score >= 90) return 3;
  if (score >= 80) return 2;
  if (score >= 60) return 1;

  return 0;
};

export {
  doorStepAwayScript,
  matPauseScript,
  settleSnapshotScript,
  type ChallengeScript,
  type ChallengeInstructionStep,
} from "@/data/challengeGames/scripts/overlayinstruction";