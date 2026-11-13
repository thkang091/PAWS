import { metersBetween } from "./geo.ts";
import { isWalkable, type LatLng, type PedEdge, type PedGraph, type PedNode, type RouteStep } from "./routes.ts";
import {
  DIGITS,
  ALL_NUMBERS,
  CORNER_AT,
  DIGIT_SEGMENTS,
  SEGMENTS,
  SEGMENT_ENDS,
  cornersOf,
  decodeSegments,
  difficultyOf,
  digitWalks,
  isTwoDigit,
  type Corner,
  type Difficulty,
  type Digit,
  type Segment,
  type Stroke,
} from "./digits.ts";

/**
 * Number Trail routes: two-digit numbers drawn by walking real streets, built from a pedestrian graph and nothing else.
 *
 * DigitRouteGenerator  finds places where the street network itself already has a digit's shape. It looks for real
 *                      corners (two streets meeting at roughly a right angle), follows real streets straight out of
 *                      them to measure a frame, then checks each of the seven segments against the streets that run
 *                      along it. A segment exists only when connected walkable edges follow its line closely. A digit
 *                      is offered only when its walked geometry, read back segment by segment, is that digit and no
 *                      other.
 * TwoDigitRoutePlanner pairs digit placements into numbers: digit one near the start, digit two side by side with it
 *                      where the streets allow (or in a separate nearby spot, marked as such), joined by a real walking
 *                      connector over streets that are not part of either digit. Lengths come from the edges.
 * DigitRouteValidator  re-checks a finished plan against the graph, independently of how it was built.
 * chooseNumber         picks a random number from the feasible ones only. Nothing is ever forced: a number the streets
 *                      can't draw is simply not in the set.
 *
 * Nothing is ever joined with a straight line, and no coordinates are invented: every step is an existing walkable
 * edge, walked end to end, and every drawn line is that edge's own geometry.
 *
 * Pure and deterministic: the same graph and request always give the same plans (the random pick takes its random
 * number from the caller).
 */

export const NUMBER_ALGORITHM = "number-trail-v1";

export const NUMBER_RULES = {
  /** A steady walk with a dog, sniff stops included: about 4 km/h. */
  walkMps: 1.1,
  minutes: [15, 25, 40] as readonly number[],
  /** The race (both digits and the connector) as a share of the time asked for. */
  minShare: 0.45,
  maxShare: 1.1,
  /** The farthest a chosen start may be from a walkable junction. */
  maxStartSnapM: 120,
  /** The farthest the first digit may start from the player, walking. Walked before the race, not timed. */
  maxApproachM: 450,
  /** The longest connector between the digits, absolute and as a share of the target length. */
  maxConnectorM: 450,
  maxConnectorShare: 0.3,
  /** Frame sizes: width and half-height (one cell) in metres. */
  minSizeM: 50,
  maxSizeShare: 0.16,
  maxSizeM: 420,
  /** Half-height over width. 1 is the classic seven-segment proportion (twice as tall as wide). */
  aspect: [0.5, 2.0] as readonly [number, number],
  /** Angle between the frame's sides: streets need not meet at exactly 90 degrees. */
  sideAngleDeg: [65, 115] as readonly [number, number],
  /** Digits stay upright on a north-up map: turned at most this much to follow the streets. */
  maxRotationDeg: 45,
  /** A street counts as running along a segment within this distance of its line. */
  corridorMinM: 10,
  corridorShare: 0.15,
  /** A segment's walk may be at most this much longer than its straight line. */
  maxStretch: 1.3,
  /** A frame corner may move this far to land on a junction. */
  snapMinM: 15,
  snapShare: 0.22,
  /** Reading a digit back: a segment is present when this share of its line lies along walked streets... */
  presentShare: 0.8,
  /** ...and absent when no more than this share of its middle does. Anything in between is unreadable. */
  absentShare: 0.2,
  /** Fewest readability points (0 to 100) for a digit to be offered. */
  minReadability: 80,
  /** Strokes walked twice, as a share of a digit. */
  maxRepeatShare: 0.34,
  /** Distinct frames checked at most: bounds the work (and CPU time) on dense networks, nearest streets first. */
  maxFrames: 9000,
  /** Placements kept per digit whose centres lie within `spreadM` of each other. */
  perSpot: 4,
  spreadM: 50,
  /** Placements kept per digit, and pairs routed per number. */
  perDigit: 160,
  firstsPerNumber: 30,
  secondsPerNumber: 80,
  pairEvaluations: 40,
  /** Digit two's centre at least this many of digit one's widths along its "right" (digit one's centre is at 0.5)... */
  orderMinX: 1.4,
  /** ...within this many half-heights of digit one's middle, and within this angle of due east on the map. */
  orderMaxRise: 1.2,
  orderMaxAngleDeg: 40,
  /** Connector metres allowed within GPS range of a stroke: enough to leave a corner and cross streets, not to follow one. */
  maxConnectorAlongM: 45,
  /** Digit two's height over digit one's, for any layout. */
  sizeMatch: [0.65, 1.55] as readonly [number, number],
  /** The digits' strokes stay at least this far apart (metres, and as a share of the smaller cell). */
  minDigitGapM: 25,
  minDigitGapShare: 0.3,
  /** Side by side: digit two's frame starts this many widths right of digit one's left edge... */
  sideGap: [1.15, 2.7] as readonly [number, number],
  /** ...its top within this many half-heights of digit one's top, turned at most this much, at a similar size. */
  sideRise: 0.7,
  sideAngleMaxDeg: 20,
  sideSize: [0.7, 1.45] as readonly [number, number],
  /**
   * Exact-length courses (practice and online): the digits and connector may fall short of the target by up to this
   * share, made up by a finish stretch of real street after the last digit, and the course then lands within
   * `finishTolShare` of the target. The stretch keeps off the strokes like a connector does.
   */
  maxFinishShare: 0.4,
  finishTolShare: 0.008,
} as const;

export type NumberRules = typeof NUMBER_RULES;

export const targetLengthM = (minutes: number, rules: NumberRules = NUMBER_RULES) => minutes * 60 * rules.walkMps;

// ---------------------------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------------------------

type XY = readonly [number, number];

/** A digit's frame: origin at TL, unit vectors to the right and downward (east-north metres), cell sizes. */
export type DigitFrame = { origin: LatLng; right: XY; down: XY; widthM: number; halfHeightM: number };

export type DigitPlacement = {
  digit: Digit;
  frame: DigitFrame;
  /** The junction at each corner the digit uses. */
  corners: Partial<Record<Corner, string>>;
  /** Each required segment's own edges, from its first corner to its second (SEGMENT_ENDS order). */
  segments: Partial<Record<Segment, RouteStep[]>>;
  /** The walk: strokes in order, repeats included. */
  walk: { start: Corner; end: Corner; strokes: Stroke[] };
  strokeEdgeIds: string[];
  /** Length walked (repeats included) and length walked twice. */
  lengthM: number;
  repeatedM: number;
  turns: number;
  /** 0 to 100: how cleanly the real streets read as this digit. */
  readability: number;
};

/** `finish`: an exact-length course (practice and online) ends with a stretch of real street to a finish corner. */
export type LegPart = "approach" | "digit" | "connector" | "finish";

/** One step of a plan. `digit` is 0 or 1 for digit legs, `segment` the stroke it draws. */
export type PlanLeg = { part: LegPart; digit?: 0 | 1; segment?: Segment; repeat?: boolean; edgeId: string; forward: boolean };

/** Two digits side by side or apart; or a single-digit number (1 to 9), which has no second digit and no connector. */
export type NumberLayout = "side_by_side" | "separate" | "single";

export type NumberPlan = {
  number: string;
  algorithm: string;
  layout: NumberLayout;
  /** Where the player walks from (a junction near them) and where the race starts (digit one's first corner). */
  approachFromNodeId: string;
  startNodeId: string;
  legs: PlanLeg[];
  /** One placement per digit of the number: one for 1 to 9, two otherwise. */
  digits: DigitPlacement[];
  approachM: number;
  /** 0 for a single digit. */
  connectorM: number;
  digitM: number[];
  /** The finish stretch after the last digit (exact-length courses only; 0 or absent otherwise). */
  finishM?: number;
  /** Where the race ends: the finish corner, or the last digit's last corner. */
  finishNodeId?: string;
  /** Digits plus connector plus finish stretch: the timed part. */
  raceM: number;
  minutes: number;
  difficulty: Difficulty;
  /** Map heading (degrees clockwise from north) that shows the number upright: the digits' own lean. */
  headingDeg: number;
  score: number;
};

/** `timeout`: the request's deadline passed before every number was checked; nothing partial is offered. */
export type NumberFailure = "no_network" | "no_public_start" | "no_number_routes" | "timeout";

export type NumberPlanResult = {
  ok: boolean;
  algorithm: string;
  reason: NumberFailure | null;
  /** Feasible numbers and the best plan for each, sorted by number. Empty unless ok. */
  plans: NumberPlan[];
  /** Which digits could be drawn at all near this start. */
  digits: Digit[];
  stats: { frames: number; placements: number; pairsRouted: number; rejected?: Record<string, number>; truncated?: boolean };
};

export type NumberRequest = {
  start: LatLng;
  minutes: number;
  avoidStairs?: boolean;
  /**
   * Stop by this time (from `clock`, default Date.now). Running out during the digit search just searches fewer
   * streets, nearest first, like the frame cap. Running out while pairing numbers returns `timeout` with no plans,
   * because a partial pass over 00 to 99 would favour the numbers checked first.
   */
  deadlineAt?: number;
  clock?: () => number;
};

// ---------------------------------------------------------------------------------------------------------------
// Graph preparation
// ---------------------------------------------------------------------------------------------------------------

type Adj = Map<string, { edge: PedEdge; to: string }[]>;

export type Prep = {
  origin: LatLng;
  edges: PedEdge[];
  byId: Map<string, PedEdge>;
  adj: Adj;
  nodes: PedNode[];
  nodeById: Map<string, PedNode>;
  xy: Map<string, XY>;
  /** Edge geometry in local metres, from a to b. */
  exy: Map<string, XY[]>;
  nodeGrid: Map<string, string[]>;
  edgeGrid: Map<string, number[]>;
};

const NODE_CELL = 30;
const EDGE_CELL = 60;

