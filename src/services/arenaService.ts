import { getClientOrThrow } from "@/services/serviceUtils";
import { RULES, weekStart, type ArenaGame, type ArenaPlan } from "../../supabase/functions/arena/logic";

export type { ArenaGame, ArenaPlan };

/** What the server hands back when an attempt starts. The plan is only known from this moment. */
export type ArenaAttempt = { id: string; game: ArenaGame; codeWord: string; plan: ArenaPlan; folder: string; expiresAt: string };

export type ArenaDuel = {
  id: string;
  game: ArenaGame;
  code: string;
  role: "host" | "guest";
  opponentName: string | null;
  status: "open" | "playing" | "done" | "expired";
  myScoreMs: number | null;
  theirScoreMs: number | null;
  myStarts: number;
  startsAllowed: number;
  myTurnOpen: boolean;
  theirTurnOver: boolean;
  result: "won" | "lost" | "draw" | null;
  myAttemptId: string | null;
  theirAttemptId: string | null;
  tricks: string[] | null;
  expiresAt: string;
  createdAt: string;
};

export type ArenaResult = {
  status: "scored" | "needs_review" | "invalid";
  scoreMs: number | null;
  reason: string | null;
  attemptId?: string;
  summary?: string;
  personalBest?: boolean;
  silver?: number;
  rank?: number | null;
  duel?: ArenaDuel | null;
};

export type BoardRow = {
  rank: number;
  dog_id: string;
  dog_name: string;
  score_ms: number;
  attempt_id: string;
  replay_public: boolean;
  is_mine: boolean;
  achieved_at: string;
};

export class ArenaError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const TIMEOUT_MS = 30_000;
/** Judging a three minute clip can take a while; the function itself stops at its platform limit. */
const SUBMIT_TIMEOUT_MS = 160_000;

const call = async <T>(body: Record<string, unknown>, timeout = TIMEOUT_MS): Promise<T> => {
  const client = getClientOrThrow();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  const { data, error } = await client.functions.invoke("arena", { body, signal: abort.signal }).finally(() => clearTimeout(timer));
  if (error) {
    const context = (error as { context?: Response }).context;
    if (!context) throw new ArenaError(abort.signal.aborted ? "timeout" : "network");
    if (context.status === 404) {
      const payload = await context.json().catch(() => null);
      throw new ArenaError((payload?.error as string) ?? "not_deployed");
    }
    const payload = typeof context.json === "function" ? await context.json().catch(() => null) : null;
    throw new ArenaError((payload?.error as string) ?? "server_error");
  }
  if (!data?.ok) throw new ArenaError((data?.error as string) ?? "server_error");
  return data as T;
};

export const startAttempt = (dogId: string, game: ArenaGame, duelId?: string) =>
  call<{ attempt: ArenaAttempt }>({ action: "start", dogId, game, duelId }).then((r) => r.attempt);

/** Uploads the clip to the person's own folder, then asks the server to check and score it. */
export const uploadClip = async (attempt: ArenaAttempt, uri: string) => {
  const client = getClientOrThrow();
  const ext = uri.toLowerCase().endsWith(".mp4") ? "mp4" : "mov";
  const bytes = await (await fetch(uri)).arrayBuffer();
  const { error } = await client.storage.from("arena-videos").upload(`${attempt.folder}/${attempt.id}.${ext}`, bytes, {
    contentType: ext === "mov" ? "video/quicktime" : "video/mp4",
    upsert: false,
  });
  // A retry after a busy judge finds the clip already there, which is fine.
  if (error && !/exists|duplicate/i.test(error.message)) throw new ArenaError("upload_failed");
  return ext as "mov" | "mp4";
};

export const submitAttempt = (attemptId: string, ext: "mov" | "mp4") =>
  call<{ result: ArenaResult }>({ action: "submit", attemptId, ext }, SUBMIT_TIMEOUT_MS).then((r) => r.result);

export const setReplayPublic = (attemptId: string, isPublic: boolean) => call({ action: "share", attemptId, public: isPublic });

export const getReplayUrl = (attemptId: string) => call<{ url: string }>({ action: "replay", attemptId }).then((r) => r.url);

export const createDuel = (dogId: string, game: ArenaGame) => call<{ duel: ArenaDuel }>({ action: "duel_create", dogId, game }).then((r) => r.duel);

export const joinDuel = (dogId: string, code: string) => call<{ duel: ArenaDuel }>({ action: "duel_join", dogId, code }).then((r) => r.duel);

export const getDuels = (dogId: string) => call<{ duels: ArenaDuel[] }>({ action: "duels", dogId }).then((r) => r.duels);

export const getBoard = async (game: ArenaGame, week: string): Promise<BoardRow[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("arena_board" as never, { p_game: game, p_week: week, p_limit: 50 } as never);
  if (error) throw new ArenaError(/arena_board|schema cache|does not exist/i.test(error.message) ? "not_deployed" : "server_error");
  return (data ?? []) as BoardRow[];
};

const utcMidnight = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
};

/** Tries used today and the dog's best ever, read from the dog's own attempts. */
export const getMyArena = async (dogId: string, game: ArenaGame) => {
  const client = getClientOrThrow();
  const [today, scored] = await Promise.all([
    client.from("arena_attempts" as never).select("id").eq("dog_id", dogId).eq("game", game).is("duel_id", null).gte("started_at", utcMidnight()),
    client.from("arena_attempts" as never).select("score_ms").eq("dog_id", dogId).eq("game", game).eq("status", "scored"),
  ]);
  if (today.error || scored.error) throw new ArenaError("not_deployed");
  const scores = ((scored.data ?? []) as { score_ms: number }[]).map((r) => r.score_ms);
  const best = scores.length ? (game === "longest_sit" ? Math.max(...scores) : Math.min(...scores)) : null;
  return { triesLeft: Math.max(0, RULES[game].triesPerDay - (today.data ?? []).length), triesPerDay: RULES[game].triesPerDay, bestMs: best };
};

export const previousWeek = (week: string) => {
  const d = new Date(`${week}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
};

export const currentWeek = () => weekStart(new Date());

export const weeklyPrizeKey = (game: ArenaGame, week: string, dogId: string) => `arena_week:${game}:${week}:${dogId}`;

export const hasClaimedWeek = async (game: ArenaGame, week: string, dogId: string) => {
  const client = getClientOrThrow();
  const { data } = await client.from("wallet_transactions").select("id").eq("idempotency_key", weeklyPrizeKey(game, week, dogId)).maybeSingle();
  return Boolean(data);
};

export const claimWeek = async (dogId: string, game: ArenaGame, week: string) => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("arena_claim_week" as never, { p_dog_id: dogId, p_game: game, p_week: week } as never);
  if (error) throw new ArenaError(error.message.match(/[a-z_]{6,}/)?.[0] ?? "server_error");
  return data as unknown as { rank: number; gold: number };
};
