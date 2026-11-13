import { metersBetween, type TrackPoint } from "./geo.ts";
import { CORNERS, type Digit, type Segment } from "./digits.ts";
import type { PedGraph } from "./routes.ts";
import type { NumberLayout, NumberPlan } from "./numberRoutes.ts";
import { RACE_RULES, RACE_VERSION, courseFromPlan, pathCoverage, raceProgress, type CourseDigit, type PathCoverage, type RaceCourse, type RaceProgress } from "./numberRace.ts";
import type { Difficulty } from "./digits.ts";

/**
 * Number Trail matches (Phase N2): the rules a nearby race is run by, pure, so the edge function, the phone and the
 * tests share them. The database (migration 20270107120000_number_trail.sql) enforces what must be atomic: the
 * lifecycle, who may act, receipt order and the one winner. This module decides what a walk is worth.
 *
 *  - One shared course per match, built from one feasible plan. Everyone starts at the same public junction at the
 *    same server time.
 *  - A walk counts from the first good fix within `startRadiusM` of the start after the official start. Fixes before
 *    that earn nothing, so waiting at digit one gains nothing.
 *  - Digits are judged by NumberRaceEngine (numberRace.ts) exactly as in N1.
 *  - Between the digits the walk must be continuous (no jump, no long unwitnessed gap) and, for a connector of
 *    `connectorMinM` or more, follow at least `connectorShare` of the planned connector. The connector never earns
 *    digit coverage.
 *  - Exact-length courses (practice and online) end with a finish stretch after the last digit, judged like the
 *    connector: the walk must reach the finish corner, following the stretch without a jump.
 */

export const MATCH_VERSION = "number-match-v1";

export const MATCH_RULES = {
  minPlayers: 2,
  maxPlayers: 10,
  minutes: [15, 25, 40] as readonly number[],
  countdownS: [5, 120] as const,
  /** How long a race may run before it ends with no finisher: twice the target time plus a quarter of an hour. */
  limitMinutes: (minutes: number) => minutes * 2 + 15,
  /** The walk starts counting at the first good fix this close to the start junction after the official start. */
  startRadiusM: 50,
  startAccuracyM: 30,
  /** Connectors at least this long must be followed for at least `connectorShare` of their length. */
  connectorMinM: 60,
  connectorShare: 0.5,
  /** Unwitnessed distance allowed between the digits: the larger of these. */
  connectorGapM: 60,
  connectorGapShare: 0.3,
  /** The server re-checks a player's progress at most this often. */
  verifyEveryMs: 5_000,
  /** Seconds between two finish attempts by one player. */
  finishCooldownMs: 5_000,
  /** A finish whose check has not reported back after this long is checked again by the next request. */
  staleVerifyMs: 60_000,
  /** Receipts closer than this to the winner's are reported as a photo finish (the winner still stands). */
  photoFinishMs: 2_000,
  /** Planning stops by this many milliseconds into the request, well inside an edge function's CPU allowance. */
  planBudgetMs: 1_500,
} as const;

// ---------------------------------------------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------------------------------------------

