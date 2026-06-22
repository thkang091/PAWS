import { BH001_BH010 } from "@/data/seedCatalog/bh001_bh010";
import { BH011_BH020 } from "@/data/seedCatalog/bh011_bh020";

const EXPECTED_IDS = [
  "BH011",
  "BH012",
  "BH013",
  "BH014",
  "BH015",
  "BH016",
  "BH017",
  "BH018",
  "BH019",
  "BH020",
];

const ALL_KNOWN_IDS = new Set([
  ...BH001_BH010.map((activity) => activity.id),
  ...EXPECTED_IDS,
  "BH021",
]);

const EXPECTED_REFERENCES: Record<string, string[]> = {
  BH011: ["DOG_PROFILE", "TARGET_MAT_OR_TARGET_CRATE"],
  BH012: ["DOG_PROFILE", "TARGET_CRATE"],
  BH013: ["DOG_PROFILE", "TARGET_CRATE"],
  BH014: ["DOG_PROFILE", "TARGET_DOORWAY"],
  BH015: ["DOG_PROFILE", "TARGET_DOORWAY"],
  BH016: ["DOG_PROFILE", "TARGET_DOORWAY"],
  BH017: ["DOG_PROFILE", "TARGET_DOORWAY"],
  BH018: ["DOG_PROFILE", "TARGET_BOWL"],
  BH019: ["DOG_PROFILE", "TARGET_BOWL"],
  BH020: ["DOG_PROFILE", "TARGET_BOWL"],
};

const EXPECTED_AUDIO: Record<string, boolean> = {
  BH011: false,
  BH012: false,
  BH013: false,
  BH014: true,
  BH015: true,
  BH016: true,
  BH017: true,
  BH018: true,
  BH019: true,
  BH020: true,
};

const EXPECTED_FPS: Record<string, number> = {
  BH011: 3,
  BH012: 3,
  BH013: 3,
  BH014: 3,
  BH015: 2,
  BH016: 2,
  BH017: 3,
  BH018: 3,
  BH019: 2,
  BH020: 2,
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

describe("BH011-BH020 lightweight validation", () => {
  it("exports exactly BH011-BH020", () => {
    expect(BH011_BH020).toHaveLength(10);
    expect(BH011_BH020.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(BH011_BH020.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Better Behavior at Home and order indexes 11-20", () => {
    BH011_BH020.forEach((activity, index) => {
      expect(activity.category).toBe("BETTER_BEHAVIOR_AT_HOME");
      expect(activity.sequenceNumber).toBe(11 + index);
      expect(activity.orderIndex).toBe(11 + index);
    });
  });

  it("has all required non-empty activity fields", () => {
    BH011_BH020.forEach((activity) => {
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
    BH011_BH020.forEach((activity) => {
      expect(activity.requiredReferenceAssets).toEqual(EXPECTED_REFERENCES[activity.id]);
      expect(activity.requiredReferenceAssets).toContain("DOG_PROFILE");
      expect(activity.recordingRequirements.targetObjectRequiredInFrame).toBe(true);
      expect(activity.needsReviewCriteria.join(" ")).toMatch(/identity|matched|unclear|cropped/i);
    });
  });

  it("has correct audio mapping", () => {
    BH011_BH020.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      if (EXPECTED_AUDIO[activity.id]) {
        expect(activity.vlmPrompt).toMatch(/Audio is required/i);
        expect(activity.needsReviewCriteria.join(" ")).toMatch(/audio|cue|inaudible/i);
      }
    });
  });

  it("has correct FPS and clip duration ranges", () => {
    BH011_BH020.forEach((activity) => {
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.minClipSeconds).toBeLessThan(activity.maxClipSeconds);
      expect(activity.minClipSeconds).toBeGreaterThan(0);
    });
  });

  it("has valid prerequisite and next links", () => {
    BH011_BH020.forEach((activity, index) => {
      const expectedPrerequisite = activity.id === "BH011"
        ? "BH007"
        : EXPECTED_IDS[index - 1];
      const expectedNext = activity.id === "BH020"
        ? "BH021"
        : EXPECTED_IDS[index + 1];
      expect(activity.prerequisiteActivityId).toBe(expectedPrerequisite);
      expect(activity.prerequisites).toEqual([expectedPrerequisite]);
      expect(activity.nextActivityId).toBe(expectedNext);
      expect(activity.harderActivityId).toBe(expectedNext);
      expect(ALL_KNOWN_IDS.has(expectedPrerequisite)).toBe(true);
      expect(ALL_KNOWN_IDS.has(expectedNext)).toBe(true);
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    BH011_BH020.forEach((activity) => {
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

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake semantic verdict path", () => {
    BH011_BH020.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(pass|unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
