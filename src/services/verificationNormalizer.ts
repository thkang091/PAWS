/**
 * src/services/verificationNormalizer.ts
 *
 * Post-VLM normalization rules for PAWS training verification results.
 *
 * The VLM produces a raw verdict (PASS / FAIL / NEEDS_REVIEW / UNSUPPORTED).
 * This module applies business rules on top of that raw output so that
 * edge cases the model may not handle consistently are caught and escalated
 * to NEEDS_REVIEW before the verdict is stored and acted upon.
 *
 * Normalization rules applied in order
 * ─────────────────────────────────────
 *  1. Non-scorable clip                          → NEEDS_REVIEW
 *  2. Missing evidence present                   → NEEDS_REVIEW
 *  3. Audio required but unavailable             → NEEDS_REVIEW
 *  4. Required reference asset absent            → NEEDS_REVIEW
 *  5. Non-DOG_PROFILE object unmatched           → NEEDS_REVIEW
 *  6. PASS confidence below auto-pass threshold  → NEEDS_REVIEW
 *  7. FAIL confidence below auto-fail threshold  → NEEDS_REVIEW
 *  8. Multiple / ambiguous dogs in frame         → NEEDS_REVIEW
 *  9. Ambiguous reference-asset match            → NEEDS_REVIEW
 * 10. UNSUPPORTED verdict                        → propagate + flag for review
 *
 * The function is pure — it returns a new result object and never mutates
 * the input.
 *
 * Progression gate
 * ────────────────
 * Only a normalized PASS verdict (after all rules have been applied) may
 * unlock verified progression and award XP / coins.  FAIL, NEEDS_REVIEW,
 * and UNSUPPORTED must never unlock pass-gated progression.
 * Owner confirmation must never override any non-PASS normalized verdict.
 */

import type {
  DogTrainingVerificationResult,
  VerificationVerdict,
} from "@/types/domain";
import type { TrainingCatalogActivity } from "@/types/trainingCatalog";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Reference-asset match confidence below this level is considered ambiguous
 * even when the VLM returned matched=true.
 */
const AMBIGUOUS_REFERENCE_MATCH_THRESHOLD = 0.5;

// ─── Context ──────────────────────────────────────────────────────────────────

/**
 * Subset of TrainingCatalogActivity required by the normalizer.
 * Using a subset lets the normalizer be called with a minimal context
 * object in tests and Supabase Edge Functions without importing the
 * full activity.
 */
export interface NormalizationContext {
  minimumAutoPassConfidence: number;
  minimumAutoFailConfidence: number;
  recordingRequirements: {
    audioRequired: boolean;
  };
  requiredReferenceAssets: {
    type: string;
    required: boolean;
  }[];
}

/** Narrow a full TrainingCatalogActivity into a NormalizationContext. */
export function toNormalizationContext(
  activity: TrainingCatalogActivity,
): NormalizationContext {
  return {
    minimumAutoPassConfidence: activity.minimumAutoPassConfidence,
    minimumAutoFailConfidence: activity.minimumAutoFailConfidence,
    recordingRequirements: {
      audioRequired: activity.recordingRequirements.audioRequired,
    },
    requiredReferenceAssets: activity.requiredReferenceAssets.map((a) => ({
      type: a.type,
      required: a.required,
    })),
  };
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

/**
 * Returns a new DogTrainingVerificationResult with the verdict and
 * needsHumanReview flag updated according to the business rules above.
 * All other fields are preserved unchanged.
 *
 * This function must be called on every real Gemini response before
 * the result is stored or used to gate progression.
 */
export function normalizeVerificationResult(
  result: DogTrainingVerificationResult,
  context: NormalizationContext,
): DogTrainingVerificationResult {
  // ── Rule 1 — Non-scorable clip ────────────────────────────────────────────
  if (!result.scorable) {
    return { ...result, verdict: "NEEDS_REVIEW", needsHumanReview: true };
  }

  // ── Rule 10 — UNSUPPORTED propagates unchanged but flags for review ───────
  if (result.verdict === "UNSUPPORTED") {
    return { ...result, needsHumanReview: true };
  }

  // ── Collect all triggered normalization rules ─────────────────────────────
  const triggers: string[] = [];

  // Rule 2 — Missing evidence present (missing evidence ≠ FAIL, must be NEEDS_REVIEW)
  if (result.missingEvidence.length > 0) {
    triggers.push("missing_evidence");
  }

  // Rule 3 — Audio required but not available in clip
  if (
    context.recordingRequirements.audioRequired &&
    !result.clipQuality.audioAvailableWhenRequired
  ) {
    triggers.push("missing_audio");
  }

  // Rule 4 — A required reference asset is absent from the clip
  if (
    context.requiredReferenceAssets.some((a) => a.required) &&
    !result.clipQuality.referenceAssetsAvailableWhenRequired
  ) {
    triggers.push("missing_required_reference_asset");
  }

  // Rule 5 — Non-DOG_PROFILE required object was not matched to a reference
  // (DOG_PROFILE matching is best-effort; object matching for target objects
  // is mandatory when the activity requires a specific physical object)
  if (
    context.requiredReferenceAssets.some(
      (a) => a.required && a.type !== "DOG_PROFILE",
    ) &&
    !result.clipQuality.referenceObjectMatchedWhenRequired
  ) {
    triggers.push("required_object_not_matched");
  }

  // Rule 6 — PASS verdict with confidence below the auto-pass threshold
  if (
    result.verdict === "PASS" &&
    result.confidence < context.minimumAutoPassConfidence
  ) {
    triggers.push("low_confidence_pass");
  }

  // Rule 7 — FAIL verdict with confidence below the auto-fail threshold
  if (
    result.verdict === "FAIL" &&
    result.confidence < context.minimumAutoFailConfidence
  ) {
    triggers.push("low_confidence_fail");
  }

  // Rule 8 — Multiple / ambiguous dogs in frame
  if (!result.clipQuality.targetDogUnambiguous) {
    triggers.push("multiple_ambiguous_dogs");
  }

  // Rule 9 — Reference asset matched=true but with low confidence
  const hasAmbiguousMatch = result.matchedReferenceAssets.some(
    (asset) =>
      asset.matched && asset.confidence < AMBIGUOUS_REFERENCE_MATCH_THRESHOLD,
  );
  if (hasAmbiguousMatch) {
    triggers.push("ambiguous_reference_match");
  }

  // ── No triggers fired — return original result ────────────────────────────
  if (triggers.length === 0) {
    return result;
  }

  // ── At least one trigger fired — escalate to NEEDS_REVIEW ─────────────────
  return {
    ...result,
    verdict: "NEEDS_REVIEW" as VerificationVerdict,
    needsHumanReview: true,
  };
}
