# PAWS Real Gemini Verification Contract

## Core Requirement

Every pass-gated main training activity and every dog-game attempt **must** be reviewed by the real Gemini 2.5 Flash VLM. There are no exceptions.

Owner confirmation must never override a `FAIL`, `NEEDS_REVIEW`, or `UNSUPPORTED` verdict.

---

## API Configuration

| Secret | Value | Notes |
|---|---|---|
| `GEMINI_API_KEY` | Set in Supabase Edge Function secrets | **Never** use `EXPO_PUBLIC_*` |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Configurable via secret |

The mobile client never sends API keys. The edge function is the only caller of the Gemini API.

---

## Verification Flow

```
Owner uploads video
    ↓
Mobile client calls POST /verify-training-video
    ↓
Edge function authenticates owner, checks submission ownership
    ↓
Load activity from training_catalog_activities
Load reference assets from training_reference_assets
    ↓
Mark submission status = 'processing'
Store model_identifier, reference_asset_storage_paths, prompt_version
    ↓
Assemble Gemini multimodal request:
  - Video bytes (extracted at recommendedFps)
  - Dog profile reference photos
  - Target object reference photos (if required)
  - Shared master VLM prompt (MASTER_VLM_PROMPT v1.0.0)
  - Activity-specific compiled prompt (compileDogTrainingActivityPrompt)
    ↓
POST to Gemini generateContent API
    ↓
Parse raw JSON response
Validate against dogTrainingVerificationSchema (Zod)
    ↓
Apply all 10 normalization rules (normalizeVerificationResult)
    ↓
Store result in dog_training_verification_results (service_role only)
Store raw_gemini_response on submission row (audit)
    ↓
If normalized verdict = PASS:
  Call grant_training_pass_reward() (idempotency-keyed)
  Unlock progression
    ↓
Return normalized verdict to mobile client
```

---

## Request Contract

```typescript
interface GeminiDogTrainingVerificationRequest {
  submissionId: string;
  dogId: string;
  activityId: string;
  videoUrl: string;
  referenceAssets: {
    type: ReferenceAssetType;
    imageUrls: string[];
    displayName?: string;
  }[];
  recommendedFps: number;
  minClipSeconds: number;
  maxClipSeconds: number;
  audioRequired: boolean;
  masterPrompt: string;            // MASTER_VLM_PROMPT
  activitySpecificPrompt: string;  // compileDogTrainingActivityPrompt() output
  promptVersion: string;           // "1.0.0"
  model: string;                   // "gemini-2.5-flash"
}
```

---

## Response Contract (Zod Schema)

The raw Gemini response must be validated against `dogTrainingVerificationSchema` before use.

```typescript
{
  activityId: string;              // Must match submitted activity ID
  verdict: "PASS" | "FAIL" | "NEEDS_REVIEW" | "UNSUPPORTED";
  confidence: number;              // [0, 1]
  scorable: boolean;               // False = clip cannot be evaluated
  clipQuality: {
    dogVisible: boolean;
    targetDogUnambiguous: boolean;
    fullDogBodyVisibleWhenRequired: boolean;
    pawsVisibleWhenRequired: boolean;
    hipsVisibleWhenRequired: boolean;
    ownerVisibleWhenRequired: boolean;
    audioAvailableWhenRequired: boolean;
    targetObjectVisibleWhenRequired: boolean;
    destinationVisibleWhenRequired: boolean;
    referenceAssetsAvailableWhenRequired: boolean;
    referenceObjectMatchedWhenRequired: boolean;
    lightingSufficient: boolean;
    framingSufficient: boolean;
    actionCapturedFromStartToFinish: boolean;
  };
  observedEvents: { timestampSec: number; description: string; }[];
  satisfiedCriteria: string[];
  failedCriteria: string[];
  missingEvidence: string[];
  matchedReferenceAssets: {
    type: string;
    matched: boolean;
    confidence: number;
    notes: string;
  }[];
  visibleStartTimestampSec: number | null;
  visibleEndTimestampSec: number | null;
  passReason: string | null;
  failReason: string | null;
  needsHumanReview: boolean;
  suggestedRetryInstruction: string | null;
}
```

