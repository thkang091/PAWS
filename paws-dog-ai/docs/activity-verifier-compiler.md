# Activity Verifier Compiler

## Overview

The Activity Verifier Compiler is an internal toolchain that allows PAWS admins
to define new dog-training activities, identify which verification capabilities
are needed, and safely promote activities through a controlled lifecycle before
they can award real rewards.

No new activity is ever auto-certified. All high-stakes reward use (Gold Coins,
tournaments) requires a manually approved, certified activity definition backed
by fully available verification capabilities.

---

## Architecture

```
Admin writes description
        |
        v
POST /admin/activity-definitions/generate
        |
        v
DraftGeneratorProvider
  - deterministic (keyword mapping, always available)
  - future: llm (OpenAI / Anthropic, requires API key)
        |
        v
ActivityDraftResult (status=draft, certified_for_gold_coins=False)
        |
        v
Admin reviews warnings and required_capabilities
        |
        v
POST /admin/activity-definitions           (persists draft)
POST /{slug}/publish-experimental          (draft -> experimental)
POST /{slug}/promote-beta                  (experimental -> beta)
    [manual evaluation + certification infrastructure required]
        |
        v
On submission: StrategyExecutor
  1. Check submission gate (rejects draft, disabled, wrong tier)
  2. Load modules from strategy.modules
  3. Run quality gates first (video_quality_gate, pose_quality_gate)
  4. Run behavior modules in order
  5. Conservative combination
  6. Route through hybrid verification for high-stakes tiers
  7. Route through anti-cheat for Gold Coin / tournament
  8. Return StrategyExecutionResult
        |
        v
Data collection (experimental with missing capabilities)
  -> activity_data_collection_submissions table
        |
        v
Training readiness check
  -> activity_training_readiness table
```

---

## Activity Lifecycle

```
draft
  |-- publish-experimental --> experimental
  |                                |-- promote-beta --> beta
  |                                |                      |
  |                                |                      | [manual certification, not implemented]
  |                                |                      v
  |                                |                  certified
  |                                v
  |-- disable (from any state) --> disabled
```

### State rules

| State        | User submissions | Gold Coins | Tournaments | Data collection |
|--------------|-----------------|------------|-------------|-----------------|
| draft        | no              | no         | no          | no              |
| experimental | internal only   | no         | no          | yes             |
| beta         | selected users  | no         | no          | no              |
| certified    | all users       | if policy  | if policy   | no              |
| disabled     | no              | no         | no          | no              |

Certification is not automated. It requires evaluation infrastructure (shadow
rollout, accuracy measurement, manual approval) that is not yet built. Until
then the highest reachable lifecycle state via API is beta.

---

## Capability Registry

The capability registry (`app/services/capability_registry.py`) maps capability
names to implementation status. It is derived automatically from the
`MODULE_REGISTRY` in `app/ml/verifier_modules/`.

### Current capability status

| Capability                  | Status      | Notes                                      |
|-----------------------------|-------------|--------------------------------------------|
| video_quality_gate          | available   | Wraps VideoValidationService               |
| pose_quality_gate           | available   | Wraps pose_quality_service.compute_quality |
| pose_transition_detector    | available   | Sit-type transitions only                  |
| hold_duration_detector      | available   | Activity-agnostic hold timing              |
| multiple_dog_detection      | stub        | Reads existing flag; no visual count       |
| dog_tracking                | unavailable | No bounding-box tracker                    |
| approach_detection          | unavailable | Requires dog_tracking                      |
| target_zone_detection       | unavailable | Requires dog_tracking + object_detection   |
| rotation_detection          | unavailable | Requires orientation-tracking model        |
| object_detection            | unavailable | No object detection model                  |
| object_interaction_detection| unavailable | Requires object_detection + dog_tracking   |
| audio_cue_detection         | unavailable | No audio capture pipeline                  |
| eating_action_detection     | unavailable | No action recognition model                |

### Capability availability rules

- `available`: real implementation, allowed in beta, certified, Gold Coins, tournaments.
- `stub`: partial implementation with known limits; allowed in experimental and beta
  for data collection but blocked from Gold Coins and tournaments.
- `unavailable`: no implementation; allowed in experimental (data collection only);
  blocked from beta, certified, Gold Coins, and tournaments.

---

## Generating a New Draft Activity

```
POST /admin/activity-definitions/generate
Authorization: Bearer <admin-token>

{
  "activity_name": "Come and Eat",
  "description": "The dog approaches a food bowl after a cue and begins eating.",
  "success_examples": [
    "Dog starts away from bowl",
    "Dog approaches bowl after cue",
    "Dog lowers head near bowl",
    "Dog begins eating"
  ],
  "failure_examples": [
    "Dog is already at bowl before recording starts",
    "Dog walks away",
    "Dog approaches but does not eat"
  ],
  "recording_constraints": {
    "duration_seconds": 10,
    "full_body_visible": true,
    "bowl_visible": true
  },
  "intended_reward_tier": "beta_only",
  "generator_provider": "deterministic"
}
```

