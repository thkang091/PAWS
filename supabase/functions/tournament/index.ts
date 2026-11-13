import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import {
  RECOVERABLE,
  canStartWalk,
  gateSubmit,
  planAppend,
  planSubmit,
  rankBoard,
  tournamentPhase,
  GPS_RULES,
  type SessionRow,
  type TournamentTimes,
  type TrackPoint,
} from "./geo.ts";
import { DEFAULT_SHAPE_RULES, matchShape, type ShapeRules } from "./shape.ts";
import { ROUTE_RULES, generateShapeRoutes, validateRoute, type PedGraph } from "./routes.ts";
import { OSM_WALK_VERSION, routeWarnings } from "./osm.ts";
import { ROUTE_SCORING, routeProgress, scoreRouteWalk, type RouteLeg } from "./routeScore.ts";
import { presetByKey } from "./shapes.ts";
import { NUMBER_ACTIONS, StoreError, type NumberAction, type NumberDeps } from "./numberService.ts";
import { networkNear as loadNear, type NetworkEdge } from "./network.ts";
import { DISCOVERY_ACTIONS, type DiscoveryAction } from "./numberDiscoveryService.ts";
import { PLAY_ACTIONS, type PlayAction } from "./numberPlayService.ts";

/**
 * Tournament: the only writer of GPS sessions, points and territories. Scores are worked out here from the stored
 * points and measured again by PostGIS; nothing the phone says about distance or area is used.
 *
 * POST { action: "overview" }                              tournaments with phase, your entry and best, active count
 * POST { action: "leaderboard", tournamentId }             ranked summaries, no coordinates
 * POST { action: "start", tournamentId, dogId }            open a walk (or resume the one already open)
 * POST { action: "append", sessionId, points }             store a batch of points; repeats are ignored
 * POST { action: "state", sessionId, state }               pause or resume
 * POST { action: "cancel", sessionId }                     end a walk without a result and delete its points
 * POST { action: "submit", sessionId }                     check and score the walk for its game; idempotent
 *
 * Games: Make the Largest Country (area, measured again by PostGIS) and Follow the Shape (similarity score from
 * shape.ts against the challenge's stored geometry and versioned rules).
 *
 * Number Trail (nearby race, numberService.ts):
 * POST { action: "number_prepare", matchId, latitude, longitude }   host: draw a feasible number, store the course
 * POST { action: "number_walk", matchId }                          open (or resume) my walk for the race
 * POST { action: "number_progress", matchId, points }              store points; the server re-checks progress
 * POST { action: "number_finish", matchId, requestKey, points? }   hand in; receipt first, then the check
 * POST { action: "number_state", matchId, afterSeq? }              canonical state for (re)connecting phones
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });
const fail = (error: string, status = 400) => json({ ok: false, error }, status);
/** Never log coordinates. */
const log = (event: string, detail: Record<string, unknown> = {}) => console.error(`[tournament] ${event}`, JSON.stringify(detail));

type TournamentRow = {
  id: string;
  game_type: string;
  mode: string;
  name: string;
  description: string;
  status: string;
  registration_opens_at: string;
  starts_at: string;
  ends_at: string;
  private?: boolean;
  invite_code?: string | null;
};

const times = (t: TournamentRow): TournamentTimes => ({ status: t.status, registrationOpensAt: t.registration_opens_at, startsAt: t.starts_at, endsAt: t.ends_at });

const SESSION_COLUMNS = "id, user_id, tournament_id, status, started_at, last_seq, last_submit_attempt_at";

const loadSession = async (admin: SupabaseClient, id: unknown) => {
  if (typeof id !== "string") return null;
  const { data } = await admin.from("gps_sessions").select(SESSION_COLUMNS).eq("id", id).maybeSingle();
  return (data as SessionRow | null) ?? null;
};

const loadTournament = async (admin: SupabaseClient, id: unknown) => {
  if (typeof id !== "string") return null;
  const { data } = await admin.from("tournaments").select("*").eq("id", id).maybeSingle();
  return (data as TournamentRow | null) ?? null;
};

