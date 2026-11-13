import { getClientOrThrow } from "@/services/serviceUtils";

/** One game's week: totals only (the database never says who played). */
export type WeekGame = {
  /** A tournament or room game key ("number_trail", "largest_country", ...), an arena game, or "challenge:<id>". */
  game: string;
  /** A solo challenge's own title (other games are named by the app). */
  title: string | null;
  plays: number;
  players: number;
  minutes: number;
  returningPlayers: number;
};

export type GamesOfTheWeek = { since: string; games: WeekGame[] };

/** The most played games since Monday: most plays, then most minutes, then most players who came back. */
export const getGamesOfTheWeek = async (limit = 5): Promise<GamesOfTheWeek> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("games_of_the_week" as never, { p_since: null, p_limit: limit } as never);
  if (error) {
    const missing = /schema cache|could not find/i.test(error.message);
    throw Object.assign(new Error(error.message), { code: missing ? "not_deployed" : "server_error" });
  }
  const out = (data ?? { since: new Date().toISOString(), games: [] }) as GamesOfTheWeek;
  return { since: out.since, games: Array.isArray(out.games) ? out.games : [] };
};
