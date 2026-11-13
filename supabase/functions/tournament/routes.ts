import { metersBetween } from "./geo.ts";
import { DEFAULT_SHAPE_RULES, pathMatcher, scoreFromDistance, type ShapeRules, type ShapeTarget } from "./shape.ts";
import type { ShapeDifficulty } from "./shapes.ts";

/**
 * PedestrianShapeRouteGenerator. Builds Follow the Shape walking loops out of a pedestrian graph and nothing else.
 *
 * Hard rules (a candidate that breaks one is dropped, never repaired):
 *  - Every step of a route is a walkable graph edge, in order, end to end. Waypoints are joined by shortest paths over
 *    walkable edges only, so a route can never cross a building, water without a bridge, private land or a highway
 *    unless the graph itself has a walkable edge there. Nothing is ever joined with a straight line.
 *  - The start is a junction on the walkable graph within a short distance of where the player chose. If there is
 *    none, the player is asked to pick a public start; they are never snapped across an unknown gap.
 *  - Length within tolerance of the walking time asked for; closed shapes end where they began; little backtracking.
 *
 * Preferences (used to rank and choose, never to accept an unsafe edge):
 *  - Shape match, scored with the same Fréchet matcher as walks (matchPath), above a per-difficulty minimum.
 *  - Options that differ from each other, and from the player's recent walks.
 *
 * Pure and deterministic: the same graph, start, shape and history always give the same answer.
 */

/** v2: options compared on the whole route (start streets included) and ranked by the estimated shape match. */
export const ROUTE_ALGORITHM = "shape-route-v2";

export type LatLng = { latitude: number; longitude: number };

export type PedNode = { id: string; latitude: number; longitude: number };

/** `coords` run from node `a` to node `b`, as [longitude, latitude]. */
export type PedEdge = {
  id: string;
  a: string;
  b: string;
  coords: readonly (readonly [number, number])[];
  lengthM: number;
  /** Human-verified and eligible for walking. Unknown or unreviewed edges must come in as false. */
  walkable: boolean;
  access?: string | null;
  pathType?: string | null;
  foot?: string | null;
};

export type PedGraph = { nodes: readonly PedNode[]; edges: readonly PedEdge[] };

export const ROUTE_RULES = {
  /** A steady walk with a dog, sniff stops included: about 4 km/h. */
  walkMps: 1.1,
  minutes: [15, 25, 40] as readonly number[],
  /** A route may be this much shorter or longer than the time asked for. */
  lengthTolerance: 0.25,
  /** The farthest a chosen start may be from a walkable junction. */
  maxStartSnapM: 120,
  /** A shape corner may move this share of the shape's size to reach a junction. */
  waypointSnapShare: 0.35,
  /** Shared edges whose ends are both this close to the start are a necessary way in and out, not overlap. */
  connectorM: 150,
  /** Shown options should share less than this much length with each other. */
  maxOptionOverlap: 0.4,
  /** Routes sharing more than this with a recent walk go to the back of the queue. */
  maxRecentOverlap: 0.6,
  /** Length walked twice within one route, as a share of the route. */
  maxBacktrack: 0.25,
  /** Two routes whose resampled paths are on average this close are the same walk on parallel paths. */
  sameWalkM: 35,
  /**
   * Minimum shape score (0 to 100, the walk matcher) before a route may be offered as that shape. Each sits a few
   * points above the best score a different ideal shape gets against it, so a square is never offered as a diamond
   * (an ideal square scores 75.5 as a diamond) or a triangle as a heart (70.4). Calibrated in shapeRoutes.test.ts.
   */
  minScore: { triangle: 75, square: 80, diamond: 80, heart: 75, star: 70, lightning: 70, letter_s: 70 } as Record<string, number>,
  /** For shapes added later without a calibrated minimum. */
  minScoreByDifficulty: { easy: 80, medium: 75, hard: 70 } as Record<ShapeDifficulty, number>,
  /** Search caps: rotations of the shape, sizes, and starting corners tried. */
  rotations: 12,
  scales: [0.85, 1, 1.15] as readonly number[],
  maxPlacements: 480,
  /** Routes given the official (full) shape score after the coarse pass. */
  officialScoring: 12,
  maxOptions: 3,
} as const;

