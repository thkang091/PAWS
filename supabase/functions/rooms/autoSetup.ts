import { metersBetween } from "../tournament/geo.ts";
import { isWalkable, type LatLng, type PedEdge, type PedGraph } from "../tournament/routes.ts";

/**
 * Setting a nearby game up from the real streets around the players, so a room can start without an organizer:
 *
 *   buildRoadArea      Steal Your Road's roads: the walkable streets in a circle, joined end to end between junctions.
 *   proposeMafiaRoute  Find the Mafia's checkpoints: real street corners at walking distance, branching for each role.
 *
 * Pure. The `rooms` edge function passes in the network (an organizer's area, or OpenStreetMap) and stores the result.
 * Nothing here invents geometry: every road and checkpoint is a street or corner of the network given.
 */

type Edge = PedEdge & { warnings?: readonly string[]; name?: string | null };
type Graph = { nodes: PedGraph["nodes"]; edges: readonly Edge[] };

/** Streets an organizer would mark unsafe for a game played on foot. They never become playable roads or links. */
const UNSAFE = new Set(["busy_road", "no_sidewalk", "rail_crossing"]);

export type AreaRules = { minRoads: number; maxRoads: number; minRoadM: number; maxRoadM: number };
export const AREA_RULES: AreaRules = {
  /** Fewer playable roads than this is not a game. */
  minRoads: 6,
  /** More than this is too many to draw, or to fight over in one match. */
  maxRoads: 140,
  /** A road shorter than this is captured by standing still. */
  minRoadM: 40,
  /** Junction to junction, but very long stretches are cut so one walk can still take them. */
  maxRoadM: 420,
};

/** How far the area reaches for a match length: about what a team can cover and come back from. */
export const areaRadiusM = (minutes: number) => Math.max(350, Math.min(650, Math.round(200 + minutes * 15)));

const usable = (e: Edge) => isWalkable(e) && !(e.warnings ?? []).some((w) => UNSAFE.has(w));
const pointOf = (c: readonly [number, number]): LatLng => ({ latitude: c[1], longitude: c[0] });

/** The usable part of the graph inside `radiusM` of `center`, reduced to the piece the center is connected to. */
const reachable = (graph: Graph, center: LatLng, radiusM: number) => {
  const byNode = new Map(graph.nodes.map((n) => [n.id, n]));
  const inside = graph.edges.filter((e) => usable(e) && e.coords.every((c) => metersBetween(pointOf(c), center) <= radiusM));
  const adj = new Map<string, Edge[]>();
  for (const e of inside) for (const n of [e.a, e.b]) (adj.get(n) ?? adj.set(n, []).get(n)!).push(e);
  let start: string | null = null;
  let best = Infinity;
  for (const id of adj.keys()) {
    const n = byNode.get(id);
    if (!n) continue;
    const d = metersBetween(n, center);
    if (d < best) [best, start] = [d, id];
  }
  if (!start) return null;
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const id = queue.pop()!;
    for (const e of adj.get(id) ?? []) {
      const o = e.a === id ? e.b : e.a;
      if (!seen.has(o)) {
        seen.add(o);
        queue.push(o);
      }
    }
  }
  const edges = inside.filter((e) => seen.has(e.a));
  const sub = new Map<string, Edge[]>();
  for (const e of edges) for (const n of [e.a, e.b]) (sub.get(n) ?? sub.set(n, []).get(n)!).push(e);
  return { edges, adj: sub, byNode, start, startM: best };
};

export type AreaRoad = { startKey: string; endKey: string; name: string | null; coords: [number, number][]; lengthM: number; pathType: string | null };
export type RoadArea = { nodes: { key: string; latitude: number; longitude: number }[]; roads: AreaRoad[] };

/**
 * Steal Your Road's roads around `center`. Streets are joined through corners where nothing else meets them, so a
 * road runs junction to junction like a street does, and short scraps are left out. Nearest roads first.
 */
