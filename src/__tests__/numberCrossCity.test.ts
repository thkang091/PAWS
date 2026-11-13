/**
 * N4B 14.3: cross-city fairness on two real OpenStreetMap areas (© OpenStreetMap contributors, ODbL; extracts are not
 * in the repository). Runs when PAWS_OSM_DIR has the extracts; writes a report to PAWS_CROSS_REPORT.
 *
 * For each number and distance category, each area searches its own streets independently for exactly that number at
 * the target length (± 2%). Every candidate is checked against the raw OpenStreetMap ways and the independent
 * validator; the matcher then picks one course per area, or says honestly why it can't. Nothing is forced to pass.
 */
import { classifyWay, osmToGraph, type OsmData, type OsmEdge } from "../../supabase/functions/tournament/osm";
import { findNumberRoutes, planPieces, validateNumberPlan, type NumberPlan } from "../../supabase/functions/tournament/numberRoutes";
import { buildCourse, verifyRace } from "../../supabase/functions/tournament/numberMatch";
import { DISTANCE_CATEGORIES, compareCourses, matchCourses, metricsOf, type Candidate } from "../../supabase/functions/tournament/numberEquivalence";
import type { TrackPoint } from "../../supabase/functions/tournament/geo";
import type { PedGraph } from "../../supabase/functions/tournament/routes";

declare const require: (m: string) => any;
declare const process: { env: Record<string, string | undefined> };
const fs = require("fs");
const path = require("path");
const DIR = process.env.PAWS_OSM_DIR;
const ALL = {
  portland_sellwood_wide: { name: "portland_sellwood_wide", label: "Portland, Sellwood (grid)", lat: 45.466, lng: -122.653 },
  seoul_yeonnam: { name: "seoul_yeonnam", label: "Seoul, Yeonnam-dong (irregular)", lat: 37.5627, lng: 126.9236 },
  sf_sunset: { name: "sf_sunset", label: "San Francisco, Sunset (grid)", lat: 37.7516, lng: -122.4915 },
};
/** A grid against an irregular old neighbourhood (the hard case), and two grids in different cities. */
const PAIRS = [
  ["portland_sellwood_wide", "seoul_yeonnam"],
  ["portland_sellwood_wide", "sf_sunset"],
] as const;
const have = (n: string) => Boolean(DIR) && fs.existsSync(path.join(DIR ?? "", `${n}.json`));
const maybe = Object.keys(ALL).every(have) ? describe : describe.skip;
const NUMBERS = ["1", "2", "3", "9", "10", "12", "27", "42", "63", "80", "88", "99"];

const walk = (plan: NumberPlan, graph: PedGraph, t0: number): TrackPoint[] => {
  const coords = planPieces(plan, graph).flatMap((p) => p.coords);
  const out: TrackPoint[] = [];
  let t = t0;
  for (let i = 1; i < coords.length; i++) {
    const [lo1, la1] = coords[i - 1];
    const [lo2, la2] = coords[i];
    const k = 111_320 * Math.cos((la1 * Math.PI) / 180);
    const n = Math.max(1, Math.round(Math.hypot((lo2 - lo1) * k, (la2 - la1) * 110_540) / 5));
    for (let j = 0; j < n; j++) {
      out.push({ latitude: la1 + ((la2 - la1) * j) / n, longitude: lo1 + ((lo2 - lo1) * j) / n, accuracyM: 8, capturedAt: t, seq: out.length + 1, segment: 0 });
      t += 4000;
    }
  }
  const [lo, la] = coords[coords.length - 1];
  out.push({ latitude: la, longitude: lo, accuracyM: 8, capturedAt: t, seq: out.length + 1, segment: 0 });
  return out;
};