export type RouteRules = typeof ROUTE_RULES;

/**
 * The "estimated shape match" shown on route cards: the same Fréchet distance as the official score, but only an
 * almost exact match reads 100 (the official score forgives up to 12% of the shape's size for GPS wobble, so many
 * real grid loops would all read 100 and look alike). It describes the route's own geometry; only a completed,
 * checked GPS walk gets an official score.
 */
export const ESTIMATE_RULES: ShapeRules = { ...DEFAULT_SHAPE_RULES, algorithm: "route-estimate-v1", perfectAt: 0.02 };

/** Path types never walked, whatever their review status. */
const PROHIBITED_PATH = new Set(["motorway", "motorway_link", "trunk", "trunk_link", "construction", "proposed", "abandoned", "raceway", "bus_guideway", "busway", "escape"]);
const PROHIBITED_ACCESS = new Set(["private", "no", "restricted", "customers", "delivery", "agricultural", "forestry", "military"]);
/** Paths built for walking are slightly preferred over streets. */
const FOOT_FIRST = new Set(["footway", "path", "pedestrian", "sidewalk", "living_street", "track", "crossing"]);

/** Whether an edge may ever be part of a route. Defence in depth: the database applies the same rule. */
export const isWalkable = (e: PedEdge, prefs: { avoidStairs?: boolean } = {}) =>
  e.walkable &&
  e.lengthM > 0 &&
  e.coords.length >= 2 &&
  !PROHIBITED_PATH.has(e.pathType ?? "") &&
  !PROHIBITED_ACCESS.has(e.access ?? "") &&
  !PROHIBITED_ACCESS.has(e.foot ?? "") &&
  !(prefs.avoidStairs && e.pathType === "steps");

export const targetLengthM = (minutes: number, rules: RouteRules = ROUTE_RULES) => minutes * 60 * rules.walkMps;

export type RouteStep = { edgeId: string; forward: boolean };

export type RouteCandidate = {
  steps: RouteStep[];
  edgeIds: string[];
  path: LatLng[];
  lengthM: number;
  minutes: number;
  loop: boolean;
  /** 0 to 100: what a walk exactly along this route would score officially. Decides whether it is offered. */
  shapeScore: number;
  /** 0 to 100: the estimated shape match shown to players (ESTIMATE_RULES). Ranks the options. */
  estimate: number;
  /** Share of the route's length walked more than once. */
  backtrack: number;
  /** Largest overlap with any of the player's recent walks (0 to 1). */
  recentOverlap: number;
  startNodeId: string;
  startSnapM: number;
};

export type RouteFailure = "no_network" | "no_public_start" | "no_feasible_route" | "shape_not_possible";

export type RouteResult =
  | { ok: true; algorithm: string; options: RouteCandidate[]; limited: boolean; considered: number }
  | { ok: false; algorithm: string; reason: RouteFailure; considered: number; bestScore: number | null };

export type RouteRequest = {
  start: LatLng;
  shape: ShapeTarget & { key: string; difficulty: ShapeDifficulty };
  minutes: number;
  /** Edge ids of the player's recent completed routes, newest first. */
  recent?: readonly (readonly string[])[];
  avoidStairs?: boolean;
  /** Lean harder on footpaths, park paths and trails where the data marks them. */
  preferPaths?: boolean;
};

// ---------------------------------------------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------------------------------------------

type Adj = Map<string, { edge: PedEdge; to: string; weight: number }[]>;

const buildAdjacency = (edges: readonly PedEdge[], preferPaths = false): Adj => {
  const adj: Adj = new Map();
  const add = (from: string, to: string, edge: PedEdge, weight: number) => {
    const list = adj.get(from) ?? [];
    list.push({ edge, to, weight });
    adj.set(from, list);
  };
  for (const e of edges) {
    const weight = e.lengthM * (FOOT_FIRST.has(e.pathType ?? "") ? (preferPaths ? 0.7 : 0.9) : 1);
    add(e.a, e.b, e, weight);
    add(e.b, e.a, e, weight);
  }
  for (const list of adj.values()) list.sort((x, y) => (x.edge.id < y.edge.id ? -1 : x.edge.id > y.edge.id ? 1 : 0));
  return adj;
};

