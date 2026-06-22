import { CA011_CA020 } from "@/data/seedCatalog/ca011_ca020";
import { CA021_CA030 } from "@/data/seedCatalog/ca021_ca030";

const EXPECTED_IDS = ["CA021", "CA022", "CA023", "CA024", "CA025", "CA026", "CA027", "CA028", "CA029", "CA030"];
const ALL_KNOWN_IDS = new Set([...CA011_CA020.map((a) => a.id), ...EXPECTED_IDS, "CA031"]);
const EXPECTED_REFERENCES: Record<string, string[]> = {
  CA021: ["DOG_PROFILE"],
  CA022: ["DOG_PROFILE"],
  CA023: ["DOG_PROFILE"],
  CA024: ["DOG_PROFILE"],
  CA025: ["DOG_PROFILE"],
  CA026: ["DOG_PROFILE"],
  CA027: ["DOG_PROFILE"],
  CA028: ["DOG_PROFILE"],
  CA029: ["DOG_PROFILE"],
  CA030: ["DOG_PROFILE"],
};
const EXPECTED_FPS: Record<string, number> = { CA021: 2, CA022: 2, CA023: 2, CA024: 1, CA025: 1, CA026: 2, CA027: 2, CA028: 1, CA029: 3, CA030: 3 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  CA021: ["CA020"],
  CA022: ["CA021"],
  CA023: ["CA022"],
  CA024: ["CA023"],
  CA025: ["CA024"],
  CA026: ["CA021"],
  CA027: ["CA026"],
  CA028: ["CA027"],
  CA029: ["CA017"],
  CA030: ["CA029"],
};
const EXPECTED_NEXT: Record<string, string> = { CA021: "CA022", CA022: "CA023", CA023: "CA024", CA024: "CA025", CA025: "CA026", CA026: "CA027", CA027: "CA028", CA028: "CA029", CA029: "CA030", CA030: "CA031" };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REQUIRED SAVED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("CA021-CA030 lightweight validation", () => {
  it("exports exactly CA021-CA030", () => {
    expect(CA021_CA030).toHaveLength(10);
    expect(CA021_CA030.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(CA021_CA030.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Calm Alone Time and order indexes 21-30", () => {
    CA021_CA030.forEach((activity, index) => {
      expect(activity.category).toBe("CALM_ALONE_TIME");
      expect(activity.sequenceNumber).toBe(21 + index);
      expect(activity.orderIndex).toBe(21 + index);
    });
  });

  it("has required fields and safe-zone reference mapping", () => {
    CA021_CA030.forEach((activity) => {
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
      expect(activity.vlmPrompt).toMatch(/TARGET_MAT or TARGET_CRATE/i);
      expect(activity.vlmPrompt).toMatch(/Registered safe-zone reference is required/i);
    });
  });

  it("has complete pass-gated Gemini verifier prompts", () => {
    CA021_CA030.forEach((activity) => {
      expect(activity.questContentType).toBe("AI_VERIFIED_MAIN_QUEST");
      expect(activity.vlmPrompt.trim().length).toBeGreaterThan(500);
      REQUIRED_PROMPT_SECTIONS.forEach((section) => expect(activity.vlmPrompt).toMatch(section));
      expect(activity.vlmPrompt).toMatch(/PAWS GEMINI 2\.5 FLASH VERIFIER PROMPT/i);
      expect(activity.vlmPrompt).toContain(activity.id);
      expect(activity.vlmPrompt).toContain(activity.title);
      expect(activity.vlmPrompt).toContain(activity.visibleCheckpoint);
      expect(activity.vlmPrompt).toMatch(/PASS \| FAIL \| NEEDS_REVIEW/);
      expect(activity.vlmPrompt).toMatch(/Missing evidence is never FAIL/i);
    });
  });

  it("has correct FPS and links", () => {
    CA021_CA030.forEach((activity) => {
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
    CA021_CA030.forEach((activity) => {
      expect(activity.vlmPrompt).toMatch(/visible behavior within the submitted clip/i);
      expect(activity.vlmPrompt).toMatch(/Do not infer emotional state/i);
      expect(activity.outOfScopeClaims.join(" ")).toMatch(/Do not/i);
    });
  });

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake Gemini verdict path", () => {
    CA021_CA030.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic|fabricated video verdict/i);
    });
  });
});
