import { CHALLENGE_GAME_ECONOMY } from "@/config/economy";
import { BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES } from "@/data/challengeGames/betterBehaviorAtHome";
import { BH001_BH010 } from "@/data/seedCatalog/bh001_bh010";
import { BH011_BH020 } from "@/data/seedCatalog/bh011_bh020";
import { BH021_BH030 } from "@/data/seedCatalog/bh021_bh030";
import { BH031_BH040 } from "@/data/seedCatalog/bh031_bh040";
import { BH041_BH050 } from "@/data/seedCatalog/bh041_bh050";

const EXPECTED_IDS = [
  "GAME_BH_001",
  "GAME_BH_002",
  "GAME_BH_003",
  "GAME_BH_004",
  "GAME_BH_005",
  "GAME_BH_006",
  "GAME_BH_007",
  "GAME_BH_008",
  "GAME_BH_009",
  "GAME_BH_010",
];

const EXPECTED_TITLES: Record<string, string> = {
  GAME_BH_001: "Go to Your Mat",
  GAME_BH_002: "Mat Stay Challenge",
  GAME_BH_003: "Doorway Wait",
  GAME_BH_004: "Food Bowl Wait",
  GAME_BH_005: "Drop the Toy",
  GAME_BH_006: "Leave the Toy Alone",
  GAME_BH_007: "Sit for Greeting",
  GAME_BH_008: "Calm After Play",
  GAME_BH_009: "Open Crate Entry",
  GAME_BH_010: "Door Open Mat Stay",
};

const EXPECTED_DIFFICULTY_COUNTS = {
  easy: 4,
  medium: 4,
  hard: 2,
};

const ALL_BH_ACTIVITY_IDS = new Set(
  [
    ...BH001_BH010,
    ...BH011_BH020,
    ...BH021_BH030,
    ...BH031_BH040,
    ...BH041_BH050,
  ].map((activity) => activity.id),
);

const REQUIRED_PROMPT_PATTERNS = [
  /Challenge Game ID:/i,
  /Challenge Game Title:/i,
  /Expected start state:/i,
  /Visible checkpoint:/i,
  /Recording setup:/i,
  /Required saved reference photos:|Required references:/i,
  /Audio rule:/i,
  /Clip-duration range:|Clip duration:/i,
  /Ordered visible actions:/i,
  /PASS criteria:/i,
  /FAIL criteria:/i,
  /NEEDS_REVIEW criteria:/i,
  /Out-of-scope claims:/i,
  /Safety notes:/i,
  /Return strict JSON only/i,
  /PASS \| FAIL \| NEEDS_REVIEW/,
  /observedCheckpoints/,
  /missingCheckpoints/,
  /safetyFlags/,
];

const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

const validationSnapshot = () => {
  const games = BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES;
  const difficultyCounts = games.reduce<Record<string, number>>((counts, game) => {
    counts[game.difficulty] = (counts[game.difficulty] ?? 0) + 1;
    return counts;
  }, {});
  const silverCosts = games.map((game) => game.economy.silverCoinEntryCost);
  const goldRewards = games.map((game) => game.economy.goldCoinPassReward);
  const invalidReferencedActivityIds = games.flatMap((game) =>
    game.requiredMasteredActivityIds.filter((activityId) => !ALL_BH_ACTIVITY_IDS.has(activityId)),
  );
  const missingVerifierPrompts = games.filter((game) => !game.verifierPrompt.trim());

  return {
    exactGameCount: games.length,
    difficultyCounts,
    silverCoinEntryCostRange: [Math.min(...silverCosts), Math.max(...silverCosts)],
    goldCoinPassRewardRange: [Math.min(...goldRewards), Math.max(...goldRewards)],
    invalidReferencedActivityCount: invalidReferencedActivityIds.length,
    missingVerifierPromptCount: missingVerifierPrompts.length,
  };
};

describe("Better Behavior at Home Challenge Games seed", () => {
  it("seeds exactly the requested 10 games", () => {
    expect(BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES).toHaveLength(10);
    expect(BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES.map((game) => game.id)).toEqual(EXPECTED_IDS);
    expect(new Set(BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES.map((game) => game.id)).size).toBe(10);
    BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES.forEach((game) => {
      expect(game.category).toBe("BETTER_BEHAVIOR_AT_HOME");
      expect(game.title).toBe(EXPECTED_TITLES[game.id]);
      expect(game.maxStars).toBe(3);
    });
  });

  it("uses only easy, medium, and hard centralized economy values", () => {
    const snapshot = validationSnapshot();
    expect(snapshot.difficultyCounts).toEqual(EXPECTED_DIFFICULTY_COUNTS);
    expect(snapshot.silverCoinEntryCostRange).toEqual([10, 35]);
    expect(snapshot.goldCoinPassRewardRange).toEqual([2, 10]);

    BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES.forEach((game) => {
      expect(game.difficulty).not.toBe("featured");
      expect(game.economy).toBe(CHALLENGE_GAME_ECONOMY[game.difficulty]);
    });
  });

  it("references only existing mastered Better Behavior activities", () => {
    const invalidReferencedActivityIds = BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES.flatMap((game) =>
      game.requiredMasteredActivityIds.filter((activityId) => !ALL_BH_ACTIVITY_IDS.has(activityId)),
    );
    expect(invalidReferencedActivityIds).toEqual([]);
  });

  it("has complete Gemini Flash verifier prompts with visible-only scoring", () => {
    BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES.forEach((game) => {
      expect(game.verifierPrompt.trim().length).toBeGreaterThan(900);
      REQUIRED_PROMPT_PATTERNS.forEach((pattern) => {
        expect(game.verifierPrompt).toMatch(pattern);
      });
      expect(game.verifierPrompt).toContain(game.id);
      expect(game.verifierPrompt).toContain(game.title);
      expect(game.verifierPrompt).toMatch(/audio is (optional|not required)/i);
      expect(game.verifierPrompt).not.toMatch(/audio is required/i);
      expect(game.verifierPrompt).not.toMatch(/Did the dog complete/i);
    });
  });

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake semantic verdict path", () => {
    BETTER_BEHAVIOR_AT_HOME_CHALLENGE_GAMES.forEach((game) => {
      const serialized = JSON.stringify(game);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(pass|unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });

  it("prints the minimal validation snapshot", () => {
    expect(validationSnapshot()).toEqual({
      exactGameCount: 10,
      difficultyCounts: EXPECTED_DIFFICULTY_COUNTS,
      silverCoinEntryCostRange: [10, 35],
      goldCoinPassRewardRange: [2, 10],
      invalidReferencedActivityCount: 0,
      missingVerifierPromptCount: 0,
    });
    console.log("BH_CHALLENGE_GAME_VALIDATION", JSON.stringify(validationSnapshot()));
  });
});
