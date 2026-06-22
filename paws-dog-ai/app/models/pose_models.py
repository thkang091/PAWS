from pydantic import BaseModel


class VideoMetadata(BaseModel):
    duration_seconds: float
    fps: float
    width: int
    height: int
    frame_count: int


class Keypoint(BaseModel):
    name: str
    x: float | None
    y: float | None
    confidence: float


class PoseFrame(BaseModel):
    frame_index: int
    timestamp_ms: int
    keypoints: dict[str, Keypoint]
    dog_count: int = 1


class PoseSequence(BaseModel):
    model_name: str
    metadata: VideoMetadata
    frames: list[PoseFrame]
    average_confidence: float
    required_keypoint_visibility_ratio: float
    dog_frame_coverage_ratio: float
    multiple_dogs_detected: bool = False
    inference_available: bool = True
    inference_error: str | None = None
    # Base64-encoded JPEG previews with skeleton overlay (dev only, may be empty)
    preview_frames: list[str] = []
