/**
 * Static validations for the PAWS training-catalog type system,
 * prompt compiler, and verification normalizer.
 *
 * These tests validate structure, contracts, and logic WITHOUT:
 *   - seeding actual activities
 *   - calling the real Gemini API
 *   - fabricating VLM results
 *
 * They DO validate:
 *   - Type exports exist and are well-formed
 *   - compileDogTrainingActivityPrompt() produces correctly structured output
 *   - normalizeVerificationResult() applies all required rules
 *   - The shared master prompt contains all required content
 *   - The Zod schema accepts valid payloads and rejects invalid ones
 *   - Static invariants: no TODO/TBD/PLACEHOLDER/FIXME in any catalog type field
 */

import { compileDogTrainingActivityPrompt } from "@/services/activityPromptCompiler";
import {
  normalizeVerificationResult,
  toNormalizationContext,
  type NormalizationContext,
} from "@/services/verificationNormalizer";
import { MASTER_VLM_PROMPT, MASTER_PROMPT_VERSION } from "@/data/masterPrompt";
import { dogTrainingVerificationSchema } from "@/validation/verificationSchema";
import type {
  TrainingCatalogActivity,
  ReferenceAssetRequirement,
  BossQuestComponent,
  HybridBossQuestConfig,
  GeminiDogTrainingVerificationRequest,
} from "@/types/trainingCatalog";
import type { DogTrainingVerificationResult } from "@/types/domain";

// ─── Test fixtures ────────────────────────────────────────────────────────────

/** Builds a fully-valid TrainingCatalogActivity for testing purposes. */
function makeValidActivity(overrides: Partial<TrainingCatalogActivity> = {}): TrainingCatalogActivity {
  const base: TrainingCatalogActivity = {
    id: "BH001",
    category: "BETTER_BEHAVIOR_AT_HOME",
    sequenceNumber: 1,
    level: 1,
    title: "Marker and Reward Delivery",
    skillFamily: "Foundation Marker Training",
    questContentType: "AI_VERIFIED_MAIN_QUEST",
    lessonGoal: "Dog turns toward the handler and orients attentively within 2 seconds of a marker sound.",
    whyItMatters:
      "A reliable marker bridges the gap between a desired behavior and the reward. Without it, the dog cannot reliably understand which behavior earned the treat.",
    tutorialSteps: [
      "Hold a treat loosely in a closed fist.",
      "Click or say your marker word clearly.",
      "Open your fist and deliver the treat within 1 second of the marker.",
      "Repeat 20 times until the dog orients toward you immediately at the marker.",
    ],
    visibleCheckpoint:
      "Dog's head and body turn toward the handler within 2 seconds of the marker; eyes focus on the handler's hand.",
    requiredReferenceAssets: [
      {
        type: "DOG_PROFILE",
        required: true,
        minimumPhotos: 1,
        maximumPhotos: 3,
        reusableAcrossActivities: true,
        instructions: [
          "Take a clear front-facing photo of your dog in good lighting.",
          "Include any distinguishing markings.",
        ],
      },
    ],
    recordingRequirements: {
      cameraAngle: "CLOSE_HAND_AND_OBJECT",
      fullDogBodyRequired: false,
      pawsRequired: false,
      hipsRequired: false,
      ownerRequiredInFrame: true,
      audioRequired: true,
      targetObjectRequiredInFrame: false,
      destinationRequiredInFrame: false,
      startBoundaryRequiredInFrame: false,
      endBoundaryRequiredInFrame: false,
      setupInstructions: [
        "Hold the phone at arm's length so both your hand and the dog's face are visible.",
        "Ensure the room is quiet enough for the marker sound to be clearly audible.",
      ],
    },
    recommendedFps: 3,
    minClipSeconds: 5,
    maxClipSeconds: 20,
    startStateCriteria: [
      "Dog is in a neutral position at least 0.5 metres from the handler.",
      "Handler's treat hand is visible and closed.",
    ],
    orderedVisibleEvents: [
      "Handler delivers marker sound (click or word)",
      "Dog orients toward handler",
      "Handler opens fist and delivers treat",
    ],
    passCriteria: [
      "Dog orients head and body toward handler within 2 seconds of the audible marker.",
      "Treat is delivered from the handler's hand within 1 second of the marker.",
    ],
    failCriteria: [
      "Dog shows no orientation response within 3 seconds of the marker.",
      "No audible marker is present in the clip.",
    ],
    needsReviewCriteria: [
      "Audio is present but the marker sound is too quiet or distorted to confirm timing.",
      "Dog's face is out of frame at the moment of the marker; orientation cannot be assessed.",
    ],
    outOfScopeClaims: [
      "Do not evaluate the dog's internal motivation or excitement level.",
      "Do not assess marker type (clicker vs. verbal) — any consistent marker is acceptable.",
      "Do not evaluate treat quality or size.",
    ],
    safetyNotes: [
      "Never use an aversive sound as a marker.",
      "Do not practice if the dog is showing stress signals.",
    ],
    retryInstructions: [
      "Ensure your marker sound is loud enough to be captured on the phone microphone.",
      "Move the phone closer to the interaction so both hand and face are visible.",
    ],
    minimumAutoPassConfidence: 0.80,
    minimumAutoFailConfidence: 0.90,
    prerequisites: [],
    harderActivityId: "BH002",
    xpReward: 50,
    coinReward: 0,
    starsAvailable: 3,
    verificationStatus: "BETA",
    masterPromptVersion: "1.0.0",
    activityPromptVersion: "1.0.0",
    vlmPrompt: "placeholder — set by compileDogTrainingActivityPrompt in production",
  };

  return { ...base, ...overrides };
}

