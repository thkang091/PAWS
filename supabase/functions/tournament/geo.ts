import { area } from "@turf/area";
import { kinks } from "@turf/kinks";
import { polygon } from "@turf/helpers";

/**
 * Tournament GPS and territory rules, shared by the phone (live preview) and the `tournament` edge function (the
 * trusted check). Pure: no clocks, storage or network. The phone and server pass in time and points.
 *
 * The server never takes the phone's word for anything that scores. It rebuilds the track from the stored points,
 * runs `evaluateTerritory` itself, and the database computes the official area with PostGIS.
 *
 * GPS can be spoofed. These checks catch impossible movement and broken tracks; they cannot prove a phone was where it
 * said it was.
 */

export const GPS_RULES = {
  /** Ask the phone for a fix about this often, or after this far, whichever it manages. */
  sampleMs: 4_000,
  sampleMeters: 5,
  /** Fixes less precise than this are too noisy to draw or count. */
  poorAccuracyM: 30,
  /** A fix older than this when it arrives is stale. */
  staleMs: 30_000,
  /** How close to the first point the walk has to finish. */
  closureM: 25,
  /** Faster than this between two fixes is not walking a dog: flagged, never counted. */
  maxSpeedMps: 6,
  /** The shortest walk that can claim a territory. */
  minDistanceM: 200,
  /** Fewest distinct points that make a usable outline. */
  minPoints: 12,
  /** A new fix this close to the last kept one is the same place. */
  dedupeM: 4,
  /** A straight hole in the track longer than this (lost signal, or moving while paused) breaks the outline. */
  maxGapM: 60,
  /** Wobble smaller than this is smoothed out of the outline before checking it. */
  smoothM: 3,
  /** A share of the route above this moving at impossible speed makes the walk suspicious. */
  maxSuspiciousShare: 0.1,
  minAreaM2: 200,
  maxAreaM2: 3_000_000,
  maxDurationMs: 3 * 60 * 60 * 1000,
} as const;

export type GpsRules = typeof GPS_RULES;

/** One reading from the phone. Time is milliseconds since 1970. */
export type GpsFix = { latitude: number; longitude: number; accuracyM: number | null; capturedAt: number };

/** A fix the walk kept. `segment` goes up by one after every resume, so paused stretches are never joined. */
export type TrackPoint = GpsFix & { seq: number; segment: number };

export type FixVerdict = "accept" | "invalid" | "stale" | "poor_accuracy" | "duplicate";

const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres. */
export const metersBetween = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const isValidCoordinate = (lat: unknown, lng: unknown) =>
  typeof lat === "number" &&
  typeof lng === "number" &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180 &&
  !(lat === 0 && lng === 0);

/**
 * Decides whether a fresh fix joins the track. `previous` is the last kept point. Jumps are not rejected here: they
 * are kept so the line stays honest, and `summarizeTrack` refuses to count them.
 */
export const screenFix = (previous: TrackPoint | null, fix: GpsFix, now: number, segment: number, rules: GpsRules = GPS_RULES): FixVerdict => {
  if (!isValidCoordinate(fix.latitude, fix.longitude) || !Number.isFinite(fix.capturedAt) || fix.capturedAt > now + 5_000) return "invalid";
  if (now - fix.capturedAt > rules.staleMs) return "stale";
  if (previous && fix.capturedAt <= previous.capturedAt) return "stale";
  if (fix.accuracyM == null || !Number.isFinite(fix.accuracyM) || fix.accuracyM > rules.poorAccuracyM) return "poor_accuracy";
  if (previous && previous.segment === segment && metersBetween(previous, fix) < rules.dedupeM) return "duplicate";
  return "accept";
};

export type TrackSummary = {
  /** Walked metres that count: plausible steps inside one stretch of walking. */
  distanceM: number;
  /** Time spent walking; paused stretches are left out. */
  activeMs: number;
  /** Metres covered faster than walking pace. */
  suspiciousM: number;
  /** Straight holes longer than `maxGapM`. */
  gaps: number;
  /** Points left after removing repeats. */
  points: number;
};