/** Dijkstra over walkable edges. Returns the steps from `from` to `to`, or null when they are not connected. */
const shortestPath = (adj: Adj, from: string, to: string): RouteStep[] | null => {
  if (from === to) return [];
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { node: string; step: RouteStep }>();
  const heap: [number, string][] = [[0, from]];
  const push = (item: [number, string]) => {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] < heap[i][0] || (heap[p][0] === heap[i][0] && heap[p][1] <= heap[i][1])) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        const less = (x: number, y: number) => heap[x][0] < heap[y][0] || (heap[x][0] === heap[y][0] && heap[x][1] < heap[y][1]);
        if (l < heap.length && less(l, m)) m = l;
        if (r < heap.length && less(r, m)) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, node] = pop();
    if (node === to) break;
    if (d > (dist.get(node) ?? Infinity)) continue;
    for (const { edge, to: next, weight } of adj.get(node) ?? []) {
      const nd = d + weight;
      if (nd < (dist.get(next) ?? Infinity)) {
        dist.set(next, nd);
        prev.set(next, { node, step: { edgeId: edge.id, forward: edge.a === node } });
        push([nd, next]);
      }
    }
  }
  if (!prev.has(to)) return null;
  const steps: RouteStep[] = [];
  for (let at = to; at !== from; ) {
    const p = prev.get(at)!;
    steps.push(p.step);
    at = p.node;
  }
  return steps.reverse();
};

const toLatLng = ([lng, lat]: readonly [number, number]): LatLng => ({ latitude: lat, longitude: lng });

/** The route's geometry, edge by edge, in walking order, exactly as stored in the graph. */
const pathOf = (steps: readonly RouteStep[], byId: Map<string, PedEdge>): LatLng[] => {
  const out: LatLng[] = [];
  for (const s of steps) {
    const e = byId.get(s.edgeId)!;
    const coords = s.forward ? e.coords : [...e.coords].reverse();
    coords.forEach((c, i) => {
      if (i === 0 && out.length) return; // the joint is the previous edge's last point
      out.push(toLatLng(c));
    });
  }
  return out;
};

/** Length walked more than once, as a share of the whole route. */
export const backtrackShare = (steps: readonly RouteStep[], byId: Map<string, PedEdge>) => {
  const seen = new Set<string>();
  let total = 0;
  let repeated = 0;
  for (const s of steps) {
    const len = byId.get(s.edgeId)!.lengthM;
    total += len;
    if (seen.has(s.edgeId)) repeated += len;
    seen.add(s.edgeId);
  }
  return total ? repeated / total : 0;
};

/**
 * sharedLength / min(lengthA, lengthB), counting each shared edge once. Edges with both ends within `connectorM`
 * of `start` are left out: every route from the same door shares them.
 */
export const overlapRatio = (a: readonly string[], b: readonly string[], byId: Map<string, PedEdge>, near?: (e: PedEdge) => boolean) => {
  const len = (ids: Iterable<string>) => [...ids].reduce((s, id) => s + (byId.get(id)?.lengthM ?? 0), 0);
  const setA = new Set(a);
  const setB = new Set(b);
  const shared = [...setA].filter((id) => setB.has(id) && !(near && byId.has(id) && near(byId.get(id)!)));
  const min = Math.min(len(setA), len(setB));
  return min ? len(shared) / min : 0;
};

const local = (p: LatLng, origin: LatLng) => {
  const k = Math.cos((origin.latitude * Math.PI) / 180);
  return [(p.longitude - origin.longitude) * 111_320 * k, (p.latitude - origin.latitude) * 110_540] as const;
};

