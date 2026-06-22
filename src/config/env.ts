import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .optional()
  .default("false")
  .transform((value) => value === "true");

const positiveIntString = (defaultValue: number) =>
  z
    .string()
    .optional()
    .default(String(defaultValue))
    .transform((v) => {
      const n = parseInt(v, 10);
      return isNaN(n) || n < 1 ? defaultValue : n;
    });

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .url("EXPO_PUBLIC_SUPABASE_URL must be a valid URL."),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z
    .string()
    .trim()
    .min(1, "EXPO_PUBLIC_SUPABASE_ANON_KEY is required."),
  EXPO_PUBLIC_ENABLE_PAID_PLANS: booleanString,
  EXPO_PUBLIC_ENABLE_REAL_DOG_AI: booleanString,
  EXPO_PUBLIC_ENABLE_SENSOR_ROUTINES: booleanString,
  EXPO_PUBLIC_ENABLE_RANKED_GAMES: booleanString,
  EXPO_PUBLIC_DOG_AI_BASE_URL: z.string().trim().url().optional().or(z.literal("")),

  // On-device pose extraction prototype.
  // All default to off / 0 / fallback-enabled so the production build is safe
  // without explicit env configuration.
  EXPO_PUBLIC_ON_DEVICE_POSE_ENABLED: booleanString,
  EXPO_PUBLIC_ON_DEVICE_POSE_ROLLOUT_PERCENTAGE: positiveIntString(0),
  EXPO_PUBLIC_ON_DEVICE_POSE_FALLBACK_TO_VIDEO_UPLOAD: z
    .enum(["true", "false"])
    .optional()
    .default("true")
    .transform((v) => v === "true"),
  EXPO_PUBLIC_ON_DEVICE_POSE_TARGET_FPS: positiveIntString(8),
});

const rawEnv = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_ENABLE_PAID_PLANS: process.env.EXPO_PUBLIC_ENABLE_PAID_PLANS,
  EXPO_PUBLIC_ENABLE_REAL_DOG_AI: process.env.EXPO_PUBLIC_ENABLE_REAL_DOG_AI,
  EXPO_PUBLIC_ENABLE_SENSOR_ROUTINES: process.env.EXPO_PUBLIC_ENABLE_SENSOR_ROUTINES,
  EXPO_PUBLIC_ENABLE_RANKED_GAMES: process.env.EXPO_PUBLIC_ENABLE_RANKED_GAMES,
  EXPO_PUBLIC_DOG_AI_BASE_URL: process.env.EXPO_PUBLIC_DOG_AI_BASE_URL,
  EXPO_PUBLIC_ON_DEVICE_POSE_ENABLED: process.env.EXPO_PUBLIC_ON_DEVICE_POSE_ENABLED,
  EXPO_PUBLIC_ON_DEVICE_POSE_ROLLOUT_PERCENTAGE:
    process.env.EXPO_PUBLIC_ON_DEVICE_POSE_ROLLOUT_PERCENTAGE,
  EXPO_PUBLIC_ON_DEVICE_POSE_FALLBACK_TO_VIDEO_UPLOAD:
    process.env.EXPO_PUBLIC_ON_DEVICE_POSE_FALLBACK_TO_VIDEO_UPLOAD,
  EXPO_PUBLIC_ON_DEVICE_POSE_TARGET_FPS: process.env.EXPO_PUBLIC_ON_DEVICE_POSE_TARGET_FPS,
};

const parsedEnv = envSchema.safeParse(rawEnv);

export type AppEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  enablePaidPlans: boolean;
  enableRealDogAi: boolean;
  enableSensorRoutines: boolean;
  enableRankedGames: boolean;
  dogAiBaseUrl: string | null;
  // On-device pose
  onDevicePoseEnabled: boolean;
  onDevicePoseRolloutPercentage: number;
  onDevicePoseFallbackToVideoUpload: boolean;
  onDevicePoseTargetFps: number;
};

export type EnvValidationResult =
  | {
      isValid: true;
      data: AppEnv;
      missingVariables: [];
      message: null;
    }
  | {
      isValid: false;
      data: null;
      missingVariables: string[];
      message: string;
    };

const missingVariables = Object.entries(rawEnv)
  .filter(([key, value]) => {
    // Optional keys that are allowed to be absent.
    const optional = [
      "EXPO_PUBLIC_ENABLE_PAID_PLANS",
      "EXPO_PUBLIC_ON_DEVICE_POSE_ENABLED",
      "EXPO_PUBLIC_ON_DEVICE_POSE_ROLLOUT_PERCENTAGE",
      "EXPO_PUBLIC_ON_DEVICE_POSE_FALLBACK_TO_VIDEO_UPLOAD",
      "EXPO_PUBLIC_ON_DEVICE_POSE_TARGET_FPS",
    ];
    if (optional.includes(key)) return false;
    return typeof value !== "string" || value.trim().length === 0;
  })
  .map(([key]) => key);

const formatIssues = (error: z.ZodError): string =>
  error.issues.map((issue) => issue.message).join(" ");

export const env: EnvValidationResult = parsedEnv.success
  ? {
      isValid: true,
      data: {
        supabaseUrl: parsedEnv.data.EXPO_PUBLIC_SUPABASE_URL,
        supabaseAnonKey: parsedEnv.data.EXPO_PUBLIC_SUPABASE_ANON_KEY,
        enablePaidPlans: parsedEnv.data.EXPO_PUBLIC_ENABLE_PAID_PLANS,
        enableRealDogAi: parsedEnv.data.EXPO_PUBLIC_ENABLE_REAL_DOG_AI,
        enableSensorRoutines: parsedEnv.data.EXPO_PUBLIC_ENABLE_SENSOR_ROUTINES,
        enableRankedGames: parsedEnv.data.EXPO_PUBLIC_ENABLE_RANKED_GAMES,
        dogAiBaseUrl: parsedEnv.data.EXPO_PUBLIC_DOG_AI_BASE_URL || null,
        onDevicePoseEnabled: parsedEnv.data.EXPO_PUBLIC_ON_DEVICE_POSE_ENABLED,
        onDevicePoseRolloutPercentage:
          parsedEnv.data.EXPO_PUBLIC_ON_DEVICE_POSE_ROLLOUT_PERCENTAGE,
        onDevicePoseFallbackToVideoUpload:
          parsedEnv.data.EXPO_PUBLIC_ON_DEVICE_POSE_FALLBACK_TO_VIDEO_UPLOAD,
        onDevicePoseTargetFps: parsedEnv.data.EXPO_PUBLIC_ON_DEVICE_POSE_TARGET_FPS,
      },
      missingVariables: [],
      message: null,
    }
  : {
      isValid: false,
      data: null,
      missingVariables,
      message:
        missingVariables.length > 0
          ? `Missing required environment variables: ${missingVariables.join(", ")}.`
          : formatIssues(parsedEnv.error),
    };
