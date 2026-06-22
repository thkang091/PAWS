"""
Data models for the hybrid verification pipeline.

Hybrid verification combines pose-classifier scores with optional RGB visual
verification and an anomaly score to produce a fused result.  The routing
decision determines whether a given attempt runs on the fast pose-only path
or the hybrid path.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


# ---------------------------------------------------------------------------
# Verification tiers
# ---------------------------------------------------------------------------

class VerificationTier:
    """String constants for the five supported verification tiers."""

    STANDARD_DAILY = "standard_daily"
    PREMIUM_CHALLENGE = "premium_challenge"
    GOLD_COIN_REWARD = "gold_coin_reward"
    TOURNAMENT = "tournament"
    MANUAL_REVIEW = "manual_review"

    ALL: frozenset[str] = frozenset({
        STANDARD_DAILY,
        PREMIUM_CHALLENGE,
        GOLD_COIN_REWARD,
        TOURNAMENT,
        MANUAL_REVIEW,
    })

    # Tiers that require stricter fusion thresholds and mandatory hybrid.
    HIGH_STAKES: frozenset[str] = frozenset({GOLD_COIN_REWARD, TOURNAMENT})

    @classmethod
    def is_valid(cls, tier: str) -> bool:
        return tier in cls.ALL


# Minimum fused confidence required to produce a "passed" result, by tier.
TIER_PASS_THRESHOLDS: dict[str, float] = {
    VerificationTier.STANDARD_DAILY:     0.72,
    VerificationTier.PREMIUM_CHALLENGE:  0.75,
    VerificationTier.GOLD_COIN_REWARD:   0.80,
    VerificationTier.TOURNAMENT:         0.82,
    VerificationTier.MANUAL_REVIEW:      0.85,
}

# For high-stakes tiers: borderline attempts (>= pass threshold but < this)
# are routed to manual review instead of being auto-passed.
TIER_MANUAL_REVIEW_THRESHOLDS: dict[str, float] = {
    VerificationTier.GOLD_COIN_REWARD:  0.88,
    VerificationTier.TOURNAMENT:        0.90,
}


# ---------------------------------------------------------------------------
# Routing decision
# ---------------------------------------------------------------------------

RoutingPath = Literal["fast_pose", "hybrid", "direct_manual_review"]


class RoutingDecision(BaseModel):
    """Describes which verification path to take and why."""

    path: RoutingPath
    reasons: list[str]


# ---------------------------------------------------------------------------
# Attempt history summary (passed in from caller, not computed here)
# ---------------------------------------------------------------------------

class AttemptHistorySummary(BaseModel):
    """
    Lightweight summary of prior attempts for the same user + activity.
    Populated by the caller from user-activity history; not stored in this
    service.
    """

    total_attempts: int = 0
    recent_pass_rate: float = 0.0   # 0-1 over last 30 days
    consecutive_failures: int = 0
    flagged_previously: bool = False


# ---------------------------------------------------------------------------
# Hybrid verification input
# ---------------------------------------------------------------------------

class HybridVerificationInput(BaseModel):
    """
    All inputs collected before the hybrid verifier runs.

    pose_classifier_result is the ActivityAnalysisResponse from the upstream
    pose classifier.  quality_flags is the PoseQualityFlags.model_dump() dict
    produced by pose_quality_service.
    """

    model_config = ConfigDict(arbitrary_types_allowed=True)

    verification_id: str
    activity_id: str
    tier: str
    pose_confidence: float
    pose_classifier_status: str     # "passed", "failed", "retry_uncertain", ...
    quality_flags: dict             # PoseQualityFlags as dict
    multiple_dogs_detected: bool
    recording_metadata: dict        # arbitrary recording context
    selected_frame_paths: list[str] = []    # storage paths to sampled RGB frames
    dog_crop_path: str | None = None
    attempt_history: AttemptHistorySummary | None = None
    requested_trick: str = ""
    requested_combo_sequence: list[str] = []

    @field_validator("tier")
    @classmethod
    def _valid_tier(cls, v: str) -> str:
        if not VerificationTier.is_valid(v):
            raise ValueError(
                f"Unknown verification tier '{v}'. "
                f"Valid values: {sorted(VerificationTier.ALL)}"
            )
        return v


# ---------------------------------------------------------------------------
# RGB verification result
# ---------------------------------------------------------------------------

class RGBVerificationResult(BaseModel):
    """
    Output of an RGB visual verifier.

    All scores are in [0, 1].  Higher is more confident / more concerning
    depending on the metric.
    """

    model_config = ConfigDict(protected_namespaces=())

    # Core visual assessment.
    visual_confidence: float    # trick clearly and correctly executed
    occlusion_score: float      # fraction of dog body occluded or off-frame

    # Integrity indicators.
    assistance_likelihood: float    # probability of human assistance
    multiple_dog_score: float       # probability that >1 dog is present
    fraud_risk_score: float         # composite fraud indicator

    # Provenance.
    provider: str           # e.g. "stub", "openai_vision_v1", "custom_cnn_v2"
    model_version: str
    latency_ms: int
    notes: str | None = None


# ---------------------------------------------------------------------------
# Fusion weights
# ---------------------------------------------------------------------------

class FusionWeights(BaseModel):
    """
    Relative weights used when combining pose, RGB, and quality scores.
    Must sum to 1.0 within the three primary weights; anomaly_penalty is
    applied as a multiplicative discount (0 = no penalty, 1 = zero out score).
    """

    pose: float = 0.55
    rgb: float = 0.30
    quality: float = 0.15
    anomaly_penalty: float = 0.40   # max fractional reduction from anomaly

    @field_validator("pose", "rgb", "quality")
    @classmethod
    def _in_unit_range(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError("Weight must be in [0, 1].")
        return v


DEFAULT_FUSION_WEIGHTS = FusionWeights()


# ---------------------------------------------------------------------------
# Fused verification result
# ---------------------------------------------------------------------------

class FusedVerificationResult(BaseModel):
    """
    Final output of the hybrid verification pipeline.

    final_status maps to ActivityAnalysisResponse.status:
      "passed"          -> "passed"
      "failed"          -> "failed"
      "retry"           -> "retry_uncertain"
      "manual_review"   -> "pending_manual_review"
    """

    model_config = ConfigDict(protected_namespaces=())

    final_status: Literal["passed", "failed", "retry", "manual_review"]
    pose_score: float
    rgb_score: float | None         # None when fast_pose path or RGB failure
    quality_score: float
    anomaly_score: float
    fused_confidence: float
    routing_path: RoutingPath
    tier: str
    tier_policy_applied: str | None # human-readable description of policy that fired
    enqueue_reason: str | None      # set when final_status == "manual_review"
    audit_id: str | None            # DB row id written by audit_log_service
    rgb_provider: str | None        # which RGB provider was used (or None)
    rgb_model_version: str | None
    routing_reasons: list[str]      # reasons the router chose this path
