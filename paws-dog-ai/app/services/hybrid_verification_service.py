"""
Hybrid verification service.

Orchestrates routing, optional RGB verification, score fusion, and the
final pass/fail/retry/manual_review decision.

Entry points:
  - decide_routing(): pure function, determines which path to take.
  - compute_quality_score(): converts PoseQualityFlags to a single score.
  - fuse_scores(): combines pose, RGB, and quality scores.
  - make_final_decision(): applies tier policy to produce final_status.
  - run_hybrid_verification(): full pipeline, called from main.py.
  - hybrid_result_to_response(): maps FusedVerificationResult back to
    ActivityAnalysisResponse so the HTTP response is unchanged for callers.

None of the public functions raise. Failures in the RGB verifier or the
audit writer are caught and handled gracefully.
"""

from __future__ import annotations

from app.config import settings
from app.ml.rgb_verifier import RGBVerificationError, get_rgb_verifier
from app.models.hybrid_models import (
    DEFAULT_FUSION_WEIGHTS,
    TIER_MANUAL_REVIEW_THRESHOLDS,
    TIER_PASS_THRESHOLDS,
    FusedVerificationResult,
    FusionWeights,
    HybridVerificationInput,
    RGBVerificationResult,
    RoutingDecision,
    VerificationTier,
)
from app.models.request_models import ActivityAnalysisRequest
from app.models.response_models import ActivityAnalysisResponse
from app.services.anomaly_service import compute_anomaly_score
from app.utils.logging import log_error, log_info, log_warn


# ---------------------------------------------------------------------------
# Routing
# ---------------------------------------------------------------------------

def decide_routing(
    tier: str,
    pose_confidence: float,
    quality_flags: dict,
    multiple_dogs_detected: bool,
    anomaly_score: float,
) -> RoutingDecision:
    """
    Determine whether to run fast_pose, hybrid, or direct_manual_review.

    This function is pure (no I/O) and is designed to be testable in isolation.
    """
    reasons: list[str] = []

    # High-stakes tiers always require hybrid verification.
    if tier in VerificationTier.HIGH_STAKES:
        reasons.append(f"high_stakes_tier:{tier}")

    # Borderline or low pose confidence triggers hybrid.
    if pose_confidence < settings.hybrid_pose_confidence_threshold:
        reasons.append(f"low_pose_confidence:{pose_confidence:.3f}")

    # Quality flags.
    if quality_flags.get("low_average_confidence"):
        reasons.append("quality:low_average_confidence")
    if quality_flags.get("excessive_missing_frames"):
        reasons.append("quality:excessive_missing_frames")
    if multiple_dogs_detected:
        reasons.append("quality:multiple_dogs_detected")

    # Anomaly signal.
    if anomaly_score > settings.hybrid_anomaly_threshold:
        reasons.append(f"anomaly_score:{anomaly_score:.3f}")

    # No triggers: fast pose path.
    if not reasons:
        return RoutingDecision(path="fast_pose", reasons=[])

    # High-stakes + very low confidence or very high anomaly -> skip hybrid
    # and send directly to manual review.
    if tier in VerificationTier.HIGH_STAKES:
        direct_threshold = settings.hybrid_high_stakes_direct_review_threshold
        if pose_confidence < direct_threshold or anomaly_score > settings.hybrid_direct_review_anomaly_threshold:
            return RoutingDecision(path="direct_manual_review", reasons=reasons)

    return RoutingDecision(path="hybrid", reasons=reasons)


# ---------------------------------------------------------------------------
# Quality score
# ---------------------------------------------------------------------------

def compute_quality_score(quality_flags: dict) -> float:
    """
    Convert PoseQualityFlags dict to a single quality score in [0, 1].

    Starts at 1.0 and subtracts penalties for each raised flag.
    """
    score = 1.0
    penalties = {
        "low_average_confidence":         0.25,
        "excessive_missing_frames":       0.20,
        "dog_partially_out_of_frame":     0.15,
        "insufficient_recording_duration": 0.15,
        "inconsistent_frame_rate":        0.10,
        "unsupported_pose_schema":        0.30,
    }
    for flag, penalty in penalties.items():
        if quality_flags.get(flag):
            score -= penalty
    return max(0.0, round(score, 4))


