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

## MVP Limitations (Phase 1)

- **No backend tables deployed.** The mobile app uses mock data (see `src/data/tournaments/mockTournaments.ts`) when the table is missing.
- **Join is not wired.** `joinTournament` in `tournamentService.ts` returns a "backend not configured" message. The SQL migration `0041_tournaments.sql` contains the RPC but it has not been applied.
- **Submit Attempt is a placeholder.** The tournament detail screen shows a disabled `Submit Attempt` button that explains the backend is not ready.
- **No real leaderboard.** Uses static mock data.
- **No prize payout from mobile.** All prize settlement is backend/admin-only.

## Phase 2 Plans

1. Apply migration `0041_tournaments.sql` to the Supabase project.
2. Wire `joinTournament` service method to the `join_tournament` RPC.
3. Wire `Submit Attempt` to the existing challenge game recording flow (`/game/[gameId]/play`), creating a `tournament_attempts` row on submission.
4. Connect Gemini/admin review for tournament attempts.
5. Implement `admin_settle_tournament` with prize payout.
6. Build admin tournament management UI.
7. Add push notification for tournament status changes.