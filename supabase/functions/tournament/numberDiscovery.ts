import type { Digit } from "./digits.ts";
import type { LatLng, PedGraph } from "./routes.ts";
import {
  ANY_LENGTH,
  NUMBER_RULES,
  courseContext,
  prepare,
  searchDigits,
  startJunction,
  targetLengthM,
  validateNumberPlan,
  type DigitPlacement,
  type NumberLayout,
  type NumberPlan,
  type NumberRules,
} from "./numberRoutes.ts";

/**
 * NearbyNumberEligibilityService (phase L1) and distinct route enumeration (phase L2), pure.
 *
 * Location first: one pedestrian network around the player, one digit search for all ten digits (in rings, so a wider
 * search never loses what a narrower one found), then every number from 0 to 99 is checked against those shared digit
 * placements: 0 to 9 as one digit, 10 to 99 as two digits joined by a connector. A number is AVAILABLE only when a
 * route passed the independent validator (validateNumberPlan): real walkable edges, the digit read back from the
 * geometry, a real connector, a start reachable on foot. Nothing is approximated, and a number that could not be
 * checked in time is NOT_YET_CHECKED, never "not found".
 *
 * Distinct routes: two routes for the same number are the same course when their digit strokes share most of their
 * streets (reversed, restarted or nudged by one block is the same course). Identity is the sorted set of stroke
 * edges, so route ids are stable for the same network.
 */

export const DISCOVERY_VERSION = "number-discovery-v1";
export const DISCOVERY_NUMBERS: readonly string[] = Array.from({ length: 100 }, (_, i) => String(i));
export const DISCOVERY_RADII = [500, 1_000, 2_000, 3_000] as const;
export type DiscoveryRadius = (typeof DISCOVERY_RADII)[number];

export const DISCOVERY_RULES = {
  /** Routes looked for per number while scanning all 100 (the gallery finds the rest). */
  scanRoutesPerNumber: 3,
  /** Two routes are one course when this share of the smaller one's stroke streets is shared. */
  sameCourseShare: 0.8,
  /** Gallery: routes per page, and pairs routed at most per request (the rest is "more may exist"). */
  galleryPage: 12,
  galleryPairsPerRequest: 600,
  /** Digit size for the shared search: a 25-minute course's digits, as nearby races size them. */
  sizingMinutes: 25,
} as const;

export type AvailabilityStatus = "AVAILABLE" | "NOT_FOUND_IN_CHECKED_AREA" | "NOT_YET_CHECKED" | "CHECKING" | "CHECK_FAILED";

export type NumberAvailability = {
  number: string;
  status: AvailabilityStatus;
  /** Distinct verified routes found so far (a lower bound when `more`). */
  routes: number;
  /** The scan stopped looking after `scanRoutesPerNumber`; the gallery may find more. */
  more: boolean;
  /** Walking distance on the network to the nearest found route's first corner. */
  nearestApproachM: number | null;
};

export type DiscoveryFailure = "no_network" | "no_public_start";

export type DiscoveryResult = {
  version: string;
  radiusM: number;
  /** Every digit frame lying wholly within this distance was examined (less than `radiusM` when cut short). */
  checkedRadiusM: number;
  /** The deadline ended the scan: some numbers are NOT_YET_CHECKED. */
  partial: boolean;
  reason: DiscoveryFailure | null;
  numbers: NumberAvailability[];
  available: string[];
  stats: { frames: number; placements: number; pairsRouted: number; ms?: number };
};

// ---------------------------------------------------------------------------------------------------------------
// Route identity
// ---------------------------------------------------------------------------------------------------------------

/** The streets a route draws its digits on, sorted: the same for the route walked backwards or from another corner. */
export const routeEdges = (plan: Pick<NumberPlan, "digits">) => [...new Set(plan.digits.flatMap((d) => d.strokeEdgeIds))].sort();

const fnv = (text: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, "0");
};

/** A stable id for a route: its number and the streets its digits are drawn on. */
export const routeIdOf = (plan: Pick<NumberPlan, "number" | "digits">) => `${plan.number}-${fnv(`${plan.number}|${routeEdges(plan).join(",")}`)}`;

