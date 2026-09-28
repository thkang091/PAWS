import { env } from "@/config/env";
import { getActivityDefinition } from "@/config/activityDefinitions";
import { getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type { CompressedPosePayload } from "@/types/onDevicePose";
import type {
  ActivityAnalysisRequest,
  ActivityAnalysisResponse,
  ActivityDefinition,
  ActivityVerification,
  ActivityVerificationStatus,
  DailyRoutineLog,
  VerificationContextType,
} from "@/types/activityVerification";
import type { ActivityVerificationRow, DailyRoutineLogRow, Json } from "@/types/database";

export const maxActivityPhotoBytes = 10 * 1024 * 1024;
export const maxActivityVideoBytes = 100 * 1024 * 1024;

const mapVerification = (row: ActivityVerificationRow): ActivityVerification => ({
  id: row.id,
  userId: row.user_id,
  dogId: row.dog_id,
  activityId: row.activity_id,
  activityCategory: row.activity_category as ActivityVerification["activityCategory"],
  verificationMode: row.verification_mode as ActivityVerification["verificationMode"],
  trustLevel: row.trust_level as ActivityVerification["trustLevel"],
  contextType: row.context_type as ActivityVerification["contextType"],
  sourceType: row.source_type as ActivityVerification["sourceType"],
  storagePath: row.storage_path,
  status: row.status as ActivityVerificationStatus,
  confidenceScore: row.confidence_score,
  modelName: row.model_name,
  failureReason: row.failure_reason,
  retryGuidance: row.retry_guidance,
  analysisSummary: row.analysis_summary && typeof row.analysis_summary === "object" && !Array.isArray(row.analysis_summary) ? row.analysis_summary as Record<string, unknown> : null,
  createdAt: row.created_at,
});

const mapRoutineLog = (row: DailyRoutineLogRow): DailyRoutineLog => ({
  id: row.id,
  dogId: row.dog_id,
  routineType: row.routine_type,
  completionMethod: row.completion_method as DailyRoutineLog["completionMethod"],
  completedAt: row.completed_at,
  notes: row.notes,
});

const inferContentType = (uri: string, fallback: string): string => {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith(".png")) return "image/png";
  if (normalized.endsWith(".heic")) return "image/heic";
  if (normalized.endsWith(".mov")) return "video/quicktime";
  if (normalized.endsWith(".mp4")) return "video/mp4";
  if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) return "image/jpeg";
  return fallback;
};

const getExtension = (uri: string, fallback: string): string => {
  const extension = uri.split(".").pop()?.split("?")[0]?.toLowerCase();
  return extension && extension.length <= 5 ? extension : fallback;
};

export const createActivityVerification = async ({
  dogId,
  definition,
  contextType,
  sourceType,
  relatedQuestId = null,
  relatedTrainingLessonId = null,
}: {
  dogId: string;
  definition: ActivityDefinition;
  contextType: VerificationContextType;
  sourceType: ActivityVerification["sourceType"];
  relatedQuestId?: string | null;
  relatedTrainingLessonId?: string | null;
}): Promise<ActivityVerification> => {
  const client = getClientOrThrow();
  const user = await client.auth.getUser();
  throwIfError(user.error);
  const userId = user.data.user?.id;
  if (!userId) throw new Error("Authentication required.");

  const { data, error } = await client.from("activity_verifications").insert({
    user_id: userId,
    dog_id: dogId,
    activity_id: definition.id,
    activity_category: definition.category,
    verification_mode: definition.verificationMode,
    trust_level: definition.trustLevel,
    context_type: contextType,
    related_quest_id: relatedQuestId,
    related_training_lesson_id: relatedTrainingLessonId,
    source_type: sourceType,
    status: "pending",
  }).select("*").single();
  throwIfError(error);
  return mapVerification(data);
};

export const uploadActivityVideo = async ({
  dogId,
  userId,
  activityId,
  verificationId,
  uri,
  fileSize,
}: {
  dogId: string;
  userId: string;
  activityId: string;
  verificationId: string;
  uri: string;
  fileSize?: number;
}): Promise<string> => {
  if (typeof fileSize === "number" && fileSize > maxActivityVideoBytes) throw new Error("Activity video is larger than 100 MB.");
  const client = getClientOrThrow();
  const extension = getExtension(uri, "mp4");
  const storagePath = `${userId}/${dogId}/${activityId}/${verificationId}/video.${extension}`;
  const response = await fetch(uri);
  const blob = await response.blob();
  const contentType = inferContentType(uri, "video/mp4");
  if (!["video/mp4", "video/quicktime"].includes(contentType)) throw new Error("Activity video type is not supported.");

  const upload = await client.storage.from("dog-activity-videos").upload(storagePath, blob, { contentType, upsert: false });
  throwIfError(upload.error);
  const update = await client.from("activity_verifications").update({ storage_path: storagePath, status: "analyzing" }).eq("id", verificationId);
  throwIfError(update.error);
  return storagePath;
};

