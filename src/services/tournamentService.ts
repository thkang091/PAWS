import { getClientOrThrow } from "@/services/serviceUtils";
import type { TerritoryIssue, TournamentPhase, TrackPoint } from "../../supabase/functions/tournament/geo";
import type { ShapeIssue } from "../../supabase/functions/tournament/shape";

export type { ShapeIssue, TerritoryIssue, TournamentPhase, TrackPoint };

export type TournamentGame =
  | "largest_country"
  | "follow_shape"
  | "number_trail"
  | "photo_pose"
  | "seasonal_selfie"
  | "match_my_dog"
  | "dog_reels"
  | "find_mafia"
  | "steal_territory"
  | "steal_road";

export type TournamentMode = "online" | "nearby";

export type TournamentSummary = {
  id: string;
  gameType: TournamentGame;
  mode: TournamentMode;
  name: string;
  description: string;
  /** A friend battle (only its players see it) and its invite code. */
  private?: boolean;
  inviteCode?: string | null;
  phase: TournamentPhase;
  registrationOpensAt: string;
  startsAt: string;
  endsAt: string;
  participants: number;
  joined: boolean;
  myBestM2: number | null;
  /** Your best result in this tournament: square metres, or a shape score. */
  myBest: number | null;
  /** Follow the Shape: the target for this tournament. */
  shape: ShapeChallenge | null;
};

export type ShapeChallenge = {
  key: string;
  name: string;
  difficulty: "easy" | "medium" | "hard";
  closed: boolean;
  minDistanceM: number;
  points: [number, number][];
};

export type TournamentOverview = {
  serverNow: string;
  tournaments: TournamentSummary[];
  activeCount: number;
  allTimeBestM2: number | null;
  openSession: { id: string; tournament_id: string; status: string; started_at: string } | null;
};

/** A ranked result: square metres for territories, points for shapes. */
export type BoardRow = { rank: number; name: string; value: number; submittedAt: string; isMine: boolean };
export type BoardUnit = "m2" | "points";

export type TournamentBoard = {
  tournament: { id: string; name: string; gameType: TournamentGame; phase: TournamentPhase; startsAt: string; endsAt: string };
  unit: BoardUnit;
  finalized: boolean;
  total: number;
  rows: BoardRow[];
  mine: BoardRow | null;
};

export type WalkSession = { id: string; startedAt: string; lastSeq: number; status: string };

export type SubmitReply =
  | {
      status: "recorded";
      submissionId: string;
      areaM2?: number;
      score?: number;
      /** Follow the Shape: the shape match and route completion behind the score, and the tier it ranks in. */
      similarity?: number;
      completion?: number;
      tier?: ShapeTier;
      validationStatus?: "valid" | "flagged";
      rank?: number | null;
      total?: number;
      distanceM?: number;
      elapsedSeconds?: number;
      repeated?: boolean;
    }
  | {
      status: "not_yet";
      issues: (TerritoryIssue | ShapeIssue | RouteIssue)[];
      completion?: number;
      recoverable: boolean;
      distanceM: number;
      elapsedSeconds: number;
      closureM?: number;
      areaM2?: number;
      score?: number;
    };

export type ShapeSubmission = {
  id: string;
  tournament_id: string;
  score: number;
  frechet: number;
  algorithm_version: string;
  route_normalized: [number, number][];
  target_normalized: [number, number][];
  distance_m: number;
  elapsed_seconds: number;
  submitted_at: string;
  shape_key: string | null;
  tier: ShapeTier | null;
  assignment_id: string | null;
  similarity: number | string | null;
  route_completion: number | string | null;
  scoring_version: string | null;
};

export type TerritoryDetail = {
  id: string;
  tournamentId: string;
  areaM2: number;
  distanceM: number;
  elapsedSeconds: number;
  validationStatus: "valid" | "flagged";
  submittedAt: string;
  outline: { type: "Polygon"; coordinates: [number, number][][] };
  personalBest: boolean;
};

