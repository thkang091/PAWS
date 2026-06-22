import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getDogStreak } from "@/services/curriculumService";

export const useDogStreak = (dogId: string | undefined) =>
  useQuery({
    queryKey: dogId ? queryKeys.dogStreak(dogId) : ["dogStreak", "missing"],
    queryFn: () => getDogStreak(dogId ?? ""),
    enabled: Boolean(dogId),
  });