export const summarizeTrack = (points: readonly TrackPoint[], rules: GpsRules = GPS_RULES): TrackSummary => {
  let distanceM = 0;
  let suspiciousM = 0;
  let gaps = 0;
  let activeMs = 0;
  let segmentStart = points[0]?.capturedAt ?? 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const q = points[i];
    const d = metersBetween(p, q);
    if (q.segment !== p.segment) {
      activeMs += p.capturedAt - segmentStart;
      segmentStart = q.capturedAt;
      if (d > rules.maxGapM) gaps++;
      continue;
    }
    const dt = (q.capturedAt - p.capturedAt) / 1000;
    if (dt <= 0) continue;
    if (d / dt > rules.maxSpeedMps) suspiciousM += d;
    else if (d > rules.maxGapM) gaps++;
    else distanceM += d;
  }
  if (points.length) activeMs += points[points.length - 1].capturedAt - segmentStart;
  return { distanceM, activeMs: Math.max(0, activeMs), suspiciousM, gaps, points: points.length };
};

/**
 * The server's own pass over stored points: in order, well-formed, precise enough, moving forward in time, no
 * repeats. The phone screens fixes the same way, but the server never relies on that.
 */
export const cleanTrack = (points: readonly TrackPoint[], rules: GpsRules = GPS_RULES): TrackPoint[] => {
  const out: TrackPoint[] = [];
  const seen = new Set<number>();
  for (const p of [...points].sort((a, b) => a.seq - b.seq)) {
    if (seen.has(p.seq)) continue;
    seen.add(p.seq);
    const previous = out[out.length - 1] ?? null;
    // Freshness is a phone-side concern; here each point is judged against its own time.
    if (screenFix(previous, p, p.capturedAt, p.segment, rules) === "accept") out.push(p);
  }
  return out;
};

// ---------- Territory ----------

export type TerritoryIssue =
  | "too_few_points"
  | "too_short"
  | "not_closed"
  | "gps_gap"
  | "suspicious_speed"
  | "too_long"
  | "self_intersecting"
  | "too_small"
  | "too_large";

/** Issues the player can still fix by walking on. */
export const RECOVERABLE: readonly TerritoryIssue[] = ["too_few_points", "too_short", "not_closed"];

export type Territory = {
  ok: boolean;
  issues: TerritoryIssue[];
  distanceM: number;
  activeMs: number;
  closureM: number;
  areaM2: number;
  /** The closed outline as GeoJSON positions, [longitude, latitude], first equal to last. Empty when unusable. */
  ring: [number, number][];
};

/** Douglas-Peucker in local metres, so a few metres of standing-still wobble do not turn into tiny loops. */
const simplify = (pts: { x: number; y: number; i: number }[], tolerance: number) => {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const A = pts[a];
    const B = pts[b];
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy);
    let worst = -1;
    let at = -1;
    for (let k = a + 1; k < b; k++) {
      // A closed loop starts and ends in the same place; then distance from that point is what matters.
      const d = len > 0 ? Math.abs(dy * pts[k].x - dx * pts[k].y + B.x * A.y - B.y * A.x) / len : Math.hypot(pts[k].x - A.x, pts[k].y - A.y);
      if (d > worst) {
        worst = d;
        at = k;
      }
    }
    if (worst > tolerance && at > 0) {
      keep[at] = 1;
      stack.push([a, at], [at, b]);
    }
  }
  return pts.filter((_, k) => keep[k]);
};

const closeRing = (positions: [number, number][]): [number, number][] => {
  if (positions.length < 3) return [];
  const ring = [...positions];
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  return ring.length >= 4 ? ring : [];
};

const crossesItself = (ring: [number, number][]) => kinks(polygon([ring])).features.length > 0;

/**
 * The outline as [lng, lat] positions, closed back to its first point. It follows the walk as recorded; only when
 * GPS wobble makes it cross itself is it smoothed by a few metres, so a clean walk keeps every bit of its area.
 */
export const outlineOf = (points: readonly TrackPoint[], rules: GpsRules = GPS_RULES): [number, number][] => {
  if (points.length < 3) return [];
  const raw = closeRing(points.map((p) => [p.longitude, p.latitude] as [number, number]));
  if (!raw.length || !crossesItself(raw)) return raw;
  const lat0 = rad(points[0].latitude);
  const local = points.map((p, i) => ({
    x: R * rad(p.longitude - points[0].longitude) * Math.cos(lat0),
    y: R * rad(p.latitude - points[0].latitude),
    i,
  }));
  return closeRing(simplify(local, rules.smoothM).map((p) => [points[p.i].longitude, points[p.i].latitude] as [number, number]));
};

/**
 * Checks a finished walk the same way on the phone and on the server. Every problem is listed, most useful first.
 * The live preview while walking passes `checkCrossing: false`: the crossing check grows with the square of the
 * points, so it runs on Finish and on the server, not every few seconds.
 */
