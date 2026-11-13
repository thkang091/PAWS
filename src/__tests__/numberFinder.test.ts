/**
 * Number Trail 1 to 99 (phase P1): the number a player types, and finding real courses for exactly that number, nearest
 * first by walking distance. Deterministic test networks (synthetic geometry, tests only); real OpenStreetMap areas
 * are in numberCrossCity.test.ts.
 */
import { GraphBuilder } from "./fixtures/pedestrianGraphs";
import { DIGIT_SEGMENTS, SEGMENT_ENDS, type Corner, type Digit } from "../../supabase/functions/tournament/digits";
import { CHOOSABLE_NUMBERS, parseTargetNumber } from "../../supabase/functions/tournament/numberInput";
import { findNumberRoutes, planNumberRoutes, planPieces, validateNumberPlan, type NumberPlan } from "../../supabase/functions/tournament/numberRoutes";
import { buildCourse, verifyRace } from "../../supabase/functions/tournament/numberMatch";
import type { TrackPoint } from "../../supabase/functions/tournament/geo";
import type { PedGraph } from "../../supabase/functions/tournament/routes";

const CELL = 110;
/** One digit's strokes as streets, bottom-left corner at (ox, oy) metres, ids prefixed. */
const addDigit = (b: GraphBuilder, prefix: string, d: Digit, ox: number, oy: number) => {
  const at = (c: Corner): [number, number] => [ox + (c.endsWith("R") ? 1 : 0) * CELL, oy + (c.startsWith("T") ? 2 : c.startsWith("M") ? 1 : 0) * CELL];
  const corners = new Set<Corner>();
  for (const s of DIGIT_SEGMENTS[d]) SEGMENT_ENDS[s].forEach((c) => corners.add(c));
  for (const c of corners) b.node(`${prefix}${c}`, ...at(c));
  for (const s of DIGIT_SEGMENTS[d]) b.edge(`${prefix}${s}`, `${prefix}${SEGMENT_ENDS[s][0]}`, `${prefix}${SEGMENT_ENDS[s][1]}`);
  return (c: Corner) => `${prefix}${c}`;
};

const T0 = Date.UTC(2026, 10, 7, 9, 0, 0);
const walkPlan = (plan: NumberPlan, graph: PedGraph): TrackPoint[] => {
  const coords = planPieces(plan, graph).flatMap((p) => p.coords);
  const out: TrackPoint[] = [];
  let t = T0 + 1000;
  for (let i = 1; i < coords.length; i++) {
    const [lo1, la1] = coords[i - 1];
    const [lo2, la2] = coords[i];
    const k = 111_320 * Math.cos((la1 * Math.PI) / 180);
    const n = Math.max(1, Math.round(Math.hypot((lo2 - lo1) * k, (la2 - la1) * 110_540) / 5));
    for (let j = 0; j < n; j++) {
      out.push({ latitude: la1 + ((la2 - la1) * j) / n, longitude: lo1 + ((lo2 - lo1) * j) / n, accuracyM: 6, capturedAt: t, seq: out.length + 1, segment: 0 });
      t += 4000;
    }
  }
  const [lo, la] = coords[coords.length - 1];
  out.push({ latitude: la, longitude: lo, accuracyM: 6, capturedAt: t, seq: out.length + 1, segment: 0 });
  return out;
};
const WINDOW = { raceStartMs: T0, nowMs: T0 + 3 * 3600_000 };

