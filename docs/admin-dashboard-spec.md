# PAWS Admin Dashboard Spec

The admin dashboard must be a separate secure web app or backend console. Do not put admin controls inside the consumer Expo app.

## Security Boundary

- Service-role key is allowed only in server-side admin code.
- Never expose service-role key, admin API key, or provider fulfillment keys to the mobile app.
- Require admin authentication plus authorization.
- Audit every admin-sensitive action.
- Use server-side actions, protected API routes, or the existing `paws-dog-ai` admin/review APIs.
- Mobile users must never directly award gold, update game results, activate rewards, or fulfill redemptions.

## First Version Pages

### Overview

- Active submissions awaiting review
- Recent reward redemptions
- Suspicious repeated requests
- Recent RPC/model/upload failures
- Active game instances

### Users And Dogs

- Search users by ID/email when available
- View dogs, dog tags, onboarding status, account status
- View wallet transaction history
- View Bond XP history
- View DogMoment count and Storage paths without making media public

### Review Queue

Use `paws-dog-ai` review endpoints:

- `GET /review/queue`
- `GET /review/stats`
- `GET /review/{review_id}`
- `POST /review/{review_id}/label`
- `POST /review/{review_id}/skip`
- `POST /review/{review_id}/dispute`
- `POST /review/enqueue/{verification_id}`

Required UI:

- video/skeleton preview
- activity ID and dog ID
- model result and confidence
- quality/failure signals
- approve pass
- reject/fail
- send back for re-review
- notes

### Challenge Games

- Create and schedule game instances
- View attempts and statuses
- Review submissions
- Assign placement
- Settle attempts through server-side RPCs only
- Award gold only from trusted review/settlement actions

### Rewards And Fulfillment

- Activate/deactivate reward catalog items
- View pending redemption requests
- Mark processing/fulfilled/rejected
- Attach provider reference IDs
- Record manual fulfillment notes
- Never claim fulfillment before provider/manual confirmation

### Audit And Risk

- View `audit_logs`
- Filter by action type, user, dog, source entity
- View repeated idempotency attempts
- View anti-cheat decisions
- Restrict suspicious accounts from rewards when supported

## Minimum Backend Actions

The admin app needs protected server actions for:

- `reviewSubmission(reviewId, decision, notes)`
- `settleChallengeAttempt(attemptId, decision, score, notes)`
- `awardGold(dogId, amount, sourceEntityType, sourceEntityId, reason)`
- `updateRewardCatalog(rewardId, patch)`
- `updateRedemptionStatus(redemptionId, status, providerReference, notes)`
- `restrictAccount(userId, reason)`

Each action must:

- verify admin authorization
- write an audit log
- use idempotency keys where money/currency changes occur
- never trust client-provided wallet balances

## Suggested Stack

- Next.js or Remix web app
- Supabase server client with service-role key only on server
- Existing FastAPI `paws-dog-ai` review/admin endpoints
- Optional Sentry or equivalent error reporting
- Optional provider SDK for coupon/gift-card fulfillment

## Launch Criteria

- Admin login works
- Non-admin access is denied
- Review queue can approve/reject without exposing service-role key
- Gold awards create immutable wallet ledger rows
- Redemptions can move from requested to processing/fulfilled/rejected
- Every admin action creates an audit record
- Manual test confirms mobile clients cannot call admin actions
