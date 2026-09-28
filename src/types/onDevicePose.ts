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

export type PoseKeypoint = {
  x: number;
  y: number;
  confidence: number;
};

export type PoseFrame = {
  frame_index: number;
  timestamp_ms: number;
  keypoints: Partial<Record<KeypointName, PoseKeypoint>>;
  confidence: number;
};

export type OnDevicePoseBenchmark = {
  avg_inference_ms: number;
  p50_inference_ms: number;
  p95_inference_ms: number;
  dropped_frame_count: number;
  dropped_frame_rate: number;
  avg_keypoint_confidence: number;
  payload_size_bytes: number | null;
  total_upload_latency_ms: number | null;
  device_model: string;
};

export type PoseSequencePayload = {
  verification_id: string;
  activity_id: string;
  requested_trick: string;
  device_model: string;
  ios_version: string;
  app_version: string;
  pose_model_version: string;
  fps: number;
  recording_duration_ms: number;
  frame_count: number;
  frames: PoseFrame[];
  benchmark: OnDevicePoseBenchmark;
};

export type OnDevicePoseConfig = {
  targetFps: number;
  ringBufferCapacity: number;
  minFrameConfidence: number;
  minAverageKeypointConfidence: number;
  maxDroppedFrameRate: number;
};

export const DEFAULT_ON_DEVICE_POSE_CONFIG: OnDevicePoseConfig = {
  targetFps: 8,
  ringBufferCapacity: 600,
  minFrameConfidence: 0.20,
  minAverageKeypointConfidence: 0.50,
  maxDroppedFrameRate: 0.30,
};

export type PoseExtractionResult =
  | {
      success: true;
      payload: PoseSequencePayload;
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
      shouldFallback: true;
    };

export type CompressedPosePayload = {
  encoding: "gzip" | "none";
  data: string;
  original_size_bytes: number;
  compressed_size_bytes: number;
};
