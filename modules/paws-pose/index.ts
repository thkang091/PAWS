/**
 * paws-pose native module JavaScript bindings.
 *
 * Wraps the PawsPose Expo native module with TypeScript types and provides a
 * safe `isAvailable()` guard that returns false when the native module is not
 * present (Expo Go, Android, CI).
 *
 * The native module is only compiled in development builds (expo prebuild).
 * In all other environments the module import returns undefined and the JS
 * layer silently falls back to server-side video upload.
 */

import type { PoseSequencePayload } from "@/types/onDevicePose";

// ---------------------------------------------------------------------------
// Native module access
// ---------------------------------------------------------------------------

// Dynamic require avoids a hard crash in Expo Go where the module is absent.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NativeModule: Record<string, (...args: any[]) => Promise<unknown>> | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { requireNativeModule } = require("expo-modules-core") as {
    requireNativeModule: (name: string) => Record<string, (...args: unknown[]) => Promise<unknown>>;
  };
  NativeModule = requireNativeModule("PawsPose");
} catch {
  // Module not available in this environment.
  NativeModule = null;
}

// ---------------------------------------------------------------------------
// Options for extractFromVideo
// ---------------------------------------------------------------------------

export type ExtractFromVideoOptions = {
  videoUri: string;
  verificationId: string;
  activityId: string;
  /** Target frames per second. Default: 8. */
  targetFps?: number;
  /** Minimum per-frame confidence. Default: 0.20. */
  minFrameConfidence?: number;
};

// ---------------------------------------------------------------------------
// Public module API
// ---------------------------------------------------------------------------

export const PawsPoseModule = {
  /**
   * Returns true when the native module is available AND the device supports
   * VNDetectAnimalBodyPoseRequest (iOS 17+).
   *
   * Call this before extractFromVideo to decide whether to use on-device
   * inference or fall back to video upload.
   */
  async isAvailable(): Promise<boolean> {
    if (!NativeModule) return false;
    try {
      return (await NativeModule.isSupported()) as boolean;
    } catch {
      return false;
    }
  },

  /**
   * Process a recorded video file and return a PoseSequencePayload.
   *
   * Throws when extraction fails. Callers must catch and trigger the
   * video-upload fallback.
   */
  async extractFromVideo(options: ExtractFromVideoOptions): Promise<PoseSequencePayload> {
    if (!NativeModule) {
      throw new Error("PawsPose native module is not available in this environment.");
    }
    const result = await NativeModule.extractFromVideo(options);
    return result as PoseSequencePayload;
  },
};
