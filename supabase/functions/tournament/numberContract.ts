import type { CourseView, MatchStatus, NumberCourse, OwnProgress, ProgressPhase, PublicProgress } from "./numberMatch.ts";
import type { Difficulty } from "./digits.ts";

/**
 * Number Trail API contract (Phase N2), shared by the `tournament` edge function, the phone (src/services/
 * numberRaceService.ts) and the tests. Host actions and reads are database functions called directly; anything that
 * plans a course or judges GPS goes through the edge function.
 *
 *   createNumberRace     rpc create_room('number_trail', ...) then number_create_match       host
 *   joinNumberRace       rpc join_room (QR token or code), set_room_ready                    player
 *   setNumberSettings    rpc number_set_settings                                              host
 *   prepareNumberRace    POST tournament { action: "number_prepare", matchId, latitude, longitude }   host
 *   startNumberRace      rpc number_start                                                     host
 *   startNumberWalk      POST tournament { action: "number_walk", matchId }                  racer
 *   submitNumberProgress POST tournament { action: "number_progress", matchId, points }      racer
 *   submitNumberFinish   POST tournament { action: "number_finish", matchId, requestKey, points }   racer
 *   getNumberRaceState   POST tournament { action: "number_state", matchId, afterSeq }       member
 *   cancelNumberRace     rpc number_cancel                                                    host
 *
 * Every user id comes from the verified JWT; no request carries one as authority.
 */

export type NumberErrorCode =
  // Routes
  | "no_number_routes"
  | "no_network"
  | "no_public_start"
  | "no_routes_for_difficulty"
  | "preparation_timeout"
  | "preparation_in_progress"
  | "routing_unavailable"
  | "routing_busy"
  // Room and match
  | "room_not_found"
  | "room_closed"
  | "room_full"
  | "match_full"
  | "match_not_found"
  | "match_not_ready"
  | "match_not_editable"
  | "match_not_active"
  | "match_over"
  | "match_completed"
  | "match_cancelled"
  | "already_started"
  | "not_everyone_ready"
  | "not_enough_players"
  | "wrong_game"
  // Who
  | "unauthorized"
  | "not_the_host"
  | "not_in_match"
  | "not_in_room"
  // Walks and finishes
  | "invalid_session"
  | "session_closed"
  | "no_walk"
  | "already_finished"
  | "verification_pending"
  | "slow_down"
  | "too_many_attempts"
  | "bad_request"
  // Phases P1 to P3
  | "not_found"
  | "candidate_expired"
  | "bad_number"
  | "bad_category"
  | "match_exists"
  | "courses_not_matched"
  | "not_everyone_at_start"
  | "number_not_common"
  | "server_error";

/** Why a finish was not accepted. */
export type FinishRejection =
  | "not_at_start"
  | "digit_one_incomplete"
  | "connector_invalid"
  | "digit_two_incomplete"
  | "finish_incomplete"
  | "finish_invalid"
  | "gps_review"
  | "too_few_points"
  | "replayed_walk"
  | "verification_expired";

/** Rejections the player can fix by walking on (anything else needs a new race). */
export const RECOVERABLE_FINISH: readonly FinishRejection[] = ["not_at_start", "digit_one_incomplete", "digit_two_incomplete", "finish_incomplete", "too_few_points", "verification_expired"];

export const NUMBER_HTTP: Partial<Record<NumberErrorCode, number>> = {
  unauthorized: 401,
  not_the_host: 403,
  not_in_match: 403,
  not_in_room: 403,
  invalid_session: 403,
  room_not_found: 404,
  not_found: 404,
  match_not_found: 404,
  slow_down: 429,
  too_many_attempts: 429,
  routing_unavailable: 503,
  routing_busy: 503,
  preparation_timeout: 503,
  server_error: 500,
  bad_request: 400,
};
export const httpOf = (code: string) => NUMBER_HTTP[code as NumberErrorCode] ?? 409;

