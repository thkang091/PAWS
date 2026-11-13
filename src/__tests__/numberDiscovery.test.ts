/**
 * Location-first Number Trail (phases L1 and L2): which numbers from 0 to 99 can be walked near a point, and every
 * distinct route for one of them. Synthetic test networks check the rules; the real OpenStreetMap extracts (gated on
 * PAWS_OSM_DIR, © OpenStreetMap contributors, ODbL, not in the repository) check the claims about real streets.
 */
import { GraphBuilder } from "./fixtures/pedestrianGraphs";
import { DIGIT_SEGMENTS, SEGMENT_ENDS, type Corner, type Digit } from "../../supabase/functions/tournament/digits";
import { parseTargetNumber, CHOOSABLE_NUMBERS } from "../../supabase/functions/tournament/numberInput";
import {
  DISCOVERY_NUMBERS,
  discoverNumbers,
  listNumberRoutes,
  mergeDiscovery,
  routeEdges,
  routeIdOf,
  sameCourse,
} from "../../supabase/functions/tournament/numberDiscovery";
import { chooseNumber, planNumberRoutes, planPieces, validateNumberPlan, type NumberPlan } from "../../supabase/functions/tournament/numberRoutes";
import { buildCourse, verifyRace } from "../../supabase/functions/tournament/numberMatch";
import { osmToGraph, classifyWay, type OsmData } from "../../supabase/functions/tournament/osm";
import type { TrackPoint } from "../../supabase/functions/tournament/geo";
import type { PedGraph } from "../../supabase/functions/tournament/routes";

declare const require: (m: string) => any;
declare const process: { env: Record<string, string | undefined> };
const fs = require("fs");
const path = require("path");

const CELL = 110;
const addDigit = (b: GraphBuilder, prefix: string, d: Digit, ox: number, oy: number) => {
  const at = (c: Corner): [number, number] => [ox + (c.endsWith("R") ? 1 : 0) * CELL, oy + (c.startsWith("T") ? 2 : c.startsWith("M") ? 1 : 0) * CELL];
  const corners = new Set<Corner>();
  for (const s of DIGIT_SEGMENTS[d]) SEGMENT_ENDS[s].forEach((c) => corners.add(c));
  for (const c of corners) b.node(`${prefix}${c}`, ...at(c));
  for (const s of DIGIT_SEGMENTS[d]) b.edge(`${prefix}${s}`, `${prefix}${SEGMENT_ENDS[s][0]}`, `${prefix}${SEGMENT_ENDS[s][1]}`);
  return (c: Corner) => `${prefix}${c}`;
};

const T0 = Date.UTC(2026, 10, 7, 9);
const walk = (plan: NumberPlan, graph: PedGraph, withApproach = false): TrackPoint[] => {
  const coords = planPieces(plan, graph).filter((p) => withApproach || p.part !== "approach").flatMap((p) => p.coords);
  const out: TrackPoint[] = [];
  let t = T0 + 1000;
  for (let i = 1; i < coords.length; i++) {
    const [lo1, la1] = coords[i - 1];
    const [lo2, la2] = coords[i];
    const k = 111_320 * Math.cos((la1 * Math.PI) / 180);
    const n = Math.max(1, Math.round(Math.hypot((lo2 - lo1) * k, (la2 - la1) * 110_540) / 5));
    for (let j = 0; j < n; j++) out.push({ latitude: la1 + ((la2 - la1) * j) / n, longitude: lo1 + ((lo2 - lo1) * j) / n, accuracyM: 6, capturedAt: (t += 4000), seq: out.length + 1, segment: 0 });
  }
  const [lo, la] = coords[coords.length - 1];
  out.push({ latitude: la, longitude: lo, accuracyM: 6, capturedAt: (t += 4000), seq: out.length + 1, segment: 0 });
  return out;
};

/** A grid whose blocks vary between 78 m and 104 m: many numbers, deterministically. */
const town = () => {
  const xs = [0, 84, 170, 248, 352, 438, 520, 611, 697, 790, 872, 961];
  const ys = [0, 91, 172, 266, 349, 437, 531, 612, 703, 789, 880, 963];
  const b = new GraphBuilder();
  xs.forEach((x, c) => ys.forEach((y, r) => b.node(`g${c}_${r}`, x, y)));
  xs.forEach((_, c) =>
    ys.forEach((_, r) => {
      if (c + 1 < xs.length) b.edge(`h${c}_${r}`, `g${c}_${r}`, `g${c + 1}_${r}`);
      if (r + 1 < ys.length) b.edge(`v${c}_${r}`, `g${c}_${r}`, `g${c}_${r + 1}`);
    }),
  );
  return { graph: b.graph(), start: b.at(438, 437) };
};

