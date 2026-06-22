"""
Tests for PoseQualityService and the /dev/inspect-pose-sequence endpoint.
"""

from contextlib import ExitStack
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.pose_models import Keypoint, PoseFrame, PoseSequence, VideoMetadata
from app.services.pose_quality_service import CANONICAL_KEYPOINTS, compute_quality

client = TestClient(app)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DOG_KEYPOINTS = list(CANONICAL_KEYPOINTS)


def _kp(name: str, confidence: float = 0.90, x: float | None = 100.0, y: float | None = 100.0) -> Keypoint:
    return Keypoint(name=name, x=x, y=y, confidence=confidence)


def _frame(index: int, confidence: float = 0.90, missing: list[str] | None = None) -> PoseFrame:
    missing = missing or []
    keypoints = {}
    for name in DOG_KEYPOINTS:
        if name in missing:
            keypoints[name] = Keypoint(name=name, x=None, y=None, confidence=0.0)
        else:
            keypoints[name] = _kp(name, confidence)
    return PoseFrame(
        frame_index=index,
        timestamp_ms=index * 33,
        keypoints=keypoints,
    )


def _sequence(
    frames: list[PoseFrame] | None = None,
    duration: float = 3.0,
    fps: float = 30.0,
    avg_confidence: float = 0.90,
    dog_coverage: float = 0.20,
) -> PoseSequence:
    if frames is None:
        frames = [_frame(i) for i in range(30)]
    return PoseSequence(
        model_name="superanimal_quadruped_hrnet_w32_fasterrcnn_v1",
        metadata=VideoMetadata(duration_seconds=duration, fps=fps, width=640, height=480, frame_count=len(frames)),
        frames=frames,
        average_confidence=avg_confidence,
        required_keypoint_visibility_ratio=0.85,
        dog_frame_coverage_ratio=dog_coverage,
    )


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------


class TestPoseQualityService:
    def test_clean_sequence_has_no_flags(self):
        report = compute_quality(_sequence())
        assert report.frame_count == 30
        assert report.avg_keypoint_confidence >= 0.85
        assert report.pct_frames_with_visible_dog == 1.0
        assert not report.flags.low_average_confidence
        assert not report.flags.excessive_missing_frames
        assert not report.flags.insufficient_recording_duration
        assert not report.flags.unsupported_pose_schema

    def test_missing_frames_flags_excessive_missing(self):
        # Only 10 of 30 frames have a visible dog (4+ joints above threshold).
        # The other 20 frames have all joints missing.
        frames = [_frame(i) for i in range(10)]
        frames += [_frame(i + 10, missing=list(CANONICAL_KEYPOINTS)) for i in range(20)]
        report = compute_quality(_sequence(frames=frames))
        assert report.flags.excessive_missing_frames

    def test_low_confidence_joints_flag(self):
        frames = [_frame(i, confidence=0.20) for i in range(30)]
        report = compute_quality(_sequence(frames=frames, avg_confidence=0.20))
        assert report.flags.low_average_confidence
        assert report.avg_keypoint_confidence < 0.55

    def test_short_recording_flags_insufficient_duration(self):
        frames = [_frame(i) for i in range(5)]
        report = compute_quality(_sequence(frames=frames, duration=0.5))
        assert report.flags.insufficient_recording_duration

    def test_malformed_sequence_empty_frames_does_not_crash(self):
        seq = _sequence(frames=[])
        report = compute_quality(seq)
        assert report.frame_count == 0
        assert report.avg_keypoint_confidence == 0.0
        assert report.pct_frames_with_visible_dog == 0.0
        assert report.pct_visible_joints == 0.0

    def test_schema_mismatch_flags_unsupported_pose_schema(self):
        # Frame contains only human COCO keypoints, not dog keypoints.
        bad_frame = PoseFrame(
            frame_index=0,
            timestamp_ms=0,
            keypoints={
                "left_knee": Keypoint(name="left_knee", x=50.0, y=50.0, confidence=0.9),
                "right_knee": Keypoint(name="right_knee", x=80.0, y=50.0, confidence=0.9),
            },
        )
        seq = _sequence(frames=[bad_frame])
        report = compute_quality(seq)
        assert report.flags.unsupported_pose_schema


class TestDevInspectEndpoint:
    def _payload(self, **kwargs) -> dict:
        seq = _sequence(**kwargs)
        return seq.model_dump()

    def test_inspect_returns_quality_report(self):
        response = client.post("/dev/inspect-pose-sequence", json=self._payload())
        assert response.status_code == 200
        data = response.json()
        assert "frame_count" in data
        assert "flags" in data
        assert "avg_keypoint_confidence" in data
        assert "missing_keypoints_by_name" in data

    def test_inspect_includes_skeleton_when_requested(self):
        response = client.post(
            "/dev/inspect-pose-sequence",
            json=self._payload(),
            params={"include_skeleton": "true"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["skeleton"] is not None
        assert "frames" in data["skeleton"]
        assert len(data["skeleton"]["frames"]) == 30

    def test_inspect_skeleton_omitted_by_default(self):
        response = client.post("/dev/inspect-pose-sequence", json=self._payload())
        assert response.status_code == 200
        assert response.json()["skeleton"] is None
