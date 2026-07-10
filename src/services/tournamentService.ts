import {
  createIdempotencyKey,
  getClientOrThrow,
  throwIfError,
} from "@/services/serviceUtils";
import type { WalletSummary } from "@/types/domain";
import type {
  TournamentCurrency,
  TournamentEntry,
  TournamentEntryStatus,
  TournamentEvent,
  TournamentLeaderboardRow,
  TournamentStatus,
} from "@/types/tournament";

// Tournament Service - Phase 2B (secure join RPC)
//
// SAFETY - Mobile must NEVER:
//   - Award gold or any prize payout.
//   - Settle tournament results or finalize placements.
//   - Directly mutate wallet balances or XP.
//   - Finalize rank or score.
// Prize payout is backend/admin/service-role only.

const VISIBLE_TOURNAMENT_STATUSES: TournamentStatus[] = [
  "registration_open",
  "registration_closed",
  "active",
  "reviewing",
  "settled",
];

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

type TournamentLeaderboardRpcRow = {
  rank: number;
  entry_id: string;
  dog_id: string;
  dog_name: string;
  score: number | string;
  submitted_at: string;
  is_current_user: boolean;
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
  row: TournamentLeaderboardRpcRow,
): TournamentLeaderboardRow => ({
  rank: row.rank,
  entryId: row.entry_id,
  dogId: row.dog_id,
  dogName: row.dog_name,
  avatarUrl: null,
  score: Number(row.score),
  submittedAt: row.submitted_at,
  isCurrentUser: row.is_current_user,
});

/** Read visible tournament_events rows. */
export const listVisibleTournamentEvents = async (): Promise<
  TournamentEvent[]
> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("tournament_events")
    .select(
      "id,title,description,status,challenge_game_id,registration_opens_at,registration_closes_at,starts_at,ends_at,entry_currency,entry_cost,max_participants,participant_count,max_attempts_per_entry,prize_first,prize_second,prize_third,created_at",
    )
    .in("status", VISIBLE_TOURNAMENT_STATUSES)
    .order("created_at", { ascending: false });

  throwIfError(error);
  return ((data ?? []) as TournamentEventRow[]).map(mapTournamentEvent);
};

/** Read one visible tournament_events row. */
export const getTournamentEvent = async (
  tournamentId: string,
): Promise<TournamentEvent | null> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("tournament_events")
    .select(
      "id,title,description,status,challenge_game_id,registration_opens_at,registration_closes_at,starts_at,ends_at,entry_currency,entry_cost,max_participants,participant_count,max_attempts_per_entry,prize_first,prize_second,prize_third,created_at",
    )
    .eq("id", tournamentId)
    .maybeSingle();

  throwIfError(error);
  return data ? mapTournamentEvent(data as TournamentEventRow) : null;
};

/** Read the signed-in owner's tournament_entries row for one dog. */
export const getMyTournamentEntry = async (
  tournamentId: string,
  dogId: string,
): Promise<TournamentEntry | null> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("tournament_entries")
    .select(
      "id,tournament_id,dog_id,owner_id,status,joined_at,attempts_used,best_score,current_rank",
    )
    .eq("tournament_id", tournamentId)
    .eq("dog_id", dogId)
    .maybeSingle();

  throwIfError(error);
  return data ? mapTournamentEntry(data as TournamentEntryRow) : null;
};

/**
 * Join through the atomic join_tournament RPC. The client never writes a
 * tournament entry, participant count, or wallet transaction directly.
 */
export const joinTournament = async (
  tournamentId: string,
  dogId: string,
): Promise<{ entry: TournamentEntry; wallet: WalletSummary } | { error: string }> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("join_tournament", {
    target_tournament_id: tournamentId,
    target_dog_id: dogId,
    request_key: createIdempotencyKey("tournament-entry"),
  });

  if (error) return { error: error.message };

  const result = data as unknown as {
    entry: TournamentEntryRow;
    wallet: WalletSummary;
  };

  return {
    entry: mapTournamentEntry(result.entry),
    wallet: result.wallet,
  };
};

/** Read the field-limited leaderboard projection from its authenticated RPC. */
export const listTournamentLeaderboard = async (
  tournamentId: string,
): Promise<TournamentLeaderboardRow[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("list_tournament_leaderboard", {
    target_tournament_id: tournamentId,
  });

  throwIfError(error);
  return ((data ?? []) as TournamentLeaderboardRpcRow[]).map(
    mapTournamentLeaderboardRow,
  );
};
