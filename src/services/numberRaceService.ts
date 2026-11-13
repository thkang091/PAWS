import type { NumberAvailability as Availability } from "../../supabase/functions/tournament/numberDiscovery";
import type { CourseView } from "../../supabase/functions/tournament/numberMatch";
import { joinRoomChannel } from "@/services/roomChannel";
import { getClientOrThrow } from "@/services/serviceUtils";
import type { TrackPoint } from "../../supabase/functions/tournament/geo";
import type {
  FindReply,
  FinishReply,
  FoundCourse,
  NumberBroadcast,
  OnlineInfo,
  PracticeResult,
  NumberErrorCode,
  PrepareReply,
  ProgressReply,
  RaceState,
  WalkReply,
  WirePoint,
} from "../../supabase/functions/tournament/numberContract";
import type { Difficulty } from "../../supabase/functions/tournament/digits";

export type { FinishReply, FoundCourse, NumberBroadcast, NumberErrorCode, OnlineInfo, PracticeResult, PrepareReply, ProgressReply, RaceState, WalkReply };

/**
 * Number Trail (Phase N2): the typed calls Phase N3's screens use. Lobby and host actions are database functions;
 * planning and GPS checks go through the `tournament` edge function. The phone never sends a user id, a number, a
 * time or a result: the server takes identity from the session and decides everything official.
 *
 * Not reachable from navigation yet. Number Trail stays off until Phase N3 ships its screens.
 */

export class NumberRaceError extends Error {
  constructor(readonly code: NumberErrorCode | "not_deployed" | "network" | "timeout") {
    super(code);
  }
}

const reason = (message: string) => (/schema cache|could not find/i.test(message) ? "not_deployed" : (message.match(/[a-z]+(?:_[a-z]+)+/)?.[0] ?? "server_error"));

const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc(name as never, args as never);
  if (error) throw new NumberRaceError(reason(error.message) as NumberErrorCode);
  return data as unknown as T;
};

/** Edge function call; `ok: false` replies become NumberRaceError with the server's code. */
/**
 * Development only: send edge-function calls to a local server running the same service code against a local
 * database (scripts/number-trail-dev-server.ts). Never set in production builds.
 */
const DEV_URL = __DEV__ ? process.env.EXPO_PUBLIC_NUMBER_TRAIL_DEV_URL : undefined;

const callDev = async <T extends { ok: boolean }>(body: Record<string, unknown>, timeout: number): Promise<Extract<T, { ok: true }>> => {
  const client = getClientOrThrow();
  const { data } = await client.auth.getSession();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  try {
    const res = await fetch(DEV_URL!, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify(body), signal: abort.signal });
    const payload = (await res.json().catch(() => null)) as T | { ok: false; error?: string } | null;
    if (!payload?.ok) throw new NumberRaceError(((payload as { error?: string } | null)?.error ?? "server_error") as NumberErrorCode);
    return payload as Extract<T, { ok: true }>;
  } catch (e) {
    if (e instanceof NumberRaceError) throw e;
    throw new NumberRaceError(abort.signal.aborted ? "timeout" : "network");
  } finally {
    clearTimeout(timer);
  }
};

const call = async <T extends { ok: boolean }>(body: Record<string, unknown>, timeout = 20_000): Promise<Extract<T, { ok: true }>> => {
  if (DEV_URL) return callDev<T>(body, timeout);
  const client = getClientOrThrow();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  const { data, error } = await client.functions.invoke("tournament", { body, signal: abort.signal }).finally(() => clearTimeout(timer));
  if (error) {
    const context = (error as { context?: Response }).context;
    if (!context) throw new NumberRaceError(abort.signal.aborted ? "timeout" : "network");
    const payload = typeof context.json === "function" ? await context.json().catch(() => null) : null;
    // An older tournament function that predates Number Trail answers unknown_action: not set up yet.
    const code = payload?.error === "unknown_action" ? "not_deployed" : payload?.error;
    throw new NumberRaceError(((code as NumberErrorCode) ?? (context.status === 404 ? "not_deployed" : "server_error")) as NumberErrorCode);
  }
  if (!data?.ok) throw new NumberRaceError(((data?.error as NumberErrorCode) ?? "server_error") as NumberErrorCode);
  return data as Extract<T, { ok: true }>;
};

const wire = (points: readonly TrackPoint[]): WirePoint[] =>
  points.map((p) => ({ seq: p.seq, segment: p.segment, latitude: p.latitude, longitude: p.longitude, accuracyM: p.accuracyM, capturedAt: p.capturedAt }));

// ---------- Lobby (host and players) ----------

export type NumberSettings = { minutes: 15 | 25 | 40; difficulty: Difficulty | null; countdownS: number };

