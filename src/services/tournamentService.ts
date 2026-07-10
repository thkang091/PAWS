import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getMockLeaderboard,
  getMockTournamentById,
  getMockTournaments,
} from "@/data/tournaments/mockTournaments";
import { getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type {
  TournamentCurrency,
  TournamentEntry,
  TournamentEntryStatus,
  TournamentEvent,
  TournamentLeaderboardRow,
  TournamentStatus,
} from "@/types/tournament";

// Tournament Service - Phase 2A (read-only backend)
//
// SAFETY - Mobile must NEVER:
//   - Award gold or any prize payout.
//   - Settle tournament results or finalize placements.
//   - Directly mutate wallet balances or XP.
//   - Finalize rank or score.
// Prize payout is backend/admin/service-role only.

const TOURNAMENT_BACKEND_READ_ENABLED = true;
const TOURNAMENT_BACKEND_WRITE_ENABLED = false;

const VISIBLE_TOURNAMENT_STATUSES: TournamentStatus[] = [
  "registration_open",
  "registration_closed",
  "active",
  "reviewing",
  "settled",
];

const MOCK_ENTRY_STORAGE_PREFIX = "@paws/mock_tournament_entry";
const mockEntryStorageKey = (tournamentId: string, dogId: string) =>
  `${MOCK_ENTRY_STORAGE_PREFIX}/${tournamentId}/${dogId}`;

type TournamentEventRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  challenge_game_id: string | null;
  registration_opens_at: string;
  registration_closes_at: string;
  starts_at: string;
  ends_at: string;
  entry_currency: string;
  entry_cost: number;
  max_participants: number;
  participant_count: number;
  max_attempts_per_entry: number;
  prize_first: string;
  prize_second: string;
  prize_third: string;
  created_at: string;
};

type TournamentEntryRow = {
  id: string;
  tournament_id: string;
  dog_id: string;
  owner_id: string;
  status: string;
  joined_at: string;
  attempts_used: number;
  best_score: number | string | null;
  current_rank: number | null;
};

type TournamentLeaderboardRowData = Pick<
  TournamentEntryRow,
  | "id"
  | "dog_id"
  | "owner_id"
  | "joined_at"
  | "best_score"
  | "current_rank"
>;

const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return String(error);
};

const devFallback = <T>(
  operation: string,
  error: unknown,
  fallback: () => T,
): T => {
  if (__DEV__) {
    console.warn(
      `[Tournament] ${operation} failed; using development mock fallback: ${readErrorMessage(error)}`,
    );
    return fallback();
  }

  throwIfError(error);
  throw new Error(`Tournament ${operation} failed.`);
};

const readMockEntry = async (
  tournamentId: string,
  dogId: string,
): Promise<TournamentEntry | null> => {
  try {
    const stored = await AsyncStorage.getItem(
      mockEntryStorageKey(tournamentId, dogId),
    );
    return stored ? (JSON.parse(stored) as TournamentEntry) : null;
  } catch (error) {
    console.warn("[Tournament] Could not read the local mock entry.", error);
    return null;
  }
};

const mapTournamentCurrency = (currency: string): TournamentCurrency =>
  currency === "gold_coin" || currency === "gold" ? "gold" : "silver";

const mapTournamentEvent = (row: TournamentEventRow): TournamentEvent => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status as TournamentStatus,
  challengeGameId: row.challenge_game_id ?? "",
  registrationOpensAt: row.registration_opens_at,
  registrationClosesAt: row.registration_closes_at,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  entryCurrency: mapTournamentCurrency(row.entry_currency),
  entryCost: row.entry_cost,
  maxParticipants: row.max_participants,
  participantCount: row.participant_count,
  maxAttemptsPerEntry: row.max_attempts_per_entry,
  prizeFirst: row.prize_first,
  prizeSecond: row.prize_second,
  prizeThird: row.prize_third,
  createdAt: row.created_at,
});

const mapTournamentEntry = (row: TournamentEntryRow): TournamentEntry => ({
  id: row.id,
  tournamentId: row.tournament_id,
  dogId: row.dog_id,
  userId: row.owner_id,
  status: row.status as TournamentEntryStatus,
  joinedAt: row.joined_at,
  attemptsUsed: row.attempts_used,
  bestScore: row.best_score === null ? null : Number(row.best_score),
  currentRank: row.current_rank,
});

const mapTournamentLeaderboardRow = (
  row: TournamentLeaderboardRowData,
  currentUserId: string | null,
): TournamentLeaderboardRow => ({
  rank: row.current_rank ?? 0,
  entryId: row.id,
  dogId: row.dog_id,
  // Other users' dogs remain private under the existing dogs RLS policy.
  dogName:
    row.owner_id === currentUserId
      ? "Your dog"
      : `Competitor ${row.current_rank ?? "-"}`,
  avatarUrl: null,
  score: Number(row.best_score ?? 0),
  // tournament_entries has no public attempt timestamp in the current schema.
  submittedAt: row.joined_at,
  isCurrentUser: row.owner_id === currentUserId,
});

/** Read visible tournament_events rows. */
export const listVisibleTournamentEvents = async (): Promise<
  TournamentEvent[]
