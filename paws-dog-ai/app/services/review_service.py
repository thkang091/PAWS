"""
Review queue service.

Handles:
  - Deciding whether a verification should be queued for review
  - Creating and updating verification_reviews rows
  - Fetching queue items with enriched detail (signed video URL, skeleton JSON)
  - Label submission with state-machine validation

All DB failures are caught and logged — they must never surface as HTTP errors
in the user-facing inference path. Reviewer-facing errors (bad transitions,
missing items) are raised and handled by the router.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.config import settings
from app.models.pose_models import PoseSequence
from app.models.request_models import ActivityAnalysisRequest
from app.models.response_models import ActivityAnalysisResponse
from app.models.review_models import (
    EnqueueRequest,
    ReviewDetail,
    ReviewQueueItem,
    ReviewQueueStats,
    SubmitLabelRequest,
    validate_transition,
)
from app.utils.logging import log_error, log_info


# ---------------------------------------------------------------------------
# Queue decision
# ---------------------------------------------------------------------------

def should_enqueue(
    request: ActivityAnalysisRequest,
    result: ActivityAnalysisResponse,
    quality_flags: dict,
    shadow_disagrees: bool,
) -> tuple[bool, str]:
    """
    Returns (should_enqueue, reason).
    Called in the hot path — must not raise.
    """
    if shadow_disagrees:
        return True, "shadow_disagreement"

    conf = result.confidence_score
    if conf is not None and conf < settings.review_confidence_threshold:
        return True, "low_confidence"

    if getattr(request, "user_retry_count", 0) > 0:
        return True, "retry"

    if quality_flags.get("excessive_missing_frames") or quality_flags.get("low_average_confidence"):
        return True, "quality_flag"

    return False, ""


def maybe_enqueue(
    request: ActivityAnalysisRequest,
    result: ActivityAnalysisResponse,
    quality_flags: dict,
    shadow_disagrees: bool,
    learned_prediction: str | None = None,
    learned_confidence: float | None = None,
) -> None:
    """
    Enqueues a review entry if criteria are met. Swallows all errors.
    """
    enqueue, reason = should_enqueue(request, result, quality_flags, shadow_disagrees)
    if not enqueue:
        return

    try:
        _create_review_entry(
            verification_id=result.verification_id,
            enqueue_reason=reason,
            rule_based_status=result.status,
            learned_prediction=learned_prediction,
            learned_confidence=learned_confidence,
        )
        log_info(
            "review_service",
            "enqueued_for_review",
            verification_id=result.verification_id,
            reason=reason,
        )
    except Exception as exc:  # noqa: BLE001
        log_error(
            "review_service",
            "enqueue_failed",
            verification_id=result.verification_id,
            error=str(exc),
        )


# ---------------------------------------------------------------------------
# CRUD operations (used by the admin router)
# ---------------------------------------------------------------------------

def enqueue_manual(req: EnqueueRequest) -> ReviewQueueItem:
    """Manually enqueue a verification for review. Raises on DB error."""
    row = _create_review_entry(
        verification_id=req.verification_id,
        enqueue_reason=req.enqueue_reason,
        rule_based_status=req.rule_based_status,
        learned_prediction=req.learned_prediction,
        learned_confidence=req.learned_confidence,
    )
    return _row_to_queue_item(row)


def list_queue(
    state: str = "pending_review",
    limit: int = 50,
    offset: int = 0,
) -> list[ReviewQueueItem]:
    client = _client()
    rows = (
        client.table("verification_reviews")
        .select("id, verification_id, review_state, enqueue_reason, "
                "rule_based_status, learned_prediction, learned_confidence, created_at")
        .eq("review_state", state)
        .order("created_at", desc=False)
        .range(offset, offset + limit - 1)
        .execute()
        .data or []
    )
    return [_row_to_queue_item(r) for r in rows]


def get_detail(review_id: str) -> ReviewDetail:
    client = _client()
    rows = (
        client.table("verification_reviews")
        .select("*")
        .eq("id", review_id)
        .limit(1)
        .execute()
        .data or []
    )
    if not rows:
        raise KeyError(f"Review {review_id} not found.")

    row = rows[0]
    detail = ReviewDetail(
        id=row["id"],
        verification_id=row["verification_id"],
        review_state=row["review_state"],
        enqueue_reason=row["enqueue_reason"],
        rule_based_status=row.get("rule_based_status"),
        learned_prediction=row.get("learned_prediction"),
        learned_confidence=row.get("learned_confidence"),
        ground_truth_trick=row.get("ground_truth_trick"),
        trick_completed=row.get("trick_completed"),
        attempt_quality=row.get("attempt_quality"),
        failure_reason=row.get("failure_reason"),
        reviewer_notes=row.get("reviewer_notes"),
        reviewed_by=row.get("reviewed_by"),
        reviewed_at=row.get("reviewed_at"),
        is_hard_negative=row.get("is_hard_negative", False),
        created_at=row["created_at"],
    )

    # Enrich with verification data.
    ver_rows = (
        client.table("activity_verifications")
        .select("status, confidence_score, storage_path")
        .eq("id", row["verification_id"])
        .limit(1)
        .execute()
        .data or []
    )
    if ver_rows:
        ver = ver_rows[0]
        detail.verification_status = ver.get("status")
        detail.verification_confidence = ver.get("confidence_score")

        storage_path = ver.get("storage_path")
        if storage_path and settings.retain_raw_video:
            detail.video_signed_url = _signed_url(storage_path)

    # Enrich with skeleton JSON from pose_sequences.
    pose_rows = (
        client.table("pose_sequences")
        .select("frames")
        .eq("verification_id", row["verification_id"])
        .limit(1)
        .execute()
        .data or []
    )
    if pose_rows:
        from app.models.pose_models import Keypoint, PoseFrame, PoseSequence, VideoMetadata  # noqa: PLC0415
        from app.services.pose_quality_service import skeleton_json  # noqa: PLC0415

        frames_raw = pose_rows[0].get("frames", [])
        pose_frames = []
        for f in frames_raw:
            kps = {
                name: Keypoint(
                    name=name,
                    x=kp.get("x"),
                    y=kp.get("y"),
                    confidence=float(kp.get("confidence", 0.0)),
                )
                for name, kp in (f.get("keypoints") or {}).items()
            }
            pose_frames.append(PoseFrame(
                frame_index=f.get("frame_index", 0),
                timestamp_ms=f.get("timestamp_ms", 0),
                keypoints=kps,
            ))

        if pose_frames:
            seq = PoseSequence(
                model_name="stored",
                metadata=VideoMetadata(
                    duration_seconds=pose_frames[-1].timestamp_ms / 1000.0,
                    fps=30.0, width=640, height=480,
                    frame_count=len(pose_frames),
                ),
                frames=pose_frames,
                average_confidence=0.0,
                required_keypoint_visibility_ratio=0.0,
                dog_frame_coverage_ratio=0.0,
            )
            detail.skeleton_json = skeleton_json(seq)

    return detail


def submit_label(review_id: str, req: SubmitLabelRequest) -> ReviewDetail:
    """Submit a label. Validates state transition before writing."""
    current = _get_state(review_id)
    next_state = "disputed" if req.is_disputed else "reviewed"
    validate_transition(current, next_state)

    client = _client()
    now = datetime.now(timezone.utc).isoformat()
    client.table("verification_reviews").update({
        "review_state": next_state,
        "ground_truth_trick": req.ground_truth_trick,
        "trick_completed": req.trick_completed,
        "attempt_quality": req.attempt_quality,
        "start_timestamp_ms": req.start_timestamp_ms,
        "end_timestamp_ms": req.end_timestamp_ms,
        "failure_reason": req.failure_reason,
        "reviewer_notes": req.reviewer_notes,
        "reviewed_by": req.reviewed_by,
        "reviewed_at": now,
        "is_hard_negative": req.is_hard_negative,
        "updated_at": now,
    }).eq("id", review_id).execute()

    return get_detail(review_id)


def skip_review(review_id: str) -> ReviewDetail:
    current = _get_state(review_id)
    validate_transition(current, "skipped")
    now = datetime.now(timezone.utc).isoformat()
    _client().table("verification_reviews").update({
        "review_state": "skipped",
        "updated_at": now,
    }).eq("id", review_id).execute()
    return get_detail(review_id)


def dispute_review(review_id: str, notes: str | None = None) -> ReviewDetail:
    current = _get_state(review_id)
    validate_transition(current, "disputed")
    now = datetime.now(timezone.utc).isoformat()
    update: dict = {"review_state": "disputed", "updated_at": now}
    if notes:
        update["reviewer_notes"] = notes
    _client().table("verification_reviews").update(update).eq("id", review_id).execute()
    return get_detail(review_id)


def get_stats() -> ReviewQueueStats:
    rows = (
        _client().table("verification_reviews")
        .select("review_state")
        .execute()
        .data or []
    )
    counts: dict[str, int] = {
        "pending_review": 0, "reviewed": 0,
        "skipped": 0, "disputed": 0, "needs_relabeling": 0,
    }
    for r in rows:
        state = r.get("review_state", "")
        if state in counts:
            counts[state] += 1
    return ReviewQueueStats(**counts, total=len(rows))


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _client():
    from app.services.supabase_service import get_supabase  # noqa: PLC0415
    return get_supabase()


def _create_review_entry(
    verification_id: str,
    enqueue_reason: str,
    rule_based_status: str | None,
    learned_prediction: str | None,
    learned_confidence: float | None,
) -> dict:
    row = {
        "verification_id": verification_id,
        "enqueue_reason": enqueue_reason,
        "rule_based_status": rule_based_status,
        "learned_prediction": learned_prediction,
        "learned_confidence": learned_confidence,
    }
    result = _client().table("verification_reviews").insert(row).execute()
    return (result.data or [{}])[0]


def _get_state(review_id: str) -> str:
    rows = (
        _client().table("verification_reviews")
        .select("review_state")
        .eq("id", review_id)
        .limit(1)
        .execute()
        .data or []
    )
    if not rows:
        raise KeyError(f"Review {review_id} not found.")
    return rows[0]["review_state"]


def _row_to_queue_item(row: dict) -> ReviewQueueItem:
    return ReviewQueueItem(
        id=row["id"],
        verification_id=row["verification_id"],
        review_state=row["review_state"],
        enqueue_reason=row["enqueue_reason"],
        rule_based_status=row.get("rule_based_status"),
        learned_prediction=row.get("learned_prediction"),
        learned_confidence=row.get("learned_confidence"),
        created_at=row["created_at"],
    )


def _signed_url(storage_path: str) -> str | None:
    try:
        client = _client()
        response = client.storage.from_("dog-activity-videos").create_signed_url(
            storage_path,
            settings.video_signed_url_expiry_seconds,
        )
        return response.get("signedURL") or response.get("signed_url")
    except Exception as exc:  # noqa: BLE001
        log_error("review_service", "signed_url_failed", path=storage_path, error=str(exc))
        return None