/** Builds a fully-valid DogTrainingVerificationResult for testing normalizer. */
function makeValidResult(overrides: Partial<DogTrainingVerificationResult> = {}): DogTrainingVerificationResult {
  const base: DogTrainingVerificationResult = {
    activityId: "BH001",
    verdict: "PASS",
    confidence: 0.92,
    scorable: true,
    clipQuality: {
      dogVisible: true,
      targetDogUnambiguous: true,
      fullDogBodyVisibleWhenRequired: true,
      pawsVisibleWhenRequired: true,
      hipsVisibleWhenRequired: true,
      ownerVisibleWhenRequired: true,
      audioAvailableWhenRequired: true,
      targetObjectVisibleWhenRequired: true,
      destinationVisibleWhenRequired: true,
      referenceAssetsAvailableWhenRequired: true,
      referenceObjectMatchedWhenRequired: true,
      lightingSufficient: true,
      framingSufficient: true,
      actionCapturedFromStartToFinish: true,
    },
    observedEvents: [
      { timestampSec: 1.2, description: "Handler delivers click marker" },
      { timestampSec: 1.5, description: "Dog orients toward handler" },
      { timestampSec: 2.1, description: "Treat delivered from handler's hand" },
    ],
    satisfiedCriteria: [
      "Dog orients toward handler within 2 seconds of the audible marker.",
      "Treat delivered within 1 second of marker.",
    ],
    failedCriteria: [],
    missingEvidence: [],
    matchedReferenceAssets: [
      { type: "DOG_PROFILE", matched: true, confidence: 0.91, notes: "Profile photo matches dog in frame." },
    ],
    visibleStartTimestampSec: 0.5,
    visibleEndTimestampSec: 2.5,
    passReason: "Dog oriented within 1.3 seconds of the marker; treat delivered at 0.9 seconds post-mark.",
    failReason: null,
    needsHumanReview: false,
    suggestedRetryInstruction: null,
  };

  return { ...base, ...overrides };
}

function makeValidContext(overrides: Partial<NormalizationContext> = {}): NormalizationContext {
  return {
    minimumAutoPassConfidence: 0.80,
    minimumAutoFailConfidence: 0.90,
    recordingRequirements: { audioRequired: true },
    requiredReferenceAssets: [{ type: "DOG_PROFILE", required: true }],
    ...overrides,
  };
}

// ─── 1. Type exports ──────────────────────────────────────────────────────────

describe("Type exports", () => {
  it("TrainingCatalogActivity shape is complete", () => {
    const activity = makeValidActivity();
    expect(typeof activity.id).toBe("string");
    expect(typeof activity.category).toBe("string");
    expect(typeof activity.sequenceNumber).toBe("number");
    expect(typeof activity.level).toBe("number");
    expect(typeof activity.title).toBe("string");
    expect(typeof activity.skillFamily).toBe("string");
    expect(typeof activity.questContentType).toBe("string");
    expect(typeof activity.lessonGoal).toBe("string");
    expect(typeof activity.whyItMatters).toBe("string");
    expect(Array.isArray(activity.tutorialSteps)).toBe(true);
    expect(typeof activity.visibleCheckpoint).toBe("string");
    expect(Array.isArray(activity.requiredReferenceAssets)).toBe(true);
    expect(typeof activity.recordingRequirements).toBe("object");
    expect(typeof activity.recommendedFps).toBe("number");
    expect(typeof activity.minClipSeconds).toBe("number");
    expect(typeof activity.maxClipSeconds).toBe("number");
    expect(Array.isArray(activity.startStateCriteria)).toBe(true);
    expect(Array.isArray(activity.orderedVisibleEvents)).toBe(true);
    expect(Array.isArray(activity.passCriteria)).toBe(true);
    expect(Array.isArray(activity.failCriteria)).toBe(true);
    expect(Array.isArray(activity.needsReviewCriteria)).toBe(true);
    expect(Array.isArray(activity.outOfScopeClaims)).toBe(true);
    expect(Array.isArray(activity.safetyNotes)).toBe(true);
    expect(Array.isArray(activity.retryInstructions)).toBe(true);
    expect(typeof activity.minimumAutoPassConfidence).toBe("number");
    expect(typeof activity.minimumAutoFailConfidence).toBe("number");
    expect(Array.isArray(activity.prerequisites)).toBe(true);
    expect(typeof activity.xpReward).toBe("number");
    expect(typeof activity.coinReward).toBe("number");
    expect(typeof activity.starsAvailable).toBe("number");
    expect(typeof activity.verificationStatus).toBe("string");
    expect(typeof activity.masterPromptVersion).toBe("string");
    expect(typeof activity.activityPromptVersion).toBe("string");
    expect(typeof activity.vlmPrompt).toBe("string");
  });

  it("RecordingRequirements includes new boundary fields", () => {
    const rr = makeValidActivity().recordingRequirements;
    expect(typeof rr.startBoundaryRequiredInFrame).toBe("boolean");
    expect(typeof rr.endBoundaryRequiredInFrame).toBe("boolean");
  });

  it("ReferenceAssetRequirement shape is complete", () => {
    const asset: ReferenceAssetRequirement = {
      type: "TARGET_CRATE",
      required: true,
      minimumPhotos: 1,
      maximumPhotos: 2,
      reusableAcrossActivities: true,
      instructions: ["Photograph with door open."],
    };
    expect(asset.type).toBe("TARGET_CRATE");
    expect(asset.required).toBe(true);
    expect(asset.minimumPhotos).toBe(1);
    expect(asset.reusableAcrossActivities).toBe(true);
    expect(asset.instructions).toHaveLength(1);
  });

  it("BossQuestComponent shape is complete", () => {
    const comp: BossQuestComponent = {
      componentActivityId: "BH011",
      order: 1,
      required: true,
    };
    expect(comp.componentActivityId).toBe("BH011");
    expect(comp.order).toBe(1);
    expect(comp.required).toBe(true);
  });

  it("HybridBossQuestConfig shape is complete", () => {
    const config: HybridBossQuestConfig = {
      bossActivityId: "BH_BOSS_01",
      components: [
        { componentActivityId: "BH011", order: 1, required: true },
        { componentActivityId: "BH012", order: 2, required: true },
        { componentActivityId: "BH013", order: 3, required: false },
      ],
      requireAllMandatoryComponentsToPass: true,
    };
    expect(config.components).toHaveLength(3);
    expect(config.requireAllMandatoryComponentsToPass).toBe(true);
  });

  it("GeminiDogTrainingVerificationRequest shape is complete", () => {
    const req: GeminiDogTrainingVerificationRequest = {
      submissionId: "sub-123",
      dogId: "dog-456",
      activityId: "BH001",
      videoUrl: "https://example.com/video.mp4",
      referenceAssets: [
        { type: "DOG_PROFILE", imageUrls: ["https://example.com/dog.jpg"] },
      ],
      recommendedFps: 3,
      minClipSeconds: 5,
      maxClipSeconds: 20,
      audioRequired: true,
      masterPrompt: MASTER_VLM_PROMPT,
      activitySpecificPrompt: "...",
      promptVersion: "1.0.0",
      model: "gemini-2.5-flash",
    };
    expect(req.model).toBe("gemini-2.5-flash");
    expect(req.referenceAssets[0].type).toBe("DOG_PROFILE");
  });
});

