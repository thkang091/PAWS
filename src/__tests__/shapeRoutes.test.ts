import {
  ROUTE_ALGORITHM,
  ROUTE_RULES,
  generateShapeRoutes,
  isWalkable,
  meanGap,
  overlapRatio,
  targetLengthM,
  type PedEdge,
  type PedGraph,
  type RouteCandidate,
  type RouteRequest,
  type RouteResult,
} from "../../supabase/functions/tournament/routes";
import { matchPath } from "../../supabase/functions/tournament/shape";
import { presetByKey } from "../../supabase/functions/tournament/shapes";
import { GraphBuilder, parkTown, riverTown, squareTown } from "./fixtures/pedestrianGraphs";

const shape = (key: string) => presetByKey(key)!;
const run = (g: GraphBuilder, req: Partial<RouteRequest> & { at: [number, number]; key: string }) =>
  generateShapeRoutes(g.graph(), { start: g.at(...req.at), shape: shape(req.key), minutes: req.minutes ?? 15, recent: req.recent, avoidStairs: req.avoidStairs });
const options = (r: RouteResult): RouteCandidate[] => (r.ok ? (r as { options: RouteCandidate[] }).options : []);
const reason = (r: RouteResult) => (r.ok ? "ok" : (r as { reason: string }).reason);

/**
 * What every returned route must be, whatever the test: only walkable edges of the graph, joined end to end in order,
 * starting (and for loops ending) at the start junction, with geometry copied from the edges, no straight-line jumps.
 */
const expectWalkableRoute = (graph: PedGraph, route: RouteCandidate) => {
  const byId = new Map(graph.edges.map((e) => [e.id, e]));
  let at = route.startNodeId;
  let length = 0;
  for (const step of route.steps) {
    const e = byId.get(step.edgeId);
    expect(e).toBeDefined();
    expect(isWalkable(e!)).toBe(true);
    const [from, to] = step.forward ? [e!.a, e!.b] : [e!.b, e!.a];
    expect(from).toBe(at);
    at = to;
    length += e!.lengthM;
  }
  if (route.loop) expect(at).toBe(route.startNodeId);
  expect(route.lengthM).toBeCloseTo(length, 6);
  // The drawn path is the edges' own points: every point of it is a vertex of one of the route's edges.
  const vertices = new Set(route.steps.flatMap((s) => byId.get(s.edgeId)!.coords.map(([x, y]) => `${x.toFixed(9)},${y.toFixed(9)}`)));
  for (const p of route.path) expect(vertices.has(`${p.longitude.toFixed(9)},${p.latitude.toFixed(9)}`)).toBe(true);
  expect(route.backtrack).toBeLessThanOrEqual(ROUTE_RULES.maxBacktrack);
};

const expectAll = (g: GraphBuilder, r: RouteResult) => options(r).forEach((o) => expectWalkableRoute(g.graph(), o));

