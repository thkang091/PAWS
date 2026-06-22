import { CA001_CA010 } from "@/data/seedCatalog/ca001_ca010";

const EXPECTED_IDS = ["CA001", "CA002", "CA003", "CA004", "CA005", "CA006", "CA007", "CA008", "CA009", "CA010"];
const ALL_KNOWN_IDS = new Set([...EXPECTED_IDS, "CA011"]);
const EXPECTED_REFERENCES: Record<string, string[]> = {
  CA001: ["DOG_PROFILE"],
  CA002: ["DOG_PROFILE"],
  CA003: ["DOG_PROFILE"],
  CA004: ["DOG_PROFILE"],
  CA005: ["DOG_PROFILE"],
  CA006: ["DOG_PROFILE", "TARGET_CRATE"],
  CA007: ["DOG_PROFILE", "TARGET_CRATE"],
  CA008: ["DOG_PROFILE", "TARGET_CRATE"],
  CA009: ["DOG_PROFILE"],
  CA010: ["DOG_PROFILE"],
};
const EXPECTED_FPS: Record<string, number> = { CA001: 0, CA002: 3, CA003: 2, CA004: 2, CA005: 1, CA006: 3, CA007: 2, CA008: 2, CA009: 2, CA010: 1 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  CA001: [],
  CA002: ["CA001"],
  CA003: ["CA002"],
  CA004: ["CA003"],
  CA005: ["CA004"],
  CA006: ["CA002"],
  CA007: ["CA006"],
  CA008: ["CA007"],
  CA009: ["CA005"],
  CA010: ["CA009"],
};
const EXPECTED_NEXT: Record<string, string> = { CA001: "CA002", CA002: "CA003", CA003: "CA004", CA004: "CA005", CA005: "CA006", CA006: "CA007", CA007: "CA008", CA008: "CA009", CA009: "CA010", CA010: "CA011" };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("CA001-CA010 lightweight validation", () => {
  it("exports exactly CA001-CA010", () => {
    expect(CA001_CA010).toHaveLength(10);
    expect(CA001_CA010.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(CA001_CA010.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Calm Alone Time and order indexes 1-10", () => {
    CA001_CA010.forEach((activity, index) => {
      expect(activity.category).toBe("CALM_ALONE_TIME");
      expect(activity.sequenceNumber).toBe(1 + index);
      expect(activity.orderIndex).toBe(1 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    CA001_CA010.forEach((activity) => {
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
    });
    ["CA001", "CA002", "CA003", "CA004", "CA005"].forEach((id) => expect(CA001_CA010.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/TARGET_MAT or TARGET_CRATE/i));
    ["CA006", "CA007", "CA008"].forEach((id) => expect(CA001_CA010.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_CRATE"));
    ["CA009", "CA010"].forEach((id) => expect(CA001_CA010.find((activity) => activity.id === id)?.requiredReferenceAssets).toEqual(["DOG_PROFILE"]));
  });

  it("uses CA001 reference-setup flow and pass-gated prompts for later activities", () => {
    const ca001 = CA001_CA010[0];
    expect(ca001.id).toBe("CA001");
    expect(ca001.questContentType).toBe("REFERENCE_SETUP");
    expect(ca001.referenceSetupOnly).toBe(true);
    expect(ca001.vlmPrompt).toMatch(/not a video pass gate/i);
    expect(ca001.vlmPrompt).toMatch(/reference-photo validation flow/i);
    CA001_CA010.slice(1).forEach((activity) => {
      expect(activity.questContentType).toBe("AI_VERIFIED_MAIN_QUEST");
      expect(activity.vlmPrompt.trim().length).toBeGreaterThan(500);
      REQUIRED_PROMPT_SECTIONS.forEach((section) => expect(activity.vlmPrompt).toMatch(section));
      expect(activity.vlmPrompt).toMatch(/PAWS GEMINI 2\.5 FLASH VERIFIER PROMPT/i);
    });
  });

  it("has correct FPS and links", () => {
    CA001_CA010.forEach((activity) => {
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0] ?? null);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      expect(ALL_KNOWN_IDS.has(EXPECTED_NEXT[activity.id])).toBe(true);
    });
  });

  it("keeps Calm Alone Time claims scoped to visible evidence", () => {
    CA001_CA010.forEach((activity) => {
      expect(activity.vlmPrompt).toContain(activity.id);
      expect(activity.vlmPrompt).toContain(activity.title);
      expect(activity.vlmPrompt).toContain(activity.visibleCheckpoint);
      expect(activity.vlmPrompt).toMatch(/PASS \| FAIL \| NEEDS_REVIEW/);
      expect(activity.vlmPrompt).toMatch(/Missing evidence/i);
      expect(activity.outOfScopeClaims.join(" ")).toMatch(/Do not/i);
    });
    CA001_CA010.slice(1).forEach((activity) => {
      expect(activity.vlmPrompt).toMatch(/Forbidden claims/i);
      expect(activity.vlmPrompt).toMatch(/visible or audible evidence/i);
    });
  });

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake Gemini verdict path", () => {
    CA001_CA010.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic|fabricated video verdict/i);
    });
  });
});
