import { BW001_BW010 } from "@/data/seedCatalog/bw001_bw010";

const EXPECTED_IDS = [
  "BW001",
  "BW002",
  "BW003",
  "BW004",
  "BW005",
  "BW006",
  "BW007",
  "BW008",
  "BW009",
  "BW010",
];

const ALL_KNOWN_IDS = new Set([...EXPECTED_IDS, "BW011"]);

const EXPECTED_AUDIO: Record<string, boolean> = {
  BW001: false,
  BW002: false,
  BW003: false,
  BW004: false,
  BW005: false,
  BW006: false,
  BW007: false,
  BW008: false,
  BW009: false,
  BW010: false,
};

const EXPECTED_FPS: Record<string, number> = {
  BW001: 3,
  BW002: 3,
  BW003: 3,
  BW004: 3,
  BW005: 3,
  BW006: 3,
  BW007: 3,
  BW008: 3,
  BW009: 3,
  BW010: 3,
};

const REQUIRED_PROMPT_SECTIONS = [
  /ACTIVITY ID/i,
  /ACTIVITY TITLE/i,
  /EXPECTED START STATE/i,
  /VISIBLE CHECKPOINT/i,
  /RECORDING SETUP/i,
  /SAVED REFERENCE-PHOTO RULES/i,
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

describe("BW001-BW010 lightweight validation", () => {
  it("exports exactly BW001-BW010", () => {
    expect(BW001_BW010).toHaveLength(10);
    expect(BW001_BW010.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(BW001_BW010.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Better Walks and order indexes 1-10", () => {
    BW001_BW010.forEach((activity, index) => {
      expect(activity.category).toBe("BETTER_WALKS");
      expect(activity.sequenceNumber).toBe(1 + index);
      expect(activity.orderIndex).toBe(1 + index);
    });
  });

  it("has all required non-empty activity fields", () => {
    BW001_BW010.forEach((activity) => {
      expect(activity.id).toBeTruthy();
      expect(activity.title).toBeTruthy();
      expect(activity.lessonGoal).toBeTruthy();
      expect(activity.visibleCheckpoint).toBeTruthy();
      expect(activity.tutorialSteps.length).toBeGreaterThan(0);
      expect(activity.recordingSetup.setupInstructions.length).toBeGreaterThan(0);
      expect(activity.requiredReferenceAssets).toEqual(["DOG_PROFILE"]);
      expect(activity.passCriteria.length).toBeGreaterThan(0);
      expect(activity.failCriteria.length).toBeGreaterThan(0);
      expect(activity.needsReviewCriteria.length).toBeGreaterThan(0);
      expect(activity.outOfScopeClaims.length).toBeGreaterThan(0);
      expect(activity.safetyNotes.length).toBeGreaterThan(0);
      expect(activity.vlmPrompt.trim().length).toBeGreaterThan(500);
    });
  });

  it("has correct gear and leash visibility rules", () => {
    expect(BW001_BW010.find((activity) => activity.id === "BW001")?.vlmPrompt).toMatch(/Harness must be visible/i);
    expect(BW001_BW010.find((activity) => activity.id === "BW002")?.vlmPrompt).toMatch(/Leash clip point must be visible/i);
    ["BW005", "BW006", "BW007", "BW008", "BW009", "BW010"].forEach((id) => {
      const activity = BW001_BW010.find((item) => item.id === id);
      expect(activity?.recordingRequirements.targetObjectRequiredInFrame).toBe(true);
      expect(activity?.vlmPrompt).toMatch(/Leash.*visible|visible leash/i);
    });
  });

  it("has correct audio mapping", () => {
    BW001_BW010.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
    });
  });

  it("has correct FPS and clip duration ranges", () => {
    BW001_BW010.forEach((activity) => {
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.minClipSeconds).toBeLessThan(activity.maxClipSeconds);
      expect(activity.minClipSeconds).toBeGreaterThan(0);
    });
  });

  it("has valid prerequisite and next links", () => {
    BW001_BW010.forEach((activity, index) => {
      const expectedPrerequisite = activity.id === "BW001" ? null : EXPECTED_IDS[index - 1];
      const expectedNext = activity.id === "BW010" ? "BW011" : EXPECTED_IDS[index + 1];
      expect(activity.prerequisiteActivityId).toBe(expectedPrerequisite);
      expect(activity.prerequisites).toEqual(expectedPrerequisite ? [expectedPrerequisite] : []);
      expect(activity.nextActivityId).toBe(expectedNext);
      expect(activity.harderActivityId).toBe(expectedNext);
      if (expectedPrerequisite) {
        expect(ALL_KNOWN_IDS.has(expectedPrerequisite)).toBe(true);
      }
      expect(ALL_KNOWN_IDS.has(expectedNext)).toBe(true);
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    BW001_BW010.forEach((activity) => {
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
    BW001_BW010.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(pass|unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
