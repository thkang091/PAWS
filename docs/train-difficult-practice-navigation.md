# Difficult practice and lesson navigation

Implemented 2026-10-06 in the existing preparation, practice, Coach, review quiz, and completion screens. No new route or screen was added.

## Guardian experience

- The bar above Continue represents only this paid round's planned practices, usually three, in their saved order. Segments fill as this round progresses; a small marker shows the currently viewed practice. Only practices already reached in this round can be selected. Previous rounds' completion does not fill segments or unlock upcoming practices in a new round.
- Caption buttons still seek inside the currently selected clip.
- Revisiting a practice changes only the player. Continue follows this round's order through visited material back to the paid round's current practice, including a nonconsecutive reinforcement plan such as 2, 4, 5. It does not charge Energy, settle another session, duplicate rewards, or lower saved progress.
- Help opens the existing Coach without a progress mutation. Only a user message/photo/transcribed voice note followed by a successful Coach reply records difficulty against the viewed practice. Step selection, the canned greeting, drafting, and failed calls do not count.
- Coach asks what happened, then suggests one easier condition and an observable action to reward. It may shorten a wait, shorten a requested movement, or reduce distractions. Distance from a scary or exciting trigger should increase rather than decrease.
- Continue still records success and advances the current round. An actual Coach conversation in that round keeps the practice difficult even after Continue or a correct quiz answer.
- Existing paid plans stay frozen. A new round prioritizes up to three pending difficulties, then unfinished practices, then nearby familiar practices. The chosen set plays in curriculum order. There are still three practices for one Energy, with the existing review quiz unchanged.
- Example: after practices 1, 2, 3 with difficulty on 2, the next round practices 2, 4, 5. With no difficulty, the existing 1, 2, 3 then 3, 4, 5 grouping remains.
- With difficulty on 1 and 2 after the first round, the next plan is 1, 2, 4. With difficulty on all three, it is 1, 2, 3. When all material has been covered and only 4 remains difficult, the plan is 3, 4, 5 instead of 4, 1, 2. No new lesson content is introduced.
- Completing a reinforced practice in a later round without another Coach conversation resolves it. Merely reopening Coach does not keep it pending. Revisiting a clip alone does not resolve it.
- More than three pending practices rotate by oldest reinforcement attempt, then difficulty count. Up to three are prioritized per round.
- Finishing L5 alone does not unlock the video library. A lesson is complete only after reaching its end and resolving every pending practical difficulty. If difficulty remains, the round can finish, but its existing completion screen promises to revisit the tricky parts rather than declaring the whole lesson complete. Preparation offers Continue session for reinforcement.
- Correct quiz answers do not unlock videos. Repeated Help in later rounds keeps completion pending for as many rounds as needed. After a later successful practice resolves the final pending difficulty, the completed lesson's library becomes free to revisit.
- Roadmap completion checks and training history use the same pending-difficulty condition. Existing L5 completion timestamps remain intact as progression history; they are no longer sufficient by themselves to display a completed lesson.

Internal practice numbers above describe implementation only; no new level-number labels were added to the player.

## Persistence

The October 12 Coach-conversation update records one `training_coach_practice_events` entry per round/level, through the existing owner-checked RPC. Only identifiers and event time are stored; chat messages and attachments are not saved here. Duplicate requests cannot reopen a difficulty resolved in a later round. Replies arriving after navigation remain bound to the source round/session. Old clients' `help` actions are read-only; new clients send `coach_reply` after a real response.

An on-device pending queue contains only identifiers and the authored caption question. A failed save retries before subsequent training actions, so a new plan cannot silently omit a locally pending Coach event. Existing historical difficulties are retained because old records cannot distinguish opening Coach from an actual conversation.

Migration: `20261006160432_training_difficult_practice_navigation.sql`.

Follow-up: `20261006164320_gate_training_unlock_on_difficulties.sql` updates both server unlock decisions. It changes only the existing private round function, with no data rewrite or new permissions. The application reads the existing owner-restricted difficulty records alongside roadmap/history progress and also guards against stale server responses that return unlocked with pending difficulties.

