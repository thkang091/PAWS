from pydantic import BaseModel


class PoseQualityFlags(BaseModel):
    low_average_confidence: bool = False
    excessive_missing_frames: bool = False
    dog_partially_out_of_frame: bool = False
    insufficient_recording_duration: bool = False
    inconsistent_frame_rate: bool = False
    unsupported_pose_schema: bool = False


class TimestampGap(BaseModel):
    before_frame_index: int
    gap_ms: float
    expected_ms: float


class PoseQualityReport(BaseModel):
    frame_count: int
    recording_duration_ms: int
    avg_keypoint_confidence: float
    min_keypoint_confidence: float
    pct_frames_with_visible_dog: float
    pct_visible_joints: float
    missing_keypoints_by_name: dict[str, int]
    suspicious_timestamp_gaps: list[TimestampGap]
    multiple_dogs_detected: bool
    flags: PoseQualityFlags
    schema_keypoints: list[str]
    schema_version: str