/** Each game's checked results, best per player. Flagged results wait for a person and stay off the board. */
const TIERS = ["easy", "medium", "hard"] as const;
type Tier = (typeof TIERS)[number];

const board = async (admin: SupabaseClient, t: Pick<TournamentRow, "id" | "game_type">, tier: Tier | null = null) => {
  if (t.game_type === "follow_shape") {
    // Players choose their shape, so a board compares one difficulty tier.
    let query = admin.from("shape_submissions").select("id, user_id, dog_id, score, submitted_at").eq("tournament_id", t.id).eq("validation_status", "valid");
    if (tier) query = query.eq("tier", tier);
    const { data } = await query.limit(5000);
    const rows = (data ?? []) as { id: string; user_id: string; dog_id: string | null; score: number | string; submitted_at: string }[];
    return rankBoard(rows.map((r) => ({ userId: r.user_id, dogId: r.dog_id, value: Number(r.score), submittedAt: r.submitted_at, submissionId: r.id })));
  }
  const { data } = await admin
    .from("territory_submissions")
    .select("id, user_id, dog_id, area_m2, submitted_at")
    .eq("tournament_id", t.id)
    .eq("validation_status", "valid")
    .limit(5000);
  const rows = (data ?? []) as { id: string; user_id: string; dog_id: string | null; area_m2: number; submitted_at: string }[];
  return rankBoard(rows.map((r) => ({ userId: r.user_id, dogId: r.dog_id, value: Math.round(r.area_m2), submittedAt: r.submitted_at, submissionId: r.id })));
};

type ChallengeRow = { id: string; tournament_id: string; shape_key: string; name: string; difficulty: string; closed: boolean; min_distance_m: number; points: [number, number][]; rules: Partial<ShapeRules>; algorithm_version: string };

const loadChallenge = async (admin: SupabaseClient, tournamentId: string) => {
  const { data } = await admin.from("shape_challenges").select("*").eq("tournament_id", tournamentId).maybeSingle();
  return (data as ChallengeRow | null) ?? null;
};

/** The challenge's own rules on top of the defaults, pinned to the algorithm it was created with. */
const rulesOf = (c: ChallengeRow): ShapeRules => ({ ...DEFAULT_SHAPE_RULES, ...c.rules, algorithm: c.algorithm_version });

