import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getWeightLogs, saveWeightLog } from "@/services/weightService";

export const useWeightLogs = (dogId?: string) =>
  useQuery({
    queryKey: dogId ? queryKeys.weightLogs(dogId) : ["weightLogs", "missing"],
    queryFn: () => getWeightLogs(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useSaveWeightLog = (dogId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveWeightLog,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.weightLogs(dogId) });
    },
  });
};
