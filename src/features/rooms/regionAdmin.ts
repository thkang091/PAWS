/**
 * Road area admin, as pure functions: GeoJSON import validation, review progress, what blocks publishing, and which
 * road a tap lands on. The screens draw what these return; the server re-checks everything that matters.
 */
import { buildGraph, checkGraph, type ImportEdge, type ImportNode } from "../../../supabase/functions/rooms/battle";
import { metersBetween } from "../../../supabase/functions/tournament/geo";

type LngLat = [number, number];
type LatLng = { latitude: number; longitude: number };

export const IMPORT_LIMITS = {
  /** Larger files are almost always a whole city; split them into areas people can actually walk. */
  maxBytes: 2_000_000,
  /** Matches import_road_graph on the server. */
  maxRoads: 2000,
  /** Corner to corner. Beyond this an area stops being a neighbourhood. */
  maxSpanM: 6000,
} as const;

export type ImportErrorCode =
  | "too_large"
  | "not_json"
  | "not_feature_collection"
  | "unsupported_crs"
  | "no_roads"
  | "bad_coordinates"
  | "too_few_points"
  | "closed_road"
  | "duplicate_road"
  | "too_many_roads"
  | "too_spread_out";

export type ImportWarningCode = "skipped_features" | "short_roads" | "long_roads" | "isolated_roads" | "disconnected" | "prohibited_roads";

/** `features` are 1-based feature numbers in the file, so organizers can find them in their editor. */
export type ImportIssue<C extends string> = { code: C; features: number[] };

export type ImportStats = { features: number; roads: number; junctions: number; lengthM: number; pieces: number };

export type ImportResult = {
  ok: boolean;
  errors: ImportIssue<ImportErrorCode>[];
  warnings: ImportIssue<ImportWarningCode>[];
  nodes: ImportNode[];
  edges: ImportEdge[];
  stats: ImportStats;
  /** Convex outline around every road, [lng, lat] ring, closed. Empty when there is nothing to outline. */
  outline: LngLat[];
  center: LatLng | null;
};

const EMPTY_STATS: ImportStats = { features: 0, roads: 0, junctions: 0, lengthM: 0, pieces: 0 };

const fail = (code: ImportErrorCode, features: number[] = []): ImportResult => ({
  ok: false,
  errors: [{ code, features }],
  warnings: [],
  nodes: [],
  edges: [],
  stats: EMPTY_STATS,
  outline: [],
  center: null,
});

/** CRS84 and EPSG:4326 are both plain longitude, latitude; anything else needs reprojecting before import. */
const acceptsCrs = (crs: unknown) => {
  if (crs == null) return true;
  const name = (crs as { properties?: { name?: unknown } })?.properties?.name;
  return typeof name === "string" && /(CRS84|EPSG:+4326|EPSG::4326)$/i.test(name.trim());
};

const isPosition = (p: unknown): p is number[] =>
  Array.isArray(p) && p.length >= 2 && p.every((v) => typeof v === "number") && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90;

/** Drops repeated consecutive positions and any altitude. */
const tidy = (line: number[][]): LngLat[] => {
  const out: LngLat[] = [];
  for (const p of line) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push([p[0], p[1]]);
  }
  return out;
};

