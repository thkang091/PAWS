import { SO001_SO010 } from "@/data/seedCatalog/so001_so010";

const EXPECTED_IDS = [
  "SO001",
  "SO002",
  "SO003",
  "SO004",
  "SO005",
  "SO006",
  "SO007",
  "SO008",
  "SO009",
  "SO010",
];

const ALL_KNOWN_IDS = new Set([...EXPECTED_IDS, "SO011"]);

const EXPECTED_AUDIO: Record<string, boolean> = {
  SO001: true,
  SO002: true,
  SO003: true,
  SO004: false,
  SO005: false,
  SO006: false,
  SO007: false,
  SO008: false,
  SO009: false,
  SO010: false,
};

const EXPECTED_FPS: Record<string, number> = {
  SO001: 3,
  SO002: 3,
  SO003: 3,
  SO004: 3,
  SO005: 2,
  SO006: 2,
  SO007: 3,
  SO008: 2,
  SO009: 2,
  SO010: 3,
};

const REQUIRED_PROMPT_SECTIONS = [
  /ACTIVITY ID/i,
  /ACTIVITY TITLE/i,
  /EXPECTED START STATE/i,
  /VISIBLE CHECKPOINT/i,
  /RECORDING SETUP/i,
  /REQUIRED DOG_PROFILE REFERENCES/i,
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

describe("SO001-SO010 lightweight validation", () => {
  it("exports exactly SO001-SO010", () => {
    expect(SO001_SO010).toHaveLength(10);
    expect(SO001_SO010.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(SO001_SO010.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Safety and Obedience and order indexes 1-10", () => {
    SO001_SO010.forEach((activity, index) => {
      expect(activity.category).toBe("SAFETY_AND_OBEDIENCE");
      expect(activity.sequenceNumber).toBe(1 + index);
      expect(activity.orderIndex).toBe(1 + index);
    });
  });

  it("has all required non-empty activity fields", () => {
    SO001_SO010.forEach((activity) => {
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

  it("requires only DOG_PROFILE references", () => {
    SO001_SO010.forEach((activity) => {
      expect(activity.requiredReferenceAssets).toEqual(["DOG_PROFILE"]);
      expect(activity.vlmPrompt).toMatch(/DOG_PROFILE/);
      expect(activity.recordingRequirements.targetObjectRequiredInFrame).toBe(false);
    });
  });

  it("has correct audio mapping", () => {
    SO001_SO010.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      if (EXPECTED_AUDIO[activity.id]) {
        expect(activity.vlmPrompt).toMatch(/Audio is required/i);
        expect(activity.needsReviewCriteria.join(" ")).toMatch(/audio|cue|inaudible/i);
      }
    });
  });

  it("has correct FPS and clip duration ranges", () => {
    SO001_SO010.forEach((activity) => {
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.minClipSeconds).toBeLessThan(activity.maxClipSeconds);
      expect(activity.minClipSeconds).toBeGreaterThan(0);
    });
  });

  it("has valid prerequisite and next links", () => {
    SO001_SO010.forEach((activity, index) => {
      const expectedPrerequisite = activity.id === "SO001" ? null : EXPECTED_IDS[index - 1];
      const expectedNext = activity.id === "SO010" ? "SO011" : EXPECTED_IDS[index + 1];
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
    SO001_SO010.forEach((activity) => {
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

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake Gemini semantic verdict path", () => {
    SO001_SO010.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(pass|unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
