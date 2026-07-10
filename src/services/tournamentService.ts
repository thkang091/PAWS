import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getClientOrThrow,
  throwIfError,
} from "@/services/serviceUtils";
import {
  getMockTournamentById,
  getMockLeaderboard,
  getMockTournaments,
} from "@/data/tournaments/mockTournaments";
import type {
  TournamentEntry,
  TournamentEvent,
  TournamentLeaderboardRow,
} from "@/types/tournament";

// ─────────────────────────────────────────────
// Tournament Service — Phase 1 (MVP / Mock)
//
// SAFETY — Mobile must NEVER:
//   - Award gold or any prize payout.
//   - Settle tournament results or finalize placements.
//   - Directly mutate wallet balances or XP.
//   - Finalize rank or score.
//   Prize payout is backend/admin/service-role only.
//
// Design:
//   TOURNAMENT_BACKEND_READ_ENABLED  — Supabase queries for events, entries, leaderboard
//   TOURNAMENT_BACKEND_WRITE_ENABLED — Secure RPC for join, attempt submission
//
// Phase 1: Both flags = false. Returns mock/dev data.
//   Mock join is persisted via AsyncStorage so the UI shows
//   a realistic "You're entered!" state.
//
// Phase 2: Set flags = true after migration 0043 is applied.
//   See docs/tournament-system-design.md.
// ─────────────────────────────────────────────

const TOURNAMENT_BACKEND_READ_ENABLED = false;
const TOURNAMENT_BACKEND_WRITE_ENABLED = false;

/** AsyncStorage key prefix for mock tournament entries. */
const MOCK_ENTRY_STORAGE_PREFIX = "@paws/mock_tournament_entry";

const mockEntryStorageKey = (tournamentId: string, dogId: string) =>
  `${MOCK_ENTRY_STORAGE_PREFIX}/${tournamentId}/${dogId}`;

const isMissingTournamentTable = (error: unknown): boolean =>
  /tournament_events|tournament_entries/i.test(
    error instanceof Error ? error.message : String(error),
  ) &&
  /schema cache|could not find the table|does not exist|PGRST205/i.test(
    error instanceof Error ? error.message : String(error),
  );

/**
 * List tournament events visible to the current user.
 * Returns mock data when the backend is not enabled.
 */
export const listVisibleTournamentEvents = async (): Promise<
  TournamentEvent[]
> => {
  if (!TOURNAMENT_BACKEND_READ_ENABLED) {
    return getMockTournaments();
  }

  const client = getClientOrThrow();

  // TODO: Replace with:
  //   client.from("tournament_events")
  //     .select("*")
  //     .in("status", ["registration_open", "active", "reviewing", "settled"])
  //     .order("created_at", { ascending: false });
  const { data, error } = await client
    .from("tournament_events")
    .select("*")
    .in("status", ["registration_open", "active", "reviewing", "settled"])
    .order("created_at", { ascending: false });

  if (isMissingTournamentTable(error)) {
    console.warn(
      "tournament_events table not found — using mock data.",
      error,
    );
    return getMockTournaments();
  }

  throwIfError(error);
  return (data ?? []) as TournamentEvent[];
};

/**
 * Get a single tournament event by ID.
 * Returns mock data when the backend is not enabled.
 */
export const getTournamentEvent = async (
  tournamentId: string,
): Promise<TournamentEvent | null> => {
  if (!TOURNAMENT_BACKEND_READ_ENABLED) {
    return getMockTournamentById(tournamentId) ?? null;
  }

  const client = getClientOrThrow();

  // TODO: Replace with:
  //   client.from("tournament_events")
  //     .select("*")
  //     .eq("id", tournamentId)
  //     .single();
  const { data, error } = await client
    .from("tournament_events")
    .select("*")
    .eq("id", tournamentId)
    .single();

  if (isMissingTournamentTable(error)) {
    return getMockTournamentById(tournamentId) ?? null;
  }

  throwIfError(error);
  return data as TournamentEvent | null;
};

/**
 * Get the current user's entry in a tournament, if any.
 *
 * When the backend is not enabled, returns a mock entry from
 * AsyncStorage (written by joinTournament in mock mode).
 */
