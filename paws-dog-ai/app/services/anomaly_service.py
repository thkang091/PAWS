"""
Anomaly scoring service.

Produces a scalar anomaly score in [0, 1] from recording metadata and
quality signals.  A higher score means the attempt looks more unusual
and is more likely to warrant hybrid verification or manual review.

This is intentionally lightweight:
  - No ML model.
  - No network calls.
  - Pure arithmetic on the signals already available.

A future version can replace this with a trained anomaly detector without
changing the calling interface.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.utils.logging import log_info


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------

@dataclass
class AnomalyReport:
    score: float                        # aggregate [0, 1]
    flags: list[str] = field(default_factory=list)   # triggered check names
    detail: dict = field(default_factory=dict)       # per-check raw values


# ---------------------------------------------------------------------------
# Thresholds (module-level, easy to override in tests)
# ---------------------------------------------------------------------------

_MIN_RECORDING_DURATION_S: float = 1.5     # below this is suspicious
_HIGH_MISSING_FRAME_RATIO: float = 0.60    # above this is suspicious
_HIGH_FRAUD_RISK_FLOOR: float = 0.70       # from prior RGB result (if any)
_VERY_SHORT_CLIP_S: float = 0.8            # hard floor — near certain bad recording


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def compute_anomaly_score(
    quality_flags: dict,
    multiple_dogs_detected: bool,
    recording_metadata: dict,
    attempt_history_summary: dict | None = None,
    prior_rgb_fraud_risk: float | None = None,
    verification_id: str | None = None,
) -> AnomalyReport:
    """
    Compute an anomaly score from available signals.

    Parameters
    ----------
    quality_flags:
        PoseQualityFlags.model_dump() dict.
    multiple_dogs_detected:
        True if the pose model detected overlapping skeletons.
    recording_metadata:
        Arbitrary dict from the request; checked for 'duration_seconds'.
    attempt_history_summary:
        Optional dict with 'consecutive_failures' and 'flagged_previously'.
    prior_rgb_fraud_risk:
        fraud_risk_score from a previously run RGBVerificationResult, if any.
    verification_id:
        Used for structured logging only.
    """
    flags: list[str] = []
    detail: dict = {}
    cumulative = 0.0

    # --- recording duration ---
    duration_s = float(recording_metadata.get("duration_seconds") or 0.0)
    detail["duration_seconds"] = duration_s
    if duration_s < _VERY_SHORT_CLIP_S:
        flags.append("very_short_recording")
        cumulative += 0.45
    elif duration_s < _MIN_RECORDING_DURATION_S:
        flags.append("short_recording")
        cumulative += 0.20

    # --- multiple dogs ---
    detail["multiple_dogs"] = multiple_dogs_detected
    if multiple_dogs_detected:
        flags.append("multiple_dogs")
        cumulative += 0.25

    # --- quality flags ---
    if quality_flags.get("inconsistent_frame_rate"):
        flags.append("inconsistent_frame_rate")
        cumulative += 0.15
        detail["inconsistent_fps"] = True

    if quality_flags.get("low_average_confidence"):
        flags.append("low_pose_confidence")
        cumulative += 0.10

    if quality_flags.get("excessive_missing_frames"):
        flags.append("excessive_missing_frames")
        cumulative += 0.10

    # --- suspicious timestamp gaps are tracked inside quality_report ---
    # We don't re-read them here; the inconsistent_frame_rate flag covers most
    # cases.  A future version can pass the raw gap list.

    # --- attempt history ---
    if attempt_history_summary:
        consec_fails = int(attempt_history_summary.get("consecutive_failures") or 0)
        detail["consecutive_failures"] = consec_fails
        if consec_fails >= 5:
            flags.append("high_consecutive_failures")
            cumulative += 0.15
        if attempt_history_summary.get("flagged_previously"):
            flags.append("previously_flagged")
            cumulative += 0.10

    # --- prior RGB fraud risk ---
    if prior_rgb_fraud_risk is not None:
        detail["prior_rgb_fraud_risk"] = prior_rgb_fraud_risk
        if prior_rgb_fraud_risk >= _HIGH_FRAUD_RISK_FLOOR:
            flags.append("high_rgb_fraud_risk")
            cumulative += 0.25

    # Clamp to [0, 1].
    score = min(1.0, max(0.0, cumulative))

    if flags and verification_id:
        log_info(
            "anomaly_service",
            "anomaly_flags_raised",
            verification_id=verification_id,
            score=round(score, 4),
            flags=flags,
        )

    return AnomalyReport(score=round(score, 4), flags=flags, detail=detail)
