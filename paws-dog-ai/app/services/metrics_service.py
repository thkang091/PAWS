"""
Comprehensive metrics collection service.

Tracks per-model-version, per-trick, and device-level metrics in memory for
fast reads, and persists to the metric_events / device_metric_events DB tables
fire-and-forget for historical analysis.

In-memory design
----------------
All counters are keyed by (model_version, component_type) or activity_id.
A fixed-size latency deque (last MAX_LATENCY_SAMPLES per key) enables
p50/p95 computation without storing unbounded data.

Thread safety
-------------
Every public function acquires the global lock.  Functions never raise.

Persistence
-----------
record_verification() writes one row to metric_events asynchronously.
record_device_metrics() writes one row to device_metric_events.
Both swallow all DB exceptions.
"""

from __future__ import annotations

import statistics
import threading
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from app.models.monitoring_models import (
    ConfidenceHistogram,
    ModelMetricsSnapshot,
    TrickMetricsSnapshot,
)
from app.utils.logging import log_error, log_info

if TYPE_CHECKING:
    from app.models.monitoring_models import DeviceMetricsRecord


MAX_LATENCY_SAMPLES = 1000  # per model version key

# ---------------------------------------------------------------------------
# Internal state
# ---------------------------------------------------------------------------

@dataclass
class _ModelCounters:
    total: int = 0
    passed: int = 0
    failed: int = 0
    retry: int = 0
    error: int = 0
    fallback: int = 0
    low_quality: int = 0
    manual_review: int = 0
    fraud_review: int = 0
    disagree: int = 0
    confidence_sum: float = 0.0
    confidence_count: int = 0
    histogram: ConfidenceHistogram = field(default_factory=ConfidenceHistogram.empty)


@dataclass
class _TrickCounters:
    total: int = 0
    passed: int = 0
    retry: int = 0
    manual_review: int = 0
    confidence_sum: float = 0.0
    confidence_count: int = 0


# Keyed by (model_version, component_type)
_model_counters: dict[tuple[str, str], _ModelCounters] = defaultdict(_ModelCounters)
# Latency samples keyed by (model_version, component_type)
_latency_samples: dict[tuple[str, str], deque] = defaultdict(lambda: deque(maxlen=MAX_LATENCY_SAMPLES))
# Keyed by activity_id
_trick_counters: dict[str, _TrickCounters] = defaultdict(_TrickCounters)

_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Public recording API
# ---------------------------------------------------------------------------

def record_verification(
    *,
    model_version: str,
    component_type: str,
    activity_id: str,
    tier: str,
    verification_id: str | None,
    status: str,
    confidence_score: float | None,
    inference_latency_ms: int | None,
    is_error: bool = False,
    is_fallback: bool = False,
    is_low_quality: bool = False,
    is_manual_review: bool = False,
    is_fraud_review: bool = False,
    disagreed: bool = False,
    used_on_device_pose: bool = False,
    fell_back_to_video: bool = False,
) -> None:
    """
    Record one verification outcome.  Updates in-memory counters and writes
    an async DB row.  Never raises.
    """
    try:
        key = (model_version, component_type)
        with _lock:
            c = _model_counters[key]
            c.total += 1
            if status == "passed":
                c.passed += 1
            elif status.startswith("failed"):
                c.failed += 1
            elif status.startswith("retry"):
                c.retry += 1
            if is_error:
                c.error += 1
            if is_fallback:
                c.fallback += 1
            if is_low_quality:
                c.low_quality += 1
            if is_manual_review:
                c.manual_review += 1
            if is_fraud_review:
                c.fraud_review += 1
            if disagreed:
                c.disagree += 1
            if confidence_score is not None:
                c.confidence_sum += confidence_score
                c.confidence_count += 1
                c.histogram.record(confidence_score)
            if inference_latency_ms is not None:
                _latency_samples[key].append(float(inference_latency_ms))

            t = _trick_counters[activity_id]
            t.total += 1
            if status == "passed":
                t.passed += 1
            elif status.startswith("retry"):
                t.retry += 1
            if is_manual_review:
                t.manual_review += 1
            if confidence_score is not None:
                t.confidence_sum += confidence_score
                t.confidence_count += 1
    except Exception:  # noqa: BLE001
        pass

    # Fire-and-forget DB write.
    _persist_metric_event(
        model_version=model_version,
        activity_id=activity_id,
        tier=tier,
        verification_id=verification_id,
        status=status,
        confidence_score=confidence_score,
        inference_latency_ms=inference_latency_ms,
        is_error=is_error,
        is_fallback=is_fallback,
        is_low_quality=is_low_quality,
        is_manual_review=is_manual_review,
        is_fraud_review=is_fraud_review,
        disagreed=disagreed,
        used_on_device_pose=used_on_device_pose,
        fell_back_to_video=fell_back_to_video,
    )


