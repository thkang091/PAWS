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

## Current State (Phase 2B)

- **Reads are live.** Visible events, the owner's entry, and the field-limited leaderboard projection are read from Supabase. There is no mobile mock fallback.
- **Join is live through one RPC.** `joinTournament` calls the authenticated `join_tournament` RPC with an idempotency key. Entry creation, the ledger-backed entry fee, and `participant_count` update are atomic. The mobile app still has no direct table-write access.
- **Submit Attempt is a placeholder.** The tournament detail screen does not route into the challenge recording flow yet.
- **Leaderboard rows are backend-controlled.** Mobile reads ranked rows from `list_tournament_leaderboard` and never writes scores or ranks.
- **No prize payout from mobile.** All prize settlement remains backend/admin/service-role-only.

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

1. Wire `Submit Attempt` to the existing challenge game recording flow with an explicit tournament context.
2. Create tournament attempts only through a secure backend/RPC boundary.
3. Connect Gemini/admin review for tournament attempts.
4. Implement `admin_settle_tournament` with idempotent prize payout.
5. Build admin tournament management UI.
6. Add push notification for tournament status changes.
