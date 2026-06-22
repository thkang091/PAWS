"""
In-process metrics collector for the learned sit classifier rollout.

Counters are kept in memory for the lifetime of the process. They reset on
restart, so they are suitable for per-deployment dashboards and alerting, not
for long-term trend analysis (use structured logs for that).

All public functions are thread-safe.

Tracked per-inference outcomes (sit only):
  total            - all sit inferences (rule-based + rollout + shadow)
  passed           - status == "passed"
  failed           - status starts with "failed_"
  retry            - status starts with "retry_"
  fallback         - learned model was attempted but fell back to rule-based
  disagree         - learned and rule-based disagreed
  low_confidence   - learned confidence below learned_sit_min_confidence
  manual_review    - attempt was queued for manual review
  total_latency_ms - cumulative learned inference latency (for average)
  learned_inferences - number of times the learned model actually ran
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field


@dataclass
class _Counters:
    total: int = 0
    passed: int = 0
    failed: int = 0
    retry: int = 0
    fallback: int = 0
    disagree: int = 0
    low_confidence: int = 0
    manual_review: int = 0
    total_latency_ms: float = 0.0
    learned_inferences: int = 0


@dataclass
class MetricsSnapshot:
    total: int
    pass_rate: float
    fail_rate: float
    retry_rate: float
    fallback_rate: float
    disagree_rate: float
    low_confidence_rate: float
    manual_review_rate: float
    avg_latency_ms: float
    learned_inferences: int


_counters = _Counters()
_lock = threading.Lock()


def record(
    status: str,
    fallback: bool = False,
    disagrees: bool = False,
    low_confidence: bool = False,
    manual_review: bool = False,
    learned_latency_ms: float | None = None,
) -> None:
    """Record one inference outcome. Thread-safe. Never raises."""
    try:
        with _lock:
            _counters.total += 1
            if status == "passed":
                _counters.passed += 1
            elif status.startswith("failed"):
                _counters.failed += 1
            elif status.startswith("retry"):
                _counters.retry += 1
            if fallback:
                _counters.fallback += 1
            if disagrees:
                _counters.disagree += 1
            if low_confidence:
                _counters.low_confidence += 1
            if manual_review:
                _counters.manual_review += 1
            if learned_latency_ms is not None:
                _counters.total_latency_ms += learned_latency_ms
                _counters.learned_inferences += 1
    except Exception:  # noqa: BLE001
        pass


def get_snapshot() -> MetricsSnapshot:
    """Return a point-in-time snapshot. Thread-safe. Never raises."""
    try:
        with _lock:
            n = _counters.total or 1  # avoid divide-by-zero
            li = _counters.learned_inferences or 1
            return MetricsSnapshot(
                total=_counters.total,
                pass_rate=_counters.passed / n,
                fail_rate=_counters.failed / n,
                retry_rate=_counters.retry / n,
                fallback_rate=_counters.fallback / n,
                disagree_rate=_counters.disagree / n,
                low_confidence_rate=_counters.low_confidence / n,
                manual_review_rate=_counters.manual_review / n,
                avg_latency_ms=_counters.total_latency_ms / li,
                learned_inferences=_counters.learned_inferences,
            )
    except Exception:  # noqa: BLE001
        return MetricsSnapshot(
            total=0, pass_rate=0, fail_rate=0, retry_rate=0,
            fallback_rate=0, disagree_rate=0, low_confidence_rate=0,
            manual_review_rate=0, avg_latency_ms=0, learned_inferences=0,
        )


def reset() -> None:
    """Reset all counters to zero. Intended for tests only."""
    global _counters
    with _lock:
        _counters = _Counters()
