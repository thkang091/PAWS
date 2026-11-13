import { planAppend, type SessionRow, type TrackPoint } from "./geo.ts";
import type { PedGraph } from "./routes.ts";
import { NUMBER_ALGORITHM, NUMBER_RULES, chooseNumber, numberStartNode, planNumberRoutes, validateNumberPlan, type NumberPlan } from "./numberRoutes.ts";
import { MATCH_RULES, MATCH_VERSION, buildCourse, courseProblem, courseView, digitsDone, isRacing, ownProgress, publicProgress, trackFingerprint, verifyRace, type MatchStatus, type NumberCourse, type RaceVerdict } from "./numberMatch.ts";
import { RECOVERABLE_FINISH, httpOf, toErrorCode, type FinishRejection, type NumberErrorCode } from "./numberContract.ts";
import type { Difficulty } from "./digits.ts";

/**
 * Number Trail race service (Phase N2): what the `tournament` edge function does for a Number Trail match. Written
 * against a single `rpc` dependency (the service-role database functions of 20270107120000_number_trail.sql), so the
 * same code runs in Deno on Supabase and, in tests, against a local PostgreSQL + PostGIS cluster. No Deno or Node
 * globals here; the caller passes the clock, randomness and hashing.
 *
 * The database owns order and state; this owns judgement. Nothing a phone says about progress, completion, time or
 * rank is used: only stored points, the stored course and the database clock's start time.
 */

export class StoreError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export type Rpc = <T>(name: string, args: Record<string, unknown>) => Promise<T>;

export type NetworkResult = { graph: PedGraph; source: "paws" | "osm"; sources: unknown[] } | { error: string };

export type NumberDeps = {
  rpc: Rpc;
  /** The real pedestrian network around a point: for a walking time, or (exact-number searches) a radius. */
  loadNetwork: (latitude: number, longitude: number, minutes: number, radiusM?: number) => Promise<NetworkResult>;
  now: () => number;
  /** Uniform in [0, 1); cryptographic on the server. */
  random: () => number;
  sha256: (text: string) => Promise<string>;
  log: (event: string, detail?: Record<string, unknown>) => void;
  /** Planning stops this many milliseconds in (default MATCH_RULES.planBudgetMs). */
  planBudgetMs?: number;
};

export type Reply = { status: number; body: Record<string, unknown> };

export const ok = (body: Record<string, unknown>): Reply => ({ status: 200, body: { ok: true, ...body } });
export const no = (code: NumberErrorCode | string, status?: number): Reply => {
  const error = toErrorCode(code);
  return { status: status ?? httpOf(error), body: { ok: false, error } };
};
/** A database refusal becomes its API code; anything unexpected is a server error. */
export const refusal = (e: unknown): Reply => (e instanceof StoreError ? no(e.code) : no("server_error", 500));

export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Same network, same edges: a cache key part that changes whenever the stored network changes. */
export const networkFingerprint = (graph: PedGraph, sha256: (t: string) => Promise<string>) =>
  sha256(
    [...graph.edges]
      .map((e) => `${e.id}:${e.a}:${e.b}:${Math.round(e.lengthM * 10)}`)
      .sort()
      .join("|"),
  );

export const planCacheKey = (fingerprint: string, startNodeId: string, minutes: number, avoidStairs: boolean) =>
  // "singles": plan sets that include single-digit numbers (older cached sets don't, so they aren't reused).
  [NUMBER_ALGORITHM, MATCH_VERSION, "singles", fingerprint, startNodeId, minutes, avoidStairs ? "no-stairs" : "any"].join("|");

// ---------------------------------------------------------------------------------------------------------------
// Prepare: draw a feasible number and store the shared course
// ---------------------------------------------------------------------------------------------------------------

type Begin = { token: string; minutes: number; difficulty: Difficulty | null; previousNumber: string | null };

