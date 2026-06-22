"""
Controlled rollout service for the learned Sit classifier.

Responsibilities
----------------
1. Deterministic user assignment into rollout buckets.
2. Running the learned model as primary (rollout mode) or observer (shadow mode).
3. Confidence-gated result translation:
     conf >= learned_sit_min_confidence         -> trust prediction
     [review_threshold, min_confidence)         -> retry_uncertain + queue
     conf < learned_sit_manual_review_threshold -> fall back to rule-based
4. Graceful fallback on any exception (missing artifact, torch unavailable, etc.)
5. Structured logging of classifier, model version, latency, and fallback reason.
6. Metrics recording via metrics_service.

Rollback procedure
------------------
Set LEARNED_SIT_ROLLOUT_PERCENTAGE=0 in .env and restart the process.
All users immediately revert to the rule-based classifier. No database changes
are required. The learned model is never called when rollout_percentage is 0.

This module never imports torch at module load time. The torch import is deferred
inside _run_learned_inference() so the service is importable even when torch is
not installed.
"""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field

from app.models.pose_models import PoseSequence
from app.models.request_models import ActivityAnalysisRequest
from app.models.response_models import ActivityAnalysisResponse
from app.utils.logging import log_error, log_info, log_warn

# Module-level model cache keyed by artifact_path.
_model_cache: dict[str, tuple] = {}


# ---------------------------------------------------------------------------
# Public dataclass for rollout metadata
# ---------------------------------------------------------------------------

@dataclass
class RolloutMeta:
    in_rollout: bool
    shadow_only: bool
    classifier_used: str          # "rule_based" | "learned" | "rule_based_fallback"
    model_version: str | None
    learned_latency_ms: int | None
    fallback_reason: str | None
    disagrees: bool
    learned_prediction: str | None
    learned_confidence: float | None
    queued_for_review: bool


# ---------------------------------------------------------------------------
# Deterministic rollout assignment
# ---------------------------------------------------------------------------

