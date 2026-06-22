import { CA001_CA010 } from "@/data/seedCatalog/ca001_ca010";
import { CA011_CA020 } from "@/data/seedCatalog/ca011_ca020";
import { CA021_CA030 } from "@/data/seedCatalog/ca021_ca030";
import { CA031_CA040 } from "@/data/seedCatalog/ca031_ca040";

const EXPECTED_IDS = ["CA031", "CA032", "CA033", "CA034", "CA035", "CA036", "CA037", "CA038", "CA039", "CA040"];
const ALL_KNOWN_IDS = new Set([...CA001_CA010.map((a) => a.id), ...CA011_CA020.map((a) => a.id), ...CA021_CA030.map((a) => a.id), ...EXPECTED_IDS, "CA041"]);
const EXPECTED_REFERENCES: Record<string, string[]> = {
  CA031: ["DOG_PROFILE", "TARGET_CRATE"],
  CA032: ["DOG_PROFILE"],
  CA033: ["DOG_PROFILE"],
  CA034: ["DOG_PROFILE"],
  CA035: ["DOG_PROFILE"],
  CA036: ["DOG_PROFILE"],
  CA037: ["DOG_PROFILE", "CUSTOM_OBJECT"],
  CA038: ["DOG_PROFILE", "CUSTOM_OBJECT"],
  CA039: ["DOG_PROFILE"],
  CA040: ["DOG_PROFILE", "TARGET_CRATE"],
};
const EXPECTED_AUDIO: Record<string, boolean> = { CA031: false, CA032: false, CA033: false, CA034: false, CA035: false, CA036: false, CA037: false, CA038: false, CA039: true, CA040: true };
const EXPECTED_FPS: Record<string, number> = { CA031: 3, CA032: 3, CA033: 3, CA034: 3, CA035: 3, CA036: 3, CA037: 2, CA038: 2, CA039: 3, CA040: 3 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  CA031: ["CA008", "CA017"],
  CA032: ["CA012"],
  CA033: ["CA032"],
  CA034: ["CA033"],
  CA035: ["CA034"],
  CA036: ["CA035"],
  CA037: ["CA015", "CA021"],
  CA038: ["CA037"],
  CA039: ["CA005"],
  CA040: ["CA008"],
};
const EXPECTED_NEXT: Record<string, string> = { CA031: "CA032", CA032: "CA033", CA033: "CA034", CA034: "CA035", CA035: "CA036", CA036: "CA037", CA037: "CA038", CA038: "CA039", CA039: "CA040", CA040: "CA041" };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REQUIRED SAVED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("CA031-CA040 lightweight validation", () => {
  it("exports exactly CA031-CA040", () => {
    expect(CA031_CA040).toHaveLength(10);
    expect(CA031_CA040.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(CA031_CA040.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Calm Alone Time and order indexes 31-40", () => {
    CA031_CA040.forEach((activity, index) => {
      expect(activity.category).toBe("CALM_ALONE_TIME");
      expect(activity.sequenceNumber).toBe(31 + index);
      expect(activity.orderIndex).toBe(31 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    CA031_CA040.forEach((activity) => {
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
    ["CA031", "CA040"].forEach((id) => expect(CA031_CA040.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_CRATE"));
    ["CA032", "CA033", "CA034", "CA035", "CA036", "CA039"].forEach((id) => expect(CA031_CA040.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/TARGET_MAT or TARGET_CRATE/i));
    ["CA037", "CA038"].forEach((id) => {
      const activity = CA031_CA040.find((item) => item.id === id);
      expect(activity?.requiredReferenceAssets).toContain("CUSTOM_OBJECT");
      expect(activity?.vlmPrompt).toMatch(/TARGET_MAT or TARGET_CRATE/i);
    });
  });

  it("has correct audio and FPS rules", () => {
    CA031_CA040.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
    });
    ["CA039", "CA040"].forEach((id) => expect(CA031_CA040.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/Audio is required/i));
  });

  it("has complete prompts and valid links", () => {
    CA031_CA040.forEach((activity) => {
      expect(activity.questContentType).toBe("AI_VERIFIED_MAIN_QUEST");
      expect(activity.vlmPrompt.trim().length).toBeGreaterThan(500);
      REQUIRED_PROMPT_SECTIONS.forEach((section) => expect(activity.vlmPrompt).toMatch(section));
      expect(activity.vlmPrompt).toContain(activity.id);
      expect(activity.vlmPrompt).toContain(activity.title);
      expect(activity.vlmPrompt).toContain(activity.visibleCheckpoint);
      expect(activity.vlmPrompt).toMatch(/PASS \| FAIL \| NEEDS_REVIEW/);
      expect(activity.vlmPrompt).toMatch(/Missing evidence is never FAIL/i);
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0] ?? null);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      expect(ALL_KNOWN_IDS.has(EXPECTED_NEXT[activity.id])).toBe(true);
    });
  });

  it("keeps Calm Alone Time prompts scoped to submitted evidence", () => {
    CA031_CA040.forEach((activity) => {
      expect(activity.vlmPrompt).toMatch(/visible or audible evidence/i);
      expect(activity.vlmPrompt).toMatch(/Forbidden claims/i);
      expect(activity.outOfScopeClaims.join(" ")).toMatch(/Do not/i);
    });
  });

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake Gemini verdict path", () => {
    CA031_CA040.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic|fabricated video verdict/i);
    });
  });
});