/** Mean distance between two routes resampled by length: small means the same walk, even on different edges. */
export const meanGap = (a: readonly LatLng[], b: readonly LatLng[], n = 40) => {
  const sample = (path: readonly LatLng[]) => {
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + metersBetween(path[i - 1], path[i]));
    const total = cum[cum.length - 1] || 1;
    return Array.from({ length: n }, (_, k) => {
      const t = (total * k) / (n - 1);
      let i = 1;
      while (i < path.length - 1 && cum[i] < t) i++;
      const span = cum[i] - cum[i - 1] || 1;
      const f = Math.min(1, Math.max(0, (t - cum[i - 1]) / span));
      return { latitude: path[i - 1].latitude + (path[i].latitude - path[i - 1].latitude) * f, longitude: path[i - 1].longitude + (path[i].longitude - path[i - 1].longitude) * f };
    });
  };
  const sa = sample(a);
  const sb = sample(b);
  const forward = sa.reduce((s, p, i) => s + metersBetween(p, sb[i]), 0) / n;
  const backward = sa.reduce((s, p, i) => s + metersBetween(p, sb[n - 1 - i]), 0) / n;
  return Math.min(forward, backward);
};

/** Corner points of the target to route through, in order. Curvy shapes are sampled to 12 points. */
const waypointsOf = (shape: ShapeTarget): [number, number][] => {
  const pts = shape.points.map(([x, y]) => [x, y] as [number, number]);
  if (pts.length <= 10) return pts;
  const ring = shape.closed ? [...pts, pts[0]] : pts;
  const cum = [0];
  for (let i = 1; i < ring.length; i++) cum.push(cum[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]));
  const total = cum[cum.length - 1];
  const count = shape.closed ? 12 : 10;
  const out: [number, number][] = [];
  for (let k = 0; k < count; k++) {
    const t = shape.closed ? (total * k) / count : (total * k) / (count - 1);
    let i = 1;
    while (i < ring.length - 1 && cum[i] < t) i++;
    const f = (t - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    out.push([ring[i - 1][0] + (ring[i][0] - ring[i - 1][0]) * f, ring[i - 1][1] + (ring[i][1] - ring[i - 1][1]) * f]);
  }
  return out;
};

const perimeter = (pts: readonly [number, number][], closed: boolean) => {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (closed && pts.length > 1) s += Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
  return s;
};

export type RouteProblem = "unknown_edge" | "not_walkable" | "disconnected" | "path_mismatch" | "not_closed" | "length_mismatch" | "empty";

/**
 * Checks a finished route against the graph it claims to come from, independently of how it was built: every step
 * is an existing walkable edge, each step starts where the previous one ended, the drawn path is exactly those
 * edges' geometry, a loop ends on the junction it started from, and the length matches the geometry. Any route
 * that fails is dropped, never shown.
 */
export const validateRoute = (c: Pick<RouteCandidate, "steps" | "path" | "lengthM" | "loop" | "startNodeId">, graph: PedGraph, prefs: { avoidStairs?: boolean } = {}): RouteProblem | null => {
  if (!c.steps.length || c.path.length < 2) return "empty";
  const byId = new Map(graph.edges.map((e) => [e.id, e]));
  let at = c.startNodeId;
  let length = 0;
  for (const s of c.steps) {
    const e = byId.get(s.edgeId);
    if (!e) return "unknown_edge";
    if (!isWalkable(e, prefs)) return "not_walkable";
    const [from, to] = s.forward ? [e.a, e.b] : [e.b, e.a];
    if (from !== at) return "disconnected";
    at = to;
    let geo = 0;
    for (let i = 1; i < e.coords.length; i++) geo += metersBetween(toLatLng(e.coords[i - 1]), toLatLng(e.coords[i]));
    length += geo;
  }
  if (c.loop && at !== c.startNodeId) return "not_closed";
  const expected = pathOf(c.steps, byId);
  if (expected.length !== c.path.length || expected.some((p, i) => Math.abs(p.latitude - c.path[i].latitude) > 1e-9 || Math.abs(p.longitude - c.path[i].longitude) > 1e-9)) return "path_mismatch";
  if (Math.abs(length - c.lengthM) > Math.max(1, length * 0.01)) return "length_mismatch";
  return null;
};

// ---------------------------------------------------------------------------------------------------------------
// The generator
// ---------------------------------------------------------------------------------------------------------------

