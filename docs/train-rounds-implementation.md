# Training rounds implementation — 2026-10-03

Checkpoint before this work: `fe1907e` on `train` (pushed).

## Runtime flow

Roadmap → existing preparation content → start/resume → optional refresher → clip practice → celebration → roadmap.

- One Energy pays for internal steps 1–2 or 3–5. Partial legacy sessions are adopted without another charge; a partial group may therefore have fewer remaining videos.
- Close pauses. Reopening presents preparation, then resumes the same paid round and saved quiz feedback. **End this session** explicitly ends it; completed actions remain saved.
- Continue reports success through the existing result function. A retry carries the previous session ID so it cannot accidentally complete its successor. Highest progress is preserved.
- Help opens the existing Coach using the current clip's steps. It saves the exact caption concept separately, never finalizes the current practice as a failure, and does not capture chat messages.
- A new paid round selects at most three distinct unresolved caption concepts for that dog, including struggles in another lesson. No struggles means no quiz. First answers and feedback position persist; correct answers resolve that concept, wrong answers remain eligible for another round. Quiz answers never award practice success or consume Energy.
- Final internal step success shows the lesson celebration and unlocks all its videos. Future visits show preparation → free video library. Old checkpoint records are preserved; the round flow does not schedule a new checkpoint/review mode.
- Internal level counts are absent from the practice/completion UI. Existing action captions, 0.6× playback, auto-scroll, playback caching, 40% video area, colors, Coach and mascot/confetti are reused.

## Storage and rollout

`20261003092948_training_rounds_and_refresher.sql` adds owner-readable `training_rounds` and `training_struggles`, a session→round link, and an authenticated action RPC in front of a private function. Clients cannot directly write either table. Round start/continuation is serialized per dog. Existing successful sessions and the Energy ledger remain authoritative; no records are reset or backfilled.

The lesson route probes this RPC. Only a missing-function response uses the legacy flow; auth/offline/other errors do not start a second session through a fallback. Until the migration is approved and applied, devices continue using the previous session flow. The remote database hold is still in effect pending explicit approval for this migration.

Quiz snapshots are assembled from existing clip captions at the moment Help opens, with versioned IDs and rotated choices. These are small comprehension checks, not an assessment of the dog's ability. The incorrect alternatives currently use three authored sets shared across the curriculum; more tailored alternatives can be authored without changing storage or the player.

## Verification

- `npm run typecheck`
- `npm test -- --runInBand`
- `npm install --prefix .expo/round-sql --no-save @electric-sql/pglite` then `node scripts/test-training-rounds.mjs`

The local SQL harness applies the real curriculum/session/result/Energy/continuation migrations plus the new migration in an isolated PostgreSQL runtime. It checks ownership/RLS, start/answer/continue retries, first-answer immutability, no quiz progress awards, 2+3 boundaries, zero-Energy resume, adoption of old paid reviews, monotonic progress, final unlock, and free revisits. It does not simulate separate concurrent PostgreSQL connections; dog row locks plus uniqueness enforce those invariants in the deployed database.

The shared completion, quiz and player are browser-checked at 390×844. Live round persistence on the emulator/iPhone still needs the approved migration and a device check; preview navigation is not evidence of remote persistence.
