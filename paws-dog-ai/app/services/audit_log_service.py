"""
Audit log service for hybrid verification.

Writes a row to the 'hybrid_verification_audits' table after every attempt
that passes through the hybrid or high-stakes path.  Failures are swallowed
and logged; the audit trail must never block the user-facing response.

Each row records:
  - verification_id + tier + routing_path
  - model versions (pose, RGB)
  - all intermediate and fused scores
  - final status and any policy applied
  - timestamp (server-side)

The 'consent_video_retained' column records whether video was retained under
the caller's retention policy so reviewers know what evidence is available.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.utils.logging import log_error, log_info


def write_audit_entry(
    verification_id: str,
    user_id: str,
    dog_id: str,
    tier: str,
    routing_path: str,
    routing_reasons: list[str],
    pose_model_version: str,
    rgb_provider: str | None,
    rgb_model_version: str | None,
    pose_score: float,
    rgb_score: float | None,
    quality_score: float,
    anomaly_score: float,
    fused_confidence: float,
    final_status: str,
    tier_policy_applied: str | None,
    consent_video_retained: bool,
    anomaly_flags: list[str],
) -> str | None:
    """
    Write an audit row and return its UUID.  Returns None on any failure.

    Callers should store the returned id in FusedVerificationResult.audit_id
    for traceability.  All exceptions are caught here.
    """
    now = datetime.now(timezone.utc).isoformat()
    row: dict = {
        "verification_id": verification_id,
        "user_id": user_id,
        "dog_id": dog_id,
        "tier": tier,
        "routing_path": routing_path,
        "routing_reasons": routing_reasons,
        "pose_model_version": pose_model_version,
        "rgb_provider": rgb_provider,
        "rgb_model_version": rgb_model_version,
        "pose_score": round(pose_score, 6),
        "rgb_score": round(rgb_score, 6) if rgb_score is not None else None,
        "quality_score": round(quality_score, 6),
        "anomaly_score": round(anomaly_score, 6),
        "fused_confidence": round(fused_confidence, 6),
        "final_status": final_status,
        "tier_policy_applied": tier_policy_applied,
        "consent_video_retained": consent_video_retained,
        "anomaly_flags": anomaly_flags,
        "created_at": now,
    }

    try:
        from app.services.supabase_service import get_supabase  # noqa: PLC0415
        client = get_supabase()
        result = client.table("hybrid_verification_audits").insert(row).execute()
        inserted = (result.data or [{}])[0]
        audit_id: str | None = inserted.get("id")
        log_info(
            "audit_log_service",
            "audit_written",
            verification_id=verification_id,
            audit_id=audit_id,
            tier=tier,
            routing_path=routing_path,
            final_status=final_status,
        )
        return audit_id
    except Exception as exc:  # noqa: BLE001
        log_error(
            "audit_log_service",
            "audit_write_failed",
            verification_id=verification_id,
            error=str(exc),
        )
        return None
