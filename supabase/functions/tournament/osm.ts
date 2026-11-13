import { metersBetween } from "./geo.ts";
import type { PedEdge, PedGraph, PedNode } from "./routes.ts";

/**
 * Real pedestrian networks from OpenStreetMap, for areas PAWS organizers haven't prepared themselves.
 *
 * OpenStreetMap data is © OpenStreetMap contributors, available under the Open Database Licence (ODbL). Every
 * screen that shows a route built from it credits the source.
 *
 * What makes an edge walkable here ("osm-walk-v1"), strictly, from the way's own tags:
 *   - Paths built for walking: footway (sidewalks and crossings included), path, pedestrian, living_street, steps.
 *   - Quiet streets people walk along: residential, unclassified, service (not driveways, parking aisles or
 *     drive-throughs). Warned when no sidewalk is mapped.
 *   - Busier roads only with a mapped sidewalk or explicit foot access. Never motorways or trunk roads.
 *   - Cycleways, bridleways and tracks only with explicit foot access.
 *   - Never: private or no access (unless foot access is explicitly allowed), foot=no, informal or hard-to-see
 *     trails, mountain hiking grades, areas, indoor corridors, fords, construction.
 * Edges join only where OpenStreetMap ways share a node: no straight lines are ever drawn between streets.
 * Locked or private gates, walls, fences and fords on a way cut it there.
 * A piece of path that crosses a building outline (other than a mapped passage), a railway away from a mapped
 * crossing, or water without a bridge is dropped: those are mapping errors or places nobody should walk.
 *
 * Pure: the edge function fetches the data (overpassQuery) and passes the JSON in. Tests use stored extracts.
 */

export const OSM_WALK_VERSION = "osm-walk-v1";
export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const OSM_LICENSE = "ODbL 1.0";

export type OsmElement =
  | { type: "node"; id: number; lat: number; lon: number; tags?: Record<string, string> }
  | { type: "way"; id: number; nodes: number[]; tags?: Record<string, string> };
export type OsmData = { elements: OsmElement[] };

export type EdgeWarning = "no_sidewalk_mapped" | "no_sidewalk" | "steps" | "unpaved" | "unmarked_crossing" | "rail_crossing" | "busy_road";

export type OsmEdge = PedEdge & { wayId: number; name: string | null; warnings: EdgeWarning[] };

export type OsmDrop = "barrier" | "building" | "railway" | "water";

const WALK_PATHS = new Set(["footway", "path", "pedestrian", "living_street", "steps"]);
const QUIET_STREETS = new Set(["residential", "unclassified", "service"]);
const BUSY_ROADS = new Set(["tertiary", "tertiary_link", "secondary", "secondary_link", "primary", "primary_link"]);
const FOOT_ONLY = new Set(["cycleway", "bridleway", "track"]);
const NEVER = new Set(["motorway", "motorway_link", "trunk", "trunk_link", "construction", "proposed", "raceway", "bus_guideway", "busway", "corridor", "elevator", "platform", "escape"]);
const FOOT_YES = new Set(["yes", "designated", "permissive"]);
const CLOSED_ACCESS = new Set(["private", "no", "customers", "delivery", "agricultural", "forestry", "military", "restricted", "permit"]);
const BLOCKING_BARRIERS = new Set(["wall", "fence", "hedge", "retaining_wall", "city_wall", "ditch", "guard_rail", "border_control"]);
const GATES = new Set(["gate", "lift_gate", "swing_gate", "sliding_gate", "turnstile", "full-height_turnstile", "kissing_gate", "wicket_gate"]);
const SIDEWALK = new Set(["both", "left", "right", "yes"]);
const UNPAVED = new Set(["unpaved", "gravel", "dirt", "earth", "ground", "grass", "mud", "sand", "fine_gravel", "compacted", "woodchips"]);
const HIKING_OK = new Set(["hiking"]);

