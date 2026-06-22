import {
  createIdempotencyKey,
  getClientOrThrow,
  mapChallengeGame,
  mapGameDefinition,
  mapGameEntry,
  mapGameInstance,
  throwIfError,
} from "@/services/serviceUtils";
import { CHALLENGE_GAME_CATALOG } from "@/data/challengeGames";
import type { ChallengeGame, GameDefinition, GameEntry, GameInstance, OwnerTrainingGoal, WalletSummary } from "@/types/domain";
import type { ChallengeGameAttemptRow, ChallengeGameRow, GameEntryRow, Json } from "@/types/database";

const getErrorText = (error: unknown): string => {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [record.message, record.details, record.hint, record.code]
      .filter((value): value is string => typeof value === "string")
      .join(" ");
  }
  return String(error);
};

const isMissingSelectedGoalsTableError = (error: unknown): boolean =>
  /dog_selected_training_goals/i.test(getErrorText(error)) &&
  /schema cache|could not find the table|does not exist|PGRST205/i.test(getErrorText(error));

const isMissingChallengeGamesTableError = (error: unknown): boolean =>
  /challenge_games/i.test(getErrorText(error)) &&
  /schema cache|could not find the table|does not exist|PGRST205/i.test(getErrorText(error));

const sortChallengeGames = (games: ChallengeGame[], selectedCategories: OwnerTrainingGoal[]): ChallengeGame[] => {
  const categoryRank = new Map(selectedCategories.map((category, index) => [category, index]));

  return [...games].sort((a, b) => {
    const categoryA = categoryRank.get(a.category) ?? Number.MAX_SAFE_INTEGER;
    const categoryB = categoryRank.get(b.category) ?? Number.MAX_SAFE_INTEGER;
    if (categoryA !== categoryB) return categoryA - categoryB;
    return a.id.localeCompare(b.id);
  });
};

const getLocalChallengeGames = (selectedCategories: OwnerTrainingGoal[]): ChallengeGame[] => {
  const games = selectedCategories.length > 0
    ? CHALLENGE_GAME_CATALOG.filter((game) => selectedCategories.includes(game.category))
    : CHALLENGE_GAME_CATALOG;

  return sortChallengeGames(games, selectedCategories);
};

export const getGameCatalog = async (): Promise<GameDefinition[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("game_catalog").select("*").eq("is_active", true).order("silver_entry_cost");
  throwIfError(error);
  return (data ?? []).map(mapGameDefinition);
};

export const getChallengeGamesForDog = async (dogId: string): Promise<ChallengeGame[]> => {
  const client = getClientOrThrow();

  const { data: goalRows, error: goalsError } = await client
    .from("dog_selected_training_goals")
    .select("goal, priority_rank")
    .eq("dog_id", dogId)
    .order("priority_rank", { ascending: true });

  if (goalsError && !isMissingSelectedGoalsTableError(goalsError)) {
    throwIfError(goalsError);
  }

  const selectedCategories = isMissingSelectedGoalsTableError(goalsError)
    ? []
    : ((goalRows ?? []) as { goal: string; priority_rank: number }[])
      .map((row) => row.goal as OwnerTrainingGoal);

  let query = client
    .from("challenge_games")
    .select("*")
    .eq("is_active", true);

  if (selectedCategories.length > 0) {
    query = query.in("category", selectedCategories);
  }

  const { data, error } = await query;
  if (isMissingChallengeGamesTableError(error)) {
    console.warn("Skipping challenge games because the challenge_games table is missing.", error);
    return getLocalChallengeGames(selectedCategories);
  }
  throwIfError(error);

  const remoteGames = ((data ?? []) as ChallengeGameRow[]).map(mapChallengeGame);

  return remoteGames.length > 0
    ? sortChallengeGames(remoteGames, selectedCategories)
    : getLocalChallengeGames(selectedCategories);
};

export const getGameInstances = async (): Promise<GameInstance[]> => {
  const client = getClientOrThrow();
  const now = new Date().toISOString();
  const { data, error } = await client.from("game_instances").select("*").eq("is_active", true).lte("starts_at", now).gte("ends_at", now).order("starts_at");
  throwIfError(error);
  return (data ?? []).map(mapGameInstance);
};

export const getGameEntries = async (dogId: string): Promise<GameEntry[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("game_entries").select("*").eq("dog_id", dogId).order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapGameEntry);
};

type EnterGameJson = {
  entry: GameEntryRow;
  wallet: WalletSummary;
};

