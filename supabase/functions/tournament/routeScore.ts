import { GPS_RULES, cleanTrack, metersBetween, type TrackPoint } from "./geo.ts";
import { ROAD_RULES, matchRoads, type RoadEdge } from "../rooms/battle.ts";

/**
 * Follow the Shape with a walking route: how much of the assigned route a walk covered, in what order, whether the
 * walker is off it right now, and the final score. Pure, so the phone's live progress and the server's official
 * score always agree.
 *
 * Final score (0 to 100), versioned as ROUTE_SCORING:
 *   70% shape similarity  (the walk against the target shape, the frechet-v1 walk matcher)
 *   30% route completion  (share of the route walked, each step full at 70% coverage, times how much was in order)
 *
 * Walking speed never scores. GPS jumps can't complete anything: coverage only counts points close to the route
 * with walked distance to back them (matchRoads), and fast moves are flagged by the walk matcher.
 */

export const ROUTE_SCORING = "shape-route-score-v1";

export const ROUTE_SCORE_RULES = {
  shapeWeight: 0.7,
  routeWeight: 0.3,
  /** Below this share of the route covered, the walk isn't finished yet. */
  minCompletion: 0.5,
  /** Below this share walked in route order (either direction), the walk didn't follow the route. */
  minProgression: 0.75,
  /** A fix farther than this from the route counts as off it. */
  offRouteM: 40,
  /** This many off-route fixes in a row before telling the walker. */
  offRouteFixes: 3,
  /** A point this close to a route step counts as visiting it, for order. */
  visitM: 18,
  /** A fix counts toward its closest step only when the next closest is at least this much farther. */
  junctionGapM: 6,
} as const;

export type RouteScoreRules = typeof ROUTE_SCORE_RULES;

/** One step of the assigned route, in walking order, with its own geometry ([lng, lat], from a to b as walked). */
export type RouteLeg = { edgeId: string; coords: readonly (readonly [number, number])[]; lengthM: number };

const toPlane = (p: { latitude: number; longitude: number }, origin: { latitude: number; longitude: number }) => {
  const k = Math.cos((origin.latitude * Math.PI) / 180);
  return [(p.longitude - origin.longitude) * 111_320 * k, (p.latitude - origin.latitude) * 110_540] as const;
};

/** Metres from a point to a polyline. */
export const distanceToPath = (point: { latitude: number; longitude: number }, coords: readonly (readonly [number, number])[]) => {
  let best = Infinity;
  for (let i = 1; i < coords.length; i++) {
    const [ax, ay] = toPlane({ latitude: coords[i - 1][1], longitude: coords[i - 1][0] }, point);
    const [bx, by] = toPlane({ latitude: coords[i][1], longitude: coords[i][0] }, point);
    const dx = bx - ax;
    const dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
};

/** Length of the longest strictly increasing run (not necessarily contiguous). */
const longestIncreasing = (xs: readonly number[]) => {
  const tails: number[] = [];
  for (const x of xs) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = x;
  }
  return tails.length;
};

export type RouteProgress = {
  /** Share of the route's length covered, 0 to 1. */
  completion: number;
  /** Share of visited steps that were visited in route order (either direction), 0 to 1. */
  progression: number;
  coveredM: number;
  routeM: number;
  /** Route steps visited so far, in the order first reached. */
  visited: number[];
};

/**
 * How much of the route a walk covered. Each step's coverage comes from the same matcher as Steal Your Road, so the
 * same rules (accuracy, distance to the line, no running ahead of what was walked) apply.
 */
