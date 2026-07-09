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
// Tournament Service — MVP
//
// Phase 1: TOURNAMENT_BACKEND_ENABLED = false
// The service returns mock/dev data and never
// queries Supabase. Set to true only after
// migration 0041 has been applied.
//
// Phase 2: Wire to Supabase tables + secure RPCs.
// See docs/tournament-system-design.md.
// ─────────────────────────────────────────────

const TOURNAMENT_BACKEND_ENABLED = false;

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
  if (!TOURNAMENT_BACKEND_ENABLED) {
    return getMockTournaments();
  }

  const client = getClientOrThrow();

  // TODO: Replace with:
  //   client.from("tournament_events")
  //     .select("*")
  //     .in("status", ["registration_open", "active", "settled"])
  //     .order("created_at", { ascending: false });
  const { data, error } = await client
    .from("tournament_events")
    .select("*")
    .in("status", ["registration_open", "active", "settled"])
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
  if (!TOURNAMENT_BACKEND_ENABLED) {
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
 * Returns null when the backend is not enabled (no mock entries by default).
 */
export const getMyTournamentEntry = async (
  tournamentId: string,
  dogId: string,
): Promise<TournamentEntry | null> => {
  if (!TOURNAMENT_BACKEND_ENABLED) {
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
    // No mock entries by default — return null
    return null;
  }

  throwIfError(error);
  return data as TournamentEntry | null;
};

/**
 * Join a tournament.
 *
 * This is intentionally NOT wired to a mock.
 * Joining must deduct an entry fee through a secure RPC
 * with idempotency. The backend tables must exist first.
 *
 * @returns The created entry if successful, or an error object
 *          with a message explaining why the backend is not ready.
 */
export const joinTournament = async (
  _tournamentId: string,
  _dogId: string,
): Promise<{ entry: TournamentEntry } | { error: string }> => {
  // TODO: Call a secure RPC once tournament_entries table exists:
  //   const { data, error } = await client.rpc("join_tournament", {
  //     target_tournament_id: tournamentId,
  //     target_dog_id: dogId,
  //     request_key: createIdempotencyKey("tournament"),
  //   });
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
  if (!TOURNAMENT_BACKEND_ENABLED) {
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