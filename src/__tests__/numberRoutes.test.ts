/**
 * Number Trail route generation on deterministic test networks (synthetic geometry, tests only; never routing data).
 * Real OpenStreetMap areas are covered by numberRealValidation.test.ts.
 */
import { GraphBuilder } from "./fixtures/pedestrianGraphs";
import { DIGITS, DIGIT_SEGMENTS, SEGMENT_ENDS, decodeSegments, type Corner, type Digit, type Segment } from "../../supabase/functions/tournament/digits";
import {
  NUMBER_RULES,
  chooseNumber,
  generateDigitRoutes,
  planNumberRoutes,
  planPieces,
  validateNumberPlan,
  type NumberPlan,
  type NumberPlanResult,
} from "../../supabase/functions/tournament/numberRoutes";
import type { PedGraph } from "../../supabase/functions/tournament/routes";

const CELL = 110;
/** Corner positions in metres (y north) of a digit frame whose bottom-left is at (ox, oy). */
const cornerAt = (c: Corner, ox: number, oy: number): [number, number] => {
  const col = c.endsWith("R") ? 1 : 0;
  const row = c.startsWith("T") ? 2 : c.startsWith("M") ? 1 : 0;
  return [ox + col * CELL, oy + row * CELL];
};

/**
 * A town whose only streets are one digit's seven-segment strokes, plus a street leading in. `broken` cuts that
 * segment in the middle, leaving two dead ends 30 m apart.
 */
const digitTown = (d: Digit, opts: { broken?: Segment } = {}) => {
  const b = new GraphBuilder();
  const corners = new Set<Corner>();
  for (const s of DIGIT_SEGMENTS[d]) SEGMENT_ENDS[s].forEach((c) => corners.add(c));
  for (const c of corners) b.node(c, ...cornerAt(c, 0, 0));
  for (const s of DIGIT_SEGMENTS[d]) {
    const [c1, c2] = SEGMENT_ENDS[s];
    if (opts.broken === s) {
      const [x1, y1] = cornerAt(c1, 0, 0);
      const [x2, y2] = cornerAt(c2, 0, 0);
      b.node(`${s}1`, x1 + (x2 - x1) * 0.36, y1 + (y2 - y1) * 0.36).node(`${s}2`, x1 + (x2 - x1) * 0.64, y1 + (y2 - y1) * 0.64);
      b.edge(`${s}a`, c1, `${s}1`).edge(`${s}b`, `${s}2`, c2);
    } else b.edge(s, c1, c2);
  }
  return b;
};

/**
 * Digits a d-shaped town could ever draw: those whose segments are all among d's, plus a 1 wherever the town has a
 * full-height straight street on either side (a 1 is just that line).
 */
const drawableWithin = (d: Digit) => {
  const has = (s: Segment) => DIGIT_SEGMENTS[d].includes(s);
  return DIGITS.filter((x) => DIGIT_SEGMENTS[x].every(has) || (x === "1" && ((has("B") && has("C")) || (has("E") && has("F")))));
};

const grid = new GraphBuilder().grid(10, 10, 90);
const GRID = grid.graph();
const CENTRE = grid.at(405, 405);

/** The same kind of grid turned 30 degrees anticlockwise. */
const turnedGrid = () => {
  const b = new GraphBuilder();
  const t = (30 * Math.PI) / 180;
  const at = (c: number, r: number): [number, number] => [c * 90 * Math.cos(t) - r * 90 * Math.sin(t), c * 90 * Math.sin(t) + r * 90 * Math.cos(t)];
  for (let c = 0; c < 10; c++) for (let r = 0; r < 10; r++) b.node(`t${c}_${r}`, ...at(c, r));
  for (let c = 0; c < 10; c++)
    for (let r = 0; r < 10; r++) {
      if (c < 9) b.edge(`th${c}_${r}`, `t${c}_${r}`, `t${c + 1}_${r}`);
      if (r < 9) b.edge(`tv${c}_${r}`, `t${c}_${r}`, `t${c}_${r + 1}`);
    }
  return { graph: b.graph(), centre: b.at(...at(4.5, 4.5)) };
};

let gridResult: NumberPlanResult;
beforeAll(() => {
  gridResult = planNumberRoutes(GRID, { start: CENTRE, minutes: 25 });
});

