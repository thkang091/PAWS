# PAWS Train — Implementation Plan & Inspection Report

Generated: 2026-06-10

---

## 1. Repository Structure Snapshot

```
app/
  (tabs)/train.tsx          ← existing Train tab (OLD zigzag path — needs rewrite)
  onboarding.tsx            ← 9-step flow; steps 3–4 already updated (✅ done)
  train/
    [skillId].tsx           ← old skill detail screen (keep; used by old flow)
    activity/               ← directory created, files NOT yet written
    reference-setup/        ← directory created, files NOT yet written
  training/
    session/[skillId].tsx   ← old guided session (keep)
    history.tsx             ← keep
  admin/
    ai-lab.tsx              ← file created by prior session (needs review)
  _layout.tsx               ← Stack navigator; only has train/[skillId] — needs new routes

src/
  types/domain.ts           ← curriculum types appended (✅ done)
  services/
    curriculumService.ts    ← 15 functions, full mapper layer (✅ done)
    onboardingService.ts    ← modified to insert goals + invoke edge fn (verify)
    activityVerificationService.ts ← OLD VLM pipeline — preserve as-is
  hooks/
    useDogRoadmap.ts        ← (✅ done)
    useCatalogActivity.ts   ← (✅ done)
    useReferenceAssets.ts   ← (✅ done)
    useDogStreak.ts         ← (✅ done)
  constants/
    onboardingOptions.ts    ← 6 goal categories + pain points (✅ done)
    queryKeys.ts            ← new curriculum keys appended (✅ done)
  validation/
    onboardingSchemas.ts    ← selectedTrainingGoals schema added (✅ done)
  components/onboarding/
    TrainingGoalSelectionStep.tsx ← (✅ done)
    PainPointsStep.tsx            ← (✅ done)
  config/
    env.ts                  ← Zod-validated EXPO_PUBLIC_ vars; no new vars needed yet
    features.ts             ← feature flags; add curriculumEnabled flag when ready
  __tests__/
    curriculum.test.ts      ← NOT yet written

supabase/
  migrations/
    0019_training_curriculum.sql       ← 9 tables + enums (✅ done)
    0020_seed_training_catalog.sql     ← NOT YET CREATED
    0021_training_extended_schema.sql  ← 8 more tables (✅ done)
  functions/
    generate-roadmap/index.ts         ← personalization engine (✅ done, needs review)

paws-dog-ai/               ← Python FastAPI; /dev/infer-vlm uses Gemini 2.5 Flash
docs/
  admin-dashboard-spec.md
  paws-train-implementation-plan.md  ← this file
```

---

## 2. Existing Locations

| Surface | Location |
|---|---|
| Train tab | `app/(tabs)/train.tsx` |
| Onboarding | `app/onboarding.tsx` |
| Old skill detail | `app/train/[skillId].tsx` |
| Old guided session | `app/training/session/[skillId].tsx` |
| Activity definitions (old) | `src/config/activityDefinitions.ts` |
| VLM pipeline (old) | `src/services/activityVerificationService.ts` |
| Admin AI Lab | `app/admin/ai-lab.tsx` |

---

## 3. Framework / Navigation / State

| Layer | Technology | Notes |
|---|---|---|
| Mobile framework | Expo 56 / RN 0.85.3 | File-based routing via expo-router |
| Navigation | expo-router Stack in `app/_layout.tsx` | New screens must be registered here |
| State / data | TanStack Query v5 + Supabase JS v2 | Pattern established; use `queryKeys.ts` |
| Backend (server logic) | Supabase Edge Functions (Deno/TypeScript) | Already used for `generate-roadmap` |
| VLM inference | `paws-dog-ai` Python FastAPI | `/dev/infer-vlm` with Gemini 2.5 Flash |
| Env validation | `src/config/env.ts` (Zod) | All EXPO_PUBLIC_ vars must be declared here |
| Tests | jest + ts-jest, node env | Test files go in `src/__tests__/` |

---

## 4. Backend Recommendation

**Use Supabase Edge Functions for all server-side curriculum logic.**

Rationale:
- `generate-roadmap` edge function is already written and deployed; the pattern is established.
- Mobile client already calls `supabase.functions.invoke(...)` in `curriculumService.ts`.
- RLS is already configured on all 17 new tables; service-role key is only in edge functions.
- VLM submission flows through `paws-dog-ai` (unchanged); edge functions can relay if needed.
- No new backend infrastructure required.

