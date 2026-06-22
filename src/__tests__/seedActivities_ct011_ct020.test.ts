import { CT001_CT010 } from "@/data/seedCatalog/ct001_ct010";
import { CT011_CT020 } from "@/data/seedCatalog/ct011_ct020";

const EXPECTED_IDS = ["CT011", "CT012", "CT013", "CT014", "CT015", "CT016", "CT017", "CT018", "CT019", "CT020"];
const ALL_KNOWN_IDS = new Set([...CT001_CT010.map((a) => a.id), ...EXPECTED_IDS, "CT021"]);
const EXPECTED_REFERENCES: Record<string, string[]> = {
  CT011: ["DOG_PROFILE"],
  CT012: ["DOG_PROFILE"],
  CT013: ["DOG_PROFILE"],
  CT014: ["DOG_PROFILE", "TARGET_CONE"],
  CT015: ["DOG_PROFILE", "TARGET_CONE"],
  CT016: ["DOG_PROFILE", "TARGET_CONE"],
  CT017: ["DOG_PROFILE"],
  CT018: ["DOG_PROFILE"],
  CT019: ["DOG_PROFILE"],
  CT020: ["DOG_PROFILE", "TARGET_PLATFORM"],
};
const EXPECTED_FPS: Record<string, number> = { CT011: 5, CT012: 5, CT013: 2, CT014: 5, CT015: 5, CT016: 5, CT017: 5, CT018: 5, CT019: 5, CT020: 3 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  CT011: ["CT010"],
  CT012: ["CT001"],
  CT013: ["CT012"],
  CT014: ["CT001"],
  CT015: ["CT014"],
  CT016: ["CT015"],
  CT017: ["CT012"],
  CT018: ["CT017"],
  CT019: ["CT018"],
  CT020: ["CT005"],
};
const EXPECTED_NEXT: Record<string, string> = { CT011: "CT012", CT012: "CT013", CT013: "CT014", CT014: "CT015", CT015: "CT016", CT016: "CT017", CT017: "CT018", CT018: "CT019", CT019: "CT020", CT020: "CT021" };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REQUIRED SAVED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("CT011-CT020 lightweight validation", () => {
  it("exports exactly CT011-CT020", () => {
    expect(CT011_CT020).toHaveLength(10);
    expect(CT011_CT020.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(CT011_CT020.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Cool Tricks and Games and order indexes 11-20", () => {
    CT011_CT020.forEach((activity, index) => {
      expect(activity.category).toBe("COOL_TRICKS_AND_GAMES");
      expect(activity.sequenceNumber).toBe(11 + index);
      expect(activity.orderIndex).toBe(11 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    CT011_CT020.forEach((activity) => {
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
    ["CT014", "CT015", "CT016"].forEach((id) => {
      const activity = CT011_CT020.find((item) => item.id === id);
      expect(activity?.requiredReferenceAssets).toContain("TARGET_CONE");
      expect(activity?.recordingRequirements.targetObjectRequiredInFrame).toBe(true);
      expect(activity?.vlmPrompt).toMatch(/TARGET_CONE/i);
    });
    const platformStand = CT011_CT020.find((activity) => activity.id === "CT020");
    expect(platformStand?.requiredReferenceAssets).toContain("TARGET_PLATFORM");
    expect(platformStand?.recordingRequirements.targetObjectRequiredInFrame).toBe(true);
    expect(platformStand?.vlmPrompt).toMatch(/TARGET_PLATFORM/i);
  });

  it("has correct audio and FPS rules", () => {
    CT011_CT020.forEach((activity) => {
      expect(activity.audioRequired).toBe(false);
      expect(activity.recordingRequirements.audioRequired).toBe(false);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
    });
  });

  it("has valid prerequisite and next links", () => {
    CT011_CT020.forEach((activity) => {
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0] ?? null);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      expect(ALL_KNOWN_IDS.has(EXPECTED_NEXT[activity.id])).toBe(true);
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    CT011_CT020.forEach((activity) => {
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
    CT011_CT020.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
