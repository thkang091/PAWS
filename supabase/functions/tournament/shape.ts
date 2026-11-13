import { GPS_RULES, cleanTrack, summarizeTrack, type GpsRules, type TrackPoint } from "./geo.ts";

/**
 * Follow the Shape scoring. Pure and deterministic: the same points and the same rules always give the same score,
 * on the phone (preview) and on the server (official).
 *
 * Pipeline:
 *  1. Clean the track (same rules as Make the Largest Country) and check eligibility.
 *  2. Project to local metres around the route's centre.
 *  3. Resample route and target to the same number of points, evenly spaced along their length.
 *  4. Normalise: move both centres to the origin and scale both to a root-mean-square radius of 1.
 *  5. Align: for each allowed start point (closed shapes can be walked from anywhere on the outline) and direction,
 *     rotate the route onto the target with the best-fitting rotation (Procrustes). Mirror images are not allowed.
 *  6. Compare with the discrete Fréchet distance, which respects the order you walked in.
 *  7. Turn the best (smallest) distance into a score from 0 to 100.
 *
 * Rules are versioned. Results store the version they were scored with, so a later change never rewrites history.
 */

export const SHAPE_ALGORITHM = "frechet-v1";

export type ShapeRules = {
  algorithm: string;
  /** Points each path is resampled to. */
  samples: number;
  /** Turning the shape on the map is fine by default: a star is a star whichever way up. */
  allowRotation: boolean;
  /** Walking the outline the other way round counts the same. */
  allowReverse: boolean;
  /** Distances at or below this (in units of the shape's own size) score 100. */
  perfectAt: number;
  /** Distances at or above this score 0. */
  zeroAt: number;
  minPoints: number;
};

export const DEFAULT_SHAPE_RULES: ShapeRules = {
  algorithm: SHAPE_ALGORITHM,
  samples: 64,
  allowRotation: true,
  allowReverse: true,
  perfectAt: 0.12,
  zeroAt: 1.0,
  minPoints: 20,
};

export type ShapeTarget = { closed: boolean; minDistanceM: number; points: readonly (readonly [number, number])[] };

type P = [number, number];

const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Local metres (x east, y north) around the mean position. Accurate to well under a percent over a few km. */
export const projectLocal = (points: readonly { latitude: number; longitude: number }[]): P[] => {
  if (!points.length) return [];
  const lat0 = points.reduce((s, p) => s + p.latitude, 0) / points.length;
  const lng0 = points.reduce((s, p) => s + p.longitude, 0) / points.length;
  const k = Math.cos(rad(lat0));
  return points.map((p) => [R * rad(p.longitude - lng0) * k, R * rad(p.latitude - lat0)]);
};

const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** `n` points evenly spaced along the path, first and last included. */
export const resample = (path: readonly P[], n: number): P[] => {
  if (path.length === 0) return [];
  if (path.length === 1) return Array.from({ length: n }, () => [path[0][0], path[0][1]] as P);
  const lengths = [0];
  for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1] + dist(path[i - 1], path[i]));
  const total = lengths[lengths.length - 1];
  if (total === 0) return Array.from({ length: n }, () => [path[0][0], path[0][1]] as P);
  const out: P[] = [];
  let seg = 1;
  for (let k = 0; k < n; k++) {
    const target = (total * k) / (n - 1);
    while (seg < path.length - 1 && lengths[seg] < target) seg++;
    const a = path[seg - 1];
    const b = path[seg];
    const span = lengths[seg] - lengths[seg - 1] || 1;
    const t = Math.min(1, Math.max(0, (target - lengths[seg - 1]) / span));
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
};

/** Centre on the origin and scale to a root-mean-square radius of 1. */
export const normalize = (path: readonly P[]): P[] => {
  if (!path.length) return [];
  const cx = path.reduce((s, p) => s + p[0], 0) / path.length;
  const cy = path.reduce((s, p) => s + p[1], 0) / path.length;
  const centred = path.map(([x, y]) => [x - cx, y - cy] as P);
  const rms = Math.sqrt(centred.reduce((s, [x, y]) => s + x * x + y * y, 0) / centred.length) || 1;
  return centred.map(([x, y]) => [x / rms, y / rms] as P);
};

