# PAWS Activity Prompt Compiler

## Overview

`compileDogTrainingActivityPrompt(activity: TrainingCatalogActivity): string`

Located in `src/services/activityPromptCompiler.ts`.

Produces a complete, standalone VLM prompt for a single training activity. The output is deterministic — given the same activity object, it always returns the same string. Store the compiled string in `TrainingCatalogActivity.vlmPrompt` and in the `training_catalog_activities.vlm_prompt` database column.

---

## Usage

```typescript
import { compileDogTrainingActivityPrompt } from "@/services/activityPromptCompiler";

const compiledPrompt = compileDogTrainingActivityPrompt(activity);

// Pass to Gemini request:
const request: GeminiDogTrainingVerificationRequest = {
  ...
  masterPrompt: MASTER_VLM_PROMPT,
  activitySpecificPrompt: compiledPrompt,
  promptVersion: activity.activityPromptVersion,
};
```

The compiled prompt is always used **after** the shared master prompt (`MASTER_VLM_PROMPT`). The master prompt sets global rules; the compiled prompt provides activity-specific criteria.

---

## Prompt Structure

The compiled prompt always contains the following sections in order:

```
Evaluate the submitted PAWS dog-training video.

ACTIVITY ID:
<id>

TITLE:
<title>

CATEGORY:
<category>

LESSON GOAL:
<lessonGoal>

VISIBLE CHECKPOINT:
<visibleCheckpoint>

RECORDING SETUP:
Camera angle: <cameraAngle>
[Conditional lines based on boolean flags]
Setup instructions:
- ...

REFERENCE ASSETS:
<type> [REQUIRED|OPTIONAL]
  Photos: N–M photos (reusable across activities | activity-specific)
  Instructions:
    • ...

VIDEO PROCESSING:
- Recommended FPS: N
- Minimum clip seconds: N
- Maximum clip seconds: N
- Audio required: YES — missing or inaudible audio must return NEEDS_REVIEW
         OR: NO

EXPECTED START STATE:
1. ...
2. ...

ORDERED VISIBLE EVENTS:
1. ...
2. ...

PASS only when every mandatory criterion is visibly satisfied:
1. ...

FAIL only when the clip is fully scorable and a mandatory criterion is visibly contradicted:
1. ...

Return NEEDS_REVIEW when:
1. ...

OUT OF SCOPE — never include these claims in the output:
- ...

SAFETY:
- ...

RETRY GUIDANCE — if verdict is FAIL or NEEDS_REVIEW, select the most applicable:
- ...

CONFIDENCE THRESHOLDS:
- Auto-PASS requires confidence ≥ 0.XX
- Auto-FAIL requires confidence ≥ 0.XX
- Below threshold → return NEEDS_REVIEW regardless of verdict

IMPORTANT:
- Missing evidence is not a FAIL.
- Approximate completion is not a PASS.
- Do not infer events outside the clip.
- Match required reference assets against the visible dog and objects in the clip.
- Return timestamps for all events listed in ORDERED VISIBLE EVENTS.
- Return strict JSON only — no prose, no markdown, no explanation outside the JSON structure.
```

---

## Conditional RECORDING SETUP Lines

Lines are added only when the corresponding boolean flag is `true`:

| Flag | Line added |
|---|---|
| `fullDogBodyRequired` | `Full dog body (head to tail) must be visible.` |
| `pawsRequired` | `All four paws must be visible at scored moments.` |
| `hipsRequired` | `Hip region must be visible.` |
| `ownerRequiredInFrame` | `Handler must be visible in frame.` |
| `targetObjectRequiredInFrame` | `The target object must be visible throughout the scored sequence.` |
| `destinationRequiredInFrame` | `The destination zone must be visible in frame.` |
| `startBoundaryRequiredInFrame` | `The start boundary must be visible (e.g. threshold line, starting position) so the start state can be confirmed.` |
| `endBoundaryRequiredInFrame` | `The end boundary must be visible (e.g. mat edge, crate entry, threshold far side) so task completion can be confirmed.` |

---

## Shared Master Prompt

`MASTER_VLM_PROMPT` is defined in `src/data/masterPrompt.ts`.

Current version: `MASTER_PROMPT_VERSION = "1.0.0"`

The master prompt contains 18 rules including:
- Only judge visible or audible evidence inside the clip
- Compare reference photos against subjects and objects in the video
- PASS requires every required checkpoint criterion to be clearly satisfied
- FAIL only when fully scorable and a criterion is visibly contradicted
- Missing evidence is never a FAIL
- Approximate completion is never a PASS
- Do not infer emotional state, comfort, anxiety, separation anxiety
- Report safety issues if visible
- Return strict JSON only

---

## Versioning

Increment `activityPromptVersion` in the activity object whenever `vlmPrompt` is edited. Increment `masterPromptVersion` whenever `MASTER_VLM_PROMPT` is edited (affects all activities).

Both versions are stored on every verification result row for audit. If the VLM rubric changes significantly, historical results can be flagged for re-review by comparing stored versions against the current version.

---

## What the Compiler Does Not Do

- The compiler does not call Gemini.
- The compiler does not fabricate a verdict.
- The compiler output is an instruction — it has no meaning without a real Gemini API call.
- The compiler does not include the shared master prompt in its output. The caller is responsible for concatenating both prompts.

---

## Testing

Static validation tests for the compiler are in `src/__tests__/trainingCatalogSchema.test.ts` under the `compileDogTrainingActivityPrompt` describe block.

Tests verify:
- All 17+ required sections are present
- Activity-specific content is included in each section
- Confidence thresholds are formatted to two decimal places
- Audio required notice uses YES/NO and mentions NEEDS_REVIEW when YES
- Conditional recording setup lines appear when flags are true
- No TODO/TBD/PLACEHOLDER text in output

---

## Related Documents

- [paws-training-catalog-schema.md](./paws-training-catalog-schema.md)
- [paws-reference-assets.md](./paws-reference-assets.md)
- [paws-real-gemini-verification-contract.md](./paws-real-gemini-verification-contract.md)
