import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { enterGame, getGameEntries, getGameInstances, startChallengeGameAttempt } from "@/services/gameService";

export const useGameInstances = () =>
  useQuery({
    queryKey: queryKeys.gameInstances,
    queryFn: getGameInstances,
  });

export const useGameEntries = (dogId?: string) =>
  useQuery({
    queryKey: dogId ? queryKeys.gameEntries(dogId) : ["gameEntries", "missing"],
    queryFn: () => getGameEntries(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useEnterGame = (dogId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (gameInstanceId: string) => enterGame(dogId, gameInstanceId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gameEntries(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(dogId) });
    },
  });
};

export const useStartChallengeGameAttempt = (dogId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (challengeGameId: string) => startChallengeGameAttempt(dogId, challengeGameId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.challengeGames(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(dogId) });
    },
  });
};
