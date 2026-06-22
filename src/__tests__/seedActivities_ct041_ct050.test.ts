import { CT001_CT010 } from "@/data/seedCatalog/ct001_ct010";
import { CT011_CT020 } from "@/data/seedCatalog/ct011_ct020";
import { CT021_CT030 } from "@/data/seedCatalog/ct021_ct030";
import { CT031_CT040 } from "@/data/seedCatalog/ct031_ct040";
import { CT041_CT050 } from "@/data/seedCatalog/ct041_ct050";
import { SO001_SO010 } from "@/data/seedCatalog/so001_so010";
import { SO011_SO020 } from "@/data/seedCatalog/so011_so020";

const EXPECTED_IDS = ["CT041", "CT042", "CT043", "CT044", "CT045", "CT046", "CT047", "CT048", "CT049", "CT050"];
const ALL_CT_ACTIVITIES = [...CT001_CT010, ...CT011_CT020, ...CT021_CT030, ...CT031_CT040, ...CT041_CT050];
const ALL_KNOWN_IDS = new Set([...ALL_CT_ACTIVITIES.map((a) => a.id), ...SO001_SO010.map((a) => a.id), ...SO011_SO020.map((a) => a.id), "SO042"]);
const EXPECTED_REFERENCES: Record<string, string[]> = {
  CT041: ["DOG_PROFILE"],
  CT042: ["DOG_PROFILE"],
  CT043: ["DOG_PROFILE", "TARGET_PLATFORM"],
  CT044: ["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"],
  CT045: ["DOG_PROFILE"],
  CT046: ["DOG_PROFILE"],
  CT047: ["DOG_PROFILE"],
  CT048: ["DOG_PROFILE"],
  CT049: ["DOG_PROFILE"],
  CT050: ["DOG_PROFILE"],
};
const EXPECTED_AUDIO: Record<string, boolean> = { CT041: false, CT042: false, CT043: false, CT044: false, CT045: false, CT046: false, CT047: false, CT048: false, CT049: false, CT050: false };
const EXPECTED_FPS: Record<string, number> = { CT041: 3, CT042: 5, CT043: 5, CT044: 5, CT045: 5, CT046: 5, CT047: 5, CT048: 1, CT049: 5, CT050: 5 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  CT041: ["CT020", "SO014"],
  CT042: ["CT006", "CT007", "CT009"],
  CT043: ["CT021", "CT022"],
  CT044: ["CT036"],
  CT045: ["CT041", "CT042", "CT043"],
  CT046: ["CT045"],
  CT047: ["SO004", "CT041"],
  CT048: ["SO042", "CT013"],
  CT049: ["CT046", "CT047", "CT048", "CT044", "CT043"],
  CT050: ["CT046", "CT049"],
};
const EXPECTED_NEXT: Record<string, string | null> = { CT041: "CT042", CT042: "CT043", CT043: "CT044", CT044: "CT045", CT045: "CT046", CT046: "CT047", CT047: "CT048", CT048: "CT049", CT049: "CT050", CT050: null };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REQUIRED SAVED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;

describe("CT041-CT050 lightweight validation", () => {
  it("exports exactly CT041-CT050 and brings total Cool Tricks count to 50", () => {
    expect(CT041_CT050).toHaveLength(10);
    expect(CT041_CT050.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(CT041_CT050.map((activity) => activity.id)).size).toBe(10);
    expect(ALL_CT_ACTIVITIES).toHaveLength(50);
    expect(new Set(ALL_CT_ACTIVITIES.map((activity) => activity.id)).size).toBe(50);
  });

  it("uses Cool Tricks and Games and order indexes 41-50", () => {
    CT041_CT050.forEach((activity, index) => {
      expect(activity.category).toBe("COOL_TRICKS_AND_GAMES");
      expect(activity.sequenceNumber).toBe(41 + index);
      expect(activity.orderIndex).toBe(41 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    CT041_CT050.forEach((activity) => {
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
    expect(CT041_CT050.find((activity) => activity.id === "CT043")?.requiredReferenceAssets).toContain("TARGET_PLATFORM");
    expect(CT041_CT050.find((activity) => activity.id === "CT044")?.requiredReferenceAssets).toEqual(["DOG_PROFILE", "TARGET_TOY", "TARGET_BASKET"]);
    ["CT049", "CT050"].forEach((id) => expect(CT041_CT050.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/Activity-specific registered references are required only when/i));
  });

  it("has correct audio and FPS rules", () => {
    CT041_CT050.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
    });
    expect(CT041_CT050.find((activity) => activity.id === "CT047")?.vlmPrompt).toMatch(/Audio is required when verbal cue timing is scored/i);
    expect(CT041_CT050.find((activity) => activity.id === "CT048")?.vlmPrompt).toMatch(/Audio is required when release cue is judged/i);
  });

  it("has valid prerequisite and next links", () => {
    CT041_CT050.forEach((activity) => {
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
    expect(CT041_CT050.find((activity) => activity.id === "CT050")?.nextActivityId).toBeNull();
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    CT041_CT050.forEach((activity) => {
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
    CT041_CT050.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic/i);
    });
  });
});
