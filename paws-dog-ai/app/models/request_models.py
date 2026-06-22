from pydantic import BaseModel

from app.models.hybrid_models import VerificationTier


class GameConfig(BaseModel):
    ranked: bool = False
    required_duration_ms: int | None = None
    sequence: list[str] | None = None


class ActivityAnalysisRequest(BaseModel):
    verification_id: str
    user_id: str
    dog_id: str
    activity_id: str
    verification_mode: str
    storage_path: str | None = None
    context_type: str
    game_config: GameConfig | None = None

    # Verification tier determines routing policy and score thresholds.
    # Defaults to standard_daily so existing clients require no changes.
    verification_tier: str = VerificationTier.STANDARD_DAILY

    # Selected RGB frame paths (populated by on-device or server extraction).
    # Empty list means no frames available for visual verification.
    selected_frame_paths: list[str] = []

    # Optional dog crop path within the storage bucket.
    dog_crop_path: str | None = None

    # Recording metadata forwarded from the client (duration, fps, device model, etc.)
    recording_metadata: dict = {}

    # On-device pose extraction telemetry.  Present only when the client used
    # on-device inference before uploading to the server.  Expected keys:
    #   iphone_model, ios_version, app_version, on_device_pose_version,
    #   frame_inference_latency_ms, dropped_frame_rate, payload_size_bytes,
    #   fell_back_to_video (bool).
    device_metadata: dict = {}
