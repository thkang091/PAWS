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
 * Phase 2A deliberately returns the service's write-disabled result. It does
 * not call join_tournament, mutate a wallet, or create a local mock entry.
 *
 * TODO (Phase 2B): Keep this cache invalidation when joinTournament is wired
 * to the secure join_tournament RPC.
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
      }
    },
  });
};

/**
 * Join tournament hook (legacy).
 *
 * Currently returns a "not available" result.
 * Use useJoinTournamentMutation for a mutation that also invalidates caches.
 *
 * @deprecated Use useJoinTournamentMutation instead.
 */
export const useJoinTournament = () => ({
  joinTournament: async (
    tournamentId: string,
    dogId: string,
  ): Promise<{ entry: TournamentEntry } | { error: string }> =>
    joinTournament(tournamentId, dogId),
});
