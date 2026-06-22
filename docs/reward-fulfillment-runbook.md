# Reward Fulfillment Runbook

The mobile Gold Shop can create real pending redemption requests. It does not deliver coupons, gift cards, or physical goods automatically.

## Current Contract

- Users redeem active rewards through the secure `redeem_reward` RPC.
- Gold is deducted once through the wallet ledger.
- A `reward_redemptions` row is created with `status = requested`.
- Migration `0040_reward_fulfillment_admin_contract.sql` adds fulfillment metadata and a service-role-only RPC:

```sql
update_reward_redemption_fulfillment(
  target_redemption_id uuid,
  target_status redemption_status,
  provider_reference_value text default null,
  fulfillment_note_value text default null,
  rejection_reason_value text default null
)
```

This RPC is revoked from `anon` and `authenticated` and granted only to `service_role`.

## Manual Fulfillment Workflow

1. Admin dashboard lists `requested` redemptions.
2. Operator verifies the user, dog, reward, gold transaction, and suspicious activity.
3. Operator moves the redemption to `processing`.
4. Operator fulfills through the real provider or manual process.
5. Operator stores a provider reference or internal note.
6. Operator marks the redemption `fulfilled`.
7. If fulfillment cannot happen, operator marks it `rejected` with a reason.

## External Provider Workflow

A future provider integration should run only on a secure server:

1. Admin backend receives an approved redemption.
2. Backend calls provider API using provider credentials.
3. Backend stores only a safe provider reference, not secrets.
4. Backend updates status through `update_reward_redemption_fulfillment`.
5. Provider webhooks are verified cryptographically before changing status.
6. Every status change writes an audit log.

## Safety Rules

- Never put provider API keys in Expo.
- Never claim instant delivery until provider webhooks and retries are tested.
- Never refund or mint gold from the mobile app.
- Rejections need a clear reason.
- Fulfilled redemptions cannot be moved backward by the service-role RPC.
