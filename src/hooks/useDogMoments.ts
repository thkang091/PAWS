import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getDogMoments, uploadDogMoment } from "@/services/dogMomentService";

export const useDogMoments = (dogId?: string) =>
  useQuery({
    queryKey: dogId ? queryKeys.dogMoments(dogId) : ["dogMoments", "missing"],
    queryFn: () => getDogMoments(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useUploadDogMoment = (dogId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadDogMoment,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dogMoments(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(dogId) });
    },
  });
};
