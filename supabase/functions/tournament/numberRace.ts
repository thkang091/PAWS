import { GPS_RULES, cleanTrack, metersBetween, type TrackPoint } from "./geo.ts";
import { CORNERS, DIGIT_SEGMENTS, type Corner, type Digit, type Segment } from "./digits.ts";
import type { PedGraph } from "./routes.ts";
import type { NumberPlan } from "./numberRoutes.ts";

/**
 * NumberRaceEngine: how far a GPS walk has got along an assigned Number Trail course, and whether it finished.
 * Pure, so the phone's live progress and the server's official check always agree; only the server's verdict counts.
 *
 * What counts (graph-aware map matching, versioned as RACE_VERSION):
 *  - Only the digits' own stroke edges earn coverage. The connector and the walk to the start earn nothing.
 *  - Coverage comes from consecutive good fixes that are both close to a stroke edge and move along it: the stretch
 *    between their projections on the edge is added to that edge's walked intervals. Intervals are merged, so
 *    standing still, repeated samples, or walking a street twice never count twice.
 *  - Digit two earns nothing until digit one is complete: the digits are walked in order.
 *  - A digit is complete when 90% of its stroke length is walked, every segment is at least 75% walked, and every
 *    corner of the digit was passed. Proximity to the ends alone never completes anything.
 *  - Fixes farther apart than `maxPairM` (lost signal, a pause) earn nothing across the gap: no straight line is ever
 *    drawn over missing movement. Movement faster than a person walks a dog earns nothing and is flagged; a sustained
 *    jump during the race makes the finish ineligible until a person looks. A lone spike that jumps out and straight
 *    back is treated as a GPS glitch and dropped.
 *  - Fixes from before the race started or from the future are ignored (a replayed old walk earns nothing).
 *
 * GPS can be faked. These rules catch impossible movement and broken tracks; they cannot prove where a phone was.
 */

export const RACE_VERSION = "number-race-v1";

export const RACE_RULES = {
  /** Fixes less precise than this are not used. */
  maxAccuracyM: 20,
  /** A fix this close to a stroke edge can count on it. */
  onEdgeM: 15,
  /** Consecutive fixes farther apart than this earn nothing between them. */
  maxPairM: 35,
  /** Faster than this is not walking a dog: earns nothing, flagged. */
  maxSpeedMps: GPS_RULES.maxSpeedMps,
  /** Speed is also checked over this many seconds. */
  speedWindowS: 10,
  /** Movement along the edge must be at least this share of the movement between the fixes (crossing it earns nothing). */
  alongShare: 0.25,
  /** Progress along an edge may exceed the distance moved by this much (GPS wobble), and no more. */
  slackM: 6,
  /** Share of a digit's stroke length, and of each segment, that must be walked. */
  digitCoverage: 0.9,
  segmentCoverage: 0.75,
  /** Passing within this distance of a corner checks it off. */
  checkpointM: 20,
  /** A jump longer than this, at impossible speed, makes the race ineligible until reviewed. */
  jumpReviewM: 100,
  /** Unwitnessed distance (signal gaps) above this share of the race needs review. */
  maxGapShare: 0.25,
  /** A fix this far in the future (phone clock ahead) is still accepted. */
  clockSkewMs: 5_000,
} as const;

export type RaceRules = typeof RACE_RULES;

type Coord = readonly [number, number]; // [lng, lat]

/** One stroke edge of a digit, oriented as stored, with its segment. */
export type CourseEdge = { edgeId: string; segment: Segment; coords: readonly Coord[]; lengthM: number };

export type CourseDigit = { digit: Digit; edges: CourseEdge[]; corners: { corner: Corner; latitude: number; longitude: number }[] };

/** What the engine needs from a plan: each digit's unique stroke edges and corners, and the race length. */
export type RaceCourse = { number: string; digits: CourseDigit[]; raceM: number };