const projector = (origin: LatLng) => {
  const k = Math.cos((origin.latitude * Math.PI) / 180);
  return {
    to: (p: LatLng): XY => [(p.longitude - origin.longitude) * 111_320 * k, (p.latitude - origin.latitude) * 110_540],
    from: ([x, y]: XY): LatLng => ({ latitude: origin.latitude + y / 110_540, longitude: origin.longitude + x / (111_320 * k) }),
  };
};

export const prepare = (graph: PedGraph, origin: LatLng, prefs: { avoidStairs?: boolean } = {}): Prep => {
  const edges = graph.edges.filter((e) => isWalkable(e, prefs)).slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byId = new Map(edges.map((e) => [e.id, e]));
  const adj: Adj = new Map();
  for (const e of edges) {
    if (e.a === e.b) continue;
    (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push({ edge: e, to: e.b });
    (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push({ edge: e, to: e.a });
  }
  const proj = projector(origin);
  const nodes = graph.nodes.filter((n) => adj.has(n.id)).slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const xy = new Map(nodes.map((n) => [n.id, proj.to(n)]));
  const exy = new Map(edges.map((e) => [e.id, e.coords.map(([lng, lat]) => proj.to({ latitude: lat, longitude: lng }))]));
  const nodeGrid = new Map<string, string[]>();
  for (const n of nodes) {
    const [x, y] = xy.get(n.id)!;
    const key = `${Math.floor(x / NODE_CELL)}:${Math.floor(y / NODE_CELL)}`;
    (nodeGrid.get(key) ?? nodeGrid.set(key, []).get(key)!).push(n.id);
  }
  const edgeGrid = new Map<string, number[]>();
  edges.forEach((e, i) => {
    const pts = exy.get(e.id)!;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    for (let gx = Math.floor(Math.min(...xs) / EDGE_CELL); gx <= Math.floor(Math.max(...xs) / EDGE_CELL); gx++)
      for (let gy = Math.floor(Math.min(...ys) / EDGE_CELL); gy <= Math.floor(Math.max(...ys) / EDGE_CELL); gy++) {
        const key = `${gx}:${gy}`;
        (edgeGrid.get(key) ?? edgeGrid.set(key, []).get(key)!).push(i);
      }
  });
  return { origin, edges, byId, adj, nodes, nodeById, xy, exy, nodeGrid, edgeGrid };
};

/** An edge's geometry as walked from `from`. */
const orientedXY = (p: Prep, e: PedEdge, from: string): XY[] => (e.a === from ? p.exy.get(e.id)! : [...p.exy.get(e.id)!].reverse());

const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]];
const add = (a: XY, b: XY): XY => [a[0] + b[0], a[1] + b[1]];
const mul = (a: XY, k: number): XY => [a[0] * k, a[1] * k];
const dot = (a: XY, b: XY) => a[0] * b[0] + a[1] * b[1];
const cross = (a: XY, b: XY) => a[0] * b[1] - a[1] * b[0];
const norm = (a: XY) => Math.hypot(a[0], a[1]);
const unit = (a: XY): XY => {
  const n = norm(a) || 1;
  return [a[0] / n, a[1] / n];
};
const deg = (r: number) => (r * 180) / Math.PI;

/** Distance from a point to a polyline, in metres. */
const distToPolyline = (p: XY, pts: readonly XY[]) => {
  let best = Infinity;
  const [px, py] = p;
  for (let i = 1; i < pts.length; i++) {
    const ax = pts[i - 1][0];
    const ay = pts[i - 1][1];
    const dx = pts[i][0] - ax;
    const dy = pts[i][1] - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    const ex = px - ax - dx * t;
    const ey = py - ay - dy * t;
    const d2 = ex * ex + ey * ey;
    if (d2 < best) best = d2;
  }
  return Math.sqrt(best);
};

const nearestNode = (p: Prep, at: XY, within: number): string | null => {
  let best: string | null = null;
  let bestD = within;
  const [cx, cy] = [Math.floor(at[0] / NODE_CELL), Math.floor(at[1] / NODE_CELL)];
  const r = Math.ceil(within / NODE_CELL);
  for (let gx = cx - r; gx <= cx + r; gx++)
    for (let gy = cy - r; gy <= cy + r; gy++)
      for (const id of p.nodeGrid.get(`${gx}:${gy}`) ?? []) {
        const q = p.xy.get(id)!;
        const d = Math.hypot(q[0] - at[0], q[1] - at[1]);
        if (d < bestD || (d === bestD && best !== null && id < best)) {
          bestD = d;
          best = id;
        }
      }
  return best;
};

// ---------------------------------------------------------------------------------------------------------------
// Shortest paths
// ---------------------------------------------------------------------------------------------------------------

class Heap {
  private items: [number, string][] = [];
  get size() {
    return this.items.length;
  }
  push(item: [number, string]) {
    const h = this.items;
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p][0] < h[i][0] || (h[p][0] === h[i][0] && h[p][1] <= h[i][1])) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  }
  pop(): [number, string] {
    const h = this.items;
    const top = h[0];
    const last = h.pop()!;
    if (h.length) {
      h[0] = last;
      let i = 0;
      const less = (x: number, y: number) => h[x][0] < h[y][0] || (h[x][0] === h[y][0] && h[x][1] < h[y][1]);
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < h.length && less(l, m)) m = l;
        if (r < h.length && less(r, m)) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }
}

type Tree = { dist: Map<string, number>; prev: Map<string, { node: string; step: RouteStep }> };

/** Dijkstra from `from` by edge length, over edges `allow` accepts, up to `maxM`, stopping early at `stopAt`. */
const shortestTree = (adj: Adj, from: string, maxM: number, allow: (e: PedEdge) => boolean = () => true, stopAt?: string): Tree => {
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { node: string; step: RouteStep }>();
  const heap = new Heap();
  heap.push([0, from]);
  while (heap.size) {
    const [d, node] = heap.pop();
    if (d > (dist.get(node) ?? Infinity)) continue;
    if (node === stopAt) break;
    for (const { edge, to } of adj.get(node) ?? []) {
      if (!allow(edge)) continue;
      const nd = d + edge.lengthM;
      if (nd > maxM) continue;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, { node, step: { edgeId: edge.id, forward: edge.a === node } });
        heap.push([nd, to]);
      }
    }
  }
  return { dist, prev };
};

const stepsTo = (tree: Tree, from: string, to: string): RouteStep[] | null => {
  if (from === to) return [];
  if (!tree.prev.has(to)) return null;
  const out: RouteStep[] = [];
  for (let at = to; at !== from; ) {
    const p = tree.prev.get(at)!;
    out.push(p.step);
    at = p.node;
  }
  return out.reverse();
};

const lengthOf = (steps: readonly RouteStep[], byId: Map<string, PedEdge>) => steps.reduce((s, st) => s + byId.get(st.edgeId)!.lengthM, 0);

// ---------------------------------------------------------------------------------------------------------------
// DigitRouteGenerator
// ---------------------------------------------------------------------------------------------------------------

/** Directions of the streets leaving a junction, merged when within 12 degrees. */
const streetDirections = (p: Prep, node: string): XY[] => {
  const out: XY[] = [];
  const at = p.xy.get(node)!;
  for (const { edge } of p.adj.get(node) ?? []) {
    const pts = orientedXY(p, edge, node);
    // The direction the street sets off in: the point about 30 m along it.
    let walked = 0;
    let target = pts[pts.length - 1];
    for (let i = 1; i < pts.length; i++) {
      walked += norm(sub(pts[i], pts[i - 1]));
      if (walked >= 30) {
        target = pts[i];
        break;
      }
    }
    const dir = unit(sub(target, at));
    if (!out.some((d) => dot(d, dir) > Math.cos((12 * Math.PI) / 180))) out.push(dir);
  }
  return out;
};

/**
 * Junctions reached by following real streets straight out of `node` along `dir`: every point of every edge stays
 * close to the line and each edge moves along it. Returns each junction's distance along the line.
 */
