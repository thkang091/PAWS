import { HH001_HH010 } from "@/data/seedCatalog/hh001_hh010";
import { HH011_HH020 } from "@/data/seedCatalog/hh011_hh020";

const EXPECTED_IDS = ["HH011", "HH012", "HH013", "HH014", "HH015", "HH016", "HH017", "HH018", "HH019", "HH020"];
const ALL_KNOWN_IDS = new Set([...HH001_HH010.map((a) => a.id), ...EXPECTED_IDS, "HH021"]);
const EXPECTED_REFERENCES: Record<string, string[]> = {
  HH011: ["DOG_PROFILE", "TARGET_TOY"],
  HH012: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
  HH013: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
  HH014: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
  HH015: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
  HH016: ["DOG_PROFILE", "TARGET_TOY"],
  HH017: ["DOG_PROFILE", "TARGET_TOY"],
  HH018: ["DOG_PROFILE", "TARGET_TOY"],
  HH019: ["DOG_PROFILE", "TARGET_TOY"],
  HH020: ["DOG_PROFILE", "TARGET_BOX"],
};
const EXPECTED_AUDIO: Record<string, boolean> = { HH011: true, HH012: false, HH013: false, HH014: false, HH015: false, HH016: false, HH017: false, HH018: false, HH019: false, HH020: false };
const EXPECTED_FPS: Record<string, number> = { HH011: 5, HH012: 5, HH013: 5, HH014: 5, HH015: 5, HH016: 5, HH017: 5, HH018: 5, HH019: 5, HH020: 5 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  HH011: ["HH010"],
  HH012: ["HH011"],
  HH013: ["HH012"],
  HH014: ["HH013"],
  HH015: ["HH014"],
  HH016: ["HH010"],
  HH017: ["HH016"],
  HH018: ["HH017"],
  HH019: ["HH018"],
  HH020: ["HH019"],
};
const EXPECTED_NEXT: Record<string, string> = { HH011: "HH012", HH012: "HH013", HH013: "HH014", HH014: "HH015", HH015: "HH016", HH016: "HH017", HH017: "HH018", HH018: "HH019", HH019: "HH020", HH020: "HH021" };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REQUIRED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("HH011-HH020 lightweight validation", () => {
  it("exports exactly HH011-HH020", () => {
    expect(HH011_HH020).toHaveLength(10);
    expect(HH011_HH020.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(HH011_HH020.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Helpful Skills Around the House and order indexes 11-20", () => {
    HH011_HH020.forEach((activity, index) => {
      expect(activity.category).toBe("HELPFUL_SKILLS_AROUND_THE_HOUSE");
      expect(activity.sequenceNumber).toBe(11 + index);
      expect(activity.orderIndex).toBe(11 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    HH011_HH020.forEach((activity) => {
      expect(activity.id).toBeTruthy();
      expect(activity.title).toBeTruthy();
      expect(activity.lessonGoal).toBeTruthy();
      expect(activity.visibleCheckpoint).toBeTruthy();
      expect(activity.tutorialSteps.length).toBeGreaterThan(0);
      expect(activity.recordingSetup).toBeTruthy();
      expect(activity.passCriteria.length).toBeGreaterThan(0);
      expect(activity.failCriteria.length).toBeGreaterThan(0);
      expect(activity.needsReviewCriteria.length).toBeGreaterThan(0);
      expect(activity.outOfScopeClaims.length).toBeGreaterThan(0);
      expect(activity.safetyNotes.length).toBeGreaterThan(0);
      expect(activity.requiredReferenceAssets).toEqual(EXPECTED_REFERENCES[activity.id]);
      expect(activity.requiredReferenceAssets).toContain("DOG_PROFILE");
      expect(activity.vlmPrompt.trim().length).toBeGreaterThan(500);
    });
    expect(HH011_HH020.find((activity) => activity.id === "HH011")?.requiredReferenceAssets).toContain("TARGET_TOY");
    ["HH012", "HH013", "HH014", "HH015"].forEach((id) => {
      expect(HH011_HH020.find((activity) => activity.id === id)?.requiredReferenceAssets).toEqual(["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"]);
    });
    ["HH016", "HH017", "HH018", "HH019"].forEach((id) => expect(HH011_HH020.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_TOY"));
    expect(HH011_HH020.find((activity) => activity.id === "HH020")?.requiredReferenceAssets).toContain("TARGET_BOX");
  });

  it("has correct audio and FPS rules", () => {
    HH011_HH020.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
    });
    expect(HH011_HH020.find((activity) => activity.id === "HH011")?.vlmPrompt).toMatch(/Audio is required/i);
    ["HH016", "HH017"].forEach((id) => expect(HH011_HH020.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/audio.*cue/i));
  });

  it("has valid prerequisite and next links", () => {
    HH011_HH020.forEach((activity) => {
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0] ?? null);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      expect(ALL_KNOWN_IDS.has(EXPECTED_NEXT[activity.id])).toBe(true);
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    HH011_HH020.forEach((activity) => {
      REQUIRED_PROMPT_SECTIONS.forEach((section) => expect(activity.vlmPrompt).toMatch(section));
      expect(activity.vlmPrompt).toContain(activity.id);
      expect(activity.vlmPrompt).toContain(activity.title);
      expect(activity.vlmPrompt).toContain(activity.visibleCheckpoint);
      expect(activity.vlmPrompt).toMatch(/PASS \| FAIL \| NEEDS_REVIEW/);
      expect(activity.vlmPrompt).toMatch(/Missing evidence is never FAIL/i);
      expect(activity.vlmPrompt).not.toMatch(/Did the dog complete the activity\?/i);
    });
  });

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake Gemini verdict path", () => {
    HH011_HH020.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