describe("pedestrian shape routes", () => {
  it("1. builds a real square loop on a street grid", () => {
    const g = squareTown();
    const r = run(g, { at: [300, 300], key: "square" });
    expect(reason(r)).toBe("ok");
    expect(r.algorithm).toBe(ROUTE_ALGORITHM);
    expectAll(g, r);
    for (const o of options(r)) {
      expect(o.loop).toBe(true);
      expect(o.shapeScore).toBeGreaterThanOrEqual(ROUTE_RULES.minScore.square);
      expect(Math.abs(o.lengthM - targetLengthM(15)) / targetLengthM(15)).toBeLessThanOrEqual(ROUTE_RULES.lengthTolerance);
    }
  });

  it("2. builds a triangle only where diagonal paths make one walkable", () => {
    const park = parkTown();
    const r = run(park, { at: [300, 300], key: "triangle" });
    expect(reason(r)).toBe("ok");
    expectAll(park, r);
    expect(options(r).every((o) => o.edgeIds.some((id) => /^[de]\d/.test(id)))).toBe(true);
    // The plain grid has no diagonal path, so it has no recognizable triangle.
    expect(reason(run(squareTown(), { at: [300, 300], key: "triangle" }))).toBe("shape_not_possible");
  });

  it("3. never uses a street that isn't connected to the start", () => {
    const g = squareTown();
    // A separate little street right beside the start, joined to nothing.
    g.node("iso1", 310, 290).node("iso2", 360, 250).node("iso3", 390, 210).edge("iso_a", "iso1", "iso2").edge("iso_b", "iso2", "iso3");
    const r = run(g, { at: [312, 292], key: "square" });
    expect(reason(r)).toBe("ok");
    expectAll(g, r);
    for (const o of options(r)) {
      expect(o.startNodeId).not.toMatch(/^iso/);
      expect(o.edgeIds.some((id) => id.startsWith("iso"))).toBe(false);
    }
  });

  it("4. never crosses a river without a bridge", () => {
    const g = riverTown();
    const r = run(g, { at: [100, 300], key: "square" });
    expect(reason(r)).toBe("ok");
    expectAll(g, r);
    for (const o of options(r)) for (const p of o.path) expect(p.longitude).toBeLessThan(g.at(350, 0).longitude);
    // A walk too long for the west bank alone has nowhere to go.
    expect(reason(run(g, { at: [100, 300], key: "square", minutes: 40 }))).not.toBe("ok");
  });

  it("5. crosses the river on bridges, and only on bridges", () => {
    const g = riverTown([1, 5]);
    const r = run(g, { at: [100, 300], key: "square", minutes: 40 });
    expect(reason(r)).toBe("ok");
    expectAll(g, r);
    for (const o of options(r)) {
      const crosses = o.path.some((p) => p.longitude > g.at(350, 0).longitude);
      expect(crosses).toBe(true);
      expect(o.edgeIds.filter((id) => id.startsWith("bridge")).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("6. never uses private, restricted, no-foot or highway edges, even if marked walkable", () => {
    const g = squareTown()
      .edge("private_short", "g2_2", "g4_4", { access: "private" })
      .edge("no_foot", "g2_4", "g4_2", { foot: "no" })
      .edge("motorway", "g0_3", "g6_3", { pathType: "motorway", via: [[300, 320]] })
      .edge("ramp", "g1_1", "g5_5", { pathType: "motorway_link" });
    for (const key of ["square", "heart", "triangle", "letter_s"]) {
      const r = run(g, { at: [300, 300], key });
      expectAll(g, r);
      for (const o of options(r)) expect(o.edgeIds.filter((id) => ["private_short", "no_foot", "motorway", "ramp"].includes(id))).toEqual([]);
    }
  });

  it("7. never takes a shortcut through a building (an unverified edge)", () => {
    const g = squareTown();
    // Straight lines across blocks, as a careless import might draw them: not reviewed, so not walkable.
    for (let i = 0; i < 6; i++) g.edge(`thru${i}`, `g${i}_${i}`, `g${i + 1}_${i + 1}`, { walkable: false, pathType: "footway" });
    const r = run(g, { at: [300, 300], key: "triangle" });
    expect(reason(r)).toBe("shape_not_possible");
    const square = run(g, { at: [300, 300], key: "square" });
    expectAll(g, square);
    for (const o of options(square)) expect(o.edgeIds.some((id) => id.startsWith("thru"))).toBe(false);
  });

  it("8. treats a walk along the parallel sidewalk as the same walk", () => {
    const g = squareTown();
    for (let c = 0; c < 7; c++) g.node(`s${c}`, c * 100, 306);
    for (let c = 0; c < 6; c++) g.edge(`side${c}`, `s${c}`, `s${c + 1}`, { pathType: "sidewalk" });
    for (let c = 0; c < 7; c++) g.edge(`kerb${c}`, `s${c}`, `g${c}_3`, { pathType: "crossing" });
    const r = run(g, { at: [300, 300], key: "square" });
    expectAll(g, r);
    const opts = options(r);
    expect(opts.length).toBeGreaterThan(0);
    for (let i = 0; i < opts.length; i++) for (let j = i + 1; j < opts.length; j++) expect(meanGap(opts[i].path, opts[j].path)).toBeGreaterThan(ROUTE_RULES.sameWalkM);
    // The check itself: a loop along the street and the same loop along the sidewalk 6 m away are one walk.
    const street = [g.at(0, 300), g.at(300, 300), g.at(300, 600), g.at(0, 600), g.at(0, 300)];
    const sidewalk = [g.at(0, 306), g.at(300, 306), g.at(300, 600), g.at(0, 600), g.at(0, 306)];
    expect(meanGap(street, sidewalk)).toBeLessThan(ROUTE_RULES.sameWalkM);
  });

  it("9. doesn't send walks up and down dead ends", () => {
    const g = squareTown();
    for (let c = 0; c < 7; c++) g.node(`end${c}`, c * 100 + 50, 350).edge(`cul${c}`, `g${c}_3`, `end${c}`);
    const r = run(g, { at: [300, 300], key: "square" });
    expect(reason(r)).toBe("ok");
    expectAll(g, r);
    for (const o of options(r)) expect(o.edgeIds.some((id) => id.startsWith("cul"))).toBe(false);
  });

  it("10. never offers the same route twice", () => {
    const g = squareTown();
    const opts = options(run(g, { at: [300, 300], key: "square" }));
    const keys = opts.map((o) => [...o.edgeIds].sort().join());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("11. keeps options to less than 40% shared length, and returns fewer rather than near-copies", () => {
    const g = squareTown();
    const graph = g.graph();
    const byId = new Map(graph.edges.map((e) => [e.id, e]));
    const opts = options(run(g, { at: [300, 300], key: "square" }));
    expect(opts.length).toBeGreaterThan(1);
    for (let i = 0; i < opts.length; i++) for (let j = i + 1; j < opts.length; j++) expect(overlapRatio(opts[i].edgeIds, opts[j].edgeIds, byId)).toBeLessThan(ROUTE_RULES.maxOptionOverlap);
    // A ring road with spokes has one real loop: one option, marked as limited, never three copies.
    const ring = new GraphBuilder();
    const corners: [string, number, number][] = [["r0", 0, 0], ["r1", 250, 0], ["r2", 250, 250], ["r3", 0, 250]];
    corners.forEach(([id, x, y]) => ring.node(id, x, y));
    ring.edge("ra", "r0", "r1").edge("rb", "r1", "r2").edge("rc", "r2", "r3").edge("rd", "r3", "r0");
    const one = run(ring, { at: [0, 0], key: "square" });
    expect(reason(one)).toBe("ok");
    expect(options(one)).toHaveLength(1);
    expect((one as { limited: boolean }).limited).toBe(true);
  });

  it("12. moves a route walked recently to the back", () => {
    const g = squareTown();
    const first = options(run(g, { at: [300, 300], key: "square" }));
    const walked = first[0].edgeIds;
    const again = options(run(g, { at: [300, 300], key: "square", recent: [walked] }));
    expect(again[0].recentOverlap).toBeLessThanOrEqual(ROUTE_RULES.maxRecentOverlap);
    expect([...again[0].edgeIds].sort().join()).not.toBe([...walked].sort().join());
    // Still allowed when it's the only way: the ring road offers its one loop even if walked yesterday.
    const ring = new GraphBuilder().node("r0", 0, 0).node("r1", 250, 0).node("r2", 250, 250).node("r3", 0, 250);
    ring.edge("ra", "r0", "r1").edge("rb", "r1", "r2").edge("rc", "r2", "r3").edge("rd", "r3", "r0");
    const only = options(run(ring, { at: [0, 0], key: "square", recent: [["ra", "rb", "rc", "rd"]] }));
    expect(only).toHaveLength(1);
    expect(only[0].recentOverlap).toBeGreaterThan(ROUTE_RULES.maxRecentOverlap);
  });

  it("13. says so when the shape can't be walked here, instead of inventing a route", () => {
    const g = squareTown();
    for (const key of ["star", "diamond", "triangle"]) {
      const r = run(g, { at: [300, 300], key });
      expect(reason(r)).toBe("shape_not_possible");
      expect((r as { bestScore: number }).bestScore).toBeLessThan(ROUTE_RULES.minScore[key]);
    }
    // Too long for a small neighbourhood.
    const small = new GraphBuilder().grid(3, 3);
    expect(reason(run(small, { at: [100, 100], key: "square", minutes: 40 }))).not.toBe("ok");
  });

  it("14. asks for a public start when nothing walkable is near", () => {
    const g = squareTown();
    expect(reason(run(g, { at: [-900, -900], key: "square" }))).toBe("no_public_start");
    // Next to roads, but only private ones.
    const gated = new GraphBuilder().grid(4, 4);
    gated.edges = gated.edges.map((e: PedEdge) => ({ ...e, access: "private" }));
    expect(reason(run(gated, { at: [100, 100], key: "square" }))).toBe("no_network");
    const mixed = squareTown();
    mixed.node("gate1", -400, 0).node("gate2", -400, 100).edge("gate", "gate1", "gate2", { access: "private" });
    expect(reason(run(mixed, { at: [-400, 50], key: "square" }))).toBe("no_public_start");
  });

  it("refuses unreviewed networks and stairs when asked", () => {
    const g = squareTown();
    g.edges = g.edges.map((e: PedEdge) => ({ ...e, walkable: false }));
    expect(reason(run(g, { at: [300, 300], key: "square" }))).toBe("no_network");
    const stairs = squareTown();
    stairs.edges = stairs.edges.map((e: PedEdge) => (e.id.startsWith("v") ? { ...e, pathType: "steps" } : e));
    const r = run(stairs, { at: [300, 300], key: "square", avoidStairs: true });
    expect(reason(r)).not.toBe("ok");
  });

  it("scores a route exactly as a walk along it would be scored", () => {
    const g = squareTown();
    for (const o of options(run(g, { at: [300, 300], key: "square" }))) expect(o.shapeScore).toBe(matchPath(o.path, shape("square")).score);
  });

  it("is deterministic", () => {
    const a = run(parkTown(), { at: [300, 300], key: "triangle" });
    const b = run(parkTown(), { at: [300, 300], key: "triangle" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
