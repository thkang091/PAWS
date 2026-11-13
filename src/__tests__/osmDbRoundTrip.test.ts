/**
 * Real OpenStreetMap data through the database and back. Runs only inside supabase/tests/local/osm_e2e.sh:
 *   PAWS_OSM_EXPORT  convert an Overpass extract (PAWS_OSM_FILE, around PAWS_OSM_LAT/LNG) to the edges the edge
 *                    function stores, and write them to PAWS_OSM_EXPORT
 *   PAWS_OSM_GRAPH   read the graph PostGIS served back (osm_walk_graph_near), generate routes on it, check each one
 *                    independently, and write the candidates to PAWS_OSM_OUT for the database to accept
 */
import { osmToGraph, routeWarnings, type EdgeWarning, type OsmData } from "../../supabase/functions/tournament/osm";
import { generateShapeRoutes, validateRoute, type PedGraph, type RouteCandidate } from "../../supabase/functions/tournament/routes";
import { presetByKey } from "../../supabase/functions/tournament/shapes";

declare const require: (id: "fs") => { readFileSync: (path: string, enc: "utf8") => string; writeFileSync: (path: string, data: string) => void };
declare const process: { env: Record<string, string | undefined> };
const { readFileSync, writeFileSync } = require("fs");
const env = process.env;
const start = { latitude: Number(env.PAWS_OSM_LAT), longitude: Number(env.PAWS_OSM_LNG) };

(env.PAWS_OSM_EXPORT ? describe : describe.skip)("export a real area for storage", () => {
  it("converts the extract to stored edges", () => {
    const g = osmToGraph(JSON.parse(readFileSync(env.PAWS_OSM_FILE!, "utf8")) as OsmData, start);
    expect(g.edges.length).toBeGreaterThan(200);
    writeFileSync(env.PAWS_OSM_EXPORT!, JSON.stringify(g.edges.map((e) => ({ id: e.id, wayId: e.wayId, a: e.a, b: e.b, coords: e.coords, lengthM: e.lengthM, pathType: e.pathType, access: e.access, foot: e.foot, name: e.name, warnings: e.warnings }))));
  });
});

(env.PAWS_OSM_GRAPH ? describe : describe.skip)("routes on the network PostGIS served back", () => {
  it("builds real, checked square loops", () => {
    const graph = JSON.parse(readFileSync(env.PAWS_OSM_GRAPH!, "utf8")) as PedGraph;
    expect(graph.edges.length).toBeGreaterThan(200);
    const r = generateShapeRoutes(graph, { start, shape: presetByKey(env.PAWS_OSM_SHAPE ?? "square")!, minutes: 15 });
    expect(r.ok).toBe(true);
    const options = (r as { options: RouteCandidate[] }).options;
    const byId = new Map(graph.edges.map((e) => [e.id, e as { warnings?: EdgeWarning[] }]));
    for (const o of options) expect(validateRoute(o, graph)).toBeNull();
    writeFileSync(
      env.PAWS_OSM_OUT!,
      JSON.stringify(
        options.map((o) => ({
          source: "osm",
          edgeIds: o.edgeIds,
          forward: o.steps.map((s) => s.forward),
          lengthM: o.lengthM,
          minutes: o.minutes,
          loop: o.loop,
          shapeScore: o.shapeScore,
          estimate: o.estimate,
          backtrack: o.backtrack,
          recentOverlap: o.recentOverlap,
          warnings: routeWarnings(o.edgeIds, byId),
        })),
      ),
    );
  });
});
