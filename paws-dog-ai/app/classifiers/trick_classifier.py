"""
Generic trick classifier.

Handles every activity_id that does not have a dedicated pose-based classifier.
A single instance of this class replaces the nine individual stub classifier
files (down, paw, stay, spin, stand, roll_over, recall, trick_combo).

Decision tree for a given request
-----------------------------------
1. Look up the trick in the vocabulary.
   - Unknown slug     -> unsupported_activity (clear guidance)
   - Inactive trick   -> unsupported_activity (with inactive reason)
2. Run the standard quality gate (visibility, confidence, coverage).
   - If the recording is unusable, return an appropriate retry status with
     trick-specific feedback.
3. Return a structured "not_yet_implemented" response that includes:
   - Per-trick thresholds from the vocabulary so the mobile client can
     display them.
   - Trick-specific feedback strings.

When a trick gains a dedicated pose-based classifier (like SitClassifier),
it bypasses this class and is routed directly via get_classifier() in main.py.

Per-trick feedback
------------------
The TrickVocabularyEntry.feedback fields are populated per trick.  This class
uses them to build failure_reason and retry_guidance strings without needing
a separate file per trick.
"""

from __future__ import annotations

from app.classifiers.base_classifier import BaseActivityClassifier
from app.config import settings
from app.models.pose_models import PoseSequence
from app.models.request_models import ActivityAnalysisRequest
from app.models.response_models import ActivityAnalysisResponse
from app.models.trick_models import TrickVocabularyEntry
from app.services.trick_vocabulary_service import get_trick_config


