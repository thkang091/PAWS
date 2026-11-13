/**
 * Route generation on real OpenStreetMap extracts. Runs only when PAWS_OSM_DIR points at a folder of Overpass JSON
 * files (one per area, fetched with the query in supabase/functions/tournament/osm.ts) plus an areas.txt listing
 * `name lat lng`. Writes a report to PAWS_OSM_REPORT. The extracts are © OpenStreetMap contributors (ODbL) and are not
 * stored in the repository.
 *
 * For every route it checks, independently of the generator: each edge comes from a real OSM way whose nodes are in
 * the source data in that order; consecutive edges share a junction; the path is exactly the edges' geometry; the
 * length recomputed from the path matches; options share less than 40% length and are not the same loop reversed or
 * restarted.
 */
import { metersBetween } from "../../supabase/functions/tournament/geo";
import { classifyWay, osmToGraph, routeWarnings, searchRadiusM, type OsmData, type OsmEdge } from "../../supabase/functions/tournament/osm";
import { ROUTE_RULES, generateShapeRoutes, meanGap, overlapRatio, validateRoute } from "../../supabase/functions/tournament/routes";
import { presetByKey } from "../../supabase/functions/tournament/shapes";

declare const require: (m: string) => any;
declare const process: { env: Record<string, string | undefined> };
const fs = require("fs");
const path = require("path");

const DIR = process.env.PAWS_OSM_DIR;
const maybe = DIR ? describe : describe.skip;

maybe("real OpenStreetMap areas", () => {
  // A skipped describe still runs its body, so read nothing unless the extracts are there.
  const areas: { name: string; lat: number; lng: number }[] = (DIR ? fs.readFileSync(path.join(DIR, "areas.txt"), "utf8") : "")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l: string) => {
      const [name, lat, lng] = l.trim().split(/\s+/);
      return { name, lat: Number(lat), lng: Number(lng) };
    });
  const report: unknown[] = [];

  if (!areas.length) it.skip("needs PAWS_OSM_DIR with real extracts", () => undefined);

  afterAll(() => {
    if (process.env.PAWS_OSM_REPORT) fs.writeFileSync(process.env.PAWS_OSM_REPORT, JSON.stringify(report, null, 2));
  });

  for (const area of areas) {
    it(`${area.name}: every route is real, connected, measured and distinct`, () => {
      const data: OsmData = JSON.parse(fs.readFileSync(path.join(DIR, `${area.name}.json`), "utf8"));
      const origin = { latitude: area.lat, longitude: area.lng };
      const graph = osmToGraph(data, origin);
      const wayNodes = new Map<number, number[]>();
      const wayTags = new Map<number, Record<string, string>>();
      for (const el of data.elements) if (el.type === "way") (wayNodes.set(el.id, el.nodes), wayTags.set(el.id, el.tags ?? {}));
      const byId = new Map(graph.edges.map((e) => [e.id, e as OsmEdge]));
      const entry: Record<string, unknown> = {
        area: area.name,
        edges: graph.edges.length,
        nodes: graph.nodes.length,
        dropped: graph.dropped,
        rejectedWays: graph.rejectedWays,
        lengthKm: Math.round(graph.edges.reduce((s, e) => s + e.lengthM, 0)) / 1000,
        runs: [] as unknown[],
      };
      expect(graph.edges.length).toBeGreaterThan(50);

      for (const shapeKey of ["square", "heart", "triangle"]) {
        for (const minutes of [15, 25]) {
          // The extract covers the 25-minute search radius; 15 minutes needs less.
          expect(searchRadiusM(minutes)).toBeLessThanOrEqual(843);
          const shape = presetByKey(shapeKey)!;
          const t0 = Date.now();
          const res = generateShapeRoutes(graph, { start: origin, shape, minutes });
          const ms = Date.now() - t0;
          const run: Record<string, unknown> = { shape: shapeKey, minutes, ms, outcome: res.ok ? "ok" : (res as { reason: string }).reason, considered: res.considered };
          if (!res.ok) {
            run.bestScore = (res as { bestScore: number | null }).bestScore;
            (entry.runs as unknown[]).push(run);
            continue;
          }
          const options = (res as { options: import("../../supabase/functions/tournament/routes").RouteCandidate[] }).options;
          run.options = options.map((o) => {
            // 1. Independent validation against the graph.
            expect(validateRoute(o, graph)).toBeNull();
            // 2. Every edge is a real piece of a real way: its nodes appear in that way, consecutively.
            for (const id of o.edgeIds) {
              const m = /^osm:w(\d+):(\d+)-(\d+)$/.exec(id)!;
              expect(m).not.toBeNull();
              const nodes = wayNodes.get(Number(m[1]))!;
              expect(nodes).toBeDefined();
              expect(classifyWay(wayTags.get(Number(m[1]))).ok).toBe(true);
              const i = nodes.indexOf(Number(m[2]));
              const j = nodes.lastIndexOf(Number(m[3]));
              expect(i).toBeGreaterThanOrEqual(0);
              expect(j).toBeGreaterThan(i);
              expect(byId.get(id)!.coords.length).toBe(j - i + 1);
            }
            // 3. Length recomputed from the drawn path.
            let len = 0;
            for (let k = 1; k < o.path.length; k++) len += metersBetween(o.path[k - 1], o.path[k]);
            expect(Math.abs(len - o.lengthM)).toBeLessThan(Math.max(1, o.lengthM * 0.01));
            // 4. Closed and within the time asked.
            expect(metersBetween(o.path[0], o.path[o.path.length - 1])).toBeLessThan(1);
            const target = minutes * 60 * ROUTE_RULES.walkMps;
            expect(o.lengthM).toBeGreaterThanOrEqual(target * 0.75);
            expect(o.lengthM).toBeLessThanOrEqual(target * 1.25);
            return {
              score: o.shapeScore,
              estimate: o.estimate,
              lengthM: Math.round(o.lengthM),
              minutes: o.minutes,
              edges: o.edgeIds.length,
              ways: new Set(o.edgeIds.map((id) => id.split(":")[1])).size,
              startSnapM: o.startSnapM,
              backtrack: o.backtrack,
              warnings: routeWarnings(o.edgeIds, byId),
              names: [...new Set(o.edgeIds.map((id) => byId.get(id)!.name).filter(Boolean))].slice(0, 8),
              path: o.path.filter((_, k) => k % Math.max(1, Math.floor(o.path.length / 60)) === 0).map((p) => [Math.round(p.latitude * 1e6) / 1e6, Math.round(p.longitude * 1e6) / 1e6]),
            };
          });
          // 5. Options differ: shared length under 40%, and not the same walk on parallel paths.
          const pairs: number[] = [];
          for (let a = 0; a < options.length; a++)
            for (let b = a + 1; b < options.length; b++) {
              const ov = overlapRatio(options[a].edgeIds, options[b].edgeIds, byId);
              pairs.push(Math.round(ov * 100) / 100);
              expect(ov).toBeLessThan(ROUTE_RULES.maxOptionOverlap);
              expect(meanGap(options[a].path, options[b].path)).toBeGreaterThan(ROUTE_RULES.sameWalkM);
            }
          run.overlaps = pairs;
          (entry.runs as unknown[]).push(run);
        }
      }
      report.push(entry);
    }, 600_000);
  }
});