const overview = async (admin: SupabaseClient, userId: string) => {
  const now = Date.now();
  const since = new Date(now - 14 * 86_400_000).toISOString();
  // This week's online games open on first use where pg_cron isn't running (a no-op once they're open).
  await admin.rpc("open_weekly_challenges", { p_now: null }).then(({ error }) => error && console.error("[tournament] weekly_open_failed", error.message));
  const [{ data }, { data: myPrivate }] = await Promise.all([
    admin.from("tournaments").select("*").gte("ends_at", since).eq("private", false).order("starts_at", { ascending: true }).limit(50),
    admin.from("tournament_participants").select("tournament_id").eq("user_id", userId),
  ]);
  const privateIds = ((myPrivate ?? []) as { tournament_id: string }[]).map((r) => r.tournament_id);
  const { data: battles } = privateIds.length
    ? await admin.from("tournaments").select("*").eq("private", true).gte("ends_at", since).in("id", privateIds)
    : { data: [] };
  const tournaments = [...((data ?? []) as TournamentRow[]), ...((battles ?? []) as TournamentRow[])];
  const ids = tournaments.map((t) => t.id);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: joined }, { data: counts }, { data: mine }, { data: mineShapes }, { data: challenges }] = await Promise.all([
    admin.from("tournament_participants").select("tournament_id").eq("user_id", userId).eq("status", "joined").in("tournament_id", ids.length ? ids : none),
    admin.from("tournament_participants").select("tournament_id").eq("status", "joined").in("tournament_id", ids.length ? ids : none),
    admin.from("territory_submissions").select("tournament_id, area_m2").eq("user_id", userId).eq("validation_status", "valid"),
    admin.from("shape_submissions").select("tournament_id, score").eq("user_id", userId).eq("validation_status", "valid"),
    admin.from("shape_challenges").select("tournament_id, shape_key, name, difficulty, closed, min_distance_m, points").in("tournament_id", ids.length ? ids : none),
  ]);
  const joinedSet = new Set(((joined ?? []) as { tournament_id: string }[]).map((r) => r.tournament_id));
  const countOf = new Map<string, number>();
  ((counts ?? []) as { tournament_id: string }[]).forEach((r) => countOf.set(r.tournament_id, (countOf.get(r.tournament_id) ?? 0) + 1));
  const bestOf = new Map<string, number>();
  ((mine ?? []) as { tournament_id: string; area_m2: number }[]).forEach((r) => bestOf.set(r.tournament_id, Math.max(bestOf.get(r.tournament_id) ?? 0, r.area_m2)));
  const allTimeBest = Math.max(0, ...((mine ?? []) as { area_m2: number }[]).map((r) => r.area_m2));
  const shapeBestOf = new Map<string, number>();
  ((mineShapes ?? []) as { tournament_id: string; score: number | string }[]).forEach((r) => shapeBestOf.set(r.tournament_id, Math.max(shapeBestOf.get(r.tournament_id) ?? 0, Number(r.score))));
  const challengeOf = new Map(((challenges ?? []) as (Omit<ChallengeRow, "id" | "rules" | "algorithm_version">)[]).map((c) => [c.tournament_id, c]));

  // Number Trail walks belong to a room's race, not to a tournament.
  const { data: open } = await admin.from("gps_sessions").select("id, tournament_id, status, started_at").eq("user_id", userId).in("status", ["active", "paused"]).not("tournament_id", "is", null).maybeSingle();

  const list = tournaments.map((t) => ({
    id: t.id,
    gameType: t.game_type,
    mode: t.mode,
    name: t.name,
    description: t.description,
    private: Boolean(t.private),
    inviteCode: t.private ? t.invite_code ?? null : null,
    phase: tournamentPhase(times(t), now),
    registrationOpensAt: t.registration_opens_at,
    startsAt: t.starts_at,
    endsAt: t.ends_at,
    participants: countOf.get(t.id) ?? 0,
    joined: joinedSet.has(t.id),
    myBestM2: bestOf.get(t.id) ?? null,
    myBest: t.game_type === "follow_shape" ? shapeBestOf.get(t.id) ?? null : bestOf.get(t.id) ?? null,
    shape: (() => {
      const c = challengeOf.get(t.id);
      return c ? { key: c.shape_key, name: c.name, difficulty: c.difficulty, closed: c.closed, minDistanceM: c.min_distance_m, points: c.points } : null;
    })(),
  }));
  return json({
    ok: true,
    serverNow: new Date(now).toISOString(),
    tournaments: list,
    activeCount: list.filter((t) => t.joined && t.phase === "active").length,
    allTimeBestM2: allTimeBest || null,
    openSession: open ?? null,
  });
};

