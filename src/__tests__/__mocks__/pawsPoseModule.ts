import type { PoseSequencePayload } from "@/types/onDevicePose";

export const MOCK_PAYLOAD: PoseSequencePayload = {
  verification_id: "test-verification-id",
  activity_id: "sit",
  requested_trick: "sit",
  device_model: "iPhone15,2",
  ios_version: "17.4",
  app_version: "1.0.0",
  pose_model_version: "vision_animal_body_pose_v1",
  fps: 8,
  recording_duration_ms: 3000,
  frame_count: 24,
  frames: Array.from({ length: 24 }, (_, i) => ({
    frame_index: i,
    timestamp_ms: i * 125,
    keypoints: {
      nose:            { x: 0.50, y: 0.20, confidence: 0.90 },
      left_shoulder:   { x: 0.40, y: 0.35, confidence: 0.88 },
      right_shoulder:  { x: 0.60, y: 0.35, confidence: 0.88 },
      left_hip:        { x: 0.40, y: 0.60, confidence: 0.85 },
      right_hip:       { x: 0.60, y: 0.60, confidence: 0.85 },
      tail_base:       { x: 0.50, y: 0.75, confidence: 0.80 },
      left_front_paw:  { x: 0.35, y: 0.80, confidence: 0.82 },
      right_front_paw: { x: 0.65, y: 0.80, confidence: 0.82 },
      left_hind_paw:   { x: 0.38, y: 0.90, confidence: 0.78 },
      right_hind_paw:  { x: 0.62, y: 0.90, confidence: 0.78 },
    },
    confidence: 0.84,
  })),
  benchmark: {
    avg_inference_ms: 12.4,
    p50_inference_ms: 11.8,
    p95_inference_ms: 18.2,
    dropped_frame_count: 0,
    dropped_frame_rate: 0.0,
    avg_keypoint_confidence: 0.84,
    payload_size_bytes: null,
    total_upload_latency_ms: null,
    device_model: "iPhone15,2",
  },
};

let _available = true;
let _payload: PoseSequencePayload = MOCK_PAYLOAD;
let _shouldThrow = false;
let _throwMessage = "Mock extraction error";

export const __setAvailable = (v: boolean) => { _available = v; };
export const __setPayload = (p: PoseSequencePayload) => { _payload = p; };
export const __setShouldThrow = (v: boolean, msg?: string) => {
  _shouldThrow = v;
  if (msg) _throwMessage = msg;
};
export const __reset = () => {
  _available = true;
  _payload = MOCK_PAYLOAD;
  _shouldThrow = false;
  _throwMessage = "Mock extraction error";
};

export const PawsPoseModule = {
  async isAvailable(): Promise<boolean> {
    return _available;
  },
  async extractFromVideo(_opts: unknown): Promise<PoseSequencePayload> {
    if (_shouldThrow) throw new Error(_throwMessage);
    return { ..._payload };
  },
};
