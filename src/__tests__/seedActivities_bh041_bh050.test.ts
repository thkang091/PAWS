import { BH001_BH010 } from "@/data/seedCatalog/bh001_bh010";
import { BH011_BH020 } from "@/data/seedCatalog/bh011_bh020";
import { BH021_BH030 } from "@/data/seedCatalog/bh021_bh030";
import { BH031_BH040 } from "@/data/seedCatalog/bh031_bh040";
import { BH041_BH050 } from "@/data/seedCatalog/bh041_bh050";

const EXPECTED_IDS = [
  "BH041",
  "BH042",
  "BH043",
  "BH044",
  "BH045",
  "BH046",
  "BH047",
  "BH048",
  "BH049",
  "BH050",
];

const ALL_BH_ACTIVITIES = [
  ...BH001_BH010,
  ...BH011_BH020,
  ...BH021_BH030,
  ...BH031_BH040,
  ...BH041_BH050,
];

const ALL_KNOWN_IDS = new Set(ALL_BH_ACTIVITIES.map((activity) => activity.id));

const EXPECTED_REFERENCES: Record<string, string[]> = {
  BH041: ["DOG_PROFILE", "TARGET_MAT"],
  BH042: ["DOG_PROFILE", "TARGET_MAT"],
  BH043: ["DOG_PROFILE", "TARGET_MAT"],
  BH044: ["DOG_PROFILE", "TARGET_MAT"],
  BH045: ["DOG_PROFILE", "TARGET_MAT"],
  BH046: ["DOG_PROFILE", "TARGET_BOWL"],
  BH047: ["DOG_PROFILE", "TARGET_TOY", "TARGET_MAT"],
  BH048: ["DOG_PROFILE", "TARGET_DOORWAY", "TARGET_MAT"],
  BH049: ["DOG_PROFILE", "TARGET_BOWL", "TARGET_MAT"],
  BH050: ["DOG_PROFILE", "TARGET_MAT", "TARGET_DOORWAY", "TARGET_BOWL", "TARGET_TOY"],
};

const EXPECTED_AUDIO: Record<string, boolean> = {
  BH041: false,
  BH042: true,
  BH043: true,
  BH044: true,
  BH045: true,
  BH046: true,
  BH047: true,
  BH048: true,
  BH049: true,
  BH050: true,
};

const EXPECTED_FPS: Record<string, number> = {
  BH041: 3,
  BH042: 3,
  BH043: 3,
  BH044: 2,
  BH045: 3,
  BH046: 3,
  BH047: 5,
  BH048: 3,
  BH049: 3,
  BH050: 3,
};

const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  BH041: ["BH007"],
  BH042: ["BH008", "BH006"],
  BH043: ["BH023"],
  BH044: ["BH024"],
  BH045: ["BH042"],
  BH046: ["BH020"],
  BH047: ["BH028", "BH036"],
  BH048: ["BH017", "BH041"],
  BH049: ["BH046", "BH035"],
  BH050: ["BH048", "BH049"],
};

const EXPECTED_NEXT: Record<string, string | null> = {
  BH041: "BH042",
  BH042: "BH043",
  BH043: "BH044",
  BH044: "BH045",
  BH045: "BH046",
  BH046: "BH047",
  BH047: "BH048",
  BH048: "BH049",
  BH049: "BH050",
  BH050: null,
};

const REQUIRED_PROMPT_SECTIONS = [
  /ACTIVITY ID/i,
  /ACTIVITY TITLE/i,
  /EXPECTED START STATE/i,
  /VISIBLE CHECKPOINT/i,
  /RECORDING SETUP/i,
  /REQUIRED SAVED REFERENCE PHOTOS/i,
  /AUDIO RULE/i,
  /FPS/i,
  /CLIP-DURATION RANGE/i,
  /ORDERED VISIBLE ACTIONS/i,
  /PASS CRITERIA/i,
  /FAIL CRITERIA/i,
  /NEEDS_REVIEW CRITERIA/i,
  /OUT-OF-SCOPE CLAIMS/i,
  /SAFETY NOTES/i,
  /JSON-ONLY RESPONSE INSTRUCTION/i,
];

