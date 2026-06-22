import { CA001_CA010 } from "@/data/seedCatalog/ca001_ca010";
import { CA011_CA020 } from "@/data/seedCatalog/ca011_ca020";

const EXPECTED_IDS = ["CA011", "CA012", "CA013", "CA014", "CA015", "CA016", "CA017", "CA018", "CA019", "CA020"];
const ALL_KNOWN_IDS = new Set([...CA001_CA010.map((a) => a.id), ...EXPECTED_IDS, "CA021"]);
const EXPECTED_REFERENCES: Record<string, string[]> = {
  CA011: ["DOG_PROFILE", "TARGET_MAT"],
  CA012: ["DOG_PROFILE", "TARGET_MAT"],
  CA013: ["DOG_PROFILE", "CUSTOM_OBJECT"],
  CA014: ["DOG_PROFILE", "CUSTOM_OBJECT"],
  CA015: ["DOG_PROFILE", "CUSTOM_OBJECT"],
  CA016: ["DOG_PROFILE"],
  CA017: ["DOG_PROFILE"],
  CA018: ["DOG_PROFILE"],
  CA019: ["DOG_PROFILE"],
  CA020: ["DOG_PROFILE"],
};
const EXPECTED_FPS: Record<string, number> = { CA011: 1, CA012: 1, CA013: 0, CA014: 3, CA015: 1, CA016: 3, CA017: 3, CA018: 3, CA019: 3, CA020: 2 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  CA011: ["CA010"],
  CA012: ["CA011"],
  CA013: ["CA012"],
  CA014: ["CA013"],
  CA015: ["CA014"],
  CA016: ["CA015"],
  CA017: ["CA016"],
  CA018: ["CA017"],
  CA019: ["CA018"],
  CA020: ["CA019"],
};
const EXPECTED_NEXT: Record<string, string> = { CA011: "CA012", CA012: "CA013", CA013: "CA014", CA014: "CA015", CA015: "CA016", CA016: "CA017", CA017: "CA018", CA018: "CA019", CA019: "CA020", CA020: "CA021" };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("CA011-CA020 lightweight validation", () => {
  it("exports exactly CA011-CA020", () => {
    expect(CA011_CA020).toHaveLength(10);
    expect(CA011_CA020.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(CA011_CA020.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Calm Alone Time and order indexes 11-20", () => {
    CA011_CA020.forEach((activity, index) => {
      expect(activity.category).toBe("CALM_ALONE_TIME");
      expect(activity.sequenceNumber).toBe(11 + index);
      expect(activity.orderIndex).toBe(11 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    CA011_CA020.forEach((activity) => {
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
    ["CA011", "CA012"].forEach((id) => expect(CA011_CA020.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_MAT"));
    ["CA013", "CA014", "CA015"].forEach((id) => expect(CA011_CA020.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/CUSTOM_OBJECT/i));
    ["CA015", "CA016", "CA017", "CA018", "CA019", "CA020"].forEach((id) => expect(CA011_CA020.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/TARGET_MAT or TARGET_CRATE/i));
  });

  it("uses CA013 reference-setup flow and pass-gated prompts for the rest", () => {
    const ca013 = CA011_CA020.find((activity) => activity.id === "CA013");
    expect(ca013?.questContentType).toBe("REFERENCE_SETUP");
    expect(ca013?.referenceSetupOnly).toBe(true);
    expect(ca013?.vlmPrompt).toMatch(/not a video pass gate/i);
    expect(ca013?.vlmPrompt).toMatch(/reference-photo validation flow/i);
    CA011_CA020.filter((activity) => activity.id !== "CA013").forEach((activity) => {
      expect(activity.questContentType).toBe("AI_VERIFIED_MAIN_QUEST");
      expect(activity.vlmPrompt.trim().length).toBeGreaterThan(500);
      REQUIRED_PROMPT_SECTIONS.forEach((section) => expect(activity.vlmPrompt).toMatch(section));
      expect(activity.vlmPrompt).toMatch(/PAWS GEMINI 2\.5 FLASH VERIFIER PROMPT/i);
    });
  });

  it("has correct FPS and links", () => {
    CA011_CA020.forEach((activity) => {
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

  it("keeps Calm Alone Time prompts scoped to visible evidence", () => {
    CA011_CA020.forEach((activity) => {
      expect(activity.vlmPrompt).toContain(activity.id);
      expect(activity.vlmPrompt).toContain(activity.title);
      expect(activity.vlmPrompt).toContain(activity.visibleCheckpoint);
      expect(activity.vlmPrompt).toMatch(/PASS \| FAIL \| NEEDS_REVIEW/);
      expect(activity.vlmPrompt).toMatch(/Missing evidence/i);
      expect(activity.outOfScopeClaims.join(" ")).toMatch(/Do not/i);
    });
    CA011_CA020.filter((activity) => activity.id !== "CA013").forEach((activity) => {
      expect(activity.vlmPrompt).toMatch(/visible behavior/i);
      expect(activity.vlmPrompt).toMatch(/Do not infer emotional calmness/i);
    });
  });

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake Gemini verdict path", () => {
    CA011_CA020.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic|fabricated video verdict/i);
    });
  });
});