The response always has:
- `verification_status: "draft"`
- `certified_for_gold_coins: false`
- `certified_for_tournaments: false`
- `missing_capabilities`: populated from the live registry
- `warnings`: human-readable list of limitations the admin must address

The draft is not persisted automatically. To save it:

```
POST /admin/activity-definitions
Authorization: Bearer <admin-token>

{ ... draft fields from generate response ... }
```

---

## Unsupported Activities and Data Collection

When an activity has missing capabilities and its status is `experimental`,
the strategy executor returns `unsupported_data_collection_only` instead of
a real pass/fail decision.

The server stores the attempt in `activity_data_collection_submissions` with:
- pose sequence (if available)
- video storage path (if retained per consent policy)
- missing capabilities at time of submission
- user-provided expected result (pass/fail/uncertain)

This data accumulates until `activity_training_readiness` shows sufficient
volume and coverage for a candidate training job.

### Training readiness thresholds (current defaults)

| Threshold           | Value |
|---------------------|-------|
| Positive examples   | 200   |
| Negative examples   | 100   |
| Distinct dogs       | 20    |
| Missing capabilities| 0     |

All four must be met before `ready_for_candidate_training` becomes true.
Meeting the threshold does not trigger training automatically — it is a
signal for the admin to initiate a training job manually.

---

## Sit Backward Compatibility

The existing Sit verification path (rule-based + learned-model rollout) is
fully preserved. The Activity Verifier Compiler does not replace it.

The Sit activity definition in the database has:
```json
{
  "verification_strategy": {
    "existing_classifier_authoritative": true,
    "strategy_type": "pose_transition",
    "modules": [
      "video_quality_gate",
      "pose_quality_gate",
      "pose_transition_detector",
      "hold_duration_detector"
    ]
  }
}
```

When `existing_classifier_authoritative: true` the strategy executor:
1. Runs the configured modules for telemetry only.
2. Uses the result from the existing `SitClassifier` as the authoritative
   pass/fail decision.
3. Does not change user-visible behavior.

To migrate Sit to the new generic executor, flip
`existing_classifier_authoritative` to `false` in the database and enable
the feature flag `use_generic_executor_for_sit`. This is not implemented yet.

---

## What Is Real vs. Stubbed

### Real implementations

- `SitClassifier` — rule-based sit detection (always active)
- `apply_rollout` — learned-model rollout for Sit (configurable percentage)
- `VideoQualityGate` — wraps existing `VideoValidationService`
- `PoseQualityGate` — wraps existing `compute_quality` from `pose_quality_service`
- `PoseTransitionDetector` — sit geometry (mirrors SitClassifier internals)
- `HoldDurationDetector` — pose stability timing
- `HybridVerificationService` — RGB + pose score fusion
- `AntiCheatService` — duplicate detection, frequency analysis, reward blocking

### Stubbed or limited

- `MultipleDogDetector` — reads an existing boolean flag; cannot visually count dogs.

### Unavailable (not implemented)

- All other modules in `stub_modules.py` return `passed=None` and
  `CAPABILITY_UNAVAILABLE`. They never silently pass verification.

---

## Why Generated Activities Are Not Auto-Certified

Certification means the verifier has been measured against labeled ground-truth
data and shown to have acceptable precision and recall for the target activity.
This requires:

1. Labeled data collection (experimental phase).
2. A candidate training job.
3. Offline evaluation against a held-out test set.
4. Shadow rollout comparing the candidate to the existing path.
5. Manual approval from a human reviewer.

None of steps 2-5 are implemented yet. Auto-certification would mean awarding
Gold Coins and tournament points based on an untested, keyword-generated
verifier definition — a direct violation of the product safety constraints.

---

## Future Next Steps

In priority order:

1. **Dataset export** — export `activity_data_collection_submissions` to a
   training-ready format (pose sequences + labels).

2. **Training jobs** — integrate a training pipeline (e.g., a PyTorch classifier
   trained on exported pose sequences) that produces versioned model artifacts.

3. **Offline evaluation** — run the candidate model against a labeled test set
   and produce precision, recall, and F1 metrics.

4. **Shadow rollout** — run the candidate model alongside the existing path for
   a beta cohort and compare outputs without changing user-visible behavior.

5. **Certification endpoint** — add `POST /{slug}/certify` gated behind a
   required evaluation report ID, accessible only to a restricted admin role.

6. **LLM draft generator** — implement `LLMDraftGenerator` using the
   `DraftGeneratorProvider` interface for richer strategy generation.

7. **Breed and camera-angle coverage** — add diversity metrics to the training
   readiness calculation.

8. **Automatic capability implementation** — as new model artifacts become
   available, update the corresponding modules from `unavailable` to `available`
   and re-run capability registry checks.
