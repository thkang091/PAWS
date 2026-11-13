import { GPS_RULES, cleanTrack, metersBetween, type TrackPoint } from "../tournament/geo.ts";

/**
 * Team battles (Steal Your Territory, Steal Your Road): the rules that are pure enough to test. Territory ownership
 * itself is decided in PostGIS (see the team battle migration); this file covers the match lifecycle, teams, road
 * map matching, the road network score, captures' cooldown, and checking an imported road graph.
 */

export type Team = "blue" | "orange";
export const TEAMS: readonly Team[] = ["blue", "orange"];

// ---------- Match lifecycle ----------

export type MatchStatus = "lobby" | "preparing" | "countdown" | "active" | "finalizing" | "completed" | "cancelled";

/** The only moves a match can make. The server applies them; nothing else changes a match's status. */
export const TRANSITIONS: Record<MatchStatus, readonly MatchStatus[]> = {
  lobby: ["preparing", "cancelled"],
  preparing: ["countdown", "cancelled"],
  countdown: ["active", "cancelled"],
  active: ["finalizing", "cancelled"],
  finalizing: ["completed"],
  completed: [],
  cancelled: [],
};

export const canTransition = (from: MatchStatus, to: MatchStatus) => TRANSITIONS[from].includes(to);

export const MATCH_LIMITS = { minPlayers: 2, maxPlayers: 10, minMinutes: 10, maxMinutes: 30, countdownSeconds: 10 } as const;

/** Where a started match should be at `now`, from its server-set start and end. */
export const phaseAt = (m: { startsAt: string; endsAt: string }, now: number): "countdown" | "active" | "finalizing" => {
  if (now < Date.parse(m.startsAt)) return "countdown";
  if (now < Date.parse(m.endsAt)) return "active";
  return "finalizing";
};

// ---------- Teams ----------

/** Even teams by join order: first to blue, second to orange, and so on. Deterministic, so every phone agrees. */
export const balanceTeams = (players: readonly { userId: string; joinedAt: string }[]): Map<string, Team> => {
  const sorted = [...players].sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt) || a.userId.localeCompare(b.userId));
  return new Map(sorted.map((p, i) => [p.userId, TEAMS[i % 2]]));
};

/** A match may start only with every player on a team and both teams filled. */
export const teamsReady = (assignments: readonly (Team | null)[]) =>
  assignments.length >= MATCH_LIMITS.minPlayers && assignments.every(Boolean) && TEAMS.every((t) => assignments.includes(t));

/** Areas this close (1 m², or 0.1% of the larger) are a tie: GPS cannot honestly separate them. */
export const TIE = { areaM2: 1, areaShare: 0.001, points: 0.05 } as const;

export const winnerOf = (scores: Record<Team, number>, unit: "m2" | "points"): Team | "tie" => {
  const { blue, orange } = scores;
  const tolerance = unit === "m2" ? Math.max(TIE.areaM2, Math.max(blue, orange) * TIE.areaShare) : TIE.points;
  if (Math.abs(blue - orange) <= tolerance) return "tie";
  return blue > orange ? "blue" : "orange";
};

// ---------- Road graph ----------

export type RoadEdge = { id: string; startNodeId: string; endNodeId: string; coords: readonly (readonly [number, number])[]; lengthM: number; name?: string | null };

export const ROAD_RULES = {
  /** How far a GPS point may be from a road and still count as on it. */
  maxDistanceM: 12,
  /** Two roads this close in distance from a point, away from a shared junction, make the point ambiguous. */
  ambiguityM: 4,
  /** Points near a junction of the two candidate roads are not called ambiguous. */
  junctionM: 15,
  /** Fixes less precise than this are not used for roads. */
  maxAccuracyM: 15,
  /** Share of a road one walk must cover to capture it. */
  captureShare: 0.7,
  /** Seconds before a road just captured can be taken back. */
  cooldownS: 120,
  /** Along-road progress may exceed the distance actually walked by this much (GPS wobble), and no more. */
  slackM: 6,
} as const;

export type RoadRules = typeof ROAD_RULES;

