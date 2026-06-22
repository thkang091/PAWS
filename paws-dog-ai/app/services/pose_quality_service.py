"""
Computes data-quality metrics and flags for a PoseSequence.

This runs after inference and before persistence. It never modifies the
PoseSequence or affects the classifier result.
"""

import math

from app.config import settings
from app.models.pose_models import PoseSequence
from app.models.pose_quality_models import PoseQualityFlags, PoseQualityReport, TimestampGap

# The canonical dog keypoint set produced by DeepLabCut SuperAnimal Quadruped.
CANONICAL_SCHEMA_VERSION = "superanimal_quadruped_v1"
CANONICAL_KEYPOINTS = frozenset({
    "nose",
    "left_shoulder",
    "right_shoulder",
    "left_hip",
    "right_hip",
    "tail_base",
    "left_front_paw",
    "right_front_paw",
    "left_hind_paw",
    "right_hind_paw",
})

# Thresholds
_CONFIDENCE_VISIBLE_THRESHOLD = settings.min_average_keypoint_confidence
_MIN_FRAMES_WITH_DOG_RATIO = 0.50
_MAX_MISSING_FRAME_RATIO = 0.30
_FRAME_RATE_STDDEV_RATIO = 0.20     # flag if stddev > 20% of expected interval
_TIMESTAMP_GAP_MULTIPLIER = 2.0     # flag gaps > 2x expected interval
_MIN_DURATION_SECONDS = settings.min_video_duration_seconds


def compute_quality(pose_sequence: PoseSequence) -> PoseQualityReport:
    frames = pose_sequence.frames
    fps = pose_sequence.metadata.fps
    expected_interval_ms = (1000.0 / fps) if fps > 0 else 0.0

    # --- per-joint missing counts ---
    missing_by_name: dict[str, int] = {name: 0 for name in CANONICAL_KEYPOINTS}
    all_confidences: list[float] = []

    for frame in frames:
        for name in CANONICAL_KEYPOINTS:
            kp = frame.keypoints.get(name)
            if kp is None or kp.x is None or kp.confidence < _CONFIDENCE_VISIBLE_THRESHOLD:
                missing_by_name[name] = missing_by_name.get(name, 0) + 1
            if kp is not None:
                all_confidences.append(kp.confidence)

    # --- aggregate confidence ---
    avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0
    min_confidence = min(all_confidences) if all_confidences else 0.0

    # --- frames with a visible dog ---
    # A frame counts as having a visible dog if at least 4 of the 10 joints are above threshold.
    frames_with_dog = sum(
        1 for frame in frames
        if sum(
            1 for name in CANONICAL_KEYPOINTS
            if frame.keypoints.get(name) and frame.keypoints[name].x is not None
            and frame.keypoints[name].confidence >= _CONFIDENCE_VISIBLE_THRESHOLD
        ) >= 4
    )
    pct_frames_with_dog = frames_with_dog / len(frames) if frames else 0.0

    # --- overall visible joint percentage ---
    total_slots = len(frames) * len(CANONICAL_KEYPOINTS)
    visible_slots = total_slots - sum(missing_by_name.values()) if total_slots else 0
    pct_visible_joints = visible_slots / total_slots if total_slots else 0.0

    # --- timestamp gap analysis ---
    suspicious_gaps: list[TimestampGap] = []
    if len(frames) >= 2 and expected_interval_ms > 0:
        intervals: list[float] = []
        for i in range(1, len(frames)):
            gap = float(frames[i].timestamp_ms - frames[i - 1].timestamp_ms)
            intervals.append(gap)
            if gap > expected_interval_ms * _TIMESTAMP_GAP_MULTIPLIER:
                suspicious_gaps.append(TimestampGap(
                    before_frame_index=frames[i].frame_index,
                    gap_ms=gap,
                    expected_ms=expected_interval_ms,
                ))

        mean_interval = sum(intervals) / len(intervals)
        variance = sum((x - mean_interval) ** 2 for x in intervals) / len(intervals)
        stddev = math.sqrt(variance)
        inconsistent_fps = stddev > expected_interval_ms * _FRAME_RATE_STDDEV_RATIO
    else:
        inconsistent_fps = False

    # --- schema check ---
    if frames:
        observed_keypoints = frozenset(frames[0].keypoints.keys())
        schema_mismatch = not CANONICAL_KEYPOINTS.issubset(observed_keypoints)
    else:
        schema_mismatch = False

    # --- recording duration ---
    recording_duration_ms = int(pose_sequence.metadata.duration_seconds * 1000)

    # --- flags ---
    flags = PoseQualityFlags(
        low_average_confidence=avg_confidence < _CONFIDENCE_VISIBLE_THRESHOLD,
        excessive_missing_frames=pct_frames_with_dog < _MIN_FRAMES_WITH_DOG_RATIO,
        dog_partially_out_of_frame=pose_sequence.dog_frame_coverage_ratio < settings.min_dog_frame_coverage_ratio,
        insufficient_recording_duration=pose_sequence.metadata.duration_seconds < _MIN_DURATION_SECONDS,
        inconsistent_frame_rate=inconsistent_fps,
        unsupported_pose_schema=schema_mismatch,
    )

    return PoseQualityReport(
        frame_count=len(frames),
        recording_duration_ms=recording_duration_ms,
        avg_keypoint_confidence=round(avg_confidence, 4),
        min_keypoint_confidence=round(min_confidence, 4),
        pct_frames_with_visible_dog=round(pct_frames_with_dog, 4),
        pct_visible_joints=round(pct_visible_joints, 4),
        missing_keypoints_by_name=missing_by_name,
        suspicious_timestamp_gaps=suspicious_gaps,
        multiple_dogs_detected=pose_sequence.multiple_dogs_detected,
        flags=flags,
        schema_keypoints=sorted(CANONICAL_KEYPOINTS),
        schema_version=CANONICAL_SCHEMA_VERSION,
    )


