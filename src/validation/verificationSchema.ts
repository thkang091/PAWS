/**
 * Strict Zod schema for the structured VLM output returned by the
 * dog-training verification pipeline.
 *
 * The schema mirrors DogTrainingVerificationResult in domain.ts.
 * Use dogTrainingVerificationSchema.parse() / .safeParse() to validate
 * any JSON payload before treating it as a trusted verification result.
 */

import { z } from "zod";

// ─── Clip quality ────────────────────────────────────────────────────────────

export const clipQualitySchema = z.object({
  /** At least one dog is visible in the frame. */
  dogVisible: z.boolean(),
  /** Exactly one dog is identifiable as the subject. */
  targetDogUnambiguous: z.boolean(),
  /** Full dog body (head → tail) is visible when the activity requires it. */
  fullDogBodyVisibleWhenRequired: z.boolean(),
  /** All four paws are visible when the activity requires them. */
  pawsVisibleWhenRequired: z.boolean(),
  /** Hip area is visible when the activity requires it. */
  hipsVisibleWhenRequired: z.boolean(),
  /** Owner is in frame when the activity requires it. */
  ownerVisibleWhenRequired: z.boolean(),
  /** Audio track is available when the activity requires it. */
  audioAvailableWhenRequired: z.boolean(),
  /** Target object is visible when the activity requires it. */
  targetObjectVisibleWhenRequired: z.boolean(),
  /** Destination zone is visible when the activity requires it. */
  destinationVisibleWhenRequired: z.boolean(),
  /** Reference assets are present when required. */
  referenceAssetsAvailableWhenRequired: z.boolean(),
  /** Reference object is matched to a supplied asset when required. */
  referenceObjectMatchedWhenRequired: z.boolean(),
  /** Lighting is sufficient for confident pose assessment. */
  lightingSufficient: z.boolean(),
  /** Framing and camera angle are sufficient. */
  framingSufficient: z.boolean(),
  /** The complete action (start → finish) is captured. */
  actionCapturedFromStartToFinish: z.boolean(),
});

// ─── Sub-objects ─────────────────────────────────────────────────────────────

export const observedEventSchema = z.object({
  /** Seconds from the start of the clip when the event occurred. */
  timestampSec: z.number().min(0),
  description: z.string(),
});

export const matchedReferenceAssetSchema = z.object({
  /** ReferenceAssetType key, e.g. "TARGET_MAT". */
  type: z.string(),
  matched: z.boolean(),
  /** Confidence that the visible object matches the reference photo. */
  confidence: z.number().min(0).max(1),
  notes: z.string(),
});

// ─── Top-level verification result ───────────────────────────────────────────

export const dogTrainingVerificationSchema = z.object({
  /** ID of the activity that was being verified. */
  activityId: z.string().min(1),

  /**
   * Verdict categories:
   * - PASS          — criteria met at or above the auto-pass threshold
   * - FAIL          — criteria not met at or above the auto-fail threshold
   * - NEEDS_REVIEW  — uncertain; requires human or higher-confidence re-run
   * - UNSUPPORTED   — the VLM cannot assess this activity from the clip
   */
  verdict: z.enum(["PASS", "FAIL", "NEEDS_REVIEW", "UNSUPPORTED"]),

  /** Overall confidence in the verdict [0, 1]. */
  confidence: z.number().min(0).max(1),

  /**
   * Whether the clip was scorable at all.  False means the VLM could not
   * make a judgment (e.g. dog not visible); the verdict will be NEEDS_REVIEW
   * or UNSUPPORTED.
   */
  scorable: z.boolean(),

  clipQuality: clipQualitySchema,

  /**
   * Timestamped observations made by the VLM during the clip.
   * Empty array is valid (e.g. for very short or low-quality clips).
   */
  observedEvents: z.array(observedEventSchema),

  /** Activity pass criteria that were visibly satisfied. */
  satisfiedCriteria: z.array(z.string()),
  /** Activity pass criteria that were not met. */
  failedCriteria: z.array(z.string()),
  /** Evidence that would have been needed to pass but was absent. */
  missingEvidence: z.array(z.string()),

  /** How the VLM matched each required reference asset in the clip. */
  matchedReferenceAssets: z.array(matchedReferenceAssetSchema),

  /** Second into the clip where the scorable action begins (null = unknown). */
  visibleStartTimestampSec: z.number().nullable(),
  /** Second into the clip where the scorable action ends (null = unknown). */
  visibleEndTimestampSec: z.number().nullable(),

  /** Human-readable explanation for a PASS verdict (null otherwise). */
  passReason: z.string().nullable(),
  /** Human-readable explanation for a FAIL verdict (null otherwise). */
  failReason: z.string().nullable(),

  /**
   * True when this result should be sent to a human reviewer regardless of
   * the automated verdict.
   */
  needsHumanReview: z.boolean(),

  /** Actionable advice the app should show to help the user retry. */
  suggestedRetryInstruction: z.string().nullable(),
});

export type DogTrainingVerificationSchema = z.infer<typeof dogTrainingVerificationSchema>;
