import { generateShapeRoutes, type PedEdge, type RouteCandidate } from "../../supabase/functions/tournament/routes";
import { ROUTE_SCORE_RULES, nearestOnRoute, offRoute, routeProgress, scoreRouteWalk, type RouteLeg } from "../../supabase/functions/tournament/routeScore";
import { matchShape } from "../../supabase/functions/tournament/shape";
import { presetByKey } from "../../supabase/functions/tournament/shapes";
import type { TrackPoint } from "../../supabase/functions/tournament/geo";
import { ACTION_LABEL, OUTCOME_COPY, ROUTE_LINES, SHAPE_ORDER, distanceLabel, matchLabel, noveltyLabel, shapeChoices } from "@/features/tournament/shapeFlow";
import { squareTown } from "./fixtures/pedestrianGraphs";

/** A real square route on the test grid, as the legs the server hands to scoring. Synthetic test geometry. */
const squareRoute = () => {
  const town = squareTown();
  const graph = town.graph();
  const r = generateShapeRoutes(graph, { start: town.at(300, 300), shape: presetByKey("square")!, minutes: 15 });
  const route = (r as { options: RouteCandidate[] }).options[0];
  const byId = new Map(graph.edges.map((e: PedEdge) => [e.id, e]));
  const legs: RouteLeg[] = route.steps.map((s) => {
    const e = byId.get(s.edgeId)!;
    return { edgeId: e.id, lengthM: e.lengthM, coords: s.forward ? e.coords : [...e.coords].reverse() };
  });
  return { town, route, legs };
};

/** GPS fixes every ~5 m along the given legs at a dog-walking pace, 5 m accuracy. */
const walkAlong = (legs: readonly RouteLeg[], opts: { segmentAt?: number; offsetM?: number; t0?: number } = {}): TrackPoint[] => {
  const pts: TrackPoint[] = [];
  let t = opts.t0 ?? Date.parse("2026-11-06T09:00:00Z");
  let segment = 0;
  legs.forEach((l, li) => {
    if (opts.segmentAt !== undefined && li === opts.segmentAt) {
      segment += 1;
      t += 60_000;
    }
    const [a, b] = [l.coords[0], l.coords[l.coords.length - 1]];
    const steps = Math.max(2, Math.round(l.lengthM / 5));
    for (let k = li ? 1 : 0; k <= steps; k++) {
      const f = k / steps;
      pts.push({
        seq: pts.length + 1,
        segment,
        latitude: a[1] + (b[1] - a[1]) * f + (opts.offsetM ?? 0) / 110_540,
        longitude: a[0] + (b[0] - a[0]) * f,
        accuracyM: 5,
        capturedAt: t,
      });
      t += 4_000;
    }
  });
  return pts;
};

