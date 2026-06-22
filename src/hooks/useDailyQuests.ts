import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { completeDailyQuest, getDailyQuests, initializeDailyQuests } from "@/services/questService";

export const todayKey = (): string => new Date().toISOString().slice(0, 10);

export const useDailyQuests = (dogId?: string, date = todayKey()) =>
  useQuery({
    queryKey: dogId ? queryKeys.dailyQuests(dogId, date) : ["dailyQuests", "missing", date],
    queryFn: () => getDailyQuests(dogId ?? "", date),
    enabled: Boolean(dogId),
  });

export const useInitializeDailyQuests = (dogId: string, date = todayKey()) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => initializeDailyQuests(dogId, date),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyQuests(dogId, date) });
    },
  });
};

export const useCompleteDailyQuest = (dogId: string, date = todayKey()) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (questId: string) => completeDailyQuest(questId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dailyQuests(dogId, date) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(dogId) });
    },
  });
};
