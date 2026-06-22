import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { completeTrainingSession, getTrainingProgress } from "@/services/trainingService";

export const useTrainingProgress = (dogId?: string) =>
  useQuery({
    queryKey: dogId ? queryKeys.trainingProgress(dogId) : ["trainingProgress", "missing"],
    queryFn: () => getTrainingProgress(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useCompleteTrainingSession = (dogId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (skillId: string) => completeTrainingSession(dogId, skillId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trainingProgress(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(dogId) });
    },
  });
};
