import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getCurrentPlanSelection, getSubscriptionPlans, selectPlan } from "@/services/planService";
import type { SubscriptionPlan } from "@/types/domain";

export const useSubscriptionPlans = () =>
  useQuery({
    queryKey: queryKeys.plans,
    queryFn: getSubscriptionPlans,
  });

export const useCurrentPlanSelection = () =>
  useQuery({
    queryKey: queryKeys.planSelection,
    queryFn: getCurrentPlanSelection,
  });

export const useSelectPlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (plan: SubscriptionPlan) => selectPlan(plan),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.planSelection });
    },
  });
};
