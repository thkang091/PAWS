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
 * Join tournament hook — mock/dev phase.
 *
 * Mutates AsyncStorage (mock entry), then invalidates the
 * entry and event query caches so the UI reflects the joined state.
 *
 * TODO (Phase 2): Replace with a mutation that calls the
 *   join_tournament RPC once migration 0043 is applied.
 */
export const useMockJoinTournament = () => {
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
      }
    },
  });
};

/**
 * Join tournament hook (legacy).
 *
 * Currently returns a "not available" result.
 * Use useMockJoinTournament for a mutation that also invalidates caches.
 *
 * @deprecated Use useMockJoinTournament instead.
 */
export const useJoinTournament = () => ({
  joinTournament: async (
    tournamentId: string,
    dogId: string,
  ): Promise<{ entry: TournamentEntry } | { error: string }> =>
    joinTournament(tournamentId, dogId),
});