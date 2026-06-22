import { CT001_CT010 } from "@/data/seedCatalog/ct001_ct010";
import { CT011_CT020 } from "@/data/seedCatalog/ct011_ct020";
import { CT021_CT030 } from "@/data/seedCatalog/ct021_ct030";

const EXPECTED_IDS = ["CT021", "CT022", "CT023", "CT024", "CT025", "CT026", "CT027", "CT028", "CT029", "CT030"];
const ALL_KNOWN_IDS = new Set([...CT001_CT010.map((a) => a.id), ...CT011_CT020.map((a) => a.id), ...EXPECTED_IDS, "CT031"]);
const EXPECTED_REFERENCES: Record<string, string[]> = {
  CT021: ["DOG_PROFILE", "TARGET_PLATFORM"],
  CT022: ["DOG_PROFILE", "TARGET_PLATFORM"],
  CT023: ["DOG_PROFILE", "TARGET_PLATFORM"],
  CT024: ["DOG_PROFILE", "TARGET_PLATFORM"],
  CT025: ["DOG_PROFILE"],
  CT026: ["DOG_PROFILE"],
  CT027: ["DOG_PROFILE"],
  CT028: ["DOG_PROFILE"],
  CT029: ["DOG_PROFILE"],
  CT030: ["DOG_PROFILE"],
};
const EXPECTED_FPS: Record<string, number> = { CT021: 5, CT022: 5, CT023: 3, CT024: 5, CT025: 5, CT026: 5, CT027: 3, CT028: 3, CT029: 3, CT030: 5 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  CT021: ["CT020"],
  CT022: ["CT021"],
  CT023: ["CT004"],
  CT024: ["CT023"],
  CT025: ["CT009"],
  CT026: ["CT009"],
  CT027: ["CT026"],
  CT028: ["CT003"],
  CT029: ["CT028"],
  CT030: ["CT012"],
};
const EXPECTED_NEXT: Record<string, string> = { CT021: "CT022", CT022: "CT023", CT023: "CT024", CT024: "CT025", CT025: "CT026", CT026: "CT027", CT027: "CT028", CT028: "CT029", CT029: "CT030", CT030: "CT031" };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /SAVED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("CT021-CT030 lightweight validation", () => {
  it("exports exactly CT021-CT030", () => {
    expect(CT021_CT030).toHaveLength(10);
    expect(CT021_CT030.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(CT021_CT030.map((activity) => activity.id)).size).toBe(10);
  });

  it("uses Cool Tricks and Games and order indexes 21-30", () => {
    CT021_CT030.forEach((activity, index) => {
      expect(activity.category).toBe("COOL_TRICKS_AND_GAMES");
      expect(activity.sequenceNumber).toBe(21 + index);
      expect(activity.orderIndex).toBe(21 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    CT021_CT030.forEach((activity) => {
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
    ["CT021", "CT022", "CT023", "CT024"].forEach((id) => {
      const activity = CT021_CT030.find((item) => item.id === id);
      expect(activity?.requiredReferenceAssets).toContain("TARGET_PLATFORM");
      expect(activity?.recordingRequirements.targetObjectRequiredInFrame).toBe(true);
      expect(activity?.vlmPrompt).toMatch(/TARGET_PLATFORM/i);
    });
  });

  it("has correct audio and FPS rules", () => {
    CT021_CT030.forEach((activity) => {
      expect(activity.audioRequired).toBe(false);
      expect(activity.recordingRequirements.audioRequired).toBe(false);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
    });
  });

  it("has valid prerequisite and next links", () => {
    CT021_CT030.forEach((activity) => {
      expect(activity.prerequisites).toEqual(EXPECTED_PREREQUISITES[activity.id]);
      expect(activity.prerequisiteActivityId).toBe(EXPECTED_PREREQUISITES[activity.id][0] ?? null);
      expect(activity.nextActivityId).toBe(EXPECTED_NEXT[activity.id]);
      expect(activity.harderActivityId).toBe(EXPECTED_NEXT[activity.id]);
      activity.prerequisites.forEach((id) => expect(ALL_KNOWN_IDS.has(id)).toBe(true));
      expect(ALL_KNOWN_IDS.has(EXPECTED_NEXT[activity.id])).toBe(true);
    });
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    CT021_CT030.forEach((activity) => {
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
    CT021_CT030.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