export const RAILWAYS = ["rail", "light_rail", "narrow_gauge", "subway", "monorail", "funicular", "preserved"];
export const WATERWAYS = ["river", "canal", "stream", "drain", "ditch"];

/** The Overpass request: walkable ways plus the railways, water and buildings they must not cut through. */
export const overpassQuery = (lat: number, lng: number, radiusM: number) => {
  const r = Math.round(radiusM);
  const around = `(around:${r},${lat.toFixed(6)},${lng.toFixed(6)})`;
  const highways = [...WALK_PATHS, ...QUIET_STREETS, ...BUSY_ROADS, ...FOOT_ONLY].join("|");
  return [
    "[out:json][timeout:50][maxsize:200000000];",
    "(",
    `  way${around}[highway~"^(${highways})$"];`,
    `  way${around}[railway~"^(${RAILWAYS.join("|")})$"];`,
    `  way${around}[waterway~"^(${WATERWAYS.join("|")})$"];`,
    `  way${around}[natural=water];`,
    `  way${around}[building];`,
    ");",
    "(._;>;);",
    "out body qt;",
  ].join("\n");
};

/** How far to look around the start for a walk of this many minutes. A shape's corners rarely reach farther. */
export const searchRadiusM = (minutes: number, walkMps = 1.1) => Math.min(1600, Math.round(minutes * 60 * walkMps * 0.42 + 150));

type Verdict = { ok: true; warnings: EdgeWarning[] } | { ok: false; reason: string };

/** Whether a way may be walked, and what a walker should know about it. Reads only the way's own tags. */
export const classifyWay = (tags: Record<string, string> = {}): Verdict => {
  const hw = tags.highway ?? "";
  const foot = tags.foot ?? "";
  const access = tags.access ?? "";
  if (!hw || NEVER.has(hw)) return { ok: false, reason: "not_for_walking" };
  if (tags.area === "yes") return { ok: false, reason: "area" };
  if (tags.indoor === "yes" || tags.indoor === "corridor") return { ok: false, reason: "indoor" };
  if (tags.ford === "yes" || tags.ford === "stepping_stones") return { ok: false, reason: "ford" };
  if (["no", "private", "use_sidepath", "discouraged"].includes(foot)) return { ok: false, reason: "no_foot" };
  if (CLOSED_ACCESS.has(access) && !FOOT_YES.has(foot)) return { ok: false, reason: "private" };
  if (tags.informal === "yes" || ["bad", "horrible", "no"].includes(tags.trail_visibility ?? "")) return { ok: false, reason: "informal" };
  if (tags.sac_scale && !HIKING_OK.has(tags.sac_scale)) return { ok: false, reason: "mountain_trail" };
  if (tags.disused === "yes" || tags.abandoned === "yes") return { ok: false, reason: "disused" };
  if (hw === "service" && ["driveway", "parking_aisle", "drive-through", "emergency_access"].includes(tags.service ?? "")) return { ok: false, reason: "service_lane" };

  const warnings: EdgeWarning[] = [];
  const sidewalk = [tags.sidewalk, tags["sidewalk:both"], tags["sidewalk:left"], tags["sidewalk:right"]].filter(Boolean) as string[];
  const hasSidewalk = sidewalk.some((s) => SIDEWALK.has(s));
  const noSidewalk = sidewalk.length > 0 && sidewalk.every((s) => s === "no" || s === "none");

  if (WALK_PATHS.has(hw)) {
    if (hw === "steps") warnings.push("steps");
    if (tags.footway === "crossing" && ["unmarked", "no"].includes(tags.crossing ?? "")) warnings.push("unmarked_crossing");
  } else if (QUIET_STREETS.has(hw)) {
    if (tags.sidewalk === "separate" || tags["sidewalk:both"] === "separate") return { ok: false, reason: "sidewalk_mapped_separately" };
    if (noSidewalk) warnings.push("no_sidewalk");
    else if (!hasSidewalk) warnings.push("no_sidewalk_mapped");
  } else if (BUSY_ROADS.has(hw)) {
    // A busy road is walked only where a sidewalk is part of it or foot access is explicit. A separately mapped
    // sidewalk is its own footway and is walked instead.
    if (!(hasSidewalk || FOOT_YES.has(foot))) return { ok: false, reason: "busy_road_no_sidewalk" };
    warnings.push("busy_road");
  } else if (FOOT_ONLY.has(hw)) {
    if (!FOOT_YES.has(foot)) return { ok: false, reason: "no_foot_access" };
  } else {
    return { ok: false, reason: "not_for_walking" };
  }
  if (UNPAVED.has(tags.surface ?? "")) warnings.push("unpaved");
  return { ok: true, warnings };
};

