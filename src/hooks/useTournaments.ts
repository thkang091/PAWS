import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import {
  getTournamentEvent,
  joinTournament,
  listTournamentLeaderboard,
  listVisibleTournamentEvents,
  getMyTournamentEntry,
} from "@/services/tournamentService";

export const useVisibleTournaments = () =>
  useQuery({
    queryKey: queryKeys.tournaments,
    queryFn: listVisibleTournamentEvents,
  });

export const useTournamentEvent = (tournamentId?: string) =>
  useQuery({
    queryKey: tournamentId ? queryKeys.tournamentEvent(tournamentId) : ["tournamentEvent", "missing"],
    queryFn: () => getTournamentEvent(tournamentId ?? ""),
    enabled: Boolean(tournamentId),
  });

export const useMyTournamentEntry = (tournamentId?: string, dogId?: string) =>
  useQuery({
    queryKey: tournamentId && dogId ? queryKeys.tournamentEntry(tournamentId, dogId) : ["tournamentEntry", "missing"],
    queryFn: () => getMyTournamentEntry(tournamentId ?? "", dogId ?? ""),
    enabled: Boolean(tournamentId) && Boolean(dogId),
  });

export const useTournamentLeaderboard = (tournamentId?: string) =>
  useQuery({
    queryKey: tournamentId ? queryKeys.tournamentLeaderboard(tournamentId) : ["tournamentLeaderboard", "missing"],
    queryFn: () => listTournamentLeaderboard(tournamentId ?? ""),
    enabled: Boolean(tournamentId),
  });

/**
 * Join tournament hook.
 *
 * Currently returns a "not available" result.
 * Join is not wired to a real RPC yet — see tournamentService.ts
 * for the TODO plan.
 */
export const useJoinTournament = () => ({ joinTournament });