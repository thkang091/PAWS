"""
Tests for the multi-trick generalization system.

Covers:
  1. Sit regression — existing sit classifier still works
  2. Down configuration — TrickClassifier handles "down" with correct config
  3. Stay duration requirement — minimum_recording_duration_ms respected
  4. Unknown trick — non-vocabulary slug returns unsupported_activity, not 500
  5. Inactive trick — active=False returns unsupported_activity with inactive reason
  6. no_action prediction — multi-class dataset can represent no_action
  7. Per-trick threshold loading — get_trick_config returns correct thresholds per slug
"""

from contextlib import ExitStack
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.ml.pose_dataset import (
    TRICK_LABEL_MAP,
    TRICK_LABEL_MAP_INV,
    label_to_trick,
    trick_to_label,
)
from app.models.pose_models import Keypoint, PoseFrame, PoseSequence, VideoMetadata
from app.models.trick_models import TrickThresholds, TrickVocabularyEntry
from app.services.trick_vocabulary_service import (
    get_trick_config,
    invalidate_cache,
    is_active_trick,
    is_known_trick,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _keypoint(name: str, confidence: float = 0.90) -> Keypoint:
    return Keypoint(name=name, x=0.5, y=0.5, confidence=confidence)


def _make_frame(frame_index: int, confidence: float = 0.90) -> PoseFrame:
    names = [
        "nose", "left_shoulder", "right_shoulder", "left_hip", "right_hip",
        "tail_base", "left_front_paw", "right_front_paw", "left_hind_paw", "right_hind_paw",
    ]
    return PoseFrame(
        frame_index=frame_index,
        timestamp_ms=frame_index * 33,
        keypoints={n: _keypoint(n, confidence) for n in names},
    )


def _good_pose(fps: float = 30.0, n_frames: int = 60) -> PoseSequence:
    """Good-quality pose sequence, about 2 seconds at given fps."""
    return PoseSequence(
        model_name="superanimal_quadruped_v1",
        metadata=VideoMetadata(
            duration_seconds=n_frames / fps,
            fps=fps,
            width=640,
            height=480,
            frame_count=n_frames,
        ),
        frames=[_make_frame(i) for i in range(n_frames)],
        average_confidence=0.88,
        required_keypoint_visibility_ratio=0.85,
        dog_frame_coverage_ratio=0.30,
    )


def _short_pose(fps: float = 30.0, n_frames: int = 10) -> PoseSequence:
    """Pose sequence that is too short (< 2 s at 30 fps)."""
    return _good_pose(fps=fps, n_frames=n_frames)


def _base_request(activity_id: str = "sit") -> dict:
    return {
        "verification_id": "ver-test",
        "user_id": "user-test",
        "dog_id": "dog-test",
        "activity_id": activity_id,
        "verification_mode": "ai",
        "storage_path": f"dogs/dog-test/{activity_id}.mp4",
        "context_type": "training",
    }


def _patches(pose: PoseSequence):
    return [
        patch("app.main.VideoValidationService.validate", return_value=(True, None)),
        patch("app.main.PoseInferenceService.analyze_video", return_value=pose),
        patch("app.services.supabase_service.persist_analysis"),
        patch("app.services.supabase_service.persist_pose_sequence"),
    ]


# ---------------------------------------------------------------------------
# 1. Sit regression
# ---------------------------------------------------------------------------

class TestSitRegression:
    """Sit classifier must still work exactly as before."""

    def test_sit_request_reaches_sit_classifier(self):
        pose = _good_pose()
        with ExitStack() as stack:
            for p in _patches(pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_base_request("sit"))
        assert response.status_code == 200
        data = response.json()
        assert data["activity_id"] == "sit"
        assert "status" in data

    def test_sit_returns_valid_status_string(self):
        pose = _good_pose()
        with ExitStack() as stack:
            for p in _patches(pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_base_request("sit"))
        status = response.json()["status"]
        valid = {
            "passed", "failed_no_valid_activity", "retry_dog_not_visible",
            "retry_low_confidence", "retry_wrong_starting_pose",
            "retry_multiple_dogs", "retry_uncertain", "error",
        }
        assert status in valid, f"Unexpected status: {status}"

    def test_sit_low_confidence_does_not_crash(self):
        pose = PoseSequence(
            model_name="test",
            metadata=VideoMetadata(duration_seconds=1.0, fps=30.0,
                                   width=640, height=480, frame_count=0),
            frames=[],
            average_confidence=0.0,
            required_keypoint_visibility_ratio=0.0,
            dog_frame_coverage_ratio=0.0,
        )
        with ExitStack() as stack:
            for p in _patches(pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_base_request("sit"))
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# 2. Down configuration
# ---------------------------------------------------------------------------

class TestDownConfiguration:
    def test_down_returns_200_not_500(self):
        pose = _good_pose()
        with ExitStack() as stack:
            for p in _patches(pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_base_request("down"))
        assert response.status_code == 200

    def test_down_status_is_unsupported_activity(self):
        pose = _good_pose()
        with ExitStack() as stack:
            for p in _patches(pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_base_request("down"))
        data = response.json()
        assert data["status"] == "unsupported_activity"
        assert data["activity_id"] == "down"

    def test_down_summary_contains_thresholds(self):
        pose = _good_pose()
        with ExitStack() as stack:
            for p in _patches(pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_base_request("down"))
        summary = response.json().get("analysis_summary", {})
        assert "thresholds" in summary
        th = summary["thresholds"]
        assert "pass_confidence_threshold" in th
        assert "minimum_recording_duration_ms" in th

    def test_down_config_has_hold_duration(self):
        config = get_trick_config("down")
        assert config is not None
        assert config.thresholds.hold_duration_ms == 700


# ---------------------------------------------------------------------------
# 3. Stay duration requirement
# ---------------------------------------------------------------------------

class TestStayDurationRequirement:
    def test_stay_config_has_three_second_hold(self):
        invalidate_cache()
        config = get_trick_config("stay")
        assert config is not None
        assert config.thresholds.hold_duration_ms == 3000

    def test_stay_config_minimum_recording_is_four_seconds(self):
        config = get_trick_config("stay")
        assert config is not None
        assert config.thresholds.minimum_recording_duration_ms == 4000

    def test_stay_short_recording_returns_retry_too_short(self):
        """A 0.3 s clip is below the 4 s stay minimum."""
        short = _short_pose(fps=30.0, n_frames=10)   # 0.33 s
        with ExitStack() as stack:
            for p in _patches(short):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_base_request("stay"))
        data = response.json()
        assert data["status"] == "retry_too_short"
        assert "stay" in (data.get("failure_reason") or "").lower()

    def test_stay_adequate_recording_does_not_fail_on_duration(self):
        """A 5 s clip at 30 fps satisfies the stay minimum."""
        long_pose = _good_pose(fps=30.0, n_frames=150)   # 5 s
        with ExitStack() as stack:
            for p in _patches(long_pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_base_request("stay"))
        data = response.json()
        # Should NOT be retry_too_short; may still be unsupported_activity
        assert data["status"] != "retry_too_short"