/** Discrete Fréchet distance: the shortest leash that lets you walk both paths in order, never going back. */
export const frechet = (a: readonly P[], b: readonly P[]) => {
  const n = a.length;
  const m = b.length;
  let prev = new Float64Array(m);
  let row = new Float64Array(m);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const d = dist(a[i], b[j]);
      if (i === 0 && j === 0) row[j] = d;
      else if (i === 0) row[j] = Math.max(row[j - 1], d);
      else if (j === 0) row[j] = Math.max(prev[0], d);
      else row[j] = Math.max(Math.min(prev[j], prev[j - 1], row[j - 1]), d);
    }
    [prev, row] = [row, prev];
  }
  return prev[m - 1];
};

/** Best rotation of `a` onto `b` for paired points (2D Procrustes), in radians. */
const bestRotation = (a: readonly P[], b: readonly P[]) => {
  let s = 0;
  let c = 0;
  for (let i = 0; i < a.length; i++) {
    s += a[i][0] * b[i][1] - a[i][1] * b[i][0];
    c += a[i][0] * b[i][0] + a[i][1] * b[i][1];
  }
  return Math.atan2(s, c);
};

const rotate = (path: readonly P[], theta: number): P[] => {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return path.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos] as P);
};

/** The target as a path to walk: closed shapes return to where they began. */
const targetPath = (target: ShapeTarget): P[] => {
  const pts = target.points.map(([x, y]) => [x, y] as P);
  return target.closed && pts.length ? [...pts, pts[0]] : pts;
};

/** Every way the target may legally be walked: each start on a closed outline, each allowed direction. */
const targetVariants = (target: ShapeTarget, rules: ShapeRules) => {
  const n = rules.samples;
  const base = resample(targetPath(target), n);
  const variants: { path: P[]; shift: number; reversed: boolean }[] = [];
  const directions = rules.allowReverse ? [false, true] : [false];
  for (const reversed of directions) {
    const directed = reversed ? [...base].reverse() : base;
    if (!target.closed) {
      variants.push({ path: normalize(directed), shift: 0, reversed });
      continue;
    }
    // A closed outline resampled to n points repeats its first point at the end; drop it, rotate, close again.
    const ring = directed.slice(0, n - 1);
    for (let shift = 0; shift < ring.length; shift++) {
      const rotated = [...ring.slice(shift), ...ring.slice(0, shift)];
      variants.push({ path: normalize([...rotated, rotated[0]]), shift, reversed });
    }
  }
  return variants;
};

export type ShapeIssue = "too_few_points" | "too_short" | "gps_gap" | "suspicious_speed" | "too_long";

export type ShapeMatch = {
  ok: boolean;
  issues: ShapeIssue[];
  /** 0 to 100, one decimal. 0 when the walk is not eligible. */
  score: number;
  /** Best Fréchet distance in units of the shape's own size. */
  distance: number;
  distanceM: number;
  activeMs: number;
  /** The route, normalised and turned onto the target, for drawing the two together. */
  route: P[];
  /** The target as it was matched, normalised. */
  target: P[];
  algorithm: string;
};

export const scoreFromDistance = (d: number, rules: ShapeRules = DEFAULT_SHAPE_RULES) => {
  if (!Number.isFinite(d)) return 0;
  const t = (d - rules.perfectAt) / (rules.zeroAt - rules.perfectAt);
  return Math.round(Math.min(1, Math.max(0, 1 - t)) * 1000) / 10;
};