const leaderboard = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const t = await loadTournament(admin, body.tournamentId);
  if (!t) return fail("tournament_not_found", 404);
  const tier = TIERS.includes(body.tier as Tier) ? (body.tier as Tier) : null;
  const ranked = await board(admin, t, tier);
  const dogIds = [...new Set(ranked.map((r) => r.dogId).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (dogIds.length) {
    const { data } = await admin.from("dogs").select("id, name").in("id", dogIds);
    ((data ?? []) as { id: string; name: string }[]).forEach((d) => names.set(d.id, d.name));
  }
  const rows = ranked.map((r) => ({
    rank: r.rank,
    name: (r.dogId && names.get(r.dogId)) || "A PAWS dog",
    value: r.value,
    submittedAt: r.submittedAt,
    isMine: r.userId === userId,
  }));
  const phase = tournamentPhase(times(t), Date.now());
  return json({
    ok: true,
    tournament: { id: t.id, name: t.name, gameType: t.game_type, phase, startsAt: t.starts_at, endsAt: t.ends_at },
    unit: t.game_type === "follow_shape" ? "points" : "m2",
    tier,
    finalized: phase === "completed",
    total: rows.length,
    rows: rows.slice(0, 100),
    mine: rows.find((r) => r.isMine) ?? null,
  });
};

/** Follow the Shape walks follow a route the player picked. Returns an error response, or null when linked. */
const linkRoute = async (admin: SupabaseClient, userId: string, sessionId: string, assignmentId: unknown) => {
  if (typeof assignmentId !== "string") return fail("route_required", 409);
  const { error } = await admin.rpc("link_route_session", { p_assignment_id: assignmentId, p_session_id: sessionId, p_user_id: userId });
  return error ? fail(error.message.match(/[a-z]+(?:_[a-z]+)+/)?.[0] ?? "route_required", 409) : null;
};

const start = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const t = await loadTournament(admin, body.tournamentId);
  if (!t) return fail("tournament_not_found", 404);
  const now = Date.now();
  if (!canStartWalk(times(t), now)) return fail("not_running", 409);
  if (t.game_type === "follow_shape" && !(await loadChallenge(admin, t.id))) return fail("no_challenge", 409);
  if (t.game_type !== "largest_country" && t.game_type !== "follow_shape") return fail("not_a_walking_game", 409);
  const { data: entry } = await admin.from("tournament_participants").select("dog_id").eq("tournament_id", t.id).eq("user_id", userId).eq("status", "joined").maybeSingle();
  if (!entry) return fail("not_joined", 403);

  // One walk at a time: resume a recent one here, close anything else left open.
  const { data: open } = await admin.from("gps_sessions").select(SESSION_COLUMNS).eq("user_id", userId).in("status", ["active", "paused"]).maybeSingle();
  const openRow = open as SessionRow | null;
  if (openRow) {
    const fresh = now - Date.parse(openRow.started_at) < GPS_RULES.maxDurationMs;
    if (openRow.tournament_id === t.id && fresh) {
      if (t.game_type === "follow_shape" && body.assignmentId) {
        const linked = await linkRoute(admin, userId, openRow.id, body.assignmentId);
        if (linked) return linked;
      }
      return json({ ok: true, session: { id: openRow.id, startedAt: openRow.started_at, lastSeq: openRow.last_seq, status: openRow.status }, resumed: true });
    }
    await admin.from("gps_sessions").update({ status: "expired", ended_at: new Date(now).toISOString() }).eq("id", openRow.id);
  }

  const dogId = typeof body.dogId === "string" ? body.dogId : (entry as { dog_id: string | null }).dog_id;
  const { data: row, error } = await admin.from("gps_sessions").insert({ tournament_id: t.id, user_id: userId, dog_id: dogId }).select(SESSION_COLUMNS).single();
  if (error || !row) {
    log("start_failed", { message: error?.message });
    return fail("start_failed", 500);
  }
  const s = row as SessionRow;
  if (t.game_type === "follow_shape") {
    const linked = await linkRoute(admin, userId, s.id, body.assignmentId);
    if (linked) {
      await admin.from("gps_sessions").update({ status: "cancelled", ended_at: new Date(now).toISOString() }).eq("id", s.id);
      return linked;
    }
  }
  return json({ ok: true, session: { id: s.id, startedAt: s.started_at, lastSeq: 0, status: s.status }, resumed: false });
};

