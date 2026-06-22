import { SO001_SO010 } from "@/data/seedCatalog/so001_so010";
import { SO011_SO020 } from "@/data/seedCatalog/so011_so020";
import { SO021_SO030 } from "@/data/seedCatalog/so021_so030";

const EXPECTED_IDS = [
  "SO021",
  "SO022",
  "SO023",
  "SO024",
  "SO025",
  "SO026",
  "SO027",
  "SO028",
  "SO029",
  "SO030",
];

const ALL_KNOWN_IDS = new Set([
  ...SO001_SO010.map((activity) => activity.id),
  ...SO011_SO020.map((activity) => activity.id),
  ...EXPECTED_IDS,
  "SO031",
]);

const EXPECTED_FPS: Record<string, number> = {
  SO021: 5,
  SO022: 5,
  SO023: 5,
  SO024: 5,
  SO025: 5,
  SO026: 3,
  SO027: 5,
  SO028: 5,
  SO029: 5,
  SO030: 5,
};

const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  SO021: ["SO020"],
  SO022: ["SO021"],
  SO023: ["SO022"],
  SO024: ["SO023"],
  SO025: ["SO024", "SO015"],
  SO026: ["SO001"],
  SO027: ["SO026"],
  SO028: ["SO027"],
  SO029: ["SO028"],
  SO030: ["SO029"],
};

const EXPECTED_NEXT: Record<string, string | null> = {
  SO021: "SO022",
  SO022: "SO023",
  SO023: "SO024",
  SO024: "SO025",
  SO025: "SO026",
  SO026: "SO027",
  SO027: "SO028",
  SO028: "SO029",
  SO029: "SO030",
  SO030: "SO031",
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

const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as SO027|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("SO021-SO030 lightweight validation", () => {
  it("exports exactly SO021-SO030", () => {
    expect(SO021_SO030).toHaveLength(10);
    expect(SO021_SO030.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(SO021_SO030.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Safety and Obedience and order indexes 21-30", () => {
    SO021_SO030.forEach((activity, index) => {
      expect(activity.category).toBe("SAFETY_AND_OBEDIENCE");
      expect(activity.sequenceNumber).toBe(21 + index);
      expect(activity.orderIndex).toBe(21 + index);
    });
  });

  it("has all required non-empty activity fields", () => {
    SO021_SO030.forEach((activity) => {
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

  it("requires only DOG_PROFILE references and audio for every activity", () => {
    SO021_SO030.forEach((activity) => {
      expect(activity.requiredReferenceAssets).toEqual(["DOG_PROFILE"]);
      expect(activity.audioRequired).toBe(true);
      expect(activity.recordingRequirements.audioRequired).toBe(true);
      expect(activity.vlmPrompt).toMatch(/Audio is required/i);
    });
  });

  it("has correct FPS mapping and recall activities use 5 FPS", () => {
    SO021_SO030.forEach((activity) => {
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.minClipSeconds).toBeLessThan(activity.maxClipSeconds);
      expect(activity.minClipSeconds).toBeGreaterThan(0);
    });
    SO021_SO030.filter((activity) => activity.id !== "SO026").forEach((activity) => {
      expect(activity.fps).toBe(5);
    });
  });

  it("has long-line, whistle, and conditioning evidence rules", () => {
    ["SO021", "SO022"].forEach((id) => {
      const activity = SO021_SO030.find((item) => item.id === id);
      expect(activity?.vlmPrompt).toMatch(/long line/i);
      expect(activity?.passCriteria.join(" ")).toMatch(/Long line is visible/i);
    });
    const conditioning = SO021_SO030.find((activity) => activity.id === "SO026");
    expect(conditioning?.vlmPrompt).toMatch(/Travel or recall is not required/i);
    expect(conditioning?.passCriteria.join(" ")).not.toMatch(/travels toward owner|reaches owner/i);
    ["SO027", "SO028", "SO029", "SO030"].forEach((id) => {
      const activity = SO021_SO030.find((item) => item.id === id);
      expect(activity?.orderedVisibleActions.join(" ")).toMatch(/after the whistle|only after the whistle/i);
      expect(activity?.failCriteria.join(" ")).toMatch(/before whistle/i);
    });
  });

  it("has valid prerequisite and next links", () => {
    SO021_SO030.forEach((activity) => {
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
    SO021_SO030.forEach((activity) => {
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

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake verdict path", () => {
    SO021_SO030.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(pass|unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
