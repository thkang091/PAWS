import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getChallengeGamesForDog, getGameCatalog, getPrerequisiteMasteryStatus } from "@/services/gameService";

export const useGameCatalog = () =>
  useQuery({
    queryKey: queryKeys.gameCatalog,
    queryFn: getGameCatalog,
  });

export const useChallengeGamesForDog = (dogId?: string) =>
  useQuery({
    queryKey: dogId ? queryKeys.challengeGames(dogId) : ["challengeGames", "missing"],
    queryFn: () => getChallengeGamesForDog(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const useChallengePrereqs = (dogId: string, gameId: string, requiredIds: string[]) =>
  useQuery({
    queryKey: queryKeys.challengePrereqs(dogId, gameId),
    queryFn: () => getPrerequisiteMasteryStatus(dogId, requiredIds),
    enabled: Boolean(dogId) && Boolean(gameId) && requiredIds.length > 0,
    select: (mastered) => ({
      mastered,
      allMet: requiredIds.every((id) => mastered.has(id)),
      pending: requiredIds.filter((id) => !mastered.has(id)),
    }),
  });
