import { BH001_BH010 } from "@/data/seedCatalog/bh001_bh010";
import { BH011_BH020 } from "@/data/seedCatalog/bh011_bh020";
import { BH021_BH030 } from "@/data/seedCatalog/bh021_bh030";

const EXPECTED_IDS = [
  "BH021",
  "BH022",
  "BH023",
  "BH024",
  "BH025",
  "BH026",
  "BH027",
  "BH028",
  "BH029",
  "BH030",
];

const ALL_KNOWN_IDS = new Set([
  ...BH001_BH010.map((activity) => activity.id),
  ...BH011_BH020.map((activity) => activity.id),
  ...EXPECTED_IDS,
  "BH031",
]);

const EXPECTED_REFERENCES: Record<string, string[]> = {
  BH021: ["DOG_PROFILE"],
  BH022: ["DOG_PROFILE"],
  BH023: ["DOG_PROFILE", "TARGET_MAT"],
  BH024: ["DOG_PROFILE", "TARGET_MAT"],
  BH025: ["DOG_PROFILE", "TARGET_MAT"],
  BH026: ["DOG_PROFILE", "TARGET_TOY"],
  BH027: ["DOG_PROFILE", "TARGET_TOY"],
  BH028: ["DOG_PROFILE", "TARGET_TOY"],
  BH029: ["DOG_PROFILE"],
  BH030: ["DOG_PROFILE"],
};

const EXPECTED_AUDIO: Record<string, boolean> = {
  BH021: false,
  BH022: false,
  BH023: true,
  BH024: true,
  BH025: true,
  BH026: true,
  BH027: true,
  BH028: true,
  BH029: false,
  BH030: false,
};

const EXPECTED_FPS: Record<string, number> = {
  BH021: 3,
  BH022: 3,
  BH023: 3,
  BH024: 2,
  BH025: 3,
  BH026: 5,
  BH027: 5,
  BH028: 5,
  BH029: 3,
  BH030: 3,
};

const EXPECTED_PREREQUISITES: Record<string, string | null> = {
  BH021: null,
  BH022: "BH021",
  BH023: "BH007",
  BH024: "BH023",
  BH025: "BH024",
  BH026: null,
  BH027: "BH026",
  BH028: "BH027",
  BH029: null,
  BH030: "BH029",
};

const EXPECTED_NEXT: Record<string, string | null> = {
  BH021: "BH022",
  BH022: "BH023",
  BH023: "BH024",
  BH024: "BH025",
  BH025: "BH026",
  BH026: "BH027",
  BH027: "BH028",
  BH028: "BH029",
  BH029: "BH030",
  BH030: "BH031",
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

describe("BH021-BH030 lightweight validation", () => {
  it("exports exactly BH021-BH030", () => {
    expect(BH021_BH030).toHaveLength(10);
    expect(BH021_BH030.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(BH021_BH030.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Better Behavior at Home and order indexes 21-30", () => {
    BH021_BH030.forEach((activity, index) => {
      expect(activity.category).toBe("BETTER_BEHAVIOR_AT_HOME");
      expect(activity.sequenceNumber).toBe(21 + index);
      expect(activity.orderIndex).toBe(21 + index);
    });
  });

  it("has all required non-empty activity fields", () => {
    BH021_BH030.forEach((activity) => {
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
    BH021_BH030.forEach((activity) => {
      expect(activity.requiredReferenceAssets).toEqual(EXPECTED_REFERENCES[activity.id]);
      expect(activity.requiredReferenceAssets).toContain("DOG_PROFILE");
    });
    ["BH023", "BH024", "BH025"].forEach((id) => {
      const activity = BH021_BH030.find((item) => item.id === id);
      expect(activity?.requiredReferenceAssets).toContain("TARGET_MAT");
      expect(activity?.recordingRequirements.targetObjectRequiredInFrame).toBe(true);
    });
    ["BH026", "BH027", "BH028"].forEach((id) => {
      const activity = BH021_BH030.find((item) => item.id === id);
      expect(activity?.requiredReferenceAssets).toContain("TARGET_TOY");
      expect(activity?.recordingRequirements.targetObjectRequiredInFrame).toBe(true);
    });
    const bh030 = BH021_BH030.find((activity) => activity.id === "BH030");
    expect(bh030?.requiredReferenceAssets).toEqual(["DOG_PROFILE"]);
    expect(bh030?.vlmPrompt).toMatch(/covered floor-food setup|covered food setup/i);
  });

  it("has correct audio mapping", () => {
    BH021_BH030.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      if (EXPECTED_AUDIO[activity.id]) {
        expect(activity.vlmPrompt).toMatch(/Audio is required/i);
        expect(activity.needsReviewCriteria.join(" ")).toMatch(/audio|cue|inaudible/i);
      }
    });
  });

  it("has correct FPS and clip duration ranges", () => {
    BH021_BH030.forEach((activity) => {
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.minClipSeconds).toBeLessThan(activity.maxClipSeconds);
      expect(activity.minClipSeconds).toBeGreaterThan(0);
    });
  });

  it("has valid prerequisite and next links", () => {
    BH021_BH030.forEach((activity) => {
      const expectedPrerequisite = EXPECTED_PREREQUISITES[activity.id];
      const expectedNext = EXPECTED_NEXT[activity.id];
      expect(activity.prerequisiteActivityId).toBe(expectedPrerequisite);
      expect(activity.prerequisites).toEqual(expectedPrerequisite ? [expectedPrerequisite] : []);
      expect(activity.nextActivityId).toBe(expectedNext);
      expect(activity.harderActivityId).toBe(expectedNext);
      if (expectedPrerequisite) {
        expect(ALL_KNOWN_IDS.has(expectedPrerequisite)).toBe(true);
      }
      if (expectedNext) {
        expect(ALL_KNOWN_IDS.has(expectedNext)).toBe(true);
      }
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    BH021_BH030.forEach((activity) => {
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
    BH021_BH030.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(pass|unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