/** A node that stops walkers: a closed gate, a wall or fence where a way meets it, a ford. */
export const isBlockingNode = (tags: Record<string, string> = {}) => {
  const barrier = tags.barrier ?? "";
  if (BLOCKING_BARRIERS.has(barrier)) return !FOOT_YES.has(tags.foot ?? "");
  if (GATES.has(barrier)) return CLOSED_ACCESS.has(tags.access ?? "") && !FOOT_YES.has(tags.foot ?? "") || tags.locked === "yes" || ["no", "private"].includes(tags.foot ?? "");
  if (tags.ford === "yes") return true;
  return CLOSED_ACCESS.has(tags.access ?? "") && !FOOT_YES.has(tags.foot ?? "") || ["no", "private"].includes(tags.foot ?? "");
};

// ---------- Geometry ----------

type XY = [number, number];
type Seg = { a: XY; b: XY; bbox: [number, number, number, number] };

const project = (origin: { lat: number; lon: number }) => {
  const k = Math.cos((origin.lat * Math.PI) / 180);
  return (lat: number, lon: number): XY => [(lon - origin.lon) * 111_320 * k, (lat - origin.lat) * 110_540];
};

const orient = (p: XY, q: XY, r: XY) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);

/** Where two segments properly cross, or null. Touching or sharing an end is not a crossing (a path to a door). */
export const crossing = (p1: XY, p2: XY, q1: XY, q2: XY): XY | null => {
  const d1 = orient(q1, q2, p1);
  const d2 = orient(q1, q2, p2);
  const d3 = orient(p1, p2, q1);
  const d4 = orient(p1, p2, q2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    const t = d1 / (d1 - d2);
    return [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t];
  }
  return null;
};

/** A coarse grid of barrier segments, so each path piece only tests the barriers near it. */
class SegIndex {
  private cells = new Map<string, Seg[]>();
  constructor(private size = 60) {}
  private keys(b: [number, number, number, number]) {
    const out: string[] = [];
    for (let x = Math.floor(b[0] / this.size); x <= Math.floor(b[2] / this.size); x++)
      for (let y = Math.floor(b[1] / this.size); y <= Math.floor(b[3] / this.size); y++) out.push(`${x}:${y}`);
    return out;
  }
  add(a: XY, b: XY) {
    const seg: Seg = { a, b, bbox: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])] };
    for (const k of this.keys(seg.bbox)) {
      const list = this.cells.get(k) ?? [];
      list.push(seg);
      this.cells.set(k, list);
    }
  }
  /** Every point where segment a-b crosses an indexed segment. */
  hits(a: XY, b: XY): XY[] {
    const box: [number, number, number, number] = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    const seen = new Set<Seg>();
    const out: XY[] = [];
    for (const k of this.keys(box)) {
      for (const s of this.cells.get(k) ?? []) {
        if (seen.has(s)) continue;
        seen.add(s);
        if (s.bbox[0] > box[2] || s.bbox[2] < box[0] || s.bbox[1] > box[3] || s.bbox[3] < box[1]) continue;
        const x = crossing(a, b, s.a, s.b);
        if (x) out.push(x);
      }
    }
    return out;
  }
}

// ---------- Graph ----------

