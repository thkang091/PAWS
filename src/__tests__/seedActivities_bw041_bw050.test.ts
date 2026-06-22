import { BW001_BW010 } from "@/data/seedCatalog/bw001_bw010";
import { BW011_BW020 } from "@/data/seedCatalog/bw011_bw020";
import { BW021_BW030 } from "@/data/seedCatalog/bw021_bw030";
import { BW031_BW040 } from "@/data/seedCatalog/bw031_bw040";
import { BW041_BW050 } from "@/data/seedCatalog/bw041_bw050";

const EXPECTED_IDS = ["BW041", "BW042", "BW043", "BW044", "BW045", "BW046", "BW047", "BW048", "BW049", "BW050"];
const ALL_KNOWN_IDS = new Set([...BW001_BW010.map((a) => a.id), ...BW011_BW020.map((a) => a.id), ...BW021_BW030.map((a) => a.id), ...BW031_BW040.map((a) => a.id), ...EXPECTED_IDS]);

const EXPECTED_REFERENCES: Record<string, string[]> = {
  BW041: ["DOG_PROFILE"],
  BW042: ["DOG_PROFILE", "TARGET_DOORWAY"],
  BW043: ["DOG_PROFILE"],
  BW044: ["DOG_PROFILE"],
  BW045: ["DOG_PROFILE"],
  BW046: ["DOG_PROFILE"],
  BW047: ["DOG_PROFILE"],
  BW048: ["DOG_PROFILE"],
  BW049: ["DOG_PROFILE"],
  BW050: ["DOG_PROFILE"],
};
const EXPECTED_AUDIO: Record<string, boolean> = { BW041: true, BW042: true, BW043: false, BW044: false, BW045: true, BW046: false, BW047: false, BW048: false, BW049: false, BW050: false };
const EXPECTED_FPS: Record<string, number> = { BW041: 5, BW042: 3, BW043: 3, BW044: 3, BW045: 5, BW046: 3, BW047: 5, BW048: 3, BW049: 3, BW050: 5 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  BW041: ["BW017", "BW018"],
  BW042: ["BW019", "BW006"],
  BW043: ["BW032", "BW029"],
  BW044: ["BW022", "BW029"],
  BW045: ["BW040", "BW037"],
  BW046: ["BW009", "BW011", "BW029"],
  BW047: ["BW030", "BW044"],
  BW048: ["BW009", "BW010"],
  BW049: ["BW043", "BW048"],
  BW050: ["BW047", "BW049"],
};
const EXPECTED_NEXT: Record<string, string | null> = { BW041: "BW042", BW042: "BW043", BW043: "BW044", BW044: "BW045", BW045: "BW046", BW046: "BW047", BW047: "BW048", BW048: "BW049", BW049: "BW050", BW050: null };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REFERENCE RULES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("BW041-BW050 lightweight validation", () => {
  it("exports exactly BW041-BW050", () => {
    expect(BW041_BW050).toHaveLength(10);
    expect(BW041_BW050.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(BW041_BW050.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Better Walks and order indexes 41-50", () => {
    BW041_BW050.forEach((activity, index) => {
      expect(activity.category).toBe("BETTER_WALKS");
      expect(activity.sequenceNumber).toBe(41 + index);
      expect(activity.orderIndex).toBe(41 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    BW041_BW050.forEach((activity) => {
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
    expect(BW041_BW050.find((activity) => activity.id === "BW043")?.vlmPrompt).toMatch(/CUSTOM_OBJECT only when/i);
    expect(BW041_BW050.find((activity) => activity.id === "BW049")?.vlmPrompt).toMatch(/CUSTOM_OBJECT only when/i);
    expect(BW041_BW050.find((activity) => activity.id === "BW050")?.vlmPrompt).toMatch(/TARGET_DOORWAY[\s\S]*TARGET_CONE[\s\S]*CUSTOM_OBJECT/i);
  });

  it("has correct leash, audio, and FPS rules", () => {
    BW041_BW050.forEach((activity) => {
      expect(activity.recordingRequirements.targetObjectRequiredInFrame).toBe(true);
      expect(activity.vlmPrompt).toMatch(/leash/i);
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
    });
    ["BW041", "BW042", "BW045"].forEach((id) => expect(BW041_BW050.find((activity) => activity.id === id)?.audioRequired).toBe(true));
    expect(BW041_BW050.find((activity) => activity.id === "BW050")?.maxClipSeconds).toBe(60);
  });

  it("has valid prerequisite and next links", () => {
    BW041_BW050.forEach((activity) => {
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0]);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      const nextActivityId = EXPECTED_NEXT[activity.id];
      if (nextActivityId) {
        expect(ALL_KNOWN_IDS.has(nextActivityId)).toBe(true);
      }
    });
    expect(BW041_BW050.find((activity) => activity.id === "BW050")?.nextActivityId).toBeNull();
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    BW041_BW050.forEach((activity) => {
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
    BW041_BW050.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
