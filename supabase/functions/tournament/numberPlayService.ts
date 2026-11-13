import { planAppend, summarizeTrack, type SessionRow, type TrackPoint } from "./geo.ts";
import { findNumberRoutes, type NumberPlan } from "./numberRoutes.ts";
import { MATCH_RULES, buildCourse, courseView, ownProgress, verifyRace, type NumberCourse } from "./numberMatch.ts";
import { parseTargetNumber } from "./numberInput.ts";
import { EQUIVALENCE_RULES, matchCourses, metricsOf, type Candidate } from "./numberEquivalence.ts";
import { isUuid, no, ok, refusal, type NumberDeps, type Reply } from "./numberService.ts";
import type { Segment } from "./digits.ts";

/**
 * Number Trail phases P1 to P3 on the server: finding courses for one number, private practice walks, and cross-city
 * races. Same dependencies and rules as numberService.ts; the database records and re-checks what matters.
 *
 *   number_find             one radius per request, nearest first; the phone steps 500 m, 1 km, 2 km (3 km on consent)
 *   number_practice_begin   start a private walk on one of your candidates
 *   number_practice_progress / number_practice_finish   points in; the server's own check out (never official)
 *   number_online_prepare   an online player searches their own streets for the race's number at its target length
 *   number_online_match     host: one course per player, equivalent, verified again by the database
 *   number_online_checkin   you are at your own start (checked, not stored)
 */

/** Radii the phone may ask for. 3 km is the most the store keeps, and the most a search goes without asking. */
export const SEARCH_RADII = [500, 1_000, 2_000, 3_000] as const;
const ONLINE_CANDIDATES = 12;

type Found = { plans: NumberPlan[]; graph: Parameters<typeof buildCourse>[1]; source: "paws" | "osm"; sources: unknown[] } | { error: string };

/** The network at this radius, then the finder. A missing network or a provider failure is an error, never "nothing". */
const search = async (deps: NumberDeps, o: { lat: number; lng: number; number: string; radiusM: number; targetM?: number; bandShare?: number; exact?: boolean; alternatives: number }): Promise<Found & { reason?: string; ms?: number }> => {
  const network = await deps.loadNetwork(o.lat, o.lng, 25, o.radiusM);
  if ("error" in network) return { error: network.error };
  const t0 = deps.now();
  const r = findNumberRoutes(network.graph, {
    start: { latitude: o.lat, longitude: o.lng },
    number: o.number,
    radiusM: o.radiusM,
    targetM: o.targetM,
    bandShare: o.bandShare,
    exact: o.exact,
    alternatives: o.alternatives,
    deadlineAt: t0 + (deps.planBudgetMs ?? MATCH_RULES.planBudgetMs),
    clock: deps.now,
  });
  const ms = deps.now() - t0;
  deps.log("number_find", { number: o.number, radiusM: o.radiusM, ms, plans: r.plans.length, reason: r.reason ?? "ok", frames: r.stats.frames, truncated: r.stats.truncated ?? false });
  return { plans: r.plans, graph: network.graph, source: network.source, sources: network.sources, reason: r.reason ?? undefined, ms };
};

const readPosition = (body: Record<string, unknown>) => {
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
};

const radiusOf = (body: Record<string, unknown>) => (SEARCH_RADII as readonly number[]).includes(Number(body.radiusM)) ? Number(body.radiusM) : null;

/** What the database kept: `index` points back into the list sent (a course whose lengths disagreed is skipped). */
type Stored = { candidates: { id: string; index: number; officialM: number; digitM: number[]; connectorM: number; finishM?: number; repeatedM: number }[]; skipped: number };

// ---------------------------------------------------------------------------------------------------------------
// Practice
// ---------------------------------------------------------------------------------------------------------------

/**
 * Finds courses for exactly the number asked, within one radius of the given point, nearest on foot first. Stores them
 * as this player's candidates (PostGIS measures each) and returns what the phone may draw: street polylines only.
 */
