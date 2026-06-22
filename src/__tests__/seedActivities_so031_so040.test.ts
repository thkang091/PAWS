import { SO001_SO010 } from "@/data/seedCatalog/so001_so010";
import { SO011_SO020 } from "@/data/seedCatalog/so011_so020";
import { SO021_SO030 } from "@/data/seedCatalog/so021_so030";
import { SO031_SO040 } from "@/data/seedCatalog/so031_so040";

const EXPECTED_IDS = [
  "SO031",
  "SO032",
  "SO033",
  "SO034",
  "SO035",
  "SO036",
  "SO037",
  "SO038",
  "SO039",
  "SO040",
];

const ALL_KNOWN_IDS = new Set([
  ...SO001_SO010.map((activity) => activity.id),
  ...SO011_SO020.map((activity) => activity.id),
  ...SO021_SO030.map((activity) => activity.id),
  ...EXPECTED_IDS,
  "SO041",
]);

const EXPECTED_REFERENCES: Record<string, string[]> = {
  SO031: ["DOG_PROFILE"],
  SO032: ["DOG_PROFILE"],
  SO033: ["DOG_PROFILE"],
  SO034: ["DOG_PROFILE"],
  SO035: ["DOG_PROFILE", "TARGET_DOORWAY"],
  SO036: ["DOG_PROFILE", "TARGET_DOORWAY"],
  SO037: ["DOG_PROFILE"],
  SO038: ["DOG_PROFILE"],
  SO039: ["DOG_PROFILE", "TARGET_TOY"],
  SO040: ["DOG_PROFILE", "TARGET_TOY"],
};

const EXPECTED_AUDIO: Record<string, boolean> = {
  SO031: true,
  SO032: true,
  SO033: true,
  SO034: true,
  SO035: true,
  SO036: true,
  SO037: false,
  SO038: false,
  SO039: true,
  SO040: true,
};

const EXPECTED_FPS: Record<string, number> = {
  SO031: 3,
  SO032: 5,
  SO033: 5,
  SO034: 5,
  SO035: 2,
  SO036: 2,
  SO037: 3,
  SO038: 3,
  SO039: 5,
  SO040: 5,
};

const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  SO031: ["SO001"],
  SO032: ["SO031"],
  SO033: ["SO016"],
  SO034: ["SO033"],
  SO035: ["SO015"],
  SO036: ["SO035"],
  SO037: [],
  SO038: ["SO037"],
  SO039: [],
  SO040: ["SO039"],
};

const EXPECTED_NEXT: Record<string, string | null> = {
  SO031: "SO032",
  SO032: "SO033",
  SO033: "SO034",
  SO034: "SO035",
  SO035: "SO036",
  SO036: "SO037",
  SO037: "SO038",
  SO038: "SO039",
  SO039: "SO040",
  SO040: "SO041",
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

describe("SO031-SO040 lightweight validation", () => {
  it("exports exactly SO031-SO040", () => {
    expect(SO031_SO040).toHaveLength(10);
    expect(SO031_SO040.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(SO031_SO040.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Safety and Obedience and order indexes 31-40", () => {
    SO031_SO040.forEach((activity, index) => {
      expect(activity.category).toBe("SAFETY_AND_OBEDIENCE");
      expect(activity.sequenceNumber).toBe(31 + index);
      expect(activity.orderIndex).toBe(31 + index);
    });
  });

  it("has all required non-empty activity fields", () => {
    SO031_SO040.forEach((activity) => {
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

  it("has correct asset mapping", () => {
    SO031_SO040.forEach((activity) => {
      expect(activity.requiredReferenceAssets).toEqual(EXPECTED_REFERENCES[activity.id]);
      expect(activity.requiredReferenceAssets).toContain("DOG_PROFILE");
    });
    ["SO035", "SO036"].forEach((id) => {
      expect(SO031_SO040.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_DOORWAY");
    });
    ["SO039", "SO040"].forEach((id) => {
      expect(SO031_SO040.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_TOY");
    });
    expect(SO031_SO040.find((activity) => activity.id === "SO038")?.vlmPrompt).toMatch(/staged visible floor food|staged-food setup/i);
  });

  it("has correct audio mapping", () => {
    SO031_SO040.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      if (EXPECTED_AUDIO[activity.id]) {
        expect(activity.vlmPrompt).toMatch(/Audio is required/i);
        expect(activity.needsReviewCriteria.join(" ")).toMatch(/audio|cue|timing/i);
      }
    });
  });

  it("has correct FPS mapping", () => {
    SO031_SO040.forEach((activity) => {
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.minClipSeconds).toBeLessThan(activity.maxClipSeconds);
      expect(activity.minClipSeconds).toBeGreaterThan(0);
    });
  });

  it("has valid prerequisite and next links", () => {
    SO031_SO040.forEach((activity) => {
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
    SO031_SO040.forEach((activity) => {
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
    SO031_SO040.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(pass|unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