export const prepare = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  if (!isUuid(body.matchId) || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return no("bad_request");
  const matchId = body.matchId;
  const avoidStairs = body.avoidStairs === true;

  let begin: Begin;
  try {
    begin = await deps.rpc<Begin>("number_begin_prepare", { p_match_id: matchId, p_user_id: userId });
  } catch (e) {
    return refusal(e);
  }
  const failed = async (reason: string) => {
    try {
      await deps.rpc("number_prepare_failed", { p_match_id: matchId, p_token: begin.token, p_reason: reason });
    } catch (e) {
      deps.log("number_prepare_failed_failed", { reason, code: e instanceof StoreError ? e.code : "unknown" });
    }
    return no(reason);
  };

  try {
    const network = await deps.loadNetwork(lat, lng, begin.minutes);
    if ("error" in network) return await failed(network.error === "server_error" ? "server_error" : network.error);
    const { graph } = network;
    const start = { latitude: lat, longitude: lng };
    const junction = numberStartNode(graph, { start, minutes: begin.minutes, avoidStairs });
    if ("reason" in junction) return await failed(junction.reason);

    const fingerprint = await networkFingerprint(graph, deps.sha256);
    const key = planCacheKey(fingerprint, junction.nodeId, begin.minutes, avoidStairs);
    const cached = await deps.rpc<{ outcome: string; plans: NumberPlan[] } | null>("number_plan_cache_get", { p_key: key });
    let plans: NumberPlan[];
    let planMs = 0;
    if (cached) {
      plans = cached.plans;
    } else {
      const t0 = deps.now();
      const result = planNumberRoutes(graph, { start, minutes: begin.minutes, avoidStairs, deadlineAt: t0 + (deps.planBudgetMs ?? MATCH_RULES.planBudgetMs), clock: deps.now });
      planMs = deps.now() - t0;
      deps.log("number_planned", { ms: planMs, outcome: result.reason ?? "ok", plans: result.plans.length, frames: result.stats.frames, truncated: result.stats.truncated ?? false });
      // A timeout is not an answer about these streets: never cached, the host may try again.
      if (result.reason === "timeout") return await failed("preparation_timeout");
      plans = result.plans;
      await deps.rpc("number_plan_cache_put", {
        p_key: key,
        p_fingerprint: fingerprint,
        p_start_node_id: junction.nodeId,
        p_minutes: begin.minutes,
        p_algorithm: NUMBER_ALGORITHM,
        p_outcome: result.ok ? "ok" : result.reason,
        p_plans: plans,
        p_stats: result.stats,
        p_sources: network.sources,
        p_hours: plans.length ? 72 : 6,
      });
    }
    if (!plans.length) return await failed("no_number_routes");

    let pool = plans.filter((p) => !begin.difficulty || p.difficulty === begin.difficulty);
    if (!pool.length) return await failed("no_routes_for_difficulty");
    // "New number" draws a different one when there is another to draw.
    if (begin.previousNumber && pool.some((p) => p.number !== begin.previousNumber)) pool = pool.filter((p) => p.number !== begin.previousNumber);

    // Uniform over feasible numbers, then checked again against the network as it is now.
    let plan: NumberPlan | null = null;
    for (let tries = 0; tries < 3 && pool.length; tries++) {
      const pick = chooseNumber(pool, deps.random, begin.difficulty);
      if (!pick) break;
      const problem = validateNumberPlan(pick, graph, NUMBER_RULES, { avoidStairs });
      if (!problem) {
        plan = pick;
        break;
      }
      deps.log("number_plan_rejected", { problem });
      pool = pool.filter((p) => p !== pick);
    }
    if (!plan) return await failed("no_number_routes");

    const course = buildCourse(plan, graph);
    const summary = {
      source: network.source,
      layout: plan.layout,
      headingDeg: plan.headingDeg,
      raceM: plan.raceM,
      approachM: plan.approachM,
      connectorM: plan.connectorM,
      digitM: plan.digitM,
      minutes: plan.minutes,
      difficulty: plan.difficulty,
      cached: Boolean(cached),
      planMs,
    };
    await deps.rpc("number_record_course", {
      p_match_id: matchId,
      p_token: begin.token,
      p_course: course,
      p_summary: summary,
      p_sources: network.sources,
      p_fingerprint: fingerprint,
      p_feasible: new Set(pool.map((p) => p.number)).size,
    });
    return ok({ number: plan.number, course: courseView(course), feasible: new Set(pool.map((p) => p.number)).size, cached: Boolean(cached) });
  } catch (e) {
    deps.log("number_prepare_error", { code: e instanceof StoreError ? e.code : e instanceof Error ? e.message : "unknown" });
    if (e instanceof StoreError && e.code === "stale_preparation") return no("preparation_in_progress");
    return await failed("server_error");
  }
};