- `training_level_difficulties` separates practical difficulty from quiz recall. Only the dog's owner can read it; client writes are denied. The existing guarded round action performs writes.
- `practice_level_ids` and `practice_cursor` freeze each round's practice order. Already-paid rounds retain their original order and current position.
- Existing unresolved review needs were imported as pending practical difficulties. Legacy records do not distinguish Help from an incorrect supplemental quiz answer. Resolved history is not reopened.
- A correct review answer can resolve a quiz struggle without clearing practical difficulty.
- Repeated Help in the same round does not inflate its round count. Stale Continue requests cannot settle the successor session.

The migration was applied to the configured PAWS database. Session count (138), round count (16), and Energy ledger count (72) were unchanged. Six pending practices were imported. No active round had an invalid current position after migration.

The follow-up was also applied. Existing pending records were verified through the real round RPC: all five affected lessons returned locked while retaining their nine difficulty records. Session count (154), round count (21), and Energy ledger count (77) were unchanged by this correction.

## Verification

### Conversation-based rearrangement (2026-10-12)

Migration `20261012185603_coach_conversation_adaptive_practice.sql` was applied to PAWS. Full-row hashes of all existing rounds, sessions, level progress, difficulties and Energy entries matched before/after; counts remained 25 rounds, 165 sessions and 80 ledger entries. The live planner returned 3, 4, 5 for the pending L4 case in 2-4, and 1, 2, 4 for the multiple-difficulty case in 2-3. Current paid plans were not rewritten. The new event table has RLS and no direct client insert permission; the advisor's guest-account policy notice is expected under the existing owner policy ([advisor explanation](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins)).

Validation: 196 lifecycle scenarios across all 28 lessons, 2,048 planner combinations (16,637 assertions), 23 focused Jest checks, and TypeScript passed. Scenarios cover no-op Coach opening, actual reply registration, multiple pending levels, frozen paid queues, replies after navigation/End, retry deduplication after resolution, and unchanged Continue success. The pre-existing legacy-checkpoint adoption exception remains outside this change; no such active checkpoint was present in the server audit.

### Adaptive end-level fix (2026-10-12)

The Clear Communication section could schedule reinforcement as L4 → L1 → L2. The RPC correctly stored the highest planned level, 4, but the old `training_rounds_end_level_check` only allowed 2, 3, or 5. Starting that round failed atomically; it did not spend Energy or save a partial session.

Migration `20261012181639_training_round_adaptive_end_level.sql` permits levels 1–5 while retaining the not-null requirement. Queue/cursor completion, ownership permissions, and RLS are unchanged. Applied to the configured PAWS database; sessions/rounds/Energy ledger counts stayed 165/25/80 and no new security advisor findings appeared.

The SQL harness now passes 161 assertions, including reproduction before the migration, successful L4 reinforcement afterward, three-step completion, duplicate Start/Continue protection, unchanged original progress, and rejection of out-of-range end levels. TypeScript passed.

### Previous verification

- 141 local SQL assertions against the migration chain passed, covering queue selection, difficulty lifecycle, L5 with unresolved difficulty, repeated Help through three rounds followed by a successful fourth, idempotency, Energy, progress, and ownership permissions.
- Fifteen targeted Jest tests for navigation, round responses, unlock rules, and difficulty mapping to roadmap/history passed; TypeScript passed. Cases include a fresh 3, 4, 5 round, resumed progress, nonconsecutive reinforcement order, preserving lifetime progress, and refusing to claim completion when difficulty loading fails.
- Browser verification used the existing flow preview: the bar contained three practices, advancing enabled the next one, revisiting and Continue returned to the current practice, and future practices stayed disabled. The earlier integration check also verified opening and returning from the existing Coach.
- Latest development-server iOS manifest and bundle returned HTTP 200. No native dependency changed; reload the installed development build. Physical iPhone interaction has not been verified in this change.
- Database advisors gained only the expected anonymous-sign-in policy notice for the new table. PAWS supports authenticated guest users; `owns_dog(dog_id)` still restricts them to their own dog. Cross-owner access and direct client writes were tested as denied. See [the Supabase advisor explanation](https://supabase.com/docs/guides/database/database-advisors?queryGroups=lint&lint=0012_auth_allow_anonymous_sign_ins).
