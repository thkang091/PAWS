# PAWS Dog AI - Operations Runbook

This document describes how to safely diagnose and recover from production
incidents in the PAWS Dog AI service.

---

## Table of contents

1. [How to rollback the behavior classifier](#1-rollback-behavior-classifier)
2. [How to rollback the pose extractor](#2-rollback-pose-extractor)
3. [How to disable hybrid verification](#3-disable-hybrid-verification)
4. [How to disable on-device pose extraction](#4-disable-on-device-pose-extraction)
5. [How to inspect affected attempts](#5-inspect-affected-attempts)
6. [How to restore service safely after an incident](#6-restore-service-safely)
7. [Alert reference](#7-alert-reference)
8. [Admin API quick reference](#8-admin-api-quick-reference)

---

## 1. Rollback behavior classifier

### Symptoms

- Pass-rate collapse alert (CRITICAL)
- Error-rate increase alert
- Fallback-rate spike alert
- Schema incompatibility alert immediately after a new deployment

### Fastest path: set rollout to zero

The learned sit classifier is the only behavior classifier currently under a
rollout.  Set its rollout percentage to 0 to send all sit traffic back to the
rule-based classifier immediately.  No database changes are required.

**Via admin API:**

```
POST /admin/models/rollout
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json

{
  "model_version": "<current_learned_version>",
  "component_type": "learned_sit_classifier",
  "new_percentage": 0,
  "updated_by": "your-name"
}
```

This applies immediately to the running process.  No restart needed.

**Via environment variable (requires restart):**

```
LEARNED_SIT_ROLLOUT_PERCENTAGE=0
```

Restart the service container.  All users revert to rule-based within one
deploy cycle.

### Full rollback to previous version

If a version was previously promoted, it recorded a `rollback_version`.  Use
the rollback endpoint:

```
POST /admin/models/rollback
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json

{
  "component_type": "learned_sit_classifier",
  "reason": "Pass-rate collapse after v2 deploy",
  "rolled_back_by": "your-name"
}
```

If no rollback_version is recorded, promote a known-good version manually:

```
POST /admin/models/promote
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json

{
  "model_version": "sit_tcn_v1",
  "component_type": "learned_sit_classifier",
  "artifact_path": "artifacts/sit_tcn_v1",
  "rollout_percentage": 100,
  "promoted_by": "your-name",
  "notes": "Emergency rollback"
}
```

### Verify

After rollback:

1. Check `GET /admin/models` — learned_sit_classifier should show rollback version.
2. Check `GET /admin/metrics/learned_sit_classifier_<version>` — error rate should
   fall within minutes as new traffic flows through the rule-based classifier.
3. Monitor `GET /admin/alerts` for 10 minutes.

---

## 2. Rollback pose extractor

The pose extractor (DeepLabCut / SuperAnimal) is loaded at process startup.
There is no runtime hot-swap — a rollback requires a container image change
and restart.

### Steps

1. **Identify the previous image tag** in your container registry.
2. **Deploy the previous image** using your standard deployment pipeline.
3. **Update the registry** to reflect the rollback so history is accurate:
   ```
   POST /admin/models/rollback
   { "component_type": "pose_classifier", ... }
   ```
   (This updates the DB; the actual model is governed by the container image.)
4. **Verify** with `GET /health` — confirm `model_name` reflects the expected version.

### Symptoms requiring pose extractor rollback

- Error rate jumps immediately after a new image is deployed.
- Schema incompatibility alert: the new model emits keypoint names the
  classifier does not recognize.
- Confidence scores cluster near zero for all tricks.

### Mitigating before rollback

Set `hybrid_pose_confidence_threshold=0.0` in `.env` to route all attempts
through hybrid verification.  This buys time to diagnose while users still
receive a result.

---

## 3. Disable hybrid verification

Hybrid verification adds an RGB visual check for uncertain or high-stakes
attempts.  If the RGB provider is unreliable, disable it so the service falls
back to pose-only scoring.

### Via admin API

```
POST /admin/components/disable
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json

{
  "component_type": "rgb_verifier",
  "reason": "RGB provider returning 502s",
  "disabled_by": "your-name"
}
```

This sets `rgb_verifier_provider = "stub"` in the running process immediately.
The stub reflects pose_confidence as visual_confidence, so fusion math is
unchanged and users receive results without delay.

### Via environment variable (requires restart)

```
RGB_VERIFIER_PROVIDER=stub
```

### What changes when hybrid is disabled

- High-stakes tiers (gold_coin_reward, tournament) still receive hybrid routing,
  but the RGB score is the stub (mirrors pose confidence).
- Borderline attempts are decided on fused score with `rgb_weight` zeroed out
  and `pose_weight` renormalized to 1.0.

---

## 4. Disable on-device pose extraction

If clients are sending malformed payloads or if the on-device model has a
critical bug, disable on-device pose extraction.  The server will run full
pose inference on the uploaded video for all subsequent requests.

### Via admin API

```
POST /admin/components/disable
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json

{
  "component_type": "on_device_pose",
  "reason": "iOS 18.2 on-device model returning invalid joint coords",
  "disabled_by": "your-name"
}
```

This sets `on_device_pose_disabled = true` in the running process.  The
on-device service checks this flag and falls back to server inference.

### Client behavior when disabled

The client continues to upload video normally.  The `device_metadata` field
in the request is accepted but telemetry shows `fell_back_to_video = true`.

### Re-enabling

```
POST /admin/models/promote
{
  "model_version": "<corrected_version>",
  "component_type": "on_device_pose",
  "artifact_path": "...",
  "rollout_percentage": 10,
  "promoted_by": "your-name",
  "notes": "Re-enable after iOS 18.2 fix"
}
```

Start at 10% rollout and ramp up after verifying device metrics.

---

## 5. Inspect affected attempts

### Find attempts by model version

Query the `metric_events` table:

```sql
select *
from metric_events
where model_version = '<version>'
  and created_at > now() - interval '2 hours'
order by created_at desc
limit 100;
```

### Find attempts with high error rate

```sql
select activity_id, count(*) as total,
       sum(is_error::int)::float / count(*) as error_rate
from metric_events
where created_at > now() - interval '1 hour'
group by activity_id
order by error_rate desc;
```

### Find on-device fallbacks by device model

```sql
select iphone_model, count(*) as total,
       sum(fell_back_to_video::int)::float / count(*) as fallback_rate,
       avg(frame_inference_latency_ms) as avg_latency_ms
from device_metric_events
where created_at > now() - interval '6 hours'
group by iphone_model
order by fallback_rate desc;
```

### View anti-cheat audit queue

```
GET /anti-cheat/queue?decision=review&limit=50
Authorization: Bearer <ADMIN_API_KEY>
```

### View current active alerts

```
GET /admin/alerts
Authorization: Bearer <ADMIN_API_KEY>
```

---

## 6. Restore service safely

After resolving an incident, follow this sequence to restore full service:

1. **Verify the fix** — run the test suite: `.venv/bin/pytest tests/ -q`.
2. **Deploy at reduced rollout** — if the fix involves a new model version,
   promote at 5-10% rollout first.
3. **Monitor for 10 minutes** — check `GET /admin/alerts` and `GET /admin/metrics`.
4. **Ramp rollout** in 25% increments with 5 minutes between each step:
   ```
   POST /admin/models/rollout
   { ..., "new_percentage": 25, ... }
   ```
5. **Full traffic at 100%** only after metrics are stable.
6. **Update the model registry notes** to document the incident.

### Checklist before declaring resolved

- Error rate is below 5%.
- Fallback rate is below 15%.
- Pass rate is within +/- 10% of the pre-incident baseline.
- No CRITICAL alerts firing.
- At least one full ramp cycle observed without regressions.

---

## 7. Alert reference

| Alert type | Level | Condition | Action |
|---|---|---|---|
| latency_regression | WARNING | avg_latency > 2000ms | Investigate slow frames; scale pods |
| latency_regression | CRITICAL | avg_latency > 5000ms | Rollback or scale immediately |
| latency_regression | WARNING | p95_latency > 4000ms | Profile inference path |
| latency_regression | CRITICAL | p95_latency > 8000ms | Emergency rollback |
| error_rate_increase | WARNING | error_rate > 5% | Check logs for exception pattern |
| error_rate_increase | CRITICAL | error_rate > 10% | Rollback if coincides with deploy |
| fallback_rate_spike | WARNING | fallback_rate > 15% | Check learned model confidence distribution |
| fallback_rate_spike | CRITICAL | fallback_rate > 30% | Disable learned classifier rollout |
| pass_rate_spike | WARNING | pass_rate rose > 15% | Investigate threshold miscalibration |
| pass_rate_collapse | CRITICAL | pass_rate fell > 20% | Rollback classifier immediately |
| low_confidence_spike | WARNING | low_quality_rate > 25% | Check camera/lighting guidance |
| fraud_review_rate_high | WARNING | fraud_review_rate > 10% | Review anti-cheat queue |
| schema_incompatibility | CRITICAL | error_rate > 5% with < 50 attempts | Rollback immediately |

---

## 8. Admin API quick reference

All endpoints require `Authorization: Bearer <ADMIN_API_KEY>`.

| Endpoint | Description |
|---|---|
| `GET /admin/status` | Service health summary |
| `GET /admin/models` | Active model versions |
| `GET /admin/models/{type}/history` | Version history for a component |
| `POST /admin/models/promote` | Promote a new model version |
| `POST /admin/models/rollback` | Rollback to previous version |
| `POST /admin/models/rollout` | Update rollout percentage |
| `POST /admin/components/disable` | Disable all versions of a component |
| `GET /admin/metrics` | All model metrics (since startup) |
| `GET /admin/metrics/tricks` | Per-trick metrics |
| `GET /admin/metrics/devices` | On-device telemetry |
| `GET /admin/metrics/{version}` | Metrics for a specific version |
| `GET /admin/alerts` | Evaluate and return active alerts |
| `GET /admin/alerts/history` | Historical alert log |
| `GET /anti-cheat/queue` | Anti-cheat review queue |
| `GET /anti-cheat/account/{user_id}` | User risk profile |
| `POST /anti-cheat/{audit_id}/action` | Apply admin review action |