// ---------------------------------------------------------------------------------------------------------------
// Walks and progress
// ---------------------------------------------------------------------------------------------------------------

export const startWalk = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  if (!isUuid(body.matchId)) return no("bad_request");
  try {
    const walk = await deps.rpc<{ sessionId: string; lastSeq: number; status: string; resumed: boolean }>("number_begin_walk", { p_match_id: body.matchId, p_user_id: userId });
    return ok({ sessionId: walk.sessionId, lastSeq: walk.lastSeq, resumed: walk.resumed, serverNow: new Date(deps.now()).toISOString() });
  } catch (e) {
    return refusal(e);
  }
};

type Context = {
  match: { id: string; status: MatchStatus; roomId: string; countdownAt: string | null; startsAt: string | null; endsAt: string | null; number: string | null };
  assignment: { status: "racing" | "finished" | "left"; sessionId: string | null } | null;
  member: boolean;
  session: SessionRow | null;
  receivedLastMinute: number;
  progress: { version: number; verifiedAt: string | null; digitsDone: number; throughSeq: number } | null;
};

type Stored = { seq: number; segment: number; latitude: number; longitude: number; accuracyM: number | null; capturedAt: number };

/**
 * The caller's stored points. `receivedBy` is a database time (a finish receipt); null means everything stored so far.
 * Never this function's own clock: it may run behind the database, and the batch just stored would be left out.
 */
const loadPoints = async (deps: NumberDeps, matchId: string, userId: string, receivedBy: string | null): Promise<TrackPoint[]> => {
  const rows = await deps.rpc<Stored[]>("number_points", { p_match_id: matchId, p_user_id: userId, p_received_by: receivedBy });
  return (rows ?? []).map((p) => ({ seq: Number(p.seq), segment: Number(p.segment), latitude: Number(p.latitude), longitude: Number(p.longitude), accuracyM: p.accuracyM == null ? null : Number(p.accuracyM), capturedAt: Number(p.capturedAt) }));
};

/** The course this player is judged on: the shared course nearby, their own online. */
const loadCourse = async (deps: NumberDeps, matchId: string, userId: string) => {
  const row = await deps.rpc<{ course: NumberCourse; startsAt: string; endsAt: string; status: MatchStatus } | null>("number_course", { p_match_id: matchId, p_user_id: userId });
  if (!row || courseProblem(row.course)) throw new StoreError("match_not_ready");
  return row;
};

/** Checks the caller's points and stores the good ones. Returns an error reply, or what was stored. */
const takePoints = async (deps: NumberDeps, userId: string, matchId: string, incoming: unknown, now: number): Promise<Reply | { ctx: Context; storedThrough: number; dropped: number }> => {
  const ctx = await deps.rpc<Context | null>("number_walk_context", { p_match_id: matchId, p_user_id: userId });
  if (!ctx) return no("match_not_found");
  if (!ctx.assignment) return no("not_in_match");
  if (!ctx.member || ctx.assignment.status === "left") return no("not_in_room");
  if (!ctx.session) return no("no_walk");
  if (!ctx.match.countdownAt || !ctx.match.endsAt) return no("match_not_active");
  const plan = planAppend({
    session: ctx.session,
    userId,
    tournament: {
      status: ctx.match.status === "cancelled" ? "cancelled" : "active",
      registrationOpensAt: ctx.match.countdownAt,
      startsAt: ctx.match.countdownAt,
      endsAt: ctx.match.endsAt,
    },
    incoming,
    receivedLastMinute: Number(ctx.receivedLastMinute) || 0,
    now,
  });
  if (plan.kind === "reject") {
    const map = { not_found: "invalid_session", session_closed: "session_closed", too_many: "slow_down", window_closed: "match_over" } as const;
    return no(map[plan.error]);
  }
  let storedThrough = ctx.session.last_seq;
  if (plan.rows.length) storedThrough = await deps.rpc<number>("number_store_points", { p_session_id: ctx.session.id, p_points: plan.rows });
  return { ctx, storedThrough, dropped: plan.dropped };
};