/** Whether two routes are really one course: most of the smaller one's stroke streets are the other's too. */
export const sameCourse = (a: readonly string[], b: readonly string[], share: number = DISCOVERY_RULES.sameCourseShare) => {
  const small = a.length <= b.length ? a : b;
  const big = new Set(a.length <= b.length ? b : a);
  if (!small.length) return false;
  let shared = 0;
  for (const id of small) if (big.has(id)) shared++;
  return shared / small.length >= share;
};

// ---------------------------------------------------------------------------------------------------------------
// One search session: network, start, shared digit placements
// ---------------------------------------------------------------------------------------------------------------

export type DiscoveryRequest = {
  start: LatLng;
  radiusM: number;
  avoidStairs?: boolean;
  deadlineAt?: number;
  clock?: () => number;
};

type Session = ReturnType<typeof openSession>;

/** Rings up to the radius asked for: 500 m, 1 km, 2 km, 3 km. */
const ringsFor = (radiusM: number): number[] => [...(DISCOVERY_RADII as readonly number[]).filter((r) => r < radiusM), radiusM];

const openSession = (graph: PedGraph, req: DiscoveryRequest, rules: NumberRules) => {
  const clock = req.clock ?? Date.now;
  const late = () => req.deadlineAt != null && clock() > req.deadlineAt;
  const p = prepare(graph, req.start, { avoidStairs: req.avoidStairs });
  if (!p.edges.length) return { ok: false as const, failure: "no_network" as DiscoveryFailure };
  const found = startJunction(p, req.start, ANY_LENGTH[0] / 2, rules);
  if ("reason" in found) return { ok: false as const, failure: (found.reason === "no_network" ? "no_network" : "no_public_start") as DiscoveryFailure };
  const sizing = targetLengthM(DISCOVERY_RULES.sizingMinutes, rules);
  const maxSize = Math.min(rules.maxSizeM, Math.max(rules.minSizeM * 1.5, rules.maxSizeShare * sizing));
  const search = searchDigits(p, 0, rules, late, { regionM: req.radiusM, maxSize, rings: ringsFor(req.radiusM) });
  const rejected: Record<string, number> = {};
  const ctx = courseContext(p, rules, {
    startNode: found.nodeId,
    target: sizing,
    minRace: ANY_LENGTH[0],
    maxRace: ANY_LENGTH[1],
    maxConnector: rules.maxConnectorM,
    // Walking distance to a course, on the network, up to well past the radius.
    maxApproachM: req.radiusM * 1.6,
    reject: (why) => void (rejected[why] = (rejected[why] ?? 0) + 1),
  });
  const near = (pl: DigitPlacement) => ctx.approach.dist.get(ctx.startOf(pl)) ?? Infinity;
  // Placements by digit, reachable on foot, nearest first. Stable order: the same network gives the same lists.
  const byDigit = new Map<Digit, DigitPlacement[]>();
  for (const [digit, list] of search.placements) byDigit.set(digit, [...list].sort((a, b) => near(a) - near(b) || b.readability - a.readability));
  return { ok: true as const, p, graph, ctx, near, byDigit, search, late, rejected, startNode: found.nodeId };
};

// ---------------------------------------------------------------------------------------------------------------
// Distinct routes for one number
// ---------------------------------------------------------------------------------------------------------------

type Enumeration = { plans: NumberPlan[]; ids: string[]; exhausted: boolean; pairsTried: number };

/**
 * Distinct validated routes for `number`, nearest on foot first. Stops at `limit` routes, at `maxPairs` pairs routed, or
 * at the deadline; `exhausted` is true only when every candidate was looked at.
 */
