"""
Admin-only review queue API.

Authentication: Authorization: Bearer <ADMIN_API_KEY>
All endpoints return 403 if the key is missing or wrong.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.models.review_models import (
    EnqueueRequest,
    ReviewDetail,
    ReviewQueueItem,
    ReviewQueueStats,
    SubmitLabelRequest,
)
from app.services import review_service

router = APIRouter(prefix="/review", tags=["review"])
_bearer = HTTPBearer(auto_error=False)


def _require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> None:
    if not settings.admin_api_key:
        raise HTTPException(status_code=503, detail="Admin API key is not configured.")
    if credentials is None or credentials.credentials != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid or missing admin API key.")


@router.get("/queue", response_model=list[ReviewQueueItem], dependencies=[Depends(_require_admin)])
def list_queue(
    state: str = Query("pending_review"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[ReviewQueueItem]:
    """List review queue items filtered by state."""
    return review_service.list_queue(state=state, limit=limit, offset=offset)


@router.get("/stats", response_model=ReviewQueueStats, dependencies=[Depends(_require_admin)])
def get_stats() -> ReviewQueueStats:
    """Count items in each review state."""
    return review_service.get_stats()


@router.get("/{review_id}", response_model=ReviewDetail, dependencies=[Depends(_require_admin)])
def get_detail(review_id: str) -> ReviewDetail:
    """
    Get full review detail including skeleton JSON and signed video URL (if available).
    """
    try:
        return review_service.get_detail(review_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/{review_id}/label", response_model=ReviewDetail, dependencies=[Depends(_require_admin)])
def submit_label(review_id: str, req: SubmitLabelRequest) -> ReviewDetail:
    """Submit a label for a review item."""
    try:
        return review_service.submit_label(review_id, req)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/{review_id}/skip", response_model=ReviewDetail, dependencies=[Depends(_require_admin)])
def skip(review_id: str) -> ReviewDetail:
    """Mark a review item as skipped (terminal state)."""
    try:
        return review_service.skip_review(review_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/{review_id}/dispute", response_model=ReviewDetail, dependencies=[Depends(_require_admin)])
def dispute(review_id: str, notes: str | None = None) -> ReviewDetail:
    """Dispute a reviewed item — sends it back for re-labeling."""
    try:
        return review_service.dispute_review(review_id, notes)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/enqueue/{verification_id}", response_model=ReviewQueueItem, dependencies=[Depends(_require_admin)])
def enqueue_manual(verification_id: str, enqueue_reason: str = "manual") -> ReviewQueueItem:
    """Manually add a verification to the review queue."""
    req = EnqueueRequest(verification_id=verification_id, enqueue_reason=enqueue_reason)
    try:
        return review_service.enqueue_manual(req)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))