export class TournamentError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

const TIMEOUT_MS = 25_000;

const call = async <T>(body: Record<string, unknown>, timeout = TIMEOUT_MS): Promise<T> => {
  const client = getClientOrThrow();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  const { data, error } = await client.functions.invoke("tournament", { body, signal: abort.signal }).finally(() => clearTimeout(timer));
  if (error) {
    const context = (error as { context?: Response }).context;
    if (!context) throw new TournamentError(abort.signal.aborted ? "timeout" : "network");
    const payload = typeof context.json === "function" ? await context.json().catch(() => null) : null;
    // A 404 with no reason of ours means the function itself is not deployed.
    throw new TournamentError((payload?.error as string) ?? (context.status === 404 ? "not_deployed" : "server_error"));
  }
  if (!data?.ok) throw new TournamentError((data?.error as string) ?? "server_error");
  return data as T;
};

export const getOverview = () => call<TournamentOverview & { ok: true }>({ action: "overview" });

export type ShapeTier = "easy" | "medium" | "hard";
export type RouteIssue = "route_incomplete" | "route_out_of_order";

/** Follow the Shape boards rank within a difficulty tier. */
export const getBoard = (tournamentId: string, tier?: ShapeTier | null) =>
  call<TournamentBoard & { ok: true }>({ action: "leaderboard", tournamentId, ...(tier ? { tier } : {}) });

export const joinTournament = async (tournamentId: string, dogId: string | null) => {
  const client = getClientOrThrow();
  const { error } = await client.rpc("join_tournament" as never, { p_tournament_id: tournamentId, p_dog_id: dogId } as never);
  if (error) throw new TournamentError(error.message.match(/[a-z_]{6,}/)?.[0] ?? "server_error");
};

/** Follow the Shape walks pass the picked route (`assignmentId`); the server links the walk to it. */
export const startWalk = (tournamentId: string, dogId: string | null, assignmentId?: string | null) =>
  call<{ session: WalkSession; resumed: boolean }>({ action: "start", tournamentId, dogId, ...(assignmentId ? { assignmentId } : {}) });

/** Points go up by sequence number; the server ignores any it already has. */
export const sendPoints = (sessionId: string, points: readonly TrackPoint[]) =>
  call<{ storedThrough: number; dropped: number }>({
    action: "append",
    sessionId,
    points: points.map((p) => ({ seq: p.seq, segment: p.segment, latitude: p.latitude, longitude: p.longitude, accuracyM: p.accuracyM, capturedAt: p.capturedAt })),
  });

export const setWalkState = (sessionId: string, state: "active" | "paused") => call({ action: "state", sessionId, state });

export const cancelWalk = (sessionId: string) => call({ action: "cancel", sessionId });

export const submitWalk = (sessionId: string) => call<SubmitReply & { ok: true }>({ action: "submit", sessionId }, 40_000);

export const getTerritory = async (submissionId: string): Promise<TerritoryDetail> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("territory_detail" as never, { p_submission_id: submissionId } as never);
  if (error) throw new TournamentError(/territory_detail|schema cache/i.test(error.message) ? "not_deployed" : "server_error");
  if (!data) throw new TournamentError("not_found");
  return data as unknown as TerritoryDetail;
};

/** Your own Follow the Shape result, with the normalised route and target for the comparison drawing. */
export const getShapeSubmission = async (submissionId: string) => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("shape_submissions" as never).select("*").eq("id", submissionId).maybeSingle();
  if (error) throw new TournamentError(/shape_submissions|schema cache/i.test(error.message) ? "not_deployed" : "server_error");
  if (!data) throw new TournamentError("not_found");
  const row = data as unknown as ShapeSubmission;
  return { ...row, score: Number(row.score) };
};

