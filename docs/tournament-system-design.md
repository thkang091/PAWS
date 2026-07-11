# Tournament System Design

## Product Goal

Tournaments are operator/admin-opened competitive events where owners submit challenge videos and compete for ranked prizes. The system is designed so the mobile app never directly awards prizes, settles rankings, or mutates final results.

## User Flow

1. **Admin creates tournament** (via future admin dashboard) — sets title, challenge, entry fee, prizes, registration window, active period.
2. **Registration open** — Users browse visible tournaments on the Game tab → Tournament view.
3. **User joins** — Pay entry fee (silver or gold) via the `join_tournament` secure RPC. Fee deducted from wallet ledger. One entry per dog per tournament.
4. **Registration closes** — No new entries accepted.
5. **Active period** — Users submit video attempts. Each attempt is verified (backend/Gemini/backend). Best score counts.
6. **Reviewing** — Admin reviews high-value/ranked attempts.
7. **Settled** — Admin finalizes placements, awards prizes. Only 1st/2nd/3rd receive prizes. Mobile reads results only.

## Tournament Statuses

| Status | Meaning | User Action |
|---|---|---|
| `draft` | Admin editing | Not visible |
| `scheduled` | Future event | Visible, countdown shown |
| `registration_open` | Join window active | Join, pay fee |
| `registration_closed` | Join window passed | Wait for active period |
| `active` | Submissions open | Submit attempts |
| `reviewing` | Admin reviewing results | Await settlement |
| `settled` | Complete, prizes awarded | View results |
| `cancelled` | Aborted | Not visible in active list |

## Mobile Responsibilities

- Show visible/published tournament events.
- Show leaderboard (read-only).
- Show user's own entry status and attempts.
- Allow joining via `join_tournament` RPC (idempotent, ledger-backed).
- Allow submitting video attempts (routes to existing challenge recording flow in Phase 2).

### Forbidden on Mobile

- Creating PASS/FAIL/NEEDS_REVIEW verdicts for tournament attempts.
- Settling tournament results or finalizing placements.
- Awarding prize gold/silver.
- Directly mutating wallet balances or final scores.
- Exposing service-role keys, admin keys, Gemini keys, or provider secrets.

## Backend / Admin Responsibilities

- Create and manage tournament events.
- Change tournament statuses (open registration → close → start → settle).
- Settle tournament results — rank entries, award 1st/2nd/3rd prizes.
- Review and verify ranked/high-value attempts.
- Award prize payouts through secure server-side RPCs (future).

## Tables (Migration 0041)

### `tournament_events`
- `id`, `title`, `description`, `status`, `challenge_game_id`
- `registration_opens_at`, `registration_closes_at`, `starts_at`, `ends_at`
- `entry_currency` (silver_coin / gold_coin), `entry_cost`
- `max_participants`, `participant_count`, `max_attempts_per_entry`
- `prize_first`, `prize_second`, `prize_third`
- RLS: All authenticated users may read visible statuses. Admin/operator only may write.

### `tournament_entries`
- `id`, `tournament_id`, `dog_id`, `owner_id`, `status`
- `attempts_used`, `best_score`, `current_rank`
- `idempotency_key` (unique, prevents double-join)
- RLS: Owner read only. Leaderboard: entries with `current_rank is not null` readable by all authenticated.

### `tournament_attempts`
- `id`, `entry_id`, `tournament_id`, `dog_id`, `owner_id`
- `submission_id` (link to video submission), `score`, `verdict`, `reviewed_at`
- RLS: Owner read only.

### Secure RPC: `join_tournament`
- Guards: auth required, owns_dog, registration_open status, not full, not already joined.
- Deducts entry fee through wallet_transactions (idempotent via request_key).
- Increments `participant_count`.
- Returns entry + updated wallet summary.

### service_role Only (Future)
- `admin_settle_tournament(tournament_id)` — ranks entries, awards prizes.
- Prize payout functions — create wallet transactions for 1st/2nd/3rd place.

## Security Boundaries

| Action | Allowed Caller |
|---|---|
| Read visible tournaments | Any authenticated user |
| Read own entry | Entry owner |
| Read leaderboard (ranked entries) | Any authenticated user |
| Join tournament (pay fee) | Dog owner via secure RPC |
| Submit attempt | Entry owner (Phase 2) |
| Change tournament status | Admin / service_role |
| Settle rankings | Admin / service_role |
| Award prizes | Admin / service_role |

## Current State (Phase 2C)

