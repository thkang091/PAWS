"""
Tests for ML models, artifact loading, and shadow-mode fallback.

Tests that require torch are skipped if torch is not installed.
"""

import json
import numpy as np
import pytest

torch = pytest.importorskip("torch")

from app.ml.models.mlp_classifier import MLPSitClassifier
from app.ml.models.tcn_classifier import TCNSitClassifier
from app.ml.preprocessing import AGG_FEATURE_DIM, FRAME_DIM, PreprocessConfig


# ---------------------------------------------------------------------------
# MLP
# ---------------------------------------------------------------------------

class TestMLPClassifier:
    def test_mlp_forward_correct_output_shape(self):
        model = MLPSitClassifier(input_dim=AGG_FEATURE_DIM, hidden_sizes=[32])
        x = torch.randn(4, AGG_FEATURE_DIM)
        out = model(x)
        assert out.shape == (4, 2)

    def test_logreg_forward(self):
        model = MLPSitClassifier(input_dim=AGG_FEATURE_DIM, hidden_sizes=[])
        x = torch.randn(8, AGG_FEATURE_DIM)
        out = model(x)
        assert out.shape == (8, 2)

    def test_mlp_config_round_trip(self):
        model = MLPSitClassifier(input_dim=53, hidden_sizes=[64, 32])
        assert model.config()["model_type"] == "mlp"
        assert model.config()["hidden_sizes"] == [64, 32]


# ---------------------------------------------------------------------------
# TCN
# ---------------------------------------------------------------------------

class TestTCNClassifier:
    def test_tcn_forward_correct_output_shape(self):
        model = TCNSitClassifier(input_dim=FRAME_DIM, hidden_dim=32)
        x = torch.randn(4, FRAME_DIM, 60)   # (batch, channels, time)
        out = model(x)
        assert out.shape == (4, 2)

    def test_tcn_different_seq_lens(self):
        model = TCNSitClassifier(input_dim=FRAME_DIM, hidden_dim=16)
        for T in [10, 30, 60, 90]:
            x = torch.randn(2, FRAME_DIM, T)
            out = model(x)
            assert out.shape == (2, 2), f"Failed for T={T}"

    def test_tcn_config(self):
        model = TCNSitClassifier(input_dim=40, hidden_dim=64, dilations=[1, 2, 4])
        cfg = model.config()
        assert cfg["model_type"] == "tcn"
        assert cfg["dilations"] == [1, 2, 4]


# ---------------------------------------------------------------------------
# Artifact save / load
# ---------------------------------------------------------------------------

class TestArtifacts:
    def test_save_and_load_mlp(self, tmp_path):
        from app.ml.artifacts import load_model, load_preprocess_config, save_artifacts

        model = MLPSitClassifier(input_dim=AGG_FEATURE_DIM, hidden_sizes=[32])
        config = PreprocessConfig(seq_len=45)
        eval_summary = {"overall": {"accuracy": 0.90}}

        artifact_dir = tmp_path / "mlp_test"
        save_artifacts(artifact_dir, model, config, eval_summary, model_version="0.2.0")

        assert (artifact_dir / "model.pt").exists()
        assert (artifact_dir / "model_config.json").exists()
        assert (artifact_dir / "label_map.json").exists()
        assert (artifact_dir / "eval_summary.json").exists()

        loaded_model, loaded_cfg = load_model(artifact_dir)
        assert loaded_model.config()["model_type"] == "mlp"

        loaded_pre = load_preprocess_config(artifact_dir)
        assert loaded_pre.seq_len == 45

    def test_save_and_load_tcn(self, tmp_path):
        from app.ml.artifacts import load_model, save_artifacts

        model = TCNSitClassifier(input_dim=FRAME_DIM, hidden_dim=16, dilations=[1, 2])
        config = PreprocessConfig()
        eval_summary = {"overall": {"f1": 0.88}}

        artifact_dir = tmp_path / "tcn_test"
        save_artifacts(artifact_dir, model, config, eval_summary, model_version="0.2.0")

        loaded_model, cfg = load_model(artifact_dir)
        assert loaded_model.config()["model_type"] == "tcn"
        assert loaded_model.config()["dilations"] == [1, 2]

    def test_loaded_model_weights_match(self, tmp_path):
        from app.ml.artifacts import load_model, save_artifacts

        model = MLPSitClassifier(input_dim=AGG_FEATURE_DIM, hidden_sizes=[16])
        save_artifacts(tmp_path / "m", model, PreprocessConfig(), {}, "0.2.0")
        loaded, _ = load_model(tmp_path / "m")

        x = torch.randn(2, AGG_FEATURE_DIM)
        model.eval()
        loaded.eval()
        with torch.no_grad():
            assert torch.allclose(model(x), loaded(x))

    def test_missing_artifact_raises(self, tmp_path):
        from app.ml.artifacts import load_model
        with pytest.raises(FileNotFoundError):
            load_model(tmp_path / "nonexistent")