# ---------------------------------------------------------------------------
# Score fusion
# ---------------------------------------------------------------------------

def fuse_scores(
    pose_score: float,
    rgb_result: RGBVerificationResult | None,
    quality_score: float,
    anomaly_score: float,
    weights: FusionWeights = DEFAULT_FUSION_WEIGHTS,
) -> float:
    """
    Combine available scores into a single fused confidence value in [0, 1].

    When rgb_result is None (fast path or RGB failure), pose and quality are
    re-weighted proportionally so their sum equals 1.
    """
    anomaly_discount = 1.0 - anomaly_score * weights.anomaly_penalty

    if rgb_result is None:
        # Re-weight pose and quality to sum to 1 (ignoring RGB weight).
        total = weights.pose + weights.quality
        if total <= 0:
            return 0.0
        w_pose = weights.pose / total
        w_quality = weights.quality / total
        fused = w_pose * pose_score + w_quality * quality_score
    else:
        # Deflate RGB confidence by fraud risk before fusing.
        rgb_score = rgb_result.visual_confidence * (1.0 - rgb_result.fraud_risk_score)
        # Also penalise for multiple dogs and high occlusion.
        rgb_score *= max(0.0, 1.0 - rgb_result.multiple_dog_score * 0.5)
        rgb_score = max(0.0, min(1.0, rgb_score))

        fused = (
            weights.pose * pose_score
            + weights.rgb * rgb_score
            + weights.quality * quality_score
        )

    fused *= anomaly_discount
    return round(max(0.0, min(1.0, fused)), 4)


# ---------------------------------------------------------------------------
# Final decision
# ---------------------------------------------------------------------------

def make_final_decision(
    fused_confidence: float,
    tier: str,
    classifier_status: str,
    routing_path: str,
) -> tuple[str, str | None]:
    """
    Map fused confidence + tier policy to (final_status, tier_policy_applied).

    Returns:
        final_status: one of "passed", "failed", "retry", "manual_review".
        tier_policy_applied: short description of any stricter rule that fired,
            or None.
    """
    # Direct manual review path bypasses threshold logic.
    if routing_path == "direct_manual_review":
        return "manual_review", f"direct_manual_review:{tier}"

    pass_threshold = TIER_PASS_THRESHOLDS.get(tier, TIER_PASS_THRESHOLDS[VerificationTier.STANDARD_DAILY])
    manual_threshold = TIER_MANUAL_REVIEW_THRESHOLDS.get(tier)

    # Borderline auto-pass for high-stakes tiers must go to manual review.
    if manual_threshold is not None and pass_threshold <= fused_confidence < manual_threshold:
        return "manual_review", f"borderline_{tier}:fused={fused_confidence:.3f}<{manual_threshold}"

    if fused_confidence >= pass_threshold:
        return "passed", None

    # Below pass threshold.
    if classifier_status == "failed":
        return "failed", None

    return "retry", None


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------