const append = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const session = await loadSession(admin, body.sessionId);
  const t = session ? await loadTournament(admin, session.tournament_id) : null;
  if (!session || !t) return fail("not_found", 404);
  const { count } = await admin
    .from("gps_points")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .gte("received_at", new Date(Date.now() - 60_000).toISOString());
  const plan = planAppend({ session, userId, tournament: times(t), incoming: body.points, receivedLastMinute: count ?? 0, now: Date.now() });
  if (plan.kind === "reject") return fail(plan.error, plan.error === "too_many" ? 429 : plan.error === "not_found" ? 404 : 409);
  if (plan.rows.length) {
    const { error } = await admin.from("gps_points").upsert(
      plan.rows.map((p) => ({
        session_id: session.id,
        sequence_number: p.seq,
        segment: p.segment,
        latitude: p.latitude,
        longitude: p.longitude,
        accuracy_m: p.accuracyM,
        captured_at: new Date(p.capturedAt).toISOString(),
      })),
      { onConflict: "session_id,sequence_number", ignoreDuplicates: true },
    );
    if (error) {
      log("append_failed", { message: error.message });
      return fail("append_failed", 500);
    }
    const top = Math.max(session.last_seq, ...plan.rows.map((p) => p.seq));
    if (top > session.last_seq) await admin.from("gps_sessions").update({ last_seq: top }).eq("id", session.id).lt("last_seq", top);
  }
  // Everything up to the highest sequence sent is now safe on the server, including points dropped as malformed.
  const sent = Array.isArray(body.points) ? (body.points as { seq?: number }[]).map((p) => (Number.isInteger(p?.seq) ? (p.seq as number) : 0)) : [];
  return json({ ok: true, storedThrough: Math.max(session.last_seq, 0, ...sent), dropped: plan.dropped });
};

const setState = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const session = await loadSession(admin, body.sessionId);
  if (!session || session.user_id !== userId) return fail("not_found", 404);
  if (body.state !== "active" && body.state !== "paused") return fail("bad_request");
  if (session.status !== "active" && session.status !== "paused") return fail("session_closed", 409);
  await admin.from("gps_sessions").update({ status: body.state }).eq("id", session.id);
  return json({ ok: true });
};

const cancel = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const session = await loadSession(admin, body.sessionId);
  if (!session || session.user_id !== userId) return fail("not_found", 404);
  if (session.status === "active" || session.status === "paused") {
    await admin.from("gps_sessions").update({ status: "cancelled", ended_at: new Date().toISOString() }).eq("id", session.id);
  }
  // A cancelled walk keeps no route.
  if (session.status !== "submitted") await admin.from("gps_points").delete().eq("session_id", session.id);
  return json({ ok: true });
};

const submit = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const session = await loadSession(admin, body.sessionId);
  const t = session ? await loadTournament(admin, session.tournament_id) : null;
  if (!session || !t) return fail("not_found", 404);
  const shapeGame = t.game_type === "follow_shape";
  const { data: existing } = await admin.from(shapeGame ? "shape_submissions" : "territory_submissions").select("id").eq("session_id", session.id).maybeSingle();

  const { data: stored } = await admin
    .from("gps_points")
    .select("sequence_number, segment, latitude, longitude, accuracy_m, captured_at")
    .eq("session_id", session.id)
    .order("sequence_number", { ascending: true })
    .limit(10_000);
  const points: TrackPoint[] = ((stored ?? []) as { sequence_number: number; segment: number; latitude: number; longitude: number; accuracy_m: number | null; captured_at: string }[]).map((p) => ({
    seq: p.sequence_number,
    segment: p.segment,
    latitude: p.latitude,
    longitude: p.longitude,
    accuracyM: p.accuracy_m,
    capturedAt: Date.parse(p.captured_at),
  }));

  const now = Date.now();
  const existingSubmissionId = (existing as { id: string } | null)?.id ?? null;
  if (shapeGame) return submitShape(admin, userId, session, t, existingSubmissionId, points, now);
  const plan = planSubmit({ session, userId, tournament: times(t), existingSubmissionId, points, now });
  if (plan.kind === "reject") return fail(plan.error, plan.error === "slow_down" ? 429 : plan.error === "not_found" ? 404 : 409);
  if (plan.kind === "existing") return json({ ok: true, status: "recorded", submissionId: plan.submissionId, repeated: true });

  await admin.from("gps_sessions").update({ last_submit_attempt_at: new Date(now).toISOString() }).eq("id", session.id);
  const territory = plan.territory;
  const summary = { distanceM: Math.round(territory.distanceM), elapsedSeconds: Math.round(territory.activeMs / 1000), closureM: Math.round(territory.closureM), areaM2: Math.round(territory.areaM2) };

  if (plan.kind === "retry") {
    return json({ ok: true, status: "not_yet", issues: territory.issues, recoverable: territory.issues.every((i) => RECOVERABLE.includes(i)), ...summary });
  }

  const { data: recorded, error } = await admin.rpc("record_territory", {
    p_session_id: session.id,
    p_ring_geojson: JSON.stringify({ type: "Polygon", coordinates: [territory.ring] }),
    p_check_area_m2: territory.areaM2,
    p_distance_m: territory.distanceM,
    p_elapsed_seconds: summary.elapsedSeconds,
  });
  if (error || !recorded) {
    log("record_failed", { message: error?.message });
    // PostGIS refused the outline: treat it like a crossing route, which is what it almost always is.
    if (error && /invalid_polygon|not_a_polygon|empty_polygon/.test(error.message)) {
      return json({ ok: true, status: "not_yet", issues: ["self_intersecting"], recoverable: false, ...summary });
    }
    return fail("record_failed", 500);
  }
  const row = recorded as { id: string; area_m2: number; validation_status: string };
  const ranked = await board(admin, t);
  const mine = ranked.find((r) => r.userId === userId);
  return json({
    ok: true,
    status: "recorded",
    submissionId: row.id,
    areaM2: Math.round(row.area_m2),
    validationStatus: row.validation_status,
    rank: row.validation_status === "valid" ? mine?.rank ?? null : null,
    total: ranked.length,
    distanceM: summary.distanceM,
    elapsedSeconds: summary.elapsedSeconds,
  });
};

