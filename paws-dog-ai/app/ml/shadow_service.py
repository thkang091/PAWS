"""
Shadow-mode inference service.

The rule-based SitClassifier remains authoritative. When shadow mode is
enabled (config.shadow_mode_enabled=True) and a valid artifact exists at
config.ml_artifact_path, the learned model runs in parallel on the same
pose sequence and logs any disagreements.

This service:
  - Never changes the user-visible result
  - Falls back silently on any error (missing torch, missing artifact,
    inference failure)
  - Is called from main.py AFTER the rule-based result is finalized
"""

from __future__ import annotations

from app.models.pose_models import PoseSequence
from app.models.response_models import ActivityAnalysisResponse
from app.utils.logging import log_error, log_info, log_warn

_model_cache: dict[str, object] = {}


def run_shadow(
    pose_sequence: PoseSequence,
    rule_based_result: ActivityAnalysisResponse,
    artifact_path: str,
) -> tuple[bool, str | None, float | None]:
    """
    Runs the learned model in shadow mode. Never raises. Never modifies
    rule_based_result.

    Returns (disagrees, learned_prediction, learned_confidence).
    """
    try:
        return _shadow_inference(pose_sequence, rule_based_result, artifact_path)
    except Exception as exc:  # noqa: BLE001
        log_error(
            "shadow_service",
            "shadow_inference_error",
            verification_id=rule_based_result.verification_id,
            error=str(exc),
        )
        return False, None, None


def _shadow_inference(
    pose_sequence: PoseSequence,
    rule_based_result: ActivityAnalysisResponse,
    artifact_path: str,
) -> tuple[bool, str | None, float | None]:
    import torch  # noqa: PLC0415

    from app.ml.artifacts import load_artifact_config, load_model, load_preprocess_config
    from app.ml.preprocessing import aggregate_features, preprocess_sequence

    # Load model (cached by artifact_path).
    if artifact_path not in _model_cache:
        try:
            model, config = load_model(artifact_path)
            preprocess_cfg = load_preprocess_config(artifact_path)
            model_config = load_artifact_config(artifact_path)
            _model_cache[artifact_path] = (model, preprocess_cfg, model_config)
        except FileNotFoundError:
            log_warn(
                "shadow_service",
                "artifact_not_found",
                artifact_path=artifact_path,
            )
            return False, None, None

    model, preprocess_cfg, model_config = _model_cache[artifact_path]
    model_type = model_config["model_config"]["model_type"]

    # Build feature vector from live PoseSequence frames.
    frames = _pose_sequence_to_frames(pose_sequence)

    if model_type == "aggregate":
        feat = aggregate_features(frames, preprocess_cfg)
        x = torch.from_numpy(feat).unsqueeze(0)   # (1, 53)
    else:
        feat, _ = preprocess_sequence(frames, preprocess_cfg)
        x = torch.from_numpy(feat).unsqueeze(0).permute(0, 2, 1)   # (1, 40, seq_len)

    with torch.no_grad():
        logits = model(x)
        pred_label = int(logits.argmax(dim=1).item())
        confidence = float(torch.softmax(logits, dim=1)[0, pred_label].item())

    pred_str = "passed" if pred_label == 1 else "failed"
    rule_str = rule_based_result.status

    rule_passed = rule_str == "passed"
    learned_passed = pred_label == 1
    disagrees = rule_passed != learned_passed

    log_info(
        "shadow_service",
        "shadow_result",
        verification_id=rule_based_result.verification_id,
        rule_based_status=rule_str,
        learned_prediction=pred_str,
        learned_confidence=round(confidence, 4),
        disagrees=disagrees,
        model_version=model_config.get("model_version", "unknown"),
    )

    if disagrees:
        log_warn(
            "shadow_service",
            "shadow_disagreement",
            verification_id=rule_based_result.verification_id,
            rule_based_status=rule_str,
            learned_prediction=pred_str,
            learned_confidence=round(confidence, 4),
        )

    return disagrees, pred_str, round(confidence, 4)


def _pose_sequence_to_frames(pose_sequence: PoseSequence) -> list[dict]:
    """Convert live PoseSequence to the stored frame dict format."""
    return [
        {
            "frame_index": frame.frame_index,
            "timestamp_ms": frame.timestamp_ms,
            "keypoints": {
                name: {
                    "x": kp.x,
                    "y": kp.y,
                    "confidence": kp.confidence,
                }
                for name, kp in frame.keypoints.items()
            },
            "confidence": (
                sum(kp.confidence for kp in frame.keypoints.values()) /
                max(len(frame.keypoints), 1)
            ),
        }
        for frame in pose_sequence.frames
    ]