def is_user_in_rollout(user_id: str, rollout_percentage: float) -> bool:
    """
    Return True if user_id falls in the rollout bucket for rollout_percentage.

    Assignment is deterministic: the same user_id always maps to the same
    bucket (0-99). A percentage of 0.0 always returns False; 100.0 always
    returns True.

    Algorithm: SHA-256(user_id) -> take first 8 hex chars -> int base-16 % 100.
    """
    if rollout_percentage <= 0.0:
        return False
    if rollout_percentage >= 100.0:
        return True
    digest = hashlib.sha256(user_id.encode()).hexdigest()[:8]
    bucket = int(digest, 16) % 100
    return bucket < rollout_percentage


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def apply_rollout(
    request: ActivityAnalysisRequest,
    pose_summary: PoseSequence,
    rule_based_result: ActivityAnalysisResponse,
    artifact_path: str,
    min_confidence: float,
    review_threshold: float,
    rollout_percentage: float,
    shadow_mode: bool,
    fallback_enabled: bool,
) -> tuple[ActivityAnalysisResponse, RolloutMeta]:
    """
    Decide whether to use the learned or rule-based result.

    Returns (final_result, meta). Never raises.

    Decision tree:
      shadow_mode=True         -> run learned, log, return rule_based_result unchanged.
      rollout_percentage <= 0  -> skip learned entirely, return rule_based_result.
      user not in bucket       -> skip learned entirely, return rule_based_result.
      user in bucket           -> run learned:
        exception / load fail  -> fallback to rule_based_result, log reason
        conf < review_threshold & fallback_enabled -> fallback, queue for review
        conf < review_threshold & not fallback     -> retry_uncertain, queue for review
        [review_threshold, min_confidence)         -> retry_uncertain, queue for review
        conf >= min_confidence                     -> use learned result
    """
    in_rollout = is_user_in_rollout(request.user_id, rollout_percentage)
    run_learned = shadow_mode or in_rollout

    if not run_learned:
        meta = RolloutMeta(
            in_rollout=False,
            shadow_only=False,
            classifier_used="rule_based",
            model_version=None,
            learned_latency_ms=None,
            fallback_reason=None,
            disagrees=False,
            learned_prediction=None,
            learned_confidence=None,
            queued_for_review=False,
        )
        return rule_based_result, meta

    # Run the learned model.
    learned_prediction, learned_confidence, model_version, latency_ms, exc_msg = (
        _run_learned_inference(pose_summary, artifact_path)
    )

    # Failed to run at all.
    if learned_prediction is None:
        meta = RolloutMeta(
            in_rollout=in_rollout,
            shadow_only=shadow_mode,
            classifier_used="rule_based_fallback",
            model_version=model_version,
            learned_latency_ms=latency_ms,
            fallback_reason=exc_msg or "inference_error",
            disagrees=False,
            learned_prediction=None,
            learned_confidence=None,
            queued_for_review=False,
        )
        log_warn(
            "rollout_service",
            "learned_model_unavailable",
            verification_id=request.verification_id,
            user_id=request.user_id,
            fallback_reason=meta.fallback_reason,
        )
        _record_metrics(
            rule_based_result.status,
            fallback=True,
            disagrees=False,
            low_confidence=False,
            manual_review=False,
            learned_latency_ms=None,
        )
        return rule_based_result, meta

    # Determine agreement.
    rule_passed = rule_based_result.status == "passed"
    learned_passed = learned_prediction == "passed"
    disagrees = rule_passed != learned_passed

    if disagrees:
        log_warn(
            "rollout_service",
            "classifier_disagreement",
            verification_id=request.verification_id,
            user_id=request.user_id,
            rule_based_status=rule_based_result.status,
            learned_prediction=learned_prediction,
            learned_confidence=round(learned_confidence, 4),
            model_version=model_version,
        )

    # Shadow mode: log and return rule-based result unchanged.
    if shadow_mode:
        log_info(
            "rollout_service",
            "shadow_observation",
            verification_id=request.verification_id,
            user_id=request.user_id,
            rule_based_status=rule_based_result.status,
            learned_prediction=learned_prediction,
            learned_confidence=round(learned_confidence, 4),
            model_version=model_version,
            learned_latency_ms=latency_ms,
            disagrees=disagrees,
        )
        meta = RolloutMeta(
            in_rollout=False,
            shadow_only=True,
            classifier_used="rule_based",
            model_version=model_version,
            learned_latency_ms=latency_ms,
            fallback_reason=None,
            disagrees=disagrees,
            learned_prediction=learned_prediction,
            learned_confidence=learned_confidence,
            queued_for_review=False,
        )
        _record_metrics(
            rule_based_result.status,
            fallback=False,
            disagrees=disagrees,
            low_confidence=learned_confidence < min_confidence,
            manual_review=False,
            learned_latency_ms=float(latency_ms),
        )
        return rule_based_result, meta

    # -----------------------------------------------------------------------
    # Rollout mode: learned model is primary.
    # -----------------------------------------------------------------------

    queued_for_review = False
    fallback_reason = None

    # Very low confidence: fall back to rule-based.
    if learned_confidence < review_threshold:
        queued_for_review = True
        if fallback_enabled:
            fallback_reason = "confidence_below_review_threshold"
            final_result = rule_based_result
            classifier_used = "rule_based_fallback"
        else:
            final_result = _build_retry_uncertain_result(
                request, pose_summary, rule_based_result, learned_confidence, model_version
            )
            classifier_used = "learned"
        log_warn(
            "rollout_service",
            "learned_confidence_very_low",
            verification_id=request.verification_id,
            user_id=request.user_id,
            learned_confidence=round(learned_confidence, 4),
            review_threshold=review_threshold,
            fallback=fallback_enabled,
            model_version=model_version,
        )

    # Borderline confidence: return retry_uncertain, queue for review.
    elif learned_confidence < min_confidence:
        queued_for_review = True
        classifier_used = "learned"
        fallback_reason = None
        final_result = _build_retry_uncertain_result(
            request, pose_summary, rule_based_result, learned_confidence, model_version
        )
        log_info(
            "rollout_service",
            "learned_confidence_borderline",
            verification_id=request.verification_id,
            user_id=request.user_id,
            learned_confidence=round(learned_confidence, 4),
            min_confidence=min_confidence,
            model_version=model_version,
        )

    # Sufficient confidence: use learned result.
    else:
        classifier_used = "learned"
        final_result = _build_learned_result(
            request, pose_summary, rule_based_result, learned_prediction, learned_confidence, model_version
        )

    log_info(
        "rollout_service",
        "rollout_inference",
        verification_id=request.verification_id,
        user_id=request.user_id,
        classifier_used=classifier_used,
        final_status=final_result.status,
        learned_prediction=learned_prediction,
        learned_confidence=round(learned_confidence, 4),
        model_version=model_version,
        learned_latency_ms=latency_ms,
        rule_based_status=rule_based_result.status,
        disagrees=disagrees,
        queued_for_review=queued_for_review,
        fallback_reason=fallback_reason,
    )

    _record_metrics(
        final_result.status,
        fallback=(classifier_used == "rule_based_fallback"),
        disagrees=disagrees,
        low_confidence=learned_confidence < min_confidence,
        manual_review=queued_for_review,
        learned_latency_ms=float(latency_ms),
    )

    meta = RolloutMeta(
        in_rollout=True,
        shadow_only=False,
        classifier_used=classifier_used,
        model_version=model_version,
        learned_latency_ms=latency_ms,
        fallback_reason=fallback_reason,
        disagrees=disagrees,
        learned_prediction=learned_prediction,
        learned_confidence=learned_confidence,
        queued_for_review=queued_for_review,
    )
    return final_result, meta