describe("the number a player types (0 to 99)", () => {
  it("accepts every whole number from 0 to 99, one digit up to 9 and two from 10", () => {
    expect(CHOOSABLE_NUMBERS).toHaveLength(100);
    for (let v = 1; v <= 99; v++) {
      const r = parseTargetNumber(String(v));
      expect(r).toEqual({ ok: true, number: String(v), value: v, digits: String(v).split("") });
    }
    for (const [input, digits] of [["1", 1], ["9", 1], ["10", 2], ["20", 2], ["42", 2], ["90", 2], ["99", 2]] as const) {
      const r = parseTargetNumber(input);
      expect(r.ok && r.digits.length).toBe(digits);
    }
    expect(parseTargetNumber(" 42 ")).toMatchObject({ ok: true, number: "42" });
    expect(parseTargetNumber(7)).toMatchObject({ ok: true, number: "7" });
  });
  it("refuses everything else, with a reason", () => {
    const cases: [unknown, string][] = [
      ["", "empty"], ["   ", "empty"], [null, "empty"],
      ["-3", "negative"], ["00", "leading_zero"], ["100", "too_big"], ["420", "too_big"],
      ["3.5", "decimal"], ["4,2", "decimal"], [".5", "decimal"],
      ["abc", "not_a_number"], ["4a", "not_a_number"], ["+5", "not_a_number"], ["4 2", "not_a_number"], ["#7", "not_a_number"],
      ["07", "leading_zero"], ["01", "leading_zero"], ["007", "leading_zero"],
    ];
    for (const [input, error] of cases) expect([input, parseTargetNumber(input)]).toEqual([input, { ok: false, error }]);
  });
});

describe("single-digit numbers 1 to 9", () => {
  for (const d of ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as Digit[]) {
    it(`${d}: a real one-digit course, no second digit, no connector, and an honest walk finishes it`, () => {
      const b = new GraphBuilder();
      const c = addDigit(b, "d", d, 0, 0);
      const cornerList = Object.keys(Object.fromEntries([...b.nodes.keys()].map((k) => [k, 1])));
      const graph = b.graph();
      const start = b.nodes.get(cornerList[0])!;
      const r = findNumberRoutes(graph, { start, number: d, radiusM: 1_000 });
      expect(r.ok).toBe(true);
      const plan = r.plans[0];
      expect(plan.number).toBe(d);
      expect(plan.digits).toHaveLength(1);
      expect(plan.layout).toBe("single");
      expect(plan.connectorM).toBe(0);
      expect(plan.legs.some((l) => l.part === "connector" || l.digit === 1)).toBe(false);
      expect(validateNumberPlan(plan, graph)).toBeNull();
      // Only this digit's own streets.
      const own = new Set(DIGIT_SEGMENTS[d].map((s) => `d${s}`));
      for (const l of plan.legs.filter((x) => x.part === "digit")) expect(own.has(l.edgeId)).toBe(true);
      const course = buildCourse(plan, graph);
      expect(course.digits).toHaveLength(1);
      const v = verifyRace(walkPlan(plan, graph), course, WINDOW);
      expect(v.reasons).toEqual([]);
      expect(v.eligible).toBe(true);
      expect(v.phase).toBe("NUMBER_COMPLETE");
      expect(c("TL")).toBeTruthy();
    });
  }
  it("a single digit with half its strokes walked is not complete", () => {
    const b = new GraphBuilder();
    addDigit(b, "d", "7", 0, 0);
    const graph = b.graph();
    const plan = findNumberRoutes(graph, { start: b.nodes.get("dTL")!, number: "7", radiusM: 1_000 }).plans[0];
    const pts = walkPlan(plan, graph);
    const v = verifyRace(pts.slice(0, Math.floor(pts.length / 2)), buildCourse(plan, graph), WINDOW);
    expect(v.eligible).toBe(false);
    expect(v.reasons).toContain("digit_one_incomplete");
  });
});

