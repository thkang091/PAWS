"""
Tests for the Temporal Behavior Transformer and supporting modules.

Covers:
  1. Model forward pass (output shapes, all heads)
  2. Variable batch size
  3. Preprocessing compatibility (motion features, TBT input dim)
  4. Model artifact loading (save/load round-trip)
  5. ONNX export parity
  6. Deterministic evaluation (same input → same output)
  7. Calibration serialisation
  8. Augmentations (shape preservation, edge cases)
  9. Multi-task loss computation
  10. Comparison report construction
"""

import json
import numpy as np
import pytest

torch = pytest.importorskip("torch")

from app.ml.models.tbt import TBTConfig, TBTOutput, TemporalBehaviorTransformer
from app.ml.preprocessing import (
    FRAME_DIM, MOTION_DIM, TBT_INPUT_DIM,
    build_tbt_features, compute_motion_features, PreprocessConfig,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def small_cfg():
    """Tiny TBT config for fast unit tests."""
    return TBTConfig(
        model_dim=32,
        n_heads=2,
        n_layers=1,
        tcn_channels=32,
        tcn_dilations=[1, 2],
        n_trick_classes=7,
        n_failure_reasons=6,
        seq_len=20,
    )


@pytest.fixture
def small_model(small_cfg):
    m = TemporalBehaviorTransformer(small_cfg)
    m.eval()
    return m


def _random_batch(batch_size: int, in_dim: int, seq_len: int) -> torch.Tensor:
    return torch.randn(batch_size, in_dim, seq_len)


def _make_frames(n: int = 30) -> list[dict]:
    """Minimal frame dicts for preprocessing tests."""
    frames = []
    for i in range(n):
        kps = {}
        for name in [
            "nose", "left_shoulder", "right_shoulder", "left_hip", "right_hip",
            "tail_base", "left_front_paw", "right_front_paw", "left_hind_paw", "right_hind_paw",
        ]:
            kps[name] = {"x": float(i) * 0.01, "y": float(i) * 0.02, "confidence": 0.90}
        frames.append({"frame_index": i, "timestamp_ms": i * 33, "keypoints": kps, "confidence": 0.90})
    return frames


# ---------------------------------------------------------------------------
# 1. Model forward pass
# ---------------------------------------------------------------------------

class TestTBTForwardPass:
    def test_output_is_tbtoutput_dataclass(self, small_model, small_cfg):
        x = _random_batch(2, small_cfg.in_dim, small_cfg.seq_len)
        out = small_model(x)
        assert isinstance(out, TBTOutput)

    def test_global_trick_logits_shape(self, small_model, small_cfg):
        x = _random_batch(3, small_cfg.in_dim, small_cfg.seq_len)
        out = small_model(x)
        assert out.global_trick_logits.shape == (3, small_cfg.n_trick_classes)

    def test_frame_trick_logits_shape(self, small_model, small_cfg):
        x = _random_batch(2, small_cfg.in_dim, small_cfg.seq_len)
        out = small_model(x)
        assert out.frame_trick_logits.shape == (2, small_cfg.seq_len, small_cfg.n_trick_classes)

    def test_completion_score_shape_and_range(self, small_model, small_cfg):
        x = _random_batch(4, small_cfg.in_dim, small_cfg.seq_len)
        out = small_model(x)
        assert out.completion_score.shape == (4, 1)
        assert (out.completion_score >= 0).all()
        assert (out.completion_score <= 1).all()

    def test_boundary_logits_shape(self, small_model, small_cfg):
        x = _random_batch(2, small_cfg.in_dim, small_cfg.seq_len)
        out = small_model(x)
        assert out.boundary_logits.shape == (2, small_cfg.seq_len, 2)

    def test_failure_reason_logits_shape(self, small_model, small_cfg):
        x = _random_batch(2, small_cfg.in_dim, small_cfg.seq_len)
        out = small_model(x)
        assert out.failure_reason_logits.shape == (2, small_cfg.n_failure_reasons)

    def test_no_nan_in_outputs(self, small_model, small_cfg):
        x = _random_batch(4, small_cfg.in_dim, small_cfg.seq_len)
        out = small_model(x)
        for tensor in [out.global_trick_logits, out.completion_score,
                       out.failure_reason_logits]:
            assert not torch.isnan(tensor).any(), f"NaN in {tensor}"

    def test_forward_onnx_returns_three_tensors(self, small_model, small_cfg):
        x = _random_batch(1, small_cfg.in_dim, small_cfg.seq_len)
        result = small_model.forward_onnx(x)
        assert len(result) == 3
        assert result[0].shape == (1, small_cfg.n_trick_classes)
        assert result[1].shape == (1, 1)
        assert result[2].shape == (1, small_cfg.n_failure_reasons)


# ---------------------------------------------------------------------------
# 2. Variable batch size
# ---------------------------------------------------------------------------

class TestVariableBatchSize:
    @pytest.mark.parametrize("B", [1, 2, 8, 16])
    def test_batch_size(self, small_model, small_cfg, B):
        x = _random_batch(B, small_cfg.in_dim, small_cfg.seq_len)
        out = small_model(x)
        assert out.global_trick_logits.shape[0] == B
        assert out.completion_score.shape[0] == B

    def test_single_sample_same_as_batch(self, small_model, small_cfg):
        """Predictions for one sample must be identical in batch-1 and batch-4."""
        x1 = _random_batch(1, small_cfg.in_dim, small_cfg.seq_len)
        x4 = x1.expand(4, -1, -1)
        with torch.no_grad():
            out1 = small_model(x1)
            out4 = small_model(x4)
        assert torch.allclose(
            out1.global_trick_logits,
            out4.global_trick_logits[:1],
            atol=1e-5,
        )


# ---------------------------------------------------------------------------
# 3. Preprocessing compatibility
# ---------------------------------------------------------------------------

class TestPreprocessingCompatibility:
    def test_frame_dim_constant(self):
        assert FRAME_DIM == 40

    def test_motion_dim_constant(self):
        assert MOTION_DIM == 20

    def test_tbt_input_dim_constant(self):
        assert TBT_INPUT_DIM == 60

    def test_compute_motion_features_shape(self):
        config = PreprocessConfig(seq_len=30)
        from app.ml.preprocessing import preprocess_sequence
        feats, _ = preprocess_sequence(_make_frames(30), config)
        motion = compute_motion_features(feats)
        assert motion.shape == (30, MOTION_DIM)

    def test_motion_frame_zero_is_all_zeros(self):
        from app.ml.preprocessing import preprocess_sequence
        feats, _ = preprocess_sequence(_make_frames(20), PreprocessConfig(seq_len=20))
        motion = compute_motion_features(feats)
        assert (motion[0] == 0).all()

    def test_build_tbt_features_shape(self):
        config = PreprocessConfig(seq_len=30)
        tbt = build_tbt_features(_make_frames(30), config)
        assert tbt.shape == (30, TBT_INPUT_DIM)

    def test_build_tbt_features_empty_frames(self):
        config = PreprocessConfig(seq_len=20)
        tbt = build_tbt_features([], config)
        assert tbt.shape == (20, TBT_INPUT_DIM)
        assert (tbt == 0).all()

    def test_tbt_features_match_model_in_dim(self, small_cfg):
        """build_tbt_features output width must match model.cfg.in_dim."""
        config = PreprocessConfig(seq_len=small_cfg.seq_len)
        tbt = build_tbt_features(_make_frames(small_cfg.seq_len), config)
        assert tbt.shape[1] == small_cfg.in_dim


# ---------------------------------------------------------------------------
# 4. Model artifact loading
# ---------------------------------------------------------------------------

class TestArtifactLoading:
    def test_save_and_load_tbt(self, tmp_path, small_cfg):
        from app.ml.artifacts import load_model, save_artifacts

        model = TemporalBehaviorTransformer(small_cfg)
        config = PreprocessConfig(seq_len=small_cfg.seq_len)

        artifact_dir = tmp_path / "tbt_test"
        save_artifacts(artifact_dir, model, config, {"overall": {"f1": 0.9}}, "tbt_v0.1")

        assert (artifact_dir / "model.pt").exists()
        assert (artifact_dir / "model_config.json").exists()
        assert (artifact_dir / "label_map.json").exists()

        loaded_model, loaded_cfg = load_model(artifact_dir)
        assert loaded_cfg["model_config"]["model_type"] == "tbt"

    def test_loaded_tbt_weights_match(self, tmp_path, small_cfg):
        from app.ml.artifacts import load_model, save_artifacts

        model = TemporalBehaviorTransformer(small_cfg)
        model.eval()
        artifact_dir = tmp_path / "tbt_weights"
        save_artifacts(artifact_dir, model, PreprocessConfig(), {}, "test")

        loaded, _ = load_model(artifact_dir)
        loaded.eval()

        x = _random_batch(1, small_cfg.in_dim, small_cfg.seq_len)
        with torch.no_grad():
            out_orig = model(x).global_trick_logits
            out_load = loaded(x).global_trick_logits
        assert torch.allclose(out_orig, out_load, atol=1e-6)

    def test_config_round_trip(self, small_cfg):
        d = small_cfg.to_dict()
        restored = TBTConfig.from_dict(d)
        assert restored.model_dim == small_cfg.model_dim
        assert restored.n_trick_classes == small_cfg.n_trick_classes
        assert restored.n_layers == small_cfg.n_layers


# ---------------------------------------------------------------------------
# 5. ONNX export parity
# ---------------------------------------------------------------------------

# onnxscript is required by newer torch.onnx.export; skip gracefully when absent.
try:
    import onnxscript as _onnxscript  # noqa: F401
    import onnxruntime as _ort  # noqa: F401
    _ONNX_AVAILABLE = True
except ModuleNotFoundError:
    _ONNX_AVAILABLE = False

_skip_onnx = pytest.mark.skipif(not _ONNX_AVAILABLE, reason="onnxscript/onnxruntime not installed")


class TestOnnxParity:
    @_skip_onnx
    def test_onnx_export_creates_file(self, tmp_path, small_model):
        from app.ml.onnx_export import export_onnx
        onnx_path = export_onnx(small_model, tmp_path)
        assert onnx_path.exists()
        assert onnx_path.suffix == ".onnx"

    @_skip_onnx
    def test_onnx_parity_with_pytorch(self, tmp_path, small_model):
        from app.ml.onnx_export import export_onnx, verify_onnx_parity
        onnx_path = export_onnx(small_model, tmp_path)
        diffs = verify_onnx_parity(small_model, onnx_path, rtol=1e-3, atol=1e-4)
        for name, diff in diffs.items():
            assert diff < 0.01, f"ONNX diff too large for {name}: {diff}"

    @_skip_onnx
    def test_onnx_inference_output_shapes(self, tmp_path, small_model, small_cfg):
        from app.ml.onnx_export import export_onnx, run_onnx_inference
        onnx_path = export_onnx(small_model, tmp_path)
        features = np.random.randn(small_cfg.in_dim, small_cfg.seq_len).astype(np.float32)
        outputs = run_onnx_inference(onnx_path, features)
        assert outputs["global_trick_logits"].shape == (small_cfg.n_trick_classes,)
        assert outputs["completion_score"].shape == (1,)
        assert outputs["failure_reason_logits"].shape == (small_cfg.n_failure_reasons,)


# ---------------------------------------------------------------------------
# 6. Deterministic evaluation
# ---------------------------------------------------------------------------

class TestDeterministicEvaluation:
    def test_same_input_same_output_eval_mode(self, small_model, small_cfg):
        x = _random_batch(2, small_cfg.in_dim, small_cfg.seq_len)
        with torch.no_grad():
            out1 = small_model(x).global_trick_logits
            out2 = small_model(x).global_trick_logits
        assert torch.allclose(out1, out2)

    def test_train_vs_eval_dropout_differs(self, small_cfg):
        """In train mode with dropout, outputs should differ across calls."""
        model = TemporalBehaviorTransformer(small_cfg)
        model.train()
        x = _random_batch(4, small_cfg.in_dim, small_cfg.seq_len)
        out1 = model(x).global_trick_logits.detach()
        out2 = model(x).global_trick_logits.detach()
        # With dropout, repeated forward passes should produce different results.
        # There's a tiny probability they happen to be equal — but for B=4 this
        # is negligible.
        assert not torch.allclose(out1, out2), (
            "Expected dropout to produce different outputs in train mode"
        )


# ---------------------------------------------------------------------------
# 7. Calibration serialisation
# ---------------------------------------------------------------------------

class TestCalibrationSerialisation:
    def test_calibrate_model_returns_expected_keys(self):
        from app.ml.calibration import calibrate_model
        rng = np.random.default_rng(0)
        N, C = 50, 7
        logits = rng.standard_normal((N, C)).astype(np.float32)
        labels = rng.integers(0, C, size=N)
        result = calibrate_model(logits, labels)
        assert "temperature" in result
        assert "ece_before" in result
        assert "ece_after" in result
        assert result["temperature"] > 0

    def test_save_and_load_calibration(self, tmp_path):
        from app.ml.calibration import load_calibration, save_calibration
        cal = {"temperature": 1.42, "ece_before": 0.12, "ece_after": 0.07,
               "n_samples": 100, "n_bins": 10}
        save_calibration(tmp_path, cal)
        loaded = load_calibration(tmp_path)
        assert loaded is not None
        assert loaded["temperature"] == pytest.approx(1.42)
        assert loaded["ece_before"] == pytest.approx(0.12)

    def test_load_calibration_missing_returns_none(self, tmp_path):
        from app.ml.calibration import load_calibration
        # No model_config.json in tmp_path
        assert load_calibration(tmp_path / "nonexistent") is None

    def test_calibration_survives_artifact_save_load(self, tmp_path, small_cfg):
        from app.ml.artifacts import load_artifact_config, save_artifacts
        from app.ml.calibration import save_calibration

        model = TemporalBehaviorTransformer(small_cfg)
        artifact_dir = tmp_path / "cal_test"
        save_artifacts(artifact_dir, model, PreprocessConfig(), {}, "test")

        cal = {"temperature": 1.2, "ece_before": 0.15, "ece_after": 0.08,
               "n_samples": 200, "n_bins": 10}
        save_calibration(artifact_dir, cal)

        loaded_cfg = load_artifact_config(artifact_dir)
        assert loaded_cfg["calibration"]["temperature"] == pytest.approx(1.2)

    def test_apply_temperature_softmax_sums_to_one(self):
        from app.ml.calibration import apply_temperature
        rng = np.random.default_rng(42)
        logits = rng.standard_normal((8, 7)).astype(np.float32)
        probs = apply_temperature(logits, temperature=1.5)
        sums = probs.sum(axis=1)
        np.testing.assert_allclose(sums, 1.0, atol=1e-5)

    def test_ece_perfect_model_is_zero(self):
        from app.ml.calibration import compute_ece
        # Perfect predictions: prob 1.0 on the correct class.
        N, C = 100, 4
        probs = np.zeros((N, C), dtype=np.float32)
        labels = np.arange(N) % C
        probs[np.arange(N), labels] = 1.0
        ece = compute_ece(probs, labels)
        assert ece == pytest.approx(0.0, abs=1e-6)


# ---------------------------------------------------------------------------
# 8. Augmentation tests
# ---------------------------------------------------------------------------

class TestAugmentations:
    def _base_features(self, T=20):
        """Random feature array of shape (T, FRAME_DIM)."""
        rng = np.random.default_rng(1)
        arr = rng.standard_normal((T, FRAME_DIM)).astype(np.float32)
        # Make visibility mask sensible (0 or 1).
        arr[:, 30:] = (rng.random((T, 10)) > 0.2).astype(np.float32)
        return arr

    def test_horizontal_mirror_preserves_shape(self):
        from app.ml.augmentations import horizontal_mirror
        feats = self._base_features()
        rng = np.random.default_rng(0)
        result = horizontal_mirror(feats, rng, p=1.0)
        assert result.shape == feats.shape

    def test_horizontal_mirror_changes_x_coords(self):
        from app.ml.augmentations import horizontal_mirror
        feats = self._base_features()
        feats[0, 0] = 0.5   # nose x
        rng = np.random.default_rng(0)
        result = horizontal_mirror(feats, rng, p=1.0)
        assert result[0, 0] == pytest.approx(-0.5)

    def test_keypoint_noise_preserves_shape(self):
        from app.ml.augmentations import add_keypoint_noise
        feats = self._base_features()
        rng = np.random.default_rng(0)
        result = add_keypoint_noise(feats, rng, p=1.0)
        assert result.shape == feats.shape

    def test_joint_dropout_zeros_visibility(self):
        from app.ml.augmentations import random_joint_dropout
        feats = self._base_features()
        feats[:, 30:] = 1.0   # all joints visible
        rng = np.random.default_rng(99)
        result = random_joint_dropout(feats, rng, p_per_joint=1.0, p_apply=1.0)
        # All visibility columns should be zero.
        assert result[:, 30:].sum() == pytest.approx(0.0)

    def test_speed_variation_preserves_shape(self):
        from app.ml.augmentations import temporal_speed_variation
        feats = self._base_features(T=20)
        rng = np.random.default_rng(7)
        result = temporal_speed_variation(feats, rng, p=1.0)
        assert result.shape == feats.shape

    def test_sequence_crop_preserves_shape(self):
        from app.ml.augmentations import small_sequence_crop
        feats = self._base_features(T=20)
        rng = np.random.default_rng(3)
        result = small_sequence_crop(feats, rng, p=1.0)
        assert result.shape == feats.shape

    def test_missing_frame_simulation_preserves_shape(self):
        from app.ml.augmentations import missing_frame_simulation
        feats = self._base_features(T=20)
        rng = np.random.default_rng(5)
        result = missing_frame_simulation(feats, rng, p_per_frame=0.5, p_apply=1.0)
        assert result.shape == feats.shape

    def test_composed_augmentations_preserve_shape(self):
        from app.ml.augmentations import apply_augmentations
        feats = self._base_features(T=20)
        rng = np.random.default_rng(42)
        result = apply_augmentations(feats, rng)
        assert result.shape == feats.shape

    def test_augmentations_with_tbt_features(self):
        """Augmentations must work on the wider TBT feature array (seq_len, 60)."""
        from app.ml.augmentations import apply_augmentations
        rng_np = np.random.default_rng(0)
        feats = rng_np.standard_normal((20, TBT_INPUT_DIM)).astype(np.float32)
        aug_rng = np.random.default_rng(1)
        result = apply_augmentations(feats, aug_rng)
        assert result.shape == (20, TBT_INPUT_DIM)


# ---------------------------------------------------------------------------
# 9. Multi-task loss
# ---------------------------------------------------------------------------

class TestMultiTaskLoss:
    def test_loss_returns_total(self, small_cfg):
        from app.ml.losses import TBTLoss, LossWeights

        model = TemporalBehaviorTransformer(small_cfg)
        x = _random_batch(2, small_cfg.in_dim, small_cfg.seq_len)
        out = model(x)

        targets = {
            "trick_label":      torch.randint(0, small_cfg.n_trick_classes, (2,)),
            "completion_label": torch.rand(2),
            "failure_label":    torch.randint(0, small_cfg.n_failure_reasons, (2,)),
        }
        loss_fn = TBTLoss()
        losses = loss_fn(out, targets)
        assert "total" in losses
        assert losses["total"].item() > 0

    def test_loss_all_components_present(self, small_cfg):
        from app.ml.losses import TBTLoss

        model = TemporalBehaviorTransformer(small_cfg)
        x = _random_batch(2, small_cfg.in_dim, small_cfg.seq_len)
        out = model(x)

        targets = {
            "trick_label":      torch.zeros(2, dtype=torch.long),
            "completion_label": torch.ones(2),
            "failure_label":    torch.full((2,), -100, dtype=torch.long),
        }
        losses = TBTLoss()(out, targets)
        for key in ["global", "frame", "completion", "boundary", "failure", "total"]:
            assert key in losses, f"Missing loss component: {key}"

    def test_loss_zero_weights(self, small_cfg):
        from app.ml.losses import TBTLoss, LossWeights

        model = TemporalBehaviorTransformer(small_cfg)
        x = _random_batch(2, small_cfg.in_dim, small_cfg.seq_len)
        out = model(x)

        # With all auxiliary weights = 0, total should equal global loss only.
        w = LossWeights(global_trick=1.0, frame_trick=0.0, completion=0.0,
                        boundary=0.0, failure=0.0)
        targets = {
            "trick_label": torch.zeros(2, dtype=torch.long),
        }
        losses = TBTLoss(w)(out, targets)
        assert torch.allclose(losses["total"], losses["global"])

    def test_status_to_failure_label(self):
        from app.ml.losses import TBTLoss, status_to_failure_label
        assert status_to_failure_label("passed") == TBTLoss.FAILURE_IGNORE_INDEX
        assert status_to_failure_label("failed_no_valid_activity") == 4
        assert status_to_failure_label("retry_low_confidence") == 1


# ---------------------------------------------------------------------------
# 10. Comparison report
# ---------------------------------------------------------------------------

class TestComparisonReport:
    def test_report_contains_all_models(self):
        from app.ml.comparison import ModelResult, build_comparison_report

        r1 = ModelResult(
            model_name="rule_based",
            y_true=[0, 1, 2, 0, 3],
            y_pred=[0, 1, 2, 1, 3],
            probs=None,
        )
        r2 = ModelResult(
            model_name="tbt_candidate",
            y_true=[0, 1, 2, 0, 3],
            y_pred=[0, 1, 2, 0, 3],
            probs=None,
        )
        report = build_comparison_report([r1, r2])
        model_names = [m["model_name"] for m in report["models"]]
        assert "rule_based" in model_names
        assert "tbt_candidate" in model_names

    def test_leaderboard_sorted_by_f1(self):
        from app.ml.comparison import ModelResult, build_comparison_report

        perfect = ModelResult(
            model_name="perfect", y_true=[1, 0, 1], y_pred=[1, 0, 1], probs=None,
        )
        bad = ModelResult(
            model_name="bad", y_true=[1, 0, 1], y_pred=[0, 1, 0], probs=None,
        )
        report = build_comparison_report([bad, perfect])
        assert report["leaderboard"][0]["model"] == "perfect"

    def test_format_report_is_string(self):
        from app.ml.comparison import ModelResult, build_comparison_report, format_report

        r = ModelResult(
            model_name="test",
            y_true=[0, 1, 2],
            y_pred=[0, 1, 2],
            probs=None,
            latency_ms_per_sample=5.0,
            n_parameters=750_000,
            size_bytes=3_000_000,
        )
        report = build_comparison_report([r])
        text = format_report(report)
        assert "test" in text
        assert "Leaderboard" in text

    def test_model_size_recorded(self, small_model, small_cfg):
        """TemporalBehaviorTransformer must expose n_parameters() and size_bytes()."""
        n_params = small_model.n_parameters()
        size = small_model.size_bytes()
        assert n_params > 0
        assert size > 0
        # size_bytes for float32 = 4 × n_params
        assert size == n_params * 4