export type OsmGraph = Omit<PedGraph, "edges"> & {
  edges: readonly OsmEdge[];
  version: string;
  /** What was left out and why, for the record and the tests. */
  dropped: Record<OsmDrop, number>;
  rejectedWays: number;
};

/**
 * OpenStreetMap JSON to a pedestrian graph. Ways are split at every node they share with another walkable way
 * (junctions) and at blocking nodes; pieces touching a blocking node are dropped. Edge ids are stable:
 * `osm:w<way id>:<first node id>-<last node id>`.
 */
export const osmToGraph = (data: OsmData, origin: { latitude: number; longitude: number }): OsmGraph => {
  const nodes = new Map<number, { lat: number; lon: number; tags?: Record<string, string> }>();
  const ways: Extract<OsmElement, { type: "way" }>[] = [];
  for (const el of data.elements ?? []) {
    if (el.type === "node") nodes.set(el.id, { lat: el.lat, lon: el.lon, tags: el.tags });
    else if (el.type === "way" && Array.isArray(el.nodes)) ways.push(el);
  }
  const xy = project({ lat: origin.latitude, lon: origin.longitude });
  const at = (id: number): XY | null => {
    const n = nodes.get(id);
    return n ? xy(n.lat, n.lon) : null;
  };

  // Barriers walkers must not cut through.
  const rail = new SegIndex();
  const water = new SegIndex();
  const building = new SegIndex();
  const addLine = (idx: SegIndex, w: Extract<OsmElement, { type: "way" }>) => {
    for (let i = 1; i < w.nodes.length; i++) {
      const a = at(w.nodes[i - 1]);
      const b = at(w.nodes[i]);
      if (a && b) idx.add(a, b);
    }
  };
  const walk: { way: Extract<OsmElement, { type: "way" }>; warnings: EdgeWarning[] }[] = [];
  let rejectedWays = 0;
  for (const w of ways) {
    const t = w.tags ?? {};
    const raised = t.bridge && t.bridge !== "no";
    const sunk = t.tunnel && t.tunnel !== "no";
    if (t.railway && RAILWAYS.includes(t.railway)) {
      if (!raised && !sunk) addLine(rail, w);
      continue;
    }
    if ((t.waterway && WATERWAYS.includes(t.waterway)) || t.natural === "water") {
      if (!sunk) addLine(water, w); // culverts run under the path
      continue;
    }
    if (t.building && !t.highway) {
      if (t.building !== "roof") addLine(building, w); // a roof over a path is not a wall
      continue;
    }
    if (!t.highway) continue;
    const v = classifyWay(t);
    if (v.ok) walk.push({ way: w, warnings: v.warnings });
    else rejectedWays++;
  }

  // Junctions: nodes on two or more walkable ways, plus every way's ends. Blocking nodes cut a way.
  const uses = new Map<number, number>();
  for (const { way } of walk) for (const id of new Set(way.nodes)) uses.set(id, (uses.get(id) ?? 0) + 1);
  const blocked = (id: number) => isBlockingNode(nodes.get(id)?.tags);

  const edges: OsmEdge[] = [];
  const used = new Map<string, PedNode>();
  const dropped: Record<OsmDrop, number> = { barrier: 0, building: 0, railway: 0, water: 0 };
  const railCrossingNear = (ids: number[], p: XY) =>
    ids.some((id) => {
      const n = nodes.get(id);
      const q = at(id);
      return Boolean(n && q && ["crossing", "level_crossing"].includes(n.tags?.railway ?? "") && Math.hypot(q[0] - p[0], q[1] - p[1]) < 4);
    });

  for (const { way, warnings } of walk) {
    const t = way.tags ?? {};
    const raised = Boolean(t.bridge && t.bridge !== "no");
    const sunk = Boolean(t.tunnel && t.tunnel !== "no");
    const passage = t.tunnel === "building_passage" || t.covered === "yes" || t.covered === "arcade" || t.indoor === "area";
    const ids = way.nodes.filter((id) => nodes.has(id));
    // A closed way (a ring path round a pond) is cut halfway too, so it never becomes a piece that starts and ends
    // at the same node.
    const half = ids.length > 3 && ids[0] === ids[ids.length - 1] ? Math.floor(ids.length / 2) : -1;
    let from = 0;
    for (let i = 1; i < ids.length; i++) {
      const id = ids[i];
      const cut = i === ids.length - 1 || i === half || (uses.get(id) ?? 0) > 1 || blocked(id);
      if (!cut) continue;
      const pieceIds = ids.slice(from, i + 1);
      from = i;
      if (pieceIds.length < 2 || pieceIds[0] === pieceIds[pieceIds.length - 1]) continue;
      if (blocked(pieceIds[0]) || blocked(pieceIds[pieceIds.length - 1]) || pieceIds.slice(1, -1).some(blocked)) {
        dropped.barrier++;
        continue;
      }
      // The piece must not cut through anything.
      let bad: OsmDrop | null = null;
      const pieceWarnings = new Set<EdgeWarning>(warnings);
      for (let k = 1; k < pieceIds.length && !bad; k++) {
        const a = at(pieceIds[k - 1])!;
        const b = at(pieceIds[k])!;
        if (!raised && !sunk && water.hits(a, b).length) bad = "water";
        if (!bad && !raised && !sunk) {
          for (const p of rail.hits(a, b)) {
            if (railCrossingNear(pieceIds, p)) pieceWarnings.add("rail_crossing");
            else bad = "railway";
          }
        }
        if (!bad && !passage && !sunk && building.hits(a, b).length) bad = "building";
      }
      for (const id of pieceIds) if (["crossing", "level_crossing"].includes(nodes.get(id)?.tags?.railway ?? "")) pieceWarnings.add("rail_crossing");
      if (bad) {
        dropped[bad]++;
        continue;
      }
      const coords = pieceIds.map((nid) => {
        const n = nodes.get(nid)!;
        return [n.lon, n.lat] as [number, number];
      });
      let lengthM = 0;
      for (let k = 1; k < coords.length; k++) lengthM += metersBetween({ latitude: coords[k - 1][1], longitude: coords[k - 1][0] }, { latitude: coords[k][1], longitude: coords[k][0] });
      const first = pieceIds[0];
      const last = pieceIds[pieceIds.length - 1];
      const a = `osm:n${first}`;
      const b = `osm:n${last}`;
      used.set(a, { id: a, latitude: nodes.get(first)!.lat, longitude: nodes.get(first)!.lon });
      used.set(b, { id: b, latitude: nodes.get(last)!.lat, longitude: nodes.get(last)!.lon });
      edges.push({
        id: `osm:w${way.id}:${first}-${last}`,
        a,
        b,
        coords,
        lengthM,
        walkable: true,
        access: t.access ?? null,
        foot: t.foot ?? null,
        pathType: t.footway === "sidewalk" ? "sidewalk" : t.highway,
        wayId: way.id,
        name: t.name ?? null,
        warnings: [...pieceWarnings],
      });
    }
  }
  // Duplicate pieces (the same way listed twice) are kept once.
  const unique = [...new Map(edges.map((e) => [e.id, e])).values()];
  return { nodes: [...used.values()], edges: unique, version: OSM_WALK_VERSION, dropped, rejectedWays };
};

/** What a route's warnings mean to a walker, most important first. */
export const WARNING_ORDER: readonly EdgeWarning[] = ["busy_road", "rail_crossing", "no_sidewalk", "unmarked_crossing", "no_sidewalk_mapped", "steps", "unpaved"];

/** The warnings that apply to a route, from its edges, in order of importance. */
export const routeWarnings = (edgeIds: readonly string[], byId: Map<string, { warnings?: readonly EdgeWarning[] }>) => {
  const found = new Set<EdgeWarning>();
  for (const id of edgeIds) for (const w of byId.get(id)?.warnings ?? []) found.add(w);
  return WARNING_ORDER.filter((w) => found.has(w));
};