/** Compares a walk with a target shape. Ineligible walks are still measured (for a helpful preview) but score 0. */
export const matchShape = (
  points: readonly TrackPoint[],
  target: ShapeTarget,
  rules: ShapeRules = DEFAULT_SHAPE_RULES,
  gps: GpsRules = GPS_RULES,
): ShapeMatch => {
  const track = cleanTrack(points, gps);
  const summary = summarizeTrack(track, gps);
  const issues: ShapeIssue[] = [];
  if (track.length < rules.minPoints) issues.push("too_few_points");
  if (summary.distanceM < target.minDistanceM) issues.push("too_short");
  if (summary.gaps > 0) issues.push("gps_gap");
  const moved = summary.distanceM + summary.suspiciousM;
  if (moved > 0 && summary.suspiciousM / moved > gps.maxSuspiciousShare) issues.push("suspicious_speed");
  if (summary.activeMs > gps.maxDurationMs) issues.push("too_long");

  const empty = { distance: Infinity, route: [] as P[], target: normalize(resample(targetPath(target), rules.samples)) };
  let best = empty;
  if (track.length >= 2) {
    const route = normalize(resample(projectLocal(track), rules.samples));
    for (const v of targetVariants(target, rules)) {
      const aligned = rules.allowRotation ? rotate(route, bestRotation(route, v.path)) : route;
      const d = frechet(aligned, v.path);
      // Ties keep the first variant found, so the result never depends on anything but the input.
      if (d < best.distance - 1e-12) best = { distance: d, route: aligned, target: v.path };
    }
  }

  const ok = issues.length === 0 && Number.isFinite(best.distance);
  return {
    ok,
    issues,
    score: ok ? scoreFromDistance(best.distance, rules) : 0,
    distance: Number.isFinite(best.distance) ? Math.round(best.distance * 10_000) / 10_000 : -1,
    distanceM: summary.distanceM,
    activeMs: summary.activeMs,
    route: best.route.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000] as P),
    target: best.target.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000] as P),
    algorithm: rules.algorithm,
  };
};

/**
 * Compares planned routes (not GPS walks) with one target shape: the same normalisation, alignment and Fréchet
 * distance as matchShape, without the GPS eligibility checks. The target's variants are prepared once, so ranking
 * many candidate routes stays fast. A route is judged exactly the way a walk along it would be.
 */
export const pathMatcher = (target: ShapeTarget, rules: ShapeRules = DEFAULT_SHAPE_RULES) => {
  const variants = targetVariants(target, rules);
  return (path: readonly { latitude: number; longitude: number }[]) => {
    if (path.length < 2) return { distance: Infinity, score: 0 };
    const route = normalize(resample(projectLocal(path), rules.samples));
    let best = Infinity;
    for (const v of variants) {
      const aligned = rules.allowRotation ? rotate(route, bestRotation(route, v.path)) : route;
      best = Math.min(best, frechetBelow(aligned, v.path, best));
    }
    return { distance: best, score: scoreFromDistance(best, rules) };
  };
};

/**
 * The same discrete Fréchet distance, but gives up (Infinity) as soon as it can't come in under `cap`: every value in
 * a row is a lower bound for the final answer, so once a whole row is at or above the cap, nothing below it can win.
 * Gives exactly frechet(a, b) whenever that is below `cap`.
 */
const frechetBelow = (a: readonly P[], b: readonly P[], cap: number) => {
  const n = a.length;
  const m = b.length;
  if (dist(a[0], b[0]) >= cap || dist(a[n - 1], b[m - 1]) >= cap) return Infinity;
  let prev = new Float64Array(m);
  let row = new Float64Array(m);
  for (let i = 0; i < n; i++) {
    let rowMin = Infinity;
    const [ax, ay] = a[i];
    for (let j = 0; j < m; j++) {
      const d = Math.sqrt((ax - b[j][0]) ** 2 + (ay - b[j][1]) ** 2);
      let v: number;
      if (i === 0 && j === 0) v = d;
      else if (i === 0) v = Math.max(row[j - 1], d);
      else if (j === 0) v = Math.max(prev[0], d);
      else v = Math.max(Math.min(prev[j], prev[j - 1], row[j - 1]), d);
      row[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin >= cap) return Infinity;
    [prev, row] = [row, prev];
  }
  return prev[m - 1];
};

export const matchPath = (path: readonly { latitude: number; longitude: number }[], target: ShapeTarget, rules: ShapeRules = DEFAULT_SHAPE_RULES) =>
  pathMatcher(target, rules)(path);