// Averaged over the number's own digits (one for 0 to 9, two otherwise).
const coverageOf = (v: RaceVerdict) => Math.round((v.progress.digits.reduce((n, d) => n + d.coverage, 0) / Math.max(1, v.progress.digits.length)) * 1000) / 1000;

const recordProgress = (deps: NumberDeps, matchId: string, userId: string, v: RaceVerdict) =>
  deps.rpc<{ version: number; recorded: boolean; phase?: string }>("number_record_progress", {
    p_match_id: matchId,
    p_user_id: userId,
    p_phase: v.phase,
    p_digits_done: digitsDone(v.progress),
    p_coverage: coverageOf(v),
    p_public: publicProgress(v),
    p_own: ownProgress(v),
    p_through_seq: v.throughSeq,
  });

export const progress = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  if (!isUuid(body.matchId)) return no("bad_request");
  const matchId = body.matchId;
  const now = deps.now();
  try {
    const taken = await takePoints(deps, userId, matchId, body.points, now);
    if ("status" in taken) return taken;
    const { ctx, storedThrough, dropped } = taken;
    const started = ctx.match.startsAt != null && now >= Date.parse(ctx.match.startsAt);
    const racing = isRacing(ctx.match.status) || (ctx.match.status === "countdown" && started);
    const last = ctx.progress?.verifiedAt ? Date.parse(ctx.progress.verifiedAt) : 0;
    if (!racing || ctx.assignment!.status !== "racing" || now - last < MATCH_RULES.verifyEveryMs) {
      return ok({ storedThrough, dropped, verified: false, matchStatus: ctx.match.status, nextCheckInMs: Math.max(0, MATCH_RULES.verifyEveryMs - (now - last)) });
    }
    const { course, startsAt } = await loadCourse(deps, matchId, userId);
    const points = await loadPoints(deps, matchId, userId, null);
    const verdict = verifyRace(points, course, { raceStartMs: Date.parse(startsAt), nowMs: now });
    const recorded = await recordProgress(deps, matchId, userId, verdict);
    return ok({ storedThrough, dropped, verified: true, matchStatus: ctx.match.status, phase: recorded.phase ?? verdict.phase, progress: ownProgress(verdict) });
  } catch (e) {
    return refusal(e);
  }
};

// ---------------------------------------------------------------------------------------------------------------
// Finishing
// ---------------------------------------------------------------------------------------------------------------

type AttemptRow = { id: string; status: "pending" | "verified" | "rejected" | "expired"; reason: string | null; receipt_seq: number; received_at: string; finish_order: number | null; repeated: boolean; startsAt: string };
type Settled = { attemptId: string; status: AttemptRow["status"]; reason: string | null; finishOrder: number | null; placement: number | null; matchStatus: MatchStatus; winnerUserId: string | null; waitingOnEarlier: number };

const settledReply = (s: { status: AttemptRow["status"]; reason: string | null; finishOrder: number | null; placement?: number | null; waitingOnEarlier?: number }, repeated: boolean, extra: Record<string, unknown> = {}): Reply => {
  if (s.status === "verified" && s.finishOrder) return ok({ status: "finished", finishOrder: s.finishOrder, placement: s.placement ?? s.finishOrder, won: s.finishOrder === 1, repeated });
  if (s.status === "verified") return ok({ status: "verified_waiting", waitingOnEarlier: s.waitingOnEarlier ?? 0 });
  if (s.status === "pending") return ok({ status: "verifying" });
  const reason = (s.reason ?? "digit_two_incomplete") as FinishRejection;
  return ok({ status: "rejected", reason, recoverable: RECOVERABLE_FINISH.includes(reason), repeated, ...extra });
};

