/**
 * NumberRaceEngine: GPS walks checked against Number Trail courses planned on a test grid (synthetic geometry, tests
 * only). Walks are sampled every 4 s at an easy 1.25 m/s with a few metres of seeded GPS noise.
 */
import { GraphBuilder } from "./fixtures/pedestrianGraphs";
import { DIGITS, type Digit } from "../../supabase/functions/tournament/digits";
import { planNumberRoutes, planPieces, type NumberPlan, type PlanPiece } from "../../supabase/functions/tournament/numberRoutes";
import { RACE_RULES, courseFromPlan, raceProgress, type RaceCourse } from "../../supabase/functions/tournament/numberRace";
import type { TrackPoint } from "../../supabase/functions/tournament/geo";

const grid = new GraphBuilder().grid(10, 10, 90);
const GRID = grid.graph();
const plans = planNumberRoutes(GRID, { start: grid.at(405, 405), minutes: 25 }).plans;
const T0 = Date.UTC(2026, 10, 6, 9, 0, 0);
const WINDOW = { raceStartMs: T0, nowMs: T0 + 3 * 3600_000 };

type LL = { latitude: number; longitude: number };
const M_LAT = 110_540;
const mLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** Points every `stepM` metres along pieces, in order, with seeded noise. */
const walk = (pieces: readonly Pick<PlanPiece, "coords">[], opts: { start?: number; seq?: number; segment?: number; stepM?: number; mps?: number; noiseM?: number; offsetM?: number; accuracyM?: number; seed?: number } = {}): TrackPoint[] => {
  const path: LL[] = [];
  for (const p of pieces) for (const [lng, lat] of p.coords) {
    const last = path[path.length - 1];
    if (!last || last.latitude !== lat || last.longitude !== lng) path.push({ latitude: lat, longitude: lng });
  }
  let seed = opts.seed ?? 11;
  const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647) * 2 - 1;
  const stepM = opts.stepM ?? 5;
  const out: TrackPoint[] = [];
  let t = opts.start ?? T0 + 1000;
  let seq = opts.seq ?? 1;
  const emit = (p: LL) => {
    const n = opts.noiseM ?? 3;
    out.push({ latitude: p.latitude + ((opts.offsetM ?? 0) + rand() * n) / M_LAT, longitude: p.longitude + (rand() * n) / mLng(p.latitude), accuracyM: opts.accuracyM ?? 8, capturedAt: t, seq: seq++, segment: opts.segment ?? 0 });
    t += (stepM / (opts.mps ?? 1.25)) * 1000;
  };
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const dy = (b.latitude - a.latitude) * M_LAT;
    const dx = (b.longitude - a.longitude) * mLng(a.latitude);
    const len = Math.hypot(dx, dy);
    const n = Math.max(1, Math.round(len / stepM));
    for (let k = 0; k < n; k++) emit({ latitude: a.latitude + ((b.latitude - a.latitude) * k) / n, longitude: a.longitude + ((b.longitude - a.longitude) * k) / n });
  }
  emit(path[path.length - 1]);
  return out;
};

const piecesOf = (plan: NumberPlan, part: "digit0" | "digit1" | "connector" | "race") =>
  planPieces(plan, GRID).filter((p) => (part === "race" ? p.part !== "approach" : part === "connector" ? p.part === "connector" : p.part === "digit" && p.digit === (part === "digit0" ? 0 : 1)));

const planStarting = (d: Digit) => plans.find((p) => p.number[0] === d)!;
const after = (pts: TrackPoint[]) => ({ start: pts[pts.length - 1].capturedAt + 4000, seq: pts[pts.length - 1].seq + 1 });