const geometryKey = (coords: readonly LngLat[]) => coords.map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`).join(";");

const tag = (props: Record<string, unknown>, key: string) => {
  const v = props[key];
  return typeof v === "string" && v.trim() ? v.trim().toLowerCase().slice(0, 40) : null;
};

/**
 * Pedestrian tags from OpenStreetMap-style properties. A sidewalk drawn as footway=sidewalk keeps that meaning.
 * Missing tags stay null: unknown, never assumed public.
 */
export const tagsOf = (props: unknown) => {
  const p = (props ?? {}) as Record<string, unknown>;
  const highway = tag(p, "highway");
  const footway = tag(p, "footway");
  return { access: tag(p, "access"), foot: tag(p, "foot"), pathType: highway === "footway" && footway === "sidewalk" ? "sidewalk" : highway };
};

const PROHIBITED_TAGS = new Set(["private", "no", "restricted", "customers", "delivery", "agricultural", "forestry", "military"]);
const PROHIBITED_TYPES = new Set(["motorway", "motorway_link", "trunk", "trunk_link", "construction", "proposed", "abandoned", "raceway", "bus_guideway", "busway", "escape"]);
export const prohibitedTags = (t: { access: string | null; foot: string | null; pathType: string | null }) =>
  PROHIBITED_TAGS.has(t.access ?? "") || PROHIBITED_TAGS.has(t.foot ?? "") || PROHIBITED_TYPES.has(t.pathType ?? "");

const nameOf = (props: unknown) => {
  const p = (props ?? {}) as Record<string, unknown>;
  const raw = [p.name, p.ref, p.title].find((v) => typeof v === "string" && v.trim());
  return typeof raw === "string" ? raw.trim().slice(0, 80) : null;
};

/** Andrew's monotone chain, closed. Enough to show organizers the area their roads cover. */
export const convexHull = (points: readonly LngLat[]): LngLat[] => {
  const pts = [...new Map(points.map((p) => [`${p[0]},${p[1]}`, p])).values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return [];
  const cross = (o: LngLat, a: LngLat, b: LngLat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: LngLat[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: LngLat[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  return hull.length >= 3 ? [...hull, hull[0]] : [];
};

/**
 * Reads a GeoJSON FeatureCollection of roads. LineStrings become roads, each part of a MultiLineString becomes its
 * own road, and anything else is skipped with a warning. Errors stop the import; warnings are for the organizer to
 * look at while reviewing. Nothing here decides a road is safe: every road imports as pending.
 */
export const parseRoadGeoJson = (input: string, bytes: number = input.length): ImportResult => {
  if (bytes > IMPORT_LIMITS.maxBytes) return fail("too_large");
  let doc: unknown;
  try {
    doc = JSON.parse(input);
  } catch {
    return fail("not_json");
  }
  const fc = doc as { type?: unknown; features?: unknown; crs?: unknown };
  if (!fc || typeof fc !== "object" || fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) return fail("not_feature_collection");
  if (!acceptsCrs(fc.crs)) return fail("unsupported_crs");

  const bad: number[] = [];
  const tooFew: number[] = [];
  const closed: number[] = [];
  const duplicate: number[] = [];
  const skipped: number[] = [];
  const seen = new Set<string>();
  const lines: { coords: LngLat[]; name: string | null; feature: number; access: string | null; foot: string | null; pathType: string | null }[] = [];

  (fc.features as unknown[]).forEach((f, i) => {
    const n = i + 1;
    const geometry = (f as { geometry?: { type?: unknown; coordinates?: unknown } } | null)?.geometry;
    const parts =
      geometry?.type === "LineString" ? [geometry.coordinates] : geometry?.type === "MultiLineString" && Array.isArray(geometry.coordinates) ? (geometry.coordinates as unknown[]) : null;
    if (!parts) {
      skipped.push(n);
      return;
    }
    for (const part of parts) {
      if (!Array.isArray(part) || !part.every(isPosition)) {
        if (!bad.includes(n)) bad.push(n);
        continue;
      }
      const coords = tidy(part as number[][]);
      if (coords.length < 2) {
        if (!tooFew.includes(n)) tooFew.push(n);
        continue;
      }
      const [s, e] = [coords[0], coords[coords.length - 1]];
      if (metersBetween({ latitude: s[1], longitude: s[0] }, { latitude: e[1], longitude: e[0] }) < 1) {
        if (!closed.includes(n)) closed.push(n);
        continue;
      }
      const k = geometryKey(coords);
      const reverse = geometryKey([...coords].reverse());
      if (seen.has(k) || seen.has(reverse)) {
        if (!duplicate.includes(n)) duplicate.push(n);
        continue;
      }
      seen.add(k);
      lines.push({ coords, name: nameOf((f as { properties?: unknown }).properties), feature: n, ...tagsOf((f as { properties?: unknown }).properties) });
    }
  });

  const errors: ImportIssue<ImportErrorCode>[] = [];
  if (bad.length) errors.push({ code: "bad_coordinates", features: bad });
  if (tooFew.length) errors.push({ code: "too_few_points", features: tooFew });
  if (closed.length) errors.push({ code: "closed_road", features: closed });
  if (duplicate.length) errors.push({ code: "duplicate_road", features: duplicate });
  if (!lines.length && !errors.length) errors.push({ code: "no_roads", features: [] });
  if (lines.length > IMPORT_LIMITS.maxRoads) errors.push({ code: "too_many_roads", features: [] });

  const all = lines.flatMap((l) => l.coords);
  let span = 0;
  if (all.length) {
    const lngs = all.map((p) => p[0]);
    const lats = all.map((p) => p[1]);
    span = metersBetween({ latitude: Math.min(...lats), longitude: Math.min(...lngs) }, { latitude: Math.max(...lats), longitude: Math.max(...lngs) });
    if (span > IMPORT_LIMITS.maxSpanM) errors.push({ code: "too_spread_out", features: [] });
  }

  const { nodes, edges } = buildGraph(lines);
  const graph = checkGraph(edges);
  const featureOf = (indexes: number[]) => indexes.map((i) => lines[i].feature);
  const warnings: ImportIssue<ImportWarningCode>[] = [];
  if (skipped.length) warnings.push({ code: "skipped_features", features: skipped });
  if (graph.tooShort.length) warnings.push({ code: "short_roads", features: featureOf(graph.tooShort) });
  if (graph.tooLong.length) warnings.push({ code: "long_roads", features: featureOf(graph.tooLong) });
  if (edges.length > 1 && graph.isolated.length) warnings.push({ code: "isolated_roads", features: featureOf(graph.isolated) });
  if (graph.components > 1) warnings.push({ code: "disconnected", features: [] });
  const prohibited = lines.filter((l) => prohibitedTags(l)).map((l) => l.feature);
  if (prohibited.length) warnings.push({ code: "prohibited_roads", features: [...new Set(prohibited)] });

  const outline = convexHull(all);
  const center = all.length
    ? { latitude: (Math.min(...all.map((p) => p[1])) + Math.max(...all.map((p) => p[1]))) / 2, longitude: (Math.min(...all.map((p) => p[0])) + Math.max(...all.map((p) => p[0]))) / 2 }
    : null;

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    nodes,
    edges,
    stats: { features: (fc.features as unknown[]).length, roads: edges.length, junctions: nodes.length, lengthM: edges.reduce((s, e) => s + e.lengthM, 0), pieces: graph.components },
    outline,
    center,
  };
};

// ---------------------------------------------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------------------------------------------

export type RoadStatus = "pending" | "verified" | "unsafe" | "disabled";
export type RegionStatus = "draft" | "published" | "disabled";
/** What the list shows. "In review" is a draft with at least one road looked at; the server stores only draft. */
export type RegionStage = "draft" | "in_review" | "published" | "disabled";

export type ReviewRoad = { id: string; status: RoadStatus; startNodeId: string; endNodeId: string; coords: readonly (readonly [number, number])[]; lengthM: number };

export type ReviewCounts = { total: number; reviewed: number; pending: number; verified: number; unsafe: number; disabled: number };

export const reviewCounts = (roads: readonly { status: RoadStatus }[]): ReviewCounts => {
  const c = { total: roads.length, reviewed: 0, pending: 0, verified: 0, unsafe: 0, disabled: 0 };
  for (const r of roads) c[r.status] += 1;
  c.reviewed = c.total - c.pending;
  return c;
};

export const regionStage = (status: RegionStatus, counts: Pick<ReviewCounts, "reviewed">): RegionStage =>
  status === "draft" ? (counts.reviewed > 0 ? "in_review" : "draft") : status;

export const STAGES: readonly RegionStage[] = ["draft", "in_review", "published", "disabled"];

/** Matches publish_competition_region: at least this many verified roads. */
export const MIN_VERIFIED_ROADS = 3;

export type PublishCheck = "organizer" | "draft" | "source" | "license" | "reviewed" | "verified" | "no_duplicates" | "no_loops";

export type PublishItem = { check: PublishCheck; ok: boolean };

/** Verified roads that would break play: the same line twice, or a road that starts and ends at one junction. */
export const blockingGraphErrors = (roads: readonly ReviewRoad[]) => {
  const live = roads.filter((r) => r.status === "verified");
  const seen = new Map<string, string>();
  const duplicates: string[] = [];
  for (const r of live) {
    const coords = r.coords.map(([x, y]) => [x, y] as LngLat);
    const k = geometryKey(coords);
    const reverse = geometryKey([...coords].reverse());
    if (seen.has(k) || seen.has(reverse)) duplicates.push(r.id);
    else seen.set(k, r.id);
  }
  const loops = live.filter((r) => r.startNodeId === r.endNodeId).map((r) => r.id);
  return { duplicates, loops };
};

/**
 * Every condition the server checks before a region goes live, in the order an organizer would fix them. The publish
 * button is enabled only when all pass, and the server still has the final word.
 */
export const publishChecklist = (input: { isOrganizer: boolean; status: RegionStatus; source: string; license: string; roads: readonly ReviewRoad[] }): PublishItem[] => {
  const counts = reviewCounts(input.roads);
  const graph = blockingGraphErrors(input.roads);
  return [
    { check: "organizer", ok: input.isOrganizer },
    { check: "draft", ok: input.status === "draft" },
    { check: "source", ok: input.source.trim().length > 0 },
    { check: "license", ok: input.license.trim().length > 0 },
    { check: "reviewed", ok: counts.total > 0 && counts.pending === 0 },
    { check: "verified", ok: counts.verified >= MIN_VERIFIED_ROADS },
    { check: "no_duplicates", ok: graph.duplicates.length === 0 },
    { check: "no_loops", ok: graph.loops.length === 0 },
  ];
};

export const canPublish = (items: readonly PublishItem[]) => items.every((i) => i.ok);

/** Whether review buttons work for this region. Only drafts change; the server enforces the same. */
export const canReview = (isOrganizer: boolean, status: RegionStatus) => isOrganizer && status === "draft";

/** The next road still waiting, after the one in hand, wrapping round. */
export const nextPending = (roads: readonly { id: string; status: RoadStatus }[], afterId: string | null) => {
  const start = afterId ? roads.findIndex((r) => r.id === afterId) : -1;
  for (let i = 1; i <= roads.length; i++) {
    const r = roads[(start + i + roads.length) % roads.length];
    if (r && r.status === "pending" && r.id !== afterId) return r.id;
  }
  return null;
};

const toPlane = (p: LatLng, origin: LatLng) => {
  const k = Math.cos((origin.latitude * Math.PI) / 180);
  return { x: (p.longitude - origin.longitude) * 111_320 * k, y: (p.latitude - origin.latitude) * 110_540 };
};

/** Metres from a point to a polyline, on a local flat plane (fine at street scale). */
export const distanceToLine = (point: LatLng, coords: readonly (readonly [number, number])[]) => {
  let best = Infinity;
  for (let i = 1; i < coords.length; i++) {
    const a = toPlane({ latitude: coords[i - 1][1], longitude: coords[i - 1][0] }, point);
    const b = toPlane({ latitude: coords[i][1], longitude: coords[i][0] }, point);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = dx * dx + dy * dy;
    const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len));
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
  }
  return best;
};

/** The road a map tap meant: the closest one within reach, or none. */
export const nearestRoad = <R extends { id: string; coords: readonly (readonly [number, number])[] }>(point: LatLng, roads: readonly R[], maxM = 30): R | null => {
  let pick: R | null = null;
  let best = maxM;
  for (const r of roads) {
    const d = distanceToLine(point, r.coords);
    if (d <= best) {
      best = d;
      pick = r;
    }
  }
  return pick;
};
