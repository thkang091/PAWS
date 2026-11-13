import { useQuery } from "@tanstack/react-query";
import { getGamesOfTheWeek } from "@/services/weekService";

import { getBoard, getOverview, getTerritory, type ShapeTier } from "@/services/tournamentService";

export const tournamentKeys = {
  all: ["tournament"] as const,
  overview: ["tournament", "overview"] as const,
  board: (id: string) => ["tournament", "board", id] as const,
  territory: (id: string) => ["tournament", "territory", id] as const,
};

/** A function that is not deployed yet is a setup problem, not a blip, so it is not retried. */
const retry = (count: number, error: unknown) => count < 1 && (error as { code?: string })?.code !== "not_deployed";

export const useTournamentOverview = () =>
  useQuery({ queryKey: tournamentKeys.overview, queryFn: getOverview, staleTime: 30_000, retry });

export const useTournamentBoard = (tournamentId: string | undefined, tier?: ShapeTier | null) =>
  useQuery({
    queryKey: [...tournamentKeys.board(tournamentId ?? ""), tier ?? "all"],
    queryFn: () => getBoard(tournamentId ?? "", tier),
    enabled: Boolean(tournamentId),
    staleTime: 20_000,
    retry,
  });

export const useTerritory = (submissionId: string | undefined) =>
  useQuery({
    queryKey: tournamentKeys.territory(submissionId ?? ""),
    queryFn: () => getTerritory(submissionId ?? ""),
    enabled: Boolean(submissionId),
    staleTime: Infinity,
    retry,
  });

/** Best of the week: the most played games since Monday (totals only). */
export const useGamesOfTheWeek = () =>
  useQuery({
    queryKey: ["gamesOfTheWeek"],
    queryFn: () => getGamesOfTheWeek(5),
    staleTime: 60_000,
    retry: (count, error) => count < 1 && (error as { code?: string })?.code !== "not_deployed",
  });
