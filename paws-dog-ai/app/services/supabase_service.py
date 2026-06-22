from supabase import Client, create_client

from app.config import settings
from app.models.pose_models import PoseSequence
from app.models.response_models import ActivityAnalysisResponse
from app.utils.logging import log_error


def get_supabase() -> Client:
    if not settings.supabase_configured:
        raise RuntimeError("Supabase service-role configuration is missing.")
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def persist_analysis(result: ActivityAnalysisResponse) -> None:
    if not settings.supabase_configured:
        return

    client = get_supabase()
    client.rpc(
        "finalize_activity_verification",
        {
            "target_verification_id": result.verification_id,
            "final_status": result.status,
            "confidence": result.confidence_score,
            "model": result.model_name,
            "pose": {},
            "summary": result.analysis_summary or {},
            "failure": result.failure_reason,
            "guidance": result.retry_guidance,
        },
    ).execute()


def persist_pose_sequence(
    verification_id: str,
    dog_id: str,
    pose_sequence: PoseSequence,
    inference_latency_ms: int | None,
    quality_flags: dict | None = None,
) -> None:
    if not settings.supabase_configured:
        return

    client = get_supabase()

    frames_payload = [
        {
            "frame_index": frame.frame_index,
            "timestamp_ms": frame.timestamp_ms,
            "keypoints": {
                name: {
                    "x": kp.x,
                    "y": kp.y,
                    "confidence": kp.confidence,
                }
                for name, kp in frame.keypoints.items()
            },
            "confidence": sum(kp.confidence for kp in frame.keypoints.values()) / max(len(frame.keypoints), 1),
        }
        for frame in pose_sequence.frames
    ]

    try:
        client.table("pose_sequences").insert(
            {
                "verification_id": verification_id,
                "dog_id": dog_id,
                "pose_model_version": settings.pose_model_version,
                "avg_confidence": pose_sequence.average_confidence,
                "frame_count": len(pose_sequence.frames),
                "inference_latency_ms": inference_latency_ms,
                "quality_flags": quality_flags or {},
                "frames": frames_payload,
            }
        ).execute()
    except Exception as exc:  # noqa: BLE001
        log_error(
            "supabase_service",
            "db_write_failure",
            context="pose_sequences",
            verification_id=verification_id,
            error=str(exc),
        )
        raise


def download_storage_object(bucket: str, storage_path: str) -> bytes:
    client = get_supabase()
    response = client.storage.from_(bucket).download(storage_path)
    if isinstance(response, bytes):
        return response
    if hasattr(response, "content"):
        return response.content
    raise RuntimeError("Supabase Storage download returned an unsupported response.")
