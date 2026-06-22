/**
 * Tests for onDevicePoseService.
 *
 * Covers:
 *   - Feature flag disabled -> server fallback
 *   - User outside rollout -> server fallback
 *   - Native module unavailable -> server fallback
 *   - Extraction throws -> server fallback
 *   - Quality gate: dropped frame rate too high -> server fallback
 *   - Quality gate: avg confidence too low -> server fallback
 *   - Successful on-device path
 *   - Server rejection -> server fallback (when fallback enabled)
 *   - Server rejection -> error (when fallback disabled)
 *   - isUserInOnDeviceRollout determinism and distribution
 *   - CoreMLPoseExtractor delegates to PawsPoseModule
 */

import {
  attemptOnDevicePoseSubmit,
  CoreMLPoseExtractor,
  isUserInOnDeviceRollout,
  ServerPoseExtractor,
} from "@/services/onDevicePoseService";
import type { OnDevicePoseConfig, PoseSequencePayload } from "@/types/onDevicePose";
import { DEFAULT_ON_DEVICE_POSE_CONFIG } from "@/types/onDevicePose";
import {
  MOCK_PAYLOAD,
  __reset,
  __setAvailable,
  __setPayload,
  __setShouldThrow,
} from "./__mocks__/pawsPoseModule";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_FLAGS = {
  onDevicePoseEnabled: true,
  onDevicePoseRolloutPercentage: 100,
  onDevicePoseFallbackToVideoUpload: true,
  onDevicePoseTargetFps: 8,
};

const BASE_CONFIG: OnDevicePoseConfig = { ...DEFAULT_ON_DEVICE_POSE_CONFIG };

const BASE_PARAMS = {
  videoUri: "file:///tmp/test.mp4",
  verificationId: "ver-001",
  activityId: "sit",
  userId: "user-abc",
  dogAiBaseUrl: "http://localhost:8000",
  flags: BASE_FLAGS,
  config: BASE_CONFIG,
};

// Mock global fetch.
const mockFetch = jest.fn();
(globalThis as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  __reset();
  mockFetch.mockReset();
  // Default: server accepts the payload.
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
});

// ---------------------------------------------------------------------------
// Helper to assert a server_fallback result and check its reason.
// TypeScript does not narrow based on expect() calls, so we use explicit guards.
// ---------------------------------------------------------------------------

function assertServerFallback(
  result: Awaited<ReturnType<typeof attemptOnDevicePoseSubmit>>,
  reasonMatcher: string | RegExp,
) {
  expect(result.path).toBe("server_fallback");
  if (result.path === "server_fallback") {
    if (typeof reasonMatcher === "string") {
      expect(result.reason).toBe(reasonMatcher);
    } else {
      expect(result.reason).toMatch(reasonMatcher);
    }
  }
}

function assertServerFallbackContains(
  result: Awaited<ReturnType<typeof attemptOnDevicePoseSubmit>>,
  substring: string,
) {
  expect(result.path).toBe("server_fallback");
  if (result.path === "server_fallback") {
    expect(result.reason).toContain(substring);
  }
}

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

