/**
 * Type definitions for the on-device pose extraction prototype.
 *
 * Keypoint names follow the server-side KEYPOINT_NAMES convention so that
 * pose sequence payloads are schema-compatible with the existing Python
 * backend and the pose_sequences table.
 *
 * Apple Vision framework joint names are mapped to these names inside the
 * native module (CoreMLPoseExtractor.swift).
 */

// ---------------------------------------------------------------------------
// Keypoint names — must match server-side KEYPOINT_NAMES in preprocessing.py
// ---------------------------------------------------------------------------

export type KeypointName =
  | "nose"
  | "left_shoulder"
  | "right_shoulder"
  | "left_hip"
  | "right_hip"
  | "tail_base"
  | "left_front_paw"
  | "right_front_paw"
  | "left_hind_paw"
  | "right_hind_paw";

// ---------------------------------------------------------------------------
// Single keypoint
// ---------------------------------------------------------------------------

export type PoseKeypoint = {
  /** Normalised x coordinate in [0, 1] (left to right). */
  x: number;
  /** Normalised y coordinate in [0, 1] (top to bottom). */
  y: number;
  /** Model confidence for this keypoint in [0, 1]. */
  confidence: number;
};

// ---------------------------------------------------------------------------
// One frame of pose data
// ---------------------------------------------------------------------------

export type PoseFrame = {
  /** Zero-based index within the extracted sequence. */
  frame_index: number;
  /** Milliseconds from the start of the recording. */
  timestamp_ms: number;
  /** Keypoints present in this frame. Missing joints are omitted. */
  keypoints: Partial<Record<KeypointName, PoseKeypoint>>;
  /** Mean confidence across all visible keypoints for this frame. */
  confidence: number;
};

// ---------------------------------------------------------------------------
// Benchmarking metrics collected during extraction
// ---------------------------------------------------------------------------

export type OnDevicePoseBenchmark = {
  /** Mean inference time across all processed frames (ms). */
  avg_inference_ms: number;
  /** 50th-percentile inference time (ms). */
  p50_inference_ms: number;
  /** 95th-percentile inference time (ms). */
  p95_inference_ms: number;
  /** Number of frames skipped due to processing backpressure. */
  dropped_frame_count: number;
  /** dropped_frame_count / total_candidate_frames. */
  dropped_frame_rate: number;
  /** Mean keypoint confidence across all frames. */
  avg_keypoint_confidence: number;
  /** Compressed payload size in bytes (set after compression). */
  payload_size_bytes: number | null;
  /** End-to-end latency from extraction complete to server ack (ms). */
  total_upload_latency_ms: number | null;
  /** Device model string, e.g. "iPhone15,2". */
  device_model: string;
};

// ---------------------------------------------------------------------------
// Full pose sequence payload sent to the server
// ---------------------------------------------------------------------------

export type PoseSequencePayload = {
  verification_id: string;
  activity_id: string;
  /** Trick slug, e.g. "sit". Matches activity_id for single-trick verifications. */
  requested_trick: string;
  device_model: string;
  ios_version: string;
  app_version: string;
  /**
   * Identifies the pose model used. "vision_animal_body_pose_v1" for the
   * built-in VNDetectAnimalBodyPoseRequest prototype.
   * "paws_quadruped_v1" when the custom Core ML model is deployed.
   */
  pose_model_version: string;
  /** Frames per second at which inference was run. */
  fps: number;
  /** Total recording duration in ms. */
  recording_duration_ms: number;
  frame_count: number;
  frames: PoseFrame[];
  benchmark: OnDevicePoseBenchmark;
};

// ---------------------------------------------------------------------------
// Configuration passed to the extractor
// ---------------------------------------------------------------------------

export type OnDevicePoseConfig = {
  /** Target frames per second for inference. Default: 8. */
  targetFps: number;
  /** Ring buffer capacity in frames. Default: 600 (75 s at 8 fps). */
  ringBufferCapacity: number;
  /** Frames with per-frame confidence below this are dropped. Default: 0.20. */
  minFrameConfidence: number;
  /**
   * Fallback is triggered when avg confidence is below this after extraction.
   * Default: 0.50.
   */
  minAverageKeypointConfidence: number;
  /**
   * Fallback is triggered when dropped frame rate exceeds this.
   * Default: 0.30.
   */
  maxDroppedFrameRate: number;
};

export const DEFAULT_ON_DEVICE_POSE_CONFIG: OnDevicePoseConfig = {
  targetFps: 8,
  ringBufferCapacity: 600,
  minFrameConfidence: 0.20,
  minAverageKeypointConfidence: 0.50,
  maxDroppedFrameRate: 0.30,
};

// ---------------------------------------------------------------------------
// Result returned by an extractor
// ---------------------------------------------------------------------------

export type PoseExtractionResult =
  | {
      success: true;
      payload: PoseSequencePayload;
      /** True when quality is below threshold and fallback should be used. */
      shouldFallback: false;
    }
  | {
      success: true;
      payload: PoseSequencePayload;
      shouldFallback: true;
      fallbackReason: string;
    }
  | {
      success: false;
      error: string;
      /** Always true when success is false. */
      shouldFallback: true;
    };

// ---------------------------------------------------------------------------
// Compression envelope
// ---------------------------------------------------------------------------

export type CompressedPosePayload = {
  /** "gzip" or "none" */
  encoding: "gzip" | "none";
  /** Base64-encoded payload bytes. */
  data: string;
  /** Uncompressed size in bytes. */
  original_size_bytes: number;
  /** Compressed size in bytes. */
  compressed_size_bytes: number;
};