export const getMyTournamentEntry = async (
  tournamentId: string,
  dogId: string,
): Promise<TournamentEntry | null> => {
  if (!TOURNAMENT_BACKEND_READ_ENABLED) {
    // Check for a mock entry persisted by joinTournament
    try {
      const stored = await AsyncStorage.getItem(
        mockEntryStorageKey(tournamentId, dogId),
      );
      if (stored) {
        return JSON.parse(stored) as TournamentEntry;
      }
    } catch {
      // Fall through — return null
    }
    return null;
  }

  const client = getClientOrThrow();

  // TODO: Replace with:
  //   client.from("tournament_entries")
  //     .select("*")
  //     .eq("tournament_id", tournamentId)
  //     .eq("dog_id", dogId)
  //     .single();
  const { data, error } = await client
    .from("tournament_entries")
    .select("*")
    .eq("tournament_id", tournamentId)
    .eq("dog_id", dogId)
    .single();

  if (isMissingTournamentTable(error)) {
    return null;
  }

  throwIfError(error);
  return data as TournamentEntry | null;
};

/**
 * Join a tournament.
 *
 * Phase 1 (mock): Writes a mock entry to AsyncStorage and returns it.
 *   No wallet mutation, no RPC call.
 *
 * Phase 2: Calls the secure join_tournament RPC with idempotency key.
 *
 * @returns The created entry if successful, or an error object.
 *
 * TODO (Phase 2): Wire to secure RPC join_tournament once migration 0043
 *   (tournament_events + tournament_entries tables) has been applied.
 *   The RPC must:
 *   - Verify auth, dog ownership, registration_open status
 *   - Deduct entry fee through wallet_transactions (idempotent)
 *   - Increment participant_count
 *   - Return entry + updated wallet summary
 */
export const joinTournament = async (
  tournamentId: string,
  dogId: string,
): Promise<{ entry: TournamentEntry } | { error: string }> => {
  if (!TOURNAMENT_BACKEND_WRITE_ENABLED) {
    // ── Mock/dev join: persist to AsyncStorage ──
    const mockEntry: TournamentEntry = {
      id: `mock-entry-${tournamentId}-${dogId}`,
      tournamentId,
      dogId,
      userId: "mock-user-id",
      status: "joined",
      joinedAt: new Date().toISOString(),
      attemptsUsed: 0,
      bestScore: null,
      currentRank: null,
    };

    try {
      await AsyncStorage.setItem(
        mockEntryStorageKey(tournamentId, dogId),
        JSON.stringify(mockEntry),
      );
    } catch {
      // Storage write failed — still return the mock entry so the UI works
    }

    return { entry: mockEntry };
  }

  // TODO: Call secure RPC once migration 0043 is applied:
  //   const client = getClientOrThrow();
  //   const { data, error } = await client.rpc("join_tournament", {
  //     target_tournament_id: tournamentId,
  //     target_dog_id: dogId,
  //     request_key: createIdempotencyKey("tournament"),
  //   });
  //   if (error) return { error: error.message };
  //   return { entry: data as TournamentEntry };
  return {
    error:
      "Tournament join is not available yet. The tournament backend must be deployed first.",
  };
};

/**
 * List the leaderboard for a tournament.
 * Returns mock data when the backend is not enabled.
 */
export const listTournamentLeaderboard = async (
  tournamentId: string,
): Promise<TournamentLeaderboardRow[]> => {
  if (!TOURNAMENT_BACKEND_READ_ENABLED) {
    return getMockLeaderboard(tournamentId);
  }

  const client = getClientOrThrow();

  // TODO: Replace with a query across tournament_entries + profiles:
  //   client.from("tournament_entries")
  //     .select("id, dog_id, best_score, ...")
  //     .eq("tournament_id", tournamentId)
  //     .order("best_score", { ascending: false });
  const { data, error } = await client
    .from("tournament_entries")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("best_score", { ascending: false, nullsFirst: false });

  if (isMissingTournamentTable(error)) {
    return getMockLeaderboard(tournamentId);
  }

  throwIfError(error);
  // TODO: map rows to TournamentLeaderboardRow
  return (data ?? []) as unknown as TournamentLeaderboardRow[];
};