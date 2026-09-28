import { PawsPoseModule } from "../../modules/paws-pose/index";
import { compressPayload, estimatePayloadSize } from "@/lib/posePayloadCompression";
import type {
  CompressedPosePayload,
  OnDevicePoseConfig,
  PoseExtractionResult,
  PoseSequencePayload,
} from "@/types/onDevicePose";
import { DEFAULT_ON_DEVICE_POSE_CONFIG } from "@/types/onDevicePose";

export type OnDevicePoseFeatureFlags = {
  onDevicePoseEnabled: boolean;
  onDevicePoseRolloutPercentage: number;
  onDevicePoseFallbackToVideoUpload: boolean;
  onDevicePoseTargetFps: number;
};

export interface PoseExtractor {
  extract(params: {
    videoUri: string;
    verificationId: string;
    activityId: string;
    config: OnDevicePoseConfig;
  }): Promise<PoseExtractionResult>;
}

export class CoreMLPoseExtractor implements PoseExtractor {
  async extract(params: {
    videoUri: string;
    verificationId: string;
    activityId: string;
    config: OnDevicePoseConfig;
  }): Promise<PoseExtractionResult> {
    const { videoUri, verificationId, activityId, config } = params;

    let payload: PoseSequencePayload;
    try {
      payload = await PawsPoseModule.extractFromVideo({
        videoUri,
        verificationId,
        activityId,
        targetFps: config.targetFps,
        minFrameConfidence: config.minFrameConfidence,
      });
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        shouldFallback: true,
      };
    }

    const sizeBytes = estimatePayloadSize(payload);
    payload = {
      ...payload,
      benchmark: { ...payload.benchmark, payload_size_bytes: sizeBytes },
    };

    const { benchmark } = payload;
    if (benchmark.dropped_frame_rate > config.maxDroppedFrameRate) {
      return {
        success: true,
        payload,
        shouldFallback: true,
        fallbackReason: `Dropped frame rate ${(benchmark.dropped_frame_rate * 100).toFixed(1)}% exceeds threshold.`,
      };
    }
    if (benchmark.avg_keypoint_confidence < config.minAverageKeypointConfidence) {
      return {
        success: true,
        payload,
        shouldFallback: true,
        fallbackReason: `Average keypoint confidence ${benchmark.avg_keypoint_confidence.toFixed(2)} is too low.`,
      };
    }

    return { success: true, payload, shouldFallback: false };
  }
}

export class ServerPoseExtractor implements PoseExtractor {
  async extract(_params: {
    videoUri: string;
    verificationId: string;
    activityId: string;
    config: OnDevicePoseConfig;
  }): Promise<PoseExtractionResult> {
    return {
      success: false,
      error: "ServerPoseExtractor: use video upload path.",
      shouldFallback: true,
    };
  }
}

export function isUserInOnDeviceRollout(
  userId: string,
  rolloutPercentage: number,
): boolean {
  if (rolloutPercentage <= 0) return false;
  if (rolloutPercentage >= 100) return true;
  const bucket = fnv1aBucket(userId);
  return bucket < rolloutPercentage;
}

function fnv1aBucket(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100);
}

export type OnDevicePoseSubmitResult =
  | { path: "on_device"; status: number; benchmark: PoseSequencePayload["benchmark"] }
  | { path: "server_fallback"; reason: string };

export async function attemptOnDevicePoseSubmit(params: {
  videoUri: string;
  verificationId: string;
  activityId: string;
  userId: string;
  dogAiBaseUrl: string;
  flags: OnDevicePoseFeatureFlags;
  config?: Partial<OnDevicePoseConfig>;
}): Promise<OnDevicePoseSubmitResult> {
  const {
    videoUri, verificationId, activityId, userId, dogAiBaseUrl, flags,
  } = params;

  const config: OnDevicePoseConfig = {
    ...DEFAULT_ON_DEVICE_POSE_CONFIG,
    targetFps: flags.onDevicePoseTargetFps,
    ...(params.config ?? {}),
  };

  if (!flags.onDevicePoseEnabled) {
    return { path: "server_fallback", reason: "feature_flag_disabled" };
  }

  if (!isUserInOnDeviceRollout(userId, flags.onDevicePoseRolloutPercentage)) {
    return { path: "server_fallback", reason: "outside_rollout" };
  }

  const nativeAvailable = await PawsPoseModule.isAvailable();
  if (!nativeAvailable) {
    return { path: "server_fallback", reason: "native_module_unavailable" };
  }

  const extractor = new CoreMLPoseExtractor();
  const extractionResult = await extractor.extract({
    videoUri, verificationId, activityId, config,
  });

  if (extractionResult.success === false) {
    return { path: "server_fallback", reason: extractionResult.error };
  }

  if (extractionResult.shouldFallback) {
    const fallbackReason =
      extractionResult.success === true && extractionResult.shouldFallback === true
        ? extractionResult.fallbackReason
        : "quality_gate_failed";
    return { path: "server_fallback", reason: fallbackReason ?? "quality_gate_failed" };
  }

  const { payload } = extractionResult;
  let envelope: CompressedPosePayload;
  try {
    envelope = await compressPayload(payload);
  } catch {
    return { path: "server_fallback", reason: "compression_failed" };
  }

  const uploadStart = Date.now();
  let status: number;
  try {
    const response = await fetch(`${dogAiBaseUrl}/analyze/pose-sequence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Pose-Encoding": envelope.encoding,
      },
      body: JSON.stringify(envelope),
    });
    status = response.status;
  } catch {
    return { path: "server_fallback", reason: "upload_failed" };
  }

  const uploadLatencyMs = Date.now() - uploadStart;

  if (status < 200 || status >= 300) {
    if (flags.onDevicePoseFallbackToVideoUpload) {
      return { path: "server_fallback", reason: `server_rejected_${status}` };
    }
    return { path: "server_fallback", reason: `server_error_${status}` };
  }

  return {
    path: "on_device",
    status,
    benchmark: {
      ...payload.benchmark,
      payload_size_bytes: envelope.compressed_size_bytes,
      total_upload_latency_ms: uploadLatencyMs,
    },
  };
}