const straightReach = (p: Prep, node: string, dir: XY, maxAlong: number): { node: string; along: number }[] => {
  const origin = p.xy.get(node)!;
  const found = new Map<string, number>();
  const seen = new Set<string>([node]);
  const stack = [node];
  while (stack.length) {
    const at = stack.pop()!;
    const fromAlong = dot(sub(p.xy.get(at)!, origin), dir);
    for (const { edge, to } of p.adj.get(at) ?? []) {
      if (seen.has(to)) continue;
      const pts = orientedXY(p, edge, at);
      let ok = true;
      for (const q of pts) {
        const rel = sub(q, origin);
        const along = dot(rel, dir);
        if (Math.abs(cross(rel, dir)) > 8 + 0.12 * Math.max(0, along) || along > maxAlong + 20) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const toAlong = dot(sub(p.xy.get(to)!, origin), dir);
      if (toAlong - fromAlong < 0.6 * edge.lengthM || toAlong > maxAlong) continue;
      seen.add(to);
      found.set(to, toAlong);
      stack.push(to);
    }
  }
  return [...found.entries()].map(([n, along]) => ({ node: n, along })).sort((a, b) => a.along - b.along || (a.node < b.node ? -1 : 1));
};

type Frame = { o: XY; r: XY; d: XY; w: number; hh: number };

const cornerXY = (f: Frame, c: Corner): XY => {
  const [i, j] = CORNER_AT[c];
  return add(f.o, add(mul(f.r, i * f.w), mul(f.d, j * f.hh)));
};

/** Where X sits in the frame, which way its two streets go, and how far the vertical one may reach. */
const ROLES: readonly { corner: Corner; horiz: 1 | -1; vert: 1 | -1; spans: readonly number[] }[] = [
  { corner: "TL", horiz: 1, vert: 1, spans: [1, 2] },
  { corner: "TR", horiz: -1, vert: 1, spans: [1, 2] },
  { corner: "BL", horiz: 1, vert: -1, spans: [1, 2] },
  { corner: "BR", horiz: -1, vert: -1, spans: [1, 2] },
  { corner: "ML", horiz: 1, vert: -1, spans: [1] },
  { corner: "ML", horiz: 1, vert: 1, spans: [1] },
  { corner: "MR", horiz: -1, vert: -1, spans: [1] },
  { corner: "MR", horiz: -1, vert: 1, spans: [1] },
];

/** Corners on a frame's right side, for a 1 drawn on one straight street: which way the street runs from X. */
const LINE_ROLES: readonly { corner: Corner; vert: 1 | -1; spans: readonly number[] }[] = [
  { corner: "TR", vert: 1, spans: [1, 2] },
  { corner: "MR", vert: 1, spans: [1] },
  { corner: "MR", vert: -1, spans: [1] },
  { corner: "BR", vert: -1, spans: [1, 2] },
];

/** A segment drawn on real streets: connected walkable edges along its line between its two corner junctions. */
type SegmentFit = { steps: RouteStep[]; lengthM: number; lineM: number; maxOffM: number; nodes: string[] };

const fitSegment = (p: Prep, a: string, b: string, rules: NumberRules): SegmentFit | null => {
  const A = p.xy.get(a)!;
  const B = p.xy.get(b)!;
  const lineM = norm(sub(B, A));
  if (lineM < rules.minSizeM * 0.6) return null;
  const dir = unit(sub(B, A));
  const half = Math.max(rules.corridorMinM, rules.corridorShare * lineM);
  // Edges whose whole geometry lies in the corridor around the segment's line.
  const inside = new Set<string>();
  const [minX, maxX] = [Math.min(A[0], B[0]) - half, Math.max(A[0], B[0]) + half];
  const [minY, maxY] = [Math.min(A[1], B[1]) - half, Math.max(A[1], B[1]) + half];
  for (let gx = Math.floor(minX / EDGE_CELL); gx <= Math.floor(maxX / EDGE_CELL); gx++)
    for (let gy = Math.floor(minY / EDGE_CELL); gy <= Math.floor(maxY / EDGE_CELL); gy++)
      for (const i of p.edgeGrid.get(`${gx}:${gy}`) ?? []) {
        const e = p.edges[i];
        if (inside.has(e.id)) continue;
        let ok = true;
        for (const q of p.exy.get(e.id)!) {
          const rx = q[0] - A[0];
          const ry = q[1] - A[1];
          const along = rx * dir[0] + ry * dir[1];
          if (Math.abs(rx * dir[1] - ry * dir[0]) > half || along < -half || along > lineM + half) {
            ok = false;
            break;
          }
        }
        if (ok) inside.add(e.id);
      }
  const tree = shortestTree(p.adj, a, lineM * rules.maxStretch, (e) => inside.has(e.id), b);
  const steps = stepsTo(tree, a, b);
  if (!steps || !steps.length) return null;
  const lengthM = lengthOf(steps, p.byId);
  if (lengthM > lineM * rules.maxStretch) return null;
  let maxOffM = 0;
  const nodes: string[] = [a];
  let at = a;
  for (const s of steps) {
    const e = p.byId.get(s.edgeId)!;
    for (const q of p.exy.get(e.id)!) maxOffM = Math.max(maxOffM, Math.abs(cross(sub(q, A), dir)));
    at = s.forward ? e.b : e.a;
    nodes.push(at);
  }
  return { steps, lengthM, lineM, maxOffM, nodes };
};

/**
 * Reads a digit back from walked geometry: for each of the seven template segments in the frame, how much of its line
 * lies along the walked streets. A segment is present when nearly all of it does, absent when almost none of its
 * middle does; anything in between is ambiguous and the reading fails. Returns the digit read (or null) and the
 * weakest present segment's share.
 */
export const readDigitGeometry = (frame: Frame, polylines: readonly (readonly XY[])[], rules: NumberRules = NUMBER_RULES): { digit: Digit | null; presentMin: number; shares: Record<Segment, number> } => {
  const tol = Math.max(rules.corridorMinM, rules.snapShare * Math.min(frame.w, frame.hh));
  // Bounding boxes first: most samples are nowhere near most polylines.
  const boxes = polylines.map((pl) => {
    let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of pl) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    return [x0 - tol, y0 - tol, x1 + tol, y1 + tol] as const;
  });
  const near = (q: XY) => polylines.some((pl, i) => q[0] >= boxes[i][0] && q[0] <= boxes[i][2] && q[1] >= boxes[i][1] && q[1] <= boxes[i][3] && distToPolyline(q, pl) <= tol);
  const present: Segment[] = [];
  const shares = {} as Record<Segment, number>;
  let presentMin = 1;
  let ambiguous = false;
  for (const s of SEGMENTS) {
    const [c1, c2] = SEGMENT_ENDS[s];
    const a = cornerXY(frame, c1);
    const b = cornerXY(frame, c2);
    // Nine samples along the line; the middle five decide absence.
    const hits = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => near([a[0] + ((b[0] - a[0]) * k) / 10, a[1] + ((b[1] - a[1]) * k) / 10]));
    const full = hits.filter(Boolean).length / 9;
    const middle = hits.slice(2, 7).filter(Boolean).length / 5;
    shares[s] = full;
    if (full >= rules.presentShare) {
      present.push(s);
      presentMin = Math.min(presentMin, full);
    } else if (middle > rules.absentShare) ambiguous = true;
  }
  return { digit: ambiguous ? null : decodeSegments(present), presentMin: present.length ? presentMin : 0, shares };
};

const frameOfPlacement = (f: DigitFrame, proj: ReturnType<typeof projector>): Frame => ({ o: proj.to(f.origin), r: f.right, d: f.down, w: f.widthM, hh: f.halfHeightM });

/** Readability, 0 to 100, from how far the real corners and streets sit from the ideal digit and its proportions. */
const readabilityOf = (frame: Frame, corners: Partial<Record<Corner, XY>>, fits: readonly SegmentFit[], presentMin: number) => {
  const size = Math.min(frame.w, frame.hh);
  const cs = Object.entries(corners) as [Corner, XY][];
  const cornerErr = cs.reduce((s, [c, q]) => s + norm(sub(q, cornerXY(frame, c))), 0) / (cs.length || 1) / size;
  const offErr = fits.reduce((s, f) => s + f.maxOffM / f.lineM, 0) / (fits.length || 1);
  const stretch = fits.reduce((s, f) => s + (f.lengthM / f.lineM - 1), 0) / (fits.length || 1);
  const aspect = Math.abs(Math.log(frame.hh / frame.w));
  const skew = Math.abs(deg(Math.acos(Math.max(-1, Math.min(1, dot(frame.r, frame.d))))) - 90) / 25;
  const penalty = 1.2 * cornerErr + 1.5 * offErr + 2.0 * stretch + 0.3 * aspect + 0.15 * skew;
  return Math.round(100 * presentMin * Math.max(0, 1 - penalty));
};

export type DigitSearch = { placements: Map<Digit, DigitPlacement[]>; frames: number };

/**
 * DigitRouteGenerator: every place near `start` where the real street network can draw each digit, best first.
 * `regionM` limits frame corners to that distance from the start.
 */
export const generateDigitRoutes = (graph: PedGraph, start: LatLng, minutes: number, rules: NumberRules = NUMBER_RULES, prefs: { avoidStairs?: boolean } = {}): DigitSearch => {
  const p = prepare(graph, start, prefs);
  return searchDigits(p, minutes, rules);
};

/** How far from the start digits may be placed. Matches the network fetched for this walking time. */
export const numberRegionM = (minutes: number, rules: NumberRules = NUMBER_RULES) => Math.min(1600, Math.round(minutes * 60 * rules.walkMps * 0.42 + 150));

/** For an exact-number search: a fixed region and size limit, and only the digits that number needs. */
/**
 * `maxLengthM`: placements longer than this can't fit the course, so they never take a kept slot.
 * `rings`: search outward in rings (ascending radii ending at `regionM`). Each ring is searched exactly as a search of
 * that radius alone would be, and later rings only add frames reaching beyond the previous ring, so a wider search
 * never loses what a narrower one finds (one flat search spends its frame budget differently and could).
 */
export type SearchOptions = { regionM?: number; maxSize?: number; digits?: readonly Digit[]; maxLengthM?: number; rings?: readonly number[] };

