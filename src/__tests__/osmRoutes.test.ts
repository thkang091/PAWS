/**
 * Follow the Shape on real pedestrian data: the OpenStreetMap rules (osm.ts), the independent route check, and the
 * acceptance rules for what a player may be offered. The small networks here are hand-built OpenStreetMap JSON for
 * tests only; production code never reads them (test 1 checks that).
 */
import { classifyWay, isBlockingNode, osmToGraph, routeWarnings, type OsmData, type OsmEdge } from "../../supabase/functions/tournament/osm";
import { ROUTE_RULES, generateShapeRoutes, overlapRatio, validateRoute, type RouteCandidate } from "../../supabase/functions/tournament/routes";
import { routeProgress, scoreRouteWalk } from "../../supabase/functions/tournament/routeScore";
import { metersBetween } from "../../supabase/functions/tournament/geo";
import { presetByKey } from "../../supabase/functions/tournament/shapes";
import { OUTCOME_COPY } from "@/features/tournament/shapeFlow";

declare const require: (m: string) => any;
declare const __dirname: string;
const fs = require("fs");
const path = require("path");

const ORIGIN = { latitude: 37.75, longitude: -122.45 };
const K = Math.cos((ORIGIN.latitude * Math.PI) / 180);

/** Builds OpenStreetMap JSON from positions in metres around ORIGIN. Test fixtures only. */
class Osm {
  elements: OsmData["elements"] = [];
  private nextNode = 1;
  private nextWay = 1;
  node(x: number, y: number, tags?: Record<string, string>) {
    const id = this.nextNode++;
    this.elements.push({ type: "node", id, lat: ORIGIN.latitude + y / 110_540, lon: ORIGIN.longitude + x / (111_320 * K), tags });
    return id;
  }
  way(nodes: number[], tags: Record<string, string>) {
    const id = this.nextWay++;
    this.elements.push({ type: "way", id, nodes, tags });
    return id;
  }
  data(): OsmData {
    return { elements: this.elements };
  }
}

const STREET = { highway: "residential", sidewalk: "both" };
const square = presetByKey("square")!;
const run = (data: OsmData, minutes = 15, recent?: string[][]) => generateShapeRoutes(osmToGraph(data, ORIGIN), { start: ORIGIN, shape: square, minutes, recent });
const optionsOf = (r: ReturnType<typeof run>) => (r.ok ? r.options : []) as RouteCandidate[];

/** A street grid of `n` x `n` junctions, `gap` metres apart, centred on ORIGIN. Each street is its own way. */
const grid = (n = 5, gap = 120, tags: Record<string, string> = STREET) => {
  const o = new Osm();
  const ids: number[][] = [];
  const off = ((n - 1) * gap) / 2;
  for (let i = 0; i < n; i++) {
    ids.push([]);
    for (let j = 0; j < n; j++) ids[i].push(o.node(i * gap - off, j * gap - off));
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i + 1 < n) o.way([ids[i][j], ids[i + 1][j]], tags);
      if (j + 1 < n) o.way([ids[i][j], ids[i][j + 1]], tags);
    }
  return { o, ids };
};

/** One block: four streets of `side` metres meeting at four shared corners, the start at one corner. */
const block = (side = 245, kink = 0) => {
  const o = new Osm();
  const a = o.node(0, 0);
  const b = o.node(side, 0);
  const c = o.node(side, side);
  const d = o.node(0, side);
  o.way([a, b], STREET);
  if (kink) {
    const k1 = o.node(side, side * 0.4);
    const k2 = o.node(side - kink, side * 0.45);
    const k3 = o.node(side, side * 0.55);
    o.way([b, k1, k2, k3, c], STREET);
  } else o.way([b, c], STREET);
  o.way([c, d], STREET);
  o.way([d, a], STREET);
  return o;
};