> => {
  if (!TOURNAMENT_BACKEND_READ_ENABLED) return getMockTournaments();

  try {
    const client = getClientOrThrow();
    const { data, error } = await client
      .from("tournament_events")
      .select(
        "id,title,description,status,challenge_game_id,registration_opens_at,registration_closes_at,starts_at,ends_at,entry_currency,entry_cost,max_participants,participant_count,max_attempts_per_entry,prize_first,prize_second,prize_third,created_at",
      )
      .in("status", VISIBLE_TOURNAMENT_STATUSES)
      .order("created_at", { ascending: false });

    if (error) {
      return devFallback("visible event read", error, getMockTournaments);
    }
    return ((data ?? []) as TournamentEventRow[]).map(mapTournamentEvent);
  } catch (error) {
    return devFallback("visible event read", error, getMockTournaments);
  }
};

/** Read one visible tournament_events row. */
export const getTournamentEvent = async (
  tournamentId: string,
): Promise<TournamentEvent | null> => {
  if (!TOURNAMENT_BACKEND_READ_ENABLED) {
    return getMockTournamentById(tournamentId) ?? null;
  }

  try {
    const client = getClientOrThrow();
    const { data, error } = await client
      .from("tournament_events")
      .select(
        "id,title,description,status,challenge_game_id,registration_opens_at,registration_closes_at,starts_at,ends_at,entry_currency,entry_cost,max_participants,participant_count,max_attempts_per_entry,prize_first,prize_second,prize_third,created_at",
      )
      .eq("id", tournamentId)
      .maybeSingle();

    if (error) {
      return devFallback(
        "event detail read",
        error,
        () => getMockTournamentById(tournamentId) ?? null,
      );
    }
    return data ? mapTournamentEvent(data as TournamentEventRow) : null;
  } catch (error) {
    return devFallback(
      "event detail read",
      error,
      () => getMockTournamentById(tournamentId) ?? null,
    );
  }
};

/** Read the signed-in owner's tournament_entries row for one dog. */
export const getMyTournamentEntry = async (
  tournamentId: string,
  dogId: string,
): Promise<TournamentEntry | null> => {
  if (!TOURNAMENT_BACKEND_READ_ENABLED) {
    return __DEV__ ? readMockEntry(tournamentId, dogId) : null;
  }

  try {
    const client = getClientOrThrow();
    const { data, error } = await client
      .from("tournament_entries")
      .select(
        "id,tournament_id,dog_id,owner_id,status,joined_at,attempts_used,best_score,current_rank",
      )
      .eq("tournament_id", tournamentId)
      .eq("dog_id", dogId)
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        console.warn(
          `[Tournament] entry read failed; checking local mock fallback: ${readErrorMessage(error)}`,
        );
        return readMockEntry(tournamentId, dogId);
      }
      throwIfError(error);
      throw new Error("Tournament entry read failed.");
    }
    return data ? mapTournamentEntry(data as TournamentEntryRow) : null;
  } catch (error) {
    if (__DEV__) {
      console.warn(
        `[Tournament] entry read failed; checking local mock fallback: ${readErrorMessage(error)}`,
      );
      return readMockEntry(tournamentId, dogId);
    }
    throw error;
  }
};

/**
 * Write-disabled in Phase 2A. This never calls join_tournament and never
 * mutates AsyncStorage, tournament_entries, participant counts, or wallets.
 */
export const joinTournament = async (
  _tournamentId: string,
  _dogId: string,
): Promise<{ entry: TournamentEntry } | { error: string }> => {
  if (!TOURNAMENT_BACKEND_WRITE_ENABLED) {
    return {
      error:
        "Tournament joining is not configured in read-only backend mode. No entry fee was charged.",
    };
  }

  // TODO (Phase 2B): Call join_tournament only through its secure RPC with
  // an idempotency key. Mobile must never deduct wallet funds directly.
  return { error: "Tournament joining is not configured." };
};

/** Read ranked tournament_entries rows allowed by leaderboard RLS. */
export const listTournamentLeaderboard = async (
  tournamentId: string,
): Promise<TournamentLeaderboardRow[]> => {
  if (!TOURNAMENT_BACKEND_READ_ENABLED) {
    return getMockLeaderboard(tournamentId);
  }

  try {
    const client = getClientOrThrow();
    const [{ data, error }, authResult] = await Promise.all([
      client
        .from("tournament_entries")
        .select("id,dog_id,owner_id,joined_at,best_score,current_rank")
        .eq("tournament_id", tournamentId)
        .not("current_rank", "is", null)
        .not("best_score", "is", null)
        .order("current_rank", { ascending: true }),
      client.auth.getUser(),
    ]);

    if (error) {
      return devFallback(
        "leaderboard read",
        error,
        () => getMockLeaderboard(tournamentId),
      );
    }

    if (authResult.error) {
      console.warn(
        `[Tournament] Could not identify the current leaderboard user: ${authResult.error.message}`,
      );
    }
    const currentUserId = authResult.data.user?.id ?? null;
    return ((data ?? []) as TournamentLeaderboardRowData[]).map((row) =>
      mapTournamentLeaderboardRow(row, currentUserId),
    );
  } catch (error) {
    return devFallback(
      "leaderboard read",
      error,
      () => getMockLeaderboard(tournamentId),
    );
  }
};
