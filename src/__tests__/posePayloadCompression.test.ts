/**
 * Tests for posePayloadCompression utilities.
 *
 * CompressionStream is not available in the Jest Node environment so these
 * tests verify the "none" encoding fallback path and all pure helpers.
 * A separate integration test would cover the "gzip" path on a real device.
 */

import {
  uint8ArrayToBase64,
  base64ToUint8Array,
  estimatePayloadSize,
  isCompressionStreamAvailable,
  compressPayload,
  percentile,
} from "@/lib/posePayloadCompression";
import type { PoseSequencePayload } from "@/types/onDevicePose";
import { MOCK_PAYLOAD } from "./__mocks__/pawsPoseModule";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe("uint8ArrayToBase64 / base64ToUint8Array round-trip", () => {
  it("round-trips an empty array", () => {
    const bytes = new Uint8Array(0);
    expect(base64ToUint8Array(uint8ArrayToBase64(bytes))).toEqual(bytes);
  });

  it("round-trips a short ASCII string", () => {
    const str = "hello world";
    const bytes = new TextEncoder().encode(str);
    const b64 = uint8ArrayToBase64(bytes);
    const decoded = base64ToUint8Array(b64);
    expect(new TextDecoder().decode(decoded)).toBe(str);
  });

  it("round-trips a JSON blob", () => {
    const json = JSON.stringify({ foo: "bar", arr: [1, 2, 3] });
    const bytes = new TextEncoder().encode(json);
    const b64 = uint8ArrayToBase64(bytes);
    const decoded = base64ToUint8Array(b64);
    expect(new TextDecoder().decode(decoded)).toBe(json);
  });

  it("round-trips bytes with values > 127 (non-ASCII)", () => {
    const bytes = new Uint8Array([0, 127, 128, 200, 255]);
    expect(base64ToUint8Array(uint8ArrayToBase64(bytes))).toEqual(bytes);
  });

  it("handles large arrays (> chunk size of 8192)", () => {
    const bytes = new Uint8Array(20000).fill(42);
    const decoded = base64ToUint8Array(uint8ArrayToBase64(bytes));
    expect(decoded).toEqual(bytes);
  });
});

// ---------------------------------------------------------------------------
// estimatePayloadSize
// ---------------------------------------------------------------------------

describe("estimatePayloadSize", () => {
  it("returns a positive integer", () => {
    const size = estimatePayloadSize(MOCK_PAYLOAD as PoseSequencePayload);
    expect(size).toBeGreaterThan(0);
    expect(Number.isInteger(size)).toBe(true);
  });

  it("grows with more frames", () => {
    const small = { ...MOCK_PAYLOAD, frames: MOCK_PAYLOAD.frames.slice(0, 2) };
    const large = { ...MOCK_PAYLOAD, frames: MOCK_PAYLOAD.frames };
    expect(estimatePayloadSize(large as PoseSequencePayload))
      .toBeGreaterThan(estimatePayloadSize(small as PoseSequencePayload));
  });
});

// ---------------------------------------------------------------------------
// isCompressionStreamAvailable
// ---------------------------------------------------------------------------

describe("isCompressionStreamAvailable", () => {
  it("returns a boolean", () => {
    // Result depends on the runtime (true in Node 18+, false in older Node/Hermes).
    expect(typeof isCompressionStreamAvailable()).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// compressPayload — encoding depends on runtime CompressionStream availability
// ---------------------------------------------------------------------------

describe("compressPayload", () => {
  it("returns a CompressedPosePayload with a valid encoding", async () => {
    const envelope = await compressPayload(MOCK_PAYLOAD as PoseSequencePayload);
    expect(["gzip", "none"]).toContain(envelope.encoding);
    expect(typeof envelope.data).toBe("string");
    expect(envelope.data.length).toBeGreaterThan(0);
    expect(envelope.original_size_bytes).toBeGreaterThan(0);
    expect(envelope.compressed_size_bytes).toBeGreaterThan(0);
  });

  it("round-trips the payload through encoding", async () => {
    // Import decompressPayload for round-trip verification.
    const { decompressPayload } = await import("@/lib/posePayloadCompression");
    const envelope = await compressPayload(MOCK_PAYLOAD as PoseSequencePayload);
    if (envelope.encoding === "none") {
      // Verify directly for uncompressed path.
      const decoded = base64ToUint8Array(envelope.data);
      const json = new TextDecoder().decode(decoded);
      const restored = JSON.parse(json) as PoseSequencePayload;
      expect(restored.verification_id).toBe(MOCK_PAYLOAD.verification_id);
      expect(restored.frame_count).toBe(MOCK_PAYLOAD.frame_count);
      expect(restored.frames).toHaveLength(MOCK_PAYLOAD.frames.length);
    } else {
      // Use decompressPayload for gzip path.
      const restored = await decompressPayload(envelope);
      expect(restored.verification_id).toBe(MOCK_PAYLOAD.verification_id);
      expect(restored.frame_count).toBe(MOCK_PAYLOAD.frame_count);
      expect(restored.frames).toHaveLength(MOCK_PAYLOAD.frames.length);
    }
  });

  it("compressed_size_bytes <= original_size_bytes for gzip", async () => {
    const envelope = await compressPayload(MOCK_PAYLOAD as PoseSequencePayload);
    if (envelope.encoding === "gzip") {
      // Gzip should reduce size for JSON payloads.
      expect(envelope.compressed_size_bytes).toBeLessThanOrEqual(envelope.original_size_bytes);
    } else {
      // No compression: sizes are equal.
      expect(envelope.compressed_size_bytes).toBe(envelope.original_size_bytes);
    }
  });

  it("schema includes all required fields", async () => {
    const envelope = await compressPayload(MOCK_PAYLOAD as PoseSequencePayload);
    expect(envelope).toHaveProperty("encoding");
    expect(envelope).toHaveProperty("data");
    expect(envelope).toHaveProperty("original_size_bytes");
    expect(envelope).toHaveProperty("compressed_size_bytes");
  });
});

// ---------------------------------------------------------------------------
// percentile
// ---------------------------------------------------------------------------

describe("percentile", () => {
  it("returns 0 for empty array", () => {
    expect(percentile([], 50)).toBe(0);
  });

  it("returns the single element for any percentile", () => {
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 95)).toBe(42);
  });

  it("returns median for p50", () => {
    const sorted = [1, 2, 3, 4, 5];
    expect(percentile(sorted, 50)).toBe(3);
  });

  it("returns last element for p100", () => {
    const sorted = [10, 20, 30, 40, 50];
    expect(percentile(sorted, 100)).toBe(50);
  });

  it("returns first element for p1 on small array", () => {
    const sorted = [5, 10, 15, 20];
    expect(percentile(sorted, 1)).toBe(5);
  });
});
