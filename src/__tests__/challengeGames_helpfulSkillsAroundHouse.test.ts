import { CHALLENGE_GAME_ECONOMY } from "@/config/economy";
import { HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES } from "@/data/challengeGames/helpfulSkillsAroundHouse";
import { HH001_HH010 } from "@/data/seedCatalog/hh001_hh010";
import { HH011_HH020 } from "@/data/seedCatalog/hh011_hh020";
import { HH021_HH030 } from "@/data/seedCatalog/hh021_hh030";
import { HH031_HH040 } from "@/data/seedCatalog/hh031_hh040";
import { HH041_HH050 } from "@/data/seedCatalog/hh041_hh050";

const EXPECTED_IDS = [
  "GAME_HS_001",
  "GAME_HS_002",
  "GAME_HS_003",
  "GAME_HS_004",
  "GAME_HS_005",
  "GAME_HS_006",
  "GAME_HS_007",
  "GAME_HS_008",
  "GAME_HS_009",
  "GAME_HS_010",
];

const EXPECTED_TITLES: Record<string, string> = {
  GAME_HS_001: "Bring the Toy",
  GAME_HS_002: "Drop Toy Near Owner",
  GAME_HS_003: "Toy Box Drop",
  GAME_HS_004: "Carry Toy to Mat",
  GAME_HS_005: "Pick Up the Toy",
  GAME_HS_006: "Touch the Target",
  GAME_HS_007: "Go to the Mat",
  GAME_HS_008: "Bring Toy and Sit",
  GAME_HS_009: "Two-Toy Cleanup",
  GAME_HS_010: "Toy Delivery to Person",
};

const EXPECTED_DIFFICULTY_COUNTS = {
  easy: 5,
  medium: 3,
  hard: 2,
};

const ALL_HH_ACTIVITY_IDS = new Set(
  [
    ...HH001_HH010,
    ...HH011_HH020,
    ...HH021_HH030,
    ...HH031_HH040,
    ...HH041_HH050,
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
const UNSUPPORTED_OBJECT_DETECTION_PATTERN =
  /custom object-detection infrastructure|build object detection|exact object localization required|precise object coordinates/i;

const validationSnapshot = () => {
  const games = HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES;
  const difficultyCounts = games.reduce<Record<string, number>>((counts, game) => {
    counts[game.difficulty] = (counts[game.difficulty] ?? 0) + 1;
    return counts;
  }, {});
  const silverCosts = games.map((game) => game.economy.silverCoinEntryCost);
  const goldRewards = games.map((game) => game.economy.goldCoinPassReward);
  const invalidReferencedActivityIds = games.flatMap((game) =>
    game.requiredMasteredActivityIds.filter((activityId) => !ALL_HH_ACTIVITY_IDS.has(activityId)),
  );

  return {
    exactGameCount: games.length,
    difficultyCounts,
    silverCoinEntryCostRange: [Math.min(...silverCosts), Math.max(...silverCosts)],
    goldCoinPassRewardRange: [Math.min(...goldRewards), Math.max(...goldRewards)],
    invalidReferencedActivityCount: invalidReferencedActivityIds.length,
  };
};

describe("Helpful Skills Around the House Challenge Games seed", () => {
  it("seeds exactly the requested 10 games", () => {
    expect(HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES).toHaveLength(10);
    expect(HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES.map((game) => game.id)).toEqual(EXPECTED_IDS);
    expect(new Set(HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES.map((game) => game.id)).size).toBe(10);
    HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES.forEach((game) => {
      expect(game.category).toBe("HELPFUL_SKILLS_AROUND_THE_HOUSE");
      expect(game.title).toBe(EXPECTED_TITLES[game.id]);
      expect(game.maxStars).toBe(3);
    });
  });

  it("uses centralized non-featured economy values", () => {
    const snapshot = validationSnapshot();
    expect(snapshot.difficultyCounts).toEqual(EXPECTED_DIFFICULTY_COUNTS);
    expect(snapshot.silverCoinEntryCostRange).toEqual([10, 35]);
    expect(snapshot.goldCoinPassRewardRange).toEqual([2, 10]);

    HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES.forEach((game) => {
      expect(game.difficulty).not.toBe("featured");
      expect(game.economy).toBe(CHALLENGE_GAME_ECONOMY[game.difficulty]);
    });
  });

  it("references only valid mastered Helpful Skills activities", () => {
    const invalidReferencedActivityIds = HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES.flatMap((game) =>
      game.requiredMasteredActivityIds.filter((activityId) => !ALL_HH_ACTIVITY_IDS.has(activityId)),
    );
    expect(invalidReferencedActivityIds).toEqual([]);
  });

  it("has complete visible-only Gemini Flash verifier prompts without audio requirements", () => {
    HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES.forEach((game) => {
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

  it("does not contain unsupported object-detection claims", () => {
    HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES.forEach((game) => {
      const serialized = JSON.stringify(game);
      expect(serialized).not.toMatch(UNSUPPORTED_OBJECT_DETECTION_PATTERN);
    });
  });

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake semantic verdict path", () => {
    HELPFUL_SKILLS_AROUND_THE_HOUSE_CHALLENGE_GAMES.forEach((game) => {
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
    });
    console.log("HS_CHALLENGE_GAME_VALIDATION", JSON.stringify(validationSnapshot()));
  });
});
