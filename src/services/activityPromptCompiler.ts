/**
 * src/services/activityPromptCompiler.ts
 *
 * Compiles a complete, standalone activity-specific VLM prompt from a
 * TrainingCatalogActivity.
 *
 * The compiled prompt is used as the second part of every Gemini request,
 * after the shared master prompt.  It must be self-contained — the VLM
 * must be able to score the video from the compiled prompt alone, without
 * relying on any external context.
 *
 * Usage
 * ─────
 *   import { compileDogTrainingActivityPrompt } from "@/services/activityPromptCompiler";
 *   const prompt = compileDogTrainingActivityPrompt(activity);
 *   // store as activity.vlmPrompt and pass to GeminiDogTrainingVerificationRequest
 *
 * The compiled prompt must NOT be used to fabricate a verdict.  It is
 * only a structured instruction — the real Gemini API call still needs
 * to happen for any verdict to be meaningful.
 */

import type { TrainingCatalogActivity, ReferenceAssetRequirement } from "@/types/trainingCatalog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bulletList(items: string[], indent = "- "): string {
  if (items.length === 0) return "(none specified)";
  return items.map((item) => `${indent}${item}`).join("\n");
}

function numberedList(items: string[]): string {
  if (items.length === 0) return "(none specified)";
  return items.map((item, i) => `${i + 1}. ${item}`).join("\n");
}

function formatReferenceAssets(assets: ReferenceAssetRequirement[]): string {
  if (assets.length === 0) return "(none required)";
  return assets
    .map((asset) => {
      const req = asset.required ? "REQUIRED" : "OPTIONAL";
      const photos = `${asset.minimumPhotos}–${asset.maximumPhotos} photo${asset.maximumPhotos !== 1 ? "s" : ""}`;
      const reuse = asset.reusableAcrossActivities ? "reusable across activities" : "activity-specific";
      return [
        `${asset.type} [${req}]`,
        `  Photos: ${photos} (${reuse})`,
        asset.instructions.length > 0
          ? `  Instructions:\n${asset.instructions.map((i) => `    • ${i}`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

// ─── Compiler ─────────────────────────────────────────────────────────────────

/**
 * Compiles a complete, standalone activity-specific VLM prompt.
 *
 * The output is deterministic given the same activity object.  Store the
 * compiled string in `TrainingCatalogActivity.vlmPrompt` and in
 * `training_catalog_activities.vlm_prompt` in the database.
 */
export function compileDogTrainingActivityPrompt(
  activity: TrainingCatalogActivity,
): string {
  const rr = activity.recordingRequirements;

  const cameraSetup = [
    `Camera angle: ${rr.cameraAngle}`,
    rr.fullDogBodyRequired ? "Full dog body (head to tail) must be visible." : null,
    rr.pawsRequired ? "All four paws must be visible at scored moments." : null,
    rr.hipsRequired ? "Hip region must be visible." : null,
    rr.ownerRequiredInFrame ? "Handler must be visible in frame." : null,
    rr.targetObjectRequiredInFrame ? "The target object must be visible throughout the scored sequence." : null,
    rr.destinationRequiredInFrame ? "The destination zone must be visible in frame." : null,
    rr.startBoundaryRequiredInFrame
      ? "The start boundary must be visible (e.g. threshold line, starting position) so the start state can be confirmed."
      : null,
    rr.endBoundaryRequiredInFrame
      ? "The end boundary must be visible (e.g. mat edge, crate entry, threshold far side) so task completion can be confirmed."
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const setupBlock =
    rr.setupInstructions.length > 0
      ? `\nSetup instructions:\n${bulletList(rr.setupInstructions)}`
      : "";

  return `Evaluate the submitted PAWS dog-training video.

ACTIVITY ID:
${activity.id}

TITLE:
${activity.title}

CATEGORY:
${activity.category}

LESSON GOAL:
${activity.lessonGoal}

VISIBLE CHECKPOINT:
${activity.visibleCheckpoint}

RECORDING SETUP:
${cameraSetup}${setupBlock}

REFERENCE ASSETS:
${formatReferenceAssets(activity.requiredReferenceAssets)}

VIDEO PROCESSING:
- Recommended FPS: ${activity.recommendedFps}
- Minimum clip seconds: ${activity.minClipSeconds}
- Maximum clip seconds: ${activity.maxClipSeconds}
- Audio required: ${rr.audioRequired ? "YES — missing or inaudible audio must return NEEDS_REVIEW" : "NO"}

EXPECTED START STATE:
${numberedList(activity.startStateCriteria)}

ORDERED VISIBLE EVENTS:
${numberedList(activity.orderedVisibleEvents)}

PASS only when every mandatory criterion is visibly satisfied:
${numberedList(activity.passCriteria)}

FAIL only when the clip is fully scorable and a mandatory criterion is visibly contradicted:
${numberedList(activity.failCriteria)}

Return NEEDS_REVIEW when:
${numberedList(activity.needsReviewCriteria)}

OUT OF SCOPE — never include these claims in the output:
${bulletList(activity.outOfScopeClaims)}

SAFETY:
${bulletList(activity.safetyNotes)}

RETRY GUIDANCE — if verdict is FAIL or NEEDS_REVIEW, select the most applicable:
${bulletList(activity.retryInstructions)}

CONFIDENCE THRESHOLDS:
- Auto-PASS requires confidence ≥ ${activity.minimumAutoPassConfidence.toFixed(2)}
- Auto-FAIL requires confidence ≥ ${activity.minimumAutoFailConfidence.toFixed(2)}
- Below threshold → return NEEDS_REVIEW regardless of verdict

IMPORTANT:
- Missing evidence is not a FAIL.
- Approximate completion is not a PASS.
- Do not infer events outside the clip.
- Match required reference assets against the visible dog and objects in the clip.
- Return timestamps for all events listed in ORDERED VISIBLE EVENTS.
- Return strict JSON only — no prose, no markdown, no explanation outside the JSON structure.`;
}