const enumerate = (s: Extract<Session, { ok: true }>, number: string, limit: number, maxPairs: number, rules: NumberRules): Enumeration => {
  const plans: NumberPlan[] = [];
  const edgesOf: string[][] = [];
  const keep = (plan: NumberPlan | null) => {
    if (!plan || validateNumberPlan(plan, s.graph, rules)) return false;
    const edges = routeEdges(plan);
    if (edgesOf.some((e) => sameCourse(e, edges))) return false;
    plans.push(plan);
    edgesOf.push(edges);
    return true;
  };
  const firsts = (s.byDigit.get(number[0] as Digit) ?? []).filter((pl) => Number.isFinite(s.near(pl)));
  let tried = 0;
  if (number.length === 1) {
    for (const one of firsts) {
      if (plans.length >= limit || s.late()) return { plans, ids: plans.map(routeIdOf), exhausted: false, pairsTried: tried };
      tried++;
      keep(s.ctx.buildSingle(number, one));
    }
    return { plans, ids: plans.map(routeIdOf), exhausted: true, pairsTried: tried };
  }
  const seconds = s.byDigit.get(number[1] as Digit) ?? [];
  for (const one of firsts) {
    // Pairs from this first digit, the cheap checks first, the best-looking routed first.
    const pairs: { two: DigitPlacement; layout: NumberLayout; optimistic: number }[] = [];
    for (const two of seconds) {
      const pre = s.ctx.prePair(one, two);
      if (pre) pairs.push({ two, ...pre });
    }
    pairs.sort((x, y) => y.optimistic - x.optimistic);
    for (const pair of pairs) {
      if (plans.length >= limit || tried >= maxPairs || s.late()) return { plans, ids: plans.map(routeIdOf), exhausted: false, pairsTried: tried };
      tried++;
      // One course per first-digit placement and second-digit streets: skip pairs that can only repeat a kept course.
      if (edgesOf.some((e) => sameCourse(e, [...one.strokeEdgeIds, ...pair.two.strokeEdgeIds].sort()))) continue;
      keep(s.ctx.buildPair(number, one, pair.two, pair.layout));
    }
  }
  return { plans, ids: plans.map(routeIdOf), exhausted: true, pairsTried: tried };
};

// ---------------------------------------------------------------------------------------------------------------
// The scan: every number from 0 to 99
// ---------------------------------------------------------------------------------------------------------------

/**
 * Which numbers from 0 to 99 can be walked near the start. `only` limits the scan to some numbers (to continue a
 * partial scan); the others come back NOT_YET_CHECKED.
 */
export const discoverNumbers = (graph: PedGraph, req: DiscoveryRequest & { only?: readonly string[] }, rules: NumberRules = NUMBER_RULES): DiscoveryResult => {
  const base = { version: DISCOVERY_VERSION, radiusM: req.radiusM };
  const s = openSession(graph, req, rules);
  const pending = (status: AvailabilityStatus) => DISCOVERY_NUMBERS.map((number) => ({ number, status, routes: 0, more: false, nearestApproachM: null }));
  if (s.ok === false) {
    // No walkable network, or no public street to start from: nothing here can be walked. That is a finding about these
    // streets, not a failure to check.
    return { ...base, checkedRadiusM: 0, partial: false, reason: s.failure, numbers: pending("NOT_FOUND_IN_CHECKED_AREA"), available: [], stats: { frames: 0, placements: 0, pairsRouted: 0 } };
  }
  const want = new Set(req.only ?? DISCOVERY_NUMBERS);
  const numbers: NumberAvailability[] = [];
  // A search cut short by the deadline hasn't seen all its digits: a number missing from it isn't "not found".
  const digitsComplete = !s.search.truncated;
  for (const number of DISCOVERY_NUMBERS) {
    if (!want.has(number) || s.late()) {
      numbers.push({ number, status: "NOT_YET_CHECKED", routes: 0, more: false, nearestApproachM: null });
      continue;
    }
    const e = enumerate(s, number, DISCOVERY_RULES.scanRoutesPerNumber, Infinity, rules);
    const found = e.plans.length;
    const status: AvailabilityStatus = found ? "AVAILABLE" : e.exhausted && digitsComplete ? "NOT_FOUND_IN_CHECKED_AREA" : "NOT_YET_CHECKED";
    numbers.push({ number, status, routes: found, more: found >= DISCOVERY_RULES.scanRoutesPerNumber, nearestApproachM: found ? Math.min(...e.plans.map((p) => p.approachM)) : null });
  }
  const placements = [...s.byDigit.values()].reduce((t, l) => t + l.length, 0);
  return {
    ...base,
    checkedRadiusM: Math.round(s.search.checkedRadiusM),
    partial: numbers.some((n) => n.status === "NOT_YET_CHECKED" && want.has(n.number)),
    reason: null,
    numbers,
    available: numbers.filter((n) => n.status === "AVAILABLE").map((n) => n.number),
    stats: { frames: s.search.frames, placements, pairsRouted: s.ctx.routed() },
  };
};

