import type { PoseSequencePayload } from "@/types/onDevicePose";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NativeModule: Record<string, (...args: any[]) => Promise<unknown>> | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { requireNativeModule } = require("expo-modules-core") as {
    requireNativeModule: (name: string) => Record<string, (...args: unknown[]) => Promise<unknown>>;
  };
  NativeModule = requireNativeModule("PawsPose");
} catch {
  NativeModule = null;
}

export type ExtractFromVideoOptions = {
  videoUri: string;
  verificationId: string;
  activityId: string;
  targetFps?: number;
  minFrameConfidence?: number;
};

export const PawsPoseModule = {
  async isAvailable(): Promise<boolean> {
    if (!NativeModule) return false;
    try {
      return (await NativeModule.isSupported()) as boolean;
    } catch {
      return false;
    }
  },

  async extractFromVideo(options: ExtractFromVideoOptions): Promise<PoseSequencePayload> {
    if (!NativeModule) {
      throw new Error("PawsPose native module is not available in this environment.");
    }
    const result = await NativeModule.extractFromVideo(options);
    return result as PoseSequencePayload;
  },
};