Do NOT call VLM directly from the mobile client. Keep `GEMINI_API_KEY` server-side only.

---

## 5. Environment Variables

No new `EXPO_PUBLIC_` vars are needed for the curriculum MVP. The existing `EXPO_PUBLIC_DOG_AI_BASE_URL` points to `paws-dog-ai`, and `SUPABASE_SERVICE_ROLE_KEY` lives only in edge functions.

If a direct-mobile Gemini path is ever added, add `EXPO_PUBLIC_GEMINI_API_KEY` to `src/config/env.ts` — but this is explicitly not planned.

---

## 6. Proposed File Map — What Still Needs To Be Built

### Must-do before any UI work

| File | Action | Status |
|---|---|---|
| `supabase/migrations/0020_seed_training_catalog.sql` | Create — seed the catalog with representative activities (not 300 yet; start with 10–20 well-crafted rows covering all 6 categories, with CERTIFIED VLM prompts for the first 2–3 per category) | ❌ Missing |
| `app/_layout.tsx` | Add Stack.Screen entries for `train/activity/[dayId]`, `train/reference-setup/[assetType]`, `admin/ai-lab` | ❌ Missing |

### Train tab rewrite

| File | Action | Status |
|---|---|---|
| `app/(tabs)/train.tsx` | Rewrite to show roadmap-driven daily plan using `useDogRoadmap` + `useCatalogActivity` | ❌ Old code still in place |

### New screens

| File | Action | Status |
|---|---|---|
| `app/train/activity/[dayId].tsx` | Activity detail + video recording screen | ❌ Directory exists, no file |
| `app/train/reference-setup/[assetType].tsx` | Reference photo setup screen | ❌ Directory exists, no file |

### Tests

| File | Action | Status |
|---|---|---|
| `src/__tests__/curriculum.test.ts` | Curriculum validation suite | ❌ Missing |

### Needs review (created by prior session; correctness not verified)

| File | Risk |
|---|---|
| `app/admin/ai-lab.tsx` | Agent-generated; may have type errors or reference missing exports |
| `supabase/functions/generate-roadmap/index.ts` | 842 lines; algorithm logic, JWT verification, and CORS headers need human review |
| `src/services/curriculumService.ts` | Mapper layer uses `Record<string, unknown>` casts; test against real DB before relying on it |
| `src/services/onboardingService.ts` | Modified by agent; verify backward-compat RPC call still works for existing users |
| `app/onboarding.tsx` | Modified by agent; verify step 3 validation doesn't block existing users |

---

## 7. Risks

### Critical

1. **Migration 0020 is missing** — `training_catalog_activities` is empty. Every feature that touches activities (roadmap generation, Train tab, activity screen) will return empty results or 404 until seed data is present.

2. **generate-roadmap edge function is undeployed** — it exists as source but has not been deployed via `supabase functions deploy`. Onboarding will silently fail to create roadmaps (`.catch(console.error)` swallows the error).

3. **New Stack routes not registered** — `app/train/activity/[dayId].tsx` and `app/train/reference-setup/[assetType].tsx` files do not exist yet, and even if they did, `app/_layout.tsx` is missing the `Stack.Screen` declarations. Navigation to these routes will throw a warning or show a blank screen.

4. **Agent-generated files not verified** — six files were written by background agents in the previous session without human review. They may have TypeScript errors, wrong column names, or logic bugs.

### Medium

5. **Migration gap (0020 skipped)** — Supabase applies migrations in order. If 0020 is inserted later, it must be deployed carefully against the already-running 0021. This is safe in local dev (`supabase db reset`) but requires care in production (run 0020 before any dog gets a roadmap).

6. **is_admin column on profiles** — `app/admin/ai-lab.tsx` guards on `profiles.is_admin`. Migration 0019 adds this column but it defaults to `false`. No production user has admin access yet; you must manually set it with a service-role SQL command.

7. **Backward compatibility** — `onboardingService.ts` was modified. Existing dogs created before this migration do NOT have `dog_selected_training_goals` rows. Ensure the Train tab gracefully handles a missing roadmap (empty state + "Generate your plan" CTA) rather than crashing.

