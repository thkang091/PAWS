/**
 * VLM Verification — Schema and Normalizer Tests
 *
 * Covers:
 *   Schema validation
 *     - valid result passes
 *     - PASS / FAIL / NEEDS_REVIEW / UNSUPPORTED verdicts accepted
 *     - invalid verdict string rejected
 *     - confidence out of [0,1] range rejected
 *     - missing required top-level fields rejected
 *     - missing clipQuality sub-fields rejected
 *     - negative observedEvent timestamp rejected
 *     - matchedReferenceAsset confidence out of range rejected
 *
 *   Normalizer
 *     - clean high-confidence PASS passes through unchanged
 *     - non-scorable clip → NEEDS_REVIEW regardless of raw verdict
 *     - multiple / ambiguous dogs → NEEDS_REVIEW
 *     - low-confidence PASS (below auto-pass threshold) → NEEDS_REVIEW
 *     - high-confidence PASS (above threshold) is not escalated
 *     - low-confidence FAIL (below auto-fail threshold) → NEEDS_REVIEW
 *     - high-confidence FAIL (above threshold) is not escalated
 *     - audio required + unavailable → NEEDS_REVIEW
 *     - audio required + available → not escalated
 *     - missing required reference asset → NEEDS_REVIEW
 *     - ambiguous reference-object match (confidence < 0.5) → NEEDS_REVIEW
 *     - confident reference-object match → not escalated
 *     - UNSUPPORTED is preserved with needsHumanReview = true
 *     - multiple triggers fire; result is still NEEDS_REVIEW (not stacked)
 */

import { dogTrainingVerificationSchema } from "@/validation/verificationSchema";
import { normalizeVerificationResult } from "@/services/verificationNormalizer";
import type {
  DogTrainingVerificationResult,
  ClipQuality,
} from "@/types/domain";

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Clip quality flags where everything is present and visible. */
const PERFECT_CLIP_QUALITY: ClipQuality = {
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
};

/** A fully valid, high-confidence PASS result. */
const VALID_PASS: DogTrainingVerificationResult = {
  activityId: "BH001",
  verdict: "PASS",
  confidence: 0.94,
  scorable: true,
  clipQuality: { ...PERFECT_CLIP_QUALITY },
  observedEvents: [{ timestampSec: 1.2, description: "Dog sits on verbal cue" }],
  satisfiedCriteria: ["dog_sat_on_cue", "held_for_2s"],
  failedCriteria: [],
  missingEvidence: [],
  matchedReferenceAssets: [],
  visibleStartTimestampSec: 0.8,
  visibleEndTimestampSec: 3.5,
  passReason: "Dog clearly sat on cue and held the position.",
  failReason: null,
  needsHumanReview: false,
  suggestedRetryInstruction: null,
};

/** Default normalization context (thresholds from spec). */
const DEFAULT_CTX = {
  minimumAutoPassConfidence: 0.75,
  minimumAutoFailConfidence: 0.90,
  recordingRequirements: { audioRequired: false },
  requiredReferenceAssets: [] as { type: string; required: boolean }[],
};

// ─────────────────────────────────────────────────────────────────────────────
// Schema validation
// ─────────────────────────────────────────────────────────────────────────────