export const routeProgress = (points: readonly TrackPoint[], legs: readonly RouteLeg[], rules: RouteScoreRules = ROUTE_SCORE_RULES): RouteProgress => {
  const routeM = legs.reduce((s, l) => s + l.lengthM, 0);
  if (!legs.length || !routeM) return { completion: 0, progression: 0, coveredM: 0, routeM: 0, visited: [] };
  // A route can use a road twice (a short shared connector); give each use its own id for the matcher.
  const edges: RoadEdge[] = legs.map((l, i) => ({ id: `${i}`, startNodeId: `s${i}`, endNodeId: `e${i}`, coords: l.coords, lengthM: l.lengthM, name: null }));
  const coverage = matchRoads(points, edges, ROAD_RULES);
  let coveredM = 0;
  // A step counts as walked at the same coverage that captures a road in Steal Your Road (70%); less earns part.
  legs.forEach((l, i) => {
    coveredM += l.lengthM * Math.min(1, (coverage.get(`${i}`)?.share ?? 0) / ROAD_RULES.captureShare);
  });

  // Order: the first step each good fix is close to, in time order.
  const track = cleanTrack(points, GPS_RULES).filter((p) => (p.accuracyM ?? Infinity) <= ROAD_RULES.maxAccuracyM);
  const visited: number[] = [];
  const seen = new Set<number>();
  for (const p of track) {
    // Fixes at a junction are near two steps at once and say nothing about order, so they're skipped.
    const near = legs.map((l, i) => ({ i, d: distanceToPath(p, l.coords) })).filter((x) => x.d < rules.visitM).sort((a, b) => a.d - b.d);
    const pick = near.length === 1 || (near.length > 1 && near[1].d - near[0].d > rules.junctionGapM) ? near[0].i : -1;
    if (pick >= 0 && !seen.has(pick)) {
      seen.add(pick);
      visited.push(pick);
    }
  }
  const n = legs.length;
  const forward = longestIncreasing(visited);
  const backward = longestIncreasing(visited.map((i) => n - 1 - i));
  const progression = visited.length ? Math.max(forward, backward) / visited.length : 0;
  return { completion: Math.min(1, coveredM / routeM), progression, coveredM, routeM, visited };
};

/** Whether the latest fixes have left the route: the last `offRouteFixes` good fixes are all farther than `offRouteM`. */
export const offRoute = (points: readonly TrackPoint[], legs: readonly RouteLeg[], rules: RouteScoreRules = ROUTE_SCORE_RULES) => {
  const good = points.filter((p) => (p.accuracyM ?? Infinity) <= GPS_RULES.poorAccuracyM);
  if (good.length < rules.offRouteFixes || !legs.length) return { off: false, distanceM: 0 };
  const recent = good.slice(-rules.offRouteFixes);
  const far = recent.map((p) => Math.min(...legs.map((l) => distanceToPath(p, l.coords))));
  return { off: far.every((d) => d > rules.offRouteM), distanceM: Math.round(far[far.length - 1]) };
};

/** The point on the route closest to where the walker is, to show the way back. Never a line through anything. */
export const nearestOnRoute = (point: { latitude: number; longitude: number }, legs: readonly RouteLeg[]) => {
  let best: { latitude: number; longitude: number } | null = null;
  let bestD = Infinity;
  for (const l of legs)
    for (const [lng, lat] of l.coords) {
      const d = metersBetween(point, { latitude: lat, longitude: lng });
      if (d < bestD) {
        bestD = d;
        best = { latitude: lat, longitude: lng };
      }
    }
  return best;
};

export type RouteIssue = "route_incomplete" | "route_out_of_order";

export type RouteScore = {
  ok: boolean;
  issues: RouteIssue[];
  /** The walk against the target shape, 0 to 100. */
  similarity: number;
  /** Completion times progression, 0 to 100. */
  routePart: number;
  final: number;
  progress: RouteProgress;
  version: string;
};

/** The official score. `similarity` is matchShape's score for the same walk (0 when the walk itself isn't eligible). */
export const scoreRouteWalk = (similarity: number, progress: RouteProgress, rules: RouteScoreRules = ROUTE_SCORE_RULES): RouteScore => {
  const issues: RouteIssue[] = [];
  if (progress.completion < rules.minCompletion) issues.push("route_incomplete");
  else if (progress.progression < rules.minProgression) issues.push("route_out_of_order");
  const routePart = Math.round(progress.completion * progress.progression * 1000) / 10;
  const final = issues.length ? 0 : Math.round((rules.shapeWeight * similarity + rules.routeWeight * routePart) * 10) / 10;
  return { ok: issues.length === 0, issues, similarity, routePart, final, progress, version: ROUTE_SCORING };
};

/** Leaderboards compare players within a difficulty tier: the shape's own difficulty. */
export const tierOf = (difficulty: "easy" | "medium" | "hard") => difficulty;
