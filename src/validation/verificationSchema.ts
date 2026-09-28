import { z } from "zod";

export const clipQualitySchema = z.object({
  dogVisible: z.boolean(),
  targetDogUnambiguous: z.boolean(),
  fullDogBodyVisibleWhenRequired: z.boolean(),
  pawsVisibleWhenRequired: z.boolean(),
  hipsVisibleWhenRequired: z.boolean(),
  ownerVisibleWhenRequired: z.boolean(),
  audioAvailableWhenRequired: z.boolean(),
  targetObjectVisibleWhenRequired: z.boolean(),
  destinationVisibleWhenRequired: z.boolean(),
  referenceAssetsAvailableWhenRequired: z.boolean(),
  referenceObjectMatchedWhenRequired: z.boolean(),
  lightingSufficient: z.boolean(),
  framingSufficient: z.boolean(),
  actionCapturedFromStartToFinish: z.boolean(),
});

export const observedEventSchema = z.object({
  timestampSec: z.number().min(0),
  description: z.string(),
});

export const matchedReferenceAssetSchema = z.object({
  type: z.string(),
  matched: z.boolean(),
  confidence: z.number().min(0).max(1),
  notes: z.string(),
});

export const dogTrainingVerificationSchema = z.object({
  activityId: z.string().min(1),

  verdict: z.enum(["PASS", "FAIL", "NEEDS_REVIEW", "UNSUPPORTED"]),

  confidence: z.number().min(0).max(1),

  scorable: z.boolean(),

  clipQuality: clipQualitySchema,

  observedEvents: z.array(observedEventSchema),

  satisfiedCriteria: z.array(z.string()),
  failedCriteria: z.array(z.string()),
  missingEvidence: z.array(z.string()),

  matchedReferenceAssets: z.array(matchedReferenceAssetSchema),

  visibleStartTimestampSec: z.number().nullable(),
  visibleEndTimestampSec: z.number().nullable(),

  passReason: z.string().nullable(),
  failReason: z.string().nullable(),

  needsHumanReview: z.boolean(),

  suggestedRetryInstruction: z.string().nullable(),
});

export type DogTrainingVerificationSchema = z.infer<typeof dogTrainingVerificationSchema>;