/** Builds the course from a plan and the graph it was planned on. */
export const courseFromPlan = (plan: NumberPlan, graph: PedGraph): RaceCourse => {
  const byId = new Map(graph.edges.map((e) => [e.id, e]));
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const digit = (k: number): CourseDigit => {
    const pl = plan.digits[k];
    const edges: CourseEdge[] = [];
    for (const s of DIGIT_SEGMENTS[pl.digit])
      for (const st of pl.segments[s] ?? []) {
        const e = byId.get(st.edgeId)!;
        edges.push({ edgeId: e.id, segment: s, coords: e.coords, lengthM: e.lengthM });
      }
    const corners = CORNERS.filter((c) => pl.corners[c]).map((c) => {
      const n = nodeById.get(pl.corners[c]!)!;
      return { corner: c, latitude: n.latitude, longitude: n.longitude };
    });
    return { digit: pl.digit, edges, corners };
  };
  return { number: plan.number, digits: plan.digits.map((_, k) => digit(k)), raceM: plan.raceM };
};

export type DigitProgress = {
  digit: Digit;
  /** Share of the digit's stroke length walked, 0 to 1. */
  coverage: number;
  /** Share of each segment walked. */
  segments: Partial<Record<Segment, number>>;
  /** Walked share per stroke edge, for drawing completed streets. */
  edges: Record<string, number>;
  cornersPassed: Corner[];
  complete: boolean;
  /** The fix that completed the digit. */
  completedSeq: number | null;
  completedAt: number | null;
};

export type RaceIssue = "digit_one_incomplete" | "digit_two_incomplete" | "gps_jump" | "gps_gaps" | "too_few_points";

export type RaceProgress = {
  version: string;
  /** One per digit of the number. */
  digits: DigitProgress[];
  /** Index of the digit being walked; equals the number of digits once all are done. */
  current: number;
  complete: boolean;
  /** Complete with nothing needing review: may be accepted as a finish. */
  eligible: boolean;
  issues: RaceIssue[];
  flags: { jumps: number; jumpM: number; gapM: number; spikes: number; ignored: number };
};

// ---------------------------------------------------------------------------------------------------------------

type XY = [number, number];

type PreparedEdge = { edge: CourseEdge; pts: XY[]; cum: number[]; total: number; box: [number, number, number, number] };

const prepareDigit = (d: CourseDigit, proj: (lat: number, lng: number) => XY, pad: number): PreparedEdge[] =>
  d.edges.map((edge) => {
    const pts = edge.coords.map(([lng, lat]) => proj(lat, lng));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    return { edge, pts, cum, total: cum[cum.length - 1] || 1, box: [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad] };
  });

/** Nearest point on an edge: distance off it and distance along it. */
const project = (p: XY, e: PreparedEdge) => {
  let best = { d: Infinity, s: 0 };
  for (let i = 1; i < e.pts.length; i++) {
    const [ax, ay] = e.pts[i - 1];
    const dx = e.pts[i][0] - ax;
    const dy = e.pts[i][1] - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2));
    const d = Math.hypot(p[0] - ax - dx * t, p[1] - ay - dy * t);
    if (d < best.d) best = { d, s: e.cum[i - 1] + Math.sqrt(len2) * t };
  }
  return best;
};

/** Adds [a, b] to a sorted list of disjoint intervals, merging overlaps. */
const addInterval = (list: [number, number][], a: number, b: number) => {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const out: [number, number][] = [];
  let merged: [number, number] = [lo, hi];
  let placed = false;
  for (const iv of list) {
    if (iv[1] < merged[0]) out.push(iv);
    else if (iv[0] > merged[1]) {
      if (!placed) {
        out.push(merged);
        placed = true;
      }
      out.push(iv);
    } else merged = [Math.min(iv[0], merged[0]), Math.max(iv[1], merged[1])];
  }
  if (!placed) out.push(merged);
  list.splice(0, list.length, ...out);
};