describe("0 to 99", () => {
  it("every number from 0 to 99 is represented, canonically, once", () => {
    expect(DISCOVERY_NUMBERS).toHaveLength(100);
    expect(DISCOVERY_NUMBERS[0]).toBe("0");
    expect(DISCOVERY_NUMBERS[99]).toBe("99");
    expect(new Set(DISCOVERY_NUMBERS).size).toBe(100);
    expect(CHOOSABLE_NUMBERS).toEqual(DISCOVERY_NUMBERS);
    expect(parseTargetNumber("0")).toMatchObject({ ok: true, number: "0", digits: ["0"] });
    expect(parseTargetNumber("00")).toMatchObject({ ok: false, error: "leading_zero" });
    expect(parseTargetNumber("07")).toMatchObject({ ok: false, error: "leading_zero" });
  });

  it("a lone 0 on real-looking streets: available as one digit, walked and verified", () => {
    const b = new GraphBuilder();
    b.node("s", -60, -40);
    const c = addDigit(b, "z", "0", 0, 0);
    b.edge("lead", "s", c("BL"));
    const graph = b.graph();
    const r = discoverNumbers(graph, { start: b.nodes.get("s")!, radiusM: 1_000 });
    const zero = r.numbers.find((n) => n.number === "0")!;
    expect(zero.status).toBe("AVAILABLE");
    // A 0's streets also draw a 1 (its right side) and a 7 (top and right side): real subsets, nothing else. The rest
    // were checked, not skipped.
    expect(r.available).toEqual(["0", "1", "7"]);
    expect(r.numbers.filter((n) => n.status === "NOT_FOUND_IN_CHECKED_AREA")).toHaveLength(97);
    const g = listNumberRoutes(graph, { start: b.nodes.get("s")!, radiusM: 1_000, number: "0" });
    expect(g.plans).toHaveLength(1);
    expect(g.complete).toBe(true);
    const plan = g.plans[0];
    expect(plan.number).toBe("0");
    expect(plan.digits.map((d) => d.digit)).toEqual(["0"]);
    expect(validateNumberPlan(plan, graph)).toBeNull();
    const v = verifyRace(walk(plan, graph), buildCourse(plan, graph, { startAtFirstDigit: true }), { raceStartMs: T0, nowMs: T0 + 3_600_000 });
    expect(v.eligible).toBe(true);
    expect(v.phase).toBe("NUMBER_COMPLETE");
  });
});

describe("nearby races go ahead on any one number", () => {
  it("streets that only draw single digits still give a race (0, 1 or 7 here), verified end to end", () => {
    const b = new GraphBuilder();
    b.node("s", -60, -40);
    const c = addDigit(b, "z", "0", 0, 0);
    b.edge("lead", "s", c("BL"));
    // A long straight street out of town: real network length, but it draws no digit.
    for (let i = 1; i <= 50; i++) {
      b.node(`w${i}`, -60 - i * 100, -40);
      b.edge(`we${i}`, i === 1 ? "s" : `w${i - 1}`, `w${i}`);
    }
    const graph = b.graph();
    const start = b.nodes.get("s")!;
    const r = planNumberRoutes(graph, { start, minutes: 15 });
    expect(r.ok).toBe(true);
    // No two-digit number fits these streets; every plan is a single digit the discovery screen also shows.
    expect(r.plans.length).toBeGreaterThan(0);
    for (const plan of r.plans) {
      expect(plan.number).toMatch(/^[0-9]$/);
      expect(["0", "1", "7"]).toContain(plan.number);
      expect(validateNumberPlan(plan, graph)).toBeNull();
    }
    const pick = chooseNumber(r.plans, () => 0.5)!;
    // A nearby race starts where the players stand, so the walk includes the way to the digit.
    const v = verifyRace(walk(pick, graph, true), buildCourse(pick, graph), { raceStartMs: T0, nowMs: T0 + 3_600_000 });
    expect(v.progress.digits).toHaveLength(1);
    expect(v.phase).toBe("NUMBER_COMPLETE");
  });

  it("where two-digit numbers fit, single digits that fit the race join the draw too", () => {
    const { graph, start } = town();
    const r = planNumberRoutes(graph, { start, minutes: 25 });
    expect(r.ok).toBe(true);
    expect(r.plans.some((p) => p.number.length === 2)).toBe(true);
    for (const p of r.plans.filter((x) => x.number.length === 1)) expect(validateNumberPlan(p, graph)).toBeNull();
  });
});

