import { BH001_BH010 } from "@/data/seedCatalog/bh001_bh010";
import { BH011_BH020 } from "@/data/seedCatalog/bh011_bh020";
import { BH021_BH030 } from "@/data/seedCatalog/bh021_bh030";
import { BH031_BH040 } from "@/data/seedCatalog/bh031_bh040";
import { BH041_BH050 } from "@/data/seedCatalog/bh041_bh050";
import { BW001_BW010 } from "@/data/seedCatalog/bw001_bw010";
import { BW011_BW020 } from "@/data/seedCatalog/bw011_bw020";
import { BW021_BW030 } from "@/data/seedCatalog/bw021_bw030";
import { BW031_BW040 } from "@/data/seedCatalog/bw031_bw040";
import { BW041_BW050 } from "@/data/seedCatalog/bw041_bw050";
import { CA001_CA010 } from "@/data/seedCatalog/ca001_ca010";
import { CA011_CA020 } from "@/data/seedCatalog/ca011_ca020";
import { CA021_CA030 } from "@/data/seedCatalog/ca021_ca030";
import { CA031_CA040 } from "@/data/seedCatalog/ca031_ca040";
import { CA041_CA050 } from "@/data/seedCatalog/ca041_ca050";
import { CT001_CT010 } from "@/data/seedCatalog/ct001_ct010";
import { CT011_CT020 } from "@/data/seedCatalog/ct011_ct020";
import { CT021_CT030 } from "@/data/seedCatalog/ct021_ct030";
import { CT031_CT040 } from "@/data/seedCatalog/ct031_ct040";
import { CT041_CT050 } from "@/data/seedCatalog/ct041_ct050";
import { HH001_HH010 } from "@/data/seedCatalog/hh001_hh010";
import { HH011_HH020 } from "@/data/seedCatalog/hh011_hh020";
import { HH021_HH030 } from "@/data/seedCatalog/hh021_hh030";
import { HH031_HH040 } from "@/data/seedCatalog/hh031_hh040";
import { HH041_HH050 } from "@/data/seedCatalog/hh041_hh050";
import { SO001_SO010 } from "@/data/seedCatalog/so001_so010";
import { SO011_SO020 } from "@/data/seedCatalog/so011_so020";
import { SO021_SO030 } from "@/data/seedCatalog/so021_so030";
import { SO031_SO040 } from "@/data/seedCatalog/so031_so040";
import { SO041_SO050 } from "@/data/seedCatalog/so041_so050";

const EXPECTED_IDS = ["CA041", "CA042", "CA043", "CA044", "CA045", "CA046", "CA047", "CA048", "CA049", "CA050"];
const ALL_CA = [...CA001_CA010, ...CA011_CA020, ...CA021_CA030, ...CA031_CA040, ...CA041_CA050];
const ALL_MVP = [
  ...BH001_BH010, ...BH011_BH020, ...BH021_BH030, ...BH031_BH040, ...BH041_BH050,
  ...SO001_SO010, ...SO011_SO020, ...SO021_SO030, ...SO031_SO040, ...SO041_SO050,
  ...BW001_BW010, ...BW011_BW020, ...BW021_BW030, ...BW031_BW040, ...BW041_BW050,
  ...CT001_CT010, ...CT011_CT020, ...CT021_CT030, ...CT031_CT040, ...CT041_CT050,
  ...HH001_HH010, ...HH011_HH020, ...HH021_HH030, ...HH031_HH040, ...HH041_HH050,
  ...ALL_CA,
];
const ALL_KNOWN_IDS = new Set([...ALL_CA.map((a) => a.id)]);
const EXPECTED_REFERENCES: Record<string, string[]> = {
  CA041: ["DOG_PROFILE"],
  CA042: ["DOG_PROFILE"],
  CA043: ["DOG_PROFILE", "TARGET_DOORWAY"],
  CA044: ["DOG_PROFILE", "TARGET_DOORWAY"],
  CA045: ["DOG_PROFILE", "TARGET_DOORWAY"],
  CA046: ["DOG_PROFILE", "TARGET_MAT"],
  CA047: ["DOG_PROFILE", "TARGET_CRATE"],
  CA048: ["DOG_PROFILE", "CUSTOM_OBJECT"],
  CA049: ["DOG_PROFILE", "TARGET_DOORWAY"],
  CA050: ["DOG_PROFILE", "TARGET_DOORWAY"],
};
const EXPECTED_AUDIO: Record<string, boolean> = { CA041: false, CA042: false, CA043: false, CA044: false, CA045: false, CA046: false, CA047: false, CA048: false, CA049: false, CA050: false };
const EXPECTED_FPS: Record<string, number> = { CA041: 3, CA042: 3, CA043: 3, CA044: 3, CA045: 3, CA046: 2, CA047: 2, CA048: 2, CA049: 3, CA050: 3 };
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  CA041: ["CA033"],
  CA042: ["CA041"],
  CA043: ["CA042"],
  CA044: ["CA043"],
  CA045: ["CA044"],
  CA046: ["CA028", "CA039"],
  CA047: ["CA040"],
  CA048: ["CA038"],
  CA049: ["CA045", "CA046", "CA047"],
  CA050: ["CA049"],
};
const EXPECTED_NEXT: Record<string, string | null> = { CA041: "CA042", CA042: "CA043", CA043: "CA044", CA044: "CA045", CA045: "CA046", CA046: "CA047", CA047: "CA048", CA048: "CA049", CA049: "CA050", CA050: null };
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REQUIRED SAVED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;
const FORBIDDEN_POSITIVE_CLAIMS = /\bdog feels calm\b|\bdog feels safe\b|\bdog is comfortable alone\b|\btreatment worked\b|\bdog is ready to stay home alone\b|\bdog is cured\b|\bdog is safe to leave alone indefinitely\b/i;

