"""
Orchestrates all persistence side-effects for a completed verification attempt.
Failures here are logged and swallowed — they must never surface as HTTP errors.
"""

from app.models.pose_models import PoseSequence
from app.models.request_models import ActivityAnalysisRequest
from app.models.response_models import ActivityAnalysisResponse
from app.services import supabase_service
from app.services.pose_quality_service import compute_quality
from app.utils.logging import log_error, log_info


def persist_verification(
    request: ActivityAnalysisRequest,
    result: ActivityAnalysisResponse,
    pose_sequence: PoseSequence | None,
    inference_latency_ms: int | None,
) -> None:
    _persist_result(result)
    if pose_sequence is not None:
        _persist_pose_sequence(request, result, pose_sequence, inference_latency_ms)


def _persist_result(result: ActivityAnalysisResponse) -> None:
    try:
        supabase_service.persist_analysis(result)
        log_info(
            "verification_persistence",
            "classifier_output",
            verification_id=result.verification_id,
            status=result.status,
            confidence=result.confidence_score,
            failure_reason=result.failure_reason,
        )
    except Exception as exc:  # noqa: BLE001
        log_error(
            "verification_persistence",
            "db_write_failure",
            verification_id=result.verification_id,
            error=str(exc),
        )


def _persist_pose_sequence(
    request: ActivityAnalysisRequest,
    result: ActivityAnalysisResponse,
    pose_sequence: PoseSequence,
    inference_latency_ms: int | None,
) -> None:
    quality = compute_quality(pose_sequence)

    try:
        supabase_service.persist_pose_sequence(
            verification_id=result.verification_id,
            dog_id=request.dog_id,
            pose_sequence=pose_sequence,
            inference_latency_ms=inference_latency_ms,
            quality_flags=quality.flags.model_dump(),
        )
    except Exception as exc:  # noqa: BLE001
        log_error(
            "verification_persistence",
            "db_write_failure",
            context="pose_sequence",
            verification_id=result.verification_id,
            error=str(exc),
        )
