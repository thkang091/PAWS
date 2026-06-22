# AI Verification Production Runbook

This is the production loop for ranked/game or AI-verified training activities. The mobile app uploads real media and waits for the backend. The mobile app must never decide pass/fail rewards locally.

## Required Flow

1. Mobile creates an `activity_verifications` row through the existing secure submit RPC.
2. Mobile uploads the real video/photo to the configured Supabase Storage bucket.
3. Mobile calls the deployed `paws-dog-ai` HTTPS endpoint with the verification id and activity id.
4. Backend downloads the storage object using the service-role key.
5. Backend validates media type, duration, size, dog visibility, quality, and anti-cheat signals.
6. Backend analyzes the attempt with deterministic classifiers, learned models, or hybrid review routing.
7. Backend calls `finalize_activity_verification`.
8. Backend calls `award_verification_reward` only for trusted passed results.
9. Uncertain, high-risk, or ranked attempts stay in manual review until an admin action finalizes them.

## Backend Environment

Store this only in `paws-dog-ai/.env` or a secure hosting secret store:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_API_KEY=long-random-admin-key
DOG_AI_ENABLE_MOCK_MODE=false
```

The Expo app only gets:

```env
EXPO_PUBLIC_ENABLE_REAL_DOG_AI=true
EXPO_PUBLIC_DOG_AI_BASE_URL=https://your-dog-ai.example.com
```

## Reward Rules

- Silver and XP are awarded by `award_verification_reward`.
- Gold remains admin/review restricted.
- The backend must be idempotent by verification id.
- Replaying the same verification cannot create a second reward event.
- Fraud, low confidence, suspicious repeats, or ranked attempts should create review records instead of immediate rewards.

## Manual Review Path

The existing `paws-dog-ai` review router exposes admin-key protected endpoints:

- `GET /review/queue`
- `GET /review/stats`
- `GET /review/{review_id}`
- `POST /review/{review_id}/label`
- `POST /review/{review_id}/skip`
- `POST /review/{review_id}/dispute`
- `POST /review/enqueue/{verification_id}`

These endpoints are for a separate admin web dashboard. Do not expose them in the mobile app.

## Launch Gate

Before enabling real AI for users:

- Apply migrations through `0040`.
- Run `npm run validate:supabase`.
- Deploy `paws-dog-ai` behind HTTPS.
- Confirm `DOG_AI_ENABLE_MOCK_MODE=false`.
- Run labeled validation clips for each active activity.
- Confirm passed attempts award exactly once.
- Confirm failed attempts do not award.
- Confirm uncertain/ranked attempts enter review.
- Confirm backend logs contain no service-role key, signed URL, or user free-text note.
