import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import {
  getTournamentEvent,
  joinTournament,
  listTournamentLeaderboard,
  listVisibleTournamentEvents,
  getMyTournamentEntry,
} from "@/services/tournamentService";
import type { TournamentEntry } from "@/types/tournament";

export const useVisibleTournaments = () =>
  useQuery({
    queryKey: queryKeys.tournaments,
    queryFn: listVisibleTournamentEvents,
  });

export const useTournamentEvent = (tournamentId?: string) =>
  useQuery({
    queryKey: tournamentId
      ? queryKeys.tournamentEvent(tournamentId)
      : ["tournamentEvent", "missing"],
    queryFn: () => getTournamentEvent(tournamentId ?? ""),
    enabled: Boolean(tournamentId),
  });

export const useMyTournamentEntry = (
  tournamentId?: string,
  dogId?: string,
) =>
  useQuery({
    queryKey: tournamentId && dogId
      ? queryKeys.tournamentEntry(tournamentId, dogId)
      : ["tournamentEntry", "missing"],
    queryFn: () => getMyTournamentEntry(tournamentId ?? "", dogId ?? ""),
    enabled: Boolean(tournamentId) && Boolean(dogId),
  });

export const useTournamentLeaderboard = (tournamentId?: string) =>
  useQuery({
    queryKey: tournamentId
      ? queryKeys.tournamentLeaderboard(tournamentId)
      : ["tournamentLeaderboard", "missing"],
    queryFn: () => listTournamentLeaderboard(tournamentId ?? ""),
    enabled: Boolean(tournamentId),
  });

/**
 * Tournament join mutation wrapper.
 *
 * The service calls the secure, atomic join_tournament RPC. Cache refreshes
 * below make the entry, capacity, tournament list, and wallet reflect it.
 */
export const useJoinTournamentMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      tournamentId,
      dogId,
    }: {
      tournamentId: string;
      dogId: string;
    }) => joinTournament(tournamentId, dogId),
    onSuccess: (result, { tournamentId, dogId }) => {
      if (!("error" in result)) {
        // Invalidate entry + event cache so the UI re-reads
        void queryClient.invalidateQueries({
          queryKey: queryKeys.tournamentEntry(tournamentId, dogId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.tournamentEvent(tournamentId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.tournaments,
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.wallet(dogId),
        });
      }
    },
  });
};

/**
 * Join tournament hook (legacy).
 *
 * Use useJoinTournamentMutation for a mutation that also invalidates caches.
 *
 * @deprecated Use useJoinTournamentMutation instead.
 */
export const useJoinTournament = () => ({
  joinTournament: async (
    tournamentId: string,
    dogId: string,
  ) =>
    joinTournament(tournamentId, dogId),
});