# ---------------------------------------------------------------------------
# Learned inference (deferred torch import)
# ---------------------------------------------------------------------------

def _run_learned_inference(
    pose_summary: PoseSequence,
    artifact_path: str,
) -> tuple[str | None, float, str | None, int | None, str | None]:
    """
    Returns (prediction, confidence, model_version, latency_ms, error_message).
    On failure: (None, 0.0, None, None, error_message).
    Never raises.
    """
    try:
        return _learned_inference_inner(pose_summary, artifact_path)
    except Exception as exc:  # noqa: BLE001
        return None, 0.0, None, None, str(exc)


def _learned_inference_inner(
    pose_summary: PoseSequence,
    artifact_path: str,
) -> tuple[str | None, float, str | None, int, str | None]:
    import torch  # noqa: PLC0415

    from app.ml.artifacts import load_artifact_config, load_model, load_preprocess_config  # noqa: PLC0415
    from app.ml.preprocessing import aggregate_features, preprocess_sequence  # noqa: PLC0415

    if artifact_path not in _model_cache:
        try:
            model, _ = load_model(artifact_path)
            preprocess_cfg = load_preprocess_config(artifact_path)
            artifact_cfg = load_artifact_config(artifact_path)
            _model_cache[artifact_path] = (model, preprocess_cfg, artifact_cfg)
        except FileNotFoundError as exc:
            return None, 0.0, None, None, f"artifact_not_found: {exc}"

    model, preprocess_cfg, artifact_cfg = _model_cache[artifact_path]
    model_version = artifact_cfg.get("model_version", "unknown")
    model_type = artifact_cfg["model_config"]["model_type"]

    frames = _pose_sequence_to_frames(pose_summary)

    t0 = time.monotonic()
    if model_type == "aggregate":
        feat = aggregate_features(frames, preprocess_cfg)
        x = torch.from_numpy(feat).unsqueeze(0)   # (1, 53)
    else:
        feat, _ = preprocess_sequence(frames, preprocess_cfg)
        x = torch.from_numpy(feat).unsqueeze(0).permute(0, 2, 1)  # (1, 40, seq_len)

    with torch.no_grad():
        logits = model(x)
        pred_label = int(logits.argmax(dim=1).item())
        confidence = float(torch.softmax(logits, dim=1)[0, pred_label].item())

    latency_ms = int((time.monotonic() - t0) * 1000)
    prediction = "passed" if pred_label == 1 else "failed"
    return prediction, confidence, model_version, latency_ms, None


