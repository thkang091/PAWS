/**
 * Runs only inside scripts/test-db-local.sh (supabase/tests/local/routes_e2e.sh), which exports a published test grid
 * from PostGIS with walk_graph_near and passes its file path in PAWS_ROUTE_GRAPH. Skipped in the normal test run.
 */
import { generateShapeRoutes, type PedGraph, type RouteCandidate } from "../../supabase/functions/tournament/routes";
import { presetByKey } from "../../supabase/functions/tournament/shapes";

// Node built-ins without pulling Node's type definitions into the app's TypeScript project.
declare const require: (id: "fs") => { readFileSync: (path: string, enc: "utf8") => string; writeFileSync: (path: string, data: string) => void };
declare const process: { env: Record<string, string | undefined> };
const { readFileSync, writeFileSync } = require("fs");

const file = process.env.PAWS_ROUTE_GRAPH;
const suite = file ? describe : describe.skip;

suite("routes on a graph exported from PostGIS", () => {
  it("builds square loops from eligible edges only and writes them for the database to check", () => {
    const graph = JSON.parse(readFileSync(file!, "utf8")) as PedGraph;
    const forbidden = process.env.PAWS_ROUTE_FORBIDDEN ?? "";
    expect(graph.edges.length).toBeGreaterThan(50);
    expect(graph.edges.some((e) => e.id === forbidden)).toBe(false);
    const r = generateShapeRoutes(graph, { start: { latitude: 37.743, longitude: -122.457 }, shape: presetByKey("square")!, minutes: 15 });
    expect(r.ok).toBe(true);
    const options = (r as { options: RouteCandidate[] }).options;
    for (const o of options) expect(o.edgeIds).not.toContain(forbidden);
    writeFileSync(
      process.env.PAWS_ROUTE_OUT!,
      JSON.stringify(options.map((o) => ({ edgeIds: o.edgeIds, forward: o.steps.map((s) => s.forward), lengthM: o.lengthM, minutes: o.minutes, loop: o.loop, shapeScore: o.shapeScore, backtrack: o.backtrack, recentOverlap: o.recentOverlap }))),
    );
  });
});