describe.each(DIGITS)("digit %s", (d) => {
  let plan: NumberPlan;
  let course: RaceCourse;
  beforeAll(() => {
    plan = planStarting(d);
    course = courseFromPlan(plan, GRID);
  });

  it("is planned on the grid", () => {
    expect(plan).toBeDefined();
    expect(course.digits[0].digit).toBe(d);
  });

  it("a realistic walk of the whole course finishes both digits, in order, and is eligible", () => {
    const r = raceProgress(walk(piecesOf(plan, "race")), course, WINDOW);
    expect(r.digits[0].complete).toBe(true);
    expect(r.digits[1].complete).toBe(true);
    expect(r.digits[0].completedSeq!).toBeLessThan(r.digits[1].completedSeq!);
    expect(r.eligible).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it("walking only digit one completes digit one and nothing more", () => {
    const r = raceProgress(walk(piecesOf(plan, "digit0")), course, WINDOW);
    expect(r.digits[0].complete).toBe(true);
    expect(r.digits[1].complete).toBe(false);
    expect(r.issues).toContain("digit_two_incomplete");
    expect(r.eligible).toBe(false);
  });

  it("70% of the digit's strokes is not enough", () => {
    const pieces = piecesOf(plan, "digit0");
    const total = pieces.reduce((s, p) => s + p.lengthM, 0);
    const part: PlanPiece[] = [];
    let sum = 0;
    for (const p of pieces) {
      if (sum + p.lengthM > total * 0.7) break;
      part.push(p);
      sum += p.lengthM;
    }
    const r = raceProgress(walk(part), course, WINDOW);
    expect(r.digits[0].complete).toBe(false);
    expect(r.digits[0].coverage).toBeLessThan(RACE_RULES.digitCoverage);
  });

  it("standing at each corner in turn, without walking the strokes, earns nothing", () => {
    const corners = course.digits[0].corners;
    const pts: TrackPoint[] = corners.flatMap((c, i) =>
      Array.from({ length: 5 }, (_, k) => ({ latitude: c.latitude, longitude: c.longitude, accuracyM: 6, capturedAt: T0 + 1000 + (i * 5 + k) * 60_000, seq: i * 5 + k + 1, segment: 0 })),
    );
    const r = raceProgress(pts, course, WINDOW);
    expect(r.digits[0].cornersPassed.length).toBe(corners.length);
    expect(r.digits[0].coverage).toBe(0);
    expect(r.digits[0].complete).toBe(false);
  });

  it("walking a parallel street 45 m away earns nothing", () => {
    const r = raceProgress(walk(piecesOf(plan, "digit0"), { offsetM: 45 }), course, WINDOW);
    expect(r.digits[0].complete).toBe(false);
  });

  it("covering the strokes at impossible speed earns nothing", () => {
    const r = raceProgress(walk(piecesOf(plan, "digit0"), { mps: 12 }), course, WINDOW);
    expect(r.digits[0].coverage).toBe(0);
  });
});

describe("order, connectors and repeats", () => {
  const plan = plans.find((p) => p.number === "27") ?? plans[0];
  const course = courseFromPlan(plan, GRID);

  it("walking digit two first earns nothing for it: the digits are walked in order", () => {
    const two = walk(piecesOf(plan, "digit1"));
    const one = walk(piecesOf(plan, "digit0"), after(two));
    const r = raceProgress([...two, ...one], course, WINDOW);
    expect(r.digits[0].complete).toBe(true);
    expect(r.digits[1].complete).toBe(false);
    expect(r.digits[1].coverage).toBeLessThan(0.1);
  });

  it("the connector never counts toward either digit", () => {
    const r = raceProgress(walk(piecesOf(plan, "connector")), course, WINDOW);
    expect(r.digits[0].coverage).toBe(0);
    expect(r.digits[1].coverage).toBe(0);
  });

  it("walking the same streets twice, or standing still, never counts twice", () => {
    const pieces = piecesOf(plan, "digit0");
    const half = pieces.slice(0, Math.floor(pieces.length / 2));
    const once = raceProgress(walk(half), course, WINDOW).digits[0].coverage;
    const first = walk(half);
    const back = walk([...half].reverse().map((p) => ({ coords: [...p.coords].reverse() })), after(first));
    const again = walk(half, after(back));
    const last = again[again.length - 1];
    const still = Array.from({ length: 200 }, (_, i) => ({ ...last, seq: last.seq + 1 + i, capturedAt: last.capturedAt + (i + 1) * 4000 }));
    const twice = raceProgress([...first, ...back, ...again, ...still], course, WINDOW).digits[0].coverage;
    expect(twice).toBeLessThanOrEqual(once + 0.02);
    expect(once).toBeGreaterThan(0.3);
  });

  it("repeated samples (the same fix sent again) change nothing", () => {
    const pts = walk(piecesOf(plan, "race"));
    const doubled = [...pts, ...pts.map((p) => ({ ...p }))];
    const a = raceProgress(pts, course, WINDOW);
    const b = raceProgress(doubled, course, WINDOW);
    expect(b.digits.map((x) => x.coverage)).toEqual(a.digits.map((x) => x.coverage));
    expect(b.digits[1].completedSeq).toBe(a.digits[1].completedSeq);
  });
});

describe("GPS problems", () => {
  const plan = plans.find((p) => p.number === "27") ?? plans[0];
  const course = courseFromPlan(plan, GRID);

  it("a GPS jump can't complete a stroke, and a long one makes the finish ineligible", () => {
    const pts = walk(piecesOf(plan, "race"));
    // Skip a third of the course instantly: the points after the jump keep their honest timing.
    const cut = Math.floor(pts.length / 3);
    const skipped = pts.slice(cut, cut * 2).length;
    const jumped = [...pts.slice(0, cut), ...pts.slice(cut * 2).map((p, i) => ({ ...p, capturedAt: pts[cut - 1].capturedAt + (i + 1) * 4000, seq: pts[cut - 1].seq + 1 + i }))];
    const r = raceProgress(jumped, course, WINDOW);
    expect(skipped).toBeGreaterThan(10);
    expect(r.eligible).toBe(false);
    expect(r.complete && r.issues.includes("gps_jump")).toBe(r.complete);
  });

  it("a lone spike is dropped as a glitch and the walk still finishes", () => {
    const pts = walk(piecesOf(plan, "race"));
    const i = Math.floor(pts.length / 2);
    pts[i] = { ...pts[i], latitude: pts[i].latitude + 300 / M_LAT };
    const r = raceProgress(pts, course, WINDOW);
    expect(r.flags.spikes).toBe(1);
    expect(r.eligible).toBe(true);
  });

  it("no straight line is drawn across a pause or lost signal", () => {
    const pieces = piecesOf(plan, "digit0");
    const all = walk(pieces);
    const a = all.slice(0, Math.floor(all.length * 0.3));
    // Resumes much further along (after a pause): what lies between was never walked on record.
    const b = all.slice(Math.floor(all.length * 0.6)).map((p) => ({ ...p, segment: 1 }));
    const r = raceProgress([...a, ...b], course, WINDOW);
    expect(r.digits[0].complete).toBe(false);
    expect(r.digits[0].coverage).toBeLessThan(0.8);
  });

  it("an old walk replayed earns nothing: fixes from before the race are ignored", () => {
    const old = walk(piecesOf(plan, "race"), { start: T0 - 2 * 3600_000 });
    const r = raceProgress(old, course, WINDOW);
    expect(r.flags.ignored).toBe(old.length);
    expect(r.digits[0].coverage).toBe(0);
  });

  it("imprecise fixes are not used", () => {
    const r = raceProgress(walk(piecesOf(plan, "race"), { accuracyM: 45 }), course, WINDOW);
    expect(r.digits[0].coverage).toBe(0);
    expect(r.issues).toContain("too_few_points");
  });

  it("crossing a digit's street earns almost nothing", () => {
    // Straight across the middle of a stroke, 40 m each side, as if cutting through.
    const edge = course.digits[0].edges.find((e) => e.lengthM > 60)!;
    const [lng1, lat1] = edge.coords[0];
    const [lng2, lat2] = edge.coords[edge.coords.length - 1];
    const mid = { latitude: (lat1 + lat2) / 2, longitude: (lng1 + lng2) / 2 };
    const dx = (lng2 - lng1) * mLng(lat1);
    const dy = (lat2 - lat1) * M_LAT;
    const len = Math.hypot(dx, dy);
    const [px, py] = [-dy / len, dx / len]; // across the street
    const across = { coords: [-40, 40].map((m) => [mid.longitude + (px * m) / mLng(mid.latitude), mid.latitude + (py * m) / M_LAT] as [number, number]) };
    const r = raceProgress(walk([across]), course, WINDOW);
    expect(r.digits[0].edges[edge.edgeId]).toBeLessThan(0.06);
  });

  it("reports progress per segment and per street for the live map", () => {
    const r = raceProgress(walk(piecesOf(plan, "digit0")), course, WINDOW);
    for (const v of Object.values(r.digits[0].segments)) expect(v).toBeGreaterThanOrEqual(RACE_RULES.segmentCoverage);
    expect(Object.keys(r.digits[0].edges).sort()).toEqual([...plan.digits[0].strokeEdgeIds].sort());
    expect(r.current).toBe(1);
  });
});
