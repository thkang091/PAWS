import type {
  DogTrainingVerificationResult,
  VerificationVerdict,
} from "@/types/domain";
import type { TrainingCatalogActivity } from "@/types/trainingCatalog";

const AMBIGUOUS_REFERENCE_MATCH_THRESHOLD = 0.5;

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

export function normalizeVerificationResult(
  result: DogTrainingVerificationResult,
  context: NormalizationContext,
): DogTrainingVerificationResult {
  if (!result.scorable) {
    return { ...result, verdict: "NEEDS_REVIEW", needsHumanReview: true };
  }

  if (result.verdict === "UNSUPPORTED") {
    return { ...result, needsHumanReview: true };
  }

  const triggers: string[] = [];

  if (result.missingEvidence.length > 0) {
    triggers.push("missing_evidence");
  }

  if (
    context.recordingRequirements.audioRequired &&
    !result.clipQuality.audioAvailableWhenRequired
  ) {
    triggers.push("missing_audio");
  }

  if (
    context.requiredReferenceAssets.some((a) => a.required) &&
    !result.clipQuality.referenceAssetsAvailableWhenRequired
  ) {
    triggers.push("missing_required_reference_asset");
  }

  if (
    context.requiredReferenceAssets.some(
      (a) => a.required && a.type !== "DOG_PROFILE",
    ) &&
    !result.clipQuality.referenceObjectMatchedWhenRequired
  ) {
    triggers.push("required_object_not_matched");
  }

  if (
    result.verdict === "PASS" &&
    result.confidence < context.minimumAutoPassConfidence
  ) {
    triggers.push("low_confidence_pass");
  }

  if (
    result.verdict === "FAIL" &&
    result.confidence < context.minimumAutoFailConfidence
  ) {
    triggers.push("low_confidence_fail");
  }

  if (!result.clipQuality.targetDogUnambiguous) {
    triggers.push("multiple_ambiguous_dogs");
  }

  const hasAmbiguousMatch = result.matchedReferenceAssets.some(
    (asset) =>
      asset.matched && asset.confidence < AMBIGUOUS_REFERENCE_MATCH_THRESHOLD,
  );
  if (hasAmbiguousMatch) {
    triggers.push("ambiguous_reference_match");
  }

  if (triggers.length === 0) {
    return result;
  }

  return {
    ...result,
    verdict: "NEEDS_REVIEW" as VerificationVerdict,
    needsHumanReview: true,
  };
}