const CODES = new Set<string>([
  "no_number_routes", "no_network", "no_public_start", "no_routes_for_difficulty", "preparation_timeout", "preparation_in_progress",
  "routing_unavailable", "routing_busy", "room_not_found", "room_closed", "room_full", "match_full", "match_not_found", "match_not_ready",
  "match_not_editable", "match_not_active", "match_over", "match_completed", "match_cancelled", "already_started", "not_everyone_ready",
  "not_enough_players", "wrong_game", "unauthorized", "not_the_host", "not_in_match", "not_in_room", "invalid_session", "session_closed",
  "no_walk", "already_finished", "verification_pending", "slow_down", "too_many_attempts", "bad_request", "server_error",
  "not_found", "candidate_expired", "bad_number", "bad_category", "match_exists", "courses_not_matched", "not_everyone_at_start", "number_not_common",
]);
/** Database reasons that aren't API codes become server_error, never a raw message. */
export const toErrorCode = (reason: string): NumberErrorCode => (CODES.has(reason) ? (reason as NumberErrorCode) : "server_error");

// ---------- Requests ----------

export type PrepareRequest = { action: "number_prepare"; matchId: string; latitude: number; longitude: number; avoidStairs?: boolean };
export type WalkRequest = { action: "number_walk"; matchId: string };
export type WirePoint = { seq: number; segment: number; latitude: number; longitude: number; accuracyM: number | null; capturedAt: number };
export type ProgressRequest = { action: "number_progress"; matchId: string; points: WirePoint[] };
/** `requestKey`: made once per finish attempt on the phone and reused on every retry of it. */
export type FinishRequest = { action: "number_finish"; matchId: string; requestKey: string; points?: WirePoint[] };
export type StateRequest = { action: "number_state"; matchId: string; afterSeq?: number };

// ---------- Replies ----------

export type Failure = { ok: false; error: NumberErrorCode };

export type PrepareReply = { ok: true; number: string; course: CourseView; feasible: number; cached: boolean } | Failure;

export type WalkReply = { ok: true; sessionId: string; lastSeq: number; resumed: boolean; serverNow: string } | Failure;

export type ProgressReply =
  | { ok: true; storedThrough: number; dropped: number; verified: false; matchStatus: MatchStatus; nextCheckInMs: number }
  | { ok: true; storedThrough: number; dropped: number; verified: true; matchStatus: MatchStatus; phase: ProgressPhase; progress: OwnProgress }
  | Failure;

export type FinishReply =
  /** Verified and placed. `won` is the official result; it can't change. */
  | { ok: true; status: "finished"; finishOrder: number; placement: number; won: boolean; repeated: boolean }
  /** Verified, but an earlier receipt is still being checked: the place is decided when it reports back. */
  | { ok: true; status: "verified_waiting"; waitingOnEarlier: number }
  /** Received; the check is running elsewhere (a retry while the first request is still at it). Ask again shortly. */
  | { ok: true; status: "verifying" }
  | { ok: true; status: "rejected"; reason: FinishRejection; recoverable: boolean; progress?: OwnProgress }
  | Failure;

export type NumberEventKind =
  | "PLAYER_JOINED"
  | "PLAYER_LEFT"
  | "PLAYER_READY"
  | "SETTINGS_CHANGED"
  | "ROUTE_PREPARING"
  | "ROUTE_READY"
  | "ROUTE_FAILED"
  | "COUNTDOWN_STARTED"
  | "MATCH_STARTED"
  | "DIGIT_1_COMPLETED"
  | "DIGIT_2_COMPLETED"
  | "FINISH_VERIFYING"
  | "FINISH_REJECTED"
  | "PLAYER_FINISHED"
  | "MATCH_COMPLETED"
  | "RESULTS_FINAL"
  | "MATCH_CANCELLED";

export type NumberEvent = { seq: number; kind: NumberEventKind; userId: string | null; payload: Record<string, unknown>; at: string };

/** A broadcast on `room:<roomId>`, event "number". A hint to reload; the state below is the record. */
export type NumberBroadcast = { matchId: string; seq: number; kind: NumberEventKind; userId: string | null; payload: Record<string, unknown>; at: string };

