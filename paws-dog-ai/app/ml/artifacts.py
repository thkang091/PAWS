"""
Save and load model artifacts for the learned sit classifier.

Artifact directory structure:
  <artifact_dir>/
    model.pt           torch state dict
    model_config.json  architecture config + preprocessing config
    label_map.json     {0: "failed", 1: "passed"}
    eval_summary.json  evaluation metrics from training
"""

from __future__ import annotations

import json
from pathlib import Path

from app.ml.pose_dataset import LABEL_MAP, LABEL_MAP_INV, TRICK_LABEL_MAP, TRICK_LABEL_MAP_INV
from app.ml.preprocessing import PreprocessConfig


ARTIFACT_VERSION = "1"


def save_artifacts(
    artifact_dir: str | Path,
    model,
    preprocess_config: PreprocessConfig,
    eval_summary: dict,
    model_version: str,
) -> None:
    import torch  # noqa: PLC0415

    path = Path(artifact_dir)
    path.mkdir(parents=True, exist_ok=True)

    torch.save(model.state_dict(), path / "model.pt")

    # Determine which label map to save based on number of output classes.
    n_classes = model.config().get("n_classes", 2)
    label_map_inv = TRICK_LABEL_MAP_INV if n_classes > 2 else LABEL_MAP_INV

    config = {
        "artifact_version": ARTIFACT_VERSION,
        "model_version": model_version,
        "model_config": model.config(),
        "preprocess_config": preprocess_config.to_dict(),
        "label_mode": "trick" if n_classes > 2 else "binary",
    }
    (path / "model_config.json").write_text(json.dumps(config, indent=2))
    (path / "label_map.json").write_text(json.dumps(label_map_inv, indent=2))
    (path / "eval_summary.json").write_text(json.dumps(eval_summary, indent=2))


def load_artifact_config(artifact_dir: str | Path) -> dict:
    """Load config without requiring torch (for shadow service startup check)."""
    path = Path(artifact_dir) / "model_config.json"
    if not path.exists():
        raise FileNotFoundError(f"No model_config.json found in {artifact_dir}")
    return json.loads(path.read_text())


def load_model(artifact_dir: str | Path):
    """Load model weights into the correct architecture. Requires torch."""
    import torch  # noqa: PLC0415
    from app.ml.models.mlp_classifier import MLPSitClassifier  # noqa: PLC0415
    from app.ml.models.tcn_classifier import TCNSitClassifier  # noqa: PLC0415

    config = load_artifact_config(artifact_dir)
    mc = config["model_config"]
    model_type = mc["model_type"]

    if model_type == "mlp":
        model = MLPSitClassifier(
            input_dim=mc["input_dim"],
            hidden_sizes=mc.get("hidden_sizes", [64, 32]),
        )
    elif model_type == "tcn":
        model = TCNSitClassifier(
            input_dim=mc["input_dim"],
            hidden_dim=mc.get("hidden_dim", 64),
            dilations=mc.get("dilations", [1, 2, 4]),
        )
    elif model_type == "tbt":
        from app.ml.models.tbt import TBTConfig, TemporalBehaviorTransformer  # noqa: PLC0415
        tbt_cfg = TBTConfig.from_dict(mc)
        model = TemporalBehaviorTransformer(tbt_cfg)
    else:
        raise ValueError(f"Unknown model_type: {model_type}")

    state = torch.load(Path(artifact_dir) / "model.pt", map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.eval()
    return model, config


def load_preprocess_config(artifact_dir: str | Path) -> PreprocessConfig:
    config = load_artifact_config(artifact_dir)
    return PreprocessConfig.from_dict(config["preprocess_config"])