/** Follow the Shape hand-in: the same gate as every walk, then the server's own match against the stored target. */
const submitShape = async (
  admin: SupabaseClient,
  userId: string,
  session: SessionRow,
  t: TournamentRow,
  existingSubmissionId: string | null,
  points: TrackPoint[],
  now: number,
) => {
  const gate = gateSubmit({ session, userId, tournament: times(t), existingSubmissionId, now });
  if (gate.kind === "reject") return fail(gate.error, gate.error === "slow_down" ? 429 : gate.error === "not_found" ? 404 : 409);
  if (gate.kind === "existing") return json({ ok: true, status: "recorded", submissionId: gate.submissionId, repeated: true });
  const challenge = await loadChallenge(admin, t.id);
  if (!challenge) return fail("no_challenge", 409);
  await admin.from("gps_sessions").update({ last_submit_attempt_at: new Date(now).toISOString() }).eq("id", session.id);

  // The walk is judged against the shape the player chose and the route they picked, both read from the server.
  const { data: assignment } = await admin.from("shape_route_assignments").select("id").eq("session_id", session.id).eq("status", "walking").maybeSingle();
  if (!assignment) return fail("route_required", 409);
  const { data: routeData, error: routeError } = await admin.rpc("assignment_route", { p_assignment_id: (assignment as { id: string }).id });
  const route = routeData as { shapeKey: string; legs: RouteLeg[] } | null;
  const shape = route ? presetByKey(route.shapeKey) : null;
  if (routeError || !route || !shape || !route.legs.length) return fail("route_required", 409);

  const rules = rulesOf(challenge);
  const match = matchShape(points, { closed: shape.closed, minDistanceM: shape.minDistanceM, points: shape.points }, rules);
  const summary = { distanceM: Math.round(match.distanceM), elapsedSeconds: Math.round(match.activeMs / 1000) };
  if (!match.ok) {
    const recoverable = match.issues.every((i) => i === "too_short" || i === "too_few_points");
    return json({ ok: true, status: "not_yet", issues: match.issues, recoverable, score: 0, ...summary });
  }
  const scored = scoreRouteWalk(match.score, routeProgress(points, route.legs));
  if (!scored.ok) {
    return json({ ok: true, status: "not_yet", issues: scored.issues, recoverable: true, score: 0, completion: scored.progress.completion, ...summary });
  }

  const { data: recorded, error } = await admin.rpc("record_shape_route_submission", {
    p_session_id: session.id,
    p_similarity: scored.similarity,
    p_completion: Math.round(scored.progress.completion * 1000) / 1000,
    p_progression: Math.round(scored.progress.progression * 1000) / 1000,
    p_score: scored.final,
    p_frechet: match.distance,
    p_route: match.route,
    p_target: match.target,
    p_distance_m: match.distanceM,
    p_elapsed_seconds: summary.elapsedSeconds,
    p_scoring_version: ROUTE_SCORING,
  });
  if (error || !recorded) {
    log("record_shape_failed", { message: error?.message });
    return fail(error?.message.match(/[a-z]+(?:_[a-z]+)+/)?.[0] ?? "record_failed", 500);
  }
  const row = recorded as { id: string; score: number | string; tier: Tier };
  const ranked = await board(admin, t, row.tier);
  return json({
    ok: true,
    status: "recorded",
    submissionId: row.id,
    score: Number(row.score),
    similarity: scored.similarity,
    completion: scored.progress.completion,
    tier: row.tier,
    rank: ranked.find((r) => r.userId === userId)?.rank ?? null,
    total: ranked.length,
    ...summary,
  });
};

