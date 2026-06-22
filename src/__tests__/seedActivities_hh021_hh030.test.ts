import { HH001_HH010 } from "@/data/seedCatalog/hh001_hh010";
import { HH011_HH020 } from "@/data/seedCatalog/hh011_hh020";
import { HH021_HH030 } from "@/data/seedCatalog/hh021_hh030";

const EXPECTED_IDS = ["HH021", "HH022", "HH023", "HH024", "HH025", "HH026", "HH027", "HH028", "HH029", "HH030"];
const ALL_KNOWN_IDS = new Set([...HH001_HH010.map((a) => a.id), ...HH011_HH020.map((a) => a.id), ...EXPECTED_IDS, "HH031"]);
const EXPECTED_REFERENCES: Record<string, string[]> = {
  HH021: ["DOG_PROFILE", "TARGET_BOX"],
  HH022: ["DOG_PROFILE"],
  HH023: ["DOG_PROFILE"],
  HH024: ["DOG_PROFILE", "TARGET_TOY"],
  HH025: ["DOG_PROFILE"],
  HH026: ["DOG_PROFILE", "TARGET_MAT"],
  HH027: ["DOG_PROFILE", "TARGET_BASKET"],
  HH028: ["DOG_PROFILE", "TARGET_BUTTON"],
  HH029: ["DOG_PROFILE", "TARGET_BUTTON"],
  HH030: ["DOG_PROFILE", "TARGET_BELL"],
};
const EXPECTED_AUDIO: Record<string, boolean> = { HH021: false, HH022: false, HH023: false, HH024: false, HH025: false, HH026: false, HH027: false, HH028: false, HH029: false, HH030: true };
const EXPECTED_FPS: Record<string, number> = { HH021: 5, HH022: 5, HH023: 5, HH024: 5, HH025: 5, HH026: 5, HH027: 5, HH028: 5, HH029: 5, HH030: 5 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  HH021: ["HH020"],
  HH022: ["HH001"],
  HH023: ["HH022"],
  HH024: ["HH010", "HH022"],
  HH025: ["HH007"],
  HH026: ["HH025", "HH002"],
  HH027: ["HH026"],
  HH028: ["HH001"],
  HH029: ["HH028"],
  HH030: ["HH029"],
};
const EXPECTED_NEXT: Record<string, string> = { HH021: "HH022", HH022: "HH023", HH023: "HH024", HH024: "HH025", HH025: "HH026", HH026: "HH027", HH027: "HH028", HH028: "HH029", HH029: "HH030", HH030: "HH031" };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REQUIRED SAVED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("HH021-HH030 lightweight validation", () => {
  it("exports exactly HH021-HH030", () => {
    expect(HH021_HH030).toHaveLength(10);
    expect(HH021_HH030.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(HH021_HH030.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Helpful Skills Around the House and order indexes 21-30", () => {
    HH021_HH030.forEach((activity, index) => {
      expect(activity.category).toBe("HELPFUL_SKILLS_AROUND_THE_HOUSE");
      expect(activity.sequenceNumber).toBe(21 + index);
      expect(activity.orderIndex).toBe(21 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    HH021_HH030.forEach((activity) => {
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
    expect(HH021_HH030.find((activity) => activity.id === "HH021")?.requiredReferenceAssets).toContain("TARGET_BOX");
    expect(HH021_HH030.find((activity) => activity.id === "HH024")?.requiredReferenceAssets).toContain("TARGET_TOY");
    ["HH025", "HH026", "HH027"].forEach((id) => expect(HH021_HH030.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/CUSTOM_OBJECT is required when/i));
    expect(HH021_HH030.find((activity) => activity.id === "HH026")?.requiredReferenceAssets).toContain("TARGET_MAT");
    expect(HH021_HH030.find((activity) => activity.id === "HH027")?.requiredReferenceAssets).toContain("TARGET_BASKET");
    ["HH028", "HH029"].forEach((id) => expect(HH021_HH030.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_BUTTON"));
    expect(HH021_HH030.find((activity) => activity.id === "HH030")?.requiredReferenceAssets).toContain("TARGET_BELL");
  });

  it("has correct audio and FPS rules", () => {
    HH021_HH030.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
    });
    expect(HH021_HH030.find((activity) => activity.id === "HH030")?.vlmPrompt).toMatch(/Audio is required/i);
    ["HH022", "HH023"].forEach((id) => expect(HH021_HH030.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/spoken .*cue/i));
  });

  it("has valid prerequisite and next links", () => {
    HH021_HH030.forEach((activity) => {
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0] ?? null);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      expect(ALL_KNOWN_IDS.has(EXPECTED_NEXT[activity.id])).toBe(true);
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    HH021_HH030.forEach((activity) => {
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
    HH021_HH030.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