describe("Follow the Shape on real pedestrian networks", () => {
  // 1
  it("never reads test fixtures or synthetic networks in production code", () => {
    const root = path.join(__dirname, "../..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, f.name);
        if (f.isDirectory()) {
          if (!["node_modules", "__tests__", ".git"].includes(f.name)) walk(p);
        } else if (/\.(ts|tsx)$/.test(f.name)) files.push(p);
      }
    };
    ["app", "src", "supabase/functions"].forEach((d) => walk(path.join(root, d)));
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter((f) => /__tests__|fixtures\/|pedestrianGraphs|GraphBuilder|squareTown|parkTown|riverTown|preview grid|Synthetic preview/i.test(fs.readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  });

  // 2
  it("returns no route when there is no pedestrian data", () => {
    expect(osmToGraph({ elements: [] }, ORIGIN).edges).toHaveLength(0);
    expect(run({ elements: [] })).toMatchObject({ ok: false, reason: "no_network" });
    // Buildings, rails and water alone are not a network.
    const o = new Osm();
    o.way([o.node(0, 0), o.node(50, 0), o.node(50, 50), o.node(0, 0)], { building: "yes" });
    o.way([o.node(-100, -100), o.node(100, 100)], { railway: "rail" });
    expect(run(o.data())).toMatchObject({ ok: false, reason: "no_network" });
  });

  // 3
  it("never joins streets that only cross on the map without a shared junction", () => {
    const o = new Osm();
    o.way([o.node(-200, 0), o.node(200, 0)], STREET);
    o.way([o.node(0, -200), o.node(0, 200)], STREET); // an overpass: crosses, shares no node
    const g = osmToGraph(o.data(), ORIGIN);
    const nodesOf = (e: OsmEdge) => [e.a, e.b];
    const [h, v] = g.edges;
    expect(nodesOf(h).some((n) => nodesOf(v).includes(n))).toBe(false);
    // A block whose fourth corner is not a shared node can't make a loop.
    const b = new Osm();
    const a1 = b.node(0, 0);
    const b1 = b.node(245, 0);
    const c1 = b.node(245, 245);
    const d1 = b.node(0, 245);
    const d2 = b.node(0, 245); // same place, different node: not connected
    b.way([a1, b1], STREET);
    b.way([b1, c1], STREET);
    b.way([c1, d1], STREET);
    b.way([d2, a1], STREET);
    expect(run(b.data()).ok).toBe(false);
  });

  // 4
  it("drops a path through a building unless it is a mapped passage", () => {
    const o = new Osm();
    o.way([o.node(40, -30), o.node(80, -30), o.node(80, 30), o.node(40, 30), o.node(40, -30)], { building: "yes" });
    // Built separately to keep node ids distinct per way.
    const cut = o.node(0, 0);
    const through = o.way([cut, o.node(120, 0)], { highway: "footway" });
    const p2 = o.way([o.node(0, 10), o.node(120, 10)], { highway: "footway", tunnel: "building_passage" });
    const g = osmToGraph(o.data(), ORIGIN);
    expect(g.edges.some((e) => e.wayId === through)).toBe(false);
    expect(g.edges.some((e) => e.wayId === p2)).toBe(true);
    expect(g.dropped.building).toBe(1);
  });

  // 5
  it("drops a path over a railway unless there is a mapped crossing, and warns at the crossing", () => {
    const o = new Osm();
    const railMid = o.node(0, 0, { railway: "crossing" });
    o.way([o.node(-200, 50), o.node(200, 50)], { railway: "rail" });
    o.way([o.node(-200, 0), railMid, o.node(200, 0)], { railway: "rail" });
    const bad = o.way([o.node(-60, 20), o.node(-60, 80)], { highway: "footway" });
    const good = o.way([o.node(0, -40), railMid, o.node(0, 30)], { highway: "footway" });
    const bridge = o.way([o.node(60, 20), o.node(60, 80)], { highway: "footway", bridge: "yes" });
    const g = osmToGraph(o.data(), ORIGIN);
    expect(g.edges.some((e) => e.wayId === bad)).toBe(false);
    const crossing = g.edges.filter((e) => e.wayId === good);
    expect(crossing.length).toBeGreaterThan(0);
    expect(crossing.some((e) => e.warnings.includes("rail_crossing"))).toBe(true);
    expect(g.edges.some((e) => e.wayId === bridge)).toBe(true);
    expect(g.dropped.railway).toBe(1);
  });

  // 6
  it("drops a path across water unless it is a bridge, and never uses a ford", () => {
    const o = new Osm();
    o.way([o.node(-200, 0), o.node(200, 0)], { waterway: "river" });
    const wade = o.way([o.node(-50, -40), o.node(-50, 40)], { highway: "path" });
    const bridge = o.way([o.node(50, -40), o.node(50, 40)], { highway: "footway", bridge: "yes" });
    const ford = o.way([o.node(100, -40), o.node(100, 40)], { highway: "path", ford: "yes" });
    const g = osmToGraph(o.data(), ORIGIN);
    expect(g.edges.some((e) => e.wayId === wade)).toBe(false);
    expect(g.edges.some((e) => e.wayId === bridge)).toBe(true);
    expect(g.edges.some((e) => e.wayId === ford)).toBe(false);
    expect(g.dropped.water).toBe(1);
  });

  // 7
  it.each([
    [{ highway: "residential", access: "private" }, "private"],
    [{ highway: "footway", foot: "no" }, "no_foot"],
    [{ highway: "motorway" }, "not_for_walking"],
    [{ highway: "trunk", sidewalk: "both" }, "not_for_walking"],
    [{ highway: "primary" }, "busy_road_no_sidewalk"],
    [{ highway: "residential", sidewalk: "separate" }, "sidewalk_mapped_separately"],
    [{ highway: "path", informal: "yes" }, "informal"],
    [{ highway: "service", service: "driveway" }, "service_lane"],
    [{ highway: "cycleway" }, "no_foot_access"],
    [{ highway: "track" }, "no_foot_access"],
    [{ highway: "path", sac_scale: "alpine_hiking" }, "mountain_trail"],
    [{ highway: "footway", indoor: "yes" }, "indoor"],
    [{ highway: "pedestrian", area: "yes" }, "area"],
  ])("never walks %j", (tags, reason) => {
    expect(classifyWay(tags)).toEqual({ ok: false, reason });
  });

  it("walks paths, quiet streets and busy roads with sidewalks, with honest warnings", () => {
    expect(classifyWay({ highway: "footway" })).toEqual({ ok: true, warnings: [] });
    expect(classifyWay({ highway: "residential" })).toEqual({ ok: true, warnings: ["no_sidewalk_mapped"] });
    expect(classifyWay({ highway: "residential", sidewalk: "no" })).toEqual({ ok: true, warnings: ["no_sidewalk"] });
    expect(classifyWay({ highway: "primary", sidewalk: "both" })).toEqual({ ok: true, warnings: ["busy_road"] });
    expect(classifyWay({ highway: "steps", surface: "gravel" })).toEqual({ ok: true, warnings: ["steps", "unpaved"] });
    expect(classifyWay({ highway: "residential", access: "private", foot: "yes" }).ok).toBe(true);
    expect(classifyWay({ highway: "cycleway", foot: "designated" }).ok).toBe(true);
  });

  it("cuts a way at a locked or private gate", () => {
    expect(isBlockingNode({ barrier: "gate", access: "private" })).toBe(true);
    expect(isBlockingNode({ barrier: "gate", locked: "yes" })).toBe(true);
    expect(isBlockingNode({ barrier: "gate" })).toBe(false);
    expect(isBlockingNode({ barrier: "fence" })).toBe(true);
    const o = new Osm();
    const gate = o.node(100, 0, { barrier: "gate", access: "private" });
    o.way([o.node(0, 0), o.node(50, 0), gate, o.node(150, 0), o.node(200, 0)], { highway: "footway" });
    const g = osmToGraph(o.data(), ORIGIN);
    expect(g.edges.some((e) => e.a === `osm:n${gate}` || e.b === `osm:n${gate}`)).toBe(false);
  });

  // 8 and 9
  it("builds every route from real connected edges, measured along their geometry", () => {
    const g = osmToGraph(grid().o.data(), ORIGIN);
    const res = generateShapeRoutes(g, { start: ORIGIN, shape: square, minutes: 15 });
    expect(res.ok).toBe(true);
    for (const o of optionsOf(res)) {
      expect(validateRoute(o, g)).toBeNull();
      let len = 0;
      for (let k = 1; k < o.path.length; k++) len += metersBetween(o.path[k - 1], o.path[k]);
      expect(Math.abs(len - o.lengthM)).toBeLessThan(1);
      expect(o.edgeIds.every((id) => g.edges.some((e) => e.id === id))).toBe(true);
    }
  });

  it("catches a tampered route: a missing edge, a gap, a fake line, a wrong length, an open loop", () => {
    const g = osmToGraph(grid().o.data(), ORIGIN);
    const o = optionsOf(generateShapeRoutes(g, { start: ORIGIN, shape: square, minutes: 15 }))[0];
    expect(validateRoute({ ...o, steps: [{ edgeId: "osm:w999:1-2", forward: true }, ...o.steps.slice(1)] }, g)).toBe("unknown_edge");
    expect(validateRoute({ ...o, steps: o.steps.filter((_, i) => i !== 1) }, g)).toBe("disconnected");
    expect(validateRoute({ ...o, path: [o.path[0], o.path[o.path.length - 1]] }, g)).toBe("path_mismatch");
    expect(validateRoute({ ...o, lengthM: o.lengthM * 1.2 }, g)).toBe("length_mismatch");
    expect(validateRoute({ ...o, steps: o.steps.slice(0, -1), path: o.path }, g)).toMatch(/not_closed|path_mismatch/);
  });

  // 10
  it("computes the shape match from the real route, never a fixed 100", () => {
    const straight = optionsOf(run(block().data()))[0];
    const kinked = optionsOf(run(block(245, 25).data()))[0];
    expect(straight).toBeDefined();
    expect(kinked).toBeDefined();
    expect(kinked.estimate).toBeLessThan(straight.estimate);
    expect(kinked.estimate).toBeLessThan(100);
    expect(kinked.estimate).toBeGreaterThan(0);
  });

  // 11 and 12
  it("never offers the same loop twice: not restarted, not reversed, not nudged onto a parallel path", () => {
    const g = osmToGraph(grid(7, 110).o.data(), ORIGIN);
    const opts = optionsOf(generateShapeRoutes(g, { start: ORIGIN, shape: square, minutes: 15 }));
    expect(opts.length).toBeGreaterThan(1);
    const byId = new Map(g.edges.map((e) => [e.id, e]));
    for (let i = 0; i < opts.length; i++)
      for (let j = i + 1; j < opts.length; j++) expect(overlapRatio(opts[i].edgeIds, opts[j].edgeIds, byId)).toBeLessThan(ROUTE_RULES.maxOptionOverlap);
    // The same loop walked backwards shares every edge, so it could never pass.
    const reversed = [...opts[0].edgeIds].reverse();
    expect(overlapRatio(opts[0].edgeIds, reversed, byId)).toBe(1);
  });

  // 13
  it("shows one route when only one exists", () => {
    const res = run(block().data());
    expect(res.ok).toBe(true);
    expect(optionsOf(res)).toHaveLength(1);
    expect((res as { limited: boolean }).limited).toBe(true);
  });

  // 14
  it("explains every empty result in plain words, with something to try", () => {
    expect(OUTCOME_COPY.no_feasible_route.title).toBe("No suitable walking route found here");
    expect(OUTCOME_COPY.no_feasible_route.body).toBe("Try another shape, starting location, or walking distance.");
    for (const copy of Object.values(OUTCOME_COPY)) {
      expect(copy.title.length).toBeGreaterThan(5);
      expect(copy.actions.length).toBeGreaterThan(0);
      expect(copy.body).not.toMatch(/—/);
    }
    // A network too small for the walk asked for gives that outcome, not a made-up loop.
    expect(run(block(80).data(), 40).ok).toBe(false);
  });

  // 15
  it("puts routes like a recent walk behind new ones", () => {
    const data = grid(7, 110).o.data();
    const first = optionsOf(run(data));
    expect(first.length).toBeGreaterThan(1);
    const again = optionsOf(run(data, 15, [first[0].edgeIds]));
    expect(again[0].edgeIds).not.toEqual(first[0].edgeIds);
    const old = again.find((o) => o.edgeIds.join() === first[0].edgeIds.join());
    if (old) expect(old.recentOverlap).toBeGreaterThan(ROUTE_RULES.maxRecentOverlap);
  });

  // 16
  it("gives no official score to a route nobody has walked", () => {
    const g = osmToGraph(block().data(), ORIGIN);
    const o = optionsOf(generateShapeRoutes(g, { start: ORIGIN, shape: square, minutes: 15 }))[0];
    const byId = new Map(g.edges.map((e) => [e.id, e]));
    const legs = o.steps.map((s) => {
      const e = byId.get(s.edgeId)!;
      return { edgeId: e.id, lengthM: e.lengthM, coords: (s.forward ? e.coords : [...e.coords].reverse()) as [number, number][] };
    });
    // A perfect route estimate, but no GPS walk: nothing official.
    const verdict = scoreRouteWalk(o.shapeScore, routeProgress([], legs));
    expect(verdict.ok).toBe(false);
    expect(verdict.final).toBe(0);
    expect(verdict.issues).toContain("route_incomplete");
  });

  it("lists a route's warnings, most important first", () => {
    const o = new Osm();
    const a = o.node(0, 0);
    const b = o.node(100, 0);
    const c = o.node(200, 0);
    o.way([a, b], { highway: "residential" });
    o.way([b, c], { highway: "primary", sidewalk: "right" });
    const g = osmToGraph(o.data(), ORIGIN);
    expect(routeWarnings(g.edges.map((e) => e.id), new Map(g.edges.map((e) => [e.id, e])))).toEqual(["busy_road", "no_sidewalk_mapped"]);
  });
});