def _pose_sequence_to_frames(pose_summary: PoseSequence) -> list[dict]:
    return [
        {
            "frame_index": frame.frame_index,
            "timestamp_ms": frame.timestamp_ms,
            "keypoints": {
                name: {"x": kp.x, "y": kp.y, "confidence": kp.confidence}
                for name, kp in frame.keypoints.items()
            },
            "confidence": (
                sum(kp.confidence for kp in frame.keypoints.values())
                / max(len(frame.keypoints), 1)
            ),
        }
        for frame in pose_summary.frames
    ]


# ---------------------------------------------------------------------------
# Response builders
# ---------------------------------------------------------------------------

def _build_learned_result(
    request: ActivityAnalysisRequest,
    pose_summary: PoseSequence,
    rule_based_result: ActivityAnalysisResponse,
    prediction: str,
    confidence: float,
    model_version: str | None,
) -> ActivityAnalysisResponse:
    if prediction == "passed":
        return ActivityAnalysisResponse(
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status="passed",
            confidence_score=round(confidence, 4),
            model_name=model_version or rule_based_result.model_name,
            analysis_summary={
                **(rule_based_result.analysis_summary or {}),
                "classifier": "learned",
                "model_version": model_version,
                "learned_confidence": round(confidence, 4),
            },
            failure_reason=None,
            retry_guidance=None,
        )
    return ActivityAnalysisResponse(
        verification_id=request.verification_id,
        activity_id=request.activity_id,
        status="failed_no_valid_activity",
        confidence_score=round(confidence, 4),
        model_name=model_version or rule_based_result.model_name,
        analysis_summary={
            **(rule_based_result.analysis_summary or {}),
            "classifier": "learned",
            "model_version": model_version,
            "learned_confidence": round(confidence, 4),
        },
        failure_reason="The learned sit classifier did not detect a valid sit.",
        retry_guidance="Cue a clear sit from a standing position and keep your dog fully in frame.",
    )


def _build_retry_uncertain_result(
    request: ActivityAnalysisRequest,
    pose_summary: PoseSequence,
    rule_based_result: ActivityAnalysisResponse,
    confidence: float,
    model_version: str | None,
) -> ActivityAnalysisResponse:
    return ActivityAnalysisResponse(
        verification_id=request.verification_id,
        activity_id=request.activity_id,
        status="retry_uncertain",
        confidence_score=round(confidence, 4),
        model_name=model_version or rule_based_result.model_name,
        analysis_summary={
            **(rule_based_result.analysis_summary or {}),
            "classifier": "learned",
            "model_version": model_version,
            "learned_confidence": round(confidence, 4),
        },
        failure_reason="The sit attempt was detected but the model is not confident enough to verify it.",
        retry_guidance=(
            "Record a clear sit from a standing position with your dog fully visible "
            "from the side. Use bright, even lighting and keep the camera steady."
        ),
    )


# ---------------------------------------------------------------------------
# Metrics helper (thin wrapper so rollout_service does not depend on metrics_service
# at import time — this avoids issues in tests that only patch rollout_service)
# ---------------------------------------------------------------------------

def _record_metrics(
    status: str,
    fallback: bool,
    disagrees: bool,
    low_confidence: bool,
    manual_review: bool,
    learned_latency_ms: float | None,
) -> None:
    try:
        from app.ml import metrics_service  # noqa: PLC0415
        metrics_service.record(
            status=status,
            fallback=fallback,
            disagrees=disagrees,
            low_confidence=low_confidence,
            manual_review=manual_review,
            learned_latency_ms=learned_latency_ms,
        )
    except Exception:  # noqa: BLE001
        pass


# ---------------------------------------------------------------------------
# Cache management (for tests)
# ---------------------------------------------------------------------------

def clear_model_cache() -> None:
    """Clear the in-process model cache. Intended for tests only."""
    _model_cache.clear()
