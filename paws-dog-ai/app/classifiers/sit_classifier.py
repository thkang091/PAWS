from app.classifiers.base_classifier import BaseActivityClassifier
from app.config import settings
from app.models.pose_models import PoseFrame, PoseSequence
from app.models.request_models import ActivityAnalysisRequest
from app.models.response_models import ActivityAnalysisResponse
from app.utils.confidence import combine_confidence
from app.utils.geometry import distance
from app.utils.temporal_smoothing import smooth


class SitClassifier(BaseActivityClassifier):
    activity_id = "sit"

    def analyze_pose_sequence(self, request: ActivityAnalysisRequest, pose_summary: PoseSequence) -> ActivityAnalysisResponse:
        if not pose_summary.inference_available:
            return self._result(
                request, pose_summary,
                status="error",
                failure_reason=pose_summary.inference_error or "Pose inference is unavailable.",
                retry_guidance="Install/configure DeepLabCut and retry with a fresh video.",
            )

        quality = self.run_quality_checks(pose_summary)
        if not quality["ready"]:
            return self._result(
                request, pose_summary,
                status=quality["status"],
                failure_reason=quality["reason"],
                retry_guidance=quality["guidance"],
                extra_summary=quality,
            )

        frames = pose_summary.frames

        # Collect frames where we have both hip and shoulder readings.
        valid = [
            (i, self._hip_height(f), self._shoulder_height(f), self._body_size(f))
            for i, f in enumerate(frames)
            if self._hip_height(f) is not None
            and self._shoulder_height(f) is not None
            and self._body_size(f)
        ]
        if len(valid) < 3:
            return self._result(
                request, pose_summary,
                status="retry_dog_not_visible",
                failure_reason="Not enough usable pose frames were detected.",
                retry_guidance="Retake with your dog fully visible from the side or a slight diagonal.",
            )

        body_size = combine_confidence([v[3] for v in valid])

        # ----------------------------------------------------------------
        # Signal 1 — Hip-shoulder geometry (side/diagonal view)
        # A sitting dog has hips clearly LOWER (higher Y) than shoulders.
        # ----------------------------------------------------------------
        end_window   = valid[max(0, len(valid) - len(valid) // 3):]
        end_hip      = sum(v[1] for v in end_window) / len(end_window)
        end_shoulder = sum(v[2] for v in end_window) / len(end_window)
        hip_below_ratio = (end_hip - end_shoulder) / body_size

        start_window   = valid[: max(1, len(valid) // 5)]
        start_hip      = sum(v[1] for v in start_window) / len(start_window)
        hip_drop_ratio = (end_hip - start_hip) / body_size

        # ----------------------------------------------------------------
        # Signal 2 — Nose-to-paw vertical distance (works from ANY angle)
        # When sitting, the dog's nose is well above its front paws.
        # When standing, nose and paws are closer together vertically.
        # Uses image Y coords: smaller Y = higher in frame.
        # ----------------------------------------------------------------
        nose_paw_scores: list[float] = []
        for frame in frames[-max(1, len(frames) // 3):]:
            nose = self._visible_point(frame, "nose")
            lp   = self._visible_point(frame, "left_front_paw")
            rp   = self._visible_point(frame, "right_front_paw")
            paw  = None
            if lp and rp:
                paw = ((lp[0] + rp[0]) / 2, (lp[1] + rp[1]) / 2)
            elif lp:
                paw = lp
            elif rp:
                paw = rp
            if nose and paw and body_size > 0:
                # Positive = nose above paws (sitting), normalised by body size
                nose_paw_scores.append((paw[1] - nose[1]) / body_size)

        nose_paw_ratio = (
            sum(nose_paw_scores) / len(nose_paw_scores)
            if nose_paw_scores else 0.0
        )

        # ----------------------------------------------------------------
        # Decision: pass if EITHER signal is convincing.
        # Hip geometry wins on side views; nose-paw wins on front views.
        # ----------------------------------------------------------------
        hip_sitting      = hip_below_ratio >= 0.10
        nose_paw_sitting = nose_paw_ratio  >= 0.30   # nose clearly above paws
        sitting = hip_sitting or nose_paw_sitting

        if not sitting:
            return self._result(
                request, pose_summary,
                status="failed_no_valid_activity",
                failure_reason="The dog did not appear to be sitting at the end of the clip.",
                retry_guidance="End the recording while your dog is clearly in the sit position.",
                extra_summary={
                    "hip_below_ratio":  round(hip_below_ratio, 3),
                    "nose_paw_ratio":   round(nose_paw_ratio, 3),
                    "hip_drop_ratio":   round(hip_drop_ratio, 3),
                    "needed_hip": 0.10,
                    "needed_nose_paw": 0.30,
                },
            )

        # Confidence = best available signal × pose quality.
        # Capped at 0.97 — geometry alone is not a trained model.
        best_signal  = max(
            min(1.0, hip_below_ratio / 0.30),
            min(1.0, nose_paw_ratio  / 0.50),
        )
        pose_quality = min(1.0, max(pose_summary.average_confidence, 0.0))
        confidence   = round(min(0.97, 0.5 * best_signal + 0.5 * pose_quality), 3)

        stable_ms = int(len(end_window) / max(pose_summary.metadata.fps, 1) * 1000)

        return self._result(
            request, pose_summary,
            status="passed",
            confidence_score=confidence,
            extra_summary={
                "completed_activity":   True,
                "stable_pose_duration_ms": stable_ms,
                "activity_start_timestamp_ms": frames[valid[0][0]].timestamp_ms,
                "activity_end_timestamp_ms":   frames[valid[-1][0]].timestamp_ms,
                "fps":                  pose_summary.metadata.fps,
                "required_keypoint_visibility_ratio": pose_summary.required_keypoint_visibility_ratio,
                "hip_below_ratio":      round(hip_below_ratio, 3),
                "nose_paw_ratio":       round(nose_paw_ratio, 3),
                "hip_drop_ratio":       round(hip_drop_ratio, 3),
                "average_confidence":   pose_summary.average_confidence,
                "signal_used": "hip" if hip_sitting else "nose_paw",
            },
        )

    def run_quality_checks(self, pose_summary: PoseSequence) -> dict:
        if pose_summary.multiple_dogs_detected:
            return self._quality("retry_multiple_dogs", "More than one dog appears in the clip.", "Record with only one dog in frame.")
        if not pose_summary.frames:
            return self._quality("retry_dog_not_visible", "No usable dog pose frames were detected.", "Retake with your dog fully visible.")
        if pose_summary.average_confidence < settings.min_average_keypoint_confidence:
            return self._quality("retry_low_confidence", "Average keypoint confidence is too low.", "Use brighter lighting and keep the camera steady.")
        if pose_summary.required_keypoint_visibility_ratio < settings.min_required_keypoint_visibility_ratio:
            return self._quality("retry_dog_not_visible", "Required shoulders, hips, or paws were not visible often enough.", "Keep the full body and paws in frame.")
        if pose_summary.dog_frame_coverage_ratio < settings.min_dog_frame_coverage_ratio:
            return self._quality("retry_dog_not_visible", "The dog is too small in the video for reliable pose scoring.", "Move the phone closer while keeping the full body visible.")
        return {"ready": True}

    def _result(
        self,
        request: ActivityAnalysisRequest,
        pose_summary: PoseSequence,
        status: str,
        confidence_score: float | None = None,
        failure_reason: str | None = None,
        retry_guidance: str | None = None,
        extra_summary: dict | None = None,
    ) -> ActivityAnalysisResponse:
        summary = {
            "started_standing": None,
            "completed_activity": status == "passed",
            "stable_pose_duration_ms": 0,
            "activity_start_timestamp_ms": 0,
            "activity_end_timestamp_ms": 0,
            "fps": pose_summary.metadata.fps,
            "required_keypoint_visibility_ratio": pose_summary.required_keypoint_visibility_ratio,
            "average_confidence": pose_summary.average_confidence,
            "dog_frame_coverage_ratio": pose_summary.dog_frame_coverage_ratio,
        }
        if extra_summary:
            summary.update(extra_summary)
        return ActivityAnalysisResponse(
            verification_id=request.verification_id,
            activity_id=request.activity_id,
            status=status,
            confidence_score=confidence_score if confidence_score is not None else pose_summary.average_confidence,
            model_name=pose_summary.model_name,
            analysis_summary=summary,
            failure_reason=failure_reason,
            retry_guidance=retry_guidance,
        )

    def _quality(self, status: str, reason: str, guidance: str) -> dict:
        return {"ready": False, "status": status, "reason": reason, "guidance": guidance}

    def _frame_count_for_ms(self, pose_summary: PoseSequence, milliseconds: int) -> int:
        return max(1, int((milliseconds / 1000) * pose_summary.metadata.fps))

    def _visible_point(self, frame: PoseFrame, name: str) -> tuple[float, float] | None:
        keypoint = frame.keypoints.get(name)
        if not keypoint or keypoint.x is None or keypoint.y is None or keypoint.confidence < settings.min_average_keypoint_confidence:
            return None
        return (keypoint.x, keypoint.y)

    def _body_size(self, frame: PoseFrame) -> float | None:
        shoulder = self._center(frame, "left_shoulder", "right_shoulder")
        hip = self._center(frame, "left_hip", "right_hip")
        if not shoulder or not hip:
            return None
        return distance(shoulder, hip)

    def _hip_height(self, frame: PoseFrame) -> float | None:
        hip = self._center(frame, "left_hip", "right_hip")
        return hip[1] if hip else None

    def _shoulder_height(self, frame: PoseFrame) -> float | None:
        shoulder = self._center(frame, "left_shoulder", "right_shoulder")
        return shoulder[1] if shoulder else None

    def _front_paw_center(self, frame: PoseFrame) -> tuple[float, float] | None:
        return self._center(frame, "left_front_paw", "right_front_paw")

    def _center(self, frame: PoseFrame, left_name: str, right_name: str) -> tuple[float, float] | None:
        points = [point for point in [self._visible_point(frame, left_name), self._visible_point(frame, right_name)] if point is not None]
        if not points:
            return None
        return (sum(point[0] for point in points) / len(points), sum(point[1] for point in points) / len(points))

    def _front_paw_movement_ratio(self, points: list[tuple[float, float]], body_size: float) -> float:
        if len(points) < 2 or body_size <= 0:
            return 0
        start = points[0]
        end = points[-1]
        return distance(start, end) / body_size