maybe.each(PAIRS.map((pair) => [pair.join(" vs "), pair] as const))("cross-city fairness on two real areas: %s", (_label, pair) => {
  const AREAS = pair.map((n) => ALL[n]);
  // Skipped suites still collect their tests: don't touch the extracts when they aren't there.
  if (!Object.keys(ALL).every(have)) return void it.skip("needs PAWS_OSM_DIR with the real extracts", () => undefined);
  jest.setTimeout(900_000);
  const report: unknown[] = [];
  afterAll(() => {
    if (process.env.PAWS_CROSS_REPORT) fs.writeFileSync(process.env.PAWS_CROSS_REPORT.replace(/\.json$/, `.${pair.join("_")}.json`), JSON.stringify(report, null, 2));
  });
  const loaded = AREAS.map((a) => {
    const data: OsmData = JSON.parse(fs.readFileSync(path.join(DIR, `${a.name}.json`), "utf8"));
    const graph = osmToGraph(data, { latitude: a.lat, longitude: a.lng });
    const ways = new Map<number, { nodes: number[]; tags: Record<string, string> }>();
    for (const el of data.elements) if (el.type === "way") ways.set(el.id, { nodes: el.nodes, tags: el.tags ?? {} });
    return { ...a, graph, ways, byId: new Map(graph.edges.map((e) => [e.id, e as OsmEdge])) };
  });

  for (const [cat, { targetM }] of Object.entries(DISTANCE_CATEGORIES))
    for (const number of NUMBERS)
      it(`${number} at ${cat} (${targetM} m): independent real courses, matched or honestly not`, () => {
        const perArea = loaded.map((a) => {
          const t0 = Date.now();
          const r = findNumberRoutes(a.graph, { start: { latitude: a.lat, longitude: a.lng }, number, radiusM: 1_000, targetM, bandShare: 0.02, exact: true, alternatives: 12 });
          const ms = Date.now() - t0;
          for (const plan of r.plans) {
            // Exactly this number, valid, every edge a real walkable run of a real way.
            expect(plan.number).toBe(number);
            expect(plan.digits.map((d) => d.digit).join("")).toBe(number);
            expect(validateNumberPlan(plan, a.graph)).toBeNull();
            for (const leg of plan.legs) {
              const e = a.byId.get(leg.edgeId)!;
              const m = /^osm:w(\d+):(\d+)-(\d+)$/.exec(e.id)!;
              const way = a.ways.get(Number(m[1]))!;
              expect(classifyWay(way.tags).ok).toBe(true);
              expect(way.nodes.indexOf(Number(m[2]))).toBeGreaterThanOrEqual(0);
            }
            // Every course lands within 0.8% of the target (a finish stretch on real streets makes up the gap).
            expect(Math.abs(plan.raceM - targetM)).toBeLessThanOrEqual(targetM * 0.008 + 1);
            if (number.length === 1) expect(plan.connectorM).toBe(0);
          }
          return { area: a, plans: r.plans, reason: r.reason, ms };
        });
        const candidates: Candidate[] = perArea.flatMap(({ area, plans }) => plans.map((p, i) => ({ id: `${area.name}#${i}`, userId: area.name, metrics: metricsOf(buildCourse(p, area.graph)) })));
        const outcome = matchCourses(AREAS.map((a) => a.name), candidates, targetM);
        const entry: Record<string, unknown> = {
          finishShare: perArea.map((x) => x.plans.map((p) => Math.round(((p.finishM ?? 0) / p.raceM) * 100) / 100)),
          number,
          category: cat,
          targetM,
          areas: perArea.map((x) => ({ area: x.area.name, candidates: x.plans.length, reason: x.reason, ms: x.ms, lengths: x.plans.map((p) => p.raceM) })),
          matched: outcome.ok,
          reason: outcome.ok === false ? outcome.reason : null,
        };
        if (outcome.ok === true) {
          // Re-check the chosen set independently, and walk each course honestly: it must finish.
          const picks = AREAS.map((a) => outcome.picks[a.name]);
          const eq = compareCourses(picks.map((p) => p.metrics), targetM);
          expect(eq.status).toBe("matched");
          expect(eq.spreadM).toBeLessThanOrEqual(targetM * 0.02);
          for (const pick of picks) {
            const area = perArea.find((x) => x.area.name === pick.userId)!;
            const plan = area.plans[Number(pick.id.split("#")[1])];
            const v = verifyRace(walk(plan, area.area.graph, 1000), buildCourse(plan, area.area.graph), { raceStartMs: 0, nowMs: 10 ** 13 });
            expect(v.eligible).toBe(true);
          }
          entry.spreadM = Math.round(eq.spreadM * 10) / 10;
          entry.picked = picks.map((p) => ({
            area: p.userId,
            totalM: Math.round(p.metrics.totalM),
            digitM: p.metrics.digitM.map(Math.round),
            connectorM: Math.round(p.metrics.connectorM),
            finishM: Math.round(p.metrics.finishM),
            turns: p.metrics.turns,
            readability: p.metrics.readability,
          }));
        } else if (outcome.ok === false) {
          entry.closest = outcome.best ? { status: outcome.best.status, spreadM: Math.round(outcome.best.spreadM), failed: outcome.best.checks.filter((c) => !c.ok).map((c) => c.name) } : null;
          entry.missing = outcome.missing;
        }
        report.push(entry);
      });
});
