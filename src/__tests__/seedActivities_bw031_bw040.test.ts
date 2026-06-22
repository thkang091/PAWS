import { BW001_BW010 } from "@/data/seedCatalog/bw001_bw010";
import { BW011_BW020 } from "@/data/seedCatalog/bw011_bw020";
import { BW021_BW030 } from "@/data/seedCatalog/bw021_bw030";
import { BW031_BW040 } from "@/data/seedCatalog/bw031_bw040";
import { SO001_SO010 } from "@/data/seedCatalog/so001_so010";
import { SO021_SO030 } from "@/data/seedCatalog/so021_so030";

const EXPECTED_IDS = ["BW031", "BW032", "BW033", "BW034", "BW035", "BW036", "BW037", "BW038", "BW039", "BW040"];
const ALL_KNOWN_IDS = new Set([...BW001_BW010.map((a) => a.id), ...BW011_BW020.map((a) => a.id), ...BW021_BW030.map((a) => a.id), ...EXPECTED_IDS, ...SO001_SO010.map((a) => a.id), ...SO021_SO030.map((a) => a.id), "BW041"]);

const EXPECTED_AUDIO: Record<string, boolean> = { BW031: false, BW032: false, BW033: false, BW034: false, BW035: false, BW036: true, BW037: true, BW038: true, BW039: false, BW040: false };
const EXPECTED_FPS: Record<string, number> = { BW031: 5, BW032: 3, BW033: 5, BW034: 3, BW035: 3, BW036: 5, BW037: 5, BW038: 5, BW039: 3, BW040: 5 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = { BW031: ["BW030"], BW032: ["BW031"], BW033: ["BW032"], BW034: ["BW033"], BW035: ["BW034"], BW036: ["BW018"], BW037: ["SO021", "BW036"], BW038: ["SO027", "BW037"], BW039: ["BW010", "SO004"], BW040: ["BW014", "BW030"] };
const EXPECTED_NEXT: Record<string, string> = { BW031: "BW032", BW032: "BW033", BW033: "BW034", BW034: "BW035", BW035: "BW036", BW036: "BW037", BW037: "BW038", BW038: "BW039", BW039: "BW040", BW040: "BW041" };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REFERENCE RULES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("BW031-BW040 lightweight validation", () => {
  it("exports exactly BW031-BW040", () => {
    expect(BW031_BW040).toHaveLength(10);
    expect(BW031_BW040.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(BW031_BW040.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Better Walks and order indexes 31-40", () => {
    BW031_BW040.forEach((activity, index) => {
      expect(activity.category).toBe("BETTER_WALKS");
      expect(activity.sequenceNumber).toBe(31 + index);
      expect(activity.orderIndex).toBe(31 + index);
    });
  });

  it("has required fields and DOG_PROFILE-only reference mapping", () => {
    BW031_BW040.forEach((activity) => {
      expect(activity.id).toBeTruthy();
      expect(activity.title).toBeTruthy();
      expect(activity.lessonGoal).toBeTruthy();
      expect(activity.visibleCheckpoint).toBeTruthy();
      expect(activity.passCriteria.length).toBeGreaterThan(0);
      expect(activity.failCriteria.length).toBeGreaterThan(0);
      expect(activity.needsReviewCriteria.length).toBeGreaterThan(0);
      expect(activity.requiredReferenceAssets).toEqual(["DOG_PROFILE"]);
      expect(activity.vlmPrompt.trim().length).toBeGreaterThan(500);
    });
  });

  it("has correct leash, long-line, audio, and FPS rules", () => {
    BW031_BW040.forEach((activity) => {
      expect(activity.recordingRequirements.targetObjectRequiredInFrame).toBe(true);
      expect(activity.vlmPrompt).toMatch(/leash/i);
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
    });
    expect(BW031_BW040.find((activity) => activity.id === "BW037")?.vlmPrompt).toMatch(/long line is visible|visible attached long line/i);
    ["BW036", "BW037", "BW038"].forEach((id) => expect(BW031_BW040.find((activity) => activity.id === id)?.audioRequired).toBe(true));
  });

  it("has valid prerequisite and next links", () => {
    BW031_BW040.forEach((activity) => {
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0]);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      expect(ALL_KNOWN_IDS.has(EXPECTED_NEXT[activity.id])).toBe(true);
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    BW031_BW040.forEach((activity) => {
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
    BW031_BW040.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