describe("route walk scoring", () => {
  it("scores a completed route walk: full coverage, in order, 70/30 blend", () => {
    const { legs } = squareRoute();
    const walk = walkAlong(legs);
    const p = routeProgress(walk, legs);
    expect(p.completion).toBeGreaterThan(0.95);
    expect(p.progression).toBe(1);
    const shape = matchShape(walk, presetByKey("square")!);
    expect(shape.ok).toBe(true);
    const s = scoreRouteWalk(shape.score, p);
    expect(s.ok).toBe(true);
    expect(s.final).toBeCloseTo(0.7 * shape.score + 0.3 * s.routePart, 0);
    expect(s.final).toBeGreaterThan(90);
  });

  it("counts a route walked the other way round", () => {
    const { legs } = squareRoute();
    const reversed: RouteLeg[] = [...legs].reverse().map((l) => ({ ...l, coords: [...l.coords].reverse() }));
    const p = routeProgress(walkAlong(reversed), legs);
    expect(p.completion).toBeGreaterThan(0.95);
    expect(p.progression).toBe(1);
  });

  it("holds an incomplete walk back instead of scoring it", () => {
    const { legs } = squareRoute();
    const p = routeProgress(walkAlong(legs.slice(0, Math.floor(legs.length / 3))), legs);
    expect(p.completion).toBeLessThan(ROUTE_SCORE_RULES.minCompletion);
    const s = scoreRouteWalk(80, p);
    expect(s.ok).toBe(false);
    expect(s.issues).toEqual(["route_incomplete"]);
    expect(s.final).toBe(0);
  });

  it("refuses a walk that hops around the route out of order", () => {
    const { legs } = squareRoute();
    const order = legs.map((_, i) => i).sort((a, b) => (a % 2) - (b % 2) || a - b); // evens, then odds
    const shuffled = order.map((i) => legs[i]);
    const s = scoreRouteWalk(80, routeProgress(walkAlong(shuffled), legs));
    expect(s.issues).toContain("route_out_of_order");
  });

  it("never lets a GPS jump complete the part it skipped", () => {
    const { legs } = squareRoute();
    const walk = walkAlong(legs);
    const half = Math.floor(walk.length / 2);
    // The phone jumps from a quarter of the way round straight to the far side.
    const jumped = [...walk.slice(0, Math.floor(walk.length / 4)), ...walk.slice(half).map((p, i) => ({ ...p, seq: 10_000 + i }))];
    const p = routeProgress(jumped, legs);
    expect(p.completion).toBeLessThan(0.8);
    // The walk itself is refused too: a jump is a gap or an impossible speed, never progress.
    const shape = matchShape(jumped, presetByKey("square")!);
    expect(shape.ok).toBe(false);
    expect(shape.issues.some((i) => i === "gps_gap" || i === "suspicious_speed")).toBe(true);
  });

  it("doesn't fill in the stretch skipped across a pause", () => {
    const { legs } = squareRoute();
    const walk = walkAlong(legs, { segmentAt: 2 }).filter((p) => !(p.segment === 1 && p.seq < 0));
    // Remove the third and fourth legs' points entirely: paused there, resumed later.
    const skippedLegs = new Set([2, 3]);
    const kept = walkAlong(legs.filter((_, i) => !skippedLegs.has(i)), { segmentAt: 2 });
    const full = routeProgress(walk, legs).completion;
    const paused = routeProgress(kept, legs).completion;
    expect(paused).toBeLessThan(full - 0.1);
  });

  it("does not reward speed: the same route walked faster scores the same", () => {
    const { legs } = squareRoute();
    const slow = walkAlong(legs);
    const brisk = slow.map((p, i) => ({ ...p, capturedAt: slow[0].capturedAt + i * 3_000 }));
    const a = scoreRouteWalk(matchShape(slow, presetByKey("square")!).score, routeProgress(slow, legs));
    const b = scoreRouteWalk(matchShape(brisk, presetByKey("square")!).score, routeProgress(brisk, legs));
    expect(a.final).toBe(b.final);
  });

  it("notices leaving the route after three fixes, and shows the nearest point back", () => {
    const { legs } = squareRoute();
    const on = walkAlong(legs.slice(0, 2));
    expect(offRoute(on, legs).off).toBe(false);
    // Three fixes 80 m south of the whole loop, on no part of it.
    const minLat = Math.min(...legs.flatMap((l) => l.coords.map((c) => c[1])));
    const last = on[on.length - 1];
    const away = [1, 2, 3].map((k) => ({ ...last, seq: 5_000 + k, latitude: minLat - 80 / 110_540, capturedAt: last.capturedAt + k * 4_000 }));
    const drifted = [...on, ...away];
    expect(offRoute(drifted, legs).off).toBe(true);
    expect(offRoute(drifted.slice(0, -1), legs).off).toBe(false);
    const back = nearestOnRoute(drifted[drifted.length - 1], legs)!;
    // The way back is a point of the route itself, never a made-up spot.
    expect(legs.some((l) => l.coords.some(([lng, lat]) => lng === back.longitude && lat === back.latitude))).toBe(true);
  });

  it("ignores imprecise fixes when deciding you're off route", () => {
    const { legs } = squareRoute();
    const on = walkAlong(legs.slice(0, 2));
    const minLat = Math.min(...legs.flatMap((l) => l.coords.map((c) => c[1])));
    const last = on[on.length - 1];
    const noisy = [1, 2, 3].map((k) => ({ ...last, seq: 6_000 + k, latitude: minLat - 80 / 110_540, accuracyM: 80, capturedAt: last.capturedAt + k * 4_000 }));
    expect(offRoute([...on, ...noisy], legs).off).toBe(false);
  });
});

describe("Follow the Shape choices", () => {
  it("offers the six shapes in order, each with a note on what it needs", () => {
    const choices = shapeChoices();
    expect(choices.map((c) => c.key)).toEqual([...SHAPE_ORDER]);
    expect(choices.map((c) => c.key)).toEqual(["heart", "triangle", "square", "diamond", "star", "lightning"]);
    for (const c of choices) expect(c.note.length).toBeGreaterThan(10);
    expect(choices.find((c) => c.key === "lightning")!.closed).toBe(false);
  });

  it("describes lengths and routes plainly", () => {
    expect(distanceLabel(15)).toBe("about 1.0 km");
    expect(distanceLabel(40)).toBe("about 2.6 km");
    expect(noveltyLabel(0)).toBe("New for you");
    expect(noveltyLabel(0.4)).toBe("Partly walked");
    expect(noveltyLabel(0.9)).toBe("Walked recently");
    expect(matchLabel(95)).toBe("Very close");
    expect(matchLabel(80)).toBe("Close");
    expect(matchLabel(70)).toBe("Loose");
    expect(new Set(ROUTE_LINES.map((l) => JSON.stringify(l.dash))).size).toBe(3);
  });

  it("offers a way forward for every kind of failure, and never a made-up route", () => {
    for (const [outcome, copy] of Object.entries(OUTCOME_COPY)) {
      expect(copy.actions.length).toBeGreaterThan(0);
      for (const a of copy.actions) expect(ACTION_LABEL[a]).toBeTruthy();
      expect(outcome).not.toBe("ok");
    }
    expect(OUTCOME_COPY.shape_not_possible.actions).toContain("change_shape");
    expect(OUTCOME_COPY.no_feasible_route.actions).toContain("change_length");
    expect(OUTCOME_COPY.no_public_start.actions).toEqual(["change_start"]);
  });
});