/** Your earlier scores in the same tournament, to tell whether this one is a personal best. */
export const getMyShapeScores = async (tournamentId: string) => {
  const client = getClientOrThrow();
  const { data } = await client.from("shape_submissions" as never).select("id, score, tier").eq("tournament_id", tournamentId);
  return ((data ?? []) as unknown as { id: string; score: number | string; tier: ShapeTier | null }[]).map((r) => ({ id: r.id, score: Number(r.score), tier: r.tier }));
};

// ---------- Follow the Shape walking routes ----------

export type RouteOutcome = "ok" | "no_network" | "no_public_start" | "no_feasible_route" | "shape_not_possible";

export type RouteWarning = "no_sidewalk_mapped" | "no_sidewalk" | "steps" | "unpaved" | "unmarked_crossing" | "rail_crossing" | "busy_road";

export type ShapeRouteOption = {
  candidateId: string;
  /** The route's real geometry, junction to junction, as it was checked on the server. */
  path: { latitude: number; longitude: number }[];
  /** Measured along that geometry. */
  lengthM: number;
  /** Estimated walking time at a steady dog-walking pace (about 4 km/h). */
  minutes: number;
  loop: boolean;
  /** Estimated shape match (0 to 100) of the route's own geometry. Not an official score. */
  estimate: number;
  recentOverlap: number;
  /** What the map data says a walker should know about this route, most important first. */
  warnings: RouteWarning[];
};

export type ShapeRoutes = {
  outcome: RouteOutcome;
  algorithm: string;
  /** "paws": an area an organizer prepared. "osm": OpenStreetMap's pedestrian network. */
  source: "paws" | "osm";
  /** Fewer than three options were different enough to show. */
  limited: boolean;
  options: ShapeRouteOption[];
  /** Source, licence and attribution of every road area the options use. Show the attribution with the map. */
  sources: { regionId: string; name: string; source: string; license: string; attribution: string }[];
};

/**
 * Up to three walkable loops shaped like `shapeKey`, built on a real pedestrian network around a point: an area a
 * PAWS organizer prepared, or OpenStreetMap. The point is used for the search only and is not stored. An outcome other
 * than "ok" means no route is offered, never an invented one.
 */
export const requestShapeRoutes = (input: { shapeKey: string; minutes: 15 | 25 | 40; latitude: number; longitude: number; tournamentId?: string; avoidStairs?: boolean; preferPaths?: boolean }) =>
  call<ShapeRoutes>({ action: "routes", ...input }, 70_000);

export type RouteLeg = { edgeId: string; lengthM: number; coords: [number, number][] };
export type AssignedRoute = {
  assignmentId: string;
  status: "assigned" | "walking" | "completed" | "abandoned";
  tournamentId: string | null;
  sessionId: string | null;
  shapeKey: string;
  minutes: number;
  lengthM: number;
  loop: boolean;
  shapeScore: number;
  legs: RouteLeg[];
};

/** Your picked route, step by step in walking order, from the server. */
export const getAssignedRoute = async (assignmentId: string) => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("assignment_route" as never, { p_assignment_id: assignmentId } as never);
  if (error) throw new TournamentError(error.message.match(/[a-z]+(?:_[a-z]+)+/)?.[0] ?? "server_error");
  return data as unknown as AssignedRoute;
};

/** Your open route pick (picked or being walked) in a tournament, if any. */
export const getOpenAssignment = async (tournamentId: string) => {
  const client = getClientOrThrow();
  const { data } = await client
    .from("shape_route_assignments" as never)
    .select("id, status")
    .eq("tournament_id", tournamentId)
    .in("status", ["assigned", "walking"])
    .maybeSingle();
  return (data as unknown as { id: string; status: string } | null) ?? null;
};

/** Picks one of your own options. Earlier open picks are abandoned. */
export const assignShapeRoute = async (candidateId: string) => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("assign_shape_route" as never, { p_candidate_id: candidateId } as never);
  if (error) throw new TournamentError(error.message.match(/[a-z]+(?:_[a-z]+)+/)?.[0] ?? "server_error");
  return data as unknown as string;
};