describe("feature flag: onDevicePoseEnabled = false", () => {
  it("falls back to server immediately", async () => {
    const result = await attemptOnDevicePoseSubmit({
      ...BASE_PARAMS,
      flags: { ...BASE_FLAGS, onDevicePoseEnabled: false },
    });
    assertServerFallback(result, "feature_flag_disabled");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("feature flag: onDevicePoseRolloutPercentage = 0", () => {
  it("falls back to server for every user", async () => {
    const result = await attemptOnDevicePoseSubmit({
      ...BASE_PARAMS,
      flags: { ...BASE_FLAGS, onDevicePoseRolloutPercentage: 0 },
    });
    assertServerFallback(result, "outside_rollout");
  });
});

describe("feature flag: onDevicePoseRolloutPercentage = 100", () => {
  it("includes every user in rollout", async () => {
    const result = await attemptOnDevicePoseSubmit({
      ...BASE_PARAMS,
      flags: { ...BASE_FLAGS, onDevicePoseRolloutPercentage: 100 },
    });
    // Should not fall back due to rollout gate (may fall back for other reasons).
    if (result.path === "server_fallback") {
      expect(result.reason).not.toBe("outside_rollout");
    }
  });
});

// ---------------------------------------------------------------------------
// Native module availability
// ---------------------------------------------------------------------------

describe("native module unavailable", () => {
  it("falls back to server", async () => {
    __setAvailable(false);
    const result = await attemptOnDevicePoseSubmit(BASE_PARAMS);
    assertServerFallback(result, "native_module_unavailable");
  });
});

// ---------------------------------------------------------------------------
// Extraction failure
// ---------------------------------------------------------------------------

describe("extraction throws", () => {
  it("falls back to server with error reason", async () => {
    __setShouldThrow(true, "Vision framework error");
    const result = await attemptOnDevicePoseSubmit(BASE_PARAMS);
    assertServerFallbackContains(result, "Vision framework error");
  });
});

// ---------------------------------------------------------------------------
// Quality gates
// ---------------------------------------------------------------------------

describe("quality gate: dropped frame rate too high", () => {
  it("falls back to server", async () => {
    const payload: PoseSequencePayload = {
      ...MOCK_PAYLOAD,
      benchmark: {
        ...MOCK_PAYLOAD.benchmark,
        dropped_frame_rate: 0.50,  // exceeds DEFAULT maxDroppedFrameRate=0.30
        dropped_frame_count: 12,
      },
    };
    __setPayload(payload);
    const result = await attemptOnDevicePoseSubmit(BASE_PARAMS);
    assertServerFallbackContains(result, "Dropped frame rate");
  });
});

describe("quality gate: avg keypoint confidence too low", () => {
  it("falls back to server", async () => {
    const payload: PoseSequencePayload = {
      ...MOCK_PAYLOAD,
      benchmark: {
        ...MOCK_PAYLOAD.benchmark,
        avg_keypoint_confidence: 0.30,  // below DEFAULT minAverageKeypointConfidence=0.50
      },
    };
    __setPayload(payload);
    const result = await attemptOnDevicePoseSubmit(BASE_PARAMS);
    assertServerFallbackContains(result, "keypoint confidence");
  });
});

describe("quality gate: dropped rate at threshold boundary", () => {
  it("allows dropped rate exactly at threshold", async () => {
    const payload: PoseSequencePayload = {
      ...MOCK_PAYLOAD,
      benchmark: {
        ...MOCK_PAYLOAD.benchmark,
        dropped_frame_rate: 0.30,  // exactly at threshold -- should pass (>)
        avg_keypoint_confidence: 0.84,
      },
    };
    __setPayload(payload);
    // Should reach the fetch step (not fall back due to quality gate).
    const result = await attemptOnDevicePoseSubmit(BASE_PARAMS);
    // Either succeeds or falls back at a different step -- but not at quality gate.
    if (result.path === "server_fallback") {
      expect(result.reason).not.toContain("Dropped frame rate");
    }
  });
});

// ---------------------------------------------------------------------------
// Server rejection
// ---------------------------------------------------------------------------

describe("server rejection with fallback enabled", () => {
  it("falls back to server_fallback path", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 422 });
    const result = await attemptOnDevicePoseSubmit({
      ...BASE_PARAMS,
      flags: { ...BASE_FLAGS, onDevicePoseFallbackToVideoUpload: true },
    });
    assertServerFallbackContains(result, "422");
  });
});

describe("server rejection with fallback disabled", () => {
  it("still returns server_fallback path (error propagation)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await attemptOnDevicePoseSubmit({
      ...BASE_PARAMS,
      flags: { ...BASE_FLAGS, onDevicePoseFallbackToVideoUpload: false },
    });
    assertServerFallbackContains(result, "500");
  });
});

// ---------------------------------------------------------------------------
// Successful on-device path
// ---------------------------------------------------------------------------