export const enterGame = async (dogId: string, gameInstanceId: string): Promise<{ entry: GameEntry; wallet: WalletSummary }> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("enter_game", {
    target_dog_id: dogId,
    target_game_instance_id: gameInstanceId,
    request_key: createIdempotencyKey("game"),
  });
  throwIfError(error);
  const result = data as Json as EnterGameJson;
  return { entry: mapGameEntry(result.entry), wallet: result.wallet };
};

type ChallengeAttemptJson = {
  attempt: ChallengeGameAttemptRow;
  wallet: WalletSummary;
};

export const startChallengeGameAttempt = async (dogId: string, challengeGameId: string): Promise<ChallengeAttemptJson> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("start_challenge_game_attempt", {
    target_dog_id: dogId,
    target_challenge_game_id: challengeGameId,
    request_key: createIdempotencyKey("challenge"),
  });
  throwIfError(error);
  return data as Json as ChallengeAttemptJson;
};

export const getPrerequisiteMasteryStatus = async (
  dogId: string,
  requiredActivityIds: string[],
): Promise<Set<string>> => {
  if (requiredActivityIds.length === 0) return new Set();
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_training_reward_log")
    .select("activity_id")
    .eq("dog_id", dogId)
    .in("activity_id", requiredActivityIds)
    .eq("source", "activity_pass");
  throwIfError(error);
  return new Set((data ?? []).map((r: { activity_id: string }) => r.activity_id));
};

export type ChallengeGameVerdict = {
  verdict: "PASS" | "FAIL" | "NEEDS_REVIEW";
  goldEarned: number;
  bonusXp: number;
  confidence: number;
  observations: string[];
  retryInstruction: string | null;
};

type SubmitProgressCallbacks = {
  onUploaded?: () => void;
  onCharged?: () => void;
};

export const submitChallengeGameVideo = async (
  dogId: string,
  challengeGameId: string,
  uri: string,
  callbacks?: SubmitProgressCallbacks,
): Promise<ChallengeGameVerdict> => {
  const client = getClientOrThrow();
  const { data: userData, error: userError } = await client.auth.getUser();
  throwIfError(userError);
  const userId = userData.user?.id;
  if (!userId) throw new Error("Authentication required.");

  // 1. Read video bytes FIRST — no silver charged yet
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  // 2. Create submission row
  const { data: submission, error: submissionError } = await client
    .from("dog_training_video_submissions")
    .insert({
      dog_id: dogId,
      user_id: userId,
      activity_id: challengeGameId,
      status: "pending",
      submission_hash: createIdempotencyKey("challenge-submission"),
    })
    .select("id")
    .single();
  throwIfError(submissionError);
  const submissionId = (submission as { id: string }).id;

  // 3. Upload video to storage — if this fails, no silver is charged
  const extension = uri.toLowerCase().endsWith(".mov") ? "mov" : "mp4";
  const storagePath = `${userId}/${dogId}/${challengeGameId}/${submissionId}/challenge.${extension}`;
  const uploadResult = await client.storage
    .from("dog-activity-videos")
    .upload(storagePath, arrayBuffer, {
      contentType: extension === "mov" ? "video/quicktime" : "video/mp4",
      upsert: false,
    });
  throwIfError(uploadResult.error);

  await client
    .from("dog_training_video_submissions")
    .update({ storage_path: storagePath, status: "processing" })
    .eq("id", submissionId);

  callbacks?.onUploaded?.();

  // 4. Video is confirmed uploaded — NOW debit silver and record the attempt
  const attemptResult = await startChallengeGameAttempt(dogId, challengeGameId);
  callbacks?.onCharged?.();
  const attempt = attemptResult.attempt as ChallengeGameAttemptRow & {
    id: string;
    gold_coin_pass_reward: number;
    bonus_xp: number;
  };

  // 5. Run AI verification — edge function settles the attempt and issues rewards on PASS
  const { data: verifyData, error: verifyError } = await client.functions.invoke("verify-training-video", {
    body: {
      submission_id: submissionId,
      dog_id: dogId,
      activity_id: challengeGameId,
      challenge_attempt_id: attempt.id,
    },
  });
  throwIfError(verifyError);

  const result = verifyData as {
    verdict: "PASS" | "FAIL" | "NEEDS_REVIEW";
    confidence: number;
    observations?: string[];
    retryInstruction?: string | null;
  };

  return {
    verdict: result.verdict,
    goldEarned: result.verdict === "PASS" ? (attempt.gold_coin_pass_reward ?? 0) : 0,
    bonusXp: result.verdict === "PASS" ? (attempt.bonus_xp ?? 0) : 0,
    confidence: result.confidence ?? 0,
    observations: result.observations ?? [],
    retryInstruction: result.retryInstruction ?? null,
  };
};