8. **CALM_ALONE_TIME VLM constraint** — any VLM prompt for CA category activities MUST NOT diagnose separation anxiety or make emotional claims from video. This must be enforced by code review on every CA prompt, not just by instruction.

### Low

9. **Reference asset photos** — activities that require `TARGET_MAT`, `TARGET_CRATE`, etc. will be blocked if a user hasn't taken reference photos. The reference-setup screen doesn't exist yet. This must be done before any asset-dependent activity can be attempted.

10. **Gold Coin / tournament integration** — per spec, Gold Coin rewards are only for CERTIFIED activities. The reward log table has `idempotency_key`. Until at least one activity is CERTIFIED, no Gold Coins will flow through the curriculum system.

---

## 8. Recommended Implementation Order

Start small. Verify each phase before moving to the next.

### Phase A — Unblock the database (do first, no UI)
1. Write `supabase/migrations/0020_seed_training_catalog.sql` with 12 activities (2 per category), each with a complete VLM prompt. Mark them `BETA`. Verify column names match 0019 exactly.
2. Run `supabase db reset` locally to apply 0019 → 0020 → 0021 in order.
3. Query `select count(*) from training_catalog_activities;` — confirm 12 rows.

### Phase B — Deploy edge function
4. Run `supabase functions deploy generate-roadmap`.
5. Test by calling it directly from a REST client with a real `dogId`.
6. Confirm rows appear in `dog_personalized_roadmaps` and `dog_personalized_roadmap_days`.

### Phase C — Register routes + verify onboarding
7. Add the three missing `Stack.Screen` entries to `app/_layout.tsx`.
8. Walk through onboarding end-to-end in the simulator. Confirm a roadmap is generated on completion.
9. Verify old users (existing dogs) see a graceful empty state in the Train tab.

### Phase D — Train tab rewrite
10. Rewrite `app/(tabs)/train.tsx` against `useDogRoadmap`. Show today's activity card. Keep the old zigzag as a "View Journey" modal.
11. Verify with a dog that has a roadmap. Verify graceful empty state without a roadmap.

### Phase E — Activity detail screen
12. Create `app/train/activity/[dayId].tsx`.
13. Wire video recording to `paws-dog-ai` `/dev/infer-vlm` using the activity's `vlm_prompt`.
14. On pass: call `curriculumService` to mark the day complete and log rewards.
15. On feedback (Too Hard / Just Right / Too Easy): call `submitDayFeedback`.

### Phase F — Reference setup screen
16. Create `app/train/reference-setup/[assetType].tsx`.
17. On activity screen: if required asset is missing, show a CTA that routes here.

### Phase G — Review agent-generated files
18. Review `app/admin/ai-lab.tsx` — fix any TypeScript errors, verify admin guard works.
19. Review `supabase/functions/generate-roadmap/index.ts` — especially algorithm correctness, JWT verification, and CORS.
20. Review `src/services/curriculumService.ts` mappers against actual DB column names from 0019.
21. Review `src/services/onboardingService.ts` — verify old RPC call is unchanged.

### Phase H — Tests
22. Write `src/__tests__/curriculum.test.ts` covering:
    - All seeded activities have required fields
    - Every CERTIFIED activity has a non-empty vlm_prompt
    - All CA vlm_prompts contain visible-behavior-only language
    - Roadmap has exactly 100 days
    - No more than 2 consecutive same-category days

### Phase I — Seed the full 300 activities (last)
23. Only after Phase G (review) confirms column names are correct.
24. Only after Phase H (tests) can validate the full catalog.
25. Start with BH and SO categories (most likely to be CERTIFIED first).

---

## 9. What NOT To Do

- Do not seed all 300 activities before the schema has been tested end-to-end.
- Do not promote any activity to CERTIFIED without an admin reviewing its VLM prompt and running at least 5 evaluation clips.
- Do not award Gold Coins from any DRAFT or BETA activity.
- Do not add EXPO_PUBLIC_GEMINI_API_KEY; VLM calls must remain server-side.
- Do not add placeholder implementations — prefer an honest empty state over fake data.
- Do not modify `src/services/activityVerificationService.ts` — the existing Sit verification flow must remain working independently.