/** Judges a received finish on the points that had arrived by its receipt, then reports back to the database. */
const verifyAttempt = async (deps: NumberDeps, matchId: string, userId: string, attempt: { id: string; received_at: string }) => {
  const { course, startsAt } = await loadCourse(deps, matchId, userId);
  const receivedAt = Date.parse(attempt.received_at);
  const points = await loadPoints(deps, matchId, userId, attempt.received_at);
  const verdict = verifyRace(points, course, { raceStartMs: Date.parse(startsAt), nowMs: receivedAt });
  try {
    await recordProgress(deps, matchId, userId, verdict);
  } catch (e) {
    // The race may have just ended; the finish is still settled below.
    if (!(e instanceof StoreError)) throw e;
  }
  const counted = verdict.startSeq == null ? [] : points.filter((p) => p.seq >= verdict.startSeq!);
  const hash = verdict.eligible ? await deps.sha256(trackFingerprint(counted)) : null;
  const settled = await deps.rpc<Settled>("number_settle_finish", {
    p_attempt_id: attempt.id,
    p_verified: verdict.eligible,
    p_reason: verdict.eligible ? null : (verdict.reasons[0] ?? "digit_two_incomplete"),
    p_through_seq: verdict.throughSeq,
    p_track_hash: hash,
    p_verdict: { version: verdict.version, reasons: verdict.reasons, progress: publicProgress(verdict), connector: { share: verdict.connector.share, valid: verdict.connector.valid } },
  });
  return { settled, verdict };
};

export const finish = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  if (!isUuid(body.matchId) || typeof body.requestKey !== "string" || body.requestKey.length < 8 || body.requestKey.length > 80) return no("bad_request");
  const matchId = body.matchId;
  try {
    // The last points first, so the finish is judged on the whole walk.
    if (Array.isArray(body.points) && body.points.length) {
      const taken = await takePoints(deps, userId, matchId, body.points, deps.now());
      if ("status" in taken && taken.body.error !== "match_over") return taken;
    }
    const attempt = await deps.rpc<AttemptRow>("number_receive_finish", { p_match_id: matchId, p_user_id: userId, p_request_key: body.requestKey });
    if (attempt.status !== "pending") return settledReply({ status: attempt.status, reason: attempt.reason, finishOrder: attempt.finish_order }, true);
    if (attempt.repeated) {
      // Someone (the original request) is checking it; take over only if that check went quiet.
      const claimed = await deps.rpc<AttemptRow | null>("number_claim_verification", { p_attempt_id: attempt.id });
      if (!claimed) return ok({ status: "verifying" });
    }
    const { settled, verdict } = await verifyAttempt(deps, matchId, userId, attempt);
    return settledReply(settled, attempt.repeated, settled.status === "rejected" ? { progress: ownProgress(verdict) } : {});
  } catch (e) {
    return refusal(e);
  }
};

// ---------------------------------------------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------------------------------------------

/**
 * The canonical match for a reconnecting phone. Moves the match on by the database clock first, and finishes the
 * check of at most one finish whose original request went quiet, so a race never stalls on a lost connection.
 */
export const state = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  if (!isUuid(body.matchId)) return no("bad_request");
  const matchId = body.matchId;
  const afterSeq = Number.isInteger(body.afterSeq) && (body.afterSeq as number) >= 0 ? (body.afterSeq as number) : 0;
  try {
    // Membership first: the state function refuses outsiders, before anything is moved on.
    await deps.rpc("number_race_state", { p_match_id: matchId, p_after_seq: 0, p_user_id: userId });
    await deps.rpc("number_advance", { p_match_id: matchId });
    const stale = await deps.rpc<string[]>("number_stale_attempts", { p_match_id: matchId });
    for (const id of (stale ?? []).slice(0, 1)) {
      const claimed = await deps.rpc<(AttemptRow & { user_id: string }) | null>("number_claim_verification", { p_attempt_id: id });
      if (claimed) await verifyAttempt(deps, matchId, claimed.user_id, claimed);
    }
    const view = await deps.rpc<Record<string, unknown>>("number_race_state", { p_match_id: matchId, p_after_seq: afterSeq, p_user_id: userId });
    return ok(view);
  } catch (e) {
    return refusal(e);
  }
};

export const NUMBER_ACTIONS = {
  number_prepare: prepare,
  number_walk: startWalk,
  number_progress: progress,
  number_finish: finish,
  number_state: state,
} as const;

export type NumberAction = keyof typeof NUMBER_ACTIONS;
