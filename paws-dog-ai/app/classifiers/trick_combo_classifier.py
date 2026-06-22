"""
Trick combo classifier.

Decodes per-frame TBT predictions into trick segments and matches them against
the expected ordered combo sequence.

Activity IDs handled here have the prefix "combo:" (e.g. "combo:sit_then_down").
The classifier:
  1. Looks up the combo definition in the vocabulary.
  2. Runs the standard quality gate on the pose summary.
  3. Obtains per-frame trick probabilities from TBT (or a stub when no model
     is loaded).
  4. Decodes the frame probabilities into TrickSegments.
  5. Matches the segment sequence against the expected combo order.
  6. Returns a structured ActivityAnalysisResponse with per-step detail.

Model gate
----------
This classifier requires a TBT model artifact.  When no artifact is configured
the classifier returns status="unavailable" with clear guidance.  This keeps
the combo feature invisible to users until the model is ready for production.
"""

from __future__ import annotations

import numpy as np

from app.classifiers.base_classifier import BaseActivityClassifier
from app.config import settings
from app.ml.combo_matcher import ComboMatchConfig, match_combo
from app.ml.segment_decoder import SegmentDecoderConfig, decode_segments
from app.models.combo_models import ComboAnalysisSummary
from app.models.pose_models import PoseSequence
from app.models.request_models import ActivityAnalysisRequest
from app.models.response_models import ActivityAnalysisResponse
from app.services.combo_vocabulary_service import get_combo_config


# activity_id prefix for combo requests
COMBO_PREFIX = "combo:"


