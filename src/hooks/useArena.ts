import { useQuery } from "@tanstack/react-query";

import {
  currentWeek,
  getBoard,
  getDuels,
  getMyArena,
  hasClaimedWeek,
  previousWeek,
  type ArenaGame,
} from "@/services/arenaService";

export const arenaKeys = {
  all: ["arena"] as const,
  board: (game: ArenaGame, week: string) => ["arena", "board", game, week] as const,
  mine: (dogId: string, game: ArenaGame) => ["arena", "mine", dogId, game] as const,
  duels: (dogId: string) => ["arena", "duels", dogId] as const,
  prize: (dogId: string, game: ArenaGame, week: string) => ["arena", "prize", dogId, game, week] as const,
};

/** A missing function or table is a setup problem, not a blip, so it is not retried. */
const retry = (count: number, error: unknown) => count < 1 && (error as { code?: string })?.code !== "not_deployed";

export const useArenaBoard = (game: ArenaGame, week = currentWeek()) =>
  useQuery({ queryKey: arenaKeys.board(game, week), queryFn: () => getBoard(game, week), staleTime: 30_000, retry });

export const useMyArena = (dogId: string | undefined, game: ArenaGame) =>
  useQuery({
    queryKey: arenaKeys.mine(dogId ?? "", game),
    queryFn: () => getMyArena(dogId ?? "", game),
    enabled: Boolean(dogId),
    staleTime: 15_000,
    retry,
  });

export const useDuels = (dogId: string | undefined) =>
  useQuery({ queryKey: arenaKeys.duels(dogId ?? ""), queryFn: () => getDuels(dogId ?? ""), enabled: Boolean(dogId), staleTime: 15_000, retry });

/** Last week's place for this dog, and whether its gold was already claimed. */
export const useLastWeekPrize = (dogId: string | undefined, game: ArenaGame) => {
  const week = previousWeek(currentWeek());
  const board = useArenaBoard(game, week);
  const mine = board.data?.find((r) => r.dog_id === dogId);
  const claimed = useQuery({
    queryKey: arenaKeys.prize(dogId ?? "", game, week),
    queryFn: () => hasClaimedWeek(game, week, dogId ?? ""),
    enabled: Boolean(dogId && mine && mine.rank <= 3),
    staleTime: 60_000,
  });
  const eligible = Boolean(mine && mine.rank <= 3 && (board.data?.length ?? 0) >= 5);
  return { week, row: mine ?? null, eligible, claimed: claimed.data ?? false };
};