describe("two-digit numbers", () => {
  const grid = new GraphBuilder().grid(10, 10, 90);
  const G = grid.graph();
  const start = grid.at(405, 405);
  const n1 = new Set(planNumberRoutes(G, { start, minutes: 25 }).plans.map((p) => p.number));
  for (const n of ["11", "12", "27", "42", "55", "80", "88", "99"]) {
    it(`${n}: exactly this number, real streets, in walking order, or an honest no`, () => {
      const r = findNumberRoutes(G, { start, number: n, radiusM: 1_000 });
      if (n1.has(n)) expect(r.ok).toBe(true);
      if (!r.ok) {
        expect(r.plans).toEqual([]);
        return;
      }
      for (const plan of r.plans) {
        expect(plan.number).toBe(n);
        expect(plan.digits.map((d) => d.digit).join("")).toBe(n);
        expect(validateNumberPlan(plan, G)).toBeNull();
        const parts = plan.legs.map((l) => (l.part === "digit" ? `d${l.digit}` : l.part));
        const order = parts.filter((x, i) => x !== parts[i - 1]);
        expect(order).toEqual(order[0] === "approach" ? ["approach", "d0", "connector", "d1"] : ["d0", "connector", "d1"]);
        expect(plan.legs.some((l) => l.part === "finish")).toBe(false);
      }
      const v = verifyRace(walkPlan(r.plans[0], G), buildCourse(r.plans[0], G), WINDOW);
      expect(v.eligible).toBe(true);
    });
  }
  it("finds at least the numbers the N1 planner finds here", () => {
    const tested = ["11", "12", "27", "42", "55", "80", "88", "99"].filter((n) => n1.has(n));
    expect(tested.length).toBeGreaterThan(3);
  });
});