def record_device_metrics(record: "DeviceMetricsRecord") -> None:
    """
    Persist on-device telemetry to device_metric_events.  Never raises.
    """
    _persist_device_metric_event(record)


# ---------------------------------------------------------------------------
# Snapshot reads
# ---------------------------------------------------------------------------

def get_model_snapshot(model_version: str, component_type: str) -> ModelMetricsSnapshot:
    """Return a point-in-time metrics snapshot.  Never raises."""
    key = (model_version, component_type)
    try:
        with _lock:
            c = _model_counters[key]
            samples = list(_latency_samples[key])

        n = c.total or 1
        conf_n = c.confidence_count or 1

        p50, p95 = _percentiles(samples)

        return ModelMetricsSnapshot(
            model_version=model_version,
            component_type=component_type,
            window_seconds=0,
            total_attempts=c.total,
            pass_rate=c.passed / n,
            fail_rate=c.failed / n,
            retry_rate=c.retry / n,
            error_rate=c.error / n,
            fallback_rate=c.fallback / n,
            manual_review_rate=c.manual_review / n,
            fraud_review_rate=c.fraud_review / n,
            avg_latency_ms=(sum(samples) / len(samples)) if samples else 0.0,
            p50_latency_ms=p50,
            p95_latency_ms=p95,
            avg_confidence=c.confidence_sum / conf_n,
            low_quality_rate=c.low_quality / n,
            disagreement_rate=c.disagree / n,
            confidence_histogram=dict(c.histogram.buckets),
        )
    except Exception:  # noqa: BLE001
        return _empty_model_snapshot(model_version, component_type)


def get_all_model_snapshots() -> list[ModelMetricsSnapshot]:
    """Return snapshots for every model version that has recorded data."""
    try:
        with _lock:
            keys = list(_model_counters.keys())
        return [get_model_snapshot(mv, ct) for mv, ct in keys]
    except Exception:  # noqa: BLE001
        return []


def get_trick_snapshot(activity_id: str) -> TrickMetricsSnapshot:
    """Return per-trick metrics snapshot.  Never raises."""
    try:
        with _lock:
            t = _trick_counters[activity_id]
        n = t.total or 1
        conf_n = t.confidence_count or 1
        return TrickMetricsSnapshot(
            activity_id=activity_id,
            total_attempts=t.total,
            pass_rate=t.passed / n,
            retry_rate=t.retry / n,
            manual_review_rate=t.manual_review / n,
            avg_confidence=t.confidence_sum / conf_n,
        )
    except Exception:  # noqa: BLE001
        return TrickMetricsSnapshot(
            activity_id=activity_id,
            total_attempts=0,
            pass_rate=0.0,
            retry_rate=0.0,
            manual_review_rate=0.0,
            avg_confidence=0.0,
        )


def get_all_trick_snapshots() -> list[TrickMetricsSnapshot]:
    """Return snapshots for every trick that has recorded data."""
    try:
        with _lock:
            activity_ids = list(_trick_counters.keys())
        return [get_trick_snapshot(aid) for aid in activity_ids]
    except Exception:  # noqa: BLE001
        return []


