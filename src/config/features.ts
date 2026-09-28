import { env } from "@/config/env";

export const features = {
  paidPlansEnabled: env.isValid ? env.data.enablePaidPlans : false,
  aiVideoVerificationEnabled: false,
  socialFeedEnabled: false,
  pushNotificationsEnabled: false,

  onDevicePoseEnabled:
    env.isValid ? env.data.onDevicePoseEnabled : false,
  onDevicePoseRolloutPercentage:
    env.isValid ? env.data.onDevicePoseRolloutPercentage : 0,
  onDevicePoseFallbackToVideoUpload:
    env.isValid ? env.data.onDevicePoseFallbackToVideoUpload : true,
  onDevicePoseTargetFps:
    env.isValid ? env.data.onDevicePoseTargetFps : 8,
} as const;