const covered = (list: readonly [number, number][]) => list.reduce((s, [a, b]) => s + (b - a), 0);

/**
 * Drops lone spikes: a fix that jumps away at impossible speed while its neighbours are close to each other. Those
 * are GPS glitches, not movement; real jumps (the track stays at the new place) are kept and judged.
 */
const dropSpikes = (pts: readonly TrackPoint[], rules: RaceRules) => {
  const out: TrackPoint[] = [];
  let spikes = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = out[out.length - 1];
    const q = pts[i];
    const n = pts[i + 1];
    if (p && n && p.segment === q.segment && q.segment === n.segment) {
      const dt = Math.max(0.001, (q.capturedAt - p.capturedAt) / 1000);
      const out1 = metersBetween(p, q);
      const out2 = metersBetween(q, n);
      if (out1 / dt > rules.maxSpeedMps && metersBetween(p, n) < 0.5 * Math.min(out1, out2)) {
        spikes++;
        continue;
      }
    }
    out.push(q);
  }
  return { points: out, spikes };
};

/** The race so far for a walk's points (any order; they are sorted by seq). `raceStartMs` and `nowMs` bound valid fixes. */
export const raceProgress = (points: readonly TrackPoint[], course: RaceCourse, opts: { raceStartMs: number; nowMs: number }, rules: RaceRules = RACE_RULES): RaceProgress => {
  const sorted = [...points].sort((a, b) => a.seq - b.seq);
  const inWindow = sorted.filter((p) => p.capturedAt >= opts.raceStartMs && p.capturedAt <= opts.nowMs + rules.clockSkewMs);
  const ignored = sorted.length - inWindow.length;
  const good = cleanTrack(inWindow, GPS_RULES).filter((p) => (p.accuracyM ?? Infinity) <= rules.maxAccuracyM);
  const { points: track, spikes } = dropSpikes(good, rules);

  const first = course.digits[0].corners[0] ?? { latitude: 0, longitude: 0 };
  const k = Math.cos((first.latitude * Math.PI) / 180);
  const proj = (lat: number, lng: number): XY => [(lng - first.longitude) * 111_320 * k, (lat - first.latitude) * 110_540];
  const prepared = course.digits.map((d) => prepareDigit(d, proj, rules.onEdgeM));
  const intervals = course.digits.map((d) => new Map(d.edges.map((e) => [e.edgeId, [] as [number, number][]])));
  const passed = course.digits.map(() => new Set<Corner>());
  const done: { seq: number; at: number }[] = [];
  const flags = { jumps: 0, jumpM: 0, gapM: 0, spikes, ignored };

  const status = (k: number) => {
    const d = course.digits[k];
    const segTotal = new Map<Segment, number>();
    const segDone = new Map<Segment, number>();
    const edges: Record<string, number> = {};
    let total = 0;
    let walked = 0;
    for (const e of d.edges) {
      const c = Math.min(e.lengthM, covered(intervals[k].get(e.edgeId)!) * (e.lengthM / (prepared[k].find((p) => p.edge.edgeId === e.edgeId)!.total || 1)));
      edges[e.edgeId] = Math.round((c / e.lengthM) * 1000) / 1000;
      total += e.lengthM;
      walked += c;
      segTotal.set(e.segment, (segTotal.get(e.segment) ?? 0) + e.lengthM);
      segDone.set(e.segment, (segDone.get(e.segment) ?? 0) + c);
    }
    const segments: Partial<Record<Segment, number>> = {};
    for (const [s, t] of segTotal) segments[s] = Math.round(((segDone.get(s) ?? 0) / t) * 1000) / 1000;
    const coverage = total ? walked / total : 0;
    const allCorners = d.corners.every((c) => passed[k].has(c.corner));
    const complete = coverage >= rules.digitCoverage && Object.values(segments).every((v) => (v ?? 0) >= rules.segmentCoverage) && allCorners;
    return { coverage, segments, edges, complete };
  };

  const n = course.digits.length;
  let phase = 0;
  let w = 0; // start of the speed window
  for (let i = 0; i < track.length && phase < n; i++) {
    const k = phase;
    const b = track[i];
    const pb = proj(b.latitude, b.longitude);
    // Corners passed on the current digit.
    for (const c of course.digits[k].corners) if (metersBetween(b, c) <= rules.checkpointM) passed[k].add(c.corner);
    if (i > 0) {
      const a = track[i - 1];
      const dist = metersBetween(a, b);
      const dt = (b.capturedAt - a.capturedAt) / 1000;
      if (dt <= 0) continue;
      // Speed over the last 10 seconds too, so noise between two quick fixes can't hide a fast stretch.
      while (w < i - 1 && (b.capturedAt - track[w + 1].capturedAt) / 1000 >= rules.speedWindowS) w++;
      const span = (b.capturedAt - track[w].capturedAt) / 1000;
      const windowFast = track[w].segment === b.segment && span > 0 && metersBetween(track[w], b) / span > rules.maxSpeedMps;
      if (dist / dt > rules.maxSpeedMps || windowFast) {
        // Impossible for a walk: never earns anything, and a long one is a jump to review.
        if (dist > rules.jumpReviewM) {
          flags.jumps++;
          flags.jumpM += dist;
        }
      } else if (a.segment !== b.segment || dist > rules.maxPairM) {
        flags.gapM += dist; // lost signal or a pause: nothing is drawn or earned across it
      } else {
        const pa = proj(a.latitude, a.longitude);
        for (const e of prepared[k]) {
          const [x0, y0, x1, y1] = e.box;
          if (pa[0] < x0 || pa[0] > x1 || pa[1] < y0 || pa[1] > y1 || pb[0] < x0 || pb[0] > x1 || pb[1] < y0 || pb[1] > y1) continue;
          const ja = project(pa, e);
          const jb = project(pb, e);
          if (ja.d > rules.onEdgeM || jb.d > rules.onEdgeM) continue;
          const along = Math.abs(jb.s - ja.s);
          // Walking along the edge, not across it, and never further than actually moved.
          if (along > dist + rules.slackM || along < rules.alongShare * dist) continue;
          addInterval(intervals[k].get(e.edge.edgeId)!, ja.s, jb.s);
        }
      }
    }
    if (status(k).complete) {
      done.push({ seq: b.seq, at: b.capturedAt });
      phase += 1;
      // The fix that finished digit one may already be at a corner of digit two.
      if (phase < n) for (const c of course.digits[phase].corners) if (metersBetween(b, c) <= rules.checkpointM) passed[phase].add(c.corner);
    }
  }

  const digits = course.digits.map((_, k) => {
    const s = status(k);
    return {
      digit: course.digits[k].digit,
      coverage: Math.round(s.coverage * 1000) / 1000,
      segments: s.segments,
      edges: s.edges,
      cornersPassed: CORNERS.filter((c) => passed[k].has(c)),
      complete: Boolean(done[k]),
      completedSeq: done[k]?.seq ?? null,
      completedAt: done[k]?.at ?? null,
    };
  }) as DigitProgress[];

  const issues: RaceIssue[] = [];
  if (track.length < 2) issues.push("too_few_points");
  if (!digits[0].complete) issues.push("digit_one_incomplete");
  else if (n > 1 && !digits[1].complete) issues.push("digit_two_incomplete");
  if (flags.jumps > 0) issues.push("gps_jump");
  if (flags.gapM > rules.maxGapShare * course.raceM) issues.push("gps_gaps");
  const complete = digits.every((d) => d.complete);
  return { version: RACE_VERSION, digits, current: phase, complete, eligible: complete && issues.length === 0, issues, flags: { ...flags, jumpM: Math.round(flags.jumpM), gapM: Math.round(flags.gapM) } };
};