export const generateShapeRoutes = (graph: PedGraph, req: RouteRequest, rules: RouteRules = ROUTE_RULES): RouteResult => {
  const algorithm = ROUTE_ALGORITHM;
  const edges = graph.edges.filter((e) => isWalkable(e, { avoidStairs: req.avoidStairs }));
  if (!edges.length) return { ok: false, algorithm, reason: "no_network", considered: 0, bestScore: null };
  const byId = new Map(edges.map((e) => [e.id, e]));
  const adj = buildAdjacency(edges, req.preferPaths);
  const nodes = graph.nodes.filter((n) => adj.has(n.id)).sort((x, y) => (x.id < y.id ? -1 : 1));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const target = targetLengthM(req.minutes, rules);
  const [minLen, maxLen] = [target * (1 - rules.lengthTolerance), target * (1 + rules.lengthTolerance)];

  // Connected pieces of the network and their total length. A start on a piece too small to hold the walk (an
  // isolated street, a closed courtyard) could never give a route, so it is not offered as a start.
  const piece = new Map<string, number>();
  const pieceLength: number[] = [];
  for (const n of nodes) {
    if (piece.has(n.id)) continue;
    const id = pieceLength.length;
    let total = 0;
    const stack = [n.id];
    piece.set(n.id, id);
    const counted = new Set<string>();
    while (stack.length) {
      const at = stack.pop()!;
      for (const { edge, to } of adj.get(at) ?? []) {
        if (!counted.has(edge.id)) {
          counted.add(edge.id);
          total += edge.lengthM;
        }
        if (!piece.has(to)) {
          piece.set(to, id);
          stack.push(to);
        }
      }
    }
    pieceLength.push(total);
  }

  // A. A public start: the nearest walkable junction on a big enough piece, close enough to walk to without
  //    crossing anything unknown.
  let start: PedNode | null = null;
  let snap = Infinity;
  for (const n of nodes) {
    if (pieceLength[piece.get(n.id)!] < minLen) continue;
    const d = metersBetween(req.start, n);
    if (d < snap) {
      snap = d;
      start = n;
    }
  }
  if (!start || snap > rules.maxStartSnapM) return { ok: false, algorithm, reason: "no_public_start", considered: 0, bestScore: null };

  const shapePts = waypointsOf(req.shape);
  const unitPerimeter = perimeter(shapePts, req.shape.closed);
  const anchors = req.shape.closed ? shapePts.map((_, i) => i) : [0];
  const near = (e: PedEdge) => {
    const a = nodeById.get(e.a);
    const b = nodeById.get(e.b);
    return Boolean(a && b && metersBetween(a, start!) <= rules.connectorM && metersBetween(b, start!) <= rules.connectorM);
  };
  const recent = (req.recent ?? []).map((ids) => ids.filter((id) => byId.has(id)));

  // Shape scoring in two passes: a coarse one (24 samples) to rank every feasible route cheaply, then the official
  // one (the same rules as walk scoring) for the best few. Only official scores are ever reported or compared.
  const official = pathMatcher(req.shape, DEFAULT_SHAPE_RULES);
  const coarse = pathMatcher(req.shape, { ...DEFAULT_SHAPE_RULES, samples: 24 });

  // Every junction in flat metres around the start, for fast corner snapping.
  const placed = nodes.map((n) => {
    const [x, y] = local(n, start!);
    return { id: n.id, x, y };
  });
  const seen = new Set<string>();
  const feasible: RouteCandidate[] = [];
  let considered = 0;
  let bestScore: number | null = null;

  // B to H. Place the shape on the map, route through its corners on walkable edges, keep what holds up.
  outer: for (const scale of rules.scales) {
    // Streets wind, so a shape drawn at the target length walks longer: start a little small.
    const size = ((target / 1.2) * scale) / unitPerimeter;
    const snapLimit = size * rules.waypointSnapShare * 2;
    for (let r = 0; r < rules.rotations; r++) {
      const theta = (2 * Math.PI * r) / rules.rotations;
      const [cos, sin] = [Math.cos(theta), Math.sin(theta)];
      for (const anchor of anchors) {
        if (++considered > rules.maxPlacements) break outer;
        const [ax, ay] = shapePts[anchor];
        const order = req.shape.closed ? [...shapePts.slice(anchor), ...shapePts.slice(0, anchor)] : shapePts;
        // Corner positions in metres around the start, then the nearest walkable junction to each.
        const via: string[] = [start!.id];
        let lost = false;
        for (const [x, y] of order.slice(1)) {
          const dx = (x - ax) * size;
          const dy = (y - ay) * size;
          const cx = dx * cos - dy * sin;
          const cy = dx * sin + dy * cos;
          let pick: string | null = null;
          let best = snapLimit * snapLimit;
          for (const n of placed) {
            const d = (n.x - cx) ** 2 + (n.y - cy) ** 2;
            if (d < best) {
              best = d;
              pick = n.id;
            }
          }
          if (!pick) {
            lost = true;
            break;
          }
          if (pick !== via[via.length - 1]) via.push(pick);
        }
        if (lost || via.length < (req.shape.closed ? 3 : 2)) continue;
        if (req.shape.closed) via.push(start!.id);

        const steps: RouteStep[] = [];
        for (let i = 1; i < via.length; i++) {
          const leg = shortestPath(adj, via[i - 1], via[i]);
          if (!leg) {
            lost = true; // D. disconnected: no walkable way between two corners
            break;
          }
          steps.push(...leg);
        }
        if (lost || !steps.length) continue;

        const edgeIds = steps.map((s) => s.edgeId);
        const key = [...edgeIds].sort().join(",");
        if (seen.has(key)) continue;
        seen.add(key);

        const lengthM = steps.reduce((s, st) => s + byId.get(st.edgeId)!.lengthM, 0);
        if (lengthM < minLen || lengthM > maxLen) continue; // G. too short or too long for the time asked
        const backtrack = backtrackShare(steps, byId);
        if (backtrack > rules.maxBacktrack) continue; // out-and-back along the same street is not a loop
        const path = pathOf(steps, byId);
        feasible.push({
          steps,
          edgeIds,
          path,
          lengthM,
          minutes: Math.round(lengthM / rules.walkMps / 60),
          loop: req.shape.closed,
          shapeScore: coarse(path).score,
          estimate: 0,
          backtrack: Math.round(backtrack * 1000) / 1000,
          recentOverlap: Math.max(0, ...recent.map((r) => overlapRatio(edgeIds, r, byId, near))),
          startNodeId: start!.id,
          startSnapM: Math.round(snap),
        });
      }
    }
  }

  if (!feasible.length) return { ok: false, algorithm, reason: "no_feasible_route", considered, bestScore: null };
  // Official scores for the most promising routes only; the rest can't make the cut on shape anyway.
  feasible.sort((x, y) => y.shapeScore - x.shapeScore);
  const scored = feasible.slice(0, rules.officialScoring).map((c) => {
    const { distance, score } = official(c.path);
    return { ...c, shapeScore: score, estimate: scoreFromDistance(distance, ESTIMATE_RULES) };
  });
  bestScore = Math.max(...scored.map((c) => c.shapeScore));
  const minimum = rules.minScore[req.shape.key] ?? rules.minScoreByDifficulty[req.shape.difficulty];
  const good = scored.filter((c) => c.shapeScore >= minimum);
  if (!good.length) return { ok: false, algorithm, reason: "shape_not_possible", considered, bestScore };

  // I to K. Best shape first; routes too like a recent walk go to the back; options must differ from each other.
  good.sort((x, y) => {
    const fresh = Number(x.recentOverlap > rules.maxRecentOverlap) - Number(y.recentOverlap > rules.maxRecentOverlap);
    return fresh || y.estimate - x.estimate || x.lengthM - y.lengthM || (x.edgeIds.join() < y.edgeIds.join() ? -1 : 1);
  });
  const options: RouteCandidate[] = [];
  for (const c of good) {
    if (validateRoute(c, { nodes: graph.nodes, edges }, { avoidStairs: req.avoidStairs })) continue; // never shown if it fails the independent check
    if (options.length >= rules.maxOptions) break;
    // Shared length counts the whole route, streets near the start included: options must be genuinely different
    // walks, not one loop started elsewhere, walked backwards or nudged onto a parallel path.
    const distinct = options.every((o) => overlapRatio(o.edgeIds, c.edgeIds, byId) < rules.maxOptionOverlap && meanGap(o.path, c.path) > rules.sameWalkM);
    if (distinct) options.push(c);
  }
  return { ok: true, algorithm, options, limited: options.length < rules.maxOptions, considered };
};
