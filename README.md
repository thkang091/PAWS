# PAWS

PAWS is an iOS-first Expo app for gamified dog training, daily care, private DogMoment memories, challenge games, and a restricted two-currency reward economy. The mobile app keeps exactly five bottom tabs: Train, Game, DogMoment, Care, and Profile. Expanded surfaces open through nested routes such as weekly plan, rewards, avatar shop, account linking, training history, DogMoment calendar, and care forms.

## Current State

Built in the repo:

- Expo Router app with strict TypeScript, Supabase, anonymous auth bootstrap, TanStack Query, and shared theme/components.
- Supabase migrations for profiles, dogs, catalogs, wallet ledger, XP ledger, RLS, Storage policies, secure RPC rewards, weekly plans, training feedback, DogMoment enhancements, care tracking, avatar shop, activity verification, pose sequences, reviews, training curriculum, challenge games, coupons, care health, backend verification rewards, reward fulfillment admin contracts, and expanded catalog seeds.
- Real mobile screens for onboarding, plan selection, tutorial, Train, Game, DogMoment, Care, Profile, Rewards/Gold Shop, Avatar Shop, Inventory, Weekly Plan, activity verification, training history, care event forms, and account linking.
- Python `paws-dog-ai` backend scaffold with FastAPI, classifiers, hybrid verification services, review APIs, anti-cheat, monitoring, dataset tooling, and tests.

Not production-complete until external setup is done:

- Live Supabase project with all migrations applied and RLS verified.
- Deployed Dog AI backend with HTTPS, service-role key, model dependencies, validation videos, and production thresholds.
- Admin-only dashboard for review, gold awards, reward catalog management, suspicious users, audit logs, and fulfillment operations.
- Real reward fulfillment provider or manual operations workflow.
- Production EAS builds, app identifiers, final icons/splash, notification setup, and store credentials.

## Tech Stack

- Expo React Native, Expo Router, TypeScript strict mode
- Supabase Auth, Postgres, RLS, RPC, and Storage
- TanStack Query
- Expo Camera, Image, Image Picker, Vector Icons, Reanimated
- Zod validation
- FastAPI Python backend for activity verification
- React Native VisionCamera + ExecuTorch for on-device dog presence precheck before challenge recording

## Environment

Copy the correct example:

```bash
cp .env.example .env
```