/** `checkedRadiusM`: every frame with all its corners this close to the start was examined (less than the region when a cap or the deadline cut the search short). */
export const searchDigits = (p: Prep, minutes: number, rules: NumberRules, stop: () => boolean = () => false, opts: SearchOptions = {}): DigitSearch & { truncated: boolean; capped: boolean; checkedRadiusM: number } => {
  let truncated = false;
  const target = targetLengthM(minutes, rules);
  const regionM = opts.regionM ?? numberRegionM(minutes, rules);
  const maxSize = opts.maxSize ?? Math.min(rules.maxSizeM, Math.max(rules.minSizeM * 1.5, target * rules.maxSizeShare));
  const onlyDigits = opts.digits ? new Set(opts.digits) : null;
  const minSize = rules.minSizeM;
  const proj = projector(p.origin);
  const cosSide = [Math.cos((rules.sideAngleDeg[1] * Math.PI) / 180), Math.cos((rules.sideAngleDeg[0] * Math.PI) / 180)];

  const rings = opts.rings?.length ? [...opts.rings].filter((r) => r <= regionM) : [regionM];
  if (rings[rings.length - 1] !== regionM) rings.push(regionM);
  let ringOuter = rings[0];
  let ringInner = 0;
  let ringIndex = 0;
  let frameKeys = new Set<string>();
  const fitCache = new Map<string, SegmentFit | null>();
  const fit = (a: string, b: string) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (!fitCache.has(key)) {
      // Fit once per pair, in a canonical direction; reverse on the way out.
      const [x, y] = a < b ? [a, b] : [b, a];
      fitCache.set(key, fitSegment(p, x, y, rules));
    }
    const f = fitCache.get(key)!;
    if (!f || a < b) return f;
    return { ...f, steps: [...f.steps].reverse().map((s) => ({ edgeId: s.edgeId, forward: !s.forward })), nodes: [...f.nodes].reverse() };
  };
  const placements = new Map<Digit, DigitPlacement[]>();
  /** The best placement per digit, stroke set and starting corner. */
  const bestByKey = new Map<string, DigitPlacement>();
  /** The ring each stroke set was first found in. */
  const ringOf = new Map<string, number>();
  let frames = 0;
  let ringFrames = 0;

  let rough = new Set<string>();
  const consider = (f: Frame) => {
    // A frame lying wholly inside an earlier ring was already examined there.
    if (ringInner > 0) {
      let far = 0;
      for (const c of ["TL", "TR", "ML", "MR", "BL", "BR"] as Corner[]) far = Math.max(far, norm(cornerXY(f, c)));
      if (far <= ringInner) return;
    }
    // The same frame is found from each of its corners: skip near-identical ones before any work.
    const roughKey = `${Math.round(f.o[0] / 4)},${Math.round(f.o[1] / 4)},${Math.round(f.r[0] * 20)},${Math.round(f.r[1] * 20)},${Math.round(f.d[0] * 20)},${Math.round(f.d[1] * 20)},${Math.round(f.w / 4)},${Math.round(f.hh / 4)}`;
    if (rough.has(roughKey)) return;
    rough.add(roughKey);
    // Every corner must be inside the search region and land on a junction.
    const tol = Math.max(rules.snapMinM, rules.snapShare * Math.min(f.w, f.hh));
    const corners: Partial<Record<Corner, string>> = {};
    for (const c of ["TL", "TR", "ML", "MR", "BL", "BR"] as Corner[]) {
      const at = cornerXY(f, c);
      if (norm(at) > ringOuter) continue;
      const n = nearestNode(p, at, tol);
      if (n) corners[c] = n;
    }
    const key = (["TL", "TR", "ML", "MR", "BL", "BR"] as Corner[]).map((c) => corners[c] ?? "-").join(",");
    if (frameKeys.has(key)) return;
    frameKeys.add(key);
    frames++;
    ringFrames++;
    // Distinct corners only: two corners on one junction would collapse a segment.
    const used = Object.values(corners);
    if (new Set(used).size !== used.length) return;

    const fits: Partial<Record<Segment, SegmentFit>> = {};
    for (const s of SEGMENTS) {
      const [c1, c2] = SEGMENT_ENDS[s];
      const a = corners[c1];
      const b = corners[c2];
      if (!a || !b) continue;
      const expected = s === "A" || s === "D" || s === "G" ? f.w : f.hh;
      const ft = fit(a, b);
      if (ft && ft.lineM >= expected * 0.6 && ft.lineM <= expected * 1.5) fits[s] = ft;
    }

    for (const digit of ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"] as Digit[]) {
      if (onlyDigits && !onlyDigits.has(digit)) continue;
      const segs = DIGIT_SEGMENTS[digit];
      if (!segs.every((s) => fits[s])) continue;
      // Segments share nothing but their corners.
      const edgeSeen = new Set<string>();
      const nodeOwner = new Map<string, Segment>();
      let clean = true;
      for (const s of segs) {
        const ft = fits[s]!;
        for (const st of ft.steps) {
          if (edgeSeen.has(st.edgeId)) clean = false;
          edgeSeen.add(st.edgeId);
        }
        ft.nodes.slice(1, -1).forEach((n) => {
          if (nodeOwner.has(n) || used.includes(n)) clean = false;
          nodeOwner.set(n, s);
        });
      }
      if (!clean) continue;
      const strokeKey = `${digit}:${[...edgeSeen].sort().join(",")}`;

      const cornersUsed = cornersOf(digit);
      const cornerXYs: Partial<Record<Corner, XY>> = {};
      cornersUsed.forEach((c) => (cornerXYs[c] = p.xy.get(corners[c]!)!));
      const polylines = segs.map((s) => fits[s]!.steps.flatMap((st) => orientedXY(p, p.byId.get(st.edgeId)!, st.forward ? p.byId.get(st.edgeId)!.a : p.byId.get(st.edgeId)!.b)));
      const read = readDigitGeometry(f, polylines, rules);
      if (read.digit !== digit) continue;
      const readability = readabilityOf(f, cornerXYs, segs.map((s) => fits[s]!), read.presentMin);
      if (readability < rules.minReadability) continue;

      const segLen = (s: Segment) => fits[s]?.lengthM ?? Infinity;
      for (const w of digitWalks(digit, segLen)) {
        if (w.repeatedM / w.lengthM > rules.maxRepeatShare) continue;
        const key = `${strokeKey}:${w.start}`;
        const current = bestByKey.get(key);
        if (current && current.readability >= readability) continue;
        if (!ringOf.has(key)) ringOf.set(key, ringIndex);
        bestByKey.set(key, {
          digit,
          frame: { origin: proj.from(f.o), right: f.r, down: f.d, widthM: Math.round(f.w * 10) / 10, halfHeightM: Math.round(f.hh * 10) / 10 },
          corners: Object.fromEntries(cornersUsed.map((c) => [c, corners[c]!])),
          segments: Object.fromEntries(segs.map((s) => [s, fits[s]!.steps])),
          walk: { start: w.start, end: w.end, strokes: w.strokes },
          strokeEdgeIds: [...edgeSeen].sort(),
          lengthM: w.lengthM,
          repeatedM: w.repeatedM,
          turns: w.turns,
          readability,
        });
      }
    }
  };

  // Nearest junctions first, so a capped search always covers the streets closest to the player.
  const order = p.nodes
    .map((n) => ({ n, d: norm(p.xy.get(n.id)!) }))
    .filter((x) => x.d <= regionM)
    .sort((a, b) => a.d - b.d || (a.n.id < b.n.id ? -1 : 1));
  let capped = false;
  let checkedRadiusM = 0;
  // A capped ring leaves a gap: later rings still add placements, but the fully checked radius stops growing.
  let gap = false;
  for (ringIndex = 0; ringIndex < rings.length && !truncated; ringIndex++) {
    ringOuter = rings[ringIndex];
    ringInner = ringIndex ? rings[ringIndex - 1] : 0;
    rough = new Set<string>();
    frameKeys = new Set<string>();
    ringFrames = 0;
    let lastDone = ringInner;
    let ringCapped = false;
    for (const { n, d: nodeDist } of order) {
      if (nodeDist > ringOuter) break;
      if (ringFrames >= rules.maxFrames) {
        capped = ringCapped = true;
        break;
      }
      if (stop()) {
        truncated = true;
        break;
      }
      searchFrom(n);
      lastDone = Math.max(lastDone, nodeDist);
    }
    // Every frame with all corners within the last fully processed junction's distance has been seen.
    if (!gap) checkedRadiusM = truncated || ringCapped ? Math.max(checkedRadiusM, Math.min(ringOuter, lastDone)) : ringOuter;
    if (truncated || ringCapped) gap = true;
  }

  function searchFrom(n: { id: string }) {
    const X = p.xy.get(n.id)!;
    const dirs = streetDirections(p, n.id);
    if (dirs.length < 1) return;
    const reach = new Map<number, { node: string; along: number }[]>();
    const reachOf = (i: number, max: number) => {
      if (!reach.has(i)) reach.set(i, straightReach(p, n.id, dirs[i], max));
      return reach.get(i)!;
    };
    const sizes = (i: number, lo: number, hi: number) => reachOf(i, 2 * maxSize).filter((r) => r.along >= lo && r.along <= hi).slice(0, 6);

    for (let iu = 0; iu < dirs.length; iu++)
      for (let iv = 0; iv < dirs.length; iv++) {
        if (iu === iv) continue;
        const u = dirs[iu];
        const v = dirs[iv];
        const c = dot(u, v);
        if (c < cosSide[0] || c > cosSide[1]) continue;
        for (const role of ROLES) {
          const r = mul(u, role.horiz);
          const d = mul(v, role.vert);
          if (Math.abs(deg(Math.atan2(r[1], r[0]))) > rules.maxRotationDeg) continue;
          if (cross(r, d) >= 0) continue; // a mirrored frame would draw mirrored digits
          const [ci, cj] = CORNER_AT[role.corner];
          for (const a of sizes(iu, minSize, maxSize))
            for (const b of sizes(iv, minSize, 2 * maxSize))
              for (const span of role.spans) {
                const w = a.along;
                const hh = b.along / span;
                if (hh < minSize || hh > maxSize) continue;
                const ratio = hh / w;
                if (ratio < rules.aspect[0] || ratio > rules.aspect[1]) continue;
                const o = sub(X, add(mul(r, ci * w), mul(d, cj * hh)));
                consider({ o, r, d, w, hh });
              }
        }
      }

    // A straight street through X can draw a 1 (the right side of a frame) even with no corner at X.
    for (let iv = 0; iv < dirs.length; iv++)
      for (const role of LINE_ROLES) {
        const d = mul(dirs[iv], role.vert);
        const r: XY = [-d[1], d[0]]; // "down" turned a quarter anticlockwise is "right"
        if (Math.abs(deg(Math.atan2(r[1], r[0]))) > rules.maxRotationDeg) continue;
        const [ci, cj] = CORNER_AT[role.corner];
        for (const b of sizes(iv, minSize, 2 * maxSize))
          for (const span of role.spans) {
            const hh = b.along / span;
            if (hh < minSize || hh > maxSize) continue;
            consider({ o: sub(X, add(mul(r, ci * hh), mul(d, cj * hh))), r, d, w: hh, hh });
          }
      }
  }

  // Kept placements are chosen ring by ring, earlier rings first, so an outer ring never displaces what an inner ring
  // kept (a narrower search keeps exactly the same placements).
  const byRing = new Map<number, Map<Digit, DigitPlacement[]>>();
  for (const [key, pl] of bestByKey) {
    if (opts.maxLengthM != null && pl.lengthM > opts.maxLengthM) continue;
    const ring = ringOf.get(key) ?? 0;
    const m = byRing.get(ring) ?? byRing.set(ring, new Map()).get(ring)!;
    (m.get(pl.digit) ?? m.set(pl.digit, []).get(pl.digit)!).push(pl);
  }
  const keptByDigit = new Map<Digit, { pl: DigitPlacement; c: XY }[]>();
  for (const ring of [...byRing.keys()].sort((a, b) => a - b))
    for (const [digit, list] of byRing.get(ring)!) {
      list.sort((a, b) => b.readability - a.readability || a.lengthM - b.lengthM || (a.strokeEdgeIds.join() < b.strokeEdgeIds.join() ? -1 : 1) || (a.walk.start < b.walk.start ? -1 : 1));
      // Keep a spread of places, not the same block found many times: at most a few placements per neighbourhood.
      const kept = keptByDigit.get(digit) ?? keptByDigit.set(digit, []).get(digit)!;
      let added = 0;
      for (const pl of list) {
        if (added >= rules.perDigit) break;
        const f = frameOfPlacement(pl.frame, proj);
        const c = add(f.o, add(mul(f.r, f.w / 2), mul(f.d, f.hh)));
        if (kept.filter((k) => norm(sub(k.c, c)) < rules.spreadM).length >= rules.perSpot) continue;
        kept.push({ pl, c });
        added++;
      }
    }
  for (const [digit, kept] of keptByDigit) placements.set(digit, kept.map((k) => k.pl));
  return { placements, frames, truncated, capped, checkedRadiusM };
};

