import {
  DAILY_QUEST_COMPLETION_REWARD,
  type ChallengeGameDifficulty,
  CHALLENGE_GAME_ECONOMY,
  type TrainingDifficulty,
  TRAINING_REWARDS,
} from "@/config/economy";

export type EconomyVerdict = "PASS" | "FAIL" | "NEEDS_REVIEW";
export type CurrencyType = "silver_coin" | "gold_coin";
export type CurrencyTransactionReason =
  | "training_activity_completion"
  | "daily_quest_completion"
  | "challenge_game_entry"
  | "challenge_game_pass_reward"
  | "challenge_game_refund"
  | "coupon_purchase"
  | "legacy_coin_migration";

export type EconomyTransactionDraft = {
  currencyType: CurrencyType;
  amount: number;
  reason: CurrencyTransactionReason;
  idempotencyKey: string;
};

export type EconomyState = {
  silverCoins: number;
  goldCoins: number;
  xp: number;
  chargedAttemptKeys: Set<string>;
  rewardedCompletionKeys: Set<string>;
  rewardedAttemptKeys: Set<string>;
  refundedAttemptKeys: Set<string>;
  purchasedCouponKeys: Set<string>;
};

export const createEconomyState = ({
  silverCoins = 0,
  goldCoins = 0,
  xp = 0,
}: Partial<Pick<EconomyState, "silverCoins" | "goldCoins" | "xp">> = {}): EconomyState => ({
  silverCoins,
  goldCoins,
  xp,
  chargedAttemptKeys: new Set(),
  rewardedCompletionKeys: new Set(),
  rewardedAttemptKeys: new Set(),
  refundedAttemptKeys: new Set(),
  purchasedCouponKeys: new Set(),
});

const cloneState = (state: EconomyState): EconomyState => ({
  silverCoins: state.silverCoins,
  goldCoins: state.goldCoins,
  xp: state.xp,
  chargedAttemptKeys: new Set(state.chargedAttemptKeys),
  rewardedCompletionKeys: new Set(state.rewardedCompletionKeys),
  rewardedAttemptKeys: new Set(state.rewardedAttemptKeys),
  refundedAttemptKeys: new Set(state.refundedAttemptKeys),
  purchasedCouponKeys: new Set(state.purchasedCouponKeys),
});

export const applyTrainingActivityCompletion = ({
  state,
  difficulty,
  completionKey,
}: {
  state: EconomyState;
  difficulty: TrainingDifficulty;
  completionKey: string;
}): { state: EconomyState; transactions: EconomyTransactionDraft[]; xpAwarded: number } => {
  const next = cloneState(state);
  if (next.rewardedCompletionKeys.has(completionKey)) {
    return { state: next, transactions: [], xpAwarded: 0 };
  }

  const reward = TRAINING_REWARDS[difficulty];
  next.rewardedCompletionKeys.add(completionKey);
  next.silverCoins += reward.silverCoins;
  next.xp += reward.xp;

  return {
    state: next,
    xpAwarded: reward.xp,
    transactions: [
      {
        currencyType: "silver_coin",
        amount: reward.silverCoins,
        reason: "training_activity_completion",
        idempotencyKey: `${completionKey}:silver_coin`,
      },
    ],
  };
};

export const applyDailyQuestCompletion = ({
  state,
  questDayKey,
}: {
  state: EconomyState;
  questDayKey: string;
}): { state: EconomyState; transactions: EconomyTransactionDraft[]; xpAwarded: number } => {
  const next = cloneState(state);
  if (next.rewardedCompletionKeys.has(questDayKey)) {
    return { state: next, transactions: [], xpAwarded: 0 };
  }

  next.rewardedCompletionKeys.add(questDayKey);
  next.silverCoins += DAILY_QUEST_COMPLETION_REWARD.silverCoins;
  next.xp += DAILY_QUEST_COMPLETION_REWARD.xp;

  return {
    state: next,
    xpAwarded: DAILY_QUEST_COMPLETION_REWARD.xp,
    transactions: [
      {
        currencyType: "silver_coin",
        amount: DAILY_QUEST_COMPLETION_REWARD.silverCoins,
        reason: "daily_quest_completion",
        idempotencyKey: `${questDayKey}:silver_coin`,
      },
    ],
  };
};