class TrickComboClassifier(BaseActivityClassifier):
    """
    Handles activity_ids of the form "combo:<slug>", e.g. "combo:sit_then_down".

    The classifier is not wired into the production path until the TBT model
    artifact directory is configured (settings.tbt_artifact_path).
    """

    activity_id = "trick_combo"   # sentinel; routing is done in main.py by prefix

    # ------------------------------------------------------------------
    # BaseActivityClassifier interface
    # ------------------------------------------------------------------

    def validate_input(self, request: ActivityAnalysisRequest) -> tuple[bool, str | None]:
        return True, None

    def analyze_pose_sequence(
        self,
        request: ActivityAnalysisRequest,
        pose_summary: PoseSequence,
    ) -> ActivityAnalysisResponse:

        combo_slug = _extract_slug(request.activity_id)

        # Unknown combo.
        combo = get_combo_config(combo_slug)
        if combo is None:
            return self._unknown_result(request, combo_slug)

        # Inactive combo.
        if not combo.active:
            return self._inactive_result(request, combo_slug, combo.display_name)

        # Quality gate (reuse base class pattern).
        quality = self._quality_gate(pose_summary)
        if not quality["ready"]:
            return self._quality_failure_result(request, pose_summary, quality)

        # Obtain per-frame logits.
        frame_logits, timestamps_ms = self._get_frame_logits(pose_summary)

        if frame_logits is None:
            return self._no_model_result(request, combo)

        # Decode segments.
        decoder_cfg = SegmentDecoderConfig(
            smooth_window_frames=combo.smooth_window_frames,
            min_segment_duration_ms=combo.min_segment_duration_ms,
        )
        segments = decode_segments(frame_logits, timestamps_ms, decoder_cfg)

        # Match combo.
        match_cfg = ComboMatchConfig(
            min_step_confidence=combo.min_step_confidence,
            min_combo_score=combo.min_combo_score,
        )
        result = match_combo(segments, combo, match_cfg)

        # Map combo status to ActivityAnalysisResponse status.
        status = _combo_status_to_response_status(result.status)

        summary = ComboAnalysisSummary(
            combo_slug=combo.slug,
            display_name=combo.display_name,
            expected_sequence=combo.trick_sequence,
            detected_sequence=result.detected_sequence,
            steps=[s.model_dump() for s in result.steps],
            combo_score=result.combo_score,
            segments=[s.model_dump() for s in segments],
        )

        return ActivityAnalysisResponse(
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status=status,
            confidence_score=result.combo_score,
            model_name="tbt_combo",
            analysis_summary=summary.model_dump(),
            failure_reason=result.failure_reason,
            retry_guidance=result.retry_guidance,
        )

    # ------------------------------------------------------------------
    # Per-frame logit extraction
    # ------------------------------------------------------------------

    def _get_frame_logits(
        self,
        pose_summary: PoseSequence,
    ) -> tuple[np.ndarray | None, list[int]]:
        """
        Return (frame_trick_logits, timestamps_ms) from TBT inference.

        If no TBT artifact is configured, return (None, []).
        frame_trick_logits shape: (T, n_trick_classes)
        """
        artifact_path = getattr(settings, "tbt_artifact_path", None)
        if not artifact_path:
            return None, []

        try:
            import torch  # noqa: PLC0415
            from app.ml.artifacts import load_model  # noqa: PLC0415
            from app.ml.preprocessing import build_tbt_features  # noqa: PLC0415

            model, _ = load_model(artifact_path)
            model.eval()

            frames = [f.model_dump() for f in pose_summary.frames]
            features = build_tbt_features(frames)  # (T, in_dim)
            x = torch.from_numpy(features.T.astype("float32")).unsqueeze(0)  # (1, in_dim, T)

            with torch.no_grad():
                out = model(x)

            # (1, T, n_classes) -> (T, n_classes)
            frame_logits = out.frame_trick_logits[0].cpu().numpy()

            timestamps_ms = [f.timestamp_ms for f in pose_summary.frames]
            if len(timestamps_ms) != frame_logits.shape[0]:
                # Mismatch: truncate to the shorter length.
                n = min(len(timestamps_ms), frame_logits.shape[0])
                timestamps_ms = timestamps_ms[:n]
                frame_logits = frame_logits[:n]

            return frame_logits, timestamps_ms

        except Exception:  # noqa: BLE001
            return None, []

    # ------------------------------------------------------------------
    # Quality gate (lightweight — no per-trick config needed for combos)
    # ------------------------------------------------------------------

    def _quality_gate(self, pose_summary: PoseSequence) -> dict:
        if not pose_summary.inference_available:
            return self._q("error",
                           "Pose inference is unavailable.",
                           "Configure DeepLabCut and retry.")

        if pose_summary.multiple_dogs_detected:
            return self._q("retry_multiple_dogs",
                           "More than one dog appears in the clip.",
                           "Record with only one dog in frame.")

        if not pose_summary.frames:
            return self._q("retry_dog_not_visible",
                           "No usable frames were detected.",
                           "Retake with your dog fully visible.")

        if pose_summary.average_confidence < settings.min_average_keypoint_confidence:
            return self._q("retry_low_confidence",
                           "Pose detection confidence is too low.",
                           "Use brighter lighting and keep the camera steady.")

        return {"ready": True}

    def _q(self, status: str, reason: str, guidance: str) -> dict:
        return {"ready": False, "status": status, "reason": reason, "guidance": guidance}

    # ------------------------------------------------------------------
    # Response builders
    # ------------------------------------------------------------------

    def _unknown_result(
        self, request: ActivityAnalysisRequest, slug: str
    ) -> ActivityAnalysisResponse:
        return ActivityAnalysisResponse(
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status="unsupported_activity",
            confidence_score=None,
            model_name=None,
            analysis_summary={"reason": "unknown_combo", "slug": slug},
            failure_reason=f"'{slug}' is not a recognised trick combo.",
            retry_guidance="Check the combo name and try again.",
        )

    def _inactive_result(
        self, request: ActivityAnalysisRequest, slug: str, display_name: str
    ) -> ActivityAnalysisResponse:
        return ActivityAnalysisResponse(
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status="unsupported_activity",
            confidence_score=None,
            model_name=None,
            analysis_summary={"reason": "inactive_combo", "slug": slug},
            failure_reason=f"{display_name} is not currently available for verification.",
            retry_guidance="Try a different combo while this one is being validated.",
        )

    def _quality_failure_result(
        self,
        request: ActivityAnalysisRequest,
        pose_summary: PoseSequence,
        quality: dict,
    ) -> ActivityAnalysisResponse:
        return ActivityAnalysisResponse(
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status=quality["status"],
            confidence_score=pose_summary.average_confidence,
            model_name=pose_summary.model_name,
            analysis_summary={"quality_check_failed": True},
            failure_reason=quality["reason"],
            retry_guidance=quality["guidance"],
        )

    def _no_model_result(
        self,
        request: ActivityAnalysisRequest,
        combo,
    ) -> ActivityAnalysisResponse:
        return ActivityAnalysisResponse(
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status="unsupported_activity",
            confidence_score=None,
            model_name=None,
            analysis_summary={
                "reason": "model_not_configured",
                "combo_slug": combo.slug,
                "display_name": combo.display_name,
            },
            failure_reason=f"{combo.display_name} combo verification requires the TBT model.",
            retry_guidance="The combo classifier is not yet enabled in this environment.",
        )


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

def _extract_slug(activity_id: str) -> str:
    """Strip the 'combo:' prefix to get the bare combo slug."""
    if activity_id.startswith(COMBO_PREFIX):
        return activity_id[len(COMBO_PREFIX):]
    return activity_id


def _combo_status_to_response_status(combo_status: str) -> str:
    """Map combo match status to ActivityAnalysisResponse.status values."""
    return {
        "complete":       "passed",
        "partial":        "retry_incomplete_combo",
        "wrong_order":    "retry_wrong_order",
        "missing_step":   "retry_missing_step",
        "low_confidence": "retry_low_confidence",
        "failed":         "failed",
        "unknown_combo":  "unsupported_activity",
    }.get(combo_status, "failed")