describe("exact length (practice and online)", () => {
  // Real blocks are not all one size: a grid whose blocks vary between 78 m and 104 m, deterministically.
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
  const G = b.graph();
  const start = b.at(438, 437);
  it("every course lands within 0.8% of the target, made up by a finish stretch on real streets", () => {
    let seen = 0;
    for (const n of ["12", "42", "88"]) {
      const r = findNumberRoutes(G, { start, number: n, radiusM: 1_000, targetM: 1_500, bandShare: 0.02, exact: true });
      for (const p of r.plans) {
        seen++;
        expect(Math.abs(p.raceM - 1_500)).toBeLessThanOrEqual(12 + 1);
        expect(validateNumberPlan(p, G)).toBeNull();
        const finish = p.legs.filter((l) => l.part === "finish");
        expect(finish.reduce((t, l) => t + G.edges.find((e) => e.id === l.edgeId)!.lengthM, 0)).toBeCloseTo(p.finishM ?? 0, -1);
        // The stretch never walks a stroke or the connector, and comes last.
        const strokes = new Set(p.digits.flatMap((d) => d.strokeEdgeIds));
        for (const l of finish) expect(strokes.has(l.edgeId)).toBe(false);
        if (finish.length) expect(p.legs[p.legs.length - 1].part).toBe("finish");
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
  it("a finish stretch must be walked: stopping at the last digit is not a finish", () => {
    const plan = ["12", "42", "88"].flatMap((n) => findNumberRoutes(G, { start, number: n, radiusM: 1_000, targetM: 1_500, bandShare: 0.02, exact: true }).plans).find((p) => (p.finishM ?? 0) > 100)!;
    expect(plan).toBeTruthy();
    const course = buildCourse(plan, G);
    expect(course.finish!.length).toBeGreaterThan(0);
    const full = walkPlan(plan, G);
    expect(verifyRace(full, course, WINDOW).eligible).toBe(true);
    // Cut the walk where the finish stretch begins.
    const digitsOnly = walkPlan({ ...plan, legs: plan.legs.filter((l) => l.part !== "finish") }, G);
    const v = verifyRace(digitsOnly, course, WINDOW);
    expect(v.eligible).toBe(false);
    expect(v.reasons).toContain("finish_incomplete");
    expect(v.phase).toBe("FINISH_IN_PROGRESS");
  });
  it("a length preference without `exact` (practice) is a plain band: no finish stretch", () => {
    for (const n of ["12", "42"]) {
      const r = findNumberRoutes(G, { start, number: n, radiusM: 1_000, targetM: 1_500, bandShare: 0.3 });
      for (const p of r.plans) {
        expect(p.raceM).toBeGreaterThanOrEqual(1_049);
        expect(p.raceM).toBeLessThanOrEqual(1_951);
        expect(p.legs.some((l) => l.part === "finish")).toBe(false);
      }
    }
  });
  it("a nearby race (no exact length) never gets a finish stretch", () => {
    for (const p of planNumberRoutes(G, { start, minutes: 25 }).plans) expect(p.legs.some((l) => l.part === "finish")).toBe(false);
  });
  it("on a perfectly uniform grid a finish corner may not exist: an honest no, never a stretched length", () => {
    const uniform = new GraphBuilder().grid(10, 10, 90);
    const r = findNumberRoutes(uniform.graph(), { start: uniform.at(405, 405), number: "7", radiusM: 1_000, targetM: 1_500, bandShare: 0.02, exact: true });
    for (const p of r.plans) expect(Math.abs(p.raceM - 1_500)).toBeLessThanOrEqual(13);
    if (!r.ok) expect(r.plans).toEqual([]);
  });
});

describe("nearest means nearest on foot", () => {
  /** A street from the start going east; a 7 at its end, `farM` along; another 7 `islandM` north with no way to it. */
  const town = (farM: number, islandM: number) => {
    const b = new GraphBuilder();
    b.node("s", 0, 0);
    const c = addDigit(b, "far", "7", farM, -CELL);
    b.node("w", farM - 1, -CELL * 2 + 0.5);
    b.edge("road", "s", c("TL"), { via: [[farM / 2, 0], [farM, 0]] });
    addDigit(b, "island", "7", 0, islandM);
    return b;
  };
  it("a closer course across water, with no path to it, never outranks a farther reachable one", () => {
    const b = town(700, 120);
    const graph = b.graph();
    const r = findNumberRoutes(graph, { start: b.nodes.get("s")!, number: "7", radiusM: 2_000 });
    expect(r.ok).toBe(true);
    for (const p of r.plans) expect(p.legs.some((l) => l.edgeId.startsWith("island"))).toBe(false);
    expect(r.plans[0].legs.some((l) => l.edgeId.startsWith("far"))).toBe(true);
    // The walking distance is the path on the graph (the 700 m street), not the straight line.
    expect(r.plans[0].approachM).toBeGreaterThanOrEqual(700);
  });
  it("search expansion: nothing within 500 m, found within 2 km", () => {
    const b = town(900, 3_000);
    const graph = b.graph();
    expect(findNumberRoutes(graph, { start: b.nodes.get("s")!, number: "7", radiusM: 500 }).ok).toBe(false);
    expect(findNumberRoutes(graph, { start: b.nodes.get("s")!, number: "7", radiusM: 2_000 }).ok).toBe(true);
  });
  it("several real alternatives, nearest first", () => {
    const b = new GraphBuilder();
    b.node("s", 0, 0);
    const near = addDigit(b, "near", "7", 300, -CELL);
    const far = addDigit(b, "far", "7", 900, -CELL);
    b.edge("r1", "s", near("TL"), { via: [[300, 0]] });
    b.edge("r2", near("TR"), far("TL"), { via: [[600, 0], [900, 0]] });
    const graph = b.graph();
    const r = findNumberRoutes(graph, { start: b.nodes.get("s")!, number: "7", radiusM: 2_000 });
    expect(r.plans.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < r.plans.length; i++) expect(r.plans[i].approachM).toBeGreaterThanOrEqual(r.plans[i - 1].approachM);
    expect(r.plans[0].legs.some((l) => l.edgeId.startsWith("near"))).toBe(true);
  });
  it("no course for this number: an honest empty answer, never another number", () => {
    const b = new GraphBuilder();
    addDigit(b, "d", "1", 0, 0);
    const graph = b.graph();
    const r = findNumberRoutes(graph, { start: b.nodes.get("dTR")!, number: "8", radiusM: 2_000 });
    expect(r).toMatchObject({ ok: false, number: "8", reason: "no_number_routes", plans: [] });
  });
  it("refuses non-canonical numbers rather than guessing", () => {
    const b = new GraphBuilder();
    addDigit(b, "d", "7", 0, 0);
    expect(findNumberRoutes(b.graph(), { start: b.nodes.get("dTL")!, number: "07", radiusM: 1_000 }).ok).toBe(false);
  });
});
