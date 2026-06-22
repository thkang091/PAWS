import { CT001_CT010 } from "@/data/seedCatalog/ct001_ct010";

const EXPECTED_IDS = ["CT001", "CT002", "CT003", "CT004", "CT005", "CT006", "CT007", "CT008", "CT009", "CT010"];
const ALL_KNOWN_IDS = new Set([...EXPECTED_IDS, "CT011"]);
const EXPECTED_FPS: Record<string, number> = { CT001: 3, CT002: 3, CT003: 3, CT004: 3, CT005: 2, CT006: 5, CT007: 5, CT008: 5, CT009: 3, CT010: 5 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  CT001: [],
  CT002: ["CT001"],
  CT003: ["CT002"],
  CT004: ["CT003"],
  CT005: ["CT004"],
  CT006: ["CT001"],
  CT007: ["CT006"],
  CT008: ["CT006", "CT007"],
  CT009: ["CT001"],
  CT010: ["CT001"],
};
const EXPECTED_NEXT: Record<string, string> = { CT001: "CT002", CT002: "CT003", CT003: "CT004", CT004: "CT005", CT005: "CT006", CT006: "CT007", CT007: "CT008", CT008: "CT009", CT009: "CT010", CT010: "CT011" };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REQUIRED SAVED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("CT001-CT010 lightweight validation", () => {
  it("exports exactly CT001-CT010", () => {
    expect(CT001_CT010).toHaveLength(10);
    expect(CT001_CT010.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(CT001_CT010.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Cool Tricks and Games and order indexes 1-10", () => {
    CT001_CT010.forEach((activity, index) => {
      expect(activity.category).toBe("COOL_TRICKS_AND_GAMES");
      expect(activity.sequenceNumber).toBe(1 + index);
      expect(activity.orderIndex).toBe(1 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    CT001_CT010.forEach((activity) => {
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
      expect(activity.requiredReferenceAssets).toEqual(["DOG_PROFILE"]);
      expect(activity.vlmPrompt.trim().length).toBeGreaterThan(500);
    });
    ["CT004", "CT005"].forEach((id) => {
      const activity = CT001_CT010.find((item) => item.id === id);
      expect(activity?.recordingRequirements.targetObjectRequiredInFrame).toBe(true);
      expect(activity?.vlmPrompt).toMatch(/TARGET_PLATFORM is required when/i);
      expect(activity?.vlmPrompt).toMatch(/registered platform identity is unclear, return NEEDS_REVIEW/i);
    });
  });

  it("has correct audio and FPS rules", () => {
    CT001_CT010.forEach((activity) => {
      expect(activity.audioRequired).toBe(false);
      expect(activity.recordingRequirements.audioRequired).toBe(false);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
    });
  });

  it("has valid prerequisite and next links", () => {
    CT001_CT010.forEach((activity) => {
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0] ?? null);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      expect(ALL_KNOWN_IDS.has(EXPECTED_NEXT[activity.id])).toBe(true);
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    CT001_CT010.forEach((activity) => {
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
    CT001_CT010.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