type XY = [number, number];
const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

const makeProjector = (lat0: number, lng0: number) => {
  const k = Math.cos(rad(lat0));
  return (lng: number, lat: number): XY => [R * rad(lng - lng0) * k, R * rad(lat - lat0)];
};

type Prepared = { edge: RoadEdge; pts: XY[]; cum: number[]; total: number };

/** Nearest point on a polyline: distance off it and how far along it, in metres. */
const project = (p: XY, e: Prepared) => {
  let best = { d: Infinity, s: 0 };
  for (let i = 1; i < e.pts.length; i++) {
    const [ax, ay] = e.pts[i - 1];
    const [bx, by] = e.pts[i];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / len2));
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    const d = Math.hypot(p[0] - cx, p[1] - cy);
    if (d < best.d) best = { d, s: e.cum[i - 1] + Math.sqrt(len2) * t };
  }
  return best;
};

/** Merges overlapping [start, end] intervals and returns their total length. */
export const coveredLength = (intervals: readonly (readonly [number, number])[]) => {
  const sorted = [...intervals].map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as [number, number]).sort((x, y) => x[0] - y[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const iv of sorted) {
    if (!cur || iv[0] > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [iv[0], iv[1]];
    } else cur[1] = Math.max(cur[1], iv[1]);
  }
  if (cur) total += cur[1] - cur[0];
  return total;
};

export type Coverage = { edgeId: string; share: number; coveredM: number; lengthM: number; name: string | null };

/**
 * Map matching: which part of each road a walk really covered.
 *
 *  1. Keep only clean, precise fixes (the tournament GPS rules, plus a tighter accuracy limit for roads).
 *  2. Project everything to local metres; find candidate roads near each fix with a coarse grid index.
 *  3. Snap each fix to the nearest road within range. A fix about as close to two unconnected roads (parallel
 *     paths) is ambiguous and left unassigned.
 *  4. Between two consecutive fixes on the same road, count the stretch between their positions along it, but only
 *     if the walk really progressed: walking pace, no gap, and along-road progress no longer than the distance
 *     actually walked. A jump across a road covers nothing.
 *  5. Merge the counted stretches on each road (walking it twice adds nothing) and report the covered share.
 */