describe("DigitRouteGenerator on digit-shaped towns", () => {
  it.each(DIGITS)("digit %s: drawn on its own streets, read back as itself, and nothing it can't draw", (d) => {
    const town = digitTown(d);
    const g = town.graph();
    const found = generateDigitRoutes(g, town.at(CELL / 2, CELL), 25);
    const placements = found.placements.get(d) ?? [];
    expect(placements.length).toBeGreaterThan(0);
    const edgeIds = new Set(g.edges.map((e) => e.id));
    const nodeIds = new Set(g.nodes.map((n) => n.id));
    for (const pl of placements) {
      // Each required segment is drawn on that segment's own street, from corner to corner.
      expect(Object.keys(pl.segments).sort()).toEqual([...DIGIT_SEGMENTS[d]].sort());
      for (const s of DIGIT_SEGMENTS[d]) {
        for (const st of pl.segments[s]!) expect(edgeIds.has(st.edgeId)).toBe(true);
        expect(pl.segments[s]!.map((st) => st.edgeId)).toEqual([s]);
      }
      for (const c of Object.values(pl.corners)) expect(nodeIds.has(c!)).toBe(true);
      expect(decodeSegments(Object.keys(pl.segments) as Segment[])).toBe(d);
      expect(pl.readability).toBeGreaterThanOrEqual(NUMBER_RULES.minReadability);
      // Its walk covers every segment and starts and ends on corners.
      expect(new Set(pl.walk.strokes.map((s) => s.segment)).size).toBe(DIGIT_SEGMENTS[d].length);
    }
    // Unavailable digits: anything needing a street this town doesn't have is never found.
    for (const other of found.placements.keys()) expect(drawableWithin(d)).toContain(other);
  });

  it.each(DIGITS)("digit %s: breaking any one of its segments in the middle removes it", (d) => {
    for (const s of DIGIT_SEGMENTS[d]) {
      const town = digitTown(d, { broken: s });
      const found = generateDigitRoutes(town.graph(), town.at(CELL / 2, CELL), 25);
      expect(found.placements.get(d) ?? []).toEqual([]);
    }
  });

  it("never draws a segment across a gap, even when the corners line up", () => {
    // An 8 whose middle bar is two dead ends: the corners are exactly where an 8 needs them, but no street joins them.
    const town = digitTown("8", { broken: "G" });
    const found = generateDigitRoutes(town.graph(), town.at(CELL / 2, CELL), 25);
    expect(found.placements.has("8")).toBe(false);
    expect(found.placements.has("0")).toBe(true); // the outline is still a real 0
  });

  it("ignores streets that aren't walkable", () => {
    const town = digitTown("8");
    const g = town.graph();
    const closed: PedGraph = { nodes: g.nodes, edges: g.edges.map((e) => (e.id === "G" ? { ...e, access: "private" } : e)) };
    const found = generateDigitRoutes(closed, town.at(CELL / 2, CELL), 25);
    expect(found.placements.has("8")).toBe(false);
  });

  it("finds every digit on a regular grid", () => {
    const found = generateDigitRoutes(GRID, CENTRE, 25);
    expect([...found.placements.keys()].sort()).toEqual([...DIGITS]);
  });
});