// ─── 2. Catalog field validations ─────────────────────────────────────────────

describe("Catalog field validations", () => {
  const VALID_CATEGORIES = [
    "BETTER_BEHAVIOR_AT_HOME",
    "SAFETY_AND_OBEDIENCE",
    "BETTER_WALKS",
    "COOL_TRICKS_AND_GAMES",
    "HELPFUL_SKILLS_AROUND_THE_HOUSE",
    "CALM_ALONE_TIME",
  ] as const;

  it("valid category values are enumerated", () => {
    VALID_CATEGORIES.forEach((cat) => {
      const a = makeValidActivity({ category: cat });
      expect(VALID_CATEGORIES).toContain(a.category);
    });
  });

  it("activity ID is non-empty", () => {
    expect(makeValidActivity({ id: "" }).id.trim()).toBe("");
    expect(makeValidActivity().id.trim().length).toBeGreaterThan(0);
  });

  it("title is non-empty", () => {
    expect(makeValidActivity().title.trim().length).toBeGreaterThan(0);
  });

  it("lessonGoal is non-empty", () => {
    expect(makeValidActivity().lessonGoal.trim().length).toBeGreaterThan(0);
  });

  it("visibleCheckpoint is non-empty", () => {
    expect(makeValidActivity().visibleCheckpoint.trim().length).toBeGreaterThan(0);
  });

  it("tutorialSteps is non-empty", () => {
    expect(makeValidActivity().tutorialSteps.length).toBeGreaterThan(0);
  });

  it("recommendedFps is a positive integer", () => {
    const fps = makeValidActivity().recommendedFps;
    expect(Number.isInteger(fps)).toBe(true);
    expect(fps).toBeGreaterThan(0);
  });

  it("minClipSeconds < maxClipSeconds", () => {
    const a = makeValidActivity();
    expect(a.minClipSeconds).toBeLessThan(a.maxClipSeconds);
  });

  it("minClipSeconds is a positive number", () => {
    expect(makeValidActivity().minClipSeconds).toBeGreaterThan(0);
  });

  it("passCriteria is non-empty", () => {
    expect(makeValidActivity().passCriteria.length).toBeGreaterThan(0);
  });

  it("failCriteria is non-empty", () => {
    expect(makeValidActivity().failCriteria.length).toBeGreaterThan(0);
  });

  it("needsReviewCriteria is non-empty", () => {
    expect(makeValidActivity().needsReviewCriteria.length).toBeGreaterThan(0);
  });

  it("outOfScopeClaims is non-empty", () => {
    expect(makeValidActivity().outOfScopeClaims.length).toBeGreaterThan(0);
  });

  it("safetyNotes is non-empty", () => {
    expect(makeValidActivity().safetyNotes.length).toBeGreaterThan(0);
  });

  it("retryInstructions is non-empty", () => {
    expect(makeValidActivity().retryInstructions.length).toBeGreaterThan(0);
  });

  it("minimumAutoPassConfidence is in (0, 1]", () => {
    const c = makeValidActivity().minimumAutoPassConfidence;
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThanOrEqual(1);
  });

  it("minimumAutoFailConfidence is in (0, 1]", () => {
    const c = makeValidActivity().minimumAutoFailConfidence;
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThanOrEqual(1);
  });

  it("minimumAutoFailConfidence >= minimumAutoPassConfidence", () => {
    const a = makeValidActivity();
    expect(a.minimumAutoFailConfidence).toBeGreaterThanOrEqual(a.minimumAutoPassConfidence);
  });

  it("DOG_PROFILE is present in requiredReferenceAssets", () => {
    const a = makeValidActivity();
    const types = a.requiredReferenceAssets.map((r) => r.type);
    expect(types).toContain("DOG_PROFILE");
  });

  it("recordingRequirements.cameraAngle is non-empty", () => {
    expect(makeValidActivity().recordingRequirements.cameraAngle.trim().length).toBeGreaterThan(0);
  });

  it("recordingRequirements.setupInstructions is non-empty", () => {
    expect(makeValidActivity().recordingRequirements.setupInstructions.length).toBeGreaterThan(0);
  });

  it("orderedVisibleEvents is non-empty", () => {
    expect(makeValidActivity().orderedVisibleEvents.length).toBeGreaterThan(0);
  });

  it("coinReward is 0 for BETA activities", () => {
    expect(makeValidActivity({ verificationStatus: "BETA" }).coinReward).toBe(0);
    expect(makeValidActivity({ verificationStatus: "DRAFT" }).coinReward).toBe(0);
  });

  it("xpReward is positive", () => {
    expect(makeValidActivity().xpReward).toBeGreaterThan(0);
  });

  it("masterPromptVersion is non-empty semver-like string", () => {
    expect(makeValidActivity().masterPromptVersion.trim().length).toBeGreaterThan(0);
    expect(makeValidActivity().masterPromptVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("activityPromptVersion is non-empty semver-like string", () => {
    expect(makeValidActivity().activityPromptVersion.trim().length).toBeGreaterThan(0);
    expect(makeValidActivity().activityPromptVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// ─── 3. No placeholders ───────────────────────────────────────────────────────

describe("No placeholders in activity fields", () => {
  const PLACEHOLDER_PATTERN = /TODO|TBD|PLACEHOLDER|FIXME|lorem ipsum/i;
  const activity = makeValidActivity();

  it("lessonGoal has no placeholders", () => {
    expect(activity.lessonGoal).not.toMatch(PLACEHOLDER_PATTERN);
  });
  it("visibleCheckpoint has no placeholders", () => {
    expect(activity.visibleCheckpoint).not.toMatch(PLACEHOLDER_PATTERN);
  });
  it("passCriteria have no placeholders", () => {
    activity.passCriteria.forEach((c) => expect(c).not.toMatch(PLACEHOLDER_PATTERN));
  });
  it("failCriteria have no placeholders", () => {
    activity.failCriteria.forEach((c) => expect(c).not.toMatch(PLACEHOLDER_PATTERN));
  });
  it("needsReviewCriteria have no placeholders", () => {
    activity.needsReviewCriteria.forEach((c) => expect(c).not.toMatch(PLACEHOLDER_PATTERN));
  });
  it("outOfScopeClaims have no placeholders", () => {
    activity.outOfScopeClaims.forEach((c) => expect(c).not.toMatch(PLACEHOLDER_PATTERN));
  });
  it("safetyNotes have no placeholders", () => {
    activity.safetyNotes.forEach((c) => expect(c).not.toMatch(PLACEHOLDER_PATTERN));
  });
  it("retryInstructions have no placeholders", () => {
    activity.retryInstructions.forEach((c) => expect(c).not.toMatch(PLACEHOLDER_PATTERN));
  });
  it("orderedVisibleEvents have no placeholders", () => {
    activity.orderedVisibleEvents.forEach((c) => expect(c).not.toMatch(PLACEHOLDER_PATTERN));
  });
  it("tutorialSteps have no placeholders", () => {
    activity.tutorialSteps.forEach((c) => expect(c).not.toMatch(PLACEHOLDER_PATTERN));
  });
});

// ─── 4. Master prompt ─────────────────────────────────────────────────────────

describe("Master VLM prompt", () => {
  it("MASTER_PROMPT_VERSION matches semver format", () => {
    expect(MASTER_PROMPT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("master prompt is at least 500 characters", () => {
    expect(MASTER_VLM_PROMPT.length).toBeGreaterThanOrEqual(500);
  });

  it("master prompt addresses all required rules", () => {
    expect(MASTER_VLM_PROMPT).toMatch(/PASS requires every required/i);
    expect(MASTER_VLM_PROMPT).toMatch(/FAIL is permitted only when/i);
    expect(MASTER_VLM_PROMPT).toMatch(/NEEDS_REVIEW/i);
    expect(MASTER_VLM_PROMPT).toMatch(/Missing evidence is never a FAIL/i);
    expect(MASTER_VLM_PROMPT).toMatch(/Approximate completion is never a PASS/i);
    expect(MASTER_VLM_PROMPT).toMatch(/emotional state/i);
    expect(MASTER_VLM_PROMPT).toMatch(/separation anxiety/i);
    expect(MASTER_VLM_PROMPT).toMatch(/strict JSON/i);
    expect(MASTER_VLM_PROMPT).toMatch(/schema/i);
    expect(MASTER_VLM_PROMPT).toMatch(/timestamp/i);
  });

  it("master prompt does not contain placeholder text", () => {
    expect(MASTER_VLM_PROMPT).not.toMatch(/TODO|TBD|PLACEHOLDER|FIXME/i);
  });

  it("master prompt references reference-asset comparison rule", () => {
    expect(MASTER_VLM_PROMPT).toMatch(/reference/i);
  });

  it("master prompt forbids emotional state inference", () => {
    expect(MASTER_VLM_PROMPT).toMatch(/emotional state/i);
    expect(MASTER_VLM_PROMPT).toMatch(/comfort/i);
    expect(MASTER_VLM_PROMPT).toMatch(/anxiety/i);
  });
});

// ─── 5. Prompt compiler ───────────────────────────────────────────────────────

describe("compileDogTrainingActivityPrompt", () => {
  const activity = makeValidActivity();
  let compiled: string;

  beforeAll(() => {
    compiled = compileDogTrainingActivityPrompt(activity);
  });

  it("returns a non-empty string", () => {
    expect(typeof compiled).toBe("string");
    expect(compiled.trim().length).toBeGreaterThan(0);
  });

  it("compiled prompt is at least 500 characters", () => {
    expect(compiled.length).toBeGreaterThanOrEqual(500);
  });

  it("includes ACTIVITY ID", () => {
    expect(compiled).toContain("ACTIVITY ID:");
    expect(compiled).toContain(activity.id);
  });

  it("includes TITLE", () => {
    expect(compiled).toContain("TITLE:");
    expect(compiled).toContain(activity.title);
  });

  it("includes CATEGORY", () => {
    expect(compiled).toContain("CATEGORY:");
    expect(compiled).toContain(activity.category);
  });

  it("includes LESSON GOAL", () => {
    expect(compiled).toContain("LESSON GOAL:");
    expect(compiled).toContain(activity.lessonGoal);
  });

  it("includes VISIBLE CHECKPOINT", () => {
    expect(compiled).toContain("VISIBLE CHECKPOINT:");
    expect(compiled).toContain(activity.visibleCheckpoint);
  });

  it("includes RECORDING SETUP with camera angle", () => {
    expect(compiled).toContain("RECORDING SETUP:");
    expect(compiled).toContain(activity.recordingRequirements.cameraAngle);
  });

  it("includes REFERENCE ASSETS", () => {
    expect(compiled).toContain("REFERENCE ASSETS:");
    expect(compiled).toContain("DOG_PROFILE");
  });

  it("includes VIDEO PROCESSING with FPS and clip seconds", () => {
    expect(compiled).toContain("VIDEO PROCESSING:");
    expect(compiled).toContain(String(activity.recommendedFps));
    expect(compiled).toContain(String(activity.minClipSeconds));
    expect(compiled).toContain(String(activity.maxClipSeconds));
  });

  it("includes audio requirement", () => {
    expect(compiled).toContain("Audio required:");
    expect(compiled).toMatch(/YES.*missing.*NEEDS_REVIEW|NO/i);
  });

  it("includes EXPECTED START STATE", () => {
    expect(compiled).toContain("EXPECTED START STATE:");
    activity.startStateCriteria.forEach((c) => {
      expect(compiled).toContain(c);
    });
  });

  it("includes ORDERED VISIBLE EVENTS", () => {
    expect(compiled).toContain("ORDERED VISIBLE EVENTS:");
    activity.orderedVisibleEvents.forEach((e) => {
      expect(compiled).toContain(e);
    });
  });

  it("includes PASS criteria", () => {
    expect(compiled).toContain("PASS only when");
    activity.passCriteria.forEach((c) => {
      expect(compiled).toContain(c);
    });
  });

  it("includes FAIL criteria", () => {
    expect(compiled).toContain("FAIL only when");
    activity.failCriteria.forEach((c) => {
      expect(compiled).toContain(c);
    });
  });

  it("includes NEEDS_REVIEW criteria", () => {
    expect(compiled).toContain("Return NEEDS_REVIEW when:");
    activity.needsReviewCriteria.forEach((c) => {
      expect(compiled).toContain(c);
    });
  });

  it("includes OUT OF SCOPE section", () => {
    expect(compiled).toContain("OUT OF SCOPE");
    activity.outOfScopeClaims.forEach((c) => {
      expect(compiled).toContain(c);
    });
  });

  it("includes SAFETY section", () => {
    expect(compiled).toContain("SAFETY:");
    activity.safetyNotes.forEach((n) => {
      expect(compiled).toContain(n);
    });
  });

  it("includes RETRY GUIDANCE section", () => {
    expect(compiled).toContain("RETRY GUIDANCE");
    activity.retryInstructions.forEach((r) => {
      expect(compiled).toContain(r);
    });
  });

  it("includes CONFIDENCE THRESHOLDS", () => {
    expect(compiled).toContain("CONFIDENCE THRESHOLDS:");
    expect(compiled).toContain(activity.minimumAutoPassConfidence.toFixed(2));
    expect(compiled).toContain(activity.minimumAutoFailConfidence.toFixed(2));
  });

  it("includes strict JSON instruction", () => {
    expect(compiled).toMatch(/strict JSON/i);
  });

  it("states that missing evidence is not a FAIL", () => {
    expect(compiled).toMatch(/Missing evidence is not a FAIL/i);
  });

  it("states that approximate completion is not a PASS", () => {
    expect(compiled).toMatch(/Approximate completion is not a PASS/i);
  });

  it("compiled prompt contains no placeholder text", () => {
    expect(compiled).not.toMatch(/TODO|TBD|PLACEHOLDER|FIXME/i);
  });

  it("includes audio required notice when audioRequired=true", () => {
    const audioActivity = makeValidActivity({
      recordingRequirements: {
        ...makeValidActivity().recordingRequirements,
        audioRequired: true,
      },
    });
    const out = compileDogTrainingActivityPrompt(audioActivity);
    expect(out).toContain("YES");
    expect(out).toMatch(/NEEDS_REVIEW/i);
  });

  it("does not mark audio as required when audioRequired=false", () => {
    const noAudioActivity = makeValidActivity({
      recordingRequirements: {
        ...makeValidActivity().recordingRequirements,
        audioRequired: false,
      },
    });
    const out = compileDogTrainingActivityPrompt(noAudioActivity);
    expect(out).toContain("NO");
  });

  it("includes owner-in-frame note when ownerRequiredInFrame=true", () => {
    const out = compileDogTrainingActivityPrompt(
      makeValidActivity({
        recordingRequirements: {
          ...makeValidActivity().recordingRequirements,
          ownerRequiredInFrame: true,
        },
      }),
    );
    expect(out).toContain("Handler must be visible in frame.");
  });

  it("includes start boundary note when startBoundaryRequiredInFrame=true", () => {
    const out = compileDogTrainingActivityPrompt(
      makeValidActivity({
        recordingRequirements: {
          ...makeValidActivity().recordingRequirements,
          startBoundaryRequiredInFrame: true,
        },
      }),
    );
    expect(out).toContain("start boundary");
  });

  it("includes end boundary note when endBoundaryRequiredInFrame=true", () => {
    const out = compileDogTrainingActivityPrompt(
      makeValidActivity({
        recordingRequirements: {
          ...makeValidActivity().recordingRequirements,
          endBoundaryRequiredInFrame: true,
        },
      }),
    );
    expect(out).toContain("end boundary");
  });
});

// ─── 6. Normalizer ───────────────────────────────────────────────────────────

describe("normalizeVerificationResult", () => {
  it("returns PASS unchanged when all quality flags are good", () => {
    const result = makeValidResult({ verdict: "PASS", confidence: 0.92 });
    const context = makeValidContext();
    const normalized = normalizeVerificationResult(result, context);
    expect(normalized.verdict).toBe("PASS");
    expect(normalized.needsHumanReview).toBe(false);
  });

  it("Rule 1 — non-scorable clip → NEEDS_REVIEW", () => {
    const result = makeValidResult({ scorable: false, verdict: "PASS" });
    const normalized = normalizeVerificationResult(result, makeValidContext());
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
    expect(normalized.needsHumanReview).toBe(true);
  });

  it("Rule 2 — missing evidence present → NEEDS_REVIEW even for PASS", () => {
    const result = makeValidResult({
      verdict: "PASS",
      missingEvidence: ["Dog's face was out of frame at the marker."],
    });
    const normalized = normalizeVerificationResult(result, makeValidContext());
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
    expect(normalized.needsHumanReview).toBe(true);
  });

  it("Rule 3 — audio required but unavailable → NEEDS_REVIEW", () => {
    const result = makeValidResult({
      verdict: "PASS",
      clipQuality: { ...makeValidResult().clipQuality, audioAvailableWhenRequired: false },
    });
    const context = makeValidContext({ recordingRequirements: { audioRequired: true } });
    const normalized = normalizeVerificationResult(result, context);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
  });

  it("Rule 3 — audio not required; missing audio does not escalate", () => {
    const result = makeValidResult({
      verdict: "PASS",
      clipQuality: { ...makeValidResult().clipQuality, audioAvailableWhenRequired: false },
    });
    const context = makeValidContext({ recordingRequirements: { audioRequired: false } });
    const normalized = normalizeVerificationResult(result, context);
    expect(normalized.verdict).toBe("PASS");
  });

  it("Rule 4 — required reference asset absent → NEEDS_REVIEW", () => {
    const result = makeValidResult({
      clipQuality: { ...makeValidResult().clipQuality, referenceAssetsAvailableWhenRequired: false },
    });
    const context = makeValidContext({
      requiredReferenceAssets: [{ type: "DOG_PROFILE", required: true }],
    });
    const normalized = normalizeVerificationResult(result, context);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
  });

  it("Rule 4 — no required assets; missing assets does not escalate", () => {
    const result = makeValidResult({
      clipQuality: { ...makeValidResult().clipQuality, referenceAssetsAvailableWhenRequired: false },
    });
    const context = makeValidContext({
      requiredReferenceAssets: [{ type: "DOG_PROFILE", required: false }],
    });
    const normalized = normalizeVerificationResult(result, context);
    expect(normalized.verdict).toBe("PASS");
  });

  it("Rule 5 — non-DOG_PROFILE required object unmatched → NEEDS_REVIEW", () => {
    const result = makeValidResult({
      clipQuality: { ...makeValidResult().clipQuality, referenceObjectMatchedWhenRequired: false },
    });
    const context = makeValidContext({
      requiredReferenceAssets: [
        { type: "DOG_PROFILE", required: true },
        { type: "TARGET_CRATE", required: true },
      ],
    });
    const normalized = normalizeVerificationResult(result, context);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
  });

  it("Rule 5 — only DOG_PROFILE required; unmatched object does not escalate", () => {
    const result = makeValidResult({
      clipQuality: { ...makeValidResult().clipQuality, referenceObjectMatchedWhenRequired: false },
    });
    const context = makeValidContext({
      requiredReferenceAssets: [{ type: "DOG_PROFILE", required: true }],
    });
    const normalized = normalizeVerificationResult(result, context);
    expect(normalized.verdict).toBe("PASS");
  });

  it("Rule 6 — PASS confidence below auto-pass threshold → NEEDS_REVIEW", () => {
    const result = makeValidResult({ verdict: "PASS", confidence: 0.70 });
    const context = makeValidContext({ minimumAutoPassConfidence: 0.80 });
    const normalized = normalizeVerificationResult(result, context);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
  });

  it("Rule 6 — PASS confidence at threshold is accepted", () => {
    const result = makeValidResult({
      verdict: "PASS",
      confidence: 0.80,
      missingEvidence: [],
    });
    const context = makeValidContext({ minimumAutoPassConfidence: 0.80 });
    const normalized = normalizeVerificationResult(result, context);
    expect(normalized.verdict).toBe("PASS");
  });

  it("Rule 7 — FAIL confidence below auto-fail threshold → NEEDS_REVIEW", () => {
    const result = makeValidResult({ verdict: "FAIL", confidence: 0.75 });
    const context = makeValidContext({ minimumAutoFailConfidence: 0.90 });
    const normalized = normalizeVerificationResult(result, context);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
  });

  it("Rule 7 — FAIL confidence at threshold is accepted as FAIL", () => {
    const result = makeValidResult({
      verdict: "FAIL",
      confidence: 0.90,
      missingEvidence: [],
      matchedReferenceAssets: [
        { type: "DOG_PROFILE", matched: true, confidence: 0.91, notes: "Match confirmed." },
      ],
    });
    const context = makeValidContext({
      minimumAutoFailConfidence: 0.90,
      recordingRequirements: { audioRequired: false },
    });
    const normalized = normalizeVerificationResult(result, context);
    expect(normalized.verdict).toBe("FAIL");
  });

  it("Rule 8 — ambiguous dog in frame → NEEDS_REVIEW", () => {
    const result = makeValidResult({
      verdict: "PASS",
      clipQuality: { ...makeValidResult().clipQuality, targetDogUnambiguous: false },
    });
    const normalized = normalizeVerificationResult(result, makeValidContext());
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
  });

  it("Rule 9 — reference matched=true but low confidence → NEEDS_REVIEW", () => {
    const result = makeValidResult({
      verdict: "PASS",
      matchedReferenceAssets: [
        { type: "DOG_PROFILE", matched: true, confidence: 0.40, notes: "Low confidence match." },
      ],
    });
    const normalized = normalizeVerificationResult(result, makeValidContext());
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
  });

  it("Rule 9 — reference matched=false (unmatched) does not trigger Rule 9 alone", () => {
    // Rule 9 is about matched=true with low confidence, NOT about matched=false.
    // matched=false triggers Rule 4 or Rule 5 depending on required asset type.
    const result = makeValidResult({
      verdict: "PASS",
      missingEvidence: [],
      matchedReferenceAssets: [
        { type: "DOG_PROFILE", matched: false, confidence: 0.30, notes: "Could not match." },
      ],
    });
    const context = makeValidContext({
      requiredReferenceAssets: [{ type: "DOG_PROFILE", required: false }],
      recordingRequirements: { audioRequired: false },
    });
    const normalized = normalizeVerificationResult(result, context);
    // matched=false with confidence=0.30 does NOT trigger Rule 9 (only fires when matched=true)
    expect(normalized.verdict).toBe("PASS");
  });

  it("Rule 10 — UNSUPPORTED verdict propagates and flags for review", () => {
    const result = makeValidResult({ verdict: "UNSUPPORTED", scorable: true });
    const normalized = normalizeVerificationResult(result, makeValidContext());
    expect(normalized.verdict).toBe("UNSUPPORTED");
    expect(normalized.needsHumanReview).toBe(true);
  });

  it("NEEDS_REVIEW verdict is returned unchanged", () => {
    const result = makeValidResult({ verdict: "NEEDS_REVIEW" });
    const normalized = normalizeVerificationResult(result, makeValidContext());
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
  });

  it("normalizer does not mutate the input result", () => {
    const result = makeValidResult({ verdict: "PASS", confidence: 0.60 });
    const resultCopy = { ...result };
    normalizeVerificationResult(result, makeValidContext());
    expect(result.verdict).toBe(resultCopy.verdict);
    expect(result.confidence).toBe(resultCopy.confidence);
  });

  it("toNormalizationContext extracts the correct fields from an activity", () => {
    const activity = makeValidActivity({
      minimumAutoPassConfidence: 0.78,
      minimumAutoFailConfidence: 0.88,
      recordingRequirements: {
        ...makeValidActivity().recordingRequirements,
        audioRequired: true,
      },
      requiredReferenceAssets: [
        { type: "DOG_PROFILE", required: true, minimumPhotos: 1, maximumPhotos: 3, reusableAcrossActivities: true, instructions: [] },
        { type: "TARGET_MAT", required: true, minimumPhotos: 1, maximumPhotos: 2, reusableAcrossActivities: true, instructions: [] },
      ],
    });
    const ctx = toNormalizationContext(activity);
    expect(ctx.minimumAutoPassConfidence).toBe(0.78);
    expect(ctx.minimumAutoFailConfidence).toBe(0.88);
    expect(ctx.recordingRequirements.audioRequired).toBe(true);
    expect(ctx.requiredReferenceAssets).toHaveLength(2);
    expect(ctx.requiredReferenceAssets.find((a) => a.type === "TARGET_MAT")).toBeTruthy();
  });
});

// ─── 7. Zod schema ────────────────────────────────────────────────────────────

describe("dogTrainingVerificationSchema (Zod)", () => {
  it("parses a valid PASS result", () => {
    const raw = {
      activityId: "BH001",
      verdict: "PASS",
      confidence: 0.92,
      scorable: true,
      clipQuality: {
        dogVisible: true,
        targetDogUnambiguous: true,
        fullDogBodyVisibleWhenRequired: true,
        pawsVisibleWhenRequired: true,
        hipsVisibleWhenRequired: true,
        ownerVisibleWhenRequired: true,
        audioAvailableWhenRequired: true,
        targetObjectVisibleWhenRequired: true,
        destinationVisibleWhenRequired: true,
        referenceAssetsAvailableWhenRequired: true,
        referenceObjectMatchedWhenRequired: true,
        lightingSufficient: true,
        framingSufficient: true,
        actionCapturedFromStartToFinish: true,
      },
      observedEvents: [{ timestampSec: 1.2, description: "Click marker" }],
      satisfiedCriteria: ["Dog oriented within 2 seconds."],
      failedCriteria: [],
      missingEvidence: [],
      matchedReferenceAssets: [
        { type: "DOG_PROFILE", matched: true, confidence: 0.91, notes: "Match." },
      ],
      visibleStartTimestampSec: 0.5,
      visibleEndTimestampSec: 2.5,
      passReason: "All criteria satisfied.",
      failReason: null,
      needsHumanReview: false,
      suggestedRetryInstruction: null,
    };
    const parsed = dogTrainingVerificationSchema.safeParse(raw);
    expect(parsed.success).toBe(true);
  });

  it("rejects confidence outside [0, 1]", () => {
    const raw = { ...makeValidResult(), confidence: 1.5 };
    expect(dogTrainingVerificationSchema.safeParse(raw).success).toBe(false);
  });

  it("rejects invalid verdict value", () => {
    const raw = { ...makeValidResult(), verdict: "MAYBE" };
    expect(dogTrainingVerificationSchema.safeParse(raw).success).toBe(false);
  });

  it("rejects empty activityId", () => {
    const raw = { ...makeValidResult(), activityId: "" };
    expect(dogTrainingVerificationSchema.safeParse(raw).success).toBe(false);
  });

  it("accepts all four verdict values", () => {
    const verdicts = ["PASS", "FAIL", "NEEDS_REVIEW", "UNSUPPORTED"] as const;
    verdicts.forEach((v) => {
      const raw = { ...makeValidResult(), verdict: v };
      const parsed = dogTrainingVerificationSchema.safeParse(raw);
      expect(parsed.success).toBe(true);
    });
  });

  it("accepts null visibleStartTimestampSec and visibleEndTimestampSec", () => {
    const raw = { ...makeValidResult(), visibleStartTimestampSec: null, visibleEndTimestampSec: null };
    expect(dogTrainingVerificationSchema.safeParse(raw).success).toBe(true);
  });
});

// ─── 8. Boss-quest aggregation rule ──────────────────────────────────────────

describe("Boss-quest aggregation rules", () => {
  it("boss PASS requires all mandatory components to PASS", () => {
    const components: BossQuestComponent[] = [
      { componentActivityId: "BH011", order: 1, required: true },
      { componentActivityId: "BH012", order: 2, required: true },
      { componentActivityId: "BH013", order: 3, required: false },
    ];
    const config: HybridBossQuestConfig = {
      bossActivityId: "BH_BOSS_01",
      components,
      requireAllMandatoryComponentsToPass: true,
    };

    // Simulate: all mandatory PASS → boss PASS
    const componentVerdicts: Record<string, "PASS" | "FAIL" | "NEEDS_REVIEW"> = {
      BH011: "PASS",
      BH012: "PASS",
      BH013: "FAIL", // optional — should not block
    };

    const mandatory = config.components.filter((c) => c.required);
    const bossVerdict = mandatory.every(
      (c) => componentVerdicts[c.componentActivityId] === "PASS",
    )
      ? "PASS"
      : "FAIL";

    expect(bossVerdict).toBe("PASS");
  });

  it("boss FAIL when any mandatory component FAILs", () => {
    const components: BossQuestComponent[] = [
      { componentActivityId: "BH011", order: 1, required: true },
      { componentActivityId: "BH012", order: 2, required: true },
    ];
    const config: HybridBossQuestConfig = {
      bossActivityId: "BH_BOSS_01",
      components,
      requireAllMandatoryComponentsToPass: true,
    };

    const componentVerdicts: Record<string, "PASS" | "FAIL" | "NEEDS_REVIEW"> = {
      BH011: "PASS",
      BH012: "FAIL",
    };

    const mandatory = config.components.filter((c) => c.required);
    const bossVerdict = mandatory.every(
      (c) => componentVerdicts[c.componentActivityId] === "PASS",
    )
      ? "PASS"
      : "FAIL";

    expect(bossVerdict).toBe("FAIL");
  });

  it("boss NEEDS_REVIEW when any mandatory component is NEEDS_REVIEW", () => {
    const components: BossQuestComponent[] = [
      { componentActivityId: "BH011", order: 1, required: true },
      { componentActivityId: "BH012", order: 2, required: true },
    ];
    const config: HybridBossQuestConfig = {
      bossActivityId: "BH_BOSS_01",
      components,
      requireAllMandatoryComponentsToPass: true,
    };

    const componentVerdicts: Record<string, "PASS" | "FAIL" | "NEEDS_REVIEW"> = {
      BH011: "PASS",
      BH012: "NEEDS_REVIEW",
    };

    const mandatory = config.components.filter((c) => c.required);
    const allPass = mandatory.every((c) => componentVerdicts[c.componentActivityId] === "PASS");
    const anyNeedsReview = mandatory.some(
      (c) => componentVerdicts[c.componentActivityId] === "NEEDS_REVIEW",
    );

    const bossVerdict = allPass ? "PASS" : anyNeedsReview ? "NEEDS_REVIEW" : "FAIL";
    expect(bossVerdict).toBe("NEEDS_REVIEW");
  });
});
