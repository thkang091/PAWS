"""
Data models for production monitoring and model registry.

ModelRegistryEntry   — describes a versioned model artifact.
ModelMetricsSnapshot — point-in-time metrics for one model version.
TrickMetricsSnapshot — per-activity_id metrics.
DeviceMetricsRecord  — on-device pose extraction telemetry.
AlertEvent           — a single fired alert.
AlertThresholds      — configurable thresholds (from Settings or defaults).
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Component types
# ---------------------------------------------------------------------------

class ComponentType:
    POSE_CLASSIFIER        = "pose_classifier"
    LEARNED_SIT_CLASSIFIER = "learned_sit_classifier"
    RGB_VERIFIER           = "rgb_verifier"
    TRICK_CLASSIFIER       = "trick_classifier"
    COMBO_CLASSIFIER       = "combo_classifier"
    ON_DEVICE_POSE         = "on_device_pose"

    ALL: frozenset[str] = frozenset({
        POSE_CLASSIFIER,
        LEARNED_SIT_CLASSIFIER,
        RGB_VERIFIER,
        TRICK_CLASSIFIER,
        COMBO_CLASSIFIER,
        ON_DEVICE_POSE,
    })


# ---------------------------------------------------------------------------
# Model registry
# ---------------------------------------------------------------------------

class ModelRegistryEntry(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str | None = None
    model_version: str
    component_type: str
    artifact_path: str
    training_dataset_hash: str | None = None
    active: bool
    rollout_percentage: float            # 0.0 – 100.0
    rollback_version: str | None = None  # version to restore on rollback
    deployed_at: str | None = None
    promoted_by: str | None = None
    notes: str | None = None
    created_at: str | None = None


class PromoteModelRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    component_type: str
    artifact_path: str
    training_dataset_hash: str | None = None
    rollout_percentage: float = 100.0
    notes: str | None = None
    promoted_by: str


class RollbackRequest(BaseModel):
    component_type: str
    reason: str
    rolled_back_by: str


class UpdateRolloutRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    component_type: str
    new_percentage: float
    updated_by: str


class DisableComponentRequest(BaseModel):
    component_type: str
    reason: str
    disabled_by: str


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

class ConfidenceHistogram(BaseModel):
    """Ten equal-width buckets covering [0.0, 1.0].
    Keys are formatted as '0.0-0.1', '0.1-0.2', ..., '0.9-1.0'.
    """
    buckets: dict[str, int]

    @classmethod
    def empty(cls) -> "ConfidenceHistogram":
        keys = [f"{i/10:.1f}-{(i+1)/10:.1f}" for i in range(10)]
        return cls(buckets={k: 0 for k in keys})

    def record(self, confidence: float) -> None:
        idx = min(int(confidence * 10), 9)
        key = f"{idx/10:.1f}-{(idx+1)/10:.1f}"
        self.buckets[key] = self.buckets.get(key, 0) + 1


class ModelMetricsSnapshot(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    model_version: str
    component_type: str
    window_seconds: int              # seconds the counters cover (0 = since startup)
    total_attempts: int
    pass_rate: float
    fail_rate: float
    retry_rate: float
    error_rate: float
    fallback_rate: float
    manual_review_rate: float
    fraud_review_rate: float
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    avg_confidence: float
    low_quality_rate: float
    disagreement_rate: float
    confidence_histogram: dict[str, int]


class TrickMetricsSnapshot(BaseModel):
    activity_id: str
    total_attempts: int
    pass_rate: float
    retry_rate: float
    manual_review_rate: float
    avg_confidence: float
    false_positive_estimate: float | None = None  # filled from reviewed labels
    false_negative_estimate: float | None = None


class DeviceMetricsRecord(BaseModel):
    verification_id: str
    user_id: str
    iphone_model: str | None = None
    ios_version: str | None = None
    app_version: str | None = None
    on_device_pose_version: str | None = None
    frame_inference_latency_ms: float | None = None
    dropped_frame_rate: float | None = None
    payload_size_bytes: int | None = None
    fell_back_to_video: bool = False


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------

class AlertType:
    LATENCY_REGRESSION          = "latency_regression"
    ERROR_RATE_INCREASE         = "error_rate_increase"
    FALLBACK_RATE_SPIKE         = "fallback_rate_spike"
    PASS_RATE_SPIKE             = "pass_rate_spike"
    PASS_RATE_COLLAPSE          = "pass_rate_collapse"
    LOW_CONFIDENCE_SPIKE        = "low_confidence_spike"
    FRAUD_REVIEW_RATE_HIGH      = "fraud_review_rate_high"
    SCHEMA_INCOMPATIBILITY      = "schema_incompatibility"


class AlertLevel:
    WARNING  = "warning"
    CRITICAL = "critical"


class AlertEvent(BaseModel):
    alert_type: str
    level: str
    model_version: str | None
    metric_name: str
    observed_value: float
    threshold: float
    message: str
    triggered_at: str


class AlertThresholds(BaseModel):
    """Thresholds for alert evaluation. All rates are 0.0 – 1.0."""

    # Latency (milliseconds)
    latency_warning_ms: float  = 2000.0
    latency_critical_ms: float = 5000.0

    # p95 latency
    p95_latency_warning_ms: float  = 4000.0
    p95_latency_critical_ms: float = 8000.0

    # Error rate
    error_rate_warning:  float = 0.05
    error_rate_critical: float = 0.10

    # Fallback rate
    fallback_rate_warning:  float = 0.15
    fallback_rate_critical: float = 0.30

    # Pass-rate change (absolute delta, requires baseline)
    pass_rate_spike_delta:    float = 0.15
    pass_rate_collapse_delta: float = 0.20

    # Low-quality recording rate
    low_quality_warning: float = 0.25

    # Fraud-review rate
    fraud_review_rate_warning: float = 0.10

    # Schema incompatibility: error rate climbs this fast after a new deploy
    schema_incompatibility_error_rate: float = 0.05