describe("TwoDigitRoutePlanner", () => {
  it("plans many numbers on a grid, each passing the independent check", () => {
    expect(gridResult.ok).toBe(true);
    expect(gridResult.plans.length).toBeGreaterThan(40);
    for (const plan of gridResult.plans) expect(validateNumberPlan(plan, GRID)).toBeNull();
  });

  it("keeps every target as two characters, leading zeros included", () => {
    for (const plan of gridResult.plans) {
      expect(typeof plan.number).toBe("string");
      expect(plan.number).toMatch(/^[0-9]{2}$/);
      expect(plan.digits.map((d) => d.digit).join("")).toBe(plan.number);
    }
    expect(gridResult.plans.some((p) => p.number.startsWith("0"))).toBe(true);
  });

  it("generates no road geometry: every drawn point is a stored edge point", () => {
    const points = new Set(GRID.edges.flatMap((e) => e.coords.map(([lng, lat]) => `${lng},${lat}`)));
    for (const plan of gridResult.plans.slice(0, 20))
      for (const piece of planPieces(plan, GRID)) {
        const edge = GRID.edges.find((e) => e.id === piece.edgeId)!;
        expect(piece.coords.length).toBe(edge.coords.length);
        for (const [lng, lat] of piece.coords) expect(points.has(`${lng},${lat}`)).toBe(true);
      }
  });

  it("walks digit one, then a real connector, then digit two, all joined end to end", () => {
    for (const plan of gridResult.plans) {
      const parts = plan.legs.map((l) => (l.part === "digit" ? `d${l.digit}` : l.part));
      const order = parts.filter((p, i) => i === 0 || p !== parts[i - 1]);
      expect(order.filter((p) => p !== "approach")).toEqual(["d0", "connector", "d1"]);
      // The connector walks streets that belong to neither digit.
      const strokes = new Set(plan.digits.flatMap((d) => d.strokeEdgeIds));
      for (const l of plan.legs.filter((x) => x.part === "connector")) expect(strokes.has(l.edgeId)).toBe(false);
      // The digits share no street.
      const one = new Set(plan.digits[0].strokeEdgeIds);
      expect(plan.digits[1].strokeEdgeIds.some((id) => one.has(id))).toBe(false);
    }
  });

  it("reads left to right: digit two sits to the right of digit one", () => {
    for (const plan of gridResult.plans) {
      const centre = (k: 0 | 1) => {
        const f = plan.digits[k].frame;
        return f.origin.longitude + ((f.right[0] * f.widthM) / 2 + f.down[0] * f.halfHeightM) / (111_320 * Math.cos((f.origin.latitude * Math.PI) / 180));
      };
      expect(centre(1)).toBeGreaterThan(centre(0));
    }
  });

  it("measures the race from the edges and keeps it within the time asked", () => {
    const target = 25 * 60 * NUMBER_RULES.walkMps;
    for (const plan of gridResult.plans) {
      const byId = new Map(GRID.edges.map((e) => [e.id, e]));
      const race = plan.legs.filter((l) => l.part !== "approach").reduce((s, l) => s + byId.get(l.edgeId)!.lengthM, 0);
      expect(Math.abs(race - plan.raceM)).toBeLessThanOrEqual(1);
      expect(plan.raceM).toBeGreaterThanOrEqual(target * NUMBER_RULES.minShare);
      expect(plan.raceM).toBeLessThanOrEqual(target * NUMBER_RULES.maxShare);
      expect(plan.minutes).toBe(Math.max(1, Math.round(plan.raceM / NUMBER_RULES.walkMps / 60)));
    }
  });

  it("is deterministic", () => {
    const again = planNumberRoutes(GRID, { start: CENTRE, minutes: 25 });
    expect(again.plans.map((p) => `${p.number}:${p.legs.map((l) => l.edgeId).join(",")}`)).toEqual(gridResult.plans.map((p) => `${p.number}:${p.legs.map((l) => l.edgeId).join(",")}`));
  });

  it("follows a turned street grid and records the turn so the map can show the number upright", () => {
    const { graph, centre } = turnedGrid();
    const r = planNumberRoutes(graph, { start: centre, minutes: 25 });
    expect(r.ok).toBe(true);
    for (const plan of r.plans) {
      expect(validateNumberPlan(plan, graph)).toBeNull();
      expect(Math.abs(plan.headingDeg + 30)).toBeLessThanOrEqual(2);
    }
    // Upright grids need no turn.
    for (const plan of gridResult.plans) expect(Math.abs(plan.headingDeg)).toBeLessThanOrEqual(1);
  });
});