export const evaluateTerritory = (points: readonly TrackPoint[], rules: GpsRules = GPS_RULES, options: { checkCrossing?: boolean } = {}): Territory => {
  const checkCrossing = options.checkCrossing ?? true;
  const summary = summarizeTrack(points, rules);
  const issues: TerritoryIssue[] = [];
  const first = points[0];
  const last = points[points.length - 1];
  const closureM = first && last ? metersBetween(first, last) : Infinity;

  if (summary.distanceM < rules.minDistanceM) issues.push("too_short");
  if (points.length < rules.minPoints) issues.push("too_few_points");
  if (!(closureM <= rules.closureM)) issues.push("not_closed");
  if (summary.gaps > 0) issues.push("gps_gap");
  const moved = summary.distanceM + summary.suspiciousM;
  if (moved > 0 && summary.suspiciousM / moved > rules.maxSuspiciousShare) issues.push("suspicious_speed");
  if (summary.activeMs > rules.maxDurationMs) issues.push("too_long");

  const ring = checkCrossing ? outlineOf(points, rules) : closeRing(points.map((p) => [p.longitude, p.latitude] as [number, number]));
  let areaM2 = 0;
  if (ring.length >= 4) {
    const shape = polygon([ring]);
    if (checkCrossing && crossesItself(ring)) issues.push("self_intersecting");
    areaM2 = area(shape);
    if (areaM2 < rules.minAreaM2) issues.push("too_small");
    if (areaM2 > rules.maxAreaM2) issues.push("too_large");
  } else if (!issues.includes("too_few_points")) {
    issues.push("too_few_points");
  }

  return {
    ok: issues.length === 0,
    issues,
    distanceM: summary.distanceM,
    activeMs: summary.activeMs,
    closureM: Number.isFinite(closureM) ? closureM : 0,
    areaM2: issues.includes("self_intersecting") ? 0 : areaM2,
    ring,
  };
};

// ---------- Tournament timing ----------

export type TournamentPhase = "upcoming" | "registration" | "active" | "completed" | "cancelled";

export type TournamentTimes = { status: string; registrationOpensAt: string; startsAt: string; endsAt: string };

/** A walk still going when the tournament ends can be handed in for this long afterwards. */
export const SUBMIT_GRACE_MS = 30 * 60 * 1000;

export const tournamentPhase = (t: TournamentTimes, now: number): TournamentPhase => {
  if (t.status === "cancelled") return "cancelled";
  if (now < Date.parse(t.registrationOpensAt)) return "upcoming";
  if (now < Date.parse(t.startsAt)) return "registration";
  if (now < Date.parse(t.endsAt)) return "active";
  return "completed";
};

/** Walks may start only while the tournament runs, and be handed in until the grace period after it ends. */
export const canStartWalk = (t: TournamentTimes, now: number) => tournamentPhase(t, now) === "active";

export const canHandIn = (t: TournamentTimes, sessionStartedAt: string, now: number) =>
  t.status !== "cancelled" &&
  Date.parse(sessionStartedAt) >= Date.parse(t.startsAt) &&
  Date.parse(sessionStartedAt) < Date.parse(t.endsAt) &&
  now <= Date.parse(t.endsAt) + SUBMIT_GRACE_MS;

// ---------- Leaderboard ----------

/** One checked result: a territory's area, or a shape's score. Higher is better in every tournament game so far. */
export type BoardEntry = { userId: string; value: number; submittedAt: string; submissionId: string };

/**
 * Each player's best result, highest first. Ties go to whoever handed theirs in first, then to the lower
 * submission id, so the order never changes between reads.
 */
export const rankBoard = <T extends BoardEntry>(entries: readonly T[]): (T & { rank: number })[] => {
  const order = (a: T, b: T) =>
    b.value - a.value || Date.parse(a.submittedAt) - Date.parse(b.submittedAt) || a.submissionId.localeCompare(b.submissionId);
  const best = new Map<string, T>();
  for (const e of entries) {
    const held = best.get(e.userId);
    if (!held || order(e, held) < 0) best.set(e.userId, e);
  }
  return [...best.values()].sort(order).map((e, i) => ({ ...e, rank: i + 1 }));
};

// ---------- Server planning (pure, so it can be tested) ----------

export type SessionRow = {
  id: string;
  user_id: string;
  tournament_id: string;
  status: "active" | "paused" | "submitted" | "cancelled" | "expired";
  started_at: string;
  last_seq: number;
  last_submit_attempt_at: string | null;
};

export type IncomingPoint = { seq: number; segment: number; latitude: number; longitude: number; accuracyM: number | null; capturedAt: number };

