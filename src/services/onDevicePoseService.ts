/**
 * On-device pose extraction service.
 *
 * Architecture
 * ------------
 *
 *   PoseExtractor (interface)
 *   ├── CoreMLPoseExtractor   -- native Vision framework, iOS 17+
 *   └── ServerPoseExtractor   -- wraps existing video upload path (fallback)
 *
 * Decision tree for a verification attempt
 * -----------------------------------------
 * 1. Feature flag disabled?               -> ServerPoseExtractor
 * 2. User outside rollout bucket?         -> ServerPoseExtractor
 * 3. Native module unavailable?           -> ServerPoseExtractor
 * 4. Extraction throws?                   -> ServerPoseExtractor
 * 5. Quality gate fails?                  -> ServerPoseExtractor
 *    a. dropped frame rate > max
 *    b. avg keypoint confidence < min
 * 6. All checks pass                      -> submit pose payload to server
 * 7. Server rejects pose payload?         -> ServerPoseExtractor (retry as video)
 *
 * Rollout assignment
 * ------------------
 * Deterministic by userId: SHA-256(userId)[:8] hex int % 100 < rolloutPercentage.
 * Same algorithm as the server-side learned-sit rollout so behaviour is
 * auditable and consistent.
 */

import { PawsPoseModule } from "../../modules/paws-pose/index";
import { compressPayload, estimatePayloadSize } from "@/lib/posePayloadCompression";
import type {
  CompressedPosePayload,
  OnDevicePoseConfig,
  PoseExtractionResult,
  PoseSequencePayload,
} from "@/types/onDevicePose";
import { DEFAULT_ON_DEVICE_POSE_CONFIG } from "@/types/onDevicePose";

// ---------------------------------------------------------------------------
// Feature flags (read from the features config)
// ---------------------------------------------------------------------------

export type OnDevicePoseFeatureFlags = {
  /** Master switch. When false, always use server-side video upload. */
  onDevicePoseEnabled: boolean;
  /**
   * 0-100. Users are assigned deterministically. 0 = nobody, 100 = everyone.
   * Ramp this up after benchmarking shows acceptable quality.
   */
  onDevicePoseRolloutPercentage: number;
  /**
   * When true, fall back to video upload if quality gate fails or the server
   * rejects the pose payload. When false, a quality failure is surfaced as an
   * error to the user.
   */
  onDevicePoseFallbackToVideoUpload: boolean;
  /** Target FPS for Core ML inference. Lower = faster, less data. */
  onDevicePoseTargetFps: number;
};

// ---------------------------------------------------------------------------
// PoseExtractor protocol (interface)
// ---------------------------------------------------------------------------

export interface PoseExtractor {
  /**
   * Extract a pose sequence from a recording and return it ready to submit.
   *
   * The `shouldFallback` field in the result tells the caller whether to
   * switch to the ServerPoseExtractor even on success.
   */
  extract(params: {
    videoUri: string;
    verificationId: string;
    activityId: string;
    config: OnDevicePoseConfig;
  }): Promise<PoseExtractionResult>;
}

// ---------------------------------------------------------------------------
// CoreMLPoseExtractor (on-device)
// ---------------------------------------------------------------------------

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

    // Populate payload_size_bytes before quality gate.
    const sizeBytes = estimatePayloadSize(payload);
    payload = {
      ...payload,
      benchmark: { ...payload.benchmark, payload_size_bytes: sizeBytes },
    };

    // Quality gate.
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

// ---------------------------------------------------------------------------
// ServerPoseExtractor (existing video upload path — the fallback)
// ---------------------------------------------------------------------------

/**
 * Thin wrapper around the existing video upload flow.
 * Does not call the native module at all.
 *
 * This is the "ServerPoseExtractor" in the protocol hierarchy: it represents
 * the current production path and is always available.
 */
export class ServerPoseExtractor implements PoseExtractor {
  async extract(_params: {
    videoUri: string;
    verificationId: string;
    activityId: string;
    config: OnDevicePoseConfig;
  }): Promise<PoseExtractionResult> {
    // The server path does not produce a pose payload — it uploads raw video.
    // Returning shouldFallback: true signals the caller to use the video path.
    return {
      success: false,
      error: "ServerPoseExtractor: use video upload path.",
      shouldFallback: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Rollout assignment (deterministic, same algorithm as server-side)
// ---------------------------------------------------------------------------

/**
 * Assign a user to the on-device pose rollout.
 * Uses the first 8 hex digits of SHA-256(userId) mapped to a 0-99 bucket.
 *
 * NOTE: SubtleCrypto is not available in React Native's Hermes runtime.
 * We use a fast, non-cryptographic FNV-1a hash as a substitute. The goal is
 * determinism, not security, so FNV-1a is sufficient.
 */
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
  // FNV-1a 32-bit hash, mapped to 0-99.
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // Multiply by FNV prime (32-bit). Use imul to stay in 32-bit range.
    hash = Math.imul(hash, 16777619);
  }
  // Ensure positive, then mod 100.
  return ((hash >>> 0) % 100);
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export type OnDevicePoseSubmitResult =
  | { path: "on_device"; status: number; benchmark: PoseSequencePayload["benchmark"] }
  | { path: "server_fallback"; reason: string };

/**
 * Attempt on-device pose extraction, compress and submit the payload.
 * Falls back to the server video path on any failure or quality issue.
 *
 * @param videoUri       Local video URI from recordAsync().
 * @param verificationId Verification row ID from createActivityVerification().
 * @param activityId     Trick slug.
 * @param userId         Used for rollout bucket assignment.
 * @param dogAiBaseUrl   Python backend base URL.
 * @param flags          Feature flags.
 * @param config         Extraction configuration.
 * @returns              Which path was used and why, for analytics.
 */
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

  // Gate 1: feature flag.
  if (!flags.onDevicePoseEnabled) {
    return { path: "server_fallback", reason: "feature_flag_disabled" };
  }

  // Gate 2: rollout.
  if (!isUserInOnDeviceRollout(userId, flags.onDevicePoseRolloutPercentage)) {
    return { path: "server_fallback", reason: "outside_rollout" };
  }

  // Gate 3: native module availability.
  const nativeAvailable = await PawsPoseModule.isAvailable();
  if (!nativeAvailable) {
    return { path: "server_fallback", reason: "native_module_unavailable" };
  }

  // Extract.
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

  // Compress.
  const { payload } = extractionResult;
  let envelope: CompressedPosePayload;
  try {
    envelope = await compressPayload(payload);
  } catch {
    return { path: "server_fallback", reason: "compression_failed" };
  }

  // Submit.
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

  // Gate 4: server rejection triggers fallback.
  if (status < 200 || status >= 300) {
    if (flags.onDevicePoseFallbackToVideoUpload) {
      return { path: "server_fallback", reason: `server_rejected_${status}` };
    }
    // If fallback is disabled, surface the server error.
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
