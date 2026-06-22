import { HH001_HH010 } from "@/data/seedCatalog/hh001_hh010";

const EXPECTED_IDS = ["HH001", "HH002", "HH003", "HH004", "HH005", "HH006", "HH007", "HH008", "HH009", "HH010"];
const ALL_KNOWN_IDS = new Set([...EXPECTED_IDS, "HH011"]);
const EXPECTED_REFERENCES: Record<string, string[]> = {
  HH001: ["DOG_PROFILE"],
  HH002: ["DOG_PROFILE", "TARGET_MAT"],
  HH003: ["DOG_PROFILE", "TARGET_MAT"],
  HH004: ["DOG_PROFILE", "TARGET_MAT"],
  HH005: ["DOG_PROFILE", "TARGET_CRATE"],
  HH006: ["DOG_PROFILE", "TARGET_CRATE"],
  HH007: ["DOG_PROFILE", "TARGET_TOY"],
  HH008: ["DOG_PROFILE", "TARGET_TOY"],
  HH009: ["DOG_PROFILE", "TARGET_TOY"],
  HH010: ["DOG_PROFILE", "TARGET_TOY"],
};
const EXPECTED_AUDIO: Record<string, boolean> = { HH001: false, HH002: false, HH003: false, HH004: false, HH005: false, HH006: false, HH007: false, HH008: false, HH009: false, HH010: false };
const EXPECTED_FPS: Record<string, number> = { HH001: 3, HH002: 3, HH003: 3, HH004: 3, HH005: 3, HH006: 3, HH007: 5, HH008: 5, HH009: 5, HH010: 5 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  HH001: [],
  HH002: ["HH001"],
  HH003: ["HH002"],
  HH004: ["HH003"],
  HH005: ["HH004"],
  HH006: ["HH005"],
  HH007: ["HH001"],
  HH008: ["HH007"],
  HH009: ["HH008"],
  HH010: ["HH009"],
};
const EXPECTED_NEXT: Record<string, string> = { HH001: "HH002", HH002: "HH003", HH003: "HH004", HH004: "HH005", HH005: "HH006", HH006: "HH007", HH007: "HH008", HH008: "HH009", HH009: "HH010", HH010: "HH011" };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REQUIRED SAVED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("HH001-HH010 lightweight validation", () => {
  it("exports exactly HH001-HH010", () => {
    expect(HH001_HH010).toHaveLength(10);
    expect(HH001_HH010.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(HH001_HH010.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Helpful Skills Around the House and order indexes 1-10", () => {
    HH001_HH010.forEach((activity, index) => {
      expect(activity.category).toBe("HELPFUL_SKILLS_AROUND_THE_HOUSE");
      expect(activity.sequenceNumber).toBe(1 + index);
      expect(activity.orderIndex).toBe(1 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    HH001_HH010.forEach((activity) => {
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
    ["HH002", "HH003", "HH004"].forEach((id) => expect(HH001_HH010.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_MAT"));
    ["HH005", "HH006"].forEach((id) => expect(HH001_HH010.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_CRATE"));
    ["HH007", "HH008", "HH009", "HH010"].forEach((id) => expect(HH001_HH010.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_TOY"));
  });

  it("has correct audio and FPS rules", () => {
    HH001_HH010.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
    });
    ["HH003", "HH004", "HH006"].forEach((id) => expect(HH001_HH010.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/Audio is required when .*cue timing is judged/i));
  });

  it("has valid prerequisite and next links", () => {
    HH001_HH010.forEach((activity) => {
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0] ?? null);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      expect(ALL_KNOWN_IDS.has(EXPECTED_NEXT[activity.id])).toBe(true);
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    HH001_HH010.forEach((activity) => {
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
    HH001_HH010.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