const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("BH041-BH050 lightweight validation", () => {
  it("exports exactly BH041-BH050 and brings total BH count to 50", () => {
    expect(BH041_BH050).toHaveLength(10);
    expect(BH041_BH050.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(BH041_BH050.map((activity) => activity.id)).size).toBe(10);
    expect(ALL_BH_ACTIVITIES).toHaveLength(50);
    expect(new Set(ALL_BH_ACTIVITIES.map((activity) => activity.id)).size).toBe(50);
  });

  it("uses Better Behavior at Home and order indexes 41-50", () => {
    BH041_BH050.forEach((activity, index) => {
      expect(activity.category).toBe("BETTER_BEHAVIOR_AT_HOME");
      expect(activity.sequenceNumber).toBe(41 + index);
      expect(activity.orderIndex).toBe(41 + index);
    });
  });

  it("has all required non-empty activity fields", () => {
    BH041_BH050.forEach((activity) => {
      expect(activity.id).toBeTruthy();
      expect(activity.title).toBeTruthy();
      expect(activity.lessonGoal).toBeTruthy();
      expect(activity.visibleCheckpoint).toBeTruthy();
      expect(activity.tutorialSteps.length).toBeGreaterThan(0);
      expect(activity.recordingSetup.setupInstructions.length).toBeGreaterThan(0);
      expect(activity.requiredReferenceAssets.length).toBeGreaterThan(0);
      expect(activity.passCriteria.length).toBeGreaterThan(0);
      expect(activity.failCriteria.length).toBeGreaterThan(0);
      expect(activity.needsReviewCriteria.length).toBeGreaterThan(0);
      expect(activity.outOfScopeClaims.length).toBeGreaterThan(0);
      expect(activity.safetyNotes.length).toBeGreaterThan(0);
      expect(activity.vlmPrompt.trim().length).toBeGreaterThan(500);
    });
  });

  it("has correct reference-photo mapping", () => {
    BH041_BH050.forEach((activity) => {
      expect(activity.requiredReferenceAssets).toEqual(EXPECTED_REFERENCES[activity.id]);
      expect(activity.requiredReferenceAssets).toContain("DOG_PROFILE");
    });
  });

  it("has correct audio mapping", () => {
    BH041_BH050.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      if (EXPECTED_AUDIO[activity.id]) {
        expect(activity.vlmPrompt).toMatch(/Audio is required/i);
        expect(activity.needsReviewCriteria.join(" ")).toMatch(/audio|cue|timing/i);
      }
    });
  });

  it("has correct FPS and clip duration ranges", () => {
    BH041_BH050.forEach((activity) => {
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.minClipSeconds).toBeLessThan(activity.maxClipSeconds);
      expect(activity.minClipSeconds).toBeGreaterThan(0);
    });
    expect(BH041_BH050.find((activity) => activity.id === "BH047")?.vlmPrompt).toMatch(/5 FPS during toy release and 3 FPS during mat travel/i);
    expect(BH041_BH050.find((activity) => activity.id === "BH050")?.vlmPrompt).toMatch(/component-appropriate FPS/i);
  });

  it("has valid prerequisite and next links with BH050 terminal", () => {
    BH041_BH050.forEach((activity) => {
      const expectedPrerequisites = EXPECTED_PREREQUISITES[activity.id];
      const expectedNext = EXPECTED_NEXT[activity.id];
      expect(activity.prerequisites).toEqual(expectedPrerequisites);
      expect(activity.prerequisiteActivityId).toBe(expectedPrerequisites[0] ?? null);
      expect(activity.nextActivityId).toBe(expectedNext);
      expect(activity.harderActivityId).toBe(expectedNext);
      expectedPrerequisites.forEach((id) => {
        expect(ALL_KNOWN_IDS.has(id)).toBe(true);
      });
      if (expectedNext) {
        expect(ALL_KNOWN_IDS.has(expectedNext)).toBe(true);
      }
    });
    expect(BH041_BH050.find((activity) => activity.id === "BH050")?.nextActivityId).toBeNull();
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    BH041_BH050.forEach((activity) => {
      REQUIRED_PROMPT_SECTIONS.forEach((section) => {
        expect(activity.vlmPrompt).toMatch(section);
      });
      expect(activity.vlmPrompt).toContain(activity.id);
      expect(activity.vlmPrompt).toContain(activity.title);
      expect(activity.vlmPrompt).toContain(activity.visibleCheckpoint);
      expect(activity.vlmPrompt).toMatch(/PASS \| FAIL \| NEEDS_REVIEW/);
      expect(activity.vlmPrompt).toMatch(/Missing evidence is never FAIL/i);
      expect(activity.vlmPrompt).not.toMatch(/Did the dog complete the activity\?/i);
    });
  });

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake Gemini verdict path", () => {
    BH041_BH050.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(pass|unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
