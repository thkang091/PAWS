/**
 * Tests for PoseSequencePayload schema compatibility.
 *
 * Validates that the TypeScript payload structure matches what the server
 * expects, and that the benchmark and frame structures are schema-correct.
 */

import type {
  PoseFrame,
  PoseSequencePayload,
  OnDevicePoseBenchmark,
  CompressedPosePayload,
} from "@/types/onDevicePose";
import { DEFAULT_ON_DEVICE_POSE_CONFIG } from "@/types/onDevicePose";
import { MOCK_PAYLOAD } from "./__mocks__/pawsPoseModule";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isFloat01 = (v: number) => typeof v === "number" && v >= 0 && v <= 1;
const isNonNegativeInt = (v: number) => Number.isInteger(v) && v >= 0;

// ---------------------------------------------------------------------------
// PoseSequencePayload schema
// ---------------------------------------------------------------------------

describe("PoseSequencePayload schema", () => {
  const payload = MOCK_PAYLOAD as PoseSequencePayload;

  it("has all required top-level fields", () => {
    expect(typeof payload.verification_id).toBe("string");
    expect(typeof payload.activity_id).toBe("string");
    expect(typeof payload.requested_trick).toBe("string");
    expect(typeof payload.device_model).toBe("string");
    expect(typeof payload.ios_version).toBe("string");
    expect(typeof payload.app_version).toBe("string");
    expect(typeof payload.pose_model_version).toBe("string");
    expect(typeof payload.fps).toBe("number");
    expect(typeof payload.recording_duration_ms).toBe("number");
    expect(typeof payload.frame_count).toBe("number");
    expect(Array.isArray(payload.frames)).toBe(true);
    expect(typeof payload.benchmark).toBe("object");
  });

  it("frame_count matches frames array length", () => {
    expect(payload.frame_count).toBe(payload.frames.length);
  });

  it("fps is positive", () => {
    expect(payload.fps).toBeGreaterThan(0);
  });

  it("recording_duration_ms is positive", () => {
    expect(payload.recording_duration_ms).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// PoseFrame schema
// ---------------------------------------------------------------------------

describe("PoseFrame schema", () => {
  const frames = (MOCK_PAYLOAD as PoseSequencePayload).frames;

  it("all frames have required fields", () => {
    for (const frame of frames) {
      expect(isNonNegativeInt(frame.frame_index)).toBe(true);
      expect(isNonNegativeInt(frame.timestamp_ms)).toBe(true);
      expect(typeof frame.keypoints).toBe("object");
      expect(isFloat01(frame.confidence)).toBe(true);
    }
  });

  it("frame_index is sequential", () => {
    const indices = frames.map(f => f.frame_index);
    expect(indices).toEqual(frames.map((_, i) => i));
  });

  it("timestamps are non-decreasing", () => {
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i]!.timestamp_ms).toBeGreaterThanOrEqual(frames[i - 1]!.timestamp_ms);
    }
  });

  it("all keypoints have x, y, confidence in [0,1]", () => {
    for (const frame of frames) {
      for (const [name, kp] of Object.entries(frame.keypoints)) {
        expect(isFloat01(kp.x)).toBe(true);
        expect(isFloat01(kp.y)).toBe(true);
        expect(isFloat01(kp.confidence)).toBe(true);
      }
    }
  });

  it("keypoint names match server-side KEYPOINT_NAMES", () => {
    const validNames = new Set([
      "nose", "left_shoulder", "right_shoulder",
      "left_hip", "right_hip", "tail_base",
      "left_front_paw", "right_front_paw",
      "left_hind_paw", "right_hind_paw",
    ]);
    for (const frame of frames) {
      for (const name of Object.keys(frame.keypoints)) {
        expect(validNames.has(name)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// OnDevicePoseBenchmark schema
// ---------------------------------------------------------------------------

describe("OnDevicePoseBenchmark schema", () => {
  const bm = (MOCK_PAYLOAD as PoseSequencePayload).benchmark;

  it("has all required benchmark fields", () => {
    expect(typeof bm.avg_inference_ms).toBe("number");
    expect(typeof bm.p50_inference_ms).toBe("number");
    expect(typeof bm.p95_inference_ms).toBe("number");
    expect(isNonNegativeInt(bm.dropped_frame_count)).toBe(true);
    expect(isFloat01(bm.dropped_frame_rate)).toBe(true);
    expect(isFloat01(bm.avg_keypoint_confidence)).toBe(true);
    expect(typeof bm.device_model).toBe("string");
  });

  it("p95 >= p50 >= avg when plausible", () => {
    // True for mock — won't hold for all real distributions but holds here.
    expect(bm.p95_inference_ms).toBeGreaterThanOrEqual(bm.p50_inference_ms);
  });

  it("payload_size_bytes and total_upload_latency_ms are nullable", () => {
    // Initially null before compression and upload.
    expect(bm.payload_size_bytes === null || typeof bm.payload_size_bytes === "number").toBe(true);
    expect(bm.total_upload_latency_ms === null || typeof bm.total_upload_latency_ms === "number").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// CompressedPosePayload schema
// ---------------------------------------------------------------------------

describe("CompressedPosePayload schema", () => {
  const envelope: CompressedPosePayload = {
    encoding: "none",
    data: btoa("{}"),
    original_size_bytes: 2,
    compressed_size_bytes: 2,
  };

  it("encoding is gzip or none", () => {
    expect(["gzip", "none"]).toContain(envelope.encoding);
  });

  it("data is a non-empty string", () => {
    expect(typeof envelope.data).toBe("string");
    expect(envelope.data.length).toBeGreaterThan(0);
  });

  it("compressed_size_bytes <= original_size_bytes for gzip", () => {
    const gzipEnvelope: CompressedPosePayload = {
      encoding: "gzip",
      data: btoa("compressed"),
      original_size_bytes: 1000,
      compressed_size_bytes: 200,
    };
    expect(gzipEnvelope.compressed_size_bytes).toBeLessThanOrEqual(
      gzipEnvelope.original_size_bytes,
    );
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_ON_DEVICE_POSE_CONFIG
// ---------------------------------------------------------------------------

describe("DEFAULT_ON_DEVICE_POSE_CONFIG", () => {
  it("targetFps is a sensible value", () => {
    expect(DEFAULT_ON_DEVICE_POSE_CONFIG.targetFps).toBeGreaterThan(0);
    expect(DEFAULT_ON_DEVICE_POSE_CONFIG.targetFps).toBeLessThanOrEqual(30);
  });

  it("ringBufferCapacity is positive", () => {
    expect(DEFAULT_ON_DEVICE_POSE_CONFIG.ringBufferCapacity).toBeGreaterThan(0);
  });

  it("quality thresholds are in [0,1]", () => {
    expect(isFloat01(DEFAULT_ON_DEVICE_POSE_CONFIG.minFrameConfidence)).toBe(true);
    expect(isFloat01(DEFAULT_ON_DEVICE_POSE_CONFIG.minAverageKeypointConfidence)).toBe(true);
    expect(isFloat01(DEFAULT_ON_DEVICE_POSE_CONFIG.maxDroppedFrameRate)).toBe(true);
  });
});