class TrickClassifier(BaseActivityClassifier):
    """
    Generic trick classifier.  One instance handles all tricks that do not
    have a dedicated classifier.  The activity_id class attribute is set to
    a sentinel; the per-request routing reads request.activity_id directly.
    """

    activity_id = "_generic"   # sentinel — this class is never looked up by id

    # ------------------------------------------------------------------
    # BaseActivityClassifier interface
    # ------------------------------------------------------------------

    def validate_input(self, request: ActivityAnalysisRequest) -> tuple[bool, str | None]:
        """Accept any activity_id — validation is done inside analyze_pose_sequence."""
        return True, None

    def analyze_pose_sequence(
        self,
        request: ActivityAnalysisRequest,
        pose_summary: PoseSequence,
    ) -> ActivityAnalysisResponse:

        config = get_trick_config(request.activity_id)

        # Unknown trick.
        if config is None:
            return self._unknown_result(request)

        # Inactive trick.
        if not config.active:
            return self._inactive_result(request, config)

        # Quality gate — check pose visibility and confidence.
        quality = self._quality_gate(pose_summary, config)
        if not quality["ready"]:
            return self._quality_failure_result(request, pose_summary, quality, config)

        # Per-trick geometry classifiers.
        if request.activity_id == "down":
            return self._classify_down(request, pose_summary, config)

        # Trick is known and active but does not yet have a pose-based
        # classifier.  Return a structured unavailable result.
        return self._unavailable_result(request, config)

    # ------------------------------------------------------------------
    # Quality gate
    # ------------------------------------------------------------------

    def _quality_gate(self, pose_summary: PoseSequence, config: TrickVocabularyEntry) -> dict:
        th = config.thresholds

        if not pose_summary.inference_available:
            return self._quality("error", "Pose inference is unavailable.", "Install/configure DeepLabCut and retry.")

        if pose_summary.multiple_dogs_detected:
            return self._quality(
                "retry_multiple_dogs",
                "More than one dog appears in the clip.",
                "Record with only one dog in frame.",
            )

        if not pose_summary.frames:
            return self._quality(
                "retry_dog_not_visible",
                "No usable dog pose frames were detected.",
                "Retake with your dog fully visible.",
            )

        if pose_summary.average_confidence < settings.min_average_keypoint_confidence:
            return self._quality(
                "retry_low_confidence",
                config.format_feedback("low_pose_confidence"),
                "Use brighter lighting and keep the camera steady.",
            )

        if pose_summary.required_keypoint_visibility_ratio < settings.min_required_keypoint_visibility_ratio:
            return self._quality(
                "retry_dog_not_visible",
                config.format_feedback("dog_partially_out_of_frame"),
                "Keep the full body and paws in frame.",
            )

        if pose_summary.dog_frame_coverage_ratio < settings.min_dog_frame_coverage_ratio:
            return self._quality(
                "retry_dog_not_visible",
                "The dog is too small in the video for reliable pose scoring.",
                "Move the phone closer while keeping the full body visible.",
            )

        # Check minimum recording duration using actual frame count and fps.
        duration_ms = 0
        if pose_summary.metadata.fps > 0:
            duration_ms = int(len(pose_summary.frames) / pose_summary.metadata.fps * 1000)

        if duration_ms < th.minimum_recording_duration_ms:
            return self._quality(
                "retry_too_short",
                f"The recording is too short for {config.display_name} verification.",
                f"Record at least {th.minimum_recording_duration_ms // 1000} seconds.",
            )

        return {"ready": True}

    def _quality(self, status: str, reason: str, guidance: str) -> dict:
        return {"ready": False, "status": status, "reason": reason, "guidance": guidance}

    # ------------------------------------------------------------------
    # Response builders
    # ------------------------------------------------------------------

    def _unknown_result(self, request: ActivityAnalysisRequest) -> ActivityAnalysisResponse:
        return ActivityAnalysisResponse(
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status="unsupported_activity",
            confidence_score=None,
            model_name=None,
            analysis_summary={"implemented": False, "reason": "unknown_trick"},
            failure_reason=f"'{request.activity_id}' is not a recognized trick.",
            retry_guidance="Check the trick name and try again.",
        )

    def _inactive_result(
        self,
        request: ActivityAnalysisRequest,
        config: TrickVocabularyEntry,
    ) -> ActivityAnalysisResponse:
        return ActivityAnalysisResponse(
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status="unsupported_activity",
            confidence_score=None,
            model_name=None,
            analysis_summary={
                "implemented": False,
                "reason": "inactive_trick",
                "display_name": config.display_name,
            },
            failure_reason=f"{config.display_name} is not currently available for verification.",
            retry_guidance="Try another trick while this one is being validated.",
        )

    def _quality_failure_result(
        self,
        request: ActivityAnalysisRequest,
        pose_summary: PoseSequence,
        quality: dict,
        config: TrickVocabularyEntry,
    ) -> ActivityAnalysisResponse:
        return ActivityAnalysisResponse(
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status=quality["status"],
            confidence_score=pose_summary.average_confidence,
            model_name=pose_summary.model_name,
            analysis_summary={
                "trick": config.slug,
                "display_name": config.display_name,
                "quality_check_failed": True,
                "average_confidence": pose_summary.average_confidence,
                "dog_frame_coverage_ratio": pose_summary.dog_frame_coverage_ratio,
            },
            failure_reason=quality["reason"],
            retry_guidance=quality["guidance"],
        )

    # ------------------------------------------------------------------
    # Per-trick geometry classifiers
    # ------------------------------------------------------------------

    def _classify_down(
        self,
        request: ActivityAnalysisRequest,
        pose_summary: PoseSequence,
        config: "TrickVocabularyEntry",
    ) -> ActivityAnalysisResponse:
        """
        End-state geometry classifier for 'down' (lying flat).

        Two complementary signals — works from side AND front-facing cameras:

        Signal A — Nose-to-paw gap (any angle):
          When lying down, the dog's nose is close to the ground, so the
          vertical distance between nose and front paws is SMALL.
          When sitting, the nose is well above the paws (large gap).
          When standing, the gap is somewhere in between.
          Threshold: nose_paw_ratio < 0.25 of body size.

        Signal B — Body flatness (side view):
          When lying down, hips and shoulders are both near ground level and
          roughly level with each other.
          Threshold: abs(hip_y - shoulder_y) / body_size < 0.20.
        """
        from app.utils.confidence import combine_confidence  # noqa: PLC0415
        from app.utils.geometry import distance              # noqa: PLC0415

        frames = pose_summary.frames

        def _vis(frame: "PoseFrame", name: str):
            kp = frame.keypoints.get(name)
            if kp and kp.x is not None and kp.y is not None and kp.confidence >= 0.20:
                return (kp.x, kp.y)
            return None

        # Gather per-frame body measurements from last 40% of frames.
        end_start = max(0, len(frames) - len(frames) * 2 // 5)
        end_frames = frames[end_start:] or frames

        nose_paw_gaps: list[float] = []
        body_sizes: list[float] = []
        hip_shoulder_deltas: list[float] = []

        for frame in end_frames:
            nose = _vis(frame, "nose")
            lp   = _vis(frame, "left_front_paw")
            rp   = _vis(frame, "right_front_paw")
            lsh  = _vis(frame, "left_shoulder")
            rsh  = _vis(frame, "right_shoulder")
            lh   = _vis(frame, "left_hip")
            rh   = _vis(frame, "right_hip")

            paw = None
            if lp and rp:
                paw = ((lp[0]+rp[0])/2, (lp[1]+rp[1])/2)
            elif lp or rp:
                paw = lp or rp

            shoulder = None
            if lsh and rsh:
                shoulder = ((lsh[0]+rsh[0])/2, (lsh[1]+rsh[1])/2)
            elif lsh or rsh:
                shoulder = lsh or rsh

            hip = None
            if lh and rh:
                hip = ((lh[0]+rh[0])/2, (lh[1]+rh[1])/2)
            elif lh or rh:
                hip = lh or rh

            if shoulder and hip:
                bs = distance(shoulder, hip)
                body_sizes.append(bs)
                if bs > 0:
                    # Positive = hips lower than shoulders (not flat)
                    hip_shoulder_deltas.append(abs(hip[1] - shoulder[1]) / bs)

            if nose and paw and body_sizes:
                bs = body_sizes[-1] if body_sizes else 1.0
                if bs > 0:
                    # Positive = nose above paws; small = nose near ground = lying
                    nose_paw_gaps.append((paw[1] - nose[1]) / bs)

        if not nose_paw_gaps and not hip_shoulder_deltas:
            return self._unavailable_result(request, config)

        avg_nose_paw    = sum(nose_paw_gaps) / len(nose_paw_gaps) if nose_paw_gaps else 1.0
        avg_flat        = sum(hip_shoulder_deltas) / len(hip_shoulder_deltas) if hip_shoulder_deltas else 1.0

        # Down = nose close to paws AND/OR body is flat
        nose_down = avg_nose_paw < 0.30   # nose near paw level
        body_flat = avg_flat < 0.20        # hips and shoulders level

        lying_down = nose_down or body_flat

        if not lying_down:
            return ActivityAnalysisResponse(
                verification_id=request.verification_id,
                activity_id=request.activity_id,
                status="failed_no_valid_activity",
                confidence_score=pose_summary.average_confidence,
                model_name=pose_summary.model_name,
                failure_reason="The dog did not appear to be lying down at the end of the clip.",
                retry_guidance="End the recording while your dog is flat on the ground.",
                analysis_summary={
                    "nose_paw_ratio": round(avg_nose_paw, 3),
                    "body_flat_ratio": round(avg_flat, 3),
                    "nose_down": nose_down,
                    "body_flat": body_flat,
                    "average_confidence": pose_summary.average_confidence,
                },
            )

        best_signal  = max(
            min(1.0, (0.30 - avg_nose_paw) / 0.30) if nose_down else 0.0,
            min(1.0, (0.20 - avg_flat) / 0.20)      if body_flat else 0.0,
        )
        pose_quality = min(1.0, max(pose_summary.average_confidence, 0.0))
        confidence   = round(min(0.97, 0.5 * best_signal + 0.5 * pose_quality), 3)

        return ActivityAnalysisResponse(
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status="passed",
            confidence_score=confidence,
            model_name=pose_summary.model_name,
            failure_reason=None,
            retry_guidance=None,
            analysis_summary={
                "completed_activity":   True,
                "nose_paw_ratio":       round(avg_nose_paw, 3),
                "body_flat_ratio":      round(avg_flat, 3),
                "signal_used":          "nose_paw" if nose_down else "body_flat",
                "average_confidence":   pose_summary.average_confidence,
            },
        )

    def _unavailable_result(
        self,
        request: ActivityAnalysisRequest,
        config: TrickVocabularyEntry,
    ) -> ActivityAnalysisResponse:
        th = config.thresholds
        return ActivityAnalysisResponse(
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status="unsupported_activity",
            confidence_score=None,
            model_name=None,
            analysis_summary={
                "implemented": False,
                "trick": config.slug,
                "display_name": config.display_name,
                "category": config.category,
                "difficulty": config.difficulty,
                "thresholds": {
                    "pass_confidence_threshold": th.pass_confidence_threshold,
                    "retry_confidence_threshold": th.retry_confidence_threshold,
                    "minimum_visible_joints": th.minimum_visible_joints,
                    "minimum_recording_duration_ms": th.minimum_recording_duration_ms,
                    "hold_duration_ms": th.hold_duration_ms,
                },
            },
            failure_reason=f"{config.display_name} AI verification is coming soon.",
            retry_guidance="Try the sit verifier while PAWS validates more classifiers.",
        )