// ---------------------------------------------------------------------------------------------------------------
// TwoDigitRoutePlanner
// ---------------------------------------------------------------------------------------------------------------

/** The steps of a placement's walk, stroke by stroke, labelled. */
export const placementLegs = (pl: DigitPlacement, digit: 0 | 1): PlanLeg[] =>
  pl.walk.strokes.flatMap((st) => {
    const steps = pl.segments[st.segment]!;
    const forward = SEGMENT_ENDS[st.segment][0] === st.from;
    const ordered = forward ? steps : [...steps].reverse().map((s) => ({ edgeId: s.edgeId, forward: !s.forward }));
    return ordered.map((s) => ({ part: "digit" as const, digit, segment: st.segment, repeat: st.repeat, edgeId: s.edgeId, forward: s.forward }));
  });

const frameCorners = (f: Frame): XY[] => [cornerXY(f, "TL"), cornerXY(f, "TR"), cornerXY(f, "BR"), cornerXY(f, "BL")];

/** Whether two frames' outlines overlap (separating axis test on the two parallelograms). */
const framesOverlap = (a: Frame, b: Frame) => {
  const pa = frameCorners(a);
  const pb = frameCorners(b);
  for (const poly of [pa, pb])
    for (let i = 0; i < 4; i++) {
      const e = sub(poly[(i + 1) % 4], poly[i]);
      const axis: XY = [-e[1], e[0]];
      const ra = pa.map((q) => dot(q, axis));
      const rb = pb.map((q) => dot(q, axis));
      if (Math.max(...ra) < Math.min(...rb) || Math.max(...rb) < Math.min(...ra)) return false;
    }
  return true;
};

/** Digit two's frame in digit one's frame units: where its top-left corner sits. */
const relative = (a: Frame, q: XY): XY => {
  const rel = sub(q, a.o);
  const det = cross(mul(a.r, a.w), mul(a.d, a.hh));
  return [cross(rel, mul(a.d, a.hh)) / det, cross(mul(a.r, a.w), rel) / det];
};

/** Digit two reads after digit one: its centre lies further along digit one's "right", not far above or below it. */
const readsInOrder = (a: Frame, b: Frame, rules: NumberRules) => {
  const cb = add(b.o, add(mul(b.r, b.w / 2), mul(b.d, b.hh)));
  const ca = add(a.o, add(mul(a.r, a.w / 2), mul(a.d, a.hh)));
  const [x, y] = relative(a, cb);
  // The map is north-up, so on screen digit two must also sit to the right of digit one, not above or below it.
  const screen = Math.abs(deg(Math.atan2(cb[1] - ca[1], cb[0] - ca[0])));
  return x >= rules.orderMinX && Math.abs(y - 1) <= rules.orderMaxRise && screen <= rules.orderMaxAngleDeg;
};

/** Stroke geometry of a placement in local metres, with its bounding box. */
const strokeShape = (p: Prep, pl: DigitPlacement) => {
  const lines = Object.values(pl.segments).map((steps) => steps!.flatMap((st) => orientedXY(p, p.byId.get(st.edgeId)!, st.forward ? p.byId.get(st.edgeId)!.a : p.byId.get(st.edgeId)!.b)));
  const all = lines.flat();
  const xs = all.map((q) => q[0]);
  const ys = all.map((q) => q[1]);
  return { lines, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as const };
};

/** The closest the two digits' strokes come to each other, in metres (Infinity when far apart). */
const digitGap = (a: ReturnType<typeof strokeShape>, b: ReturnType<typeof strokeShape>, within: number) => {
  if (a.box[0] - within > b.box[2] || b.box[0] - within > a.box[2] || a.box[1] - within > b.box[3] || b.box[1] - within > a.box[3]) return Infinity;
  let best = Infinity;
  for (const [from, to] of [
    [a, b],
    [b, a],
  ] as const)
    for (const line of from.lines)
      for (let i = 0; i < line.length; i++) {
        // Vertices and midpoints of every piece of one digit against the other digit's lines.
        const q = line[i];
        const mids = i ? [q, [(q[0] + line[i - 1][0]) / 2, (q[1] + line[i - 1][1]) / 2] as XY] : [q];
        for (const m of mids) for (const l of to.lines) best = Math.min(best, distToPolyline(m, l));
      }
  return best;
};

const layoutOf = (a: Frame, b: Frame, rules: NumberRules): NumberLayout => {
  const [x, y] = relative(a, b.o);
  const angle = deg(Math.acos(Math.max(-1, Math.min(1, dot(a.r, b.r)))));
  const size = b.hh / a.hh;
  return x >= rules.sideGap[0] && x <= rules.sideGap[1] && Math.abs(y) <= rules.sideRise && angle <= rules.sideAngleMaxDeg && size >= rules.sideSize[0] && size <= rules.sideSize[1]
    ? "side_by_side"
    : "separate";
};

/**
 * The public start for a race: the nearest walkable junction within `maxStartSnapM` on a connected piece of network
 * at least twice the longest race. Smaller pieces (a station plaza, a courtyard, an island of footpaths) could never
 * reach both digits, so they are never offered.
 */
export const startJunction = (p: Prep, start: LatLng, maxRace: number, rules: NumberRules): { nodeId: string; snapM: number } | { reason: NumberFailure } => {
  const piece = new Map<string, number>();
  const pieceLength: number[] = [];
  for (const n of p.nodes) {
    if (piece.has(n.id)) continue;
    const id = pieceLength.length;
    let total = 0;
    const stack = [n.id];
    piece.set(n.id, id);
    while (stack.length) {
      const at = stack.pop()!;
      for (const { edge, to } of p.adj.get(at) ?? []) {
        if (edge.a === at) total += edge.lengthM; // each edge counted once, from its first end
        if (!piece.has(to)) {
          piece.set(to, id);
          stack.push(to);
        }
      }
    }
    pieceLength.push(total);
  }

  // A public start: the nearest walkable junction on a big enough piece, close enough to walk to without crossing
  // anything unknown.
  let startNode: string | null = null;
  let snap = Infinity;
  for (const n of p.nodes) {
    if (pieceLength[piece.get(n.id)!] < 2 * maxRace) continue; // digits use only some of a piece's streets
    const d = metersBetween(start, n);
    if (d < snap) {
      snap = d;
      startNode = n.id;
    }
  }
  if (!startNode || snap > rules.maxStartSnapM) {
    // Junctions nearby, but only on pieces too small for a race: the streets here can't hold a number.
    const anyNear = p.nodes.some((n) => metersBetween(start, n) <= rules.maxStartSnapM);
    return { reason: anyNear ? "no_number_routes" : "no_public_start" };
  }
  return { nodeId: startNode, snapM: snap };
};

/** The junction a race from `start` would begin at, or why there is none. Cheap: no digit search. Used to key caches. */
export const numberStartNode = (graph: PedGraph, req: Pick<NumberRequest, "start" | "minutes" | "avoidStairs">, rules: NumberRules = NUMBER_RULES) => {
  const p = prepare(graph, req.start, { avoidStairs: req.avoidStairs });
  if (!p.edges.length) return { reason: "no_network" as NumberFailure };
  return startJunction(p, req.start, targetLengthM(req.minutes, rules) * rules.maxShare, rules);
};

type Reject = (why: string) => void;

/**
 * Everything the pairing and single-digit rules need around one start junction. Shared by the random planner (nearby
 * races) and the exact-number finder (practice and online), so both apply the same rules.
 */
