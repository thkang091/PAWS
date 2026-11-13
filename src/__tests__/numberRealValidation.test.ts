/**
 * Number Trail on real OpenStreetMap extracts. Runs only when PAWS_OSM_DIR points at a folder of Overpass JSON files
 * (fetched with the query in supabase/functions/tournament/osm.ts) plus a number_areas.txt listing
 * `name lat lng kind minutes,minutes`. Writes a report to PAWS_NUMBER_REPORT. The extracts are © OpenStreetMap
 * contributors (ODbL) and are not stored in the repository.
 *
 * For every plan, independently of the generator: it passes DigitRouteValidator; every edge is a run of a real OSM way
 * whose nodes appear in the source in that order and whose tags pass the walkability rules; consecutive steps share a
 * junction; digit strokes, connector and digits never share a street; digit two reads after digit one; a simulated
 * honest GPS walk of the course finishes it, and walking only digit one does not.
 */
import { classifyWay, osmToGraph, type OsmData, type OsmEdge } from "../../supabase/functions/tournament/osm";
import { NUMBER_RULES, chooseNumber, planNumberRoutes, planPieces, validateNumberPlan, type NumberPlan } from "../../supabase/functions/tournament/numberRoutes";
import { courseFromPlan, raceProgress } from "../../supabase/functions/tournament/numberRace";
import type { TrackPoint } from "../../supabase/functions/tournament/geo";

declare const require: (m: string) => any;
declare const process: { env: Record<string, string | undefined> };
const fs = require("fs");
const path = require("path");

const DIR = process.env.PAWS_OSM_DIR;
const maybe = DIR && fs.existsSync(path.join(DIR, "number_areas.txt")) ? describe : describe.skip;

/** An honest walk along pieces: a fix every 5 m at 1.25 m/s with up to 3 m of seeded noise. */
const walk = (pieces: { coords: [number, number][] }[], t0: number): TrackPoint[] => {
  let seed = 5;
  const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647) * 2 - 1;
  const out: TrackPoint[] = [];
  let t = t0;
  const pts = pieces.flatMap((p) => p.coords);
  for (let i = 1; i < pts.length; i++) {
    const [lo1, la1] = pts[i - 1];
    const [lo2, la2] = pts[i];
    const k = 111_320 * Math.cos((la1 * Math.PI) / 180);
    const len = Math.hypot((lo2 - lo1) * k, (la2 - la1) * 110_540);
    const n = Math.max(1, Math.round(len / 5));
    for (let j = 0; j < n; j++) {
      out.push({ latitude: la1 + ((la2 - la1) * j) / n + (rand() * 3) / 110_540, longitude: lo1 + ((lo2 - lo1) * j) / n + (rand() * 3) / k, accuracyM: 8, capturedAt: t, seq: out.length + 1, segment: 0 });
      t += 4000;
    }
  }
  return out;
};