Required Expo variables:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_ENABLE_PAID_PLANS=false
EXPO_PUBLIC_ENABLE_REAL_DOG_AI=false
EXPO_PUBLIC_ENABLE_SENSOR_ROUTINES=true
EXPO_PUBLIC_ENABLE_RANKED_GAMES=false
EXPO_PUBLIC_DOG_AI_BASE_URL=
EXPO_PUBLIC_ON_DEVICE_POSE_ENABLED=false
EXPO_PUBLIC_ON_DEVICE_POSE_ROLLOUT_PERCENTAGE=0
EXPO_PUBLIC_ON_DEVICE_POSE_FALLBACK_TO_VIDEO_UPLOAD=true
EXPO_PUBLIC_ON_DEVICE_POSE_TARGET_FPS=8
```

Never expose a Supabase service-role key in the mobile app. The service-role key belongs only in secure backend environments such as `paws-dog-ai/.env`.

Before building the Expo app, run:

```bash
npm run check:expo-env
```

This fails if backend-only secret key names are present in the root Expo `.env`.

## Supabase Setup

1. Create a Supabase project.
2. Enable anonymous sign-in.
3. Configure Auth rate limits.
4. Configure CAPTCHA before production anonymous-auth exposure.
5. Add Google/Apple provider credentials only when account linking is ready for real OAuth.
6. Run every migration in `supabase/migrations` in filename order, currently `0001` through `0040`.
7. Confirm private Storage buckets and policies:
   - `dog-moments`
   - `dog-activity-videos`
   - `dog-activity-photos`
   - `dog-moment-photos`
8. Run the in-app development backend health check panel and manually test RLS with at least two accounts.

After migrations are applied, run the live validation script from this repo:

```bash
npm run validate:supabase
```

This uses only the Expo public Supabase URL and anon key. It signs in anonymously, bootstraps a profile, checks catalog/RPC availability, and verifies protected reads. It does not create fake dogs, fake wallet rows, fake rewards, or fake activity.

## Migration Order

Current migration range:

```text
0001_initial_schema.sql
0002_rls_policies.sql
0003_rpc_functions.sql
0004_storage_policies.sql
0005_seed_catalogs.sql
0006_security_hardening.sql
0007_weekly_plans.sql
0008_training_session_feedback.sql
0009_dog_moment_enhancements.sql
0010_care_tracking.sql
0011_avatar_shop.sql
0012_activity_verification.sql
0013_activity_verification_statuses.sql
0014_care_routines.sql
0015_care_routine_custom_rewards.sql
0016_pose_sequences.sql
0017_pose_sequence_quality.sql
0018_verification_reviews.sql
0019_training_curriculum.sql
0021_training_extended_schema.sql
0022_training_goal_foundation.sql
0023_catalog_schema_v2.sql
0024_seed_bh001_bh010.sql
0025_seed_bh011_bh020.sql
0026_gemini_verification_corrections.sql
0027_boss_quest_and_catalog_v3.sql
0028_extend_roadmap_days_to_300.sql
0029_two_currency_challenge_games.sql
0030_seed_challenge_games_bh.sql
0031_seed_challenge_games_bw.sql
0032_seed_challenge_games_hs.sql
0033_care_routine_reminder_time.sql
0034_remove_challenge_prereq_check.sql
0035_drop_submissions_activity_fkey.sql
0036_add_reminder_time_to_care_routines.sql
0037_care_health_tables.sql
0038_seed_so001_so020.sql
0039_award_verification_reward.sql
0040_reward_fulfillment_admin_contract.sql
```

There is no `0020` file in this repository. If a production database has already applied later migrations, do not insert a new `0020` without a deliberate database migration plan.

## Safety Model

- Wallet and XP balances are derived from immutable ledger rows.
- The mobile app must never directly mutate wallet balances, XP balances, gold awards, game results, or review outcomes.
- Reward mutations use secure RPCs with idempotency keys.
- Gold is restricted and should only be awarded by trusted backend/admin-reviewed game-result workflows.
- RLS must be enabled on user-owned tables.
- Audit logs are backend/admin controlled.

## Product Areas

### Train

Training catalog, roadmap, lesson detail, guided sessions, training history, and secure training rewards exist. The roadmap and activity catalog are backed by Supabase/catalog data. Production verification rewards still require the Dog AI backend to finalize verified passes.

### DogMoment

DogMoment supports real image selection/capture, Storage upload, signed URLs, timeline, calendar, recap, caption editing, favorites, and private share cards. There is no public feed, likes, comments, or fabricated social activity.

### Care

Care supports scheduled events, custom daily routines, routine completions, care health routes, grooming/medication/vaccination/exercise surfaces, weight logs, and owner-entered notes. PAWS organizes owner-entered information and is not veterinary advice.

### Game

Challenge game catalog, entry flows, two-currency economy structures, and activity verification routes exist. Large public leaderboards, matchmaking, ranked score settlement, and gold awards require trusted backend/admin review before production.

Challenge recording includes an on-device dog precheck gate. The gate uses VisionCamera and ExecuTorch object detection to confirm that a dog is visible before recording begins. This local check is only a lightweight pre-filter to reduce empty or irrelevant videos before backend/Gemini verification. It does not judge challenge success, award rewards, or replace backend/admin-reviewed verification.

The Game tab has a top-level Game / Tournament toggle. The Game section shows existing casual challenge games. The Tournament section reads operator-opened competitive events and leaderboards from Supabase. Joining, attempt submission, and prize settlement remain disabled until their secure backend phases are completed. See `docs/tournament-system-design.md`.

### Gold Shop And Rewards

The Gold Shop displays real reward catalog rows and creates pending redemption requests through secure RPCs. Automatic delivery, coupons, gift cards, and fulfillment require an external provider or manual operations dashboard.

### Avatar Shop

Avatar items cost silver only. Purchase and equip flows use secure RPCs.

## Dog AI Backend

Backend path:

```bash
cd /Users/taehoonkang/Desktop/paws/paws-dog-ai
```

Local setup:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Heavy AI dependencies:

```bash
pip install -r requirements-ai.txt
```

Backend `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ADMIN_API_KEY=long-random-admin-key
DOG_AI_ENABLE_MOCK_MODE=false
```

Use `paws-dog-ai/.env.example` as the backend template. Do not copy these backend secrets into the root Expo `.env`.

Production requirements:

- Deploy behind HTTPS.
- Keep service-role key on the server only.
- Install and validate model dependencies.
- Map model output to PAWS pose schema.
- Run labeled validation videos.
- Finalize verification rows server-side.
- Award training/game rewards only after trusted pass or admin review.
- Route uncertain/ranked attempts to manual review.

See `docs/ai-verification-production-runbook.md`.

## Admin Dashboard Boundary

Admin features do not belong in the consumer Expo app. Build a separate admin-only web app/backend with:

- Admin authentication and authorization.
- Service-role key only in secure server code.
- Review activity submissions.
- Approve/reject attempts.
- Award gold through server-side actions.
- Manage game instances and reward catalog.
- Update redemption statuses.
- View audit logs and suspicious repeated requests.
- Monitor upload/RPC/model failures.

See `docs/admin-dashboard-spec.md`.

## Reward Fulfillment Boundary

The app can store pending reward-redemption requests. It does not deliver gift cards, coupons, or physical products automatically. Production fulfillment needs either:

- manual admin operations, or
- an external provider integration with webhook/audit handling.

Never claim instant fulfillment until that provider is configured and tested.

See `docs/reward-fulfillment-runbook.md`.

## Production App Build

`eas.json` has development, preview, and production profiles. Before store submission:

- Replace `com.example.paws` with real iOS bundle identifier and Android package.
- Add final app icon, adaptive icon, splash assets, and brand artwork.
- Confirm camera, microphone, photo, and notification permission strings.
- Configure Apple/Google credentials if enabled.
- Configure push notifications only after Expo Notifications and credentials are ready.
- Build with EAS development first, then preview, then production.

See `docs/production-build-checklist.md`.

## Manual Validation Checklist

Run on a live Supabase project:

| Scenario | Expected result |
| --- | --- |
| New install | One anonymous account is created |
| Onboarding submit | Exactly one dog profile is created |
| Training complete double tap | Reward is granted once |
| Quest complete double tap | Reward is granted once |
| DogMoment second upload same date | Duplicate reward is blocked |
| Care routine double tap | Silver is granted once |
| Game entry double tap | Silver is deducted once |
| Insufficient silver | Entry fails clearly |
| Reward redemption | Gold deduction and pending request happen once |
| Different account | Other users' records remain inaccessible |
| Anonymous sign-out | Loss warning appears |
| Activity video with AI disabled | No local reward is granted |
| Activity video with AI enabled | Backend finalizes result and rewards only trusted passes |
| Manual review | Uncertain/ranked attempts wait for admin action |

## Run Locally

```bash
npm install
npm run check:expo-env
npm run typecheck
npm run validate:supabase
npx expo start
```

## Current Limitations

- Paid checkout is intentionally unavailable until billing is configured.
- Public social feed, likes, comments, and direct messaging are not implemented.
- Automatic reward fulfillment is not implemented.
- Production AI verification requires deployed backend, model validation, and review workflows.
- Push notification delivery requires Expo Notifications setup and credentials.
- Admin dashboard must be built separately.
