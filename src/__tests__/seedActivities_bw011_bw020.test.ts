import { BW001_BW010 } from "@/data/seedCatalog/bw001_bw010";
import { BW011_BW020 } from "@/data/seedCatalog/bw011_bw020";

const EXPECTED_IDS = ["BW011", "BW012", "BW013", "BW014", "BW015", "BW016", "BW017", "BW018", "BW019", "BW020"];
const ALL_KNOWN_IDS = new Set([...BW001_BW010.map((activity) => activity.id), ...EXPECTED_IDS, "BW021"]);

const EXPECTED_REFERENCES: Record<string, string[]> = {
  BW011: ["DOG_PROFILE"],
  BW012: ["DOG_PROFILE"],
  BW013: ["DOG_PROFILE"],
  BW014: ["DOG_PROFILE"],
  BW015: ["DOG_PROFILE"],
  BW016: ["DOG_PROFILE"],
  BW017: ["DOG_PROFILE"],
  BW018: ["DOG_PROFILE"],
  BW019: ["DOG_PROFILE", "TARGET_DOORWAY"],
  BW020: ["DOG_PROFILE"],
};

const EXPECTED_AUDIO: Record<string, boolean> = {
  BW011: true,
  BW012: false,
  BW013: true,
  BW014: true,
  BW015: false,
  BW016: false,
  BW017: true,
  BW018: true,
  BW019: true,
  BW020: true,
};

const EXPECTED_FPS: Record<string, number> = {
  BW011: 3,
  BW012: 5,
  BW013: 5,
  BW014: 5,
  BW015: 5,
  BW016: 5,
  BW017: 3,
  BW018: 5,
  BW019: 3,
  BW020: 3,
};

const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  BW011: ["BW010"],
  BW012: ["BW011"],
  BW013: ["BW012"],
  BW014: ["BW013"],
  BW015: ["BW012"],
  BW016: ["BW015"],
  BW017: ["BW011"],
  BW018: ["BW017"],
  BW019: ["BW011"],
  BW020: ["BW019"],
};

const EXPECTED_NEXT: Record<string, string> = {
  BW011: "BW012",
  BW012: "BW013",
  BW013: "BW014",
  BW014: "BW015",
  BW015: "BW016",
  BW016: "BW017",
  BW017: "BW018",
  BW018: "BW019",
  BW019: "BW020",
  BW020: "BW021",
};

const REQUIRED_PROMPT_SECTIONS = [
  /ACTIVITY ID/i,
  /ACTIVITY TITLE/i,
  /EXPECTED START STATE/i,
  /VISIBLE CHECKPOINT/i,
  /RECORDING SETUP/i,
  /SAVED REFERENCE-PHOTO RULES/i,
  /AUDIO RULE/i,
  /FPS/i,
  /CLIP-DURATION RANGE/i,
  /ORDERED VISIBLE ACTIONS/i,
  /PASS CRITERIA/i,
  /FAIL CRITERIA/i,
  /NEEDS_REVIEW CRITERIA/i,
  /OUT-OF-SCOPE CLAIMS/i,
  /SAFETY NOTES/i,
  /JSON-ONLY RESPONSE INSTRUCTION/i,
];

const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("BW011-BW020 lightweight validation", () => {
  it("exports exactly BW011-BW020", () => {
    expect(BW011_BW020).toHaveLength(10);
    expect(BW011_BW020.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(BW011_BW020.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Better Walks and order indexes 11-20", () => {
    BW011_BW020.forEach((activity, index) => {
      expect(activity.category).toBe("BETTER_WALKS");
      expect(activity.sequenceNumber).toBe(11 + index);
      expect(activity.orderIndex).toBe(11 + index);
    });
  });

  it("has required fields and reference mapping", () => {
    BW011_BW020.forEach((activity) => {
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
    expect(BW011_BW020.find((activity) => activity.id === "BW019")?.requiredReferenceAssets).toContain("TARGET_DOORWAY");
    expect(BW011_BW020.find((activity) => activity.id === "BW020")?.vlmPrompt).toMatch(/safely parked vehicle|vehicle exit boundary/i);
  });

  it("has correct leash visibility rules", () => {
    BW011_BW020.forEach((activity) => {
      expect(activity.recordingRequirements.targetObjectRequiredInFrame).toBe(true);
      expect(activity.vlmPrompt).toMatch(/leash/i);
    });
  });

  it("has correct audio mapping", () => {
    BW011_BW020.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      if (EXPECTED_AUDIO[activity.id]) {
        expect(activity.vlmPrompt).toMatch(/Audio is required/i);
      }
    });
  });

  it("has correct FPS and clip duration ranges", () => {
    BW011_BW020.forEach((activity) => {
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.minClipSeconds).toBeLessThan(activity.maxClipSeconds);
      expect(activity.minClipSeconds).toBeGreaterThan(0);
    });
  });

  it("has valid prerequisite and next links", () => {
    BW011_BW020.forEach((activity) => {
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0]);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      expect(ALL_KNOWN_IDS.has(EXPECTED_NEXT[activity.id])).toBe(true);
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    BW011_BW020.forEach((activity) => {
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
    BW011_BW020.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
