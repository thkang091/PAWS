"""
HoldDurationDetector — measures how long a dog holds a stable pose.

Implementation status: available

Uses the pose sequence to count consecutive stable frames after a transition
is detected.  "Stable" means the hip and shoulder keypoints do not move
significantly between consecutive frames.

The minimum hold duration is read from settings.min_stable_sit_duration_ms.
The detector is activity-agnostic — it measures stability regardless of
which pose is being held.
"""

from __future__ import annotations

import time

from app.ml.verifier_modules.base import ModuleInput, ModuleOutput, VerifierModule

# Maximum normalized movement between frames to be considered "stable".
_STABILITY_THRESHOLD = 0.04   # normalized image-width units


class HoldDurationDetector(VerifierModule):
    name                  = "hold_duration_detector"
    implementation_status = "available"
    version               = "hold-duration-detector-v1"
    requires_rgb          = False
    requires_pose         = True

    def run(self, input_: ModuleInput) -> ModuleOutput:
        start = time.monotonic()

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

        from app.config import settings  # noqa: PLC0415
        min_ms = settings.min_stable_sit_duration_ms

        frames = input_.pose_sequence.frames
        # Find the longest consecutive stable segment.
        max_hold_ms, stable_segment = _longest_stable_segment(frames)
        elapsed = int((time.monotonic() - start) * 1000)

        passed = max_hold_ms >= min_ms
        confidence = min(max_hold_ms / max(min_ms, 1), 1.0) * 0.9 + 0.1

        reason_codes = (
            ["HOLD_DURATION_SUFFICIENT"]
            if passed
            else ["HOLD_DURATION_INSUFFICIENT"]
        )

        return ModuleOutput(
            module_name=self.name,
            implementation_status=self.implementation_status,
            passed=passed,
            confidence=round(confidence, 4),
            reason_codes=reason_codes,
            metrics={
                "max_hold_ms":       round(max_hold_ms, 1),
                "min_required_ms":   min_ms,
                "stable_frame_count": stable_segment,
            },
            latency_ms=elapsed,
        )


def _longest_stable_segment(frames) -> tuple[float, int]:
    """
    Return (max_hold_duration_ms, frame_count) of the longest stable segment.
    A segment ends when any tracked joint moves more than _STABILITY_THRESHOLD
    between consecutive frames.
    """
    if len(frames) < 2:
        return 0.0, 0

    _TRACKED = ("left_hip", "right_hip", "left_front_shoulder", "right_front_shoulder")

    max_ms = 0.0
    max_count = 0
    seg_start_idx = 0

    for i in range(1, len(frames)):
        prev_frame = frames[i - 1]
        curr_frame = frames[i]
        moved = False
        for joint in _TRACKED:
            prev_kp = prev_frame.keypoints.get(joint)
            curr_kp = curr_frame.keypoints.get(joint)
            if prev_kp is None or curr_kp is None:
                continue
            if abs(curr_kp.x - prev_kp.x) > _STABILITY_THRESHOLD:
                moved = True
                break
            if abs(curr_kp.y - prev_kp.y) > _STABILITY_THRESHOLD:
                moved = True
                break

        if moved:
            # Compute duration of the segment that just ended.
            seg_ms = _segment_duration_ms(frames, seg_start_idx, i - 1)
            seg_len = i - seg_start_idx
            if seg_ms > max_ms:
                max_ms = seg_ms
                max_count = seg_len
            seg_start_idx = i

    # Check the final segment.
    seg_ms = _segment_duration_ms(frames, seg_start_idx, len(frames) - 1)
    seg_len = len(frames) - seg_start_idx
    if seg_ms > max_ms:
        max_ms = seg_ms
        max_count = seg_len

    return max_ms, max_count


def _segment_duration_ms(frames, start_idx: int, end_idx: int) -> float:
    """Return duration in ms between the timestamps of two frames."""
    t_start = getattr(frames[start_idx], "timestamp_ms", None)
    t_end   = getattr(frames[end_idx],   "timestamp_ms", None)
    if t_start is None or t_end is None:
        # Estimate from frame count assuming 30 fps.
        return (end_idx - start_idx) * (1000.0 / 30.0)
    return float(t_end - t_start)
