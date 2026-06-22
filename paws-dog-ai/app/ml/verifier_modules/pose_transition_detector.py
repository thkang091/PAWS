"""
PoseTransitionDetector — detects pose transitions using keypoint geometry.

Implementation status: available (for sit-type transitions only)

Currently implements sit-type detection: stand → sit.  Other transition types
(e.g., sit → down, stand → roll) return passed=None with TRANSITION_TYPE_UNSUPPORTED.

The core geometry mirrors the existing SitClassifier logic (hip-drop ratio,
starting stance, ending position) but is isolated here so it can be used by
the strategy executor without depending on the SitClassifier directly.

activity_id hint
----------------
The module checks input_.activity_id to decide which transition to evaluate:
  "sit" → stand-to-sit geometry
  any other value → TRANSITION_TYPE_UNSUPPORTED
"""

from __future__ import annotations

import time

from app.ml.verifier_modules.base import ModuleInput, ModuleOutput, VerifierModule


_SIT_ACTIVITY_IDS = frozenset({"sit"})


class PoseTransitionDetector(VerifierModule):
    name                  = "pose_transition_detector"
    implementation_status = "available"
    version               = "pose-transition-detector-v1"
    requires_rgb          = False
    requires_pose         = True

    def run(self, input_: ModuleInput) -> ModuleOutput:
        start = time.monotonic()

        if input_.activity_id not in _SIT_ACTIVITY_IDS:
            return ModuleOutput(
                module_name=self.name,
                implementation_status=self.implementation_status,
                passed=None,
                confidence=None,
                reason_codes=["TRANSITION_TYPE_UNSUPPORTED"],
                metrics={"activity_id": input_.activity_id,
                         "supported_activities": sorted(_SIT_ACTIVITY_IDS)},
                latency_ms=int((time.monotonic() - start) * 1000),
            )

        if input_.pose_sequence is None or not input_.pose_sequence.frames:
            return ModuleOutput(
                module_name=self.name,
                implementation_status=self.implementation_status,
                passed=None,
                confidence=None,
                reason_codes=["POSE_SEQUENCE_MISSING"],
                metrics={},
                latency_ms=int((time.monotonic() - start) * 1000),
            )

        result = _evaluate_sit_transition(input_.pose_sequence)
        elapsed = int((time.monotonic() - start) * 1000)
        return ModuleOutput(
            module_name=self.name,
            implementation_status=self.implementation_status,
            passed=result["passed"],
            confidence=result["confidence"],
            reason_codes=result["reason_codes"],
            metrics=result["metrics"],
            latency_ms=elapsed,
        )


# ---------------------------------------------------------------------------
# Sit transition geometry (mirrors SitClassifier internals)
# ---------------------------------------------------------------------------

def _evaluate_sit_transition(pose_sequence) -> dict:
    from app.config import settings  # noqa: PLC0415

    frames = pose_sequence.frames
    if len(frames) < 2:
        return {
            "passed": False,
            "confidence": 0.0,
            "reason_codes": ["INSUFFICIENT_FRAMES"],
            "metrics": {"frame_count": len(frames)},
        }

    # Check starting stance: dog should be standing.
    first_frame = frames[0]
    started_standing = _is_standing(first_frame)

    # Check ending stance: dog should be sitting.
    last_frame = frames[-1]
    hip_drop = _compute_hip_drop(first_frame, last_frame)
    ended_sitting = _is_sitting(last_frame, hip_drop)

    # Front paw stability during the transition.
    paw_movement = _compute_front_paw_movement(frames)
    paw_stable = paw_movement <= settings.max_allowed_front_paw_movement_ratio

    passed = started_standing and ended_sitting and paw_stable
    reason_codes: list[str] = []
    if not started_standing:
        reason_codes.append("DID_NOT_START_STANDING")
    if not ended_sitting:
        reason_codes.append("SIT_POSITION_NOT_REACHED")
    if not paw_stable:
        reason_codes.append("FRONT_PAWS_MOVED_TOO_MUCH")
    if passed:
        reason_codes = ["SIT_TRANSITION_DETECTED"]

    confidence = _estimate_confidence(hip_drop, started_standing, ended_sitting)

    return {
        "passed": passed,
        "confidence": confidence,
        "reason_codes": reason_codes,
        "metrics": {
            "started_standing": started_standing,
            "ended_sitting": ended_sitting,
            "hip_drop_ratio": round(hip_drop, 4),
            "paw_movement_ratio": round(paw_movement, 4),
        },
    }


def _get_y(frame, joint_name: str) -> float | None:
    kp = frame.keypoints.get(joint_name)
    return kp.y if kp is not None else None


def _is_standing(frame) -> bool:
    """Check if the dog appears to be standing in the given frame."""
    from app.config import settings  # noqa: PLC0415
    hip_y = _get_y(frame, "left_hip") or _get_y(frame, "right_hip")
    shoulder_y = _get_y(frame, "left_front_shoulder") or _get_y(frame, "right_front_shoulder")
    if hip_y is None or shoulder_y is None:
        return False
    # In image coords y increases downward; hip should be close to shoulder level when standing.
    ratio = abs(hip_y - shoulder_y)
    return ratio < settings.min_hip_drop_ratio


def _compute_hip_drop(first_frame, last_frame) -> float:
    """Compute how much the hips dropped (normalized by body height)."""
    start_hip_y = _get_y(first_frame, "left_hip") or _get_y(first_frame, "right_hip")
    end_hip_y   = _get_y(last_frame,  "left_hip") or _get_y(last_frame,  "right_hip")
    if start_hip_y is None or end_hip_y is None:
        return 0.0
    return max(0.0, end_hip_y - start_hip_y)


def _is_sitting(frame, hip_drop: float) -> bool:
    from app.config import settings  # noqa: PLC0415
    if hip_drop < settings.min_hip_drop_ratio:
        return False
    # Hip should be lower than shoulder in the end frame.
    hip_y      = _get_y(frame, "left_hip") or _get_y(frame, "right_hip")
    shoulder_y = _get_y(frame, "left_front_shoulder") or _get_y(frame, "right_front_shoulder")
    if hip_y is None or shoulder_y is None:
        return False
    return hip_y > shoulder_y


def _compute_front_paw_movement(frames) -> float:
    """Compute the normalized x-range of the front paws across all frames."""
    xs: list[float] = []
    for frame in frames:
        for joint in ("left_front_paw", "right_front_paw"):
            kp = frame.keypoints.get(joint)
            if kp is not None:
                xs.append(kp.x)
    if not xs:
        return 0.0
    return max(xs) - min(xs)


def _estimate_confidence(hip_drop: float, started_standing: bool, ended_sitting: bool) -> float:
    base = 0.5
    if started_standing:
        base += 0.2
    if ended_sitting:
        base += 0.2
    base += min(hip_drop * 0.5, 0.1)
    return min(base, 1.0)