export const find = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  const parsed = parseTargetNumber(body.number);
  if (parsed.ok === false) return { status: 400, body: { ok: false, error: "bad_request", numberError: parsed.error } };
  const at = readPosition(body);
  const radiusM = radiusOf(body);
  if (!at || !radiusM) return no("bad_request");
  // 3 km only when the player asked to widen the search.
  if (radiusM > 2_000 && body.expand !== true) return no("bad_request");
  const minutes = Number(body.minutes);
  const targetM = [15, 25, 40].includes(minutes) ? Math.round(minutes * 60 * 1.1) : undefined;
  try {
    const r = await search(deps, { ...at, number: parsed.number, radiusM, targetM, bandShare: targetM ? 0.3 : undefined, alternatives: 5 });
    if ("error" in r) return no(r.error === "server_error" ? "server_error" : r.error);
    if (!r.plans.length) return ok({ found: false, number: parsed.number, radiusM, reason: r.reason ?? "no_number_routes", candidates: [] });
    const courses = r.plans.map((p) => buildCourse(p, r.graph, { startAtFirstDigit: true }));
    const stored = await deps.rpc<Stored>("number_store_candidates", {
      p_user_id: userId,
      p_purpose: "practice",
      p_match_id: null,
      p_number: parsed.number,
      p_candidates: courses.map((c, i) => ({ course: c, raceM: r.plans[i].raceM, approachM: r.plans[i].approachM })),
      p_radius_m: radiusM,
      p_source: r.source,
      p_sources: r.sources,
    });
    // Only what the database measured and kept is offered, with its official lengths.
    const offered = stored.candidates.map((k) => ({
      id: k.id,
      officialM: Math.round(k.officialM),
      digitM: k.digitM.map((m) => Math.round(m)),
      connectorM: Math.round(k.connectorM),
      approachM: r.plans[k.index].approachM,
      minutes: r.plans[k.index].minutes,
      readability: courses[k.index].digits.map((d) => d.readability ?? null),
      difficulty: courses[k.index].difficulty,
      course: courseView(courses[k.index]),
    }));
    return ok({ found: offered.length > 0, number: parsed.number, radiusM, candidates: offered, sources: r.sources });
  } catch (e) {
    return refusal(e);
  }
};

export const practiceBegin = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  if (!isUuid(body.candidateId)) return no("bad_request");
  try {
    const r = await deps.rpc<{ practiceId: string; sessionId: string; startedAt: string; number: string; course: NumberCourse; officialM: number }>("number_practice_begin", { p_user_id: userId, p_candidate_id: body.candidateId });
    return ok({ practiceId: r.practiceId, sessionId: r.sessionId, startedAt: r.startedAt, number: r.number, officialM: Math.round(r.officialM), course: r.course, serverNow: new Date(deps.now()).toISOString() });
  } catch (e) {
    return refusal(e);
  }
};

type PracticeContext = {
  practice: { id: string; status: "walking" | "finished" | "abandoned"; startedAt: string; number: string; officialM: number; result: Record<string, unknown> | null };
  course: NumberCourse;
  session: SessionRow | null;
  receivedLastMinute: number;
};

const practicePoints = async (deps: NumberDeps, practiceId: string, userId: string): Promise<TrackPoint[]> =>
  ((await deps.rpc<TrackPoint[]>("number_practice_points", { p_practice_id: practiceId, p_user_id: userId })) ?? []).map((p) => ({ ...p, seq: Number(p.seq), capturedAt: Number(p.capturedAt), accuracyM: p.accuracyM == null ? null : Number(p.accuracyM) }));

/** Stores checked points for a practice walk. */
const takePracticePoints = async (deps: NumberDeps, userId: string, practiceId: string, incoming: unknown): Promise<Reply | { ctx: PracticeContext; storedThrough: number }> => {
  const ctx = await deps.rpc<PracticeContext | null>("number_practice_context", { p_practice_id: practiceId, p_user_id: userId });
  if (!ctx || !ctx.session) return no("not_found");
  if (ctx.practice.status !== "walking") return no("session_closed");
  const now = deps.now();
  const plan = planAppend({
    session: ctx.session,
    userId,
    tournament: { status: "active", registrationOpensAt: ctx.practice.startedAt, startsAt: ctx.practice.startedAt, endsAt: new Date(Date.parse(ctx.practice.startedAt) + 3 * 3_600_000).toISOString() },
    incoming,
    receivedLastMinute: Number(ctx.receivedLastMinute) || 0,
    now,
  });
  if (plan.kind === "reject") return no(plan.error === "too_many" ? "slow_down" : plan.error === "window_closed" ? "session_closed" : "invalid_session");
  let storedThrough = ctx.session.last_seq;
  if (plan.rows.length) storedThrough = await deps.rpc<number>("number_store_points", { p_session_id: ctx.session.id, p_points: plan.rows });
  return { ctx, storedThrough };
};