describe("availability: only what a validated route backs", () => {
  const { graph, start } = town();
  const r = discoverNumbers(graph, { start, radiusM: 1_000 });

  it("every available number has a route that passes the independent check", () => {
    expect(r.available.length).toBeGreaterThan(5);
    expect(r.partial).toBe(false);
    for (const number of r.available.filter((_, i) => i % 3 === 0)) {
      const g = listNumberRoutes(graph, { start, radiusM: 1_000, number, limit: 3 });
      expect(g.plans.length).toBeGreaterThan(0);
      for (const p of g.plans) {
        expect(p.number).toBe(number);
        expect(p.digits.map((d) => d.digit).join("")).toBe(number);
        expect(validateNumberPlan(p, graph)).toBeNull();
      }
    }
  });

  it("not found means checked and nothing: the gallery agrees", () => {
    const missing = r.numbers.filter((n) => n.status === "NOT_FOUND_IN_CHECKED_AREA").map((n) => n.number);
    for (const number of missing.slice(0, 6)) {
      const g = listNumberRoutes(graph, { start, radiusM: 1_000, number });
      expect(g.plans).toEqual([]);
      expect(g.complete).toBe(true);
    }
  });

  it("running out of time leaves numbers unchecked, never 'not found'", () => {
    let t = 0;
    const late = discoverNumbers(graph, { start, radiusM: 1_000, deadlineAt: 0, clock: () => (t += 1) });
    expect(late.partial).toBe(true);
    expect(late.numbers.some((n) => n.status === "NOT_FOUND_IN_CHECKED_AREA")).toBe(false);
    expect(late.numbers.every((n) => n.status === "NOT_YET_CHECKED")).toBe(true);
    // Continuing fills the gaps, and keeps what was found.
    const merged = mergeDiscovery(late, r);
    expect(merged.available).toEqual(r.available);
    expect(merged.partial).toBe(false);
  });

  it("only some numbers: the others are NOT_YET_CHECKED", () => {
    const some = discoverNumbers(graph, { start, radiusM: 1_000, only: ["7", "42"] });
    expect(some.numbers.filter((n) => n.status === "NOT_YET_CHECKED")).toHaveLength(98);
  });

  it("no streets, or no public start: nothing walkable, said plainly", () => {
    const empty = discoverNumbers({ nodes: [], edges: [] }, { start, radiusM: 1_000 });
    expect(empty.reason).toBe("no_network");
    expect(empty.available).toEqual([]);
    const b = new GraphBuilder();
    b.node("a", 0, 0).node("b", 30, 0).edge("tiny", "a", "b");
    const island = discoverNumbers(b.graph(), { start: b.at(0, 0), radiusM: 1_000 });
    expect(island.reason).toBe("no_public_start");
    expect(island.available).toEqual([]);
  });
});