export const buildRoadArea = (graph: Graph, center: LatLng, radiusM: number, rules = AREA_RULES): RoadArea | { error: "no_roads_here" } => {
  const piece = reachable(graph, center, radiusM);
  if (!piece) return { error: "no_roads_here" };
  const { edges, adj } = piece;
  const degree = (id: string) => adj.get(id)?.length ?? 0;
  const used = new Set<string>();
  const roads: AreaRoad[] = [];

  const orient = (e: Edge, from: string) => (e.a === from ? e.coords : [...e.coords].reverse());
  const walkFrom = (from: string, first: Edge) => {
    let at = from;
    let e = first;
    const coords: [number, number][] = [];
    let lengthM = 0;
    let name: string | null = null;
    let longest = { m: -1, type: null as string | null };
    for (;;) {
      used.add(e.id);
      const seg = orient(e, at);
      for (let i = coords.length ? 1 : 0; i < seg.length; i++) coords.push([seg[i][0], seg[i][1]]);
      lengthM += e.lengthM;
      name ??= e.name ?? null;
      if (e.lengthM > longest.m) longest = { m: e.lengthM, type: e.pathType ?? null };
      at = e.a === at ? e.b : e.a;
      if (degree(at) !== 2 || lengthM >= rules.maxRoadM) break;
      const next = adj.get(at)!.find((x) => !used.has(x.id));
      if (!next) break;
      e = next;
    }
    return { startKey: from, endKey: at, name, coords, lengthM, pathType: longest.type };
  };

  // Chains start at junctions and dead ends; what's left after that are closed loops of plain corners.
  const ends = [...adj.keys()].filter((id) => degree(id) !== 2).sort();
  for (const id of ends) for (const e of adj.get(id)!) if (!used.has(e.id)) roads.push(walkFrom(id, e));
  for (const e of [...edges].sort((x, y) => x.id.localeCompare(y.id))) if (!used.has(e.id)) roads.push(walkFrom(e.a, e));

  const mid = (r: AreaRoad) => pointOf(r.coords[Math.floor(r.coords.length / 2)]);
  const kept = roads
    .filter((r) => r.lengthM >= rules.minRoadM && r.startKey !== r.endKey)
    .map((r) => ({ r, d: metersBetween(mid(r), center) }))
    .sort((a, b) => a.d - b.d || a.r.startKey.localeCompare(b.r.startKey))
    .slice(0, rules.maxRoads)
    .map((x) => ({ ...x.r, lengthM: Math.round(x.r.lengthM * 10) / 10 }));
  if (kept.length < rules.minRoads) return { error: "no_roads_here" };

  const keys = new Set(kept.flatMap((r) => [r.startKey, r.endKey]));
  const nodes = [...keys].sort().map((key) => {
    const n = piece.byNode.get(key)!;
    return { key, latitude: n.latitude, longitude: n.longitude };
  });
  return { nodes, roads: kept };
};

/** The most named street in an area, for its title. */
export const areaName = (area: RoadArea) => {
  const count = new Map<string, number>();
  for (const r of area.roads) if (r.name) count.set(r.name, (count.get(r.name) ?? 0) + r.lengthM);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? `Streets around ${top}`.slice(0, 60) : "Streets near you";
};

// ---------- Find the Mafia ----------

export type ProposedCheckpoint = { label: string; latitude: number; longitude: number; audience: "all" | "civilian" | "mafia" };
export type MafiaProposal = { meet: LatLng; checkpoints: ProposedCheckpoint[]; walkM: { civilian: number; mafia: number } };

export type MafiaRules = { walkMps: number; snapM: number; minGapM: number };
export const MAFIA_RULES: MafiaRules = {
  walkMps: 1.1,
  /** The meeting point snaps to a street corner this close; further, it stays where the host stands. */
  snapM: 80,
  /** Checkpoints are at least this far apart (and from the meeting point), so each one is its own stop. */
  minGapM: 90,
};

/** Shortest walking distances from one corner to every corner it connects to. */
const distancesFrom = (adj: Map<string, Edge[]>, start: string) => {
  const dist = new Map<string, number>([[start, 0]]);
  const done = new Set<string>();
  const open = [start];
  while (open.length) {
    let k = 0;
    for (let i = 1; i < open.length; i++) if (dist.get(open[i])! < dist.get(open[k])!) k = i;
    const id = open.splice(k, 1)[0];
    if (done.has(id)) continue;
    done.add(id);
    for (const e of adj.get(id) ?? []) {
      const o = e.a === id ? e.b : e.a;
      const d = dist.get(id)! + e.lengthM;
      if (d < (dist.get(o) ?? Infinity)) {
        dist.set(o, d);
        open.push(o);
      }
    }
  }
  return dist;
};

const bearing = (from: LatLng, to: LatLng) => {
  const y = (to.longitude - from.longitude) * Math.cos((from.latitude * Math.PI) / 180);
  const x = to.latitude - from.latitude;
  return Math.atan2(y, x);
};
const angleGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
};

/**
 * A Find the Mafia route from where the host stands: two corners everyone visits, one only Civilians get, one only the
 * Mafia gets. Corners are real junctions, spread around the meeting point at a distance the walking time allows, and
 * named after the streets that meet there. `rng` picks among equally good corners so Shuffle gives another route.
 */
