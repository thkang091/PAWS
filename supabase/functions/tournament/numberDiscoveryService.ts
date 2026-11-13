import { buildCourse, courseView } from "./numberMatch.ts";
import { DISCOVERY_RADII, DISCOVERY_VERSION, discoverNumbers, discoveryStartNode, listNumberRoutes, mergeDiscovery, routeIdOf, type DiscoveryResult } from "./numberDiscovery.ts";
import { MATCH_RULES } from "./numberMatch.ts";
import { isUuid, networkFingerprint, no, ok, refusal, type NumberDeps, type Reply } from "./numberService.ts";
import type { PedGraph } from "./routes.ts";
import type { EdgeWarning } from "./osm.ts";

/**
 * Location-first Number Trail on the server (phases L1 and L2):
 *
 *   number_discover   which numbers from 0 to 99 can be walked near a point. Cached by public network data only
 *                     (network fingerprint, public start junction, radius). With `matchId`, also recorded for an online
 *                     race as this player's walkable numbers (no position). A scan the deadline cut short says which
 *                     numbers are still unchecked; asking again continues it.
 *   number_routes     every distinct verified route for one number near a point, nearest on foot first, a page at a
 *                     time. Each is stored as this player's candidate with its PostGIS length; the phone starts a walk
 *                     by candidate id and never sends geometry.
 *
 * The point is used for the search and not stored. A manual point (picked on the map) is labelled as such.
 */

const radiusOf = (v: unknown) => ((DISCOVERY_RADII as readonly number[]).includes(Number(v)) ? Number(v) : null);
const positionOf = (body: Record<string, unknown>) => {
  const lat = Number(body.latitude);
  const lng = Number(body.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { latitude: lat, longitude: lng } : null;
};

const view = (r: DiscoveryResult, extra: Record<string, unknown>) => ({
  version: r.version,
  radiusM: r.radiusM,
  checkedRadiusM: r.checkedRadiusM,
  partial: r.partial,
  reason: r.reason,
  numbers: r.numbers,
  available: r.available,
  ...extra,
});

export const discover = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  const at = positionOf(body);
  const radiusM = radiusOf(body.radiusM);
  if (!at || !radiusM) return no("bad_request");
  // 3 km only when the player asked for a wider search.
  if (radiusM > 2_000 && body.expand !== true) return no("bad_request");
  const manual = body.manual === true;
  const matchId = body.matchId == null ? null : isUuid(body.matchId) ? body.matchId : undefined;
  if (matchId === undefined) return no("bad_request");
  try {
    const network = await deps.loadNetwork(at.latitude, at.longitude, 25, radiusM);
    if ("error" in network) {
      // The streets couldn't be loaded: nothing was checked. Never "not found".
      return ok({ version: DISCOVERY_VERSION, radiusM, checkedRadiusM: 0, partial: true, reason: network.error, failed: true, numbers: [], available: [], manual, cached: false });
    }
    const graph = network.graph as PedGraph;
    const startNode = discoveryStartNode(graph, at);
    const fingerprint = await networkFingerprint(graph, deps.sha256);
    const key = startNode ? `${DISCOVERY_VERSION}:${fingerprint.slice(0, 32)}:${startNode}:${radiusM}` : null;
    const cached = key ? await deps.rpc<{ result: DiscoveryResult; partial: boolean } | null>("number_discovery_get", { p_key: key }) : null;
    let result: DiscoveryResult;
    let fromCache = false;
    const t0 = deps.now();
    if (cached && !cached.partial) {
      result = cached.result;
      fromCache = true;
    } else {
      const deadlineAt = t0 + (deps.planBudgetMs ?? MATCH_RULES.planBudgetMs);
      const only = cached?.partial ? cached.result.numbers.filter((n) => n.status === "NOT_YET_CHECKED").map((n) => n.number) : undefined;
      const fresh = discoverNumbers(graph, { start: at, radiusM, deadlineAt, clock: deps.now, only });
      result = cached?.partial ? mergeDiscovery(cached.result, fresh) : fresh;
      if (key && !result.reason) await deps.rpc("number_discovery_put", { p_key: key, p_result: result, p_partial: result.partial });
    }
    deps.log("number_discover", { radiusM, ms: deps.now() - t0, cached: fromCache, available: result.available.length, partial: result.partial, checkedRadiusM: result.checkedRadiusM });
    if (matchId) await deps.rpc("number_online_store_availability", { p_match_id: matchId, p_user_id: userId, p_result: result, p_manual: manual });
    return ok(view(result, { manual, cached: fromCache, source: network.source, sources: network.sources }));
  } catch (e) {
    return refusal(e);
  }
};