export const uploadActivityPhoto = async ({
  dogId,
  userId,
  activityId,
  verificationId,
  uri,
  fileSize,
}: {
  dogId: string;
  userId: string;
  activityId: string;
  verificationId: string;
  uri: string;
  fileSize?: number;
}): Promise<string> => {
  if (typeof fileSize === "number" && fileSize > maxActivityPhotoBytes) throw new Error("Activity photo is larger than 10 MB.");
  const client = getClientOrThrow();
  const extension = getExtension(uri, "jpg");
  const storagePath = `${userId}/${dogId}/${activityId}/${verificationId}/photo.${extension}`;
  const response = await fetch(uri);
  const blob = await response.blob();
  const contentType = inferContentType(uri, "image/jpeg");
  if (!["image/jpeg", "image/png", "image/heic"].includes(contentType)) throw new Error("Activity photo type is not supported.");

  const upload = await client.storage.from("dog-activity-photos").upload(storagePath, blob, { contentType, upsert: false });
  throwIfError(upload.error);
  return storagePath;
};

export const requestActivityAnalysis = async (request: ActivityAnalysisRequest): Promise<ActivityAnalysisResponse> => {
  if (!env.isValid || !env.data.enableRealDogAi || !env.data.dogAiBaseUrl) {
    throw new Error("Real dog AI is not enabled. Set EXPO_PUBLIC_ENABLE_REAL_DOG_AI=true and EXPO_PUBLIC_DOG_AI_BASE_URL to your Python backend.");
  }

  const response = await fetch(`${env.data.dogAiBaseUrl}/analyze/activity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error("Dog AI verification failed to analyze the activity.");
  }

  return response.json() as Promise<ActivityAnalysisResponse>;
};

export const getActivityVerification = async (verificationId: string): Promise<ActivityVerification> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("activity_verifications").select("*").eq("id", verificationId).single();
  throwIfError(error);
  return mapVerification(data);
};

export const getActivityVerifications = async (dogId: string): Promise<ActivityVerification[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("activity_verifications").select("*").eq("dog_id", dogId).order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapVerification);
};

export const submitUserConfirmedRoutine = async (dogId: string, activityId: string, notes: string | null): Promise<ActivityVerification> => {
  const definition = getActivityDefinition(activityId);
  if (!definition || definition.verificationMode !== "USER_CONFIRMATION") {
    throw new Error("This routine cannot be completed with user confirmation.");
  }

  const client = getClientOrThrow();
  const { data, error } = await client.rpc("submit_user_confirmed_routine", {
    target_dog_id: dogId,
    routine_activity_id: activityId,
    routine_notes: notes,
    routine_metadata: { source: "mobile" } as Json,
  });
  throwIfError(error);
  return mapVerification(data);
};

export const submitPhotoConfirmedRoutine = async ({
  dogId,
  userId,
  activityId,
  uri,
  fileSize,
  notes,
}: {
  dogId: string;
  userId: string;
  activityId: string;
  uri: string;
  fileSize?: number;
  notes: string | null;
}): Promise<ActivityVerification> => {
  const definition = getActivityDefinition(activityId);
  if (!definition || definition.verificationMode !== "PHOTO_CONFIRMATION") {
    throw new Error("This routine cannot be completed with photo confirmation.");
  }
  const storageId = `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storagePath = await uploadActivityPhoto({ dogId, userId, activityId, verificationId: storageId, uri, fileSize });

  const client = getClientOrThrow();
  const { data, error } = await client.rpc("submit_photo_confirmed_routine", {
    target_dog_id: dogId,
    routine_activity_id: activityId,
    storage_path_value: storagePath,
    routine_notes: notes,
    routine_metadata: { source: "mobile" } as Json,
  });
  throwIfError(error);
  return mapVerification(data);
};

export const getDailyRoutineLogs = async (dogId: string): Promise<DailyRoutineLog[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("daily_routine_logs").select("*").eq("dog_id", dogId).order("completed_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapRoutineLog);
};

export const submitPoseSequencePayload = async ({
  verificationId,
  userId,
  dogId,
  activityId,
  contextType,
  envelope,
}: {
  verificationId: string;
  userId: string;
  dogId: string;
  activityId: string;
  contextType: string;
  envelope: CompressedPosePayload;
}): Promise<ActivityAnalysisResponse> => {
  if (!env.isValid || !env.data.enableRealDogAi || !env.data.dogAiBaseUrl) {
    throw new Error(
      "Real dog AI is not enabled. Set EXPO_PUBLIC_ENABLE_REAL_DOG_AI=true and EXPO_PUBLIC_DOG_AI_BASE_URL.",
    );
  }

  const client = getClientOrThrow();
  const update = await client
    .from("activity_verifications")
    .update({ status: "analyzing" })
    .eq("id", verificationId);
  throwIfError(update.error);

  const response = await fetch(`${env.data.dogAiBaseUrl}/analyze/pose-sequence`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Pose-Encoding": envelope.encoding,
      "X-Verification-Id": verificationId,
      "X-User-Id": userId,
      "X-Dog-Id": dogId,
      "X-Activity-Id": activityId,
      "X-Context-Type": contextType,
    },
    body: JSON.stringify(envelope),
  });

  if (!response.ok) {
    throw new Error(`Pose sequence submission failed with status ${response.status}.`);
  }

  return response.json() as Promise<ActivityAnalysisResponse>;
};

export const subscribeToVerificationUpdates = (verificationId: string, onChange: (verification: ActivityVerification) => void) => {
  const client = getClientOrThrow();
  const channel = client.channel(`activity-verification:${verificationId}`).on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "activity_verifications", filter: `id=eq.${verificationId}` },
    (payload) => onChange(mapVerification(payload.new as ActivityVerificationRow)),
  ).subscribe();

  return () => {
    void client.removeChannel(channel);
  };
};