/** A Number Trail room (2 to 10 players) and its first match. Returns the room's invitation for the QR code. */
export const createNumberRace = async (input: { name: string; maxPlayers: number; countdownS: number; safetyAck: boolean; dogId: string | null; displayName: string; minutes: NumberSettings["minutes"]; difficulty: Difficulty | null }) => {
  const room = await rpc<{ roomId: string; code: string; token: string; expiresAt: string }>("create_room", {
    p_game: "number_trail",
    p_name: input.name,
    p_max_players: Math.min(10, Math.max(2, input.maxPlayers)),
    p_team_mode: false,
    p_start_delay_s: input.countdownS,
    p_safety_ack: input.safetyAck,
    p_dog_id: input.dogId,
    p_display_name: input.displayName,
  });
  const match = await rpc<{ matchId: string; alreadyExists: boolean }>("number_create_match", { p_room_id: room.roomId, p_minutes: input.minutes, p_difficulty: input.difficulty });
  return { ...room, matchId: match.matchId };
};

/** Join by QR token or by room code. Joining a room you're already in changes nothing. */
export const joinNumberRace = (input: { code?: string; token?: string; dogId: string | null; displayName: string }) =>
  rpc<{ roomId: string; alreadyIn: boolean }>("join_room", { p_code: input.code ?? null, p_token: input.token ?? null, p_dog_id: input.dogId, p_display_name: input.displayName });

export const setNumberReady = (roomId: string, ready: boolean) => rpc<void>("set_room_ready", { p_room_id: roomId, p_ready: ready });
export const leaveNumberRace = (roomId: string) => rpc<void>("leave_room", { p_room_id: roomId });
/** Host: close the room for everyone (a race in it is cancelled too). */
export const cancelRoom = (roomId: string) => rpc<void>("cancel_room", { p_room_id: roomId });

/** Whether Number Trail's database functions exist on this backend. False only when they are confirmed missing. */
export const numberTrailDeployed = async () => {
  try {
    await rpc<string | null>("number_room_match", { p_room_id: "00000000-0000-0000-0000-000000000000" });
    return true;
  } catch (e) {
    if ((e as NumberRaceError).code === "not_deployed") return false;
    throw e;
  }
};

/** The room's current match (live, else the latest). */
export const numberMatchOfRoom = (roomId: string) => rpc<string | null>("number_room_match", { p_room_id: roomId });

/** Play again: the room reopens and a new match waits in the lobby. Host only. */
export const playNumberRaceAgain = async (roomId: string, settings: Pick<NumberSettings, "minutes" | "difficulty">) => {
  await rpc<void>("reopen_room", { p_room_id: roomId });
  return rpc<{ matchId: string; alreadyExists: boolean }>("number_create_match", { p_room_id: roomId, p_minutes: settings.minutes, p_difficulty: settings.difficulty });
};

/** Host: walking time, difficulty and countdown. Changing time or difficulty after a draw returns to the lobby. */
export const setNumberSettings = (matchId: string, s: NumberSettings) =>
  rpc<void>("number_set_settings", { p_match_id: matchId, p_minutes: s.minutes, p_difficulty: s.difficulty, p_countdown_s: s.countdownS });

/**
 * Host: draw a feasible number near the competition area (a public meeting point the host picks, not necessarily
 * where they are). The point is used for the search and not stored; the race starts at the nearest public junction.
 */
export const prepareNumberRace = (matchId: string, area: { latitude: number; longitude: number }, avoidStairs = false) =>
  call<PrepareReply>({ action: "number_prepare", matchId, latitude: area.latitude, longitude: area.longitude, avoidStairs }, 45_000);

/** Host: start the countdown. The server sets the start time; everyone present gets the same course. */
export const startNumberRace = (matchId: string) => rpc<{ matchId: string; startsAt: string; endsAt: string; serverNow: string }>("number_start", { p_match_id: matchId });
export const cancelNumberRace = (matchId: string) => rpc<void>("number_cancel", { p_match_id: matchId });

// ---------- Racing ----------

/** Opens (or resumes) this player's walk for the match. Call during the countdown; safe to repeat. */
export const startNumberWalk = (matchId: string) => call<WalkReply>({ action: "number_walk", matchId });

/** Sends new points. The server stores them and, every few seconds, re-checks progress from everything stored. */
export const submitNumberProgress = (matchId: string, points: readonly TrackPoint[]) => call<ProgressReply>({ action: "number_progress", matchId, points: wire(points) }, 30_000);

/**
 * Hands in. `requestKey` comes from nextFinishKey (raceSync.ts): the same key on every retry of one attempt, so a lost
 * reply never makes a second attempt. Pass the points not yet acknowledged so the whole walk is judged.
 */