/** Pedestrian notes on a route's streets (from the network), each once. */
const warningsOf = (graph: PedGraph, edgeIds: readonly string[]) => {
  const byId = new Map(graph.edges.map((e) => [e.id, e as PedGraph["edges"][number] & { warnings?: EdgeWarning[] }]));
  return [...new Set(edgeIds.flatMap((id) => byId.get(id)?.warnings ?? []))].sort();
};

export const routes = async (deps: NumberDeps, userId: string, body: Record<string, unknown>): Promise<Reply> => {
  const at = positionOf(body);
  const radiusM = radiusOf(body.radiusM);
  const number = typeof body.number === "string" ? body.number : "";
  if (!at || !radiusM || !/^([0-9]|[1-9][0-9])$/.test(number)) return no("bad_request");
  if (radiusM > 2_000 && body.expand !== true) return no("bad_request");
  const after = Math.max(0, Math.min(200, Math.floor(Number(body.after) || 0)));
  try {
    const network = await deps.loadNetwork(at.latitude, at.longitude, 25, radiusM);
    if ("error" in network) return no(network.error === "server_error" ? "server_error" : network.error);
    const graph = network.graph as PedGraph;
    const t0 = deps.now();
    const r = listNumberRoutes(graph, { start: at, radiusM, number, after, deadlineAt: t0 + (deps.planBudgetMs ?? MATCH_RULES.planBudgetMs), clock: deps.now });
    deps.log("number_routes", { number, radiusM, after, ms: deps.now() - t0, found: r.plans.length, total: r.total, complete: r.complete });
    if (r.reason) return ok({ number, radiusM, routes: [], total: 0, complete: true, reason: r.reason, checkedRadiusM: r.checkedRadiusM });
    if (!r.plans.length) return ok({ number, radiusM, routes: [], total: r.total, complete: r.complete, reason: r.total ? null : "no_number_routes", checkedRadiusM: r.checkedRadiusM, after });
    const courses = r.plans.map((p) => buildCourse(p, graph, { startAtFirstDigit: true }));
    const stored = await deps.rpc<{ candidates: { id: string; index: number; routeKey: string; officialM: number; digitM: number[]; connectorM: number }[]; skipped: number }>("number_store_candidates", {
      p_user_id: userId,
      p_purpose: "practice",
      p_match_id: null,
      p_number: number,
      p_candidates: r.plans.map((p, i) => ({ course: courses[i], raceM: p.raceM, approachM: p.approachM, routeKey: routeIdOf(p) })),
      p_radius_m: radiusM,
      p_source: network.source,
      p_sources: network.sources,
    });
    // Only what the database measured and kept is offered, with its official length.
    const offered = stored.candidates.map((k) => {
      const plan = r.plans[k.index];
      return {
        id: k.id,
        routeKey: k.routeKey,
        officialM: Math.round(k.officialM),
        digitM: k.digitM.map((m) => Math.round(m)),
        connectorM: Math.round(k.connectorM),
        approachM: plan.approachM,
        minutes: plan.minutes,
        readability: plan.digits.map((d) => d.readability),
        difficulty: plan.difficulty,
        layout: plan.layout,
        warnings: warningsOf(graph, plan.legs.filter((l) => l.part !== "approach").map((l) => l.edgeId)),
        course: courseView(courses[k.index]),
      };
    });
    return ok({ number, radiusM, routes: offered, total: r.total, complete: r.complete, reason: null, checkedRadiusM: r.checkedRadiusM, after, nextAfter: after + r.plans.length, skipped: stored.skipped, sources: network.sources });
  } catch (e) {
    return refusal(e);
  }
};

export const DISCOVERY_ACTIONS = { number_discover: discover, number_routes: routes } as const;
export type DiscoveryAction = keyof typeof DISCOVERY_ACTIONS;