export type PathCoverage = { share: number; coveredM: number; totalM: number; gapM: number; jumps: number; points: number };

/**
 * How much of a path (the connector between the digits) a stretch of the walk followed, with the same matching and
 * GPS rules as the digits: good fixes only, pairs moving along an edge, merged intervals, nothing across gaps, nothing
 * at impossible speed. Only fixes with `afterSeq < seq <= throughSeq` count. The connector never earns digit coverage;
 * this only says whether the walk between the digits was continuous and on the planned streets.
 */
export const pathCoverage = (
  points: readonly TrackPoint[],
  edges: readonly Omit<CourseEdge, "segment">[],
  opts: { raceStartMs: number; nowMs: number; afterSeq: number; throughSeq: number },
  rules: RaceRules = RACE_RULES,
): PathCoverage => {
  const sorted = [...points].sort((a, b) => a.seq - b.seq).filter((p) => p.seq > opts.afterSeq && p.seq <= opts.throughSeq);
  const inWindow = sorted.filter((p) => p.capturedAt >= opts.raceStartMs && p.capturedAt <= opts.nowMs + rules.clockSkewMs);
  const good = cleanTrack(inWindow, GPS_RULES).filter((p) => (p.accuracyM ?? Infinity) <= rules.maxAccuracyM);
  const { points: track } = dropSpikes(good, rules);
  const totalM = edges.reduce((s, e) => s + e.lengthM, 0);
  if (!edges.length || !track.length) return { share: 0, coveredM: 0, totalM, gapM: 0, jumps: 0, points: track.length };
  const [lng0, lat0] = edges[0].coords[0];
  const k = Math.cos((lat0 * Math.PI) / 180);
  const proj = (lat: number, lng: number): XY => [(lng - lng0) * 111_320 * k, (lat - lat0) * 110_540];
  const prepared = prepareDigit({ digit: "0", edges: edges.map((e) => ({ ...e, segment: "A" as Segment })), corners: [] }, proj, rules.onEdgeM);
  const intervals = new Map(edges.map((e) => [e.edgeId, [] as [number, number][]]));
  let gapM = 0;
  let jumps = 0;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1];
    const b = track[i];
    const dist = metersBetween(a, b);
    const dt = (b.capturedAt - a.capturedAt) / 1000;
    if (dt <= 0) continue;
    if (dist / dt > rules.maxSpeedMps) {
      if (dist > rules.jumpReviewM) jumps++;
      continue;
    }
    if (a.segment !== b.segment || dist > rules.maxPairM) {
      gapM += dist;
      continue;
    }
    const pa = proj(a.latitude, a.longitude);
    const pb = proj(b.latitude, b.longitude);
    for (const e of prepared) {
      const [x0, y0, x1, y1] = e.box;
      if (pa[0] < x0 || pa[0] > x1 || pa[1] < y0 || pa[1] > y1 || pb[0] < x0 || pb[0] > x1 || pb[1] < y0 || pb[1] > y1) continue;
      const ja = project(pa, e);
      const jb = project(pb, e);
      if (ja.d > rules.onEdgeM || jb.d > rules.onEdgeM) continue;
      const along = Math.abs(jb.s - ja.s);
      if (along > dist + rules.slackM || along < rules.alongShare * dist) continue;
      addInterval(intervals.get(e.edge.edgeId)!, ja.s, jb.s);
    }
  }
  let coveredM = 0;
  for (const e of prepared) coveredM += Math.min(e.edge.lengthM, covered(intervals.get(e.edge.edgeId)!) * (e.edge.lengthM / e.total));
  return { share: totalM ? Math.round((coveredM / totalM) * 1000) / 1000 : 0, coveredM: Math.round(coveredM), totalM: Math.round(totalM), gapM: Math.round(gapM), jumps, points: track.length };
};
