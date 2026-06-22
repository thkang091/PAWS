# PAWS Reference Assets

## Overview

Reference assets are photos the owner uploads before starting a training activity. They give Gemini a visual baseline so it can confirm:
- The correct dog is in the submitted video
- The correct target object is in the submitted video

Without reference assets, Gemini cannot reliably distinguish the target dog from other dogs, or the target crate from a random box.

---

## Reference Asset Types

| `ReferenceAssetType` | Description | Example |
|---|---|---|
| `DOG_PROFILE` | Photos of the owner's specific dog | Front-facing, clear lighting, distinguishing markings visible |
| `TARGET_TOY` | A specific toy used in the activity | Rope toy from multiple angles |
| `TARGET_MAT` | A specific mat or bed | Mat in its usual location |
| `TARGET_BOWL` | The dog's specific food/water bowl | Bowl on the floor, empty and full |
| `TARGET_BASKET` | A basket or container | Open basket |
| `TARGET_CRATE` | The dog's specific crate | Door open, inside visible |
| `TARGET_DOORWAY` | A specific interior or exterior doorway | Full frame in view |
| `TARGET_PLATFORM` | A platform, step, or raised surface | Full view |
| `TARGET_CONE` | A training cone | Upright |
| `TARGET_BOX` | A cardboard or wooden box | Open |
| `TARGET_BUTTON` | A communication button | Close-up |
| `TARGET_BELL` | A doorbell training bell | Hanging |
| `TARGET_DRAWER` | A specific drawer | Closed and open |
| `TARGET_PERSON` | A specific person (e.g. a visitor in a greeting activity) | Clear face photo |
| `CUSTOM_OBJECT` | Any other specific object | Per activity instructions |

---

## ReferenceAssetRequirement Schema

```typescript
interface ReferenceAssetRequirement {
  type: ReferenceAssetType;
  required: boolean;            // false = bonus evidence only
  minimumPhotos: number;
  maximumPhotos: number;
  reusableAcrossActivities: boolean;
  instructions: string[];       // Owner-facing photo guidance
}
```

Every activity must include at least one `DOG_PROFILE` asset with `required: true`.

---

## Normalization Rules for Reference Assets

The normalizer enforces these rules on every Gemini response:

**Rule 4 — Required asset absent from clip:**
If the clip quality flag `referenceAssetsAvailableWhenRequired` is `false` and any asset has `required: true`, the verdict is escalated to `NEEDS_REVIEW`.

**Rule 5 — Non-DOG_PROFILE required object unmatched:**
If `referenceObjectMatchedWhenRequired` is `false` and any non-`DOG_PROFILE` asset has `required: true`, the verdict is escalated to `NEEDS_REVIEW`. DOG_PROFILE matching is best-effort; object matching for physical target objects is mandatory.

**Rule 9 — Ambiguous match:**
If any matched reference asset has `matched: true` but `confidence < 0.5` (`AMBIGUOUS_REFERENCE_MATCH_THRESHOLD`), the verdict is escalated to `NEEDS_REVIEW` even if the VLM returned PASS.

---

## Owner Upload Flow

1. Before starting a new activity, the app checks whether the required reference assets already exist in `training_reference_assets` for the dog.
2. If any required asset is missing, the owner is prompted to upload photos.
3. Photos are stored in Supabase Storage under a per-dog, per-asset-type path.
4. When submitting a video for verification, the edge function fetches the storage paths of all applicable reference assets and includes them in the Gemini request.
5. The storage paths are stored on the submission row as `reference_asset_storage_paths` for audit.

---

## Reuse Across Activities

When `reusableAcrossActivities: true`, the same uploaded photos are used for all activities that require that asset type for the same dog. The owner does not need to re-upload dog profile photos for every new activity.

When `reusableAcrossActivities: false`, the photos are specific to the current activity (rare — used when the object setup differs between activities).

---

## Database

Table: `training_reference_assets`

| Column | Type |
|---|---|
| `id` | `uuid PK` |
| `dog_id` | `uuid FK → dogs` |
| `asset_type` | `text` (ReferenceAssetType) |
| `label` | `text` (owner-provided name) |
| `storage_path` | `text` (Supabase Storage path) |
| `thumbnail_url` | `text nullable` |
| `created_at` | `timestamptz` |

RLS: owner may read/write their own dog's assets; service_role has full access.

---

## Related Documents

- [paws-training-catalog-schema.md](./paws-training-catalog-schema.md)
- [paws-real-gemini-verification-contract.md](./paws-real-gemini-verification-contract.md)
