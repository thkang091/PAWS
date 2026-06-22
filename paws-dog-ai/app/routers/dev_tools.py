"""
Developer-only endpoints for inspecting pose sequence data quality.
These routes are intended for local development and data validation only.
Do not expose in production without authentication.
"""

from fastapi import APIRouter

from app.models.pose_models import PoseSequence
from app.models.pose_quality_models import PoseQualityReport
from app.services.pose_quality_service import compute_quality, skeleton_json

router = APIRouter(prefix="/dev", tags=["dev"])


class InspectResponse(PoseQualityReport):
    skeleton: dict | None = None


@router.post("/inspect-pose-sequence", response_model=InspectResponse)
def inspect_pose_sequence(
    pose_sequence: PoseSequence,
    include_skeleton: bool = False,
) -> InspectResponse:
    """
    Accepts a PoseSequence payload and returns a full data-quality report.

    Pass include_skeleton=true to also receive a JSON skeleton representation
    of every frame (useful when raw video is unavailable).
    """
    report = compute_quality(pose_sequence)
    skeleton = skeleton_json(pose_sequence) if include_skeleton else None
    return InspectResponse(**report.model_dump(), skeleton=skeleton)
