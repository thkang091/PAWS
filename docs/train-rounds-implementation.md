# Training rounds implementation — 2026-10-03

Checkpoint before this work: `fe1907e` on `train` (pushed).

## Runtime flow

Roadmap → existing preparation content → start/resume → optional refresher → clip practice → celebration → roadmap.

- One Energy pays for three internal steps: 1–3, then 3–5. Step 3 overlaps as a recap. After an explicit early End, a fresh paid round starts at 1 if the next unfinished step is 1–2, otherwise at 3; an ordinary resume keeps its current clip. Partial legacy sessions are adopted without another charge and may have fewer remaining videos.
- Close pauses. Reopening presents preparation, then resumes the same paid round and saved quiz feedback. **End this session** explicitly ends it; completed actions remain saved.
- Continue reports a new success through the existing result function. An already-successful clip completes a recap session without another attempt report or changes to its saved success/progress. A retry carries the previous session ID so it cannot accidentally complete its successor. Highest progress is preserved.
- Help opens the existing Coach using the current clip's steps. It saves the exact caption concept separately, never finalizes the current practice as a failure, and does not capture chat messages.
- After prior practice, each new paid round starts with **Review quiz: exactly two different concepts**. Unresolved Help/quiz mistakes take priority, including another lesson for the same dog; missing questions come from completed clips, preferring the clip where Help was used. The first practice with no history skips review. First answers and feedback position persist; correct answers resolve that concept, and mistakes in supplemental questions become future review candidates. Quiz answers never award practice success or consume additional Energy.
- Final internal step success shows the lesson celebration and unlocks all its videos. Future visits show preparation → free video library. Old checkpoint records are preserved; the round flow does not schedule a new checkpoint/review mode.
- Internal level counts are absent from the practice/completion UI. Existing action captions, 0.6× playback, auto-scroll, playback caching, 40% video area, colors, Coach and mascot/confetti are reused.

## Storage and rollout

`20261003144611_training_rounds_and_refresher.sql` adds owner-readable `training_rounds` and `training_struggles`, a session→round link, and an authenticated action RPC in front of a private function. Clients cannot directly write either table. Round start/continuation is serialized per dog. Existing successful sessions and the Energy ledger remain authoritative; no records are reset or backfilled.

Applied to PAWS (`ytitmpodghiehzlmrhte`) on 2026-10-03 after explicit user approval. The local migration filename matches the server-recorded version `20261003144611`. The lesson route probes this RPC; only a missing-function response uses the legacy flow. Auth/offline/other errors do not start a second session through a fallback.

`20261003151409_training_three_clip_rounds.sql` changes new paid rounds to three clips and extends active old two-clip rounds to step 3 without charging again. Historical two-clip completions stay intact. Previously successful clips use `round-recap-v1` sessions and bypass the success-report path; Help during a recap still saves concepts for the next refresher. Applied to PAWS on 2026-10-03; the active two-clip round was extended, the completed two-clip round remained unchanged, and session/report/progress/Energy-ledger counts stayed 105/84/86/59. The deployed owner-authenticated read returned the updated boundary.

Deployment verification: owner-authenticated `get` returned a valid level and Energy state; unauthenticated access was denied in SQL and the REST API. RLS is enabled, `authenticated` has no direct write permission, and `anon` cannot execute the RPC. Existing session/progress/Energy ledger counts remained 98/26/56 across deployment. The security advisor's guest-sign-in notices for these tables are expected: PAWS supports guest accounts, restricted to their own dog by `owns_dog` ([advisor reference](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins)). Existing unrelated advisories were left unchanged.

Quiz snapshots are assembled from existing clip captions at the moment Help opens, with versioned IDs and rotated choices. These are small comprehension checks, not an assessment of the dog's ability. The incorrect alternatives currently use three authored sets shared across the curriculum; more tailored alternatives can be authored without changing storage or the player.

`20261003154551_training_two_question_review_quiz.sql` was applied on 2026-10-03. Its private caption bank contains 708 shipped caption moments plus one separate calm-response concept for the single-caption 5-2 first clip, seeking the same moment. `scripts/training-review-caption-seed.cjs` reproduces the seed from app content. The server freezes both questions when a new paid round starts; existing rounds and their answers are unchanged. Wrong supplemental answers save the source session/concept without inventing a successful attempt or charging Energy.

The bank is in `training_private`, has RLS, and grants neither table access nor helper-function execution to clients. Its lack of client policies is intentional default-deny; the advisor reports an [informational notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Only the existing owner-checked round RPC reads it. Server verification returned two distinct concepts for all six sampled dogs with previous practice.

## Verification

- `npm run typecheck`
- `npm test -- --runInBand`
- `npm install --prefix .expo/round-sql --no-save @electric-sql/pglite` then `node scripts/test-training-rounds.mjs`

The local SQL harness applies the real curriculum/session/result/Energy/continuation migrations plus both round migrations in an isolated PostgreSQL runtime. It checks ownership/RLS, start/answer/continue retries, first-answer immutability, no quiz progress awards, overlapping 1–3 / 3–5 boundaries, recap deduplication, migration of active old rounds, zero-Energy resume, early End/restart, adoption of old paid reviews, monotonic progress, final unlock, and free revisits. It does not simulate separate concurrent PostgreSQL connections; dog row locks plus uniqueness enforce those invariants in the deployed database.

The shared completion, quiz and player are browser-checked at 390×844. The two-question update passed typecheck, 88 SQL assertions, and four focused Jest checks. SQL coverage includes zero/one/many struggles, caption-only fallback, no future-clip selection, snapshot resume, supplemental mistake persistence, and the single-caption clip. Browser checks cover “Review quiz · 1 of 2” → “2 of 2” → practice. Full on-device practice/quiz testing is being performed by the user; browser preview navigation is not evidence of remote persistence.