describe("successful on-device extraction and submission", () => {
  it("returns on_device path with benchmark", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    const result = await attemptOnDevicePoseSubmit(BASE_PARAMS);
    expect(result.path).toBe("on_device");
    if (result.path === "on_device") {
      expect(result.status).toBe(200);
      expect(result.benchmark).toBeDefined();
      expect(typeof result.benchmark.avg_inference_ms).toBe("number");
    }
  });

  it("calls fetch with the correct endpoint", async () => {
    await attemptOnDevicePoseSubmit(BASE_PARAMS);
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/analyze/pose-sequence",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends X-Pose-Encoding header", async () => {
    await attemptOnDevicePoseSubmit(BASE_PARAMS);
    const [, init] = mockFetch.mock.calls[0]!;
    expect((init as RequestInit).headers).toHaveProperty("X-Pose-Encoding");
  });
});

// ---------------------------------------------------------------------------
// isUserInOnDeviceRollout
// ---------------------------------------------------------------------------

describe("isUserInOnDeviceRollout", () => {
  it("returns false for 0%", () => {
    expect(isUserInOnDeviceRollout("user-xyz", 0)).toBe(false);
  });

  it("returns true for 100%", () => {
    expect(isUserInOnDeviceRollout("user-xyz", 100)).toBe(true);
  });

  it("is deterministic for the same userId", () => {
    const a = isUserInOnDeviceRollout("user-abc-123", 50);
    const b = isUserInOnDeviceRollout("user-abc-123", 50);
    expect(a).toBe(b);
  });

  it("differs between different userIds", () => {
    // With 50% rollout and many users, results should vary.
    const ids = Array.from({ length: 100 }, (_, i) => `user-${i}`);
    const included = ids.filter(id => isUserInOnDeviceRollout(id, 50));
    // Not all should be included, not all excluded (statistical).
    expect(included.length).toBeGreaterThan(10);
    expect(included.length).toBeLessThan(90);
  });

  it("approximately 50% of users fall in 50% rollout", () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `stable-user-${i}`);
    const count = ids.filter(id => isUserInOnDeviceRollout(id, 50)).length;
    // Allow generous range for hash distribution.
    expect(count).toBeGreaterThan(350);
    expect(count).toBeLessThan(650);
  });

  it("approximately 5% of users fall in 5% rollout", () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `test-user-${i}`);
    const count = ids.filter(id => isUserInOnDeviceRollout(id, 5)).length;
    expect(count).toBeGreaterThan(50);   // >2.5%
    expect(count).toBeLessThan(200);     // <10%
  });
});

// ---------------------------------------------------------------------------
// CoreMLPoseExtractor
// ---------------------------------------------------------------------------

describe("CoreMLPoseExtractor", () => {
  it("returns success with shouldFallback=false for good payload", async () => {
    const extractor = new CoreMLPoseExtractor();
    const result = await extractor.extract({
      videoUri: "file:///tmp/test.mp4",
      verificationId: "v1",
      activityId: "sit",
      config: BASE_CONFIG,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.shouldFallback).toBe(false);
      expect(result.payload.verification_id).toBe(MOCK_PAYLOAD.verification_id);
    }
  });

  it("returns shouldFallback=true when native module throws", async () => {
    __setShouldThrow(true, "Model failed to load");
    const extractor = new CoreMLPoseExtractor();
    const result = await extractor.extract({
      videoUri: "file:///tmp/test.mp4",
      verificationId: "v1",
      activityId: "sit",
      config: BASE_CONFIG,
    });
    expect(result.success).toBe(false);
    if (result.success === false) {
      expect(result.shouldFallback).toBe(true);
      expect(result.error).toContain("Model failed to load");
    }
  });

  it("populates payload_size_bytes in benchmark", async () => {
    const extractor = new CoreMLPoseExtractor();
    const result = await extractor.extract({
      videoUri: "file:///tmp/test.mp4",
      verificationId: "v1",
      activityId: "sit",
      config: BASE_CONFIG,
    });
    if (result.success) {
      expect(result.payload.benchmark.payload_size_bytes).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// ServerPoseExtractor
// ---------------------------------------------------------------------------

describe("ServerPoseExtractor", () => {
  it("always returns shouldFallback=true", async () => {
    const extractor = new ServerPoseExtractor();
    const result = await extractor.extract({
      videoUri: "file:///tmp/test.mp4",
      verificationId: "v1",
      activityId: "sit",
      config: BASE_CONFIG,
    });
    expect(result.shouldFallback).toBe(true);
  });
});
