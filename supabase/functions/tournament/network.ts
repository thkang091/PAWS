import { metersBetween } from "./geo.ts";
import { OSM_ATTRIBUTION, OSM_LICENSE, OSM_WALK_VERSION, osmToGraph, overpassQuery, searchRadiusM, type EdgeWarning, type OsmData } from "./osm.ts";
import type { PedGraph } from "./routes.ts";

/** Anything with Supabase's rpc shape: the service-role client in the edge function, a local Postgres in development. */
export type Db = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> };
type Log = (event: string, detail?: Record<string, unknown>) => void;

export const OVERPASS_URL = Deno.env.get("OVERPASS_URL") ?? "https://overpass-api.de/api/interpreter";
/** A published PAWS area counts as covering the start when one of its junctions is this close. */
export const PAWS_COVERAGE_M = 400;

export type NetworkEdge = PedGraph["edges"][number] & { warnings?: EdgeWarning[]; wayId?: number; name?: string | null; regionId?: string };
export type Network = { graph: Omit<PedGraph, "edges"> & { edges: readonly NetworkEdge[] }; source: "paws" | "osm"; sources: { regionId: string; name: string; source: string; license: string; attribution: string }[] };

/**
 * The real pedestrian network around a start. A published PAWS area (checked by an organizer) always wins where it
 * covers the start, so an organizer's "unsafe" never gets overruled. Anywhere else: OpenStreetMap, from the
 * database if a recent fetch covered this circle, otherwise fetched now and stored. Never anything synthetic: if
 * neither source answers, there is no network and no route.
 */
export const networkNear = async (admin: Db, lat: number, lng: number, minutes: number, radiusM?: number, log: Log = () => undefined): Promise<Network | { error: string }> => {
  const { data: graphData, error: graphError } = await admin.rpc("walk_graph_near", { p_latitude: lat, p_longitude: lng, p_radius_m: 2500 });
  if (graphError) return { error: "server_error" };
  const paws = graphData as Omit<PedGraph, "edges"> & { edges: NetworkEdge[]; sources: Network["sources"] };
  const start = { latitude: lat, longitude: lng };
  if (paws.nodes.some((n) => metersBetween(n, start) <= PAWS_COVERAGE_M)) return { graph: paws, source: "paws", sources: paws.sources };

  // An exact-number search asks for its own radius (at most 3 km: the largest area the store keeps).
  const radius = radiusM ? Math.min(2_700, Math.max(300, Math.round(radiusM))) : searchRadiusM(minutes);
  const osmSources = [{ regionId: "osm", name: "OpenStreetMap", source: "OpenStreetMap", license: OSM_LICENSE, attribution: OSM_ATTRIBUTION }];
  const { data: cached } = await admin.rpc("osm_walk_graph_near", { p_latitude: lat, p_longitude: lng, p_radius_m: radius, p_version: OSM_WALK_VERSION });
  const stored = cached as { edges: NetworkEdge[]; nodes: PedGraph["nodes"] } | null;
  if (stored?.edges?.length) return { graph: stored, source: "osm", sources: osmSources };

  // Fetch a little wider than needed, so the next request nearby is served from the database.
  const fetchRadius = Math.min(radiusM ? 3_000 : 1_600, radius + 300);
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 55_000);
  let data: OsmData;
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "PAWS walking routes" },
      body: `data=${encodeURIComponent(overpassQuery(lat, lng, fetchRadius))}`,
      signal: abort.signal,
    });
    if (!res.ok) {
      log("osm_fetch_failed", { status: res.status });
      return { error: res.status === 429 || res.status === 504 ? "routing_busy" : "routing_unavailable" };
    }
    data = (await res.json()) as OsmData;
  } catch (e) {
    log("osm_fetch_failed", { message: abort.signal.aborted ? "timeout" : e instanceof Error ? e.message : "network" });
    return { error: "routing_unavailable" };
  } finally {
    clearTimeout(timer);
  }
  const graph = osmToGraph(data, start);
  const { error: storeError } = await admin.rpc("store_osm_walk_area", {
    p_latitude: lat,
    p_longitude: lng,
    p_radius_m: fetchRadius,
    p_version: OSM_WALK_VERSION,
    p_edges: graph.edges.map((e) => ({ id: e.id, wayId: e.wayId, a: e.a, b: e.b, coords: e.coords, lengthM: e.lengthM, pathType: e.pathType, access: e.access, foot: e.foot, name: e.name, warnings: e.warnings })),
    p_dropped: { ...graph.dropped, rejectedWays: graph.rejectedWays },
  });
  if (storeError) {
    log("osm_store_failed", { message: storeError.message });
    return { error: "server_error" };
  }
  log("osm_fetched", { edges: graph.edges.length, dropped: graph.dropped, rejectedWays: graph.rejectedWays });
  return { graph, source: "osm", sources: osmSources };
};

