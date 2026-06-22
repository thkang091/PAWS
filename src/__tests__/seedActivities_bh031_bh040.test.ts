import { BH001_BH010 } from "@/data/seedCatalog/bh001_bh010";
import { BH011_BH020 } from "@/data/seedCatalog/bh011_bh020";
import { BH021_BH030 } from "@/data/seedCatalog/bh021_bh030";
import { BH031_BH040 } from "@/data/seedCatalog/bh031_bh040";

const EXPECTED_IDS = [
  "BH031",
  "BH032",
  "BH033",
  "BH034",
  "BH035",
  "BH036",
  "BH037",
  "BH038",
  "BH039",
  "BH040",
];

const ALL_KNOWN_IDS = new Set([
  ...BH001_BH010.map((activity) => activity.id),
  ...BH011_BH020.map((activity) => activity.id),
  ...BH021_BH030.map((activity) => activity.id),
  ...EXPECTED_IDS,
  "BH041",
]);

const EXPECTED_REFERENCES: Record<string, string[]> = {
  BH031: ["DOG_PROFILE"],
  BH032: ["DOG_PROFILE"],
  BH033: ["DOG_PROFILE"],
  BH034: ["DOG_PROFILE"],
  BH035: ["DOG_PROFILE", "TARGET_MAT"],
  BH036: ["DOG_PROFILE", "TARGET_TOY", "TARGET_MAT"],
  BH037: ["DOG_PROFILE", "TARGET_TOY"],
  BH038: ["DOG_PROFILE"],
  BH039: ["DOG_PROFILE"],
  BH040: ["DOG_PROFILE"],
};

const EXPECTED_AUDIO: Record<string, boolean> = {
  BH031: false,
  BH032: false,
  BH033: false,
  BH034: false,
  BH035: false,
  BH036: true,
  BH037: true,
  BH038: true,
  BH039: false,
  BH040: false,
};

const EXPECTED_FPS: Record<string, number> = {
  BH031: 3,
  BH032: 3,
  BH033: 2,
  BH034: 1,
  BH035: 1,
  BH036: 5,
  BH037: 3,
  BH038: 3,
  BH039: 3,
  BH040: 3,
};

const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  BH031: ["BH030"],
  BH032: ["BH031"],
  BH033: ["BH004"],
  BH034: ["BH033"],
  BH035: ["BH034"],
  BH036: ["BH026", "BH033"],
  BH037: ["BH006"],
  BH038: ["BH037"],
  BH039: [],
  BH040: ["BH039"],
};

const EXPECTED_NEXT: Record<string, string | null> = {
  BH031: "BH032",
  BH032: "BH033",
  BH033: "BH034",
  BH034: "BH035",
  BH035: "BH036",
  BH036: "BH037",
  BH037: "BH038",
  BH038: "BH039",
  BH039: "BH040",
  BH040: "BH041",
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

describe("BH031-BH040 lightweight validation", () => {
  it("exports exactly BH031-BH040", () => {
    expect(BH031_BH040).toHaveLength(10);
    expect(BH031_BH040.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(BH031_BH040.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Better Behavior at Home and order indexes 31-40", () => {
    BH031_BH040.forEach((activity, index) => {
      expect(activity.category).toBe("BETTER_BEHAVIOR_AT_HOME");
      expect(activity.sequenceNumber).toBe(31 + index);
      expect(activity.orderIndex).toBe(31 + index);
    });
  });

  it("has all required non-empty activity fields", () => {
    BH031_BH040.forEach((activity) => {
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
    BH031_BH040.forEach((activity) => {
      expect(activity.requiredReferenceAssets).toEqual(EXPECTED_REFERENCES[activity.id]);
      expect(activity.requiredReferenceAssets).toContain("DOG_PROFILE");
    });
    expect(BH031_BH040.find((activity) => activity.id === "BH035")?.requiredReferenceAssets).toContain("TARGET_MAT");
    expect(BH031_BH040.find((activity) => activity.id === "BH036")?.requiredReferenceAssets).toEqual(["DOG_PROFILE", "TARGET_TOY", "TARGET_MAT"]);
    expect(BH031_BH040.find((activity) => activity.id === "BH037")?.requiredReferenceAssets).toContain("TARGET_TOY");
    ["BH031", "BH032"].forEach((id) => {
      expect(BH031_BH040.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/food/i);
    });
    ["BH039", "BH040"].forEach((id) => {
      expect(BH031_BH040.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/leash|harness|gear/i);
    });
  });

  it("has correct audio mapping", () => {
    BH031_BH040.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      if (EXPECTED_AUDIO[activity.id]) {
        expect(activity.vlmPrompt).toMatch(/Audio is required/i);
        expect(activity.needsReviewCriteria.join(" ")).toMatch(/audio|cue/i);
      }
    });
  });

  it("has correct FPS and clip duration ranges", () => {
    BH031_BH040.forEach((activity) => {
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.minClipSeconds).toBeLessThan(activity.maxClipSeconds);
      expect(activity.minClipSeconds).toBeGreaterThan(0);
    });
    expect(BH031_BH040.find((activity) => activity.id === "BH036")?.vlmPrompt).toMatch(/5 FPS during toy release evidence and 3 FPS during travel and settle evidence/i);
  });

  it("has valid prerequisite and next links", () => {
    BH031_BH040.forEach((activity) => {
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
    BH031_BH040.forEach((activity) => {
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
    BH031_BH040.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(pass|unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