---

## Normalization Rules (Applied After Every Real Gemini Call)

All 10 rules are applied in order. The first triggered rule wins.

| Rule | Condition | Result |
|---|---|---|
| 1 | `scorable = false` | NEEDS_REVIEW |
| 2 | `missingEvidence.length > 0` | NEEDS_REVIEW |
| 3 | `audioRequired && !audioAvailableWhenRequired` | NEEDS_REVIEW |
| 4 | Any required asset + `!referenceAssetsAvailableWhenRequired` | NEEDS_REVIEW |
| 5 | Non-DOG_PROFILE required asset + `!referenceObjectMatchedWhenRequired` | NEEDS_REVIEW |
| 6 | `verdict = PASS && confidence < minimumAutoPassConfidence` | NEEDS_REVIEW |
| 7 | `verdict = FAIL && confidence < minimumAutoFailConfidence` | NEEDS_REVIEW |
| 8 | `!targetDogUnambiguous` | NEEDS_REVIEW |
| 9 | Any asset: `matched = true && confidence < 0.5` | NEEDS_REVIEW |
| 10 | `verdict = UNSUPPORTED` | Propagate + `needsHumanReview = true` |

**Key invariants:**
- Missing evidence is never a FAIL — it is always NEEDS_REVIEW (Rule 2).
- Approximate completion is never a PASS (enforced by master prompt Rule 10).
- The normalizer never mutates the input object.

---

## Verdict Outcomes

| Verdict | Progression | Owner Message |
|---|---|---|
| `PASS` | Unlock, award XP/coins idempotently | Congratulate |
| `FAIL` | No unlock | Show retry guidance |
| `NEEDS_REVIEW` | No unlock | Ask for a clearer video |
| `UNSUPPORTED` | No unlock | Activity unavailable |

---

## Audit Trail

Every verification is stored with:

- **`dog_training_video_submissions`** — submission state, model identifier, prompt version, reference asset paths, raw Gemini response, reward granted status
- **`dog_training_verification_results`** — structured VLM output, normalized verdict, confidence, timestamps, master prompt version, activity prompt version

The `raw_gemini_response` column stores the verbatim JSON from Gemini and is never exposed to the mobile client.

---

## Boss Quest Verification

For `HYBRID_BOSS_QUEST` activities, the edge function:
1. Accepts a separate narrow video clip per component.
2. Runs one real Gemini call per component.
3. Stores each result in `boss_quest_component_results`.
4. Aggregates: boss PASS only if every `required = true` component returns PASS.
5. Boss NEEDS_REVIEW if any mandatory component is NEEDS_REVIEW.
6. Boss FAIL if any mandatory component is FAIL.

Optional components (where `required = false`) do not block the boss verdict.

---

## Banned Patterns

The following patterns must never appear in the production verification path:

- `mockGemini`, `fakeVerdict`, `simulatedPass`, `simulatedFail`
- `randomConfidence`, `placeholderPrompt`
- `ownerConfirmationBypass`, `autoApprove`
- Hardcoded `PASS`/`FAIL`/`NEEDS_REVIEW` strings used as a verdict (as opposed to UI labels)
- `EXPO_PUBLIC_GEMINI_API_KEY` (API key must never be a public variable)

---

## Calm Alone Time — Allowed vs. Forbidden Claims

Activities in the `CALM_ALONE_TIME` category have strict claim limits.

**Allowed:**
- Owner exited the frame for N seconds
- Dog remained inside the visible mat/zone area
- No visible escape attempt occurred
- Dog remained visible during the required interval

**Forbidden:**
- Dog is emotionally calm
- Dog no longer has separation anxiety
- Dog is cured
- Dog is safe to leave alone indefinitely
- Dog is comfortable alone based on one clip

These constraints are enforced in the master prompt (Rule 14) and in per-activity `outOfScopeClaims`.

---

## Related Documents

- [paws-training-catalog-schema.md](./paws-training-catalog-schema.md)
- [paws-reference-assets.md](./paws-reference-assets.md)
- [paws-activity-prompt-compiler.md](./paws-activity-prompt-compiler.md)