/**
 * Follow the Shape routes: walkable loops shaped like the target, built from the PAWS pedestrian graph around the
 * player. The phone's position is used for the search and never stored; the request records the public start
 * junction. Every option is checked against the graph again by record_shape_route_request.
 */
const routes = async (admin: SupabaseClient, userId: string, body: Record<string, unknown>) => {
  const shape = typeof body.shapeKey === "string" ? presetByKey(body.shapeKey) : null;
  const minutes = Number(body.minutes);
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  if (!shape || !ROUTE_RULES.minutes.includes(minutes) || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail("bad_request");
  const tournamentId = typeof body.tournamentId === "string" ? body.tournamentId : null;

  const network = await loadNear(admin, lat, lng, minutes, undefined, log);
  if ("error" in network) return fail(network.error, network.error === "server_error" ? 500 : 503);
  const { graph, source } = network;
  const { data: recent } = await admin.rpc("recent_route_edges", { p_user_id: userId, p_limit: 10 });

  const prefs = { avoidStairs: body.avoidStairs === true };
  const result = generateShapeRoutes(graph, {
    start: { latitude: lat, longitude: lng },
    shape,
    minutes,
    recent: (recent ?? []) as string[][],
    avoidStairs: prefs.avoidStairs,
    preferPaths: body.preferPaths === true,
  });
  // Checked again here, independently of the generator, before anything is stored or shown.
  const options = (result.ok ? result.options : []).filter((o) => {
    const problem = validateRoute(o, graph, prefs);
    if (problem) log("route_rejected", { problem });
    return !problem;
  });
  const outcome = result.ok ? (options.length ? "ok" : "no_feasible_route") : result.reason;
  const byId = new Map<string, NetworkEdge>(graph.edges.map((e) => [e.id, e]));
  const warningsOf = (ids: readonly string[]) => (source === "osm" ? routeWarnings(ids, byId) : []);
  const algorithm = source === "osm" ? `${result.algorithm}+${OSM_WALK_VERSION}` : result.algorithm;

  const { data: saved, error } = await admin.rpc("record_shape_route_request", {
    p_user_id: userId,
    p_tournament_id: tournamentId,
    p_shape_key: shape.key,
    p_minutes: minutes,
    p_start_node_id: source === "paws" ? options[0]?.startNodeId ?? null : null,
    p_outcome: outcome,
    p_algorithm: algorithm,
    p_candidates: options.map((o) => ({
      source,
      edgeIds: o.edgeIds,
      forward: o.steps.map((s) => s.forward),
      lengthM: o.lengthM,
      minutes: o.minutes,
      loop: o.loop,
      shapeScore: o.shapeScore,
      estimate: o.estimate,
      backtrack: o.backtrack,
      recentOverlap: Math.round(o.recentOverlap * 1000) / 1000,
      warnings: warningsOf(o.edgeIds),
    })),
  });
  if (error) {
    log("routes_record_failed", { message: error.message });
    return fail("server_error", 500);
  }
  const ids = ((saved as { candidateIds?: string[] })?.candidateIds ?? []) as string[];
  const used = new Set(options.flatMap((o) => o.edgeIds));
  const regions = new Set(graph.edges.filter((e) => used.has(e.id)).map((e) => (e as NetworkEdge).regionId));
  return json({
    ok: true,
    outcome,
    algorithm,
    source,
    limited: result.ok ? options.length < ROUTE_RULES.maxOptions : false,
    options: options.map((o, i) => ({
      candidateId: ids[i],
      path: o.path,
      lengthM: Math.round(o.lengthM),
      minutes: o.minutes,
      loop: o.loop,
      // Estimated from the route's own geometry. Only a completed, checked GPS walk gets an official score.
      estimate: o.estimate,
      recentOverlap: o.recentOverlap,
      warnings: warningsOf(o.edgeIds),
    })),
    // Where the paths come from, with the licence and attribution to show.
    sources: source === "osm" ? network.sources : network.sources.filter((s) => regions.has(s.regionId)),
  });
};

/** The service-role database functions, the network loader, the clock and server randomness, for numberService.ts. */
const numberDeps = (admin: SupabaseClient): NumberDeps => ({
  rpc: async <T>(name: string, args: Record<string, unknown>) => {
    const { data, error } = await admin.rpc(name, args);
    if (error) throw new StoreError(error.message.match(/[a-z]+(?:_[a-z]+)+/)?.[0] ?? "server_error");
    return data as T;
  },
  loadNetwork: async (lat, lng, minutes, radiusM) => {
    const network = await loadNear(admin, lat, lng, minutes, radiusM, log);
    if ("error" in network) return network;
    return { graph: network.graph as PedGraph, source: network.source, sources: network.sources };
  },
  now: Date.now,
  random: () => {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] / 4294967296;
  },
  sha256: async (text) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, "0")).join(""),
  log,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("method_not_allowed", 405);
  const auth = req.headers.get("Authorization");
  if (!auth) return fail("unauthorized", 401);
  const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: who } = await caller.auth.getUser();
  const userId = who?.user?.id;
  if (!userId) return fail("unauthorized", 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("bad_request");
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  try {
    switch (body.action) {
      case "overview":
        return await overview(admin, userId);
      case "leaderboard":
        return await leaderboard(admin, userId, body);
      case "start":
        return await start(admin, userId, body);
      case "append":
        return await append(admin, userId, body);
      case "state":
        return await setState(admin, userId, body);
      case "cancel":
        return await cancel(admin, userId, body);
      case "submit":
        return await submit(admin, userId, body);
      case "routes":
        return await routes(admin, userId, body);
      case "number_prepare":
      case "number_walk":
      case "number_progress":
      case "number_finish":
      case "number_state": {
        const reply = await NUMBER_ACTIONS[body.action as NumberAction](numberDeps(admin), userId, body);
        return json(reply.body, reply.status);
      }
      case "number_find":
      case "number_practice_begin":
      case "number_practice_progress":
      case "number_practice_finish":
      case "number_online_prepare":
      case "number_online_match":
      case "number_online_checkin": {
        const reply = await PLAY_ACTIONS[body.action as PlayAction](numberDeps(admin), userId, body);
        return json(reply.body, reply.status);
      }
      case "number_discover":
      case "number_routes": {
        const reply = await DISCOVERY_ACTIONS[body.action as DiscoveryAction](numberDeps(admin), userId, body);
        return json(reply.body, reply.status);
      }
      default:
        return fail("unknown_action");
    }
  } catch (error) {
    log("unhandled", { action: body.action, message: error instanceof Error ? error.message : String(error) });
    return fail("server_error", 500);
  }
});
