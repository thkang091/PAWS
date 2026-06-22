"""
Tests for pose sequence preprocessing.

Pure numpy — runs without torch installed.
"""

import numpy as np
import pytest

from app.ml.preprocessing import (
    AGG_FEATURE_DIM,
    FRAME_DIM,
    KEYPOINT_ORDER,
    N_KEYPOINTS,
    PreprocessConfig,
    aggregate_features,
    preprocess_sequence,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _frame(
    index: int,
    confidence: float = 0.90,
    missing: list[str] | None = None,
    base_x: float = 100.0,
    base_y: float = 100.0,
) -> dict:
    missing = set(missing or [])
    kps = {}
    for i, name in enumerate(KEYPOINT_ORDER):
        if name in missing:
            kps[name] = {"x": None, "y": None, "confidence": 0.0}
        else:
            kps[name] = {
                "x": base_x + i * 10.0,
                "y": base_y + i * 5.0,
                "confidence": confidence,
            }
    return {
        "frame_index": index,
        "timestamp_ms": index * 33,
        "keypoints": kps,
        "confidence": confidence,
    }


def _frames(n: int, **kwargs) -> list[dict]:
    return [_frame(i, **kwargs) for i in range(n)]


# ---------------------------------------------------------------------------
# Output shape
# ---------------------------------------------------------------------------

class TestOutputShape:
    def test_clean_sequence_correct_shape(self):
        config = PreprocessConfig(seq_len=60)
        features, _ = preprocess_sequence(_frames(30), config)
        assert features.shape == (60, FRAME_DIM)
        assert features.dtype == np.float32

    def test_long_sequence_truncated_to_seq_len(self):
        config = PreprocessConfig(seq_len=40)
        features, meta = preprocess_sequence(_frames(80), config)
        assert features.shape == (40, FRAME_DIM)
        assert meta["n_raw_frames"] == 80

    def test_short_sequence_padded_to_seq_len(self):
        config = PreprocessConfig(seq_len=60)
        features, meta = preprocess_sequence(_frames(10), config)
        assert features.shape == (60, FRAME_DIM)
        assert meta["n_raw_frames"] == 10
        # Padded rows should be zero.
        assert np.all(features[10:] == 0.0)

    def test_empty_sequence_returns_zero_array(self):
        config = PreprocessConfig(seq_len=60)
        features, meta = preprocess_sequence([], config)
        assert features.shape == (60, FRAME_DIM)
        assert np.all(features == 0.0)
        assert meta["n_raw_frames"] == 0

    def test_aggregate_features_correct_dim(self):
        feat = aggregate_features(_frames(30))
        assert feat.shape == (AGG_FEATURE_DIM,)
        assert feat.dtype == np.float32


# ---------------------------------------------------------------------------
# Determinism
# ---------------------------------------------------------------------------

class TestDeterminism:
    def test_preprocessing_is_deterministic(self):
        frames = _frames(30)
        config = PreprocessConfig(seq_len=60)
        f1, _ = preprocess_sequence(frames, config)
        f2, _ = preprocess_sequence(frames, config)
        np.testing.assert_array_equal(f1, f2)

    def test_aggregate_is_deterministic(self):
        frames = _frames(30)
        f1 = aggregate_features(frames)
        f2 = aggregate_features(frames)
        np.testing.assert_array_equal(f1, f2)


# ---------------------------------------------------------------------------
# Missing keypoints
# ---------------------------------------------------------------------------

class TestMissingKeypoints:
    def test_missing_joint_visibility_mask_is_zero(self):
        missing = ["left_hip", "right_hip"]
        frames = _frames(30, missing=missing)
        config = PreprocessConfig(seq_len=60)
        features, _ = preprocess_sequence(frames, config)

        # Visibility mask is in the last N_KEYPOINTS columns.
        vis_start = N_KEYPOINTS * 3
        for name in missing:
            idx = KEYPOINT_ORDER.index(name)
            assert features[0, vis_start + idx] == 0.0, f"{name} should be invisible"

    def test_missing_joint_coordinates_are_zero(self):
        frames = _frames(30, missing=["nose"])
        features, _ = preprocess_sequence(frames)
        nose_idx = KEYPOINT_ORDER.index("nose")
        base = nose_idx * 3
        assert features[0, base] == 0.0    # x
        assert features[0, base + 1] == 0.0  # y

    def test_all_joints_missing_does_not_crash(self):
        frames = _frames(30, missing=KEYPOINT_ORDER)
        features, meta = preprocess_sequence(frames)
        assert features.shape == (60, FRAME_DIM)
        assert meta["body_scale_available"] is False


# ---------------------------------------------------------------------------
# Normalization
# ---------------------------------------------------------------------------

class TestNormalization:
    def test_visible_joints_are_body_centered(self):
        frames = _frames(5)
        features, meta = preprocess_sequence(frames, PreprocessConfig(seq_len=5))
        # With body-centered normalization the center should be near 0.
        # Check mean of x-coordinates for visible joints is small.
        vis_start = N_KEYPOINTS * 3
        for t in range(5):
            vis = features[t, vis_start:]
            x_vals = [features[t, i * 3] for i in range(N_KEYPOINTS) if vis[i] > 0]
            if x_vals:
                assert abs(np.mean(x_vals)) < 2.0, "Coordinates should be body-centered"

    def test_low_confidence_keypoint_not_used_for_normalization(self):
        # If anchor joints have low confidence, normalization should still succeed.
        frames = _frames(10, confidence=0.20)   # below 0.55 threshold
        features, meta = preprocess_sequence(frames)
        assert features is not None
        assert not meta["body_scale_available"]


# ---------------------------------------------------------------------------
# Sequence length edge cases
# ---------------------------------------------------------------------------

class TestSequenceEdgeCases:
    def test_single_frame_sequence(self):
        features, meta = preprocess_sequence([_frame(0)])
        assert features.shape[1] == FRAME_DIM
        assert meta["n_raw_frames"] == 1

    def test_exactly_seq_len_frames_no_padding(self):
        config = PreprocessConfig(seq_len=30)
        features, meta = preprocess_sequence(_frames(30), config)
        assert features.shape == (30, FRAME_DIM)
        assert meta["n_raw_frames"] == 30


# ---------------------------------------------------------------------------
# Interpolation
# ---------------------------------------------------------------------------

class TestInterpolation:
    def test_small_gap_is_interpolated(self):
        config = PreprocessConfig(seq_len=10, interpolate_gaps=True, max_interpolation_gap=2)
        frames = _frames(10)
        # Zero out a single frame's keypoints manually.
        frames[5]["keypoints"] = {
            name: {"x": None, "y": None, "confidence": 0.0}
            for name in KEYPOINT_ORDER
        }
        features, _ = preprocess_sequence(frames, config)
        nose_idx = KEYPOINT_ORDER.index("nose")
        base = nose_idx * 3
        # The interpolated x should be non-zero (between frame 4 and 6 values).
        assert features[5, base] != 0.0

    def test_large_gap_not_interpolated(self):
        config = PreprocessConfig(seq_len=20, interpolate_gaps=True, max_interpolation_gap=2)
        frames = _frames(20)
        # Zero out 5 consecutive frames — larger than max_interpolation_gap.
        for i in range(5, 10):
            frames[i]["keypoints"] = {
                name: {"x": None, "y": None, "confidence": 0.0}
                for name in KEYPOINT_ORDER
            }
        features, _ = preprocess_sequence(frames, config)
        nose_idx = KEYPOINT_ORDER.index("nose")
        base = nose_idx * 3
        # These frames should remain zero.
        assert features[7, base] == 0.0


# ---------------------------------------------------------------------------
# PreprocessConfig serialisation
# ---------------------------------------------------------------------------

class TestPreprocessConfig:
    def test_round_trip_serialization(self):
        cfg = PreprocessConfig(seq_len=45, confidence_threshold=0.60, max_interpolation_gap=5)
        d = cfg.to_dict()
        cfg2 = PreprocessConfig.from_dict(d)
        assert cfg2.seq_len == 45
        assert cfg2.confidence_threshold == 0.60
        assert cfg2.max_interpolation_gap == 5
