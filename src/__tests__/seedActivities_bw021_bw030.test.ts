import { BW001_BW010 } from "@/data/seedCatalog/bw001_bw010";
import { BW011_BW020 } from "@/data/seedCatalog/bw011_bw020";
import { BW021_BW030 } from "@/data/seedCatalog/bw021_bw030";

const EXPECTED_IDS = ["BW021", "BW022", "BW023", "BW024", "BW025", "BW026", "BW027", "BW028", "BW029", "BW030"];
const ALL_KNOWN_IDS = new Set([...BW001_BW010.map((activity) => activity.id), ...BW011_BW020.map((activity) => activity.id), ...EXPECTED_IDS, "BW031"]);

const EXPECTED_REFERENCES: Record<string, string[]> = {
  BW021: ["DOG_PROFILE"],
  BW022: ["DOG_PROFILE"],
  BW023: ["DOG_PROFILE"],
  BW024: ["DOG_PROFILE"],
  BW025: ["DOG_PROFILE", "TARGET_CONE"],
  BW026: ["DOG_PROFILE", "TARGET_CONE"],
  BW027: ["DOG_PROFILE"],
  BW028: ["DOG_PROFILE"],
  BW029: ["DOG_PROFILE"],
  BW030: ["DOG_PROFILE"],
};

const EXPECTED_FPS: Record<string, number> = {
  BW021: 3,
  BW022: 3,
  BW023: 3,
  BW024: 3,
  BW025: 3,
  BW026: 3,
  BW027: 3,
  BW028: 3,
  BW029: 3,
  BW030: 5,
};

const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  BW021: ["BW010"],
  BW022: ["BW021"],
  BW023: ["BW006"],
  BW024: ["BW023"],
  BW025: ["BW012"],
  BW026: ["BW025", "BW006"],
  BW027: ["BW008"],
  BW028: ["BW027"],
  BW029: ["BW028"],
  BW030: ["BW029", "BW012"],
};

const EXPECTED_NEXT: Record<string, string> = {
  BW021: "BW022",
  BW022: "BW023",
  BW023: "BW024",
  BW024: "BW025",
  BW025: "BW026",
  BW026: "BW027",
  BW027: "BW028",
  BW028: "BW029",
  BW029: "BW030",
  BW030: "BW031",
};

const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /SAVED REFERENCE-PHOTO RULES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("BW021-BW030 lightweight validation", () => {
  it("exports exactly BW021-BW030", () => {
    expect(BW021_BW030).toHaveLength(10);
    expect(BW021_BW030.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(BW021_BW030.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Better Walks and order indexes 21-30", () => {
    BW021_BW030.forEach((activity, index) => {
      expect(activity.category).toBe("BETTER_WALKS");
      expect(activity.sequenceNumber).toBe(21 + index);
      expect(activity.orderIndex).toBe(21 + index);
    });
  });

  it("has required fields and reference mapping", () => {
    BW021_BW030.forEach((activity) => {
      expect(activity.id).toBeTruthy();
      expect(activity.title).toBeTruthy();
      expect(activity.lessonGoal).toBeTruthy();
      expect(activity.visibleCheckpoint).toBeTruthy();
      expect(activity.tutorialSteps.length).toBeGreaterThan(0);
      expect(activity.passCriteria.length).toBeGreaterThan(0);
      expect(activity.failCriteria.length).toBeGreaterThan(0);
      expect(activity.needsReviewCriteria.length).toBeGreaterThan(0);
      expect(activity.requiredReferenceAssets).toEqual(EXPECTED_REFERENCES[activity.id]);
      expect(activity.requiredReferenceAssets).toContain("DOG_PROFILE");
      expect(activity.vlmPrompt.trim().length).toBeGreaterThan(500);
    });
    ["BW025", "BW026"].forEach((id) => {
      expect(BW021_BW030.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_CONE");
    });
    ["BW023", "BW024"].forEach((id) => {
      expect(BW021_BW030.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/CUSTOM_OBJECT when a specific registered staged object is required/i);
    });
  });

  it("has correct leash visibility rules", () => {
    BW021_BW030.forEach((activity) => {
      expect(activity.recordingRequirements.targetObjectRequiredInFrame).toBe(true);
      expect(activity.vlmPrompt).toMatch(/leash/i);
    });
  });

  it("has correct FPS mapping", () => {
    BW021_BW030.forEach((activity) => {
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.minClipSeconds).toBeLessThan(activity.maxClipSeconds);
      expect(activity.minClipSeconds).toBeGreaterThan(0);
    });
  });

  it("has valid prerequisite and next links", () => {
    BW021_BW030.forEach((activity) => {
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0]);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      expect(ALL_KNOWN_IDS.has(EXPECTED_NEXT[activity.id])).toBe(true);
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    BW021_BW030.forEach((activity) => {
      REQUIRED_PROMPT_SECTIONS.forEach((section) => expect(activity.vlmPrompt).toMatch(section));
      expect(activity.vlmPrompt).toContain(activity.id);
      expect(activity.vlmPrompt).toContain(activity.title);
      expect(activity.vlmPrompt).toContain(activity.visibleCheckpoint);
      expect(activity.vlmPrompt).toMatch(/PASS \| FAIL \| NEEDS_REVIEW/);
      expect(activity.vlmPrompt).toMatch(/Missing evidence is never FAIL/i);
      expect(activity.vlmPrompt).not.toMatch(/Did the dog complete the activity\?/i);
    });
  });

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake verdict path", () => {
    BW021_BW030.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
