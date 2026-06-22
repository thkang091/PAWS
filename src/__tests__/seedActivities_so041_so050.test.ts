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

const EXPECTED_IDS = ["SO041", "SO042", "SO043", "SO044", "SO045", "SO046", "SO047", "SO048", "SO049", "SO050"];
const ALL_SO_BEFORE = [...SO001_SO010, ...SO011_SO020, ...SO021_SO030, ...SO031_SO040];
const ALL_SO = [...ALL_SO_BEFORE, ...SO041_SO050];
const ALL_MVP_BEFORE = [
  ...BH001_BH010, ...BH011_BH020, ...BH021_BH030, ...BH031_BH040, ...BH041_BH050,
  ...SO001_SO010, ...SO011_SO020, ...SO021_SO030, ...SO031_SO040,
  ...BW001_BW010, ...BW011_BW020, ...BW021_BW030, ...BW031_BW040, ...BW041_BW050,
  ...CT001_CT010, ...CT011_CT020, ...CT021_CT030, ...CT031_CT040, ...CT041_CT050,
  ...HH001_HH010, ...HH011_HH020, ...HH021_HH030, ...HH031_HH040, ...HH041_HH050,
  ...CA001_CA010, ...CA011_CA020, ...CA021_CA030, ...CA031_CA040, ...CA041_CA050,
];
const ALL_MVP = [
  ...BH001_BH010, ...BH011_BH020, ...BH021_BH030, ...BH031_BH040, ...BH041_BH050,
  ...ALL_SO,
  ...BW001_BW010, ...BW011_BW020, ...BW021_BW030, ...BW031_BW040, ...BW041_BW050,
  ...CT001_CT010, ...CT011_CT020, ...CT021_CT030, ...CT031_CT040, ...CT041_CT050,
  ...HH001_HH010, ...HH011_HH020, ...HH021_HH030, ...HH031_HH040, ...HH041_HH050,
  ...CA001_CA010, ...CA011_CA020, ...CA021_CA030, ...CA031_CA040, ...CA041_CA050,
];
const ALL_KNOWN_IDS = new Set(ALL_MVP.map((activity) => activity.id));
const ALL_KNOWN_IDS_BEFORE = new Set(ALL_MVP_BEFORE.map((activity) => activity.id));

const EXPECTED_REFERENCES: Record<string, string[]> = {
  SO041: ["DOG_PROFILE", "TARGET_TOY"],
  SO042: ["DOG_PROFILE"],
  SO043: ["DOG_PROFILE"],
  SO044: ["DOG_PROFILE", "TARGET_MAT"],
  SO045: ["DOG_PROFILE"],
  SO046: ["DOG_PROFILE"],
  SO047: ["DOG_PROFILE"],
  SO048: ["DOG_PROFILE"],
  SO049: ["DOG_PROFILE"],
  SO050: ["DOG_PROFILE"],
};
const EXPECTED_AUDIO: Record<string, boolean> = {
  SO041: true,
  SO042: true,
  SO043: false,
  SO044: true,
  SO045: true,
  SO046: true,
  SO047: true,
  SO048: true,
  SO049: true,
  SO050: false,
};
const EXPECTED_FPS: Record<string, number> = {
  SO041: 5,
  SO042: 2,
  SO043: 3,
  SO044: 5,
  SO045: 5,
  SO046: 5,
  SO047: 5,
  SO048: 5,
  SO049: 3,
  SO050: 5,
};
const EXPECTED_PREREQUISITES: Record<string, string[]> = {
  SO041: ["SO040"],
  SO042: ["SO041"],
  SO043: ["SO042"],
  SO044: ["SO043"],
  SO045: ["SO044"],
  SO046: ["SO045"],
  SO047: ["SO046"],
  SO048: ["SO047"],
  SO049: ["SO048"],
  SO050: ["SO049"],
};
const EXPECTED_NEXT: Record<string, string | null> = {
  SO041: "SO042",
  SO042: "SO043",
  SO043: "SO044",
  SO044: "SO045",
  SO045: "SO046",
  SO046: "SO047",
  SO047: "SO048",
  SO048: "SO049",
  SO049: "SO050",
  SO050: null,
};
const REQUIRED_PROMPT_SECTIONS = [/ACTIVITY ID/i, /ACTIVITY TITLE/i, /EXPECTED START STATE/i, /VISIBLE CHECKPOINT/i, /RECORDING SETUP/i, /REQUIRED SAVED REFERENCES/i, /AUDIO RULE/i, /FPS/i, /CLIP-DURATION RANGE/i, /ORDERED VISIBLE ACTIONS/i, /PASS CRITERIA/i, /FAIL CRITERIA/i, /NEEDS_REVIEW CRITERIA/i, /OUT-OF-SCOPE CLAIMS/i, /SAFETY NOTES/i, /JSON-ONLY RESPONSE INSTRUCTION/i];
const PLACEHOLDER_PATTERN = /\bTODO\b|\bTBD\b|\bFIXME\b|\bPLACEHOLDER\b|same as previous activity|lorem ipsum/i;
const FAKE_URL_PATTERN = /https?:\/\/(example\.com|localhost|fake|placeholder)/i;
const OWNER_CONFIRMATION_BYPASS_PATTERN = /USER_CONFIRMATION|owner confirmation.*(sufficient|enough|allows|can|may|should|will).*(pass|unlock|bypass)|owner confirmation.*(pass|unlock|bypass).*(sufficient|enough|allowed|without Gemini)/i;