# ---------------------------------------------------------------------------
# 4. Unknown trick
# ---------------------------------------------------------------------------

class TestUnknownTrick:
    def test_unknown_trick_returns_200(self):
        pose = _good_pose()
        with ExitStack() as stack:
            for p in _patches(pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_base_request("handshake"))
        assert response.status_code == 200

    def test_unknown_trick_status_is_unsupported(self):
        pose = _good_pose()
        with ExitStack() as stack:
            for p in _patches(pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_base_request("handshake"))
        data = response.json()
        assert data["status"] == "unsupported_activity"
        assert "unknown_trick" in str(data.get("analysis_summary", {}).get("reason", ""))

    def test_unknown_trick_includes_failure_reason(self):
        pose = _good_pose()
        with ExitStack() as stack:
            for p in _patches(pose):
                stack.enter_context(p)
            response = client.post("/analyze/activity", json=_base_request("handshake"))
        assert response.json()["failure_reason"] is not None


# ---------------------------------------------------------------------------
# 5. Inactive trick
# ---------------------------------------------------------------------------

class TestInactiveTrick:
    def setup_method(self):
        invalidate_cache()

    def teardown_method(self):
        invalidate_cache()

    def test_inactive_trick_returns_unsupported(self):
        inactive_entry = TrickVocabularyEntry(
            slug="fetch",
            display_name="Fetch",
            category="retrieval",
            difficulty=3,
            active=False,
        )
        with patch(
            "app.services.trick_vocabulary_service._ensure_loaded",
            return_value={"fetch": inactive_entry},
        ):
            pose = _good_pose()
            with ExitStack() as stack:
                for p in _patches(pose):
                    stack.enter_context(p)
                response = client.post("/analyze/activity", json=_base_request("fetch"))
        data = response.json()
        assert data["status"] == "unsupported_activity"
        assert "inactive_trick" in str(data.get("analysis_summary", {}).get("reason", ""))

    def test_inactive_trick_failure_reason_mentions_trick_name(self):
        inactive_entry = TrickVocabularyEntry(
            slug="fetch",
            display_name="Fetch",
            active=False,
        )
        with patch(
            "app.services.trick_vocabulary_service._ensure_loaded",
            return_value={"fetch": inactive_entry},
        ):
            pose = _good_pose()
            with ExitStack() as stack:
                for p in _patches(pose):
                    stack.enter_context(p)
                response = client.post("/analyze/activity", json=_base_request("fetch"))
        assert "Fetch" in (response.json().get("failure_reason") or "")


