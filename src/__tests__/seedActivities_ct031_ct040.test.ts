import { CT001_CT010 } from "@/data/seedCatalog/ct001_ct010";
import { CT011_CT020 } from "@/data/seedCatalog/ct011_ct020";
import { CT021_CT030 } from "@/data/seedCatalog/ct021_ct030";
import { CT031_CT040 } from "@/data/seedCatalog/ct031_ct040";

const EXPECTED_IDS = ["CT031", "CT032", "CT033", "CT034", "CT035", "CT036", "CT037", "CT038", "CT039", "CT040"];
const ALL_KNOWN_IDS = new Set([...CT001_CT010.map((a) => a.id), ...CT011_CT020.map((a) => a.id), ...CT021_CT030.map((a) => a.id), ...EXPECTED_IDS, "CT041"]);
const EXPECTED_REFERENCES: Record<string, string[]> = {
  CT031: ["DOG_PROFILE"],
  CT032: ["DOG_PROFILE", "TARGET_BUTTON"],
  CT033: ["DOG_PROFILE", "TARGET_BELL"],
  CT034: ["DOG_PROFILE", "TARGET_TOY"],
  CT035: ["DOG_PROFILE", "TARGET_TOY"],
  CT036: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
  CT037: ["DOG_PROFILE", "TARGET_TOY"],
  CT038: ["DOG_PROFILE", "TARGET_BOX"],
  CT039: ["DOG_PROFILE", "TARGET_CONE"],
  CT040: ["DOG_PROFILE"],
};
const EXPECTED_AUDIO: Record<string, boolean> = { CT031: false, CT032: false, CT033: true, CT034: false, CT035: false, CT036: false, CT037: false, CT038: false, CT039: false, CT040: false };
const EXPECTED_FPS: Record<string, number> = { CT031: 3, CT032: 5, CT033: 5, CT034: 5, CT035: 5, CT036: 5, CT037: 5, CT038: 5, CT039: 5, CT040: 5 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  CT031: ["CT028", "CT029"],
  CT032: ["CT001"],
  CT033: ["CT032"],
  CT034: ["CT001"],
  CT035: ["CT034"],
  CT036: ["CT035"],
  CT037: ["CT034"],
  CT038: ["CT037"],
  CT039: ["CT014"],
  CT040: ["CT039"],
};
const EXPECTED_NEXT: Record<string, string> = { CT031: "CT032", CT032: "CT033", CT033: "CT034", CT034: "CT035", CT035: "CT036", CT036: "CT037", CT037: "CT038", CT038: "CT039", CT039: "CT040", CT040: "CT041" };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REQUIRED SAVED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("CT031-CT040 lightweight validation", () => {
  it("exports exactly CT031-CT040", () => {
    expect(CT031_CT040).toHaveLength(10);
    expect(CT031_CT040.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(CT031_CT040.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Cool Tricks and Games and order indexes 31-40", () => {
    CT031_CT040.forEach((activity, index) => {
      expect(activity.category).toBe("COOL_TRICKS_AND_GAMES");
      expect(activity.sequenceNumber).toBe(31 + index);
      expect(activity.orderIndex).toBe(31 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    CT031_CT040.forEach((activity) => {
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
    expect(CT031_CT040.find((activity) => activity.id === "CT031")?.vlmPrompt).toMatch(/CUSTOM_OBJECT is required only when a registered hide-face prop is used/i);
    expect(CT031_CT040.find((activity) => activity.id === "CT032")?.requiredReferenceAssets).toContain("TARGET_BUTTON");
    expect(CT031_CT040.find((activity) => activity.id === "CT033")?.requiredReferenceAssets).toContain("TARGET_BELL");
    ["CT034", "CT035", "CT036", "CT037"].forEach((id) => expect(CT031_CT040.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_TOY"));
    expect(CT031_CT040.find((activity) => activity.id === "CT036")?.requiredReferenceAssets).toContain("TARGET_BASKET");
    expect(CT031_CT040.find((activity) => activity.id === "CT038")?.requiredReferenceAssets).toContain("TARGET_BOX");
    expect(CT031_CT040.find((activity) => activity.id === "CT039")?.requiredReferenceAssets).toContain("TARGET_CONE");
    expect(CT031_CT040.find((activity) => activity.id === "CT040")?.vlmPrompt).toMatch(/CUSTOM_OBJECT is required only when registered ground-pole objects are required/i);
  });

  it("has correct audio and FPS rules", () => {
    CT031_CT040.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
    });
  });

  it("has valid prerequisite and next links", () => {
    CT031_CT040.forEach((activity) => {
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0] ?? null);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      expect(ALL_KNOWN_IDS.has(EXPECTED_NEXT[activity.id])).toBe(true);
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    CT031_CT040.forEach((activity) => {
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
    CT031_CT040.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