export const matchRoads = (points: readonly TrackPoint[], edges: readonly RoadEdge[], rules: RoadRules = ROAD_RULES): Map<string, Coverage> => {
  const result = new Map<string, Coverage>();
  for (const e of edges) result.set(e.id, { edgeId: e.id, share: 0, coveredM: 0, lengthM: e.lengthM, name: e.name ?? null });
  const track = cleanTrack(points).filter((p) => (p.accuracyM ?? Infinity) <= rules.maxAccuracyM);
  if (track.length < 2 || !edges.length) return result;

  const lat0 = track[0].latitude;
  const lng0 = track[0].longitude;
  const proj = makeProjector(lat0, lng0);
  const prepared: Prepared[] = edges.map((edge) => {
    const pts = edge.coords.map(([lng, lat]) => proj(lng, lat));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { edge, pts, cum, total: cum[cum.length - 1] || 1 };
  });

  // Grid index: each cell lists the roads passing near it.
  const CELL = 40;
  const grid = new Map<string, number[]>();
  prepared.forEach((e, idx) => {
    const xs = e.pts.map((p) => p[0]);
    const ys = e.pts.map((p) => p[1]);
    const pad = rules.maxDistanceM;
    for (let gx = Math.floor((Math.min(...xs) - pad) / CELL); gx <= Math.floor((Math.max(...xs) + pad) / CELL); gx++) {
      for (let gy = Math.floor((Math.min(...ys) - pad) / CELL); gy <= Math.floor((Math.max(...ys) + pad) / CELL); gy++) {
        const key = `${gx}:${gy}`;
        grid.set(key, [...(grid.get(key) ?? []), idx]);
      }
    }
  });

  const sharesNode = (a: RoadEdge, b: RoadEdge) => [a.startNodeId, a.endNodeId].some((n) => n === b.startNodeId || n === b.endNodeId);
  const nearJunction = (p: XY, a: Prepared, b: Prepared) => {
    const ends = [a.pts[0], a.pts[a.pts.length - 1]];
    return sharesNode(a.edge, b.edge) && ends.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= rules.junctionM);
  };

  type Snap = { idx: number; s: number } | null;
  const snaps: Snap[] = track.map((pt) => {
    const p = proj(pt.longitude, pt.latitude);
    const cands = (grid.get(`${Math.floor(p[0] / CELL)}:${Math.floor(p[1] / CELL)}`) ?? [])
      .map((idx) => ({ idx, ...project(p, prepared[idx]) }))
      .filter((c) => c.d <= rules.maxDistanceM)
      .sort((a, b) => a.d - b.d);
    if (!cands.length) return null;
    const [best, second] = cands;
    if (second && second.d - best.d < rules.ambiguityM && !nearJunction(p, prepared[best.idx], prepared[second.idx])) return null;
    return { idx: best.idx, s: best.s };
  });

  const intervals = new Map<number, [number, number][]>();
  for (let i = 1; i < track.length; i++) {
    const a = snaps[i - 1];
    const b = snaps[i];
    if (!a || !b || a.idx !== b.idx || track[i].segment !== track[i - 1].segment) continue;
    const walked = metersBetween(track[i - 1], track[i]);
    const dt = (track[i].capturedAt - track[i - 1].capturedAt) / 1000;
    if (dt <= 0 || walked / dt > GPS_RULES.maxSpeedMps || walked > GPS_RULES.maxGapM) continue;
    if (Math.abs(b.s - a.s) > walked + rules.slackM) continue;
    intervals.set(a.idx, [...(intervals.get(a.idx) ?? []), [a.s, b.s]]);
  }

  for (const [idx, ivs] of intervals) {
    const e = prepared[idx];
    const coveredM = Math.min(e.total, coveredLength(ivs));
    result.set(e.edge.id, { ...result.get(e.edge.id)!, coveredM, share: coveredM / e.total });
  }
  return result;
};

export const capturable = (c: Coverage | undefined, rules: RoadRules = ROAD_RULES) => Boolean(c && c.share >= rules.captureShare);

export type CaptureCheck = { ok: true } | { ok: false; reason: "already_yours" | "cooldown" };

/** A road can be taken from the other team, but not in the first two minutes after it changed hands. */
export const canCapture = (owner: { team: Team; capturedAt: string } | null, team: Team, now: number, rules: RoadRules = ROAD_RULES): CaptureCheck => {
  if (!owner) return { ok: true };
  if (owner.team === team) return { ok: false, reason: "already_yours" };
  if (now - Date.parse(owner.capturedAt) < rules.cooldownS * 1000) return { ok: false, reason: "cooldown" };
  return { ok: true };
};

// ---------- Road score ----------

export const ROAD_SCORE = { metersPerPoint: 10, bonusShare: 0.2, bonusMinEdges: 3 } as const;

export type RoadScore = { lengthM: number; base: number; largestM: number; largestEdges: number; components: number; bonus: number; total: number };

/**
 * One point per 10 m of road a team owns, plus 20% of the points in its largest connected network when that network
 * has at least three roads. Recomputed from current ownership every time, so a bonus disappears with its roads.
 */
export const roadScore = (owned: readonly { id: string; startNodeId: string; endNodeId: string; lengthM: number }[]): RoadScore => {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    let c = x;
    while (parent.get(c) !== r) {
      const n = parent.get(c)!;
      parent.set(c, r);
      c = n;
    }
    return r;
  };
  for (const e of owned) {
    for (const n of [e.startNodeId, e.endNodeId]) if (!parent.has(n)) parent.set(n, n);
    const a = find(e.startNodeId);
    const b = find(e.endNodeId);
    if (a !== b) parent.set(a < b ? b : a, a < b ? a : b);
  }
  const comps = new Map<string, { m: number; n: number }>();
  for (const e of owned) {
    const root = find(e.startNodeId);
    const c = comps.get(root) ?? { m: 0, n: 0 };
    comps.set(root, { m: c.m + e.lengthM, n: c.n + 1 });
  }
  const lengthM = owned.reduce((s, e) => s + e.lengthM, 0);
  const largest = [...comps.values()].sort((a, b) => b.m - a.m || b.n - a.n)[0] ?? { m: 0, n: 0 };
  const base = lengthM / ROAD_SCORE.metersPerPoint;
  const bonus = largest.n >= ROAD_SCORE.bonusMinEdges ? (largest.m / ROAD_SCORE.metersPerPoint) * ROAD_SCORE.bonusShare : 0;
  return { lengthM, base, largestM: largest.m, largestEdges: largest.n, components: comps.size, bonus, total: base + bonus };
};

