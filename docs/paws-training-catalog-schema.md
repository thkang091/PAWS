# PAWS Training Catalog Schema

## Overview

The PAWS training catalog defines each dog-training activity as a structured object (`TrainingCatalogActivity`) stored in TypeScript as the source of truth and mirrored into the Supabase `training_catalog_activities` table.

Every activity carries everything the system needs to:
- Display the task to the owner
- Instruct the owner on recording setup
- Compile the VLM prompt for Gemini
- Normalize the Gemini response
- Award progression only on a real verified PASS

---

## Training Goal Categories

| `TrainingGoalCategory` | Display Name |
|---|---|
| `BETTER_BEHAVIOR_AT_HOME` | Better Behavior at Home |
| `SAFETY_AND_OBEDIENCE` | Safety and Obedience |
| `BETTER_WALKS` | Better Walks |
| `COOL_TRICKS_AND_GAMES` | Cool Tricks and Games |
| `HELPFUL_SKILLS_AROUND_THE_HOUSE` | Helpful Skills Around the House |
| `CALM_ALONE_TIME` | Calm Alone Time |

Users may select between 1 and 6 goals at onboarding and rank them by priority. The roadmap generator uses this ranking to weight activity selection.

---

## Quest Content Types

| `QuestContentType` | Description |
|---|---|
| `AI_VERIFIED_MAIN_QUEST` | Standard activity — requires one Gemini review |
| `GUIDED_SIDE_QUEST` | Companion activity — owner follows instructions, no mandatory VLM gate |
| `HYBRID_BOSS_QUEST` | Multi-clip challenge — one Gemini review per component; all mandatory components must PASS |

---

## Verification Status

| `VerificationStatus` | Meaning |
|---|---|
| `DRAFT` | Not yet calibrated; `coinReward` must be 0 |
| `BETA` | Live but rubric may change; `coinReward` must be 0 |
| `CERTIFIED` | Rubric is stable; eligible for non-zero `coinReward` |
| `DISABLED` | Removed from active roadmaps |

---

## Activity Schema Reference

```typescript
interface TrainingCatalogActivity {
  // Identity
  id: string;                      // Unique across all activities (e.g. "BH001")
  category: TrainingGoalCategory;
  sequenceNumber: number;          // Ordering within category
  level: number;                   // Difficulty tier (1 = easiest)

  // Metadata
  title: string;
  skillFamily: string;             // Grouping label (e.g. "Foundation Marker Training")
  questContentType: QuestContentType;

  // Owner-facing content
  lessonGoal: string;              // What the dog will learn
  whyItMatters: string;            // Motivation for the owner
  tutorialSteps: string[];         // Step-by-step instructions
  visibleCheckpoint: string;       // Single sentence the owner can check before recording

  // Progression links
  prerequisites: string[];         // Activity IDs that must be PASSED first
  regressionActivityId?: string;   // Easier activity to fall back to
  harderActivityId?: string;       // Next harder activity in the skill family

  // Reference asset requirements
  requiredReferenceAssets: ReferenceAssetRequirement[];

  // Recording requirements
  recordingRequirements: RecordingRequirements;
  recommendedFps: number;          // FPS hint for Gemini frame extraction
  minClipSeconds: number;
  maxClipSeconds: number;

  // VLM scoring criteria
  startStateCriteria: string[];    // Conditions that must be visible at clip start
  orderedVisibleEvents: string[];  // Expected sequence of events in the clip
  passCriteria: string[];          // All must be satisfied for PASS
  failCriteria: string[];          // Any visibly contradicted → FAIL (when fully scorable)
  needsReviewCriteria: string[];   // Conditions that escalate to NEEDS_REVIEW
  outOfScopeClaims: string[];      // Claims the VLM must never make
  safetyNotes: string[];           // Safety concerns reported if visible
  retryInstructions: string[];     // Shown to owner after FAIL or NEEDS_REVIEW

  // Confidence thresholds
  minimumAutoPassConfidence: number;  // Below this → NEEDS_REVIEW even if verdict=PASS
  minimumAutoFailConfidence: number;  // Below this → NEEDS_REVIEW even if verdict=FAIL

  // Rewards
  xpReward: number;
  coinReward: number;              // Must be 0 for DRAFT/BETA; non-zero only for CERTIFIED
  starsAvailable: number;

  // Audit
  verificationStatus: VerificationStatus;
  masterPromptVersion: string;     // Semver of shared master prompt (e.g. "1.0.0")
  activityPromptVersion: string;   // Semver of this activity's VLM prompt

  vlmPrompt: string;               // Compiled by compileDogTrainingActivityPrompt()
}
```