def skeleton_json(pose_sequence: PoseSequence) -> dict:
    """
    Returns a JSON-serializable skeleton representation of the sequence.
    Used when raw video is unavailable for visual overlay.
    """
    # Standard quadruped skeleton connections.
    connections = [
        ("nose", "left_shoulder"),
        ("nose", "right_shoulder"),
        ("left_shoulder", "right_shoulder"),
        ("left_shoulder", "left_hip"),
        ("right_shoulder", "right_hip"),
        ("left_hip", "right_hip"),
        ("left_hip", "tail_base"),
        ("right_hip", "tail_base"),
        ("left_shoulder", "left_front_paw"),
        ("right_shoulder", "right_front_paw"),
        ("left_hip", "left_hind_paw"),
        ("right_hip", "right_hind_paw"),
    ]

    frame_data = []
    for frame in pose_sequence.frames:
        joints = [
            {
                "name": name,
                "x": kp.x,
                "y": kp.y,
                "confidence": kp.confidence,
                "visible": kp.x is not None and kp.confidence >= _CONFIDENCE_VISIBLE_THRESHOLD,
            }
            for name, kp in frame.keypoints.items()
        ]
        edges = [
            {"from": a, "to": b}
            for a, b in connections
            if frame.keypoints.get(a) and frame.keypoints.get(b)
            and frame.keypoints[a].x is not None and frame.keypoints[b].x is not None
            and frame.keypoints[a].confidence >= _CONFIDENCE_VISIBLE_THRESHOLD
            and frame.keypoints[b].confidence >= _CONFIDENCE_VISIBLE_THRESHOLD
        ]
        frame_data.append({
            "frame_index": frame.frame_index,
            "timestamp_ms": frame.timestamp_ms,
            "joints": joints,
            "connections": edges,
        })

    return {
        "model_name": pose_sequence.model_name,
        "fps": pose_sequence.metadata.fps,
        "width": pose_sequence.metadata.width,
        "height": pose_sequence.metadata.height,
        "frame_count": len(pose_sequence.frames),
        "frames": frame_data,
    }
