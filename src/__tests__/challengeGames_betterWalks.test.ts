import { CHALLENGE_GAME_ECONOMY } from "@/config/economy";
import { BETTER_WALKS_CHALLENGE_GAMES } from "@/data/challengeGames/betterWalks";
import { BH001_BH010 } from "@/data/seedCatalog/bh001_bh010";
import { BW001_BW010 } from "@/data/seedCatalog/bw001_bw010";
import { BW011_BW020 } from "@/data/seedCatalog/bw011_bw020";
import { BW021_BW030 } from "@/data/seedCatalog/bw021_bw030";
import { BW031_BW040 } from "@/data/seedCatalog/bw031_bw040";
import { BW041_BW050 } from "@/data/seedCatalog/bw041_bw050";

const EXPECTED_IDS = [
  "GAME_BW_001",
  "GAME_BW_002",
  "GAME_BW_003",
  "GAME_BW_004",
  "GAME_BW_005",
  "GAME_BW_006",
  "GAME_BW_007",
  "GAME_BW_008",
  "GAME_BW_009",
  "GAME_BW_010",
];

const EXPECTED_TITLES: Record<string, string> = {
  GAME_BW_001: "Walk Five Steps Together",
  GAME_BW_002: "Stop With Me",
  GAME_BW_003: "Left Turn Follow",
  GAME_BW_004: "Right Turn Follow",
  GAME_BW_005: "U-Turn Follow",
  GAME_BW_006: "Walk Around One Cone",
  GAME_BW_007: "Figure Eight Walk",
  GAME_BW_008: "Doorway Start",
  GAME_BW_009: "Walk to Mat and Stop",
  GAME_BW_010: "Stop Before the Line",
};

const EXPECTED_DIFFICULTY_COUNTS = {
  easy: 3,
  medium: 6,
  hard: 1,
};

const ALL_VALID_ACTIVITY_IDS = new Set(
  [
    ...BH001_BH010,
    ...BW001_BW010,
    ...BW011_BW020,
    ...BW021_BW030,
    ...BW031_BW040,
    ...BW041_BW050,
  ].map((activity) => activity.id),
);

const REQUIRED_PROMPT_PATTERNS = [
  /Challenge Game ID:/i,
  /Challenge Game Title:/i,
  /Expected start state:/i,
  /Visible checkpoint:/i,
  /Recording setup:/i,
  /Required saved reference photos:/i,
  /Audio rule:/i,
  /Clip-duration range:/i,
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
const UNSUPPORTED_LEASH_TENSION_PATTERN =
  /exact leash[- ]tension measurement|measure leash tension exactly|leash tension score|leash force score/i;
const UNSUPPORTED_REACTIVITY_PATTERN =
  /reactivity detected|detects reactivity|dog is reactive|reactive dog classification/i;

const validationSnapshot = () => {
  const games = BETTER_WALKS_CHALLENGE_GAMES;
  const difficultyCounts = games.reduce<Record<string, number>>((counts, game) => {
    counts[game.difficulty] = (counts[game.difficulty] ?? 0) + 1;
    return counts;
  }, {});
  const silverCosts = games.map((game) => game.economy.silverCoinEntryCost);
  const goldRewards = games.map((game) => game.economy.goldCoinPassReward);
  const serializedGames = games.map((game) => JSON.stringify(game));
  const invalidReferencedActivityIds = games.flatMap((game) =>
    game.requiredMasteredActivityIds.filter((activityId) => !ALL_VALID_ACTIVITY_IDS.has(activityId)),
  );

  return {
    exactGameCount: games.length,
    difficultyCounts,
    silverCoinEntryCostRange: [Math.min(...silverCosts), Math.max(...silverCosts)],
    goldCoinPassRewardRange: [Math.min(...goldRewards), Math.max(...goldRewards)],
    unsupportedLeashTensionClaimCount: serializedGames.filter((game) =>
      UNSUPPORTED_LEASH_TENSION_PATTERN.test(game),
    ).length,
    unsupportedReactivityClaimCount: serializedGames.filter((game) =>
      UNSUPPORTED_REACTIVITY_PATTERN.test(game),
    ).length,
    invalidReferencedActivityCount: invalidReferencedActivityIds.length,
  };
};

describe("Better Walks Challenge Games seed", () => {
  it("seeds exactly the requested 10 games", () => {
    expect(BETTER_WALKS_CHALLENGE_GAMES).toHaveLength(10);
    expect(BETTER_WALKS_CHALLENGE_GAMES.map((game) => game.id)).toEqual(EXPECTED_IDS);
    expect(new Set(BETTER_WALKS_CHALLENGE_GAMES.map((game) => game.id)).size).toBe(10);
    BETTER_WALKS_CHALLENGE_GAMES.forEach((game) => {
      expect(game.category).toBe("BETTER_WALKS");
      expect(game.title).toBe(EXPECTED_TITLES[game.id]);
      expect(game.maxStars).toBe(3);
    });
  });

  it("uses centralized non-featured economy values", () => {
    const snapshot = validationSnapshot();
    expect(snapshot.difficultyCounts).toEqual(EXPECTED_DIFFICULTY_COUNTS);
    expect(snapshot.silverCoinEntryCostRange).toEqual([10, 35]);
    expect(snapshot.goldCoinPassRewardRange).toEqual([2, 10]);

    BETTER_WALKS_CHALLENGE_GAMES.forEach((game) => {
      expect(game.difficulty).not.toBe("featured");
      expect(game.economy).toBe(CHALLENGE_GAME_ECONOMY[game.difficulty]);
    });
  });

  it("references only valid mastered daily activities", () => {
    const invalidReferencedActivityIds = BETTER_WALKS_CHALLENGE_GAMES.flatMap((game) =>
      game.requiredMasteredActivityIds.filter((activityId) => !ALL_VALID_ACTIVITY_IDS.has(activityId)),
    );
    expect(invalidReferencedActivityIds).toEqual([]);
  });

  it("has complete visible-only Gemini Flash verifier prompts without audio requirements", () => {
    BETTER_WALKS_CHALLENGE_GAMES.forEach((game) => {
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

  it("does not contain unsupported leash-tension or reactivity claims", () => {
    BETTER_WALKS_CHALLENGE_GAMES.forEach((game) => {
      const serialized = JSON.stringify(game);
      expect(serialized).not.toMatch(UNSUPPORTED_LEASH_TENSION_PATTERN);
      expect(serialized).not.toMatch(UNSUPPORTED_REACTIVITY_PATTERN);
      expect(serialized).not.toMatch(/require another dog/i);
      expect(serialized).not.toMatch(/require traffic|public streets are required/i);
    });
  });

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake semantic verdict path", () => {
    BETTER_WALKS_CHALLENGE_GAMES.forEach((game) => {
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
      unsupportedLeashTensionClaimCount: 0,
      unsupportedReactivityClaimCount: 0,
      invalidReferencedActivityCount: 0,
    });
    console.log("BW_CHALLENGE_GAME_VALIDATION", JSON.stringify(validationSnapshot()));
  });
});