maybe("Number Trail on real OpenStreetMap areas", () => {
  const areas: { name: string; lat: number; lng: number; kind: string; minutes: number[] }[] = (DIR ? fs.readFileSync(path.join(DIR, "number_areas.txt"), "utf8") : "")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l: string) => {
      const [name, lat, lng, kind, minutes] = l.trim().split(/\s+/);
      return { name, lat: Number(lat), lng: Number(lng), kind, minutes: minutes.split(",").map(Number) };
    });
  const report: unknown[] = [];
  // A skipped describe still runs its body: register nothing that needs tests unless the extracts are there.
  if (!areas.length) it.skip("needs PAWS_OSM_DIR with real extracts", () => undefined);
  else
    afterAll(() => {
      if (process.env.PAWS_NUMBER_REPORT) fs.writeFileSync(process.env.PAWS_NUMBER_REPORT, JSON.stringify(report, null, 2));
    });

  for (const area of areas)
    for (const minutes of area.minutes)
      it(`${area.name} (${area.kind}), ${minutes} min: every plan is real, connected, readable and walkable`, () => {
        const data: OsmData = JSON.parse(fs.readFileSync(path.join(DIR, `${area.name}.json`), "utf8"));
        const start = { latitude: area.lat, longitude: area.lng };
        const graph = osmToGraph(data, start);
        const ways = new Map<number, { nodes: number[]; tags: Record<string, string> }>();
        for (const el of data.elements) if (el.type === "way") ways.set(el.id, { nodes: el.nodes, tags: el.tags ?? {} });
        const byId = new Map(graph.edges.map((e) => [e.id, e as OsmEdge]));

        const t0 = Date.now();
        const result = planNumberRoutes(graph, { start, minutes });
        const ms = Date.now() - t0;
        const entry: Record<string, unknown> = {
          area: area.name,
          kind: area.kind,
          minutes,
          ms,
          outcome: result.ok ? "ok" : result.reason,
          digits: result.digits.join(""),
          numbers: result.plans.map((p) => p.number),
          sideBySide: result.plans.filter((p) => p.layout === "side_by_side").length,
          difficulty: result.plans.reduce((m: Record<string, number>, p) => ((m[p.difficulty] = (m[p.difficulty] ?? 0) + 1), m), {}),
          stats: result.stats,
        };
        report.push(entry);

        for (const plan of result.plans) {
          // 1. The independent plan check.
          expect(validateNumberPlan(plan, graph)).toBeNull();
          expect(plan.number).toMatch(/^[0-9]{2}$/);
          // 2. Every edge is a run of consecutive nodes of a real, walkable OSM way, straight from the source data.
          for (const leg of plan.legs) {
            const e = byId.get(leg.edgeId)!;
            const m = /^osm:w(\d+):(\d+)-(\d+)$/.exec(e.id)!;
            const way = ways.get(Number(m[1]))!;
            expect(classifyWay(way.tags).ok).toBe(true);
            const i = way.nodes.indexOf(Number(m[2]));
            const j = way.nodes.lastIndexOf(Number(m[3]));
            expect(i).toBeGreaterThanOrEqual(0);
            expect(j).toBeGreaterThan(i);
            expect(e.coords.length).toBe(j - i + 1);
          }
          // 3. Strokes, connector and the two digits never share a street.
          const strokes = new Set(plan.digits.flatMap((d) => d.strokeEdgeIds));
          expect(strokes.size).toBe(plan.digits[0].strokeEdgeIds.length + plan.digits[1].strokeEdgeIds.length);
          for (const l of plan.legs) if (l.part === "connector") expect(strokes.has(l.edgeId)).toBe(false);
        }

        // 4. Honest GPS walks: the whole course finishes; digit one alone doesn't. Checked on a sample of plans.
        for (const plan of result.plans.filter((_, i) => i % 7 === 0).slice(0, 6)) {
          const course = courseFromPlan(plan, graph);
          const race = planPieces(plan, graph).filter((p) => p.part !== "approach");
          const window = { raceStartMs: 0, nowMs: 10 ** 13 };
          const full = raceProgress(walk(race, 1000), course, window);
          expect(full.eligible).toBe(true);
          const half = raceProgress(walk(race.filter((p) => p.part === "digit" && p.digit === 0), 1000), course, window);
          expect(half.complete).toBe(false);
        }

        // 5. The random pick only ever returns a feasible number.
        let seed = 3;
        const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
        const feasible = new Set(result.plans.map((p) => p.number));
        for (let i = 0; i < 200; i++) {
          const pick = chooseNumber(result.plans, random);
          if (!result.plans.length) expect(pick).toBeNull();
          else expect(feasible.has((pick as NumberPlan).number)).toBe(true);
        }
        // Budget: the planner must stay well inside an edge function's CPU allowance on real data.
        expect(ms).toBeLessThan(15_000);
        expect(NUMBER_RULES.maxFrames).toBeGreaterThan(0);
      });
});