describe("dogTrainingVerificationSchema — schema validation", () => {
  it("accepts a fully valid PASS result", () => {
    const result = dogTrainingVerificationSchema.safeParse(VALID_PASS);
    expect(result.success).toBe(true);
  });

  it.each(["PASS", "FAIL", "NEEDS_REVIEW", "UNSUPPORTED"] as const)(
    "accepts verdict '%s'",
    (verdict) => {
      const result = dogTrainingVerificationSchema.safeParse({
        ...VALID_PASS,
        verdict,
      });
      expect(result.success).toBe(true);
    },
  );

  it("rejects an invalid verdict string", () => {
    const result = dogTrainingVerificationSchema.safeParse({
      ...VALID_PASS,
      verdict: "MAYBE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence below 0", () => {
    const result = dogTrainingVerificationSchema.safeParse({
      ...VALID_PASS,
      confidence: -0.1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence above 1", () => {
    const result = dogTrainingVerificationSchema.safeParse({
      ...VALID_PASS,
      confidence: 1.001,
    });
    expect(result.success).toBe(false);
  });

  it("accepts confidence at boundary values 0 and 1", () => {
    expect(
      dogTrainingVerificationSchema.safeParse({ ...VALID_PASS, confidence: 0 }).success,
    ).toBe(true);
    expect(
      dogTrainingVerificationSchema.safeParse({ ...VALID_PASS, confidence: 1 }).success,
    ).toBe(true);
  });

  it("rejects a result missing activityId", () => {
    const { activityId: _omit, ...rest } = VALID_PASS;
    const result = dogTrainingVerificationSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects a result with empty activityId", () => {
    const result = dogTrainingVerificationSchema.safeParse({
      ...VALID_PASS,
      activityId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a result missing clipQuality", () => {
    const { clipQuality: _omit, ...rest } = VALID_PASS;
    const result = dogTrainingVerificationSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects clipQuality with a missing sub-field", () => {
    const { dogVisible: _omit, ...partialQuality } = PERFECT_CLIP_QUALITY;
    const result = dogTrainingVerificationSchema.safeParse({
      ...VALID_PASS,
      clipQuality: partialQuality,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an observedEvent with a negative timestamp", () => {
    const result = dogTrainingVerificationSchema.safeParse({
      ...VALID_PASS,
      observedEvents: [{ timestampSec: -0.5, description: "bad event" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty observedEvents array", () => {
    const result = dogTrainingVerificationSchema.safeParse({
      ...VALID_PASS,
      observedEvents: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a matchedReferenceAsset with confidence > 1", () => {
    const result = dogTrainingVerificationSchema.safeParse({
      ...VALID_PASS,
      matchedReferenceAssets: [
        { type: "TARGET_MAT", matched: true, confidence: 1.5, notes: "" },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("accepts null for nullable timestamp fields", () => {
    const result = dogTrainingVerificationSchema.safeParse({
      ...VALID_PASS,
      visibleStartTimestampSec: null,
      visibleEndTimestampSec: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts null for nullable reason fields", () => {
    const result = dogTrainingVerificationSchema.safeParse({
      ...VALID_PASS,
      passReason: null,
      failReason: null,
      suggestedRetryInstruction: null,
    });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Normalizer
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeVerificationResult", () => {
  // ── Pass-through ──────────────────────────────────────────────────────────

  it("returns the original result unchanged when no triggers fire", () => {
    const normalized = normalizeVerificationResult(VALID_PASS, DEFAULT_CTX);
    expect(normalized).toBe(VALID_PASS); // reference equality — not mutated
  });

  it("preserves all non-verdict fields when escalating", () => {
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      verdict: "PASS",
      confidence: 0.50, // below auto-pass threshold
    };
    const normalized = normalizeVerificationResult(input, DEFAULT_CTX);
    expect(normalized.activityId).toBe(input.activityId);
    expect(normalized.confidence).toBe(input.confidence);
    expect(normalized.satisfiedCriteria).toEqual(input.satisfiedCriteria);
  });

  // ── Non-scorable ──────────────────────────────────────────────────────────

  it("escalates non-scorable PASS to NEEDS_REVIEW", () => {
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      scorable: false,
    };
    const normalized = normalizeVerificationResult(input, DEFAULT_CTX);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
    expect(normalized.needsHumanReview).toBe(true);
  });

  it("escalates non-scorable FAIL to NEEDS_REVIEW", () => {
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      verdict: "FAIL",
      confidence: 0.95,
      scorable: false,
    };
    const normalized = normalizeVerificationResult(input, DEFAULT_CTX);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
  });

  // ── Multiple / ambiguous dogs ─────────────────────────────────────────────

  it("escalates to NEEDS_REVIEW when target dog is ambiguous (multiple dogs)", () => {
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      clipQuality: {
        ...PERFECT_CLIP_QUALITY,
        targetDogUnambiguous: false,
      },
    };
    const normalized = normalizeVerificationResult(input, DEFAULT_CTX);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
    expect(normalized.needsHumanReview).toBe(true);
  });

  // ── Low-confidence PASS ───────────────────────────────────────────────────

  it("escalates low-confidence PASS (below auto-pass threshold) to NEEDS_REVIEW", () => {
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      verdict: "PASS",
      confidence: DEFAULT_CTX.minimumAutoPassConfidence - 0.01,
    };
    const normalized = normalizeVerificationResult(input, DEFAULT_CTX);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
  });

  it("does not escalate high-confidence PASS (at threshold)", () => {
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      verdict: "PASS",
      confidence: DEFAULT_CTX.minimumAutoPassConfidence,
    };
    const normalized = normalizeVerificationResult(input, DEFAULT_CTX);
    expect(normalized.verdict).toBe("PASS");
  });

  it("does not escalate high-confidence PASS (above threshold)", () => {
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      verdict: "PASS",
      confidence: DEFAULT_CTX.minimumAutoPassConfidence + 0.1,
    };
    const normalized = normalizeVerificationResult(input, DEFAULT_CTX);
    expect(normalized.verdict).toBe("PASS");
  });

  // ── Low-confidence FAIL ───────────────────────────────────────────────────

  it("escalates low-confidence FAIL (below auto-fail threshold) to NEEDS_REVIEW", () => {
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      verdict: "FAIL",
      confidence: DEFAULT_CTX.minimumAutoFailConfidence - 0.01,
      passReason: null,
      failReason: "Dog did not sit.",
    };
    const normalized = normalizeVerificationResult(input, DEFAULT_CTX);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
  });

  it("does not escalate high-confidence FAIL (at threshold)", () => {
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      verdict: "FAIL",
      confidence: DEFAULT_CTX.minimumAutoFailConfidence,
      passReason: null,
      failReason: "Dog jumped up instead of sitting.",
    };
    const normalized = normalizeVerificationResult(input, DEFAULT_CTX);
    expect(normalized.verdict).toBe("FAIL");
  });

  // ── Missing audio ─────────────────────────────────────────────────────────

  it("escalates to NEEDS_REVIEW when audio is required but unavailable", () => {
    const ctx = {
      ...DEFAULT_CTX,
      recordingRequirements: { audioRequired: true },
    };
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      clipQuality: {
        ...PERFECT_CLIP_QUALITY,
        audioAvailableWhenRequired: false,
      },
    };
    const normalized = normalizeVerificationResult(input, ctx);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
  });

  it("does not escalate when audio is required and IS available", () => {
    const ctx = {
      ...DEFAULT_CTX,
      recordingRequirements: { audioRequired: true },
    };
    const normalized = normalizeVerificationResult(VALID_PASS, ctx);
    expect(normalized.verdict).toBe("PASS");
  });

  it("does not escalate when audio is not required and unavailable", () => {
    const ctx = {
      ...DEFAULT_CTX,
      recordingRequirements: { audioRequired: false },
    };
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      clipQuality: {
        ...PERFECT_CLIP_QUALITY,
        audioAvailableWhenRequired: false,
      },
    };
    const normalized = normalizeVerificationResult(input, ctx);
    expect(normalized.verdict).toBe("PASS");
  });

  // ── Missing reference asset ───────────────────────────────────────────────

  it("escalates to NEEDS_REVIEW when required reference asset is absent", () => {
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      clipQuality: {
        ...PERFECT_CLIP_QUALITY,
        referenceAssetsAvailableWhenRequired: false,
      },
    };
    const ctx = {
      ...DEFAULT_CTX,
      requiredReferenceAssets: [{ type: "DOG_PROFILE", required: true }],
    };
    const normalized = normalizeVerificationResult(input, ctx);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
    expect(normalized.needsHumanReview).toBe(true);
  });

  // ── Ambiguous object matching ─────────────────────────────────────────────

  it("escalates to NEEDS_REVIEW when a matched reference asset has low confidence", () => {
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      matchedReferenceAssets: [
        { type: "TARGET_MAT", matched: true, confidence: 0.4, notes: "uncertain" },
      ],
    };
    const normalized = normalizeVerificationResult(input, DEFAULT_CTX);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
  });

  it("does not escalate when matched reference asset has sufficient confidence", () => {
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      matchedReferenceAssets: [
        { type: "TARGET_MAT", matched: true, confidence: 0.85, notes: "clear match" },
      ],
    };
    const normalized = normalizeVerificationResult(input, DEFAULT_CTX);
    expect(normalized.verdict).toBe("PASS");
  });

  it("does not escalate an unmatched asset (matched=false) even with low confidence", () => {
    // An unmatched asset with confidence=0.1 is just the model saying
    // "this is not a mat" with high certainty — not ambiguous matching.
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      matchedReferenceAssets: [
        { type: "TARGET_MAT", matched: false, confidence: 0.1, notes: "not a mat" },
      ],
    };
    const normalized = normalizeVerificationResult(input, DEFAULT_CTX);
    expect(normalized.verdict).toBe("PASS");
  });

  // ── UNSUPPORTED ───────────────────────────────────────────────────────────

  it("preserves UNSUPPORTED verdict and flags needsHumanReview", () => {
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      verdict: "UNSUPPORTED",
      scorable: false,
      passReason: null,
    };
    // Note: non-scorable fires first, but UNSUPPORTED should also propagate
    const normalized = normalizeVerificationResult(
      { ...input, scorable: true },
      DEFAULT_CTX,
    );
    expect(normalized.verdict).toBe("UNSUPPORTED");
    expect(normalized.needsHumanReview).toBe(true);
  });

  // ── Multiple triggers ─────────────────────────────────────────────────────

  it("handles multiple triggers simultaneously — result is still NEEDS_REVIEW", () => {
    const ctx = {
      ...DEFAULT_CTX,
      recordingRequirements: { audioRequired: true },
    };
    const input: DogTrainingVerificationResult = {
      ...VALID_PASS,
      verdict: "PASS",
      confidence: 0.50, // low-confidence PASS
      clipQuality: {
        ...PERFECT_CLIP_QUALITY,
        targetDogUnambiguous: false, // multiple dogs
        audioAvailableWhenRequired: false, // missing audio
      },
      matchedReferenceAssets: [
        { type: "TARGET_MAT", matched: true, confidence: 0.3, notes: "ambiguous" },
      ],
    };
    const normalized = normalizeVerificationResult(input, ctx);
    expect(normalized.verdict).toBe("NEEDS_REVIEW");
    expect(normalized.needsHumanReview).toBe(true);
  });
});