- **Reads are live.** Visible events, the owner's entry, and the field-limited leaderboard projection are read from Supabase. There is no mobile mock fallback.
- **Join is live through one RPC.** `joinTournament` calls the authenticated `join_tournament` RPC with an idempotency key. Entry creation, the ledger-backed entry fee, and `participant_count` update are atomic. The mobile app still has no direct table-write access.
- **Submit Attempt uses the existing recorder.** A signed Tournament context is not trusted by itself: dedicated RPCs re-check the authenticated owner, entry, challenge game, active window, upload, and attempt limit before linking a submission.
- **Every attempt uses real verification.** `verify-training-video` validates the Tournament attempt context, runs Gemini, and calls the service-role-only verification ingestion RPC.
- **Every result requires admin review.** Even an automated PASS remains `pending_review`. During the active period, PASS confidence multiplied by 100 is shown only as a provisional technical score; it is not represented as a final performance score.
- **Ranks are backend-controlled.** The backend recomputes each entry's best eligible score and deterministic provisional rank. Final ranks use only admin-approved `final_score` values.
- **Finalization is guarded.** `admin_finalize_tournament_ranks` requires `reviewing` status and refuses to run while any submitted or pending-review attempt remains.
- **No prize payout from mobile.** All prize settlement remains backend/admin/service-role-only.

## Attempt And Review Flow

1. Mobile records through the existing challenge camera with `tournamentId` context.
2. `prepare_tournament_video_submission` creates a clean pending submission after validating the owner, entry, event, challenge, window, and attempt allowance.
3. Mobile uploads to the private `dog-activity-videos` bucket.
4. `complete_tournament_video_upload` records the owned Storage path.
5. `submit_tournament_attempt` links that submission and atomically increments `attempts_used`.
6. `verify-training-video` runs the trusted Gemini verification.
7. `record_tournament_verification` stores the result as `pending_review` and recomputes provisional ranks.
8. A trusted admin server calls `admin_review_tournament_attempt` for every item.
9. After the event moves to `reviewing`, the admin server calls `admin_finalize_tournament_ranks`.

Technical verification failures also enter `pending_review`; they cannot silently
disappear from the finalization gate.

## Admin Review SQL (Development Only)

List the queue from SQL Editor:

```sql
select *
from public.admin_list_tournament_review_queue('TOURNAMENT_ID');
```

The queue includes both verified `pending_review` attempts and unverified
`submitted` attempts that were interrupted by a technical failure. A
`submitted` attempt can only be rejected; it cannot receive an approved score.

Approve with an explicitly reviewed score:

```sql
select public.admin_review_tournament_attempt(
  'ATTEMPT_ID',
  'approve',
  88.50,
  'Reviewed complete attempt and framing.',
  null
);
```

Reject an invalid attempt:

```sql
select public.admin_review_tournament_attempt(
  'ATTEMPT_ID',
  'reject',
  null,
  'Required action was not completed.',
  null
);
```

When submissions are closed, move the event to `reviewing`, confirm the queue is
empty, and finalize ranks:

```sql
update public.tournament_events
set status = 'reviewing'
where id = 'TOURNAMENT_ID' and status = 'active';

select public.admin_finalize_tournament_ranks('TOURNAMENT_ID', null);
```

These calls belong in a service-role admin backend in production. The consumer
app cannot execute them.

## Opening a Tournament Before the Admin Dashboard Exists

A developer/operator creates or updates `public.tournament_events` from the
Supabase SQL Editor, or preferably from a trusted server using the service-role
key. Never put that key in the Expo app and never grant event writes to
`authenticated` users.

1. Choose an existing `challenge_games.id`.
2. Insert a `draft` event with valid registration and active-period timestamps,
   entry cost, capacity, attempt limit, and all three prize descriptions.
3. Review the row, then change `status` to `registration_open` only when
   `registration_opens_at <= now() < registration_closes_at`.
4. Move status through `registration_closed`, `active`, `reviewing`, and
   `settled` from trusted admin tooling as operations complete.

`participant_count`, entries, wallet fees, scores, ranks, and payouts must not
be edited manually as part of opening an event.

## Remaining Phase 2 Plans

1. Implement `admin_settle_tournament` with idempotent prize payout.
2. Build admin tournament management UI around the existing review RPCs.
3. Replace the confidence-based provisional technical score with a calibrated, challenge-specific performance rubric before competitive production launch.
4. Add push notification for tournament status changes.