def run_hybrid_verification(
    input_: HybridVerificationInput,
    request: ActivityAnalysisRequest,
    pose_model_version: str,
    rgb_provider_key: str | None = None,
) -> FusedVerificationResult:
    """
    Run the full hybrid verification pipeline for one attempt.

    1. Compute anomaly score.
    2. Decide routing path.
    3. (If hybrid) run RGB verifier, catching failures.
    4. Compute quality score.
    5. Fuse scores.
    6. Apply tier policy to make final decision.
    7. Write audit entry (fire-and-forget).
    8. Return FusedVerificationResult.

    This function never raises.
    """
    verification_id = input_.verification_id
    tier = input_.tier

    # --- 1. Anomaly score ---
    attempt_history_dict = (
        input_.attempt_history.model_dump() if input_.attempt_history else None
    )
    anomaly_report = compute_anomaly_score(
        quality_flags=input_.quality_flags,
        multiple_dogs_detected=input_.multiple_dogs_detected,
        recording_metadata=input_.recording_metadata,
        attempt_history_summary=attempt_history_dict,
        verification_id=verification_id,
    )
    anomaly_score = anomaly_report.score

    # --- 2. Routing decision ---
    routing = decide_routing(
        tier=tier,
        pose_confidence=input_.pose_confidence,
        quality_flags=input_.quality_flags,
        multiple_dogs_detected=input_.multiple_dogs_detected,
        anomaly_score=anomaly_score,
    )

    log_info(
        "hybrid_verification_service",
        "routing_decision",
        verification_id=verification_id,
        tier=tier,
        path=routing.path,
        reasons=routing.reasons,
    )

    # --- 3. RGB verification (hybrid path only) ---
    rgb_result: RGBVerificationResult | None = None
    rgb_provider_used: str | None = None
    rgb_model_version_used: str | None = None

    if routing.path == "hybrid":
        provider_key = rgb_provider_key or settings.rgb_verifier_provider
        try:
            verifier = get_rgb_verifier(provider_key)
            rgb_result = verifier.verify(input_)
            rgb_provider_used = rgb_result.provider
            rgb_model_version_used = rgb_result.model_version
            log_info(
                "hybrid_verification_service",
                "rgb_verification_complete",
                verification_id=verification_id,
                provider=rgb_provider_used,
                visual_confidence=rgb_result.visual_confidence,
                fraud_risk=rgb_result.fraud_risk_score,
                latency_ms=rgb_result.latency_ms,
            )
            # Re-score anomaly with RGB fraud risk included.
            anomaly_report = compute_anomaly_score(
                quality_flags=input_.quality_flags,
                multiple_dogs_detected=input_.multiple_dogs_detected,
                recording_metadata=input_.recording_metadata,
                attempt_history_summary=attempt_history_dict,
                prior_rgb_fraud_risk=rgb_result.fraud_risk_score,
                verification_id=verification_id,
            )
            anomaly_score = anomaly_report.score
        except RGBVerificationError as exc:
            log_warn(
                "hybrid_verification_service",
                "rgb_verification_failed_fallback",
                verification_id=verification_id,
                error=str(exc),
            )
            # Proceed without RGB — fuse pose + quality only.
            rgb_result = None
        except Exception as exc:  # noqa: BLE001
            log_error(
                "hybrid_verification_service",
                "rgb_verification_unexpected_error",
                verification_id=verification_id,
                error=str(exc),
            )
            rgb_result = None

    # --- 4. Quality score ---
    quality_score = compute_quality_score(input_.quality_flags)

    # --- 5. Fusion ---
    rgb_score_for_result: float | None = None
    if rgb_result is not None:
        rgb_score_for_result = rgb_result.visual_confidence * (1.0 - rgb_result.fraud_risk_score)
        rgb_score_for_result = max(0.0, min(1.0, rgb_score_for_result))

    fused_confidence = fuse_scores(
        pose_score=input_.pose_confidence,
        rgb_result=rgb_result,
        quality_score=quality_score,
        anomaly_score=anomaly_score,
    )

    # --- 6. Final decision ---
    final_status, tier_policy = make_final_decision(
        fused_confidence=fused_confidence,
        tier=tier,
        classifier_status=input_.pose_classifier_status,
        routing_path=routing.path,
    )

    enqueue_reason: str | None = None
    if final_status == "manual_review":
        if tier in VerificationTier.HIGH_STAKES:
            enqueue_reason = f"high_stakes_tier:{tier}"
        elif routing.path == "direct_manual_review":
            enqueue_reason = "direct_manual_review"
        else:
            enqueue_reason = "hybrid_borderline"

    log_info(
        "hybrid_verification_service",
        "hybrid_decision",
        verification_id=verification_id,
        tier=tier,
        routing_path=routing.path,
        pose_score=input_.pose_confidence,
        rgb_score=rgb_score_for_result,
        quality_score=quality_score,
        anomaly_score=anomaly_score,
        fused_confidence=fused_confidence,
        final_status=final_status,
        tier_policy=tier_policy,
    )

    # --- 7. Audit log (fire-and-forget) ---
    audit_id: str | None = None
    if routing.path in ("hybrid", "direct_manual_review") or tier in VerificationTier.HIGH_STAKES:
        try:
            from app.services.audit_log_service import write_audit_entry  # noqa: PLC0415
            audit_id = write_audit_entry(
                verification_id=verification_id,
                user_id=request.user_id,
                dog_id=request.dog_id,
                tier=tier,
                routing_path=routing.path,
                routing_reasons=routing.reasons,
                pose_model_version=pose_model_version,
                rgb_provider=rgb_provider_used,
                rgb_model_version=rgb_model_version_used,
                pose_score=input_.pose_confidence,
                rgb_score=rgb_score_for_result,
                quality_score=quality_score,
                anomaly_score=anomaly_score,
                fused_confidence=fused_confidence,
                final_status=final_status,
                tier_policy_applied=tier_policy,
                consent_video_retained=settings.retain_raw_video,
                anomaly_flags=anomaly_report.flags,
            )
        except Exception as exc:  # noqa: BLE001
            log_error(
                "hybrid_verification_service",
                "audit_write_failed",
                verification_id=verification_id,
                error=str(exc),
            )

    return FusedVerificationResult(
        final_status=final_status,
        pose_score=input_.pose_confidence,
        rgb_score=rgb_score_for_result,
        quality_score=quality_score,
        anomaly_score=anomaly_score,
        fused_confidence=fused_confidence,
        routing_path=routing.path,
        tier=tier,
        tier_policy_applied=tier_policy,
        enqueue_reason=enqueue_reason,
        audit_id=audit_id,
        rgb_provider=rgb_provider_used,
        rgb_model_version=rgb_model_version_used,
        routing_reasons=routing.reasons,
    )


