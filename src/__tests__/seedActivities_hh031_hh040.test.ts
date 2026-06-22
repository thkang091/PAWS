import { HH001_HH010 } from "@/data/seedCatalog/hh001_hh010";
import { HH021_HH030 } from "@/data/seedCatalog/hh021_hh030";
import { HH031_HH040 } from "@/data/seedCatalog/hh031_hh040";

const EXPECTED_IDS = ["HH031", "HH032", "HH033", "HH034", "HH035", "HH036", "HH037", "HH038", "HH039", "HH040"];
const ALL_KNOWN_IDS = new Set([...HH001_HH010.map((a) => a.id), ...HH021_HH030.map((a) => a.id), ...EXPECTED_IDS, "HH041"]);
const EXPECTED_REFERENCES: Record<string, string[]> = {
  HH031: ["DOG_PROFILE", "TARGET_BELL", "TARGET_DOORWAY"],
  HH032: ["DOG_PROFILE", "TARGET_DRAWER"],
  HH033: ["DOG_PROFILE", "TARGET_DRAWER"],
  HH034: ["DOG_PROFILE", "CUSTOM_OBJECT"],
  HH035: ["DOG_PROFILE"],
  HH036: ["DOG_PROFILE", "CUSTOM_OBJECT"],
  HH037: ["DOG_PROFILE", "TARGET_MAT"],
  HH038: ["DOG_PROFILE", "TARGET_CRATE"],
  HH039: ["DOG_PROFILE"],
  HH040: ["DOG_PROFILE"],
};
const EXPECTED_AUDIO: Record<string, boolean> = { HH031: true, HH032: false, HH033: false, HH034: false, HH035: false, HH036: false, HH037: false, HH038: false, HH039: false, HH040: false };
const EXPECTED_FPS: Record<string, number> = { HH031: 5, HH032: 5, HH033: 5, HH034: 5, HH035: 5, HH036: 5, HH037: 3, HH038: 3, HH039: 5, HH040: 5 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  HH031: ["HH030"],
  HH032: ["HH001"],
  HH033: ["HH032"],
  HH034: ["HH025"],
  HH035: ["HH009"],
  HH036: ["HH035"],
  HH037: ["HH003"],
  HH038: ["HH006"],
  HH039: ["HH001"],
  HH040: ["HH039"],
};
const EXPECTED_NEXT: Record<string, string> = { HH031: "HH032", HH032: "HH033", HH033: "HH034", HH034: "HH035", HH035: "HH036", HH036: "HH037", HH037: "HH038", HH038: "HH039", HH039: "HH040", HH040: "HH041" };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REQUIRED SAVED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("HH031-HH040 lightweight validation", () => {
  it("exports exactly HH031-HH040", () => {
    expect(HH031_HH040).toHaveLength(10);
    expect(HH031_HH040.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(HH031_HH040.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Helpful Skills Around the House and order indexes 31-40", () => {
    HH031_HH040.forEach((activity, index) => {
      expect(activity.category).toBe("HELPFUL_SKILLS_AROUND_THE_HOUSE");
      expect(activity.sequenceNumber).toBe(31 + index);
      expect(activity.orderIndex).toBe(31 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    HH031_HH040.forEach((activity) => {
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
    expect(HH031_HH040.find((activity) => activity.id === "HH031")?.requiredReferenceAssets).toEqual(["DOG_PROFILE", "TARGET_BELL", "TARGET_DOORWAY"]);
    ["HH032", "HH033"].forEach((id) => expect(HH031_HH040.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_DRAWER"));
    ["HH034", "HH036"].forEach((id) => expect(HH031_HH040.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("CUSTOM_OBJECT"));
    expect(HH031_HH040.find((activity) => activity.id === "HH035")?.vlmPrompt).toMatch(/CUSTOM_OBJECT is required when the leash is registered/i);
    expect(HH031_HH040.find((activity) => activity.id === "HH037")?.requiredReferenceAssets).toContain("TARGET_MAT");
    expect(HH031_HH040.find((activity) => activity.id === "HH038")?.requiredReferenceAssets).toContain("TARGET_CRATE");
    ["HH039", "HH040"].forEach((id) => expect(HH031_HH040.find((activity) => activity.id === id)?.requiredReferenceAssets).toEqual(["DOG_PROFILE"]));
  });

  it("has correct audio and FPS rules", () => {
    HH031_HH040.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
    });
    expect(HH031_HH040.find((activity) => activity.id === "HH031")?.vlmPrompt).toMatch(/Audio is required/i);
    ["HH039", "HH040"].forEach((id) => expect(HH031_HH040.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/spoken cue/i));
  });

  it("has valid prerequisite and next links", () => {
    HH031_HH040.forEach((activity) => {
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0] ?? null);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      expect(ALL_KNOWN_IDS.has(EXPECTED_NEXT[activity.id])).toBe(true);
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    HH031_HH040.forEach((activity) => {
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
    HH031_HH040.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