export const submitNumberFinish = (matchId: string, requestKey: string, points: readonly TrackPoint[] = []) =>
  call<FinishReply>({ action: "number_finish", matchId, requestKey, points: wire(points) }, 45_000);

/** The canonical match for this player, with events after `afterSeq`. Use on open, reconnect, foreground and gaps. */
export const getNumberRaceState = async (matchId: string, afterSeq = 0) => {
  const sentAt = Date.now();
  const state = await call<{ ok: true } & RaceState>({ action: "number_state", matchId, afterSeq });
  return { state: state as RaceState, sentAt, receivedAt: Date.now() };
};

/** Adds Number Trail events to a room channel the screen already holds (useRoom's), instead of opening a second one. */
export const onNumberBroadcast = (channel: { on: (type: "broadcast", filter: { event: string }, cb: (m: { payload: unknown }) => void) => unknown }, onEvent: (msg: NumberBroadcast) => void) =>
  channel.on("broadcast", { event: "number" }, ({ payload }) => onEvent(payload as NumberBroadcast));

/**
 * Listens to the room's private channel for Number Trail events. Only room members are let in, and only the server can
 * broadcast. Returns an unsubscribe function. Use the payload only as a reason to reload (raceSync.onBroadcast).
 */
export const subscribeNumberRace = (roomId: string, userId: string, handlers: { onEvent: (msg: NumberBroadcast) => void; onStatus?: (live: boolean) => void }) =>
  joinRoomChannel(roomId, userId, { onNumber: (p) => handlers.onEvent(p as unknown as NumberBroadcast), onStatus: handlers.onStatus });

// ---------- Practice (phase P2): your own number, your own streets, no ranking ----------

/** Search radii the server accepts, in the order the phone widens a search. 3 km only when the player asks. */
export const SEARCH_RADII = [500, 1_000, 2_000, 3_000] as const;

/**
 * Courses for exactly `number` within one radius of a point (where you are, or a place you chose), nearest on foot
 * first. Parse the number with parseTargetNumber first: the server refuses anything else.
 */
export const findNumberCourses = (input: { number: string; latitude: number; longitude: number; radiusM: (typeof SEARCH_RADII)[number]; minutes?: 15 | 25 | 40 }) =>
  call<FindReply>({ action: "number_find", number: input.number, latitude: input.latitude, longitude: input.longitude, radiusM: input.radiusM, minutes: input.minutes, expand: input.radiusM > 2_000 }, 45_000);

export const beginPractice = (candidateId: string) =>
  call<{ ok: true; practiceId: string; sessionId: string; startedAt: string; number: string; officialM: number; course: import("../../supabase/functions/tournament/numberMatch").NumberCourse; serverNow: string }>({ action: "number_practice_begin", candidateId });

export const submitPracticeProgress = (practiceId: string, points: readonly TrackPoint[]) =>
  call<{ ok: true; storedThrough: number; phase: string; progress: Record<string, unknown> }>({ action: "number_practice_progress", practiceId, points: wire(points) }, 30_000);

/** The server's check of the walk. Safe to repeat: a finished practice keeps its first result. */
export const finishPractice = (practiceId: string, points: readonly TrackPoint[] = []) =>
  call<{ ok: true; practiceId: string; number: string; officialM: number; result: PracticeResult; repeated: boolean; startedAt?: string; finishedAt?: string }>({ action: "number_practice_finish", practiceId, points: wire(points) }, 45_000);

// ---------- Online (phases P3 and P4): one number, everyone on their own streets ----------

export type DistanceCategory = OnlineInfo["category"];

/** Host: an online race in this room, for one number and one distance category. `ranked` false: a friendly challenge. */
export const createOnlineRace = (roomId: string, input: { number: string | null; category: DistanceCategory; ranked: boolean; countdownS: number }) =>
  rpc<{ matchId: string }>("number_create_online_match", { p_room_id: roomId, p_number: input.number, p_category: input.category, p_ranked: input.ranked, p_countdown_s: input.countdownS });

/** Host: everyone searches their own streets now (again after an unmatched try). */
export const startOnlineSearch = (matchId: string) => rpc<void>("number_online_start_search", { p_match_id: matchId });

/** This player searches near a public point of their choosing (used for the search, not stored). */
export const prepareOnlineCourse = (matchId: string, area: { latitude: number; longitude: number }, radiusM: 500 | 1_000 | 2_000 | 3_000 = 1_000) =>
  call<{ ok: true; found: boolean; reason?: string; candidates?: number; radiusM: number }>({ action: "number_online_prepare", matchId, latitude: area.latitude, longitude: area.longitude, radiusM, expand: radiusM > 2_000 }, 45_000);