/** What a practice walk shows: the same judgement as a race, with the parts still missing spelled out. */
const practiceResult = (points: TrackPoint[], course: NumberCourse, startedAt: string, nowMs: number) => {
  const v = verifyRace(points, course, { raceStartMs: Date.parse(startedAt), nowMs });
  const missing = v.progress.digits.flatMap((d, k) =>
    (Object.entries(d.segments) as [Segment, number][]).filter(([, share]) => share < 0.75).map(([segment, share]) => ({ digit: k + 1, segment, share })),
  );
  const track = summarizeTrack(points);
  return {
    verdict: v,
    result: {
      eligible: v.eligible,
      phase: v.phase,
      reasons: v.reasons,
      digits: v.progress.digits.map((d) => ({ digit: d.digit, coverage: d.coverage, complete: d.complete })),
      connector: course.digits.length > 1 ? { share: v.connector.share, valid: v.connector.valid } : null,
      finish: course.finish?.length ? { share: v.finish.share, reached: v.finish.reached, valid: v.finish.valid } : null,
      missing,
      walkedM: Math.round(track.distanceM),
      activeMs: track.activeMs,
      gps: { jumps: v.progress.flags.jumps, gapM: v.progress.flags.gapM, ignored: v.progress.flags.ignored, points: points.length },
      atStart: v.startSeq != null,
      version: v.version,
    },
  };
};

export const practiceProgress = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  if (!isUuid(body.practiceId)) return no("bad_request");
  try {
    const taken = await takePracticePoints(deps, userId, body.practiceId, body.points);
    if ("status" in taken) return taken;
    const points = await practicePoints(deps, body.practiceId, userId);
    const { verdict } = practiceResult(points, taken.ctx.course, taken.ctx.practice.startedAt, deps.now());
    return ok({ storedThrough: taken.storedThrough, phase: verdict.phase, progress: ownProgress(verdict) });
  } catch (e) {
    return refusal(e);
  }
};

export const practiceFinish = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  if (!isUuid(body.practiceId)) return no("bad_request");
  try {
    if (Array.isArray(body.points) && body.points.length) {
      const taken = await takePracticePoints(deps, userId, body.practiceId, body.points);
      if ("status" in taken && taken.body.error !== "session_closed") return taken;
    }
    const ctx = await deps.rpc<PracticeContext | null>("number_practice_context", { p_practice_id: body.practiceId, p_user_id: userId });
    if (!ctx) return no("not_found");
    // Finished already: the first result stands.
    if (ctx.practice.status === "finished") return ok({ practiceId: ctx.practice.id, number: ctx.practice.number, officialM: Math.round(ctx.practice.officialM), result: ctx.practice.result, repeated: true });
    const points = await practicePoints(deps, body.practiceId, userId);
    const { result } = practiceResult(points, ctx.course, ctx.practice.startedAt, deps.now());
    const saved = await deps.rpc<{ result: Record<string, unknown>; startedAt: string; finishedAt: string }>("number_practice_finish", { p_practice_id: body.practiceId, p_user_id: userId, p_verified: result.eligible, p_result: result });
    return ok({ practiceId: ctx.practice.id, number: ctx.practice.number, officialM: Math.round(ctx.practice.officialM), result: saved.result, startedAt: saved.startedAt, finishedAt: saved.finishedAt, repeated: false });
  } catch (e) {
    return refusal(e);
  }
};

// ---------------------------------------------------------------------------------------------------------------
// Online
// ---------------------------------------------------------------------------------------------------------------

type OnlineState = {
  match: { status: string; number: string | null };
  me: { isHost: boolean };
  online: { requestedNumber: string | null; targetM: number; bandShare: number; spreadShare: number; ranked: boolean } | null;
};

/**
 * An online player searches their own streets for the race's number at its target length (± the band). Their position
 * is used for the search and not stored; the race keeps only courses and their PostGIS lengths.
 */
