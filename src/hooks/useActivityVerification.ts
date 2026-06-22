import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import {
  createActivityVerification,
  getActivityVerification,
  getActivityVerifications,
  getDailyRoutineLogs,
  requestActivityAnalysis,
  submitPhotoConfirmedRoutine,
  submitUserConfirmedRoutine,
  uploadActivityVideo,
} from "@/services/activityVerificationService";
import type { ActivityDefinition, ActivityVerification, VerificationContextType } from "@/types/activityVerification";

export const useActivityVerifications = (dogId?: string) =>
  useQuery({
    queryKey: queryKeys.activityVerifications(dogId ?? ""),
    queryFn: () => getActivityVerifications(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useActivityVerification = (verificationId?: string) =>
  useQuery({
    queryKey: ["activityVerification", verificationId] as const,
    queryFn: () => getActivityVerification(verificationId ?? ""),
    enabled: Boolean(verificationId),
  });

export const useDailyRoutineLogs = (dogId?: string) =>
  useQuery({
    queryKey: queryKeys.dailyRoutineLogs(dogId ?? ""),
    queryFn: () => getDailyRoutineLogs(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useSubmitUserConfirmedRoutine = (dogId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, notes }: { activityId: string; notes: string | null }) =>
      submitUserConfirmedRoutine(dogId, activityId, notes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.activityVerifications(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyRoutineLogs(dogId) });
    },
  });
};

export const useSubmitPhotoConfirmedRoutine = (dogId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, userId, uri, fileSize, notes }: { activityId: string; userId: string; uri: string; fileSize?: number; notes: string | null }) =>
      submitPhotoConfirmedRoutine({ dogId, userId, activityId, uri, fileSize, notes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.activityVerifications(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyRoutineLogs(dogId) });
    },
  });
};

export const useSubmitVideoVerification = (dogId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      definition,
      contextType,
      userId,
      uri,
      fileSize,
      relatedTrainingLessonId = null,
    }: {
      definition: ActivityDefinition;
      contextType: VerificationContextType;
      userId: string;
      uri: string;
      fileSize?: number;
      relatedTrainingLessonId?: string | null;
    }): Promise<{ verification: ActivityVerification; resultStatus: string; retryGuidance: string | null }> => {
      const verification = await createActivityVerification({
        dogId,
        definition,
        contextType,
        sourceType: "in_app_video",
        relatedTrainingLessonId,
      });
      const storagePath = await uploadActivityVideo({
        dogId,
        userId,
        activityId: definition.id,
        verificationId: verification.id,
        uri,
        fileSize,
      });
      const analysis = await requestActivityAnalysis({
        verification_id: verification.id,
        user_id: userId,
        dog_id: dogId,
        activity_id: definition.id,
        verification_mode: definition.verificationMode,
        storage_path: storagePath,
        context_type: contextType,
      });

      return { verification, resultStatus: analysis.status, retryGuidance: analysis.retry_guidance };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.activityVerifications(dogId) });
    },
  });
};