/** Host: one course per player, checked for fairness; the database re-checks the distances. */
export const matchOnlineCourses = (matchId: string) =>
  call<{ ok: true; matched: boolean; status: string; spreadM: number; toleranceM: number; missing: string[]; checks: unknown[] }>({ action: "number_online_match", matchId }, 30_000);

/** You are at your own start: checked against your course, never stored. */
export const checkInAtStart = (matchId: string, fix: { latitude: number; longitude: number; accuracyM: number }) =>
  call<{ ok: true; atStart: boolean; reason?: string; distanceM?: number }>({ action: "number_online_checkin", matchId, ...fix });

/** An online Number Trail room and its race: the host's number and distance, the same for everyone who joins. */
export const createOnlineNumberRace = async (input: { name: string; maxPlayers: number; countdownS: number; safetyAck: boolean; dogId: string | null; displayName: string; number: string | null; category: DistanceCategory; ranked: boolean }) => {
  const room = await rpc<{ roomId: string; code: string; token: string; expiresAt: string }>("create_room", {
    p_game: "number_trail",
    p_name: input.name,
    p_max_players: Math.min(10, Math.max(2, input.maxPlayers)),
    p_team_mode: false,
    p_start_delay_s: input.countdownS,
    p_safety_ack: input.safetyAck,
    p_dog_id: input.dogId,
    p_display_name: input.displayName,
  });
  const match = await createOnlineRace(room.roomId, { number: input.number, category: input.category, ranked: input.ranked, countdownS: input.countdownS });
  return { ...room, matchId: match.matchId };
};

// ---------- Location first (phases L1 to L4) ----------


export type DiscoverReply = {
  ok: true;
  version: string;
  radiusM: number;
  checkedRadiusM: number;
  partial: boolean;
  reason: string | null;
  failed?: boolean;
  numbers: Availability[];
  available: string[];
  manual: boolean;
  cached: boolean;
};

/**
 * Which numbers from 0 to 99 can be walked near a point. Asking again continues a scan the server's deadline cut
 * short. With `matchId`, the result is also this player's walkable numbers for that online race (no position kept).
 */
export const discoverNearbyNumbers = (input: { latitude: number; longitude: number; radiusM: number; manual: boolean; matchId?: string }) =>
  call<DiscoverReply>({ action: "number_discover", latitude: input.latitude, longitude: input.longitude, radiusM: input.radiusM, manual: input.manual, matchId: input.matchId, expand: input.radiusM > 2_000 }, 45_000);

export type RouteOption = {
  id: string;
  routeKey: string;
  officialM: number;
  digitM: number[];
  connectorM: number;
  approachM: number;
  minutes: number;
  readability: number[];
  difficulty: string;
  layout: string;
  warnings: string[];
  course: CourseView;
};
export type RoutesReply = { ok: true; number: string; radiusM: number; routes: RouteOption[]; total: number; complete: boolean; reason: string | null; checkedRadiusM: number; after?: number; nextAfter?: number };

/** Every distinct verified route for one number, a page at a time (`after`: routes already shown). */
export const listNearbyRoutes = (input: { latitude: number; longitude: number; radiusM: number; number: string; after?: number }) =>
  call<RoutesReply>({ action: "number_routes", latitude: input.latitude, longitude: input.longitude, radiusM: input.radiusM, number: input.number, after: input.after ?? 0, expand: input.radiusM > 2_000 }, 45_000);

export type CommonNumbers = {
  players: { userId: string; status: "not_checked" | "partial" | "done"; available: number; radiusM: number | null; manual: boolean | null }[];
  everyoneChecked: boolean;
  common: string[];
  pending: string[];
};
/** Numbers every present player can walk (counts only for others: never their list or position). */
export const getCommonNumbers = (matchId: string) => rpc<CommonNumbers>("number_online_common", { p_match_id: matchId });
/** Host: the race's number, from the common set (checked by the database). */
export const chooseOnlineNumber = (matchId: string, number: string) => rpc<{ number: string }>("number_online_choose_number", { p_match_id: matchId, p_number: number });
/** Host: everyone races this one route of the host's. */
export const shareOnlineCourse = (matchId: string, candidateId: string) => rpc<{ shared: boolean; officialM: number }>("number_online_share_course", { p_match_id: matchId, p_candidate_id: candidateId });

/** Host: a Number Trail race in a room that already exists (after picking Number Trail in the room). */
export const createNumberMatch = (roomId: string, settings: { minutes: 15 | 25 | 40; difficulty: Difficulty | null } = { minutes: 25, difficulty: null }) =>
  rpc<{ matchId: string; alreadyExists: boolean }>("number_create_match", { p_room_id: roomId, p_minutes: settings.minutes, p_difficulty: settings.difficulty });