describe("feasible numbers only", () => {
  it("picks at random from the feasible numbers and never anything else", () => {
    const feasible = new Set(gridResult.plans.map((p) => p.number));
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const pick = chooseNumber(gridResult.plans, random)!;
      expect(feasible.has(pick.number)).toBe(true);
      seen.add(pick.number);
    }
    expect(seen.size).toBe(feasible.size); // every feasible number can come up
  });

  it("filters by difficulty, and says so when a band is empty instead of substituting", () => {
    for (const band of ["easy", "medium", "hard"] as const) {
      const pick = chooseNumber(gridResult.plans, () => 0.5, band);
      if (gridResult.plans.some((p) => p.difficulty === band)) expect(pick!.difficulty).toBe(band);
      else expect(pick).toBeNull();
    }
    expect(chooseNumber([], () => 0.3)).toBeNull();
    const onlyEasy = gridResult.plans.filter((p) => p.difficulty === "easy");
    expect(chooseNumber(onlyEasy, () => 0.9, "hard")).toBeNull();
  });

  it("excludes numbers the streets can't draw: a single straight street gives no numbers at all", () => {
    const town = digitTown("1");
    const r = planNumberRoutes(town.graph(), { start: town.at(CELL, CELL), minutes: 15 });
    expect(r.ok).toBe(false);
    expect(r.plans).toEqual([]);
  });

  it("excludes pairs that don't fit: a lone 8 can't make any two-digit number", () => {
    const town = digitTown("8");
    const r = planNumberRoutes(town.graph(), { start: town.at(CELL / 2, CELL), minutes: 15 });
    expect(r.plans).toEqual([]);
    expect(r.reason).toBe("no_number_routes");
  });

  it("returns no routes when there is no walkable network", () => {
    expect(planNumberRoutes({ nodes: [], edges: [] }, { start: CENTRE, minutes: 25 }).reason).toBe("no_network");
    const closed: PedGraph = { nodes: GRID.nodes, edges: GRID.edges.map((e) => ({ ...e, walkable: false })) };
    const r = planNumberRoutes(closed, { start: CENTRE, minutes: 25 });
    expect(r.reason).toBe("no_network");
    expect(r.plans).toEqual([]);
  });

  it("asks for a public start when the player is far from any walkable junction", () => {
    const far = grid.at(405, 2000);
    expect(planNumberRoutes(GRID, { start: far, minutes: 25 }).reason).toBe("no_public_start");
  });

  it("never starts on a small island of paths cut off from the streets", () => {
    const b = new GraphBuilder().grid(10, 10, 90);
    // A tiny plaza right where the player stands, joined to nothing.
    b.node("p1", 400, 400).node("p2", 440, 400).node("p3", 440, 440).edge("pa", "p1", "p2", { pathType: "footway" }).edge("pb", "p2", "p3", { pathType: "footway" });
    const g = b.graph();
    const r = planNumberRoutes(g, { start: b.at(401, 401), minutes: 25 });
    expect(r.ok).toBe(true);
    for (const plan of r.plans) expect(["p1", "p2", "p3"]).not.toContain(plan.approachFromNodeId);
  });
});

describe("DigitRouteValidator", () => {
  let plan: NumberPlan;
  beforeAll(() => {
    plan = gridResult.plans.find((p) => p.number === "27") ?? gridResult.plans[0];
  });
  const tamper = (fn: (p: NumberPlan) => void) => {
    const copy = JSON.parse(JSON.stringify(plan)) as NumberPlan;
    fn(copy);
    return validateNumberPlan(copy, GRID);
  };

  it("accepts the plan as built", () => {
    expect(validateNumberPlan(plan, GRID)).toBeNull();
  });
  it("rejects a number that isn't two characters", () => {
    expect(tamper((p) => (p.number = "7"))).toBe("bad_number");
    expect(tamper((p) => (p.number = p.number[1] + p.number[0]))).not.toBeNull();
  });
  it("rejects an edge that isn't in the network", () => {
    expect(tamper((p) => (p.legs[p.legs.length - 1].edgeId = "invented"))).toBe("unknown_edge");
  });
  it("rejects a jump between unconnected streets", () => {
    expect(
      tamper((p) => {
        const i = p.legs.findIndex((l) => l.part === "connector");
        p.legs.splice(i, 1);
      }),
    ).not.toBeNull();
  });
  it("rejects a connector that walks a stroke", () => {
    expect(
      tamper((p) => {
        const strokeLeg = p.legs.find((l) => l.part === "digit" && l.digit === 1)!;
        p.legs.push({ ...strokeLeg, part: "connector", digit: undefined, segment: undefined });
      }),
    ).not.toBeNull();
  });
  it("rejects a plan with no connector", () => {
    expect(tamper((p) => (p.legs = p.legs.filter((l) => l.part !== "connector")))).toBe("no_connector");
  });
  it("rejects a digit missing a segment", () => {
    expect(
      tamper((p) => {
        const seg = p.digits[0].walk.strokes[0].segment;
        p.legs = p.legs.filter((l) => !(l.part === "digit" && l.digit === 0 && l.segment === seg));
      }),
    ).not.toBeNull();
  });
  it("rejects relabelled strokes whose real geometry reads as another digit", () => {
    expect(
      tamper((p) => {
        p.number = "8" + p.number[1];
        p.digits[0].digit = "8";
      }),
    ).not.toBeNull();
  });
  it("rejects lengths that don't match the edges", () => {
    expect(tamper((p) => (p.raceM += 50))).toBe("length_mismatch");
  });
  it("rejects legs out of order", () => {
    expect(
      tamper((p) => {
        p.legs.reverse();
      }),
    ).not.toBeNull();
  });
});