# ---------------------------------------------------------------------------
# Shadow-mode fallback
# ---------------------------------------------------------------------------

class TestShadowModeFallback:
    def test_shadow_does_not_raise_on_missing_artifact(self):
        """Shadow service must be silent when artifact doesn't exist."""
        from unittest.mock import MagicMock
        from app.ml.shadow_service import run_shadow

        pose_sequence = MagicMock()
        pose_sequence.frames = []

        result = MagicMock()
        result.verification_id = "test-ver"
        result.status = "passed"

        # Should not raise even though artifact path is missing.
        run_shadow(pose_sequence, result, "/nonexistent/path/to/artifact")

    def test_shadow_does_not_raise_on_inference_error(self, tmp_path):
        """Shadow service swallows all errors."""
        from unittest.mock import MagicMock, patch
        from app.ml.shadow_service import run_shadow

        pose_sequence = MagicMock()
        pose_sequence.frames = []

        result = MagicMock()
        result.verification_id = "test-ver"
        result.status = "passed"

        with patch("app.ml.shadow_service._shadow_inference", side_effect=RuntimeError("crash")):
            run_shadow(pose_sequence, result, str(tmp_path / "artifact"))
        # If we reach here, the error was swallowed correctly.

    def test_shadow_result_does_not_modify_rule_based_result(self, tmp_path):
        """The rule-based result object must be unchanged after shadow runs."""
        from unittest.mock import MagicMock
        from app.ml.shadow_service import run_shadow
        from app.ml.artifacts import save_artifacts

        # Save a real small MLP artifact so shadow can load it.
        model = MLPSitClassifier(input_dim=AGG_FEATURE_DIM, hidden_sizes=[])
        artifact_dir = tmp_path / "shadow_test"
        save_artifacts(artifact_dir, model, PreprocessConfig(), {}, "0.2.0")

        # Patch model_config to say "aggregate" mode so it uses MLP path.
        cfg_path = artifact_dir / "model_config.json"
        cfg = json.loads(cfg_path.read_text())
        cfg["model_config"]["model_type"] = "aggregate"
        cfg_path.write_text(json.dumps(cfg))

        from app.models.pose_models import PoseSequence, VideoMetadata
        pose_sequence = PoseSequence(
            model_name="test",
            metadata=VideoMetadata(duration_seconds=1.0, fps=30.0, width=640, height=480, frame_count=0),
            frames=[],
            average_confidence=0.0,
            required_keypoint_visibility_ratio=0.0,
            dog_frame_coverage_ratio=0.0,
        )

        from app.models.response_models import ActivityAnalysisResponse
        result = ActivityAnalysisResponse(
            verification_id="shadow-test",
            activity_id="sit",
            status="passed",
            confidence_score=0.88,
            model_name="rule_based",
            analysis_summary={},
            failure_reason=None,
            retry_guidance=None,
        )

        from app.ml.shadow_service import _model_cache
        _model_cache.clear()  # Reset cache for this test.

        run_shadow(pose_sequence, result, str(artifact_dir))

        # Rule-based result must be completely unchanged.
        assert result.status == "passed"
        assert result.confidence_score == 0.88
        assert result.model_name == "rule_based"
