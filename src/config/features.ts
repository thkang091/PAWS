import { env } from "@/config/env";

export const features = {
  paidPlansEnabled: env.isValid ? env.data.enablePaidPlans : false,
  aiVideoVerificationEnabled: false,
  socialFeedEnabled: false,
  pushNotificationsEnabled: false,

  // -------------------------------------------------------------------
  // On-device pose extraction prototype
  //
  // on_device_pose_enabled:
  //   Master switch. Must be true for any on-device path to activate.
  //   Set EXPO_PUBLIC_ON_DEVICE_POSE_ENABLED=true in .env to enable.
  //
  // on_device_pose_rollout_percentage:
  //   0-100. Users outside the bucket always use server-side video upload.
  //   Start at 0 and ramp up after benchmarking validates quality.
  //
  // on_device_pose_fallback_to_video_upload:
  //   When true, any quality failure or server rejection falls back silently
  //   to the existing video upload path.
  //   When false, quality failures are surfaced as errors (useful for testing).
  //
  // on_device_pose_target_fps:
  //   Frames per second passed to the Core ML extractor.
  //   Lower values reduce latency and payload size but reduce temporal resolution.
  //   Default: 8 fps.
  // -------------------------------------------------------------------
  onDevicePoseEnabled:
    env.isValid ? env.data.onDevicePoseEnabled : false,
  onDevicePoseRolloutPercentage:
    env.isValid ? env.data.onDevicePoseRolloutPercentage : 0,
  onDevicePoseFallbackToVideoUpload:
    env.isValid ? env.data.onDevicePoseFallbackToVideoUpload : true,
  onDevicePoseTargetFps:
    env.isValid ? env.data.onDevicePoseTargetFps : 8,
} as const;