describe("distinct routes", () => {
  const { graph, start } = town();

  it("routes for one number are all different courses, with stable ids", () => {
    const g = listNumberRoutes(graph, { start, radiusM: 1_000, number: "7", limit: 24 });
    expect(g.plans.length).toBeGreaterThan(1);
    const edges = g.plans.map(routeEdges);
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) expect(sameCourse(edges[i], edges[j])).toBe(false);
    expect(new Set(g.ids).size).toBe(g.ids.length);
    const again = listNumberRoutes(graph, { start, radiusM: 1_000, number: "7", limit: 24 });
    expect(again.ids).toEqual(g.ids);
  });

  it("the same streets walked backwards or from another corner are one course with one id", () => {
    const g = listNumberRoutes(graph, { start, radiusM: 1_000, number: "7", limit: 1 });
    const p = g.plans[0];
    const reversed = { ...p, digits: p.digits.map((d) => ({ ...d, strokeEdgeIds: [...d.strokeEdgeIds].reverse() })) };
    expect(routeIdOf(reversed)).toBe(routeIdOf(p));
    expect(sameCourse(routeEdges(p), routeEdges(reversed))).toBe(true);
    // One street different out of many: still one course.
    const e = routeEdges(p);
    expect(sameCourse(e, [...e.slice(1), "other"])).toBe(e.length >= 5);
  });

  it("pages continue exactly where the last stopped", () => {
    const all = listNumberRoutes(graph, { start, radiusM: 1_000, number: "7", limit: 10 });
    const one = listNumberRoutes(graph, { start, radiusM: 1_000, number: "7", limit: 5 });
    const two = listNumberRoutes(graph, { start, radiusM: 1_000, number: "7", after: 5, limit: 5 });
    expect([...one.ids, ...two.ids]).toEqual(all.ids);
  });

  it("one route when there is one, two when there are two: never padded", () => {
    for (const count of [1, 2, 4]) {
      const b = new GraphBuilder();
      b.node("s", -40, -40);
      for (let k = 0; k < count; k++) {
        const c = addDigit(b, `d${k}_`, "7", k * 400, 0);
        b.edge(`lead${k}`, k ? `d${k - 1}_TR` : "s", c("TL"));
      }
      const g = listNumberRoutes(b.graph(), { start: b.nodes.get("s")!, radiusM: 2_000, number: "7", limit: 24 });
      expect(g.plans).toHaveLength(count);
      expect(g.complete).toBe(true);
    }
  });

  it("an unreachable course (across water) is never offered", () => {
    const b = new GraphBuilder();
    b.node("s", 0, 0);
    const reach = addDigit(b, "far", "7", 700, -CELL);
    b.edge("road", "s", reach("TL"), { via: [[350, 0], [700, 0]] });
    addDigit(b, "island", "7", 0, 150);
    const g = listNumberRoutes(b.graph(), { start: b.nodes.get("s")!, radiusM: 2_000, number: "7" });
    expect(g.plans).toHaveLength(1);
    expect(g.plans[0].legs.some((l) => l.edgeId.startsWith("island"))).toBe(false);
    expect(g.plans[0].approachM).toBeGreaterThanOrEqual(700);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Real streets
// ---------------------------------------------------------------------------------------------------------------

const DIR = process.env.PAWS_OSM_DIR;
const have = (n: string) => Boolean(DIR) && fs.existsSync(path.join(DIR ?? "", `${n}.json`));
const real = have("seoul_yeonnam") && have("portland_sellwood_wide") ? describe : describe.skip;

real("real OpenStreetMap streets", () => {
  jest.setTimeout(600_000);
  const load = (name: string, lat: number, lng: number) => {
    if (!have(name)) return null;
    const data: OsmData = JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), "utf8"));
    const start = { latitude: lat, longitude: lng };
    const ways = new Map<number, { nodes: number[]; tags: Record<string, string> }>();
    for (const el of data.elements) if (el.type === "way") ways.set(el.id, { nodes: el.nodes, tags: el.tags ?? {} });
    return { graph: osmToGraph(data, start), start, ways };
  };
  const yeonnam = load("seoul_yeonnam", 37.5627, 126.9236);
  const sellwood = load("portland_sellwood_wide", 45.466, -122.653);

  it("a wider search keeps every number and every course a narrower one found", () => {
    for (const area of [yeonnam, sellwood]) {
      if (!area) continue;
      const small = discoverNumbers(area.graph, { start: area.start, radiusM: 500 });
      const big = discoverNumbers(area.graph, { start: area.start, radiusM: 1_000 });
      for (const n of small.available) expect(big.available).toContain(n);
      for (const number of ["23", "7", "0"].filter((n) => small.available.includes(n))) {
        const a = listNumberRoutes(area.graph, { start: area.start, radiusM: 500, number, limit: 24 });
        const b = listNumberRoutes(area.graph, { start: area.start, radiusM: 1_000, number, limit: 24 });
        // Every narrower course is still there (the same streets, maybe chosen from another corner).
        if (b.complete) for (const p of a.plans) expect(b.plans.some((q) => sameCourse(routeEdges(p), routeEdges(q)))).toBe(true);
      }
    }
  });

  it("Seoul Yeonnam: 23 within 1 km, every distinct course, on real walkable ways", () => {
    if (!yeonnam) return;
    const d = discoverNumbers(yeonnam.graph, { start: yeonnam.start, radiusM: 1_000 });
    expect(d.available).toContain("23");
    const g = listNumberRoutes(yeonnam.graph, { start: yeonnam.start, radiusM: 1_000, number: "23", limit: 24 });
    expect(g.complete).toBe(true);
    expect(g.plans.length).toBeGreaterThanOrEqual(1);
    const byId = new Map(yeonnam.graph.edges.map((e) => [e.id, e]));
    for (const p of g.plans) {
      expect(validateNumberPlan(p, yeonnam.graph)).toBeNull();
      expect(p.digits.map((x) => x.digit).join("")).toBe("23");
      for (const leg of p.legs) {
        const m = /^osm:w(\d+):/.exec(byId.get(leg.edgeId)!.id)!;
        expect(classifyWay(yeonnam.ways.get(Number(m[1]))!.tags).ok).toBe(true);
      }
      const course = buildCourse(p, yeonnam.graph, { startAtFirstDigit: true });
      expect(verifyRace(walk(p, yeonnam.graph), course, { raceStartMs: T0, nowMs: T0 + 3_600_000 }).eligible).toBe(true);
    }
    const edges = g.plans.map(routeEdges);
    for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) expect(sameCourse(edges[i], edges[j])).toBe(false);
    if (process.env.PAWS_DISCOVERY_REPORT)
      fs.writeFileSync(process.env.PAWS_DISCOVERY_REPORT, JSON.stringify({ available: d.available, checkedRadiusM: d.checkedRadiusM, routes23: g.plans.map((p, i) => ({ id: g.ids[i], raceM: p.raceM, approachM: p.approachM, digitM: p.digitM, connectorM: p.connectorM, readability: p.digits.map((x) => x.readability) })) }, null, 2));
  });
});
