"""
Alert evaluation service.

Stateless, pure-function evaluation of metric snapshots against configurable
thresholds.  No external dependencies (no webhook, no PagerDuty) — alerts are
returned as AlertEvent objects and logged as structured events.  The admin API
at GET /admin/alerts calls evaluate_all() and persists fired alerts to
alert_log.

Alerts defined
--------------
  latency_regression       — avg or p95 latency exceeds threshold.
  error_rate_increase      — error_rate exceeds threshold.
  fallback_rate_spike      — fallback_rate exceeds threshold.
  pass_rate_spike          — pass_rate rose by > delta vs. baseline.
  pass_rate_collapse       — pass_rate fell by > delta vs. baseline.
  low_confidence_spike     — low_quality_rate exceeds threshold.
  fraud_review_rate_high   — fraud_review_rate exceeds threshold.
  schema_incompatibility   — error_rate spiked AND error_rate > threshold
                             (heuristic for new-version schema mismatch).
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.models.monitoring_models import (
    AlertEvent,
    AlertLevel,
    AlertThresholds,
    AlertType,
    ModelMetricsSnapshot,
)
from app.utils.logging import log_info, log_warn


def evaluate_alerts(
    snapshot: ModelMetricsSnapshot,
    baseline: ModelMetricsSnapshot | None,
    thresholds: AlertThresholds,
) -> list[AlertEvent]:
    """
    Evaluate one model's snapshot against thresholds.

    Parameters
    ----------
    snapshot:
        Current metrics for a model version.
    baseline:
        A prior snapshot to compare against for rate-of-change alerts.
        If None, relative-change alerts are suppressed.
    thresholds:
        Configurable threshold values (usually from settings).

    Returns
    -------
    list[AlertEvent] — empty when no alerts fire.
    """
    # Skip evaluation if no meaningful data has been collected yet.
    if snapshot.total_attempts < 10:
        return []

    events: list[AlertEvent] = []
    now = datetime.now(timezone.utc).isoformat()

    # --- Latency regression ---
    if snapshot.avg_latency_ms >= thresholds.latency_critical_ms:
        events.append(_make_alert(
            alert_type=AlertType.LATENCY_REGRESSION,
            level=AlertLevel.CRITICAL,
            model_version=snapshot.model_version,
            metric_name="avg_latency_ms",
            observed=snapshot.avg_latency_ms,
            threshold=thresholds.latency_critical_ms,
            message=(
                f"Average inference latency {snapshot.avg_latency_ms:.0f}ms exceeds "
                f"critical threshold {thresholds.latency_critical_ms:.0f}ms "
                f"for {snapshot.model_version!r}."
            ),
            now=now,
        ))
    elif snapshot.avg_latency_ms >= thresholds.latency_warning_ms:
        events.append(_make_alert(
            alert_type=AlertType.LATENCY_REGRESSION,
            level=AlertLevel.WARNING,
            model_version=snapshot.model_version,
            metric_name="avg_latency_ms",
            observed=snapshot.avg_latency_ms,
            threshold=thresholds.latency_warning_ms,
            message=(
                f"Average inference latency {snapshot.avg_latency_ms:.0f}ms exceeds "
                f"warning threshold {thresholds.latency_warning_ms:.0f}ms "
                f"for {snapshot.model_version!r}."
            ),
            now=now,
        ))

    if snapshot.p95_latency_ms >= thresholds.p95_latency_critical_ms:
        events.append(_make_alert(
            alert_type=AlertType.LATENCY_REGRESSION,
            level=AlertLevel.CRITICAL,
            model_version=snapshot.model_version,
            metric_name="p95_latency_ms",
            observed=snapshot.p95_latency_ms,
            threshold=thresholds.p95_latency_critical_ms,
            message=(
                f"p95 latency {snapshot.p95_latency_ms:.0f}ms exceeds "
                f"critical threshold {thresholds.p95_latency_critical_ms:.0f}ms "
                f"for {snapshot.model_version!r}."
            ),
            now=now,
        ))
    elif snapshot.p95_latency_ms >= thresholds.p95_latency_warning_ms:
        events.append(_make_alert(
            alert_type=AlertType.LATENCY_REGRESSION,
            level=AlertLevel.WARNING,
            model_version=snapshot.model_version,
            metric_name="p95_latency_ms",
            observed=snapshot.p95_latency_ms,
            threshold=thresholds.p95_latency_warning_ms,
            message=(
                f"p95 latency {snapshot.p95_latency_ms:.0f}ms exceeds "
                f"warning threshold {thresholds.p95_latency_warning_ms:.0f}ms "
                f"for {snapshot.model_version!r}."
            ),
            now=now,
        ))

    # --- Error rate increase ---
    if snapshot.error_rate >= thresholds.error_rate_critical:
        events.append(_make_alert(
            alert_type=AlertType.ERROR_RATE_INCREASE,
            level=AlertLevel.CRITICAL,
            model_version=snapshot.model_version,
            metric_name="error_rate",
            observed=snapshot.error_rate,
            threshold=thresholds.error_rate_critical,
            message=(
                f"Error rate {snapshot.error_rate:.1%} exceeds critical threshold "
                f"{thresholds.error_rate_critical:.1%} for {snapshot.model_version!r}."
            ),
            now=now,
        ))
    elif snapshot.error_rate >= thresholds.error_rate_warning:
        events.append(_make_alert(
            alert_type=AlertType.ERROR_RATE_INCREASE,
            level=AlertLevel.WARNING,
            model_version=snapshot.model_version,
            metric_name="error_rate",
            observed=snapshot.error_rate,
            threshold=thresholds.error_rate_warning,
            message=(
                f"Error rate {snapshot.error_rate:.1%} exceeds warning threshold "
                f"{thresholds.error_rate_warning:.1%} for {snapshot.model_version!r}."
            ),
            now=now,
        ))

    # --- Fallback rate spike ---
    if snapshot.fallback_rate >= thresholds.fallback_rate_critical:
        events.append(_make_alert(
            alert_type=AlertType.FALLBACK_RATE_SPIKE,
            level=AlertLevel.CRITICAL,
            model_version=snapshot.model_version,
            metric_name="fallback_rate",
            observed=snapshot.fallback_rate,
            threshold=thresholds.fallback_rate_critical,
            message=(
                f"Fallback rate {snapshot.fallback_rate:.1%} exceeds critical "
                f"threshold {thresholds.fallback_rate_critical:.1%} "
                f"for {snapshot.model_version!r}."
            ),
            now=now,
        ))
    elif snapshot.fallback_rate >= thresholds.fallback_rate_warning:
        events.append(_make_alert(
            alert_type=AlertType.FALLBACK_RATE_SPIKE,
            level=AlertLevel.WARNING,
            model_version=snapshot.model_version,
            metric_name="fallback_rate",
            observed=snapshot.fallback_rate,
            threshold=thresholds.fallback_rate_warning,
            message=(
                f"Fallback rate {snapshot.fallback_rate:.1%} exceeds warning "
                f"threshold {thresholds.fallback_rate_warning:.1%} "
                f"for {snapshot.model_version!r}."
            ),
            now=now,
        ))

    # --- Low-confidence / low-quality spike ---
    if snapshot.low_quality_rate >= thresholds.low_quality_warning:
        events.append(_make_alert(
            alert_type=AlertType.LOW_CONFIDENCE_SPIKE,
            level=AlertLevel.WARNING,
            model_version=snapshot.model_version,
            metric_name="low_quality_rate",
            observed=snapshot.low_quality_rate,
            threshold=thresholds.low_quality_warning,
            message=(
                f"Low-quality recording rate {snapshot.low_quality_rate:.1%} "
                f"exceeds threshold {thresholds.low_quality_warning:.1%} "
                f"for {snapshot.model_version!r}."
            ),
            now=now,
        ))

    # --- Fraud review rate ---
    if snapshot.fraud_review_rate >= thresholds.fraud_review_rate_warning:
        events.append(_make_alert(
            alert_type=AlertType.FRAUD_REVIEW_RATE_HIGH,
            level=AlertLevel.WARNING,
            model_version=snapshot.model_version,
            metric_name="fraud_review_rate",
            observed=snapshot.fraud_review_rate,
            threshold=thresholds.fraud_review_rate_warning,
            message=(
                f"Fraud review rate {snapshot.fraud_review_rate:.1%} "
                f"exceeds threshold {thresholds.fraud_review_rate_warning:.1%} "
                f"for {snapshot.model_version!r}."
            ),
            now=now,
        ))

    # --- Schema incompatibility heuristic ---
    # Fires when error_rate is elevated AND the model has low total attempts,
    # suggesting a recently deployed version with a schema mismatch.
    if (
        snapshot.error_rate >= thresholds.schema_incompatibility_error_rate
        and snapshot.total_attempts < 50
    ):
        events.append(_make_alert(
            alert_type=AlertType.SCHEMA_INCOMPATIBILITY,
            level=AlertLevel.CRITICAL,
            model_version=snapshot.model_version,
            metric_name="error_rate",
            observed=snapshot.error_rate,
            threshold=thresholds.schema_incompatibility_error_rate,
            message=(
                f"High error rate {snapshot.error_rate:.1%} with only "
                f"{snapshot.total_attempts} attempts — possible schema "
                f"incompatibility in {snapshot.model_version!r}.  "
                f"Check logs and consider immediate rollback."
            ),
            now=now,
        ))

    # --- Pass-rate change (requires baseline) ---
    if baseline is not None and baseline.total_attempts >= 10:
        delta = snapshot.pass_rate - baseline.pass_rate

        if delta >= thresholds.pass_rate_spike_delta:
            events.append(_make_alert(
                alert_type=AlertType.PASS_RATE_SPIKE,
                level=AlertLevel.WARNING,
                model_version=snapshot.model_version,
                metric_name="pass_rate",
                observed=snapshot.pass_rate,
                threshold=baseline.pass_rate + thresholds.pass_rate_spike_delta,
                message=(
                    f"Pass rate jumped from {baseline.pass_rate:.1%} to "
                    f"{snapshot.pass_rate:.1%} (+{delta:.1%}) for "
                    f"{snapshot.model_version!r}.  Investigate for threshold "
                    f"miscalibration or fraud."
                ),
                now=now,
            ))

        if (-delta) >= thresholds.pass_rate_collapse_delta:
            events.append(_make_alert(
                alert_type=AlertType.PASS_RATE_COLLAPSE,
                level=AlertLevel.CRITICAL,
                model_version=snapshot.model_version,
                metric_name="pass_rate",
                observed=snapshot.pass_rate,
                threshold=baseline.pass_rate - thresholds.pass_rate_collapse_delta,
                message=(
                    f"Pass rate dropped from {baseline.pass_rate:.1%} to "
                    f"{snapshot.pass_rate:.1%} ({delta:.1%}) for "
                    f"{snapshot.model_version!r}.  Possible model regression."
                ),
                now=now,
            ))

    # Log each fired alert.
    for event in events:
        _log_alert(event)

    return events


def evaluate_all(
    snapshots: list[ModelMetricsSnapshot],
    baselines: dict[str, ModelMetricsSnapshot],
    thresholds: AlertThresholds,
) -> list[AlertEvent]:
    """
    Evaluate alerts for every provided snapshot.

    Parameters
    ----------
    snapshots:
        Current snapshots for all tracked model versions.
    baselines:
        Map of model_version -> baseline snapshot for delta calculations.
    thresholds:
        Shared threshold configuration.
    """
    all_events: list[AlertEvent] = []
    for snapshot in snapshots:
        baseline = baselines.get(snapshot.model_version)
        all_events.extend(evaluate_alerts(snapshot, baseline, thresholds))
    return all_events


def persist_alerts(events: list[AlertEvent]) -> None:
    """Write fired alerts to alert_log.  Fire-and-forget."""
    if not events:
        return
    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        client = get_supabase()
        rows = [
            {
                "alert_type":     e.alert_type,
                "level":          e.level,
                "model_version":  e.model_version,
                "metric_name":    e.metric_name,
                "observed_value": e.observed_value,
                "threshold":      e.threshold,
                "message":        e.message,
            }
            for e in events
        ]
        client.table("alert_log").insert(rows).execute()
    except Exception:  # noqa: BLE001
        pass


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _make_alert(
    *,
    alert_type: str,
    level: str,
    model_version: str | None,
    metric_name: str,
    observed: float,
    threshold: float,
    message: str,
    now: str,
) -> AlertEvent:
    return AlertEvent(
        alert_type=alert_type,
        level=level,
        model_version=model_version,
        metric_name=metric_name,
        observed_value=observed,
        threshold=threshold,
        message=message,
        triggered_at=now,
    )


def _log_alert(event: AlertEvent) -> None:
    if event.level == AlertLevel.CRITICAL:
        log_warn(
            "alert_service",
            event.alert_type,
            alert_level=event.level,
            model_version=event.model_version,
            metric_name=event.metric_name,
            observed_value=round(event.observed_value, 4),
            threshold=event.threshold,
            message=event.message,
        )
    else:
        log_info(
            "alert_service",
            event.alert_type,
            alert_level=event.level,
            model_version=event.model_version,
            metric_name=event.metric_name,
            observed_value=round(event.observed_value, 4),
            threshold=event.threshold,
        )
