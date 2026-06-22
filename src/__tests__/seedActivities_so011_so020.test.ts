import { SO001_SO010 } from "@/data/seedCatalog/so001_so010";
import { SO011_SO020 } from "@/data/seedCatalog/so011_so020";

const EXPECTED_IDS = [
  "SO011",
  "SO012",
  "SO013",
  "SO014",
  "SO015",
  "SO016",
  "SO017",
  "SO018",
  "SO019",
  "SO020",
];

const ALL_KNOWN_IDS = new Set([
  ...SO001_SO010.map((activity) => activity.id),
  ...EXPECTED_IDS,
  "SO021",
]);

const EXPECTED_AUDIO: Record<string, boolean> = {
  SO011: false,
  SO012: false,
  SO013: false,
  SO014: false,
  SO015: true,
  SO016: false,
  SO017: false,
  SO018: true,
  SO019: true,
  SO020: true,
};

const EXPECTED_FPS: Record<string, number> = {
  SO011: 2,
  SO012: 3,
  SO013: 3,
  SO014: 3,
  SO015: 3,
  SO016: 3,
  SO017: 3,
  SO018: 5,
  SO019: 5,
  SO020: 5,
};

const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  SO011: ["SO010"],
  SO012: ["SO007"],
  SO013: ["SO011", "SO012"],
  SO014: ["SO012", "SO013"],
  SO015: ["SO005"],
  SO016: ["SO002"],
  SO017: ["SO016"],
  SO018: ["SO002"],
  SO019: ["SO018"],
  SO020: ["SO019"],
};

const EXPECTED_NEXT: Record<string, string | null> = {
  SO011: "SO012",
  SO012: "SO013",
  SO013: "SO014",
  SO014: "SO015",
  SO015: "SO016",
  SO016: "SO017",
  SO017: "SO018",
  SO018: "SO019",
  SO019: "SO020",
  SO020: "SO021",
};

const REQUIRED_PROMPT_SECTIONS = [
  /ACTIVITY ID/i,
  /ACTIVITY TITLE/i,
  /EXPECTED START STATE/i,
  /VISIBLE CHECKPOINT/i,
  /RECORDING SETUP/i,
  /REQUIRED REFERENCES/i,
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

describe("SO011-SO020 lightweight validation", () => {
  it("exports exactly SO011-SO020", () => {
    expect(SO011_SO020).toHaveLength(10);
    expect(SO011_SO020.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(SO011_SO020.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Safety and Obedience and order indexes 11-20", () => {
    SO011_SO020.forEach((activity, index) => {
      expect(activity.category).toBe("SAFETY_AND_OBEDIENCE");
      expect(activity.sequenceNumber).toBe(11 + index);
      expect(activity.orderIndex).toBe(11 + index);
    });
  });

  it("has all required non-empty activity fields", () => {
    SO011_SO020.forEach((activity) => {
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
    SO011_SO020.forEach((activity) => {
      expect(activity.requiredReferenceAssets).toEqual(["DOG_PROFILE"]);
      expect(activity.vlmPrompt).toMatch(/DOG_PROFILE/);
      expect(activity.recordingRequirements.targetObjectRequiredInFrame).toBe(false);
    });
  });

  it("has correct audio mapping", () => {
    SO011_SO020.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      if (EXPECTED_AUDIO[activity.id]) {
        expect(activity.vlmPrompt).toMatch(/Audio is required/i);
        expect(activity.needsReviewCriteria.join(" ")).toMatch(/audio|cue/i);
      }
    });
  });

  it("has correct FPS and recall activities use 5 FPS", () => {
    SO011_SO020.forEach((activity) => {
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.minClipSeconds).toBeLessThan(activity.maxClipSeconds);
      expect(activity.minClipSeconds).toBeGreaterThan(0);
    });
    ["SO018", "SO019", "SO020"].forEach((id) => {
      expect(SO011_SO020.find((activity) => activity.id === id)?.fps).toBe(5);
    });
  });

  it("has valid prerequisite and next links", () => {
    SO011_SO020.forEach((activity) => {
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
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    SO011_SO020.forEach((activity) => {
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
    SO011_SO020.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(pass|unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
