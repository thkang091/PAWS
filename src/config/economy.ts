export const TRAINING_REWARDS = {
  easy: {
    silverCoins: 5,
    xp: 10,
  },
  medium: {
    silverCoins: 8,
    xp: 18,
  },
  hard: {
    silverCoins: 12,
    xp: 28,
  },
} as const;

export const DAILY_QUEST_COMPLETION_REWARD = {
  silverCoins: 20,
  xp: 35,
} as const;

export const CHALLENGE_GAME_ECONOMY = {
  easy: {
    silverCoinEntryCost: 10,
    goldCoinPassReward: 2,
    bonusXp: 10,
  },
  medium: {
    silverCoinEntryCost: 20,
    goldCoinPassReward: 5,
    bonusXp: 20,
  },
  hard: {
    silverCoinEntryCost: 35,
    goldCoinPassReward: 10,
    bonusXp: 35,
  },
  featured: {
    silverCoinEntryCost: 50,
    goldCoinPassReward: 20,
    bonusXp: 50,
  },
} as const;

export type TrainingDifficulty = keyof typeof TRAINING_REWARDS;
export type ChallengeGameDifficulty = keyof typeof CHALLENGE_GAME_ECONOMY;

export const trainingDifficultyFromLevel = (level: number): TrainingDifficulty => {
  if (level <= 1) return "easy";
  if (level <= 3) return "medium";
  return "hard";
};

export const getTrainingReward = (difficulty: TrainingDifficulty) =>
  TRAINING_REWARDS[difficulty];

export const getDailyQuestCompletionReward = () =>
  DAILY_QUEST_COMPLETION_REWARD;

export const getChallengeGameEconomy = (difficulty: ChallengeGameDifficulty) =>
  CHALLENGE_GAME_ECONOMY[difficulty];