export const proposeMafiaRoute = (graph: Graph, here: LatLng, walkMinutes: number, rng: () => number, rules = MAFIA_RULES): MafiaProposal | { error: "no_route_here" } => {
  const budget = walkMinutes * 60 * rules.walkMps;
  const piece = reachable(graph, here, Math.min(1_200, budget * 0.6));
  if (!piece) return { error: "no_route_here" };
  const { adj, byNode } = piece;
  const meetNode = byNode.get(piece.start)!;
  const meet = piece.startM <= rules.snapM ? { latitude: meetNode.latitude, longitude: meetNode.longitude } : here;
  const dist = distancesFrom(adj, piece.start);

  const namesAt = (id: string) => [...new Set((adj.get(id) ?? []).map((e) => e.name).filter((n): n is string => Boolean(n)))].sort();
  const label = (id: string) => {
    const names = namesAt(id);
    if (names.length >= 2) return `${names[0]} and ${names[1]}`.slice(0, 40);
    if (names.length === 1) return names[0].slice(0, 40);
    // Sidewalks and crossings are often mapped without names: the nearest named street (within 60 m) names it.
    const node = byNode.get(id)!;
    let best: { name: string; d: number } | null = null;
    for (const e of named) {
      for (const c of e.coords) {
        const d = metersBetween(node, pointOf(c));
        if (d <= 60 && (!best || d < best.d)) best = { name: e.name!, d };
      }
    }
    return best ? `Near ${best.name}`.slice(0, 40) : null;
  };
  const named = graph.edges.filter((e) => e.name && e.coords.some((c) => metersBetween(pointOf(c), here) <= budget * 0.6));

  // Each role walks: meet, both shared corners, its own corner, back. Corners at about a sixth of the walk keep that
  // loop inside the walking time on a normal street grid.
  const pick = (lo: number, hi: number) => {
    const corners = [...adj.keys()]
      .filter((id) => (adj.get(id)?.length ?? 0) >= 3 || (adj.get(id)?.length ?? 0) === 1)
      .map((id) => ({ id, d: dist.get(id) ?? Infinity, node: byNode.get(id)! }))
      .filter((c) => c.node && c.d >= lo && c.d <= hi && metersBetween(c.node, meet) >= rules.minGapM)
      // A stable order first, so the same rng gives the same route.
      .sort((a, b) => a.id.localeCompare(b.id));
    if (corners.length < 4) return null;
    const chosen: typeof corners = [corners[Math.floor(rng() * corners.length)]];
    while (chosen.length < 4) {
      // The next corner is the one most unlike those chosen: furthest around the meeting point, and apart from them.
      let best: (typeof corners)[number] | null = null;
      let bestScore = -Infinity;
      for (const c of corners) {
        if (chosen.includes(c)) continue;
        const apart = Math.min(...chosen.map((x) => metersBetween(x.node, c.node)));
        if (apart < rules.minGapM) continue;
        const turn = Math.min(...chosen.map((x) => angleGap(bearing(meet, x.node), bearing(meet, c.node))));
        const score = turn * 100 + Math.min(apart, 300) * 0.2 + rng() * 60;
        if (score > bestScore) [bestScore, best] = [score, c];
      }
      if (!best) return null;
      chosen.push(best);
    }
    return chosen;
  };
  const audiences: ProposedCheckpoint["audience"][] = ["all", "all", "civilian", "mafia"];
  const build = (chosen: NonNullable<ReturnType<typeof pick>>) => {
    // Go around the meeting point in order, so the walk is a loop and not a zigzag; the branches are the last two.
    const ordered = [...chosen].sort((a, b) => bearing(meet, a.node) - bearing(meet, b.node));
    const checkpoints = ordered.map((c, i) => ({ label: label(c.id) ?? `Checkpoint ${i + 1}`, latitude: c.node.latitude, longitude: c.node.longitude, audience: audiences[i] }));
    const legs = (role: "civilian" | "mafia") => {
      const stops = [meet, ...checkpoints.filter((c) => c.audience === "all" || c.audience === role), meet];
      let m = 0;
      for (let i = 1; i < stops.length; i++) m += metersBetween(stops[i - 1], stops[i]);
      return Math.round(m);
    };
    return { meet, checkpoints, walkM: { civilian: legs("civilian"), mafia: legs("mafia") } };
  };
  // Straight lines are the least a walk can be; streets add to them, so a loop must leave room inside the time.
  let fallback: MafiaProposal | null = null;
  for (const [lo, hi] of [[0.1, 0.26], [0.08, 0.2], [0.05, 0.32]]) {
    const chosen = pick(budget * lo, budget * hi);
    if (!chosen) continue;
    const p = build(chosen);
    if (Math.max(p.walkM.civilian, p.walkM.mafia) <= budget * 0.8) return p;
    fallback ??= p;
  }
  return fallback ?? { error: "no_route_here" };
};