# ---------------------------------------------------------------------------
# 6. no_action prediction in multi-class dataset
# ---------------------------------------------------------------------------

class TestNoActionPrediction:
    def test_no_action_is_class_zero(self):
        assert TRICK_LABEL_MAP["no_action"] == 0

    def test_all_tricks_have_nonzero_labels(self):
        for slug in ["sit", "down", "stay", "paw", "stand", "spin"]:
            assert TRICK_LABEL_MAP[slug] != 0, f"{slug} must not share label 0 with no_action"

    def test_trick_to_label_unknown_slug_maps_to_no_action(self):
        assert trick_to_label("handshake") == 0
        assert trick_to_label("") == 0

    def test_label_to_trick_zero_is_no_action(self):
        assert label_to_trick(0) == "no_action"

    def test_label_to_trick_roundtrip(self):
        for slug, label in TRICK_LABEL_MAP.items():
            assert label_to_trick(label) == slug

    def test_trick_label_map_inv_is_consistent(self):
        for label, slug in TRICK_LABEL_MAP_INV.items():
            assert TRICK_LABEL_MAP[slug] == label


# ---------------------------------------------------------------------------
# 7. Per-trick threshold loading
# ---------------------------------------------------------------------------

class TestPerTrickThresholdLoading:
    def setup_method(self):
        invalidate_cache()

    def test_sit_thresholds_loaded(self):
        config = get_trick_config("sit")
        assert config is not None
        assert config.thresholds.pass_confidence_threshold > 0
        assert config.thresholds.minimum_recording_duration_ms == 2000
        assert config.thresholds.hold_duration_ms == 700

    def test_stay_thresholds_differ_from_sit(self):
        sit = get_trick_config("sit")
        stay = get_trick_config("stay")
        assert sit is not None and stay is not None
        assert stay.thresholds.minimum_recording_duration_ms > sit.thresholds.minimum_recording_duration_ms
        assert stay.thresholds.hold_duration_ms > sit.thresholds.hold_duration_ms  # type: ignore[operator]

    def test_spin_has_lower_visibility_requirement(self):
        sit = get_trick_config("sit")
        spin = get_trick_config("spin")
        assert sit is not None and spin is not None
        assert spin.thresholds.minimum_visible_joints <= sit.thresholds.minimum_visible_joints

    def test_unknown_slug_returns_none(self):
        assert get_trick_config("nonexistent_trick") is None

    def test_is_known_trick_true_for_vocabulary(self):
        for slug in ["sit", "down", "stay", "paw", "stand", "spin"]:
            assert is_known_trick(slug), f"{slug} should be in vocabulary"

    def test_is_known_trick_false_for_unknown(self):
        assert not is_known_trick("moonwalk")
        assert not is_known_trick("")

    def test_is_active_trick_true_for_all_defaults(self):
        for slug in ["sit", "down", "stay", "paw", "stand", "spin"]:
            assert is_active_trick(slug), f"{slug} should be active"

    def test_feedback_format_substitutes_trick_name(self):
        config = get_trick_config("stay")
        assert config is not None
        msg = config.format_feedback("insufficient_hold")
        assert "stay" in msg.lower()

    def test_each_trick_has_distinct_hold_duration(self):
        sit = get_trick_config("sit")
        stay = get_trick_config("stay")
        paw = get_trick_config("paw")
        assert sit.thresholds.hold_duration_ms == 700
        assert stay.thresholds.hold_duration_ms == 3000
        assert paw.thresholds.hold_duration_ms is None

    def test_export_config_accepts_tricks_list(self):
        from app.models.dataset_models import ExportConfig
        config = ExportConfig(tricks=["sit", "down", "stay"])
        assert config.tricks == ["sit", "down", "stay"]
        assert config.trick == "sit"  # backward-compat property

    def test_export_config_accepts_single_string(self):
        from app.models.dataset_models import ExportConfig
        config = ExportConfig(tricks="sit")
        assert config.tricks == ["sit"]
        assert config.trick == "sit"
