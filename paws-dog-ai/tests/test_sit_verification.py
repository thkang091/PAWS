"""
Phase 0 tests for the sit verification pipeline.

The test suite avoids hitting Supabase or the real DLC model by patching
at the boundary used in production: VideoValidationService.validate,
PoseInferenceService.analyze_video, and supabase_service functions.
"""

from contextlib import ExitStack
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models.pose_models import Keypoint, PoseFrame, PoseSequence, VideoMetadata

client = TestClient(app)

_BASE_REQUEST = {
    "verification_id": "ver-001",
    "user_id": "user-001",
    "dog_id": "dog-001",
    "activity_id": "sit",
    "verification_mode": "ai",
    "storage_path": "dogs/dog-001/sit.mp4",
    "context_type": "training",
}


def _keypoint(name: str, confidence: float = 0.90) -> Keypoint:
    return Keypoint(name=name, x=0.5, y=0.5, confidence=confidence)


def _make_frame(frame_index: int, confidence: float = 0.90) -> PoseFrame:
    names = [
        "nose", "left_eye", "right_eye", "left_ear", "right_ear",
        "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
        "left_wrist", "right_wrist", "left_hip", "right_hip",
        "left_knee", "right_knee", "left_ankle", "right_ankle",
    ]
    return PoseFrame(
        frame_index=frame_index,
        timestamp_ms=frame_index * 33,
        keypoints={n: _keypoint(n, confidence) for n in names},
    )


def _sit_pose_sequence(avg_confidence: float = 0.90, low_conf_frames: int = 0) -> PoseSequence:
    frames = [_make_frame(i) for i in range(30)]
    for i in range(low_conf_frames):
        frames[i] = _make_frame(i, confidence=0.20)
    return PoseSequence(
        model_name="superanimal_quadruped_hrnet_w32_fasterrcnn_v1",
        metadata=VideoMetadata(duration_seconds=1.0, fps=30.0, width=640, height=480, frame_count=30),
        frames=frames,
        average_confidence=avg_confidence,
        required_keypoint_visibility_ratio=0.85,
        dog_frame_coverage_ratio=0.95,
    )


def _standard_patches(pose_sequence: PoseSequence):
    """Returns a list of patch context managers that mock all external calls."""
    return [
        patch("app.main.VideoValidationService.validate", return_value=(True, None)),
        patch("app.main.PoseInferenceService.analyze_video", return_value=pose_sequence),
        patch("app.services.supabase_service.persist_analysis"),
        patch("app.services.supabase_service.persist_pose_sequence"),
    ]


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------


class TestSitVerificationPipeline:
    def test_successful_sit_returns_200(self):
        pose = _sit_pose_sequence()
        with ExitStack() as stack:
            for p in _standard_patches(pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_BASE_REQUEST)
        assert response.status_code == 200
        data = response.json()
        assert data["verification_id"] == "ver-001"
        assert data["activity_id"] == "sit"

    def test_failed_sit_returns_failed_status(self):
        empty_pose = PoseSequence(
            model_name="test",
            metadata=VideoMetadata(duration_seconds=1.0, fps=30.0, width=640, height=480, frame_count=0),
            frames=[],
            average_confidence=0.0,
            required_keypoint_visibility_ratio=0.0,
            dog_frame_coverage_ratio=0.0,
        )
        with ExitStack() as stack:
            for p in _standard_patches(empty_pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_BASE_REQUEST)
        assert response.status_code == 200
        assert response.json()["status"] in {"failed", "error", "low_quality", "retry_dog_not_visible"}

    def test_low_confidence_pose_does_not_crash(self):
        pose = _sit_pose_sequence(avg_confidence=0.10, low_conf_frames=30)
        with ExitStack() as stack:
            for p in _standard_patches(pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_BASE_REQUEST)
        assert response.status_code == 200
        assert "status" in response.json()

    def test_missing_frames_does_not_crash(self):
        pose = _sit_pose_sequence()
        pose.frames = []
        with ExitStack() as stack:
            for p in _standard_patches(pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_BASE_REQUEST)
        assert response.status_code == 200

    def test_db_write_failure_does_not_crash_response(self):
        """A Supabase write error must be swallowed; the HTTP response must be 200."""
        pose = _sit_pose_sequence()
        with ExitStack() as stack:
            stack.enter_context(patch("app.main.VideoValidationService.validate", return_value=(True, None)))
            stack.enter_context(patch("app.main.PoseInferenceService.analyze_video", return_value=pose))
            stack.enter_context(patch(
                "app.services.supabase_service.persist_analysis",
                side_effect=RuntimeError("Supabase unreachable"),
            ))
            stack.enter_context(patch(
                "app.services.supabase_service.persist_pose_sequence",
                side_effect=RuntimeError("Supabase unreachable"),
            ))
            response = client.post("/analyze/activity", json=_BASE_REQUEST)
        assert response.status_code == 200
        assert "verification_id" in response.json()