// ---------------------------------------------------------------------------------------------------------------
// The gallery: every distinct route for one number
// ---------------------------------------------------------------------------------------------------------------

export type GalleryRequest = DiscoveryRequest & { number: string; /** Routes already shown: the next page starts after them. */ after?: number; limit?: number };
export type GalleryResult = {
  version: string;
  number: string;
  radiusM: number;
  checkedRadiusM: number;
  reason: DiscoveryFailure | "bad_number" | null;
  /** Routes after `after`, nearest first. */
  plans: NumberPlan[];
  ids: string[];
  /** All routes found so far, including earlier pages. */
  total: number;
  /** Every candidate was looked at: there are no more routes in this area. False: "Find more routes" may find more. */
  complete: boolean;
};

export const listNumberRoutes = (graph: PedGraph, req: GalleryRequest, rules: NumberRules = NUMBER_RULES): GalleryResult => {
  const after = Math.max(0, Math.floor(req.after ?? 0));
  const limit = Math.max(1, Math.min(24, Math.floor(req.limit ?? DISCOVERY_RULES.galleryPage)));
  const base = { version: DISCOVERY_VERSION, number: req.number, radiusM: req.radiusM };
  if (!/^([0-9]|[1-9][0-9])$/.test(req.number)) return { ...base, checkedRadiusM: 0, reason: "bad_number", plans: [], ids: [], total: 0, complete: true };
  const s = openSession(graph, req, rules);
  if (s.ok === false) return { ...base, checkedRadiusM: 0, reason: s.failure, plans: [], ids: [], total: 0, complete: true };
  // Deterministic: the same network gives the same order, so a later page continues exactly where this one stops.
  const e = enumerate(s, req.number, after + limit, DISCOVERY_RULES.galleryPairsPerRequest * (1 + Math.ceil(after / limit)), rules);
  // Enumeration order (first digits nearest on foot first) is kept as is: re-sorting would move routes between pages.
  const order = e.plans.map((plan, i) => ({ plan, id: e.ids[i] }));
  const page = order.slice(after, after + limit);
  return {
    ...base,
    checkedRadiusM: Math.round(s.search.checkedRadiusM),
    reason: null,
    plans: page.map((x) => x.plan),
    ids: page.map((x) => x.id),
    total: e.plans.length,
    complete: e.exhausted && !s.search.truncated,
  };
};

/** The public junction a search from `start` would begin at (cheap: no digit search). Used to key the cache. */
export const discoveryStartNode = (graph: PedGraph, start: LatLng, avoidStairs = false, rules: NumberRules = NUMBER_RULES): string | null => {
  const p = prepare(graph, start, { avoidStairs });
  if (!p.edges.length) return null;
  const found = startJunction(p, start, ANY_LENGTH[0] / 2, rules);
  return "reason" in found ? null : found.nodeId;
};

/** A later scan of the same area fills in what an earlier one left unchecked; a found route is never forgotten. */
export const mergeDiscovery = (earlier: DiscoveryResult, later: DiscoveryResult): DiscoveryResult => {
  const rank: Record<AvailabilityStatus, number> = { AVAILABLE: 4, NOT_FOUND_IN_CHECKED_AREA: 3, CHECK_FAILED: 1, CHECKING: 1, NOT_YET_CHECKED: 0 };
  const numbers = DISCOVERY_NUMBERS.map((number) => {
    const a = earlier.numbers.find((n) => n.number === number);
    const b = later.numbers.find((n) => n.number === number);
    if (!a) return b!;
    if (!b) return a;
    return rank[b.status] > rank[a.status] || (b.status === a.status && b.routes > a.routes) ? b : a;
  });
  return {
    ...later,
    checkedRadiusM: Math.min(earlier.checkedRadiusM, later.checkedRadiusM),
    numbers,
    available: numbers.filter((n) => n.status === "AVAILABLE").map((n) => n.number),
    partial: numbers.some((n) => n.status === "NOT_YET_CHECKED"),
  };
};