export type RacePlayer = {
  userId: string;
  name: string;
  isHost: boolean;
  ready: boolean;
  inRoom: boolean;
  /** Null until the countdown (no assignment yet). */
  status: "racing" | "finished" | "left" | null;
  phase: ProgressPhase | null;
  digitsDone: number;
  progress: PublicProgress | Record<string, never> | null;
  placement: number | null;
  finished: boolean;
  isWinner: boolean;
  elapsedMs: number | null;
};

export type RaceResult = { userId: string; placement: number; finishOrder: number | null; finished: boolean; isWinner: boolean; elapsedMs: number | null; digitsDone: number; coverage: number };

/** number_race_state: the canonical match as this player may see it. */
export type RaceState = {
  serverNow: string;
  match: {
    id: string;
    roomId: string;
    mode: "nearby" | "online";
    status: MatchStatus;
    minutes: 15 | 25 | 40;
    difficulty: Difficulty | null;
    countdownS: number;
    /** Two characters, leading zero kept. Null until a number is drawn. */
    number: string | null;
    countdownAt: string | null;
    startsAt: string | null;
    endsAt: string | null;
    seq: number;
    preparing: boolean;
    prepareError: string | null;
    winnerUserId: string | null;
    outcome: "winner" | "no_finisher" | null;
    completedAt: string | null;
    /** Every finish settled and everyone placed. */
    finalized: boolean;
    result: { number: string; outcome: string; winnerUserId: string | null; photoFinish: boolean; finishers: number; players: number } | null;
    algorithm: string | null;
    raceVersion: string | null;
  };
  room: { id: string; name: string; code: string; hostId: string; maxPlayers: number; status: string };
  course: NumberCourse | null;
  summary: Record<string, unknown> | null;
  sources: { source?: string; license?: string; attribution?: string }[];
  players: RacePlayer[];
  me: {
    userId: string;
    isHost: boolean;
    assignment: { status: "racing" | "finished" | "left"; sessionId: string | null; courseDigest: string } | null;
    progress: (OwnProgress & { phase: ProgressPhase; version: number; verifiedAt: string | null }) | null;
    lastAttempt: { status: "pending" | "verified" | "rejected" | "expired"; reason: string | null; receiptSeq: number; receivedAt: string; finishOrder: number | null; requestKey: string } | null;
    result: Record<string, unknown> | null;
  };
  results: RaceResult[];
  events: NumberEvent[];
  lastSeq: number;
  /** Online races only: the shared settings and how each player's search went. Never anyone's route or position. */
  online: OnlineInfo | null;
};

export type OnlineCheck = { name: string; ok: boolean; spread: number; allowed: number; unit: "m" | "count" | "score" };
export type OnlineInfo = {
  ranked: boolean;
  requestedNumber: string | null;
  category: "short" | "standard" | "long";
  targetM: number;
  spreadShare: number;
  bandShare: number;
  equivalence: { status: string; target_m: number; spread_m: number; tolerance_m: number; checks: OnlineCheck[]; unknown: string[]; version: string } | null;
  players: { userId: string; search: { status: "searching" | "found" | "none" | "error"; reason: string | null; candidates: number } | null; officialM: number | null; atStart: boolean | null }[];
};

// ---------- Practice and online (phases P1 to P3) ----------

/** One course the server found and measured, as the phone may draw it. */
export type FoundCourse = {
  id: string;
  officialM: number;
  digitM: number[];
  connectorM: number;
  approachM: number;
  minutes: number;
  readability: (number | null)[];
  difficulty: Difficulty;
  course: CourseView;
};
export type FindReply = { ok: true; found: boolean; number: string; radiusM: number; reason?: string; candidates: FoundCourse[]; sources?: unknown[] } | Failure;
export type PracticeResult = {
  eligible: boolean;
  phase: ProgressPhase;
  reasons: string[];
  digits: { digit: string; coverage: number; complete: boolean }[];
  connector: { share: number; valid: boolean | null } | null;
  finish: { share: number; reached: boolean; valid: boolean | null } | null;
  missing: { digit: number; segment: string; share: number }[];
  walkedM: number;
  activeMs: number;
  gps: { jumps: number; gapM: number; ignored: number; points: number };
  atStart: boolean;
  version: string;
};

export type StateReply = ({ ok: true } & RaceState) | Failure;