# ---------------------------------------------------------------------------
# Response adapter
# ---------------------------------------------------------------------------

# Maps hybrid final_status to ActivityAnalysisResponse.status values.
_HYBRID_STATUS_MAP: dict[str, str] = {
    "passed":        "passed",
    "failed":        "failed",
    "retry":         "retry_uncertain",
    "manual_review": "pending_manual_review",
}

_RETRY_GUIDANCE: dict[str, str] = {
    "manual_review": (
        "Your attempt is being reviewed by our team. "
        "You will receive an update shortly."
    ),
    "retry": (
        "The attempt did not meet the confidence threshold. "
        "Make sure your dog is fully in frame and the trick is clearly visible."
    ),
    "failed": (
        "The trick was not completed. "
        "Try again and ensure the full movement is visible."
    ),
}


def hybrid_result_to_response(
    fused: FusedVerificationResult,
    request: ActivityAnalysisRequest,
    pose_model_version: str,
) -> ActivityAnalysisResponse:
    """
    Convert a FusedVerificationResult to an ActivityAnalysisResponse.

    The response format is identical to the fast-path response so mobile
    clients require no changes.
    """
    status = _HYBRID_STATUS_MAP.get(fused.final_status, "failed")
    retry_guidance = _RETRY_GUIDANCE.get(fused.final_status)

    analysis_summary: dict = {
        "routing_path": fused.routing_path,
        "tier": fused.tier,
        "fused_confidence": fused.fused_confidence,
        "pose_score": fused.pose_score,
        "quality_score": fused.quality_score,
        "anomaly_score": fused.anomaly_score,
        "rgb_provider": fused.rgb_provider,
    }
    if fused.tier_policy_applied:
        analysis_summary["tier_policy_applied"] = fused.tier_policy_applied
    if fused.audit_id:
        analysis_summary["audit_id"] = fused.audit_id

    return ActivityAnalysisResponse(
        verification_id=request.verification_id,
        activity_id=request.activity_id,
        status=status,
        confidence_score=fused.fused_confidence,
        model_name=pose_model_version,
        analysis_summary=analysis_summary,
        failure_reason=fused.tier_policy_applied if fused.final_status in ("failed", "retry") else None,
        retry_guidance=retry_guidance,
    )