/** Scores are kept at full precision and shown to one decimal. */
export const showPoints = (p: number) => Math.round(p * 10) / 10;

// ---------- Importing a road graph ----------

export type ImportNode = { key: string; latitude: number; longitude: number };
/** Pedestrian tags carried from the source file (OpenStreetMap-style values), or null when the file had none. */
export type RoadTags = { access: string | null; foot: string | null; pathType: string | null };
export type ImportEdge = { startKey: string; endKey: string; coords: [number, number][]; lengthM: number; name: string | null } & Partial<RoadTags>;

/** Builds nodes and edges from GeoJSON LineStrings, joining ends that lie within `snapM` metres of each other. */
export const buildGraph = (lines: readonly ({ coords: [number, number][]; name?: string | null } & Partial<RoadTags>)[], snapM = 3) => {
  const nodes: ImportNode[] = [];
  const nodeFor = (lng: number, lat: number) => {
    const near = nodes.find((n) => metersBetween(n, { latitude: lat, longitude: lng }) <= snapM);
    if (near) return near.key;
    const key = `n${nodes.length + 1}`;
    nodes.push({ key, latitude: lat, longitude: lng });
    return key;
  };
  const edges: ImportEdge[] = [];
  for (const l of lines) {
    if (l.coords.length < 2) continue;
    let len = 0;
    for (let i = 1; i < l.coords.length; i++) {
      len += metersBetween({ latitude: l.coords[i - 1][1], longitude: l.coords[i - 1][0] }, { latitude: l.coords[i][1], longitude: l.coords[i][0] });
    }
    const [sLng, sLat] = l.coords[0];
    const [eLng, eLat] = l.coords[l.coords.length - 1];
    const tags = l.access || l.foot || l.pathType ? { access: l.access ?? null, foot: l.foot ?? null, pathType: l.pathType ?? null } : {};
    edges.push({ startKey: nodeFor(sLng, sLat), endKey: nodeFor(eLng, eLat), coords: l.coords, lengthM: len, name: l.name ?? null, ...tags });
  }
  return { nodes, edges };
};

export type GraphCheck = { components: number; isolated: number[]; tooShort: number[]; tooLong: number[]; loops: number[] };

/** What an organizer must look at before publishing: disconnected pieces, lone roads, odd lengths, roads that loop onto themselves. */
export const checkGraph = (edges: readonly { startKey: string; endKey: string; lengthM: number }[]): GraphCheck => {
  const score = roadScore(edges.map((e, i) => ({ id: String(i), startNodeId: e.startKey, endNodeId: e.endKey, lengthM: e.lengthM })));
  const degree = new Map<string, number>();
  edges.forEach((e) => [e.startKey, e.endKey].forEach((k) => degree.set(k, (degree.get(k) ?? 0) + 1)));
  return {
    components: score.components,
    isolated: edges.map((e, i) => ((degree.get(e.startKey) ?? 0) <= 1 && (degree.get(e.endKey) ?? 0) <= 1 ? i : -1)).filter((i) => i >= 0),
    tooShort: edges.map((e, i) => (e.lengthM < 10 ? i : -1)).filter((i) => i >= 0),
    tooLong: edges.map((e, i) => (e.lengthM > 1500 ? i : -1)).filter((i) => i >= 0),
    loops: edges.map((e, i) => (e.startKey === e.endKey ? i : -1)).filter((i) => i >= 0),
  };
};