export const MAX_BATCH = 300;
/** Points a single session may send in any one minute. A phone sampling every few seconds sends about twenty. */
export const MAX_POINTS_PER_MINUTE = 400;
/** Seconds between two hand-in attempts for one walk. */
export const SUBMIT_COOLDOWN_S = 5;

export type AppendPlan =
  | { kind: "reject"; error: "not_found" | "session_closed" | "too_many" | "window_closed" }
  | { kind: "insert"; rows: IncomingPoint[]; dropped: number };

/**
 * What to store from a batch: only the caller's own open session, inside the tournament window, within the rate
 * limit, and only well-formed points. Repeats are safe: the table ignores a sequence number it already has.
 */
export const planAppend = (args: {
  session: SessionRow | null;
  userId: string;
  tournament: TournamentTimes;
  incoming: unknown;
  receivedLastMinute: number;
  now: number;
}): AppendPlan => {
  const { session, userId, tournament, incoming, receivedLastMinute, now } = args;
  if (!session || session.user_id !== userId) return { kind: "reject", error: "not_found" };
  if (session.status !== "active" && session.status !== "paused") return { kind: "reject", error: "session_closed" };
  if (!canHandIn(tournament, session.started_at, now)) return { kind: "reject", error: "window_closed" };
  const list = Array.isArray(incoming) ? incoming : [];
  if (list.length > MAX_BATCH || receivedLastMinute + list.length > MAX_POINTS_PER_MINUTE) return { kind: "reject", error: "too_many" };
  const rows: IncomingPoint[] = [];
  for (const raw of list) {
    const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const seq = p.seq;
    const segment = p.segment;
    const accuracy = p.accuracyM;
    if (
      Number.isInteger(seq) && (seq as number) > 0 &&
      Number.isInteger(segment) && (segment as number) >= 0 &&
      isValidCoordinate(p.latitude, p.longitude) &&
      typeof p.capturedAt === "number" && Number.isFinite(p.capturedAt) && p.capturedAt <= now + 5_000 &&
      p.capturedAt >= Date.parse(session.started_at) - 60_000 &&
      (accuracy == null || (typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy >= 0))
    ) {
      rows.push({ seq: seq as number, segment: segment as number, latitude: p.latitude as number, longitude: p.longitude as number, accuracyM: (accuracy as number | null) ?? null, capturedAt: p.capturedAt });
    }
  }
  return { kind: "insert", rows, dropped: list.length - rows.length };
};

export type SubmitPlan =
  | { kind: "existing"; submissionId: string }
  | { kind: "reject"; error: "not_found" | "session_closed" | "window_closed" | "slow_down" }
  | { kind: "retry"; territory: Territory }
  | { kind: "record"; territory: Territory };

export type GatePlan =
  | { kind: "existing"; submissionId: string }
  | { kind: "reject"; error: "not_found" | "session_closed" | "window_closed" | "slow_down" }
  | { kind: "open" };

/** The checks every hand-in passes before its game scores it: whose walk, already done, still open, on time, not too soon. */
export const gateSubmit = (args: {
  session: SessionRow | null;
  userId: string;
  tournament: TournamentTimes;
  existingSubmissionId: string | null;
  now: number;
}): GatePlan => {
  const { session, userId, tournament, existingSubmissionId, now } = args;
  if (!session || session.user_id !== userId) return { kind: "reject", error: "not_found" };
  if (existingSubmissionId) return { kind: "existing", submissionId: existingSubmissionId };
  if (session.status !== "active" && session.status !== "paused") return { kind: "reject", error: "session_closed" };
  if (!canHandIn(tournament, session.started_at, now)) return { kind: "reject", error: "window_closed" };
  if (session.last_submit_attempt_at && now - Date.parse(session.last_submit_attempt_at) < SUBMIT_COOLDOWN_S * 1000) {
    return { kind: "reject", error: "slow_down" };
  }
  return { kind: "open" };
};

/**
 * Hand-in for one walk. A second request for the same walk returns the first result. A walk that cannot claim yet
 * stays open when the problem can be fixed by walking on (not back at the start, too short); otherwise it is
 * reported and the player can end it.
 */
export const planSubmit = (args: {
  session: SessionRow | null;
  userId: string;
  tournament: TournamentTimes;
  existingSubmissionId: string | null;
  points: readonly TrackPoint[];
  now: number;
  rules?: GpsRules;
}): SubmitPlan => {
  const gate = gateSubmit(args);
  if (gate.kind !== "open") return gate;
  const territory = evaluateTerritory(cleanTrack(args.points, args.rules), args.rules);
  return territory.ok ? { kind: "record", territory } : { kind: "retry", territory };
};