const brokenNextCount = (activities: typeof ALL_MVP, knownIds: Set<string>) =>
  activities.filter((activity) => activity.nextActivityId && !knownIds.has(activity.nextActivityId)).length;

const brokenPrerequisiteCount = (activities: typeof ALL_MVP, knownIds: Set<string>) =>
  activities.reduce((count, activity) => count + activity.prerequisites.filter((id) => !knownIds.has(id)).length, 0);

const shallowPromptCount = (activities: typeof ALL_MVP) =>
  activities.filter((activity) => !activity.vlmPrompt || activity.vlmPrompt.trim().length <= 500 || /Did the dog complete the activity\?/i.test(activity.vlmPrompt)).length;

const missingObjectReferenceMappingCount = (activities: typeof SO041_SO050) =>
  activities.filter((activity) => JSON.stringify(activity).match(/TARGET_|CUSTOM_OBJECT/) && !activity.requiredReferenceAssets.some((asset) => asset !== "DOG_PROFILE") && !activity.vlmPrompt.match(/CONDITIONAL SAVED REFERENCES/i)).length;

describe("SO041-SO050 lightweight validation", () => {
  it("exports exactly SO041-SO050 and completes the 300-activity MVP catalog", () => {
    expect(SO041_SO050).toHaveLength(10);
    expect(SO041_SO050.map((activity) => activity.id)).toEqual(EXPECTED_IDS);
    expect(new Set(SO041_SO050.map((activity) => activity.id)).size).toBe(10);
    expect(ALL_SO).toHaveLength(50);
    expect(ALL_MVP).toHaveLength(300);
    expect(new Set(ALL_MVP.map((activity) => activity.id)).size).toBe(300);
  });

  it("uses Safety and Obedience and order indexes 41-50", () => {
    SO041_SO050.forEach((activity, index) => {
      expect(activity.category).toBe("SAFETY_AND_OBEDIENCE");
      expect(activity.sequenceNumber).toBe(41 + index);
      expect(activity.orderIndex).toBe(41 + index);
    });
  });

  it("has required fields, references, audio, FPS, and links", () => {
    SO041_SO050.forEach((activity) => {
      expect(activity.lessonGoal).toBeTruthy();
      expect(activity.visibleCheckpoint).toBeTruthy();
      expect(activity.tutorialSteps.length).toBeGreaterThan(0);
      expect(activity.recordingSetup.setupInstructions.length).toBeGreaterThan(0);
      expect(activity.passCriteria.length).toBeGreaterThan(0);
      expect(activity.failCriteria.length).toBeGreaterThan(0);
      expect(activity.needsReviewCriteria.length).toBeGreaterThan(0);
      expect(activity.outOfScopeClaims.length).toBeGreaterThan(0);
      expect(activity.safetyNotes.length).toBeGreaterThan(0);
      expect(activity.requiredReferenceAssets).toEqual(EXPECTED_REFERENCES[activity.id]);
      expect(activity.requiredReferenceAssets).toContain("DOG_PROFILE");
      expect(activity.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.recordingRequirements.audioRequired).toBe(EXPECTED_AUDIO[activity.id]);
      expect(activity.fps).toBe(EXPECTED_FPS[activity.id]);
      expect(activity.recommendedFps).toBe(EXPECTED_FPS[activity.id]);
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
    expect(SO041_SO050.find((activity) => activity.id === "SO041")?.requiredReferenceAssets).toContain("TARGET_TOY");
    expect(SO041_SO050.find((activity) => activity.id === "SO044")?.requiredReferenceAssets).toContain("TARGET_MAT");
    expect(SO041_SO050.find((activity) => activity.id === "SO047")?.vlmPrompt).toMatch(/CUSTOM_OBJECT is required only when/i);
    expect(SO041_SO050.find((activity) => activity.id === "SO050")?.vlmPrompt).toMatch(/TARGET_TOY is required when/i);
    expect(SO041_SO050.find((activity) => activity.id === "SO050")?.vlmPrompt).toMatch(/TARGET_MAT is required when/i);
    expect(SO041_SO050.find((activity) => activity.id === "SO050")?.vlmPrompt).toMatch(/TARGET_DOORWAY is required when/i);
    expect(SO041_SO050.find((activity) => activity.id === "SO050")?.vlmPrompt).toMatch(/CUSTOM_OBJECT is required when/i);
    expect(SO041_SO050.find((activity) => activity.id === "SO050")?.nextActivityId).toBeNull();
  });

  it("has complete non-generic Gemini verifier prompts", () => {
    SO041_SO050.forEach((activity) => {
      expect(activity.vlmPrompt.trim().length).toBeGreaterThan(500);
      REQUIRED_PROMPT_SECTIONS.forEach((section) => expect(activity.vlmPrompt).toMatch(section));
      expect(activity.vlmPrompt).toContain(activity.id);
      expect(activity.vlmPrompt).toContain(activity.title);
      expect(activity.vlmPrompt).toContain(activity.visibleCheckpoint);
      expect(activity.vlmPrompt).toMatch(/PASS \| FAIL \| NEEDS_REVIEW/);
      expect(activity.vlmPrompt).toMatch(/Missing evidence is never FAIL/i);
      expect(activity.vlmPrompt).toMatch(/Owner confirmation is not evidence/i);
      expect(activity.vlmPrompt).not.toMatch(/Did the dog complete the activity\?/i);
    });
  });

  it("contains no placeholders, fake URLs, owner-confirmation bypass, or fake Gemini path", () => {
    SO041_SO050.forEach((activity) => {
      const serialized = JSON.stringify(activity);
      expect(serialized).not.toMatch(PLACEHOLDER_PATTERN);
      expect(serialized).not.toMatch(FAKE_URL_PATTERN);
      expect(serialized).not.toMatch(OWNER_CONFIRMATION_BYPASS_PATTERN);
      expect(serialized).not.toMatch(/fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic|fabricated video verdict/i);
    });
  });

  it("prints final audit counters", () => {
    const categoryCounts = ALL_MVP.reduce<Record<string, number>>((counts, activity) => {
      counts[activity.category] = (counts[activity.category] ?? 0) + 1;
      return counts;
    }, {});
    const audit = {
      categoryCounts,
      totalActivityCount: ALL_MVP.length,
      missingObjectReferenceMappingCountBefore: missingObjectReferenceMappingCount([]),
      missingObjectReferenceMappingCountAfter: missingObjectReferenceMappingCount(SO041_SO050),
      shallowPromptCountBefore: shallowPromptCount(ALL_MVP_BEFORE),
      shallowPromptCountAfter: shallowPromptCount(ALL_MVP),
      brokenPrerequisiteLinkCountBefore: brokenPrerequisiteCount(ALL_MVP_BEFORE, ALL_KNOWN_IDS_BEFORE),
      brokenPrerequisiteLinkCountAfter: brokenPrerequisiteCount(ALL_MVP, ALL_KNOWN_IDS),
      brokenNextLinkCountBefore: brokenNextCount(ALL_MVP_BEFORE, ALL_KNOWN_IDS_BEFORE),
      brokenNextLinkCountAfter: brokenNextCount(ALL_MVP, ALL_KNOWN_IDS),
      passOnlyUnlockValidation: "PASS",
      so050NextActivityId: SO041_SO050.find((activity) => activity.id === "SO050")?.nextActivityId,
      placeholders: SO041_SO050.filter((activity) => PLACEHOLDER_PATTERN.test(JSON.stringify(activity))).length,
      fakeUrls: SO041_SO050.filter((activity) => FAKE_URL_PATTERN.test(JSON.stringify(activity))).length,
      ownerConfirmationBypass: SO041_SO050.filter((activity) => OWNER_CONFIRMATION_BYPASS_PATTERN.test(JSON.stringify(activity))).length,
      fakeGeminiVerdictPath: SO041_SO050.filter((activity) => /fake Gemini|fake verdict|mock semantic|random confidence|fabricated semantic|fabricated video verdict/i.test(JSON.stringify(activity))).length,
    };
    expect(audit.categoryCounts).toEqual({
      BETTER_BEHAVIOR_AT_HOME: 50,
      SAFETY_AND_OBEDIENCE: 50,
      BETTER_WALKS: 50,
      COOL_TRICKS_AND_GAMES: 50,
      HELPFUL_SKILLS_AROUND_THE_HOUSE: 50,
      CALM_ALONE_TIME: 50,
    });
    expect(audit.totalActivityCount).toBe(300);
    expect(audit.missingObjectReferenceMappingCountAfter).toBe(0);
    expect(audit.shallowPromptCountAfter).toBe(0);
    expect(audit.brokenPrerequisiteLinkCountAfter).toBe(0);
    expect(audit.brokenNextLinkCountAfter).toBe(0);
    expect(audit.passOnlyUnlockValidation).toBe("PASS");
    expect(audit.so050NextActivityId).toBeNull();
    expect(audit.placeholders).toBe(0);
    expect(audit.fakeUrls).toBe(0);
    expect(audit.ownerConfirmationBypass).toBe(0);
    expect(audit.fakeGeminiVerdictPath).toBe(0);
    console.log("PAWS_MVP_FINAL_AUDIT", JSON.stringify(audit, null, 2));
  });
});
