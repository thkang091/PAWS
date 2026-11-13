/**
 * Cross-city fairness (phase P3): the equivalence validator and the course matcher, on course metrics. The database's
 * own distance check is tested in supabase/tests/number_trail_online.sql; real OpenStreetMap areas in
 * numberCrossCity.test.ts.
 */
import { DISTANCE_CATEGORIES, EQUIVALENCE_RULES, compareCourses, matchCourses, type CourseMetrics } from "../../supabase/functions/tournament/numberEquivalence";

const two = (totalM: number, o: Partial<CourseMetrics> = {}): CourseMetrics => {
  const connectorM = o.connectorM ?? 0.14 * totalM;
  const d = (totalM - connectorM) / 2;
  return { number: "42", totalM, digitM: [d * 0.95, d * 1.05], connectorM, finishM: 0, repeatedM: 0, strokes: [3, 5], turns: [3, 4], readability: [92, 90], ...o } as CourseMetrics;
};
const one = (totalM: number, o: Partial<CourseMetrics> = {}): CourseMetrics => ({ number: "7", totalM, digitM: [totalM], connectorM: 0, finishM: 0, repeatedM: 0, strokes: [3], turns: [2], readability: [95], ...o }) as CourseMetrics;

describe("equivalence (Tests A to E)", () => {
  it("A: 42 at 1,500 m and 1,490 m match (10 m apart, 30 m allowed)", () => {
    const eq = compareCourses([two(1_500), two(1_490)], 1_500);
    expect(eq.status).toBe("matched");
    expect(eq.spreadM).toBe(10);
    expect(eq.toleranceM).toBe(30);
    expect(eq.unknown).toEqual(["street crossings", "elevation", "surface"]);
  });
  it("B: 800 m against 1,500 m is a distance mismatch", () => {
    expect(compareCourses([two(800), two(1_500)], 1_500).status).toBe("distance_mismatch");
  });
  it("a course 31 m apart, or 2.1% off target, is refused (unrounded comparison)", () => {
    expect(compareCourses([two(1_500), two(1_469)], 1_500).status).toBe("distance_mismatch");
    expect(compareCourses([two(1_531), two(1_531)], 1_500).status).toBe("distance_mismatch");
    expect(compareCourses([two(1_530), two(1_500)], 1_500).status).toBe("matched");
  });
  it("C: same length, but heavy mandatory retracing and many more turns, is not called fair", () => {
    const eq = compareCourses([two(1_500), two(1_500, { repeatedM: 200, turns: [6, 8] })], 1_500);
    expect(eq.status).toBe("structure_mismatch");
    expect(eq.checks.filter((c) => !c.ok).map((c) => c.name)).toEqual(expect.arrayContaining(["repeated traversal", "digit 1 turns", "digit 2 turns"]));
  });
  it("connector imbalance: one course mostly connector, the other mostly digits", () => {
    const eq = compareCourses([two(1_500, { connectorM: 100 }), two(1_500, { connectorM: 400 })], 1_500);
    expect(eq.status).toBe("structure_mismatch");
  });
  it("E: single-digit 7 at matched lengths, no connector compared", () => {
    const eq = compareCourses([one(1_000), one(995)], 1_000);
    expect(eq.status).toBe("matched");
    expect(eq.checks.some((c) => c.name === "connector length")).toBe(false);
  });
  it("different numbers are never matched", () => {
    expect(compareCourses([two(1_500), { ...two(1_500), number: "27" }], 1_500).status).toBe("number_mismatch");
    expect(compareCourses([two(1_500), one(1_500)], 1_500).status).toBe("number_mismatch");
  });
  it("readability below the minimum is not fair", () => {
    expect(compareCourses([two(1_500), two(1_500, { readability: [70, 90] })], 1_500).status).toBe("readability_mismatch");
  });
  it("categories are the documented targets", () => {
    expect(DISTANCE_CATEGORIES.short.targetM).toBe(1_000);
    expect(DISTANCE_CATEGORIES.standard.targetM).toBe(1_500);
    expect(DISTANCE_CATEGORIES.long.targetM).toBe(2_500);
    expect(EQUIVALENCE_RULES.spreadShare).toBe(0.02);
  });
});

describe("matching courses across players", () => {
  const cand = (userId: string, id: string, m: CourseMetrics) => ({ userId, id, metrics: m });
  it("two players: picks the pair inside the window, ignoring an off-target alternative", () => {
    const r = matchCourses(["a", "b"], [cand("a", "a1", two(1_480)), cand("a", "a2", two(1_700)), cand("b", "b1", two(1_495)), cand("b", "b2", two(1_420))], 1_500);
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.picks.a.id, r.picks.b.id]).toEqual(["a1", "b1"]);
  });
  it("five and ten players in different cities", () => {
    for (const n of [5, 10]) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      const cands = players.flatMap((p, i) => [cand(p, `${p}-x`, two(1_490 + (i % 4) * 5)), cand(p, `${p}-y`, two(1_400))]);
      const r = matchCourses(players, cands, 1_500);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.equivalence.spreadM).toBeLessThanOrEqual(30);
    }
  });
  it("D: a player with no course means no ranked race", () => {
    const r = matchCourses(["a", "b"], [cand("a", "a1", two(1_500))], 1_500);
    expect(r).toMatchObject({ ok: false, reason: "missing_player", missing: ["b"] });
  });
  it("no common window: honest failure with the closest verdict", () => {
    const r = matchCourses(["a", "b"], [cand("a", "a1", two(1_475)), cand("b", "b1", two(1_525))], 1_500);
    expect(r.ok).toBe(false);
  });
  it("prefers a structurally matching candidate over a merely close one", () => {
    const r = matchCourses(["a", "b"], [cand("a", "a1", two(1_500)), cand("b", "b-busy", two(1_500, { repeatedM: 250 })), cand("b", "b-clean", two(1_495))], 1_500);
    expect(r.ok && r.picks.b.id).toBe("b-clean");
  });
});

describe("finish stretch", () => {
  it("courses made up to length by a similar finish stretch match", () => {
    const a = two(1_500, { digitM: [520, 560], connectorM: 120, finishM: 300 });
    const b = two(1_505, { digitM: [540, 545], connectorM: 140, finishM: 280 });
    expect(compareCourses([a, b], 1_500).status).toBe("matched");
  });
  it("one course mostly finish stretch and another mostly number do not match, even at the same length", () => {
    const a = two(1_500, { digitM: [700, 690], connectorM: 110, finishM: 0 });
    const b = two(1_500, { digitM: [520, 500], connectorM: 100, finishM: 380 });
    const eq = compareCourses([a, b], 1_500);
    expect(eq.status).toBe("structure_mismatch");
    expect(eq.checks.find((c) => c.name === "finish stretch length")!.ok).toBe(false);
  });
});
