import type { NumberCourse } from "./numberMatch.ts";

/**
 * Cross-city fairness for Number Trail (phase P3). Players in different places walk the same number on their own
 * streets; a ranked race needs their courses to be equivalent, not just similar.
 *
 * NumberCourseEquivalenceValidator compares what the data can actually show:
 *   - the same number (text), the same number of digits;
 *   - total required course length: every course within ±`bandShare` of the target, and longest minus shortest at
 *     most `spreadShare` of the target (2% each to start with: 30 m on a 1.5 km course);
 *   - each digit's length, the connector's and the finish stretch's (the real street after the last digit that brings
 *     every course to the target), within `partShare` of the target, so one course isn't mostly connector or finish
 *     stretch while another is mostly digit;
 *   - mandatory repeated traversal (digits 3 and 4 walk a stroke twice), within `repeatShare` of the target;
 *   - the structure of the walk: strokes per digit equal, turns per digit within `turnsDiff`;
 *   - readability: every digit at least `minReadability`, and within `readabilityDiff` of each other.
 * Street crossings, elevation and surface are not in the pedestrian graph this game uses, so they are reported as
 * unknown, never assumed equal. A race is "matched" when every comparable criterion passes; the unknowns are listed
 * with it.
 *
 * The total-length rule is enforced again by the database from PostGIS lengths (number_record_online_match), so
 * this module can't certify a mismatch by itself.
 */

export const EQUIVALENCE_VERSION = "number-equivalence-v1";

export const EQUIVALENCE_RULES = {
  spreadShare: 0.02,
  bandShare: 0.02,
  partShare: 0.06,
  repeatShare: 0.05,
  turnsDiff: 2,
  minReadability: 80,
  readabilityDiff: 15,
} as const;
export type EquivalenceRules = { [K in keyof typeof EQUIVALENCE_RULES]: number };

/** Distance categories for online races: target course length and the walking time it maps to. */
export const DISTANCE_CATEGORIES = {
  short: { targetM: 1_000, minutes: 15, label: "Short" },
  standard: { targetM: 1_500, minutes: 25, label: "Standard" },
  long: { targetM: 2_500, minutes: 40, label: "Long" },
} as const;
export type DistanceCategory = keyof typeof DISTANCE_CATEGORIES;

/** The comparable shape of one course, from its stored geometry. `totalM` is the required traversal. */
export type CourseMetrics = {
  number: string;
  totalM: number;
  digitM: number[];
  connectorM: number;
  /** The finish stretch after the last digit; 0 when the course has none. */
  finishM: number;
  repeatedM: number;
  strokes: number[];
  turns: number[];
  readability: number[];
};

export const metricsOf = (c: NumberCourse, officialTotalM?: number): CourseMetrics => ({
  number: c.number,
  totalM: officialTotalM ?? c.raceM,
  digitM: c.digitM,
  connectorM: c.connectorM,
  finishM: c.finishM ?? 0,
  repeatedM: c.digits.reduce((s, d) => s + (d.repeatedM ?? 0), 0),
  strokes: c.digits.map((d) => d.strokes ?? 0),
  turns: c.digits.map((d) => d.turns ?? 0),
  readability: c.digits.map((d) => d.readability ?? 0),
});

export type Check = { name: string; ok: boolean; spread: number; allowed: number; unit: "m" | "count" | "score" };
export type EquivalenceStatus = "matched" | "number_mismatch" | "distance_mismatch" | "structure_mismatch" | "readability_mismatch";
export type Equivalence = {
  version: string;
  status: EquivalenceStatus;
  targetM: number;
  spreadM: number;
  toleranceM: number;
  checks: Check[];
  /** Compared nowhere because the data doesn't have it. Never treated as equal. */
  unknown: string[];
};

export const UNKNOWN_ATTRIBUTES = ["street crossings", "elevation", "surface"] as const;

const spread = (xs: readonly number[]) => (xs.length ? Math.max(...xs) - Math.min(...xs) : 0);

