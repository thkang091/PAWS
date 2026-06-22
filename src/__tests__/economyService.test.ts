import {
  applyChallengeGameResult,
  applyDailyQuestCompletion,
  applyTrainingActivityCompletion,
  createEconomyState,
  enterChallengeGame,
  levelFromXp,
  purchaseCoupon,
} from "@/services/economyService";

describe("PAWS two-currency economy", () => {
  it("daily training awards Silver Coins and XP only", () => {
    const result = applyTrainingActivityCompletion({
      state: createEconomyState(),
      difficulty: "easy",
      completionKey: "activity-1",
    });

    expect(result.state.silverCoins).toBe(5);
    expect(result.state.goldCoins).toBe(0);
    expect(result.state.xp).toBe(10);
    expect(result.transactions).toEqual([
      expect.objectContaining({ currencyType: "silver_coin", reason: "training_activity_completion", amount: 5 }),
    ]);
  });

  it("daily training does not award Gold Coins", () => {
    const result = applyTrainingActivityCompletion({
      state: createEconomyState(),
      difficulty: "hard",
      completionKey: "activity-hard",
    });

    expect(result.transactions.some((tx) => tx.currencyType === "gold_coin")).toBe(false);
    expect(result.state.goldCoins).toBe(0);
  });

  it("Daily Quest completion awards Silver Coins and XP only", () => {
    const result = applyDailyQuestCompletion({
      state: createEconomyState(),
      questDayKey: "dog-1:2026-06-12",
    });

    expect(result.state.silverCoins).toBe(20);
    expect(result.state.goldCoins).toBe(0);
    expect(result.state.xp).toBe(35);
    expect(result.transactions).toEqual([
      expect.objectContaining({ currencyType: "silver_coin", reason: "daily_quest_completion", amount: 20 }),
    ]);
  });

  it("Daily Quest does not award Gold Coins", () => {
    const result = applyDailyQuestCompletion({
      state: createEconomyState(),
      questDayKey: "dog-1:2026-06-13",
    });

    expect(result.transactions.some((tx) => tx.currencyType === "gold_coin")).toBe(false);
  });

  it("Challenge Game entry deducts Silver Coins exactly once", () => {
    const first = enterChallengeGame({
      state: createEconomyState({ silverCoins: 25 }),
      difficulty: "medium",
      attemptKey: "attempt-1",
    });
    const second = enterChallengeGame({
      state: first.state,
      difficulty: "medium",
      attemptKey: "attempt-1",
    });

    expect(first.allowed).toBe(true);
    expect(first.state.silverCoins).toBe(5);
    expect(first.transactions).toHaveLength(1);
    expect(second.state.silverCoins).toBe(5);
    expect(second.transactions).toHaveLength(0);
  });

  it("Challenge Game PASS awards Gold Coins exactly once", () => {
    const entry = enterChallengeGame({
      state: createEconomyState({ silverCoins: 25 }),
      difficulty: "medium",
      attemptKey: "attempt-pass",
    });
    const first = applyChallengeGameResult({
      state: entry.state,
      difficulty: "medium",
      attemptKey: "attempt-pass",
      verdict: "PASS",
    });
    const second = applyChallengeGameResult({
      state: first.state,
      difficulty: "medium",
      attemptKey: "attempt-pass",
      verdict: "PASS",
    });

    expect(first.state.goldCoins).toBe(5);
    expect(first.xpAwarded).toBe(20);
    expect(first.transactions).toEqual([
      expect.objectContaining({ currencyType: "gold_coin", reason: "challenge_game_pass_reward", amount: 5 }),
    ]);
    expect(second.state.goldCoins).toBe(5);
    expect(second.transactions).toHaveLength(0);
  });

  it("Challenge Game FAIL does not award Gold Coins", () => {
    const result = applyChallengeGameResult({
      state: createEconomyState({ silverCoins: 10 }),
      difficulty: "easy",
      attemptKey: "attempt-fail",
      verdict: "FAIL",
    });

    expect(result.state.goldCoins).toBe(0);
    expect(result.transactions).toHaveLength(0);
  });

  it("Challenge Game NEEDS_REVIEW does not award Gold Coins", () => {
    const result = applyChallengeGameResult({
      state: createEconomyState({ silverCoins: 10 }),
      difficulty: "easy",
      attemptKey: "attempt-review",
      verdict: "NEEDS_REVIEW",
    });

    expect(result.state.goldCoins).toBe(0);
    expect(result.transactions).toHaveLength(0);
  });

  it("NEEDS_REVIEW allows one free resubmission", () => {
    const result = applyChallengeGameResult({
      state: createEconomyState({ silverCoins: 10 }),
      difficulty: "easy",
      attemptKey: "attempt-review",
      verdict: "NEEDS_REVIEW",
    });

    expect(result.freeResubmissionAllowed).toBe(true);
  });

  it("technical failure refunds Silver Coins", () => {
    const entry = enterChallengeGame({
      state: createEconomyState({ silverCoins: 10 }),
      difficulty: "easy",
      attemptKey: "attempt-tech",
    });
    const result = applyChallengeGameResult({
      state: entry.state,
      difficulty: "easy",
      attemptKey: "attempt-tech",
      verdict: "NEEDS_REVIEW",
      technicalFailure: true,
    });

    expect(result.state.silverCoins).toBe(10);
    expect(result.transactions).toEqual([
      expect.objectContaining({ currencyType: "silver_coin", reason: "challenge_game_refund", amount: 10 }),
    ]);
  });

  it("valid FAIL does not refund Silver Coins", () => {
    const entry = enterChallengeGame({
      state: createEconomyState({ silverCoins: 10 }),
      difficulty: "easy",
      attemptKey: "attempt-valid-fail",
    });
    const result = applyChallengeGameResult({
      state: entry.state,
      difficulty: "easy",
      attemptKey: "attempt-valid-fail",
      verdict: "FAIL",
    });

    expect(result.state.silverCoins).toBe(0);
    expect(result.transactions).toHaveLength(0);
  });

  it("users cannot enter a Challenge Game without enough Silver Coins", () => {
    const result = enterChallengeGame({
      state: createEconomyState({ silverCoins: 9 }),
      difficulty: "easy",
      attemptKey: "attempt-no-silver",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("insufficient_silver_coin");
  });

  it("client-provided reward values are ignored", () => {
    const result = applyChallengeGameResult({
      state: createEconomyState(),
      difficulty: "featured",
      attemptKey: "attempt-featured",
      verdict: "PASS",
    });

    expect(result.state.goldCoins).toBe(20);
    expect(result.state.goldCoins).not.toBe(999);
  });

  it("client-provided balances are ignored by entry logic", () => {
    const trustedServerState = createEconomyState({ silverCoins: 0 });
    const result = enterChallengeGame({
      state: trustedServerState,
      difficulty: "easy",
      attemptKey: "attempt-client-balance",
    });

    expect(result.allowed).toBe(false);
  });

  it("coupon purchases deduct Gold Coins exactly once", () => {
    const first = purchaseCoupon({
      state: createEconomyState({ goldCoins: 12, silverCoins: 100 }),
      couponId: "coupon-1",
      purchaseKey: "purchase-1",
      goldCoinCost: 10,
    });
    const second = purchaseCoupon({
      state: first.state,
      couponId: "coupon-1",
      purchaseKey: "purchase-1",
      goldCoinCost: 10,
    });

    expect(first.allowed).toBe(true);
    expect(first.state.goldCoins).toBe(2);
    expect(second.state.goldCoins).toBe(2);
    expect(second.transactions).toHaveLength(0);
  });

  it("coupon purchases do not deduct Silver Coins", () => {
    const result = purchaseCoupon({
      state: createEconomyState({ goldCoins: 20, silverCoins: 100 }),
      couponId: "coupon-2",
      purchaseKey: "purchase-2",
      goldCoinCost: 15,
    });

    expect(result.state.silverCoins).toBe(100);
    expect(result.transactions).toEqual([
      expect.objectContaining({ currencyType: "gold_coin", reason: "coupon_purchase", amount: -15 }),
    ]);
  });

  it("users cannot buy coupons without enough Gold Coins", () => {
    const result = purchaseCoupon({
      state: createEconomyState({ goldCoins: 4 }),
      couponId: "coupon-3",
      purchaseKey: "purchase-3",
      goldCoinCost: 5,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("insufficient_gold_coin");
  });

  it("duplicate completion requests do not award duplicate coins", () => {
    const first = applyTrainingActivityCompletion({
      state: createEconomyState(),
      difficulty: "medium",
      completionKey: "duplicate-completion",
    });
    const second = applyTrainingActivityCompletion({
      state: first.state,
      difficulty: "medium",
      completionKey: "duplicate-completion",
    });

    expect(second.state.silverCoins).toBe(8);
    expect(second.xpAwarded).toBe(0);
    expect(second.transactions).toHaveLength(0);
  });

  it("duplicate purchase requests do not deduct duplicate coins", () => {
    const first = purchaseCoupon({
      state: createEconomyState({ goldCoins: 10 }),
      couponId: "coupon-4",
      purchaseKey: "duplicate-purchase",
      goldCoinCost: 5,
    });
    const second = purchaseCoupon({
      state: first.state,
      couponId: "coupon-4",
      purchaseKey: "duplicate-purchase",
      goldCoinCost: 5,
    });

    expect(second.state.goldCoins).toBe(5);
    expect(second.transactions).toHaveLength(0);
  });

  it("XP level progression uses XP rather than Silver Coins or Gold Coins", () => {
    const state = createEconomyState({ silverCoins: 9999, goldCoins: 9999, xp: 250 });

    expect(levelFromXp(state.xp)).toBe(3);
    expect(levelFromXp(0)).toBe(1);
  });

  it("legacy generic coin balances migrate into Silver Coins safely", () => {
    const legacyCoins = 42;
    const migrated = createEconomyState({ silverCoins: legacyCoins, goldCoins: 0 });

    expect(migrated.silverCoins).toBe(42);
    expect(migrated.goldCoins).toBe(0);
  });
});