def reset(model_version: str | None = None, component_type: str | None = None) -> None:
    """
    Reset counters.  If model_version and component_type are both given, resets
    only that key.  If both are None, resets all counters.  Intended for tests.
    """
    global _model_counters, _latency_samples, _trick_counters
    with _lock:
        if model_version is not None and component_type is not None:
            key = (model_version, component_type)
            _model_counters.pop(key, None)
            _latency_samples.pop(key, None)
        else:
            _model_counters = defaultdict(_ModelCounters)
            _latency_samples = defaultdict(lambda: deque(maxlen=MAX_LATENCY_SAMPLES))
            _trick_counters  = defaultdict(_TrickCounters)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _percentiles(samples: list[float]) -> tuple[float, float]:
    """Return (p50, p95) from a list of latency samples.  Empty list -> (0, 0)."""
    if not samples:
        return 0.0, 0.0
    sorted_s = sorted(samples)
    p50 = statistics.median(sorted_s)
    p95_idx = max(0, int(0.95 * len(sorted_s)) - 1)
    p95 = sorted_s[min(p95_idx, len(sorted_s) - 1)]
    return p50, p95


def _empty_model_snapshot(model_version: str, component_type: str) -> ModelMetricsSnapshot:
    return ModelMetricsSnapshot(
        model_version=model_version,
        component_type=component_type,
        window_seconds=0,
        total_attempts=0,
        pass_rate=0.0, fail_rate=0.0, retry_rate=0.0,
        error_rate=0.0, fallback_rate=0.0,
        manual_review_rate=0.0, fraud_review_rate=0.0,
        avg_latency_ms=0.0, p50_latency_ms=0.0, p95_latency_ms=0.0,
        avg_confidence=0.0, low_quality_rate=0.0, disagreement_rate=0.0,
        confidence_histogram=ConfidenceHistogram.empty().buckets,
    )


def _persist_metric_event(
    *,
    model_version: str,
    activity_id: str,
    tier: str,
    verification_id: str | None,
    status: str,
    confidence_score: float | None,
    inference_latency_ms: int | None,
    is_error: bool,
    is_fallback: bool,
    is_low_quality: bool,
    is_manual_review: bool,
    is_fraud_review: bool,
    disagreed: bool,
    used_on_device_pose: bool,
    fell_back_to_video: bool,
) -> None:
    """Fire-and-forget DB write.  Never raises."""
    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        row = {
            "model_version":        model_version,
            "activity_id":          activity_id,
            "tier":                 tier,
            "status":               status,
            "confidence_score":     confidence_score,
            "inference_latency_ms": inference_latency_ms,
            "is_error":             is_error,
            "is_fallback":          is_fallback,
            "is_low_quality":       is_low_quality,
            "is_manual_review":     is_manual_review,
            "is_fraud_review":      is_fraud_review,
            "disagreed":            disagreed,
            "used_on_device_pose":  used_on_device_pose,
            "fell_back_to_video":   fell_back_to_video,
        }
        if verification_id:
            row["verification_id"] = verification_id
        get_supabase().table("metric_events").insert(row).execute()
    except Exception as exc:  # noqa: BLE001
        log_error(
            "metrics_service",
            "persist_metric_event_failed",
            model_version=model_version,
            error=str(exc),
        )


def _persist_device_metric_event(record: "DeviceMetricsRecord") -> None:
    """Fire-and-forget DB write.  Never raises."""
    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        get_supabase().table("device_metric_events").insert({
            "verification_id":            record.verification_id,
            "user_id":                    record.user_id,
            "iphone_model":               record.iphone_model,
            "ios_version":                record.ios_version,
            "app_version":                record.app_version,
            "on_device_pose_version":     record.on_device_pose_version,
            "frame_inference_latency_ms": record.frame_inference_latency_ms,
            "dropped_frame_rate":         record.dropped_frame_rate,
            "payload_size_bytes":         record.payload_size_bytes,
            "fell_back_to_video":         record.fell_back_to_video,
        }).execute()
    except Exception as exc:  # noqa: BLE001
        log_error(
            "metrics_service",
            "persist_device_metric_failed",
            verification_id=record.verification_id,
            error=str(exc),
        )
