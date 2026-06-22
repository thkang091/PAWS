from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",   # ignore EXPO_PUBLIC_* and any other frontend-only vars
    )

    service_version: str = "0.2.0"
    environment: str = "development"
    dog_ai_enable_mock_mode: bool = False
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    superanimal_name: str = "superanimal_quadruped"
    model_name: str = "hrnet_w32"
    # fasterrcnn_mobilenet_v3_large_fpn is ~4x faster than resnet50_fpn_v2
    # with negligible accuracy loss for dog pose on 720p video.
    detector_name: str = "fasterrcnn_mobilenet_v3_large_fpn"
    video_adapt: bool = False
    # Max long-edge pixels before DLC sees the video. 4K -> 720p = 5x speedup.
    inference_max_long_edge: int = 1280
    # Frames per second to sample. 60fps -> 15fps = 4x fewer frames.
    inference_target_fps: float = 15.0
    # Detector and pose batch sizes. Increase if GPU has headroom.
    inference_detector_batch_size: int = 8
    inference_pose_batch_size: int = 16
    min_video_duration_seconds: float = 2.0
    max_video_duration_seconds: float = 8.0
    min_average_keypoint_confidence: float = 0.55
    min_required_keypoint_visibility_ratio: float = 0.65
    min_stable_sit_duration_ms: int = 500      # was 700 — real-world sits can be brief
    min_hip_drop_ratio: float = 0.10           # was 0.12 — some breeds sit low naturally
    max_allowed_front_paw_movement_ratio: float = 0.70  # dogs often step forward before sitting
    required_starting_stand_duration_ms: int = 300  # was 500
    min_dog_frame_coverage_ratio: float = 0.08
    retain_raw_video: bool = False
    pose_model_version: str = "superanimal_quadruped_hrnet_w32_fasterrcnn_v1"
    shadow_mode_enabled: bool = False
    ml_artifact_path: str = "artifacts/sit_tcn_v1"
    admin_api_key: str = ""
    review_confidence_threshold: float = 0.70
    video_signed_url_expiry_seconds: int = 3600

    # Learned sit classifier rollout
    # learned_sit_shadow_mode: run learned model in parallel but never change the result.
    # learned_sit_rollout_percentage: 0-100. Users are assigned deterministically by user_id hash.
    # learned_sit_fallback_enabled: fall back to rule-based if inference fails or confidence is
    #   below learned_sit_manual_review_threshold.
    # learned_sit_min_confidence: minimum learned confidence to fully trust the prediction.
    #   Predictions below this but above learned_sit_manual_review_threshold return retry_uncertain.
    # learned_sit_manual_review_threshold: below this, fall back to rule-based and queue for review.
    # TBT artifact path for combo classifier (empty = model not configured)
    tbt_artifact_path: str = ""

    # Learned sit classifier rollout
    learned_sit_shadow_mode: bool = False
    learned_sit_rollout_percentage: float = 0.0
    learned_sit_fallback_enabled: bool = True
    learned_sit_min_confidence: float = 0.75
    learned_sit_manual_review_threshold: float = 0.60

    # ---------------------------------------------------------------------------
    # Hybrid verification thresholds
    # ---------------------------------------------------------------------------

    # Pose confidence below this value routes to hybrid verification instead of
    # the fast pose-only path.
    hybrid_pose_confidence_threshold: float = 0.72

    # Anomaly score above this routes to hybrid verification.
    hybrid_anomaly_threshold: float = 0.40

    # For high-stakes tiers (gold_coin_reward, tournament): if pose confidence
    # is below this OR anomaly score is above hybrid_direct_review_anomaly_threshold,
    # skip hybrid and go directly to manual review.
    hybrid_high_stakes_direct_review_threshold: float = 0.55

    # Anomaly score that triggers direct_manual_review even on the hybrid path.
    hybrid_direct_review_anomaly_threshold: float = 0.75

    # Which RGB verifier provider to use.  "stub" is the default; wire in a
    # real provider by changing this and calling register_rgb_verifier().
    rgb_verifier_provider: str = "stub"

    # ---------------------------------------------------------------------------
    # Anti-cheat thresholds
    # ---------------------------------------------------------------------------

    # Risk score below this: proceed and award reward.
    anti_cheat_proceed_threshold: float = 0.35

    # Risk score at or above this: block reward and require admin review.
    anti_cheat_block_threshold: float = 0.85

    # ---------------------------------------------------------------------------
    # Alert thresholds
    # ---------------------------------------------------------------------------

    alert_latency_warning_ms: float           = 2000.0
    alert_latency_critical_ms: float          = 5000.0
    alert_p95_latency_warning_ms: float       = 4000.0
    alert_p95_latency_critical_ms: float      = 8000.0
    alert_error_rate_warning: float           = 0.05
    alert_error_rate_critical: float          = 0.10
    alert_fallback_rate_warning: float        = 0.15
    alert_fallback_rate_critical: float       = 0.30
    alert_pass_rate_spike_delta: float        = 0.15
    alert_pass_rate_collapse_delta: float     = 0.20
    alert_low_quality_warning: float          = 0.25
    alert_fraud_review_rate_warning: float    = 0.10
    alert_schema_incompatibility_error_rate: float = 0.05

    # ---------------------------------------------------------------------------
    # On-device pose disable flag (set at runtime by model_registry_service)
    # ---------------------------------------------------------------------------

    on_device_pose_disabled: bool = False

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)


settings = Settings()
