import { HH001_HH010 } from "@/data/seedCatalog/hh001_hh010";
import { HH011_HH020 } from "@/data/seedCatalog/hh011_hh020";
import { HH021_HH030 } from "@/data/seedCatalog/hh021_hh030";
import { HH031_HH040 } from "@/data/seedCatalog/hh031_hh040";
import { HH041_HH050 } from "@/data/seedCatalog/hh041_hh050";

const EXPECTED_IDS = ["HH041", "HH042", "HH043", "HH044", "HH045", "HH046", "HH047", "HH048", "HH049", "HH050"];
const ALL_HH = [...HH001_HH010, ...HH011_HH020, ...HH021_HH030, ...HH031_HH040, ...HH041_HH050];
const ALL_KNOWN_IDS = new Set(ALL_HH.map((a) => a.id));
const EXPECTED_REFERENCES: Record<string, string[]> = {
  HH041: ["DOG_PROFILE", "TARGET_TOY"],
  HH042: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
  HH043: ["DOG_PROFILE", "TARGET_TOY"],
  HH044: ["DOG_PROFILE", "TARGET_BUTTON", "TARGET_MAT"],
  HH045: ["DOG_PROFILE", "TARGET_BELL", "TARGET_DOORWAY"],
  HH046: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
  HH047: ["DOG_PROFILE", "TARGET_TOY"],
  HH048: ["DOG_PROFILE"],
  HH049: ["DOG_PROFILE", "CUSTOM_OBJECT"],
  HH050: ["DOG_PROFILE"],
};
const EXPECTED_AUDIO: Record<string, boolean> = { HH041: true, HH042: false, HH043: false, HH044: false, HH045: true, HH046: false, HH047: false, HH048: false, HH049: false, HH050: false };
const EXPECTED_FPS: Record<string, number> = { HH041: 5, HH042: 5, HH043: 5, HH044: 5, HH045: 5, HH046: 5, HH047: 5, HH048: 5, HH049: 5, HH050: 5 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  HH041: ["HH011"],
  HH042: ["HH012", "HH013"],
  HH043: ["HH024"],
  HH044: ["HH028", "HH002"],
  HH045: ["HH031"],
  HH046: ["HH015"],
  HH047: ["HH017"],
  HH048: ["HH035"],
  HH049: ["HH036"],
  HH050: ["HH042", "HH045", "HH049"],
};
const EXPECTED_NEXT: Record<string, string | null> = { HH041: "HH042", HH042: "HH043", HH043: "HH044", HH044: "HH045", HH045: "HH046", HH046: "HH047", HH047: "HH048", HH048: "HH049", HH049: "HH050", HH050: null };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REQUIRED SAVED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("HH041-HH050 lightweight validation", () => {
  it("exports exactly HH041-HH050 and keeps total Helpful Skills count at 50", () => {
    expect(HH041_HH050).toHaveLength(10);
    expect(HH041_HH050.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(HH041_HH050.map((activity) => activity.id)).size).toBe(10);
    expect(ALL_HH).toHaveLength(50);
    expect(new Set(ALL_HH.map((activity) => activity.id)).size).toBe(50);
  });

  it("uses Helpful Skills Around the House and order indexes 41-50", () => {
    HH041_HH050.forEach((activity, index) => {
      expect(activity.category).toBe("HELPFUL_SKILLS_AROUND_THE_HOUSE");
      expect(activity.sequenceNumber).toBe(41 + index);
      expect(activity.orderIndex).toBe(41 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    HH041_HH050.forEach((activity) => {
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
    expect(HH041_HH050.find((activity) => activity.id === "HH044")?.requiredReferenceAssets).toEqual(["DOG_PROFILE", "TARGET_BUTTON", "TARGET_MAT"]);
    expect(HH041_HH050.find((activity) => activity.id === "HH045")?.requiredReferenceAssets).toEqual(["DOG_PROFILE", "TARGET_BELL", "TARGET_DOORWAY"]);
    expect(HH041_HH050.find((activity) => activity.id === "HH048")?.vlmPrompt).toMatch(/CUSTOM_OBJECT is required when the leash is registered/i);
    expect(HH041_HH050.find((activity) => activity.id === "HH049")?.requiredReferenceAssets).toContain("CUSTOM_OBJECT");
    expect(HH041_HH050.find((activity) => activity.id === "HH050")?.vlmPrompt).toMatch(/Selected mat components require TARGET_MAT/i);
    expect(HH041_HH050.find((activity) => activity.id === "HH050")?.vlmPrompt).toMatch(/Selected custom object or leash components require CUSTOM_OBJECT/i);
  });

  it("has correct audio and FPS rules", () => {
    HH041_HH050.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
    });
    ["HH041", "HH045"].forEach((id) => expect(HH041_HH050.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/Audio is required/i));
    ["HH043", "HH047", "HH050"].forEach((id) => expect(HH041_HH050.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/cue timing/i));
  });

  it("has valid prerequisite and next links", () => {
    HH041_HH050.forEach((activity) => {
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0] ?? null);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      const nextActivityId = EXPECTED_NEXT[activity.id];
      if (nextActivityId) {
        expect(ALL_KNOWN_IDS.has(nextActivityId)).toBe(true);
      }
    });
    expect(HH041_HH050.find((activity) => activity.id === "HH050")?.nextActivityId).toBeNull();
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    HH041_HH050.forEach((activity) => {
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
    HH041_HH050.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
