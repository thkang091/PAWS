import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getRewardCatalog, getRewardRedemptions, redeemReward } from "@/services/rewardService";

export const useRewardCatalog = () =>
  useQuery({
    queryKey: queryKeys.rewards,
    queryFn: getRewardCatalog,
  });

export const useRewardRedemptions = (dogId?: string) =>
  useQuery({
    queryKey: dogId ? queryKeys.redemptions(dogId) : ["redemptions", "missing"],
    queryFn: () => getRewardRedemptions(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useRedeemReward = (dogId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rewardId: string) => redeemReward(dogId, rewardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.redemptions(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(dogId) });
    },
  });
};