export const onlinePrepare = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  const at = readPosition(body);
  const radiusM = radiusOf(body) ?? 2_000;
  if (!isUuid(body.matchId) || !at || (radiusM > 2_000 && body.expand !== true)) return no("bad_request");
  try {
    const state = await deps.rpc<OnlineState>("number_race_state", { p_match_id: body.matchId, p_after_seq: 0, p_user_id: userId });
    if (!state.online) return no("wrong_game");
    if (state.match.status !== "course_search") return no("match_not_editable");
    const number = state.online.requestedNumber;
    // The number comes first (the host picks it from what everyone can walk).
    if (!number) return no("match_not_ready");
    const r = await search(deps, { ...at, number, radiusM, targetM: state.online.targetM, bandShare: state.online.bandShare, exact: true, alternatives: ONLINE_CANDIDATES });
    if ("error" in r || !r.plans.length) {
      const reason = "error" in r ? r.error : r.reason ?? "no_number_routes";
      await deps.rpc("number_online_search_failed", { p_match_id: body.matchId, p_user_id: userId, p_reason: reason });
      return ok({ found: false, reason, radiusM });
    }
    const stored = await deps.rpc<Stored>("number_store_candidates", {
      p_user_id: userId,
      p_purpose: "online",
      p_match_id: body.matchId,
      p_number: number,
      p_candidates: r.plans.map((p) => ({ course: buildCourse(p, r.graph, { startAtFirstDigit: true }), raceM: p.raceM, approachM: p.approachM })),
      p_radius_m: radiusM,
      p_source: r.source,
      p_sources: r.sources,
    });
    return ok({ found: stored.candidates.length > 0, candidates: stored.candidates.length, radiusM });
  } catch (e) {
    return refusal(e);
  }
};

/** Host: one course per player, equivalent under the documented rules; the database checks distances again. */
export const onlineMatch = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  if (!isUuid(body.matchId)) return no("bad_request");
  try {
    const state = await deps.rpc<OnlineState>("number_race_state", { p_match_id: body.matchId, p_after_seq: 0, p_user_id: userId });
    if (!state.me.isHost) return no("not_the_host");
    if (!state.online) return no("wrong_game");
    const data = await deps.rpc<{ players: string[]; candidates: { id: string; userId: string; course: NumberCourse; officialM: number; digitM: number[]; connectorM: number; finishM?: number; repeatedM: number }[] }>("number_online_candidates", { p_match_id: body.matchId });
    // Metrics from the PostGIS lengths, so the comparison and the database's check agree.
    const candidates: Candidate[] = data.candidates.map((c) => ({
      id: c.id,
      userId: c.userId,
      metrics: { ...metricsOf(c.course, c.officialM), digitM: c.digitM, connectorM: c.connectorM, finishM: c.finishM ?? 0, repeatedM: c.repeatedM },
    }));
    const rules = { ...EQUIVALENCE_RULES, spreadShare: state.online.spreadShare, bandShare: state.online.bandShare };
    const outcome = matchCourses(data.players, candidates, state.online.targetM, rules);
    const picks = outcome.ok === true ? data.players.map((u) => ({ userId: u, candidateId: outcome.picks[u].id })) : [];
    const equivalence = outcome.ok === true ? outcome.equivalence : outcome.ok === false ? { ...(outcome.best ?? {}), status: outcome.reason } : null;
    const recorded = await deps.rpc<{ matched: boolean; status: string; spreadM: number; toleranceM: number }>("number_record_online_match", { p_match_id: body.matchId, p_picks: picks, p_equivalence: equivalence });
    return ok({ ...recorded, missing: outcome.ok === false ? outcome.missing : [], checks: (equivalence as { checks?: unknown } | null)?.checks ?? [] });
  } catch (e) {
    return refusal(e);
  }
};

export const onlineCheckin = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  const at = readPosition(body);
  const accuracyM = Number(body.accuracyM);
  if (!isUuid(body.matchId) || !at || !Number.isFinite(accuracyM)) return no("bad_request");
  try {
    const r = await deps.rpc<{ atStart: boolean; reason?: string; distanceM?: number }>("number_online_checkin", { p_match_id: body.matchId, p_user_id: userId, p_latitude: at.lat, p_longitude: at.lng, p_accuracy_m: accuracyM });
    return ok(r);
  } catch (e) {
    return refusal(e);
  }
};

export const PLAY_ACTIONS = {
  number_find: find,
  number_practice_begin: practiceBegin,
  number_practice_progress: practiceProgress,
  number_practice_finish: practiceFinish,
  number_online_prepare: onlinePrepare,
  number_online_match: onlineMatch,
  number_online_checkin: onlineCheckin,
} as const;
export type PlayAction = keyof typeof PLAY_ACTIONS;
