import cv2

from app.config import settings
from app.models.pose_models import VideoMetadata


class VideoValidationService:
    def validate(self, storage_path: str | None) -> tuple[bool, str | None]:
        if not storage_path:
            return False, "Missing verification video."
        if not storage_path.lower().endswith((".mp4", ".mov")):
            return False, "Unsupported video format."
        return True, None

    def extract_metadata(self, local_path: str) -> VideoMetadata:
        capture = cv2.VideoCapture(local_path)
        if not capture.isOpened():
            raise ValueError("Video could not be opened by OpenCV.")

        fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        capture.release()

        if fps <= 0 or frame_count <= 0:
            raise ValueError("Video metadata is incomplete.")

        duration_seconds = frame_count / fps
        if duration_seconds < settings.min_video_duration_seconds:
            raise ValueError(f"Video is too short. Minimum is {settings.min_video_duration_seconds:.1f} seconds.")
        if duration_seconds > settings.max_video_duration_seconds:
            raise ValueError(f"Video is too long. Maximum is {settings.max_video_duration_seconds:.1f} seconds.")

        return VideoMetadata(
            duration_seconds=duration_seconds,
            fps=fps,
            width=width,
            height=height,
            frame_count=frame_count,
        )