---

## Recording Requirements

```typescript
interface RecordingRequirements {
  cameraAngle: CameraAngle;
  fullDogBodyRequired: boolean;
  pawsRequired: boolean;
  hipsRequired: boolean;
  ownerRequiredInFrame: boolean;
  audioRequired: boolean;
  targetObjectRequiredInFrame: boolean;
  destinationRequiredInFrame: boolean;
  startBoundaryRequiredInFrame: boolean;  // Threshold line, starting position
  endBoundaryRequiredInFrame: boolean;    // Mat edge, crate entry, far threshold
  setupInstructions: string[];
}
```

### Camera Angles

| Value | When to use |
|---|---|
| `SIDE_FULL_BODY` | Sit, down, stay, heel |
| `FRONT_FULL_BODY` | Front-facing behaviours |
| `REAR_FULL_BODY` | Walking away, behind-the-back |
| `WIDE_ROOM_OWNER_AND_DOG` | Large space, distance required |
| `WIDE_ROUTE_OWNER_DOG_AND_LEASH` | Leash walking |
| `CLOSE_HAND_AND_OBJECT` | Marker delivery, luring |
| `VISIBLE_TARGET_ZONE` | Crate entry, mat, doorway hold |
| `VISIBLE_OBJECT_AND_DESTINATION` | Retrieve to bowl, fetch |
| `MULTI_CLIP_COMPONENT_SET` | Boss quests (multiple separate clips) |
| `CUSTOM` | Special framing with custom instructions |

---

## FPS Guidance

| Scenario | Recommended FPS |
|---|---|
| Entry or transition behaviours | 3 FPS |
| Duration holds (under 15 s) | 2 FPS |
| Long duration holds (30 s+) | 1 FPS |

The `recommendedFps` field is passed to the Gemini request. Lower FPS reduces token usage for long clips without losing scoring accuracy.

---

## Reward Rules

- `coinReward` must be `0` for all `DRAFT` and `BETA` activities.
- Gold coins are awarded only for `CERTIFIED` activities.
- XP and coins are awarded exactly once per submission via the `grant_training_pass_reward()` PostgreSQL function, which is guarded by an idempotency key.
- Only a normalized `PASS` verdict (after all 10 normalization rules) may unlock rewards.
- Owner confirmation must never override `FAIL`, `NEEDS_REVIEW`, or `UNSUPPORTED`.

---

## Database Columns

Table: `training_catalog_activities`

| Column | Type | Notes |
|---|---|---|
| `id` | `text PK` | |
| `category` | `text` | TrainingGoalCategory value |
| `sequence_number` | `integer` | |
| `level` | `integer` | |
| `title` | `text` | |
| `skill_family` | `text` | |
| `quest_content_type` | `text` | |
| `lesson_goal` | `text` | |
| `why_it_matters` | `text` | |
| `tutorial_steps` | `text[]` | |
| `visible_checkpoint` | `text` | |
| `prerequisites` | `text[]` | FK array |
| `regression_activity_id` | `text` | FK |
| `harder_activity_id` | `text` | FK |
| `required_reference_assets` | `text[]` | Asset type list |
| `recording_requirements` | `jsonb` | RecordingRequirements |
| `recommended_fps` | `integer` | |
| `min_clip_seconds` | `integer` | |
| `max_clip_seconds` | `integer` | |
| `start_state_criteria` | `text[]` | |
| `ordered_visible_events` | `text[]` | Added in migration 0027 |
| `pass_criteria` | `text[]` | |
| `fail_criteria` | `text[]` | |
| `needs_review_criteria` | `text[]` | |
| `out_of_scope_claims` | `text[]` | |
| `safety_notes` | `text[]` | |
| `retry_instructions` | `text[]` | Added in migration 0027 |
| `minimum_auto_pass_confidence` | `numeric` | |
| `minimum_auto_fail_confidence` | `numeric` | |
| `verification_status` | `text` | |
| `xp_reward` | `integer` | |
| `coin_reward` | `integer` | |
| `stars_available` | `integer` | |
| `master_prompt_version` | `text` | Default `'1.0.0'` |
| `activity_prompt_version` | `text` | Default `'1.0.0'` |
| `vlm_prompt` | `text` | Compiled prompt text |

---

## Related Documents

- [paws-reference-assets.md](./paws-reference-assets.md)
- [paws-real-gemini-verification-contract.md](./paws-real-gemini-verification-contract.md)
- [paws-activity-prompt-compiler.md](./paws-activity-prompt-compiler.md)
