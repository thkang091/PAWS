import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { completeWeeklyPlanItem, generateWeeklyPlan, weekStartKey } from "@/services/weeklyPlanService";

export const useWeeklyPlan = (dogId?: string, weekStart = weekStartKey()) =>
  useQuery({
    queryKey: dogId ? queryKeys.weeklyPlan(dogId, weekStart) : ["weeklyPlan", "missing", weekStart],
    queryFn: () => generateWeeklyPlan(dogId ?? "", weekStart, false),
    enabled: Boolean(dogId),
  });

export const useRegenerateWeeklyPlan = (dogId: string, weekStart = weekStartKey()) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateWeeklyPlan(dogId, weekStart, true),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.weeklyPlan(dogId, weekStart) });
    },
  });
};

export const useCompleteWeeklyPlanItem = (dogId: string, weekStart = weekStartKey()) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeWeeklyPlanItem,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.weeklyPlan(dogId, weekStart) });
    },
  });
};