export const MATCH_STATUSES = ["waiting", "course_search", "course_matching", "preparing_routes", "ready", "countdown", "active", "verifying", "completed", "cancelled"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

/** Allowed moves. The database function number_can_transition is the same table; a test keeps them in step. */
export const TRANSITIONS: Record<MatchStatus, readonly MatchStatus[]> = {
  waiting: ["preparing_routes", "course_search", "cancelled"],
  // Online: every player searches their own streets, then the server matches the courses.
  course_search: ["course_matching", "waiting", "cancelled"],
  course_matching: ["ready", "course_search", "cancelled"],
  preparing_routes: ["ready", "waiting", "cancelled"],
  ready: ["preparing_routes", "course_search", "waiting", "countdown", "cancelled"],
  countdown: ["active", "cancelled"],
  active: ["verifying", "completed", "cancelled"],
  verifying: ["active", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const canTransition = (from: MatchStatus, to: MatchStatus) => TRANSITIONS[from]?.includes(to) ?? false;

export const isLive = (s: MatchStatus) => s !== "completed" && s !== "cancelled";
/** Progress and finishes are accepted only while the race runs. */
export const isRacing = (s: MatchStatus) => s === "active" || s === "verifying";

// ---------------------------------------------------------------------------------------------------------------
// The course
// ---------------------------------------------------------------------------------------------------------------

type LatLng = { latitude: number; longitude: number };
type Coord = [number, number]; // [lng, lat]

export type CourseLine = { edgeId: string; coords: Coord[]; lengthM: number };

/** Stored once per match and never changed after the countdown. Public street geometry only. */
export type NumberCourse = {
  version: string;
  raceVersion: string;
  algorithm: string;
  number: string;
  layout: NumberLayout;
  headingDeg: number;
  minutes: number;
  difficulty: Difficulty;
  raceM: number;
  approachM: number;
  connectorM: number;
  /** One per digit; for 1 to 9 a single digit and no connector. */
  digitM: number[];
  start: LatLng & { nodeId: string };
  digits: (CourseDigit & {
    start: LatLng;
    end: LatLng;
    repeatedM: number;
    /** Edges walked a second time (digits 3 and 4 repeat their cheapest stroke), once per extra traversal. */
    repeatEdgeIds?: string[];
    /** Turns and strokes in the planned walk, and how cleanly the streets read as the digit (0 to 100). */
    turns?: number;
    strokes?: number;
    readability?: number;
  })[];
  connector: CourseLine[];
  approach: CourseLine[];
  /** Exact-length courses only: the stretch from the last digit to the finish corner. Absent or empty otherwise. */
  finish?: CourseLine[];
  finishM?: number;
  /** Where the race ends when there is a finish stretch. */
  end?: LatLng;
};

/**
 * Builds a course from a validated plan and the network it was planned on.
 * `startAtFirstDigit` (practice and online): each player walks to their own course untimed, so the race starts at
 * digit one's first corner; the approach is kept only to draw the way there. A nearby race starts everyone at the
 * shared meeting junction instead.
 */
export const buildCourse = (plan: NumberPlan, graph: PedGraph, opts: { startAtFirstDigit?: boolean } = {}): NumberCourse => {
  const race = courseFromPlan(plan, graph);
  const node = new Map(graph.nodes.map((n) => [n.id, n]));
  const edge = new Map(graph.edges.map((e) => [e.id, e]));
  const at = (id: string): LatLng => {
    const n = node.get(id)!;
    return { latitude: n.latitude, longitude: n.longitude };
  };
  const line = (part: "connector" | "approach" | "finish") =>
    plan.legs
      .filter((l) => l.part === part)
      .map((l) => {
        const e = edge.get(l.edgeId)!;
        const coords = e.coords.map(([x, y]) => [x, y] as Coord);
        return { edgeId: e.id, coords: l.forward ? coords : coords.reverse(), lengthM: e.lengthM };
      });
  const digit = (k: number) => {
    const pl = plan.digits[k];
    return {
      ...race.digits[k],
      start: at(pl.corners[pl.walk.start]!),
      end: at(pl.corners[pl.walk.end]!),
      repeatedM: Math.round(pl.repeatedM * 10) / 10,
      repeatEdgeIds: plan.legs.filter((l) => l.part === "digit" && l.digit === k && l.repeat).map((l) => l.edgeId),
      turns: pl.turns,
      strokes: pl.walk.strokes.length,
      readability: pl.readability,
    };
  };
  return {
    version: MATCH_VERSION,
    raceVersion: RACE_VERSION,
    algorithm: plan.algorithm,
    number: plan.number,
    layout: plan.layout,
    headingDeg: plan.headingDeg,
    minutes: plan.minutes,
    difficulty: plan.difficulty,
    raceM: plan.raceM,
    approachM: plan.approachM,
    connectorM: plan.connectorM,
    digitM: [...plan.digitM],
    start: opts.startAtFirstDigit ? { nodeId: plan.startNodeId, ...at(plan.startNodeId) } : { nodeId: plan.approachFromNodeId, ...at(plan.approachFromNodeId) },
    digits: plan.digits.map((_, k) => digit(k)),
    connector: line("connector"),
    approach: line("approach"),
    ...(plan.finishM && plan.finishNodeId ? { finish: line("finish"), finishM: plan.finishM, end: at(plan.finishNodeId) } : {}),
  };
};

export const raceCourseOf = (c: NumberCourse): RaceCourse => ({ number: c.number, digits: c.digits, raceM: c.raceM });

/** What the phone needs to draw the course: polylines only, grouped by part and segment. */
export const courseView = (c: NumberCourse) => ({
  number: c.number,
  layout: c.layout,
  headingDeg: c.headingDeg,
  minutes: c.minutes,
  difficulty: c.difficulty,
  raceM: c.raceM,
  approachM: c.approachM,
  connectorM: c.connectorM,
  digitM: c.digitM,
  start: { latitude: c.start.latitude, longitude: c.start.longitude },
  digits: c.digits.map((d) => ({
    digit: d.digit,
    start: d.start,
    end: d.end,
    corners: d.corners,
    strokes: d.edges.map((e) => ({ edgeId: e.edgeId, segment: e.segment, coords: e.coords as Coord[], lengthM: e.lengthM })),
  })),
  connector: c.connector,
  approach: c.approach,
  finish: c.finish ?? [],
  finishM: c.finishM ?? 0,
  end: c.end ?? null,
});
export type CourseView = ReturnType<typeof courseView>;

/** Structural check of a stored course before it is trusted again (after reading it back from the database). */
export const courseProblem = (c: unknown): string | null => {
  const x = c as Partial<NumberCourse> | null;
  if (!x || typeof x !== "object") return "no_course";
  if (typeof x.number !== "string" || !/^[0-9]{1,2}$/.test(x.number)) return "bad_number";
  if (!Array.isArray(x.digits) || x.digits.length !== x.number.length) return "bad_digits";
  if (x.digits.some((d, k) => d.digit !== x.number![k])) return "digits_mismatch";
  if (x.digits.some((d) => !d.edges?.length || !d.corners?.length)) return "empty_digit";
  if (!x.start || !Number.isFinite(x.start.latitude) || !Number.isFinite(x.start.longitude)) return "no_start";
  if (!Number.isFinite(x.raceM) || (x.raceM as number) <= 0) return "bad_length";
  return null;
};

// ---------------------------------------------------------------------------------------------------------------
// Judging a walk
// ---------------------------------------------------------------------------------------------------------------

export type FinishReason =
  | "not_at_start"
  | "digit_one_incomplete"
  | "connector_invalid"
  | "digit_two_incomplete"
  | "finish_incomplete"
  | "finish_invalid"
  | "gps_review"
  | "too_few_points";

export type ProgressPhase =
  | "DIGIT_1_PENDING"
  | "DIGIT_1_IN_PROGRESS"
  | "DIGIT_1_COMPLETE"
  | "CONNECTOR_IN_PROGRESS"
  | "DIGIT_2_IN_PROGRESS"
  | "DIGIT_2_COMPLETE"
  /** A single-digit number (1 to 9) walked in full. */
  | "NUMBER_COMPLETE"
  /** Every digit walked; on the finish stretch of an exact-length course. */
  | "FINISH_IN_PROGRESS"
  | "FINISH_PENDING_VERIFICATION"
  | "VERIFIED_COMPLETE"
  | "INVALID_COMPLETION";

export type RaceVerdict = {
  version: string;
  /** The fix that checked the player in at the start; null until they have been there after the official start. */
  startSeq: number | null;
  progress: RaceProgress;
  connector: PathCoverage & { reachedSecond: boolean; valid: boolean | null };
  /** The finish stretch; `valid` null while not reached, or when the course has none. */
  finish: PathCoverage & { reached: boolean; valid: boolean | null };
  phase: ProgressPhase;
  /** Everything needed for an official finish. */
  eligible: boolean;
  /** Why not, most important first. */
  reasons: FinishReason[];
  /** Highest sequence number looked at. */
  throughSeq: number;
};

const sortBySeq = (points: readonly TrackPoint[]) => [...points].sort((a, b) => a.seq - b.seq);

/**
 * The official judgement of a walk on a course. `raceStartMs` is the server's start time, `nowMs` the server time the
 * points are judged at (for a finish: when the finish was received). Deterministic for the same input.
 */
export const verifyRace = (points: readonly TrackPoint[], course: NumberCourse, window: { raceStartMs: number; nowMs: number }, rules = MATCH_RULES): RaceVerdict => {
  const sorted = sortBySeq(points);
  const throughSeq = sorted.length ? sorted[sorted.length - 1].seq : 0;
  const checkIn = sorted.find(
    (p) => p.capturedAt >= window.raceStartMs && p.capturedAt <= window.nowMs + RACE_RULES.clockSkewMs && (p.accuracyM ?? Infinity) <= rules.startAccuracyM && metersBetween(p, course.start) <= rules.startRadiusM,
  );
  const counted = checkIn ? sorted.filter((p) => p.seq >= checkIn.seq) : [];
  const progress = raceProgress(counted, raceCourseOf(course), window);

  const one = progress.digits[0];
  const two = course.digits.length > 1;
  let connector: RaceVerdict["connector"] = { share: 0, coveredM: 0, totalM: Math.round(course.connectorM), gapM: 0, jumps: 0, points: 0, reachedSecond: false, valid: null };
  // Only two-digit numbers have a connector to judge.
  if (two && one.complete && one.completedSeq != null) {
    const second = course.digits[1].start;
    const arrive = counted.find((p) => p.seq > one.completedSeq! && (p.accuracyM ?? Infinity) <= RACE_RULES.maxAccuracyM && metersBetween(p, second) <= RACE_RULES.checkpointM);
    const through = arrive?.seq ?? progress.digits[1].completedSeq ?? Number.MAX_SAFE_INTEGER;
    const cov = pathCoverage(counted, course.connector, { ...window, afterSeq: one.completedSeq, throughSeq: through });
    const reachedSecond = Boolean(arrive) || progress.digits[1].complete;
    const allowedGap = Math.max(rules.connectorGapM, rules.connectorGapShare * cov.totalM);
    const followed = cov.totalM < rules.connectorMinM || cov.share >= rules.connectorShare;
    connector = { ...cov, reachedSecond, valid: reachedSecond ? followed && cov.jumps === 0 && cov.gapM <= allowedGap : null };
  }

  // The finish stretch: from the last digit's completion to the finish corner.
  const finishLine = course.finish ?? [];
  const lastDigit = progress.digits[progress.digits.length - 1];
  let finish: RaceVerdict["finish"] = { share: 0, coveredM: 0, totalM: Math.round(course.finishM ?? 0), gapM: 0, jumps: 0, points: 0, reached: false, valid: null };
  if (finishLine.length && course.end && progress.complete && lastDigit.completedSeq != null) {
    const end = course.end;
    const arrive = counted.find((p) => p.seq > lastDigit.completedSeq! && (p.accuracyM ?? Infinity) <= RACE_RULES.maxAccuracyM && metersBetween(p, end) <= RACE_RULES.checkpointM);
    const cov = pathCoverage(counted, finishLine, { ...window, afterSeq: lastDigit.completedSeq, throughSeq: arrive?.seq ?? Number.MAX_SAFE_INTEGER });
    const allowedGap = Math.max(rules.connectorGapM, rules.connectorGapShare * cov.totalM);
    const followed = cov.totalM < rules.connectorMinM || cov.share >= rules.connectorShare;
    finish = { ...cov, reached: Boolean(arrive), valid: arrive ? followed && cov.jumps === 0 && cov.gapM <= allowedGap : null };
  }

  const reasons: FinishReason[] = [];
  if (!checkIn) reasons.push("not_at_start");
  if (!one.complete) reasons.push("digit_one_incomplete");
  else if (connector.valid === false) reasons.push("connector_invalid");
  if (two && one.complete && !progress.digits[1].complete) reasons.push("digit_two_incomplete");
  if (finishLine.length && progress.complete) {
    if (!finish.reached) reasons.push("finish_incomplete");
    else if (finish.valid === false) reasons.push("finish_invalid");
  }
  if (progress.issues.includes("gps_jump") || progress.issues.includes("gps_gaps")) reasons.push("gps_review");
  if (checkIn && progress.issues.includes("too_few_points")) reasons.push("too_few_points");

  return {
    version: MATCH_VERSION,
    startSeq: checkIn?.seq ?? null,
    progress,
    connector,
    finish,
    phase: walkPhase(progress, connector, finishLine.length ? finish : null),
    eligible: reasons.length === 0 && progress.complete,
    reasons,
    throughSeq,
  };
};

/** Where the walk is, from the walk alone. */
export const walkPhase = (progress: RaceProgress, connector: RaceVerdict["connector"], finish: RaceVerdict["finish"] | null = null): ProgressPhase => {
  // An exact-length course is done at the finish corner, after every digit.
  if (finish && progress.complete && !finish.reached) return "FINISH_IN_PROGRESS";
  // A single-digit number is done when its only digit is.
  if (progress.digits.length === 1) return progress.current >= 1 ? "NUMBER_COMPLETE" : progress.digits[0].coverage > 0 ? "DIGIT_1_IN_PROGRESS" : "DIGIT_1_PENDING";
  if (progress.current === 2) return "DIGIT_2_COMPLETE";
  if (progress.current === 1) {
    if (connector.reachedSecond || progress.digits[1].coverage > 0) return "DIGIT_2_IN_PROGRESS";
    return connector.share > 0 ? "CONNECTOR_IN_PROGRESS" : "DIGIT_1_COMPLETE";
  }
  return progress.digits[0].coverage > 0 ? "DIGIT_1_IN_PROGRESS" : "DIGIT_1_PENDING";
};

export type AttemptStatus = "pending" | "verified" | "rejected" | "expired";

/** The phase to show, with the player's latest finish attempt on top of the walk. */
export const playerPhase = (walk: ProgressPhase, latest: { status: AttemptStatus; throughSeq: number } | null, progressThroughSeq: number): ProgressPhase => {
  if (!latest) return walk;
  if (latest.status === "pending") return "FINISH_PENDING_VERIFICATION";
  if (latest.status === "verified") return "VERIFIED_COMPLETE";
  // A rejected finish stays on screen until the walk moves on.
  return progressThroughSeq <= latest.throughSeq ? "INVALID_COMPLETION" : walk;
};

/** The stored track's fingerprint, to catch the same recorded walk handed in for another match. */
export const trackFingerprint = (points: readonly TrackPoint[]) =>
  sortBySeq(points)
    .map((p) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`)
    .join("|");

/** A compact progress summary others in the match may see: no coordinates. */
export const publicProgress = (v: RaceVerdict) => ({
  phase: v.phase,
  digits: v.progress.digits.map((d) => ({ digit: d.digit, coverage: d.coverage, complete: d.complete })),
  connector: Math.round(v.connector.share * 100) / 100,
  finish: Math.round(v.finish.share * 100) / 100,
  atStart: v.startSeq != null,
});

/** What the player sees about their own walk: also per-street shares for drawing walked streets. */
export const ownProgress = (v: RaceVerdict) => ({
  ...publicProgress(v),
  segments: v.progress.digits.map((d) => d.segments) as Partial<Record<Segment, number>>[],
  edges: v.progress.digits.map((d) => d.edges) as Record<string, number>[],
  cornersPassed: v.progress.digits.map((d) => d.cornersPassed),
  reasons: v.reasons,
  gps: { jumps: v.progress.flags.jumps, gapM: v.progress.flags.gapM, ignored: v.progress.flags.ignored },
  throughSeq: v.throughSeq,
});
export type OwnProgress = ReturnType<typeof ownProgress>;
export type PublicProgress = ReturnType<typeof publicProgress>;

// ---------------------------------------------------------------------------------------------------------------
// Who won
// ---------------------------------------------------------------------------------------------------------------

export type Attempt = { userId: string; receiptSeq: number; status: AttemptStatus; receivedAt: number };

/**
 * The completion-order policy, as the database applies it (number_settle_finish):
 *  1. Every finish request gets a receipt number from one database sequence, under the match lock, before its walk is
 *     checked. Receipt order is the order the server received finishes; it is not the instant anyone physically
 *     finished, and a slow connection can cost a place.
 *  2. Finish order is receipt order among verified finishes. A player is placed once, by their first verified
 *     receipt.
 *  3. A verified finish is placed only when every earlier receipt has been settled, so a slow check can never let a
 *     later finish overtake an earlier one.
 *  4. The first placed finish wins and completes the match. Receipts are strictly ordered, so there are no ties;
 *     receipts within `photoFinishMs` of the winner's are reported as a photo finish.
 */
export const finishOrder = (attempts: readonly Attempt[]) => {
  const sorted = [...attempts].sort((a, b) => a.receiptSeq - b.receiptSeq);
  const order: Attempt[] = [];
  const placed = new Set<string>();
  let waitingOn: Attempt | null = null;
  for (const a of sorted) {
    if (a.status === "pending") {
      waitingOn = a;
      break;
    }
    if (a.status === "verified" && !placed.has(a.userId)) {
      placed.add(a.userId);
      order.push(a);
    }
  }
  const winner = order[0] ?? null;
  const runnerUp = order[1] ?? null;
  return {
    winner,
    order,
    waitingOn,
    photoFinish: Boolean(winner && runnerUp && runnerUp.receivedAt - winner.receivedAt < MATCH_RULES.photoFinishMs),
  };
};

/** Non-finishers ranked after finishers: more digits done, then more coverage. Equal walks share a place. */
export const rankRest = (rest: readonly { userId: string; digitsDone: number; coverage: number }[], firstPlace: number) => {
  const sorted = [...rest].sort((a, b) => b.digitsDone - a.digitsDone || b.coverage - a.coverage || (a.userId < b.userId ? -1 : 1));
  const out: { userId: string; placement: number }[] = [];
  sorted.forEach((r, i) => {
    const prev = sorted[i - 1];
    const same = prev && prev.digitsDone === r.digitsDone && Math.abs(prev.coverage - r.coverage) < 1e-9;
    out.push({ userId: r.userId, placement: same ? out[i - 1].placement : firstPlace + i });
  });
  return out;
};

export const digitsDone = (p: { digits: readonly { complete: boolean }[] }) => p.digits.filter((d) => d.complete).length;

/** Two-digit target as shown: always two characters, leading zero kept. */
export const isTarget = (n: unknown): n is string => typeof n === "string" && /^[0-9]{2}$/.test(n);

export const digitOf = (n: string, k: 0 | 1) => n[k] as Digit;

export { CORNERS };