/** Compares two or more courses for one ranked race. Pure and deterministic; nothing is rounded before comparing. */
export const compareCourses = (courses: readonly CourseMetrics[], targetM: number, rules: EquivalenceRules = EQUIVALENCE_RULES): Equivalence => {
  const checks: Check[] = [];
  const add = (name: string, values: number[], allowed: number, unit: Check["unit"]) => {
    const s = spread(values);
    checks.push({ name, ok: s <= allowed + 1e-9, spread: s, allowed, unit });
  };
  const sameNumber = courses.every((c) => c.number === courses[0].number);
  const totals = courses.map((c) => c.totalM);
  const toleranceM = rules.spreadShare * targetM;
  add("course length spread", totals, toleranceM, "m");
  checks.push({ name: "course length near target", ok: totals.every((t) => Math.abs(t - targetM) <= rules.bandShare * targetM + 1e-9), spread: Math.max(...totals.map((t) => Math.abs(t - targetM))), allowed: rules.bandShare * targetM, unit: "m" });
  const digits = courses[0]?.digitM.length ?? 0;
  for (let k = 0; k < digits; k++) add(`digit ${k + 1} length`, courses.map((c) => c.digitM[k] ?? 0), rules.partShare * targetM, "m");
  if (digits > 1) add("connector length", courses.map((c) => c.connectorM), rules.partShare * targetM, "m");
  add("finish stretch length", courses.map((c) => c.finishM ?? 0), rules.partShare * targetM, "m");
  add("repeated traversal", courses.map((c) => c.repeatedM), rules.repeatShare * targetM, "m");
  for (let k = 0; k < digits; k++) {
    add(`digit ${k + 1} strokes`, courses.map((c) => c.strokes[k] ?? 0), 0, "count");
    add(`digit ${k + 1} turns`, courses.map((c) => c.turns[k] ?? 0), rules.turnsDiff, "count");
  }
  const reads = courses.flatMap((c) => c.readability);
  checks.push({ name: "readability minimum", ok: reads.every((r) => r >= rules.minReadability), spread: Math.min(...reads), allowed: rules.minReadability, unit: "score" });
  add("readability spread", reads, rules.readabilityDiff, "score");

  const failed = (re: RegExp) => checks.some((c) => !c.ok && re.test(c.name));
  const status: EquivalenceStatus = !sameNumber || courses.some((c) => c.digitM.length !== digits)
    ? "number_mismatch"
    : failed(/^course length/)
      ? "distance_mismatch"
      : failed(/length|traversal|strokes|turns/)
        ? "structure_mismatch"
        : failed(/readability/)
          ? "readability_mismatch"
          : "matched";
  return { version: EQUIVALENCE_VERSION, status, targetM, spreadM: spread(totals), toleranceM, checks, unknown: [...UNKNOWN_ATTRIBUTES] };
};

export type Candidate = { id: string; userId: string; metrics: CourseMetrics };

export type MatchOutcome =
  | { ok: true; picks: Record<string, Candidate>; equivalence: Equivalence }
  | { ok: false; reason: "missing_player" | "no_common_window" | EquivalenceStatus; best: Equivalence | null; missing: string[] };

/**
 * CrossCityNumberCourseMatcher: one candidate per player such that the set is equivalent. Candidates are sorted by
 * length; every window of `spreadShare` x target containing a candidate of every player is tried, picking each
 * player's candidate closest in shape to the window's median, and the first fully equivalent set (narrowest spread)
 * wins. Bounded: players x candidates is at most 10 x 30.
 */
export const matchCourses = (players: readonly string[], candidates: readonly Candidate[], targetM: number, rules: EquivalenceRules = EQUIVALENCE_RULES): MatchOutcome => {
  const missing = players.filter((u) => !candidates.some((c) => c.userId === u));
  if (missing.length) return { ok: false, reason: "missing_player", best: null, missing };
  const sorted = [...candidates].filter((c) => Math.abs(c.metrics.totalM - targetM) <= rules.bandShare * targetM + 1e-9).sort((a, b) => a.metrics.totalM - b.metrics.totalM);
  const width = rules.spreadShare * targetM;
  let best: { picks: Record<string, Candidate>; eq: Equivalence } | null = null;
  let closest: Equivalence | null = null;
  const shapeGap = (a: CourseMetrics, b: CourseMetrics) =>
    Math.abs(a.totalM - b.totalM) +
    a.digitM.reduce((s, m, k) => s + Math.abs(m - (b.digitM[k] ?? 0)), 0) +
    Math.abs(a.connectorM - b.connectorM) +
    Math.abs((a.finishM ?? 0) - (b.finishM ?? 0)) +
    Math.abs(a.repeatedM - b.repeatedM) +
    20 * a.turns.reduce((s, t, k) => s + Math.abs(t - (b.turns[k] ?? 0)), 0);
  for (let i = 0; i < sorted.length; i++) {
    const lo = sorted[i].metrics.totalM;
    const window = sorted.filter((c) => c.metrics.totalM >= lo - 1e-9 && c.metrics.totalM <= lo + width + 1e-9);
    if (!players.every((u) => window.some((c) => c.userId === u))) continue;
    const median = window[Math.floor(window.length / 2)].metrics;
    const picks: Record<string, Candidate> = {};
    for (const u of players) picks[u] = window.filter((c) => c.userId === u).sort((a, b) => shapeGap(a.metrics, median) - shapeGap(b.metrics, median))[0];
    const eq = compareCourses(players.map((u) => picks[u].metrics), targetM, rules);
    if (!closest || eq.spreadM < closest.spreadM) closest = eq;
    if (eq.status === "matched" && (!best || eq.spreadM < best.eq.spreadM)) best = { picks, eq };
  }
  if (best) return { ok: true, picks: best.picks, equivalence: best.eq };
  return { ok: false, reason: closest ? closest.status : "no_common_window", best: closest, missing: [] };
};