export const courseContext = (
  p: Prep,
  rules: NumberRules,
  o: { startNode: string; target: number; minRace: number; maxRace: number; maxConnector: number; maxApproachM: number; reject: Reject },
) => {
  const { startNode, target, minRace, maxRace, maxConnector, reject } = o;
  const approach = shortestTree(p.adj, startNode, o.maxApproachM);
  const proj = projector(p.origin);
  const frameOf = (pl: DigitPlacement) => frameOfPlacement(pl.frame, proj);
  const startOf = (pl: DigitPlacement) => pl.corners[pl.walk.start]!;
  const endOf = (pl: DigitPlacement) => pl.corners[pl.walk.end]!;
  const shapes = new Map<DigitPlacement, ReturnType<typeof strokeShape>>();
  const shapeOf = (pl: DigitPlacement) => shapes.get(pl) ?? shapes.set(pl, strokeShape(p, pl)).get(pl)!;
  let pairsRouted = 0;
  /** Metres of a connector within GPS range of either digit's strokes (crossing a stroke costs about twice that range). */
  const alongStrokes = (steps: readonly RouteStep[], digits: ReturnType<typeof strokeShape>[]) => {
    let near = 0;
    for (const st of steps) {
      const e = p.byId.get(st.edgeId)!;
      const pts = p.exy.get(e.id)!;
      for (let i = 1; i < pts.length; i++) {
        const len = norm(sub(pts[i], pts[i - 1]));
        const n = Math.max(1, Math.ceil(len / 5));
        for (let j = 0; j < n; j++) {
          const q: XY = [pts[i - 1][0] + ((pts[i][0] - pts[i - 1][0]) * (j + 0.5)) / n, pts[i - 1][1] + ((pts[i][1] - pts[i - 1][1]) * (j + 0.5)) / n];
          if (digits.some((d) => q[0] >= d.box[0] - 15 && q[0] <= d.box[2] + 15 && q[1] >= d.box[1] - 15 && q[1] <= d.box[3] + 15 && d.lines.some((l) => distToPolyline(q, l) <= 15))) near += len / n;
        }
      }
    }
    return near;
  };
  /** The walk from the start junction to a digit's first corner, keeping off the given strokes where it can. */
  const approachTo = (pl: DigitPlacement, strokes: Set<string>) => {
    const around = shortestTree(p.adj, startNode, o.maxApproachM * 1.5, (e) => !strokes.has(e.id), startOf(pl));
    return stepsTo(around, startNode, startOf(pl)) ?? stepsTo(approach, startNode, startOf(pl));
  };

  /** Cheap checks of a pair before any routing: the reason it fails, or what the pair looks like. */
  const prePair = (one: DigitPlacement, two: DigitPlacement) => {
    const e1 = new Set(one.strokeEdgeIds);
    if (two.strokeEdgeIds.some((id) => e1.has(id))) return reject("shared_streets"), null;
    const f1 = frameOf(one);
    const f2 = frameOf(two);
    if (framesOverlap(f1, f2)) return reject("overlap"), null;
    if (!readsInOrder(f1, f2, rules)) return reject("reads_backwards"), null;
    const sizeRatio = f2.hh / f1.hh;
    // A big digit beside a small one doesn't read as one number.
    if (sizeRatio < rules.sizeMatch[0] || sizeRatio > rules.sizeMatch[1]) return reject("sizes_differ"), null;
    const gap = norm(sub(p.xy.get(endOf(one))!, p.xy.get(startOf(two))!));
    if (gap > maxConnector || gap < 1) return reject("too_far_apart"), null;
    const low = one.lengthM + gap + two.lengthM;
    if (low > maxRace) return reject("too_long"), null;
    const layout = layoutOf(f1, f2, rules);
    // An upper bound on the plan's score: the connector can only be longer than the straight gap.
    const bestRace = Math.max(low, Math.min(maxRace, 0.85 * target));
    return { layout, optimistic: planScore(one, two, layout, bestRace, gap, approach.dist.get(startOf(one)) ?? 0, target) };
  };

  /** The full plan for a pair, or null with the reason counted. */
  const buildPair = (number: string, one: DigitPlacement, two: DigitPlacement, layout: NumberLayout): NumberPlan | null => {
    const sizes = Math.min(one.frame.widthM, one.frame.halfHeightM, two.frame.widthM, two.frame.halfHeightM);
    // Touching digits read as one shape.
    if (digitGap(shapeOf(one), shapeOf(two), 60) < Math.max(rules.minDigitGapM, rules.minDigitGapShare * sizes)) return reject("digits_touch"), null;
    pairsRouted++;
    const strokes = new Set([...one.strokeEdgeIds, ...two.strokeEdgeIds]);
    const from = endOf(one);
    const to = startOf(two);
    // The connector walks real streets that are not part of either digit, so it can never read as a stroke.
    const tree = shortestTree(p.adj, from, maxConnector, (e) => !strokes.has(e.id), to);
    const connector = stepsTo(tree, from, to);
    if (!connector || !connector.length) return reject("no_connector"), null;
    // Never alongside a stroke: GPS there couldn't tell walking the connector from walking the digit.
    if (alongStrokes(connector, [shapeOf(one), shapeOf(two)]) > rules.maxConnectorAlongM) return reject("connector_along_digit"), null;
    const connectorM = lengthOf(connector, p.byId);
    const raceM = one.lengthM + connectorM + two.lengthM;
    if (raceM < minRace || raceM > maxRace) return reject(raceM < minRace ? "too_short" : "too_long"), null;
    // The walk to the start keeps off both digits where it can, so nothing is traced before the race begins.
    const approachSteps = approachTo(one, strokes);
    if (!approachSteps) return reject("first_digit_too_far"), null;
    const approachM = lengthOf(approachSteps, p.byId);
    const legs: PlanLeg[] = [
      ...approachSteps.map((s) => ({ part: "approach" as const, edgeId: s.edgeId, forward: s.forward })),
      ...placementLegs(one, 0),
      ...connector.map((s) => ({ part: "connector" as const, edgeId: s.edgeId, forward: s.forward })),
      ...placementLegs(two, 1),
    ];
    return {
      number,
      algorithm: NUMBER_ALGORITHM,
      layout,
      approachFromNodeId: startNode,
      startNodeId: startOf(one),
      legs,
      digits: [one, two],
      approachM: Math.round(approachM),
      connectorM: Math.round(connectorM),
      digitM: [Math.round(one.lengthM), Math.round(two.lengthM)],
      raceM: Math.round(raceM),
      minutes: Math.max(1, Math.round(raceM / rules.walkMps / 60)),
      headingDeg: headingOf([one, two]),
      difficulty: difficultyOf([one, two].map((d) => ({ strokes: d.walk.strokes, turns: d.turns }))),
      score: planScore(one, two, layout, raceM, connectorM, approachM, target),
    };
  };

  /** A single-digit number (1 to 9): one digit, no connector. */
  const buildSingle = (number: string, one: DigitPlacement): NumberPlan | null => {
    const raceM = one.lengthM;
    if (raceM < minRace || raceM > maxRace) return reject(raceM < minRace ? "too_short" : "too_long"), null;
    const approachSteps = approachTo(one, new Set(one.strokeEdgeIds));
    if (!approachSteps) return reject("first_digit_too_far"), null;
    const approachM = lengthOf(approachSteps, p.byId);
    return {
      number,
      algorithm: NUMBER_ALGORITHM,
      layout: "single",
      approachFromNodeId: startNode,
      startNodeId: startOf(one),
      legs: [...approachSteps.map((s) => ({ part: "approach" as const, edgeId: s.edgeId, forward: s.forward })), ...placementLegs(one, 0)],
      digits: [one],
      approachM: Math.round(approachM),
      connectorM: 0,
      digitM: [Math.round(one.lengthM)],
      raceM: Math.round(raceM),
      minutes: Math.max(1, Math.round(raceM / rules.walkMps / 60)),
      headingDeg: headingOf([one]),
      difficulty: difficultyOf([{ strokes: one.walk.strokes, turns: one.turns }]),
      score: Math.round((one.readability - 0.15 * tilt(one) - 25 * Math.abs(raceM / target - 0.85) - approachM / 100) * 100) / 100,
    };
  };

  /**
   * Exact-length courses: makes up the gap to `exactM` with a finish stretch after the last digit, so courses in
   * different places can be the same length. The stretch is the shortest real walk to a finish corner whose distance
   * lands within `tolM` of the gap. It never uses a stroke or the connector, never runs alongside a stroke (GPS there
   * couldn't tell the two apart), and prefers corners leading away from the number. Null when no corner fits.
   */
  const withFinish = (plan: NumberPlan, exactM: number, tolM: number): NumberPlan | null => {
    const gap = exactM - plan.raceM;
    if (Math.abs(gap) <= tolM) return { ...plan, finishM: 0 };
    if (gap < 0) return reject("too_long"), null;
    if (gap > exactM * rules.maxFinishShare) return reject("too_short"), null;
    const last = plan.digits[plan.digits.length - 1];
    const from = endOf(last);
    const blocked = new Set([...plan.digits.flatMap((d) => d.strokeEdgeIds), ...plan.legs.filter((l) => l.part === "connector").map((l) => l.edgeId)]);
    const tree = shortestTree(p.adj, from, gap + tolM, (e) => !blocked.has(e.id));
    const shapesOf = plan.digits.map(shapeOf);
    const box = shapesOf.reduce((b, sh) => [Math.min(b[0], sh.box[0]), Math.min(b[1], sh.box[1]), Math.max(b[2], sh.box[2]), Math.max(b[3], sh.box[3])], [Infinity, Infinity, -Infinity, -Infinity]);
    const centre: XY = [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    const options = [...tree.dist.entries()]
      .filter(([node, d]) => node !== from && Math.abs(d - gap) <= tolM)
      .map(([node, d]) => ({ node, d, away: norm(sub(p.xy.get(node)!, centre)) }))
      .sort((a, b) => b.away - a.away || Math.abs(a.d - gap) - Math.abs(b.d - gap) || (a.node < b.node ? -1 : 1));
    for (const o of options.slice(0, 16)) {
      const steps = stepsTo(tree, from, o.node);
      if (!steps?.length) continue;
      if (alongStrokes(steps, shapesOf) > rules.maxConnectorAlongM) continue;
      const finishM = lengthOf(steps, p.byId);
      const raceM = plan.raceM + finishM;
      return {
        ...plan,
        legs: [...plan.legs, ...steps.map((st) => ({ part: "finish" as const, edgeId: st.edgeId, forward: st.forward }))],
        finishM: Math.round(finishM),
        finishNodeId: o.node,
        raceM: Math.round(raceM),
        minutes: Math.max(1, Math.round(raceM / rules.walkMps / 60)),
      };
    }
    return reject(options.length ? "finish_along_digit" : "no_finish_stretch"), null;
  };

  return { approach, startOf, prePair, buildPair, buildSingle, withFinish, routed: () => pairsRouted };
};

/**
 * TwoDigitRoutePlanner: the best plan for every two-digit number the streets near `start` can draw within the time.
 * Numbers with no plan are left out; they are never approximated.
 */
export const planNumberRoutes = (graph: PedGraph, req: NumberRequest, rules: NumberRules = NUMBER_RULES): NumberPlanResult => {
  const algorithm = NUMBER_ALGORITHM;
  const p = prepare(graph, req.start, { avoidStairs: req.avoidStairs });
  const empty = (reason: NumberFailure, stats = { frames: 0, placements: 0, pairsRouted: 0 }): NumberPlanResult => ({ ok: false, algorithm, reason, plans: [], digits: [], stats });
  if (!p.edges.length) return empty("no_network");

  const target = targetLengthM(req.minutes, rules);
  const [minRace, maxRace] = [target * rules.minShare, target * rules.maxShare];
  const maxConnector = Math.min(rules.maxConnectorM, target * rules.maxConnectorShare);

  const found = startJunction(p, req.start, maxRace, rules);
  if ("reason" in found) return empty(found.reason);

  const clock = req.clock ?? Date.now;
  const late = () => req.deadlineAt != null && clock() > req.deadlineAt;
  const { placements, frames, truncated } = searchDigits(p, req.minutes, rules, late);
  const placementCount = [...placements.values()].reduce((s, l) => s + l.length, 0);

  /** Why pairs were turned down, for reports and the "why nothing here" explanation. */
  const rejected: Record<string, number> = {};
  const reject = (why: string) => void (rejected[why] = (rejected[why] ?? 0) + 1);
  const ctx = courseContext(p, rules, { startNode: found.nodeId, target, minRace, maxRace, maxConnector, maxApproachM: rules.maxApproachM, reject });
  const plans: NumberPlan[] = [];
  for (const number of ALL_NUMBERS) {
    if (late()) return { ok: false, algorithm, reason: "timeout", plans: [], digits: [], stats: { frames, placements: placementCount, pairsRouted: ctx.routed(), rejected, truncated: true } };
    const [a, b] = [number[0] as Digit, number[1] as Digit];
    const firsts = (placements.get(a) ?? []).filter((pl) => ctx.approach.dist.has(ctx.startOf(pl))).slice(0, rules.firstsPerNumber);
    if (!firsts.length) reject((placements.get(a) ?? []).length ? "first_digit_too_far" : "digit_not_drawable");
    const seconds = (placements.get(b) ?? []).slice(0, rules.secondsPerNumber);
    const pairs: { one: DigitPlacement; two: DigitPlacement; layout: NumberLayout; optimistic: number }[] = [];
    for (const one of firsts)
      for (const two of seconds) {
        const pre = ctx.prePair(one, two);
        if (pre) pairs.push({ one, two, ...pre });
      }
    pairs.sort((x, y) => y.optimistic - x.optimistic);
    let best: NumberPlan | null = null;
    for (const pair of pairs.slice(0, rules.pairEvaluations)) {
      if (best && pair.optimistic <= best.score) break; // nothing left can beat it
      const plan = ctx.buildPair(number, pair.one, pair.two, pair.layout);
      if (plan && (!best || plan.score > best.score)) best = plan;
    }
    // Never offered unless it passes the independent check.
    if (best && validateNumberPlan(best, graph, rules, { avoidStairs: req.avoidStairs })) reject("failed_check");
    else if (best) plans.push(best);
  }
  // Single digits (0 to 9) are numbers too. They join the draw when their walk fits the race; and if nothing else can be
  // drawn here at all, a shorter single-digit course is still offered, so a race can go ahead on any one number.
  const singles = (c: typeof ctx) => {
    for (const d of DIGITS) {
      if (late()) return;
      const firsts = (placements.get(d) ?? []).filter((pl) => c.approach.dist.has(c.startOf(pl))).slice(0, rules.firstsPerNumber);
      let best: NumberPlan | null = null;
      for (const one of firsts) {
        const plan = c.buildSingle(d, one);
        if (plan && (!best || plan.score > best.score)) best = plan;
      }
      if (best && !validateNumberPlan(best, graph, rules, { avoidStairs: req.avoidStairs })) plans.push(best);
    }
  };
  singles(ctx);
  if (!plans.length) singles(courseContext(p, rules, { startNode: found.nodeId, target, minRace: 0, maxRace, maxConnector, maxApproachM: rules.maxApproachM, reject }));

  const digits = ([...placements.keys()] as Digit[]).sort();
  const stats = { frames, placements: placementCount, pairsRouted: ctx.routed(), rejected, ...(truncated ? { truncated } : {}) };
  if (!plans.length) return { ok: false, algorithm, reason: "no_number_routes", plans: [], digits, stats };
  return { ok: true, algorithm, reason: null, plans, digits, stats };
};

// ---------------------------------------------------------------------------------------------------------------
// NumberRouteFinder: one exact number, nearest first
// ---------------------------------------------------------------------------------------------------------------

export type FindRequest = {
  start: LatLng;
  /** Canonical 0 to 99 (see numberInput.ts). */
  number: string;
  /** Digits are placed, and the walk to them measured, within this distance of the start. */
  radiusM: number;
  /** Wanted course length (the timed part) and how far from it a course may be, as a share. Omit for any length. */
  targetM?: number;
  bandShare?: number;
  /**
   * Online races: every course must be `targetM` long (within 0.8%), made up by a finish stretch where the number
   * falls short. Without it, `bandShare` is simply how far from the target a course may be.
   */
  exact?: boolean;
  avoidStairs?: boolean;
  /** At most this many alternatives, nearest first. */
  alternatives?: number;
  deadlineAt?: number;
  clock?: () => number;
};

export type FindResult = {
  ok: boolean;
  algorithm: string;
  number: string;
  reason: NumberFailure | null;
  /** Feasible courses for exactly this number, by walking distance to their start, nearest first. */
  plans: NumberPlan[];
  stats: { frames: number; placements: number; pairsRouted: number; rejected: Record<string, number>; truncated?: boolean };
};

/** Course-length window when none is asked for: long enough to be a walk, short enough to be a dog walk. */
export const ANY_LENGTH: readonly [number, number] = [150, 4_000];

/**
 * Finds real courses for one requested number near `start`: only that number's digits are searched for, digits are
 * placed within `radiusM`, and candidates are ranked by the walking distance (on the pedestrian graph, never straight
 * line) from the start junction to the course. Every candidate passes the independent validator. Nothing is ever
 * substituted: no course for this number means an honest empty result.
 */
export const findNumberRoutes = (graph: PedGraph, req: FindRequest, rules: NumberRules = NUMBER_RULES): FindResult => {
  const algorithm = NUMBER_ALGORITHM;
  const rejected: Record<string, number> = {};
  const reject = (why: string) => void (rejected[why] = (rejected[why] ?? 0) + 1);
  const empty = (reason: NumberFailure, stats: Partial<FindResult["stats"]> = {}): FindResult => ({ ok: false, algorithm, number: req.number, reason, plans: [], stats: { frames: 0, placements: 0, pairsRouted: 0, rejected, ...stats } });
  if (!/^([0-9]|[1-9][0-9])$/.test(req.number)) return empty("no_number_routes");
  const p = prepare(graph, req.start, { avoidStairs: req.avoidStairs });
  if (!p.edges.length) return empty("no_network");

  const band = req.bandShare ?? 0.02;
  // Exact length: the digits and connector may fall short, and a finish stretch makes up the rest (withFinish).
  const isExact = Boolean(req.exact && req.targetM);
  const tolM = isExact ? Math.min(band, rules.finishTolShare) * req.targetM! : 0;
  const [minRace, maxRace] = isExact
    ? [req.targetM! * (1 - rules.maxFinishShare), req.targetM! + tolM]
    : req.targetM
      ? [req.targetM * (1 - band), req.targetM * (1 + band)]
      : ANY_LENGTH;
  const exact = (plan: NumberPlan | null) => (plan && isExact ? ctx.withFinish(plan, req.targetM!, tolM) : plan);
  const target = req.targetM ?? 1_500;
  const two = req.number.length === 2;
  // Two digits share the course with a connector: each digit is at most a fair share of it.
  // Digit size follows the course length (a 25-minute course when none is asked for, as nearby races size them):
  // bigger frames would crowd out the smaller ones that actually pair up.
  const sizing = req.targetM ?? targetLengthM(25, rules);
  const maxSize = Math.min(rules.maxSizeM, Math.max(rules.minSizeM * 1.5, (two ? rules.maxSizeShare : rules.maxSizeShare * 2.5) * sizing));
  const maxConnector = Math.min(rules.maxConnectorM, maxRace * rules.maxConnectorShare);

  // The start junction: a piece of network big enough for the course (a plaza or island never qualifies).
  // (startJunction keeps pieces at least twice its third argument: here, at least the shortest allowed course.)
  const found = startJunction(p, req.start, Math.max(minRace, ANY_LENGTH[0]) / 2, rules);
  if ("reason" in found) return empty(found.reason);

  const clock = req.clock ?? Date.now;
  const late = () => req.deadlineAt != null && clock() > req.deadlineAt;
  const wanted = [...new Set(req.number.split(""))] as Digit[];
  const { placements, frames, truncated } = searchDigits(p, 0, rules, late, {
    regionM: req.radiusM,
    maxSize,
    digits: wanted,
    // A digit of a two-digit number leaves room for the other digit and a connector.
    maxLengthM: two ? maxRace * 0.62 : maxRace,
  });
  const placementCount = [...placements.values()].reduce((s, l) => s + l.length, 0);
  // Walking distance to a course is measured on the graph, up to well past the search radius.
  const ctx = courseContext(p, rules, { startNode: found.nodeId, target, minRace, maxRace, maxConnector, maxApproachM: req.radiusM * 1.6, reject });
  const near = (pl: DigitPlacement) => ctx.approach.dist.get(ctx.startOf(pl)) ?? Infinity;
  const firsts = (placements.get(req.number[0] as Digit) ?? []).filter((pl) => Number.isFinite(near(pl))).sort((a, b) => near(a) - near(b));
  if (!firsts.length) reject((placements.get(req.number[0] as Digit) ?? []).length ? "first_digit_too_far" : "digit_not_drawable");

  const want = req.alternatives ?? 5;
  const plans: NumberPlan[] = [];
  const usedFirst = new Map<DigitPlacement, number>();
  if (!two) {
    for (const one of firsts.slice(0, want * 6)) {
      if (late()) break;
      const plan = exact(ctx.buildSingle(req.number, one));
      if (plan) plans.push(plan);
    }
  } else {
    const seconds = (placements.get(req.number[1] as Digit) ?? []).slice(0, rules.secondsPerNumber);
    if (!seconds.length) reject("digit_not_drawable");
    const pairs: { one: DigitPlacement; two: DigitPlacement; layout: NumberLayout; optimistic: number }[] = [];
    for (const one of firsts.slice(0, rules.firstsPerNumber * 2))
      for (const t of seconds) {
        const pre = ctx.prePair(one, t);
        if (pre) pairs.push({ one, two: t, ...pre });
      }
    // Nearest first, then the best-looking.
    pairs.sort((x, y) => near(x.one) - near(y.one) || y.optimistic - x.optimistic);
    for (const pair of pairs.slice(0, rules.pairEvaluations * 4)) {
      if (late() || plans.length >= want * 3) break;
      // A few alternatives per digit-one placement at most, so the choices are really different.
      if ((usedFirst.get(pair.one) ?? 0) >= 2) continue;
      const plan = exact(ctx.buildPair(req.number, pair.one, pair.two, pair.layout));
      if (!plan) continue;
      usedFirst.set(pair.one, (usedFirst.get(pair.one) ?? 0) + 1);
      plans.push(plan);
    }
  }
  const checked = plans.filter((plan) => {
    const problem = validateNumberPlan(plan, graph, rules, { avoidStairs: req.avoidStairs });
    if (problem) reject(`failed_check:${problem}`);
    return !problem;
  });
  checked.sort((a, b) => a.approachM - b.approachM || b.score - a.score);
  const stats = { frames, placements: placementCount, pairsRouted: ctx.routed(), rejected, ...(truncated ? { truncated } : {}) };
  if (!checked.length) return { ok: false, algorithm, number: req.number, reason: late() ? "timeout" : "no_number_routes", plans: [], stats };
  return { ok: true, algorithm, number: req.number, reason: null, plans: checked.slice(0, want), stats };
};

/** Ranks plans: readable digits, side by side, a race near the time asked, a short connector, a short walk to start. */
const planScore = (one: DigitPlacement, two: DigitPlacement, layout: NumberLayout, raceM: number, connectorM: number, approachM: number, target: number) =>
  Math.round(
    ((one.readability + two.readability) / 2 +
      (layout === "side_by_side" ? 20 : 0) -
      0.15 * (tilt(one) + tilt(two)) -
      25 * Math.abs(raceM / target - 0.85) -
      10 * (connectorM / target) -
      approachM / 100) *
      100,
  ) / 100;

/** The digits' mean lean as a map heading: turning the map by this much shows the number upright. */
const headingOf = (digits: readonly DigitPlacement[]) => {
  const x = digits.reduce((t, d) => t + d.frame.right[0], 0);
  const y = digits.reduce((t, d) => t + d.frame.right[1], 0);
  // "right" points east when upright; a right vector leaning north (anticlockwise) needs the map turned anticlockwise.
  return Math.round(-deg(Math.atan2(y, x)));
};

/** Degrees a digit leans beyond 15: upright digits read best on a north-up map. */
const tilt = (pl: DigitPlacement) => Math.max(0, Math.abs(deg(Math.atan2(pl.frame.right[1], pl.frame.right[0]))) - 15);

/**
 * Picks the match's number at random from the feasible ones (optionally one difficulty). `random` returns a number in
 * [0, 1); the server passes a cryptographic one. Returns null when nothing is feasible: the caller shows that, it never
 * substitutes another number.
 */
export const chooseNumber = (plans: readonly NumberPlan[], random: () => number, difficulty?: Difficulty | null): NumberPlan | null => {
  const pool = plans.filter((pl) => !difficulty || pl.difficulty === difficulty).slice().sort((a, b) => (a.number < b.number ? -1 : 1));
  if (!pool.length) return null;
  const i = Math.min(pool.length - 1, Math.floor(Math.max(0, random()) * pool.length));
  return pool[i];
};

// ---------------------------------------------------------------------------------------------------------------
// DigitRouteValidator
// ---------------------------------------------------------------------------------------------------------------

export type NumberPlanProblem =
  | "bad_number"
  | "unknown_edge"
  | "not_walkable"
  | "disconnected"
  | "wrong_order"
  | "wrong_start"
  | "missing_segment"
  | "extra_segment"
  | "stroke_mismatch"
  | "shared_stroke"
  | "connector_on_stroke"
  | "no_connector"
  | "finish_repeats"
  | "unreadable"
  | "length_mismatch";

/**
 * Checks a plan against the graph it claims to come from, independently of how it was built:
 *  - the number is two digits, as text;
 *  - every step is an existing walkable edge and starts where the previous one ended, from the player's junction to
 *    the end of digit two, in the order approach, digit one, connector, digit two;
 *  - each digit is walked stroke by stroke from corner to corner, with exactly its required segments, repeats walking
 *    the same edges again, and no edge shared between segments or digits;
 *  - the connector is real, and never walks a stroke;
 *  - the real geometry, read back segment by segment, is the intended digit;
 *  - the stored lengths match the edges.
 * Returns the first problem found, or null.
 */
/** A plan's number: one digit 1 to 9, or two characters (00 to 99, as nearby races draw them). */
export const isPlanNumber = (n: unknown): n is string => typeof n === "string" && (/^[0-9]$/.test(n) || isTwoDigit(n));

export const validateNumberPlan = (plan: NumberPlan, graph: PedGraph, rules: NumberRules = NUMBER_RULES, prefs: { avoidStairs?: boolean } = {}): NumberPlanProblem | null => {
  if (!isPlanNumber(plan.number) || plan.digits.length !== plan.number.length) return "bad_number";
  const two = plan.digits.length === 2;
  const byId = new Map(graph.edges.map((e) => [e.id, e]));
  const origin = graph.nodes.find((n) => n.id === plan.approachFromNodeId);
  if (!origin) return "unknown_edge";
  const proj = projector(origin);
  const xy = (c: readonly [number, number]): XY => proj.to({ latitude: c[1], longitude: c[0] });

  // Order of parts: approach*, digit 0+, connector+, digit 1+, finish*.
  const rank = (l: PlanLeg) =>
    l.part === "approach" ? 0 : l.part === "digit" && l.digit === 0 ? 1 : l.part === "connector" ? 2 : l.part === "digit" && l.digit === 1 ? 3 : l.part === "finish" ? 4 : -1;
  for (let i = 0; i < plan.legs.length; i++) {
    const r = rank(plan.legs[i]);
    if (r < 0 || (i && r < rank(plan.legs[i - 1]))) return "wrong_order";
  }
  // Two digits are joined by a real connector; a single digit has none.
  if (two && !plan.legs.some((l) => l.part === "connector")) return "no_connector";
  if (!two && plan.legs.some((l) => l.part === "connector" || (l.part === "digit" && l.digit === 1))) return "extra_segment";

  let at = plan.approachFromNodeId;
  const nodeAt: string[] = [];
  const lengths = { approach: 0, digit0: 0, connector: 0, digit1: 0, finish: 0 };
  for (const l of plan.legs) {
    const e = byId.get(l.edgeId);
    if (!e) return "unknown_edge";
    if (!isWalkable(e, prefs)) return "not_walkable";
    const [from, to] = l.forward ? [e.a, e.b] : [e.b, e.a];
    if (from !== at) return "disconnected";
    nodeAt.push(from);
    at = to;
    const key = l.part === "digit" ? (l.digit === 0 ? "digit0" : "digit1") : l.part;
    lengths[key] += e.lengthM;
  }
  const firstDigit = plan.legs.findIndex((l) => l.part === "digit");
  if (firstDigit < 0 || nodeAt[firstDigit] !== plan.startNodeId) return "wrong_start";

  const allStrokes = new Set<string>();
  for (const k of (two ? [0, 1] : [0]) as (0 | 1)[]) {
    const pl = plan.digits[k];
    if (pl.digit !== plan.number[k]) return "bad_number";
    const legs = plan.legs.map((l, i) => ({ l, i })).filter(({ l }) => l.part === "digit" && l.digit === k);
    const required = DIGIT_SEGMENTS[pl.digit];
    const drawn = new Set(legs.map(({ l }) => l.segment!));
    if (required.some((s) => !drawn.has(s))) return "missing_segment";
    if ([...drawn].some((s) => !required.includes(s))) return "extra_segment";

    // Strokes: consecutive legs of the same segment, matching the walk, from corner to corner.
    const strokes: { segment: Segment; repeat: boolean; legs: typeof legs }[] = [];
    for (const x of legs) {
      const last = strokes[strokes.length - 1];
      if (last && last.segment === x.l.segment && Boolean(last.repeat) === Boolean(x.l.repeat)) last.legs.push(x);
      else strokes.push({ segment: x.l.segment!, repeat: Boolean(x.l.repeat), legs: [x] });
    }
    if (strokes.length !== pl.walk.strokes.length) return "stroke_mismatch";
    const edgesOf = new Map<Segment, string>();
    const owner = new Map<string, Segment>();
    for (let s = 0; s < strokes.length; s++) {
      const st = strokes[s];
      const want = pl.walk.strokes[s];
      if (st.segment !== want.segment || st.repeat !== want.repeat) return "stroke_mismatch";
      const first = st.legs[0].i;
      const last = st.legs[st.legs.length - 1].i;
      const endNode = last + 1 < nodeAt.length ? nodeAt[last + 1] : at;
      if (nodeAt[first] !== pl.corners[want.from] || endNode !== pl.corners[want.to]) return "stroke_mismatch";
      const ids = st.legs.map(({ l }) => l.edgeId);
      const key = [...ids].sort().join(",");
      if (edgesOf.has(st.segment)) {
        if (edgesOf.get(st.segment) !== key) return "stroke_mismatch"; // a repeat walks the same streets again
      } else {
        if (st.repeat) return "stroke_mismatch";
        edgesOf.set(st.segment, key);
        for (const id of ids) {
          if (owner.has(id) || allStrokes.has(id)) return "shared_stroke";
          owner.set(id, st.segment);
        }
      }
    }
    for (const id of owner.keys()) allStrokes.add(id);

    // The real geometry must read back as this digit.
    const frame = frameOfPlacement(pl.frame, proj);
    const polylines = required.map((s) => {
      const st = strokes.find((x) => x.segment === s)!;
      return st.legs.flatMap(({ l }) => {
        const e = byId.get(l.edgeId)!;
        const pts = e.coords.map(xy);
        return l.forward ? pts : pts.reverse();
      });
    });
    const read = readDigitGeometry(frame, polylines, rules);
    if (read.digit !== pl.digit) return "unreadable";
    if (Math.abs(lengths[k === 0 ? "digit0" : "digit1"] - pl.lengthM) > Math.max(1, pl.lengthM * 0.01)) return "length_mismatch";
  }
  for (const l of plan.legs) if ((l.part === "connector" || l.part === "finish") && allStrokes.has(l.edgeId)) return "connector_on_stroke";
  // The finish stretch is a simple walk: no street twice.
  const finishIds = plan.legs.filter((l) => l.part === "finish").map((l) => l.edgeId);
  if (new Set(finishIds).size !== finishIds.length) return "finish_repeats";
  if (plan.finishNodeId && plan.finishNodeId !== at) return "disconnected";
  const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1.5, b * 0.01);
  if (
    !close(lengths.connector, plan.connectorM) ||
    !close(lengths.approach, plan.approachM) ||
    !close(lengths.finish, plan.finishM ?? 0) ||
    !close(lengths.digit0 + lengths.connector + lengths.digit1 + lengths.finish, plan.raceM)
  )
    return "length_mismatch";
  return null;
};

// ---------------------------------------------------------------------------------------------------------------
// Drawing and checking: a plan's real geometry
// ---------------------------------------------------------------------------------------------------------------

/** One drawable piece of a plan: an edge's own geometry ([lng, lat]) in walking order, and what it is. */
export type PlanPiece = { part: LegPart; digit?: 0 | 1; segment?: Segment; repeat?: boolean; edgeId: string; coords: [number, number][]; lengthM: number };

/** A plan's legs with each edge's stored geometry, oriented as walked. Nothing else is ever drawn. */
export const planPieces = (plan: Pick<NumberPlan, "legs">, graph: PedGraph): PlanPiece[] => {
  const byId = new Map(graph.edges.map((e) => [e.id, e]));
  return plan.legs.map((l) => {
    const e = byId.get(l.edgeId)!;
    const coords = e.coords.map(([lng, lat]) => [lng, lat] as [number, number]);
    return { part: l.part, digit: l.digit, segment: l.segment, repeat: l.repeat, edgeId: l.edgeId, coords: l.forward ? coords : coords.reverse(), lengthM: e.lengthM };
  });
};