describe("CA041-CA050 lightweight validation", () => {
  it("exports exactly CA041-CA050 and keeps Calm Alone Time count at 50", () => {
    expect(CA041_CA050).toHaveLength(10);
    expect(CA041_CA050.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(CA041_CA050.map((activity) => activity.id)).size).toBe(10);
    expect(ALL_CA).toHaveLength(50);
    expect(new Set(ALL_CA.map((activity) => activity.id)).size).toBe(50);
  });

  it("confirms current MVP seed catalog count", () => {
    expect(ALL_MVP).toHaveLength(300);
    expect(new Set(ALL_MVP.map((activity) => activity.id)).size).toBe(300);
  });

  it("uses Calm Alone Time and order indexes 41-50", () => {
    CA041_CA050.forEach((activity, index) => {
      expect(activity.category).toBe("CALM_ALONE_TIME");
      expect(activity.sequenceNumber).toBe(41 + index);
      expect(activity.orderIndex).toBe(41 + index);
    });
  });

  it("has required fields and correct reference mapping", () => {
    CA041_CA050.forEach((activity) => {
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
    });
    ["CA041", "CA042"].forEach((id) => expect(CA041_CA050.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/CUSTOM_OBJECT is required only if/i));
    ["CA043", "CA044", "CA045", "CA049", "CA050"].forEach((id) => expect(CA041_CA050.find((activity) => activity.id === id)?.requiredReferenceAssets).toContain("TARGET_DOORWAY"));
    expect(CA041_CA050.find((activity) => activity.id === "CA046")?.requiredReferenceAssets).toContain("TARGET_MAT");
    expect(CA041_CA050.find((activity) => activity.id === "CA047")?.requiredReferenceAssets).toContain("TARGET_CRATE");
    expect(CA041_CA050.find((activity) => activity.id === "CA048")?.requiredReferenceAssets).toContain("CUSTOM_OBJECT");
    ["CA048", "CA049", "CA050"].forEach((id) => expect(CA041_CA050.find((activity) => activity.id === id)?.vlmPrompt).toMatch(/TARGET_MAT or TARGET_CRATE/i));
  });

  it("has correct audio, FPS, prompts, and links", () => {
    CA041_CA050.forEach((activity) => {
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.questContentType).toBe("AI_VERIFIED_MAIN_QUEST");
      expect(activity.vlmPrompt.trim().length).toBeGreaterThan(500);
      REQUIRED_PROMPT_SECTIONS.forEach((section) => expect(activity.vlmPrompt).toMatch(section));
      expect(activity.vlmPrompt).toContain(activity.id);
      expect(activity.vlmPrompt).toContain(activity.title);
      expect(activity.vlmPrompt).toContain(activity.visibleCheckpoint);
      expect(activity.vlmPrompt).toMatch(/PASS \| FAIL \| NEEDS_REVIEW/);
      expect(activity.vlmPrompt).toMatch(/Missing evidence is never FAIL/i);
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
    expect(CA041_CA050.find((activity) => activity.id === "CA050")?.nextActivityId).toBeNull();
  });

  it("contains no placeholders, fake URLs, owner-confirmation bypass, fake Gemini path, or forbidden positive claims", () => {
    CA041_CA050.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      const positiveClaimSurface = JSON.stringify({
        lessonGoal: activity.lessonGoal,
        whyItMatters: activity.whyItMatters,
        tutorialSteps: activity.tutorialSteps,
        visibleCheckpoint: activity.visibleCheckpoint,
        passCriteria: activity.passCriteria,
        failCriteria: activity.failCriteria,
        needsReviewCriteria: activity.needsReviewCriteria,
        safetyNotes: activity.safetyNotes,
      });
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(/owner confirmation.*(unlock|bypass)|USER_CONFIRMATION/i);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic|fabricated video verdict/i);
      expect(positiveClaimSurface).not.toMatch(FORBIDDEN_POSITIVE_CLAIMS);
      expect(activity.vlmPrompt).toMatch(/Verify only visible or audible evidence/i);
      expect(activity.outOfScopeClaims.join(" ")).toMatch(/Do not/i);
    });
  });
});