export const enterChallengeGame = ({
  state,
  difficulty,
  attemptKey,
}: {
  state: EconomyState;
  difficulty: ChallengeGameDifficulty;
  attemptKey: string;
}): { state: EconomyState; transactions: EconomyTransactionDraft[]; allowed: boolean; reason?: string } => {
  const next = cloneState(state);
  const economy = CHALLENGE_GAME_ECONOMY[difficulty];

  if (next.chargedAttemptKeys.has(attemptKey)) {
    return { state: next, transactions: [], allowed: true };
  }

  if (next.silverCoins < economy.silverCoinEntryCost) {
    return { state: next, transactions: [], allowed: false, reason: "insufficient_silver_coin" };
  }

  next.chargedAttemptKeys.add(attemptKey);
  next.silverCoins -= economy.silverCoinEntryCost;

  return {
    state: next,
    allowed: true,
    transactions: [
      {
        currencyType: "silver_coin",
        amount: -economy.silverCoinEntryCost,
        reason: "challenge_game_entry",
        idempotencyKey: `${attemptKey}:entry:silver_coin`,
      },
    ],
  };
};

export const applyChallengeGameResult = ({
  state,
  difficulty,
  attemptKey,
  verdict,
  technicalFailure = false,
}: {
  state: EconomyState;
  difficulty: ChallengeGameDifficulty;
  attemptKey: string;
  verdict: EconomyVerdict;
  technicalFailure?: boolean;
}): {
  state: EconomyState;
  transactions: EconomyTransactionDraft[];
  xpAwarded: number;
  freeResubmissionAllowed: boolean;
} => {
  const next = cloneState(state);
  const economy = CHALLENGE_GAME_ECONOMY[difficulty];
  const transactions: EconomyTransactionDraft[] = [];

  if (technicalFailure && next.chargedAttemptKeys.has(attemptKey) && !next.refundedAttemptKeys.has(attemptKey)) {
    next.refundedAttemptKeys.add(attemptKey);
    next.silverCoins += economy.silverCoinEntryCost;
    transactions.push({
      currencyType: "silver_coin",
      amount: economy.silverCoinEntryCost,
      reason: "challenge_game_refund",
      idempotencyKey: `${attemptKey}:refund:silver_coin`,
    });
  }

  if (verdict === "PASS" && !next.rewardedAttemptKeys.has(attemptKey)) {
    next.rewardedAttemptKeys.add(attemptKey);
    next.goldCoins += economy.goldCoinPassReward;
    next.xp += economy.bonusXp;
    transactions.push({
      currencyType: "gold_coin",
      amount: economy.goldCoinPassReward,
      reason: "challenge_game_pass_reward",
      idempotencyKey: `${attemptKey}:pass:gold_coin`,
    });
    return { state: next, transactions, xpAwarded: economy.bonusXp, freeResubmissionAllowed: false };
  }

  return {
    state: next,
    transactions,
    xpAwarded: 0,
    freeResubmissionAllowed: verdict === "NEEDS_REVIEW" && !technicalFailure,
  };
};

export const purchaseCoupon = ({
  state,
  couponId,
  purchaseKey,
  goldCoinCost,
}: {
  state: EconomyState;
  couponId: string;
  purchaseKey: string;
  goldCoinCost: number;
}): { state: EconomyState; transactions: EconomyTransactionDraft[]; allowed: boolean; reason?: string } => {
  const next = cloneState(state);
  if (next.purchasedCouponKeys.has(purchaseKey)) {
    return { state: next, transactions: [], allowed: true };
  }
  if (next.goldCoins < goldCoinCost) {
    return { state: next, transactions: [], allowed: false, reason: "insufficient_gold_coin" };
  }

  next.purchasedCouponKeys.add(purchaseKey);
  next.goldCoins -= goldCoinCost;

  return {
    state: next,
    allowed: true,
    transactions: [
      {
        currencyType: "gold_coin",
        amount: -goldCoinCost,
        reason: "coupon_purchase",
        idempotencyKey: `${purchaseKey}:${couponId}:gold_coin`,
      },
    ],
  };
};

export const levelFromXp = (xp: number): number => Math.floor(Math.max(0, xp) / 100) + 1;
