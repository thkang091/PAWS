import {
  MATCH_LIMITS,
  ROAD_RULES,
  balanceTeams,
  buildGraph,
  canCapture,
  canTransition,
  capturable,
  checkGraph,
  coveredLength,
  matchRoads,
  phaseAt,
  roadScore,
  teamsReady,
  winnerOf,
  type RoadEdge,
} from "../../supabase/functions/rooms/battle";
import type { TrackPoint } from "../../supabase/functions/tournament/geo";
import { T0, offset } from "./fixtures/gpsWalks";

/**
 * A mocked road network for tests only (it is not a real place): a 200 m east-west street from A to B, a 150 m street
 * north from B to C, a parallel path 3 m south of the first street, and a separate 120 m lane far away.
 */
const ll = (x: number, y: number) => {
  const p = offset(x, y);
  return [p.longitude, p.latitude] as [number, number];
};
const EDGES: RoadEdge[] = [
  { id: "ab", startNodeId: "A", endNodeId: "B", coords: [ll(0, 0), ll(200, 0)], lengthM: 200, name: "Oak Street" },
  { id: "bc", startNodeId: "B", endNodeId: "C", coords: [ll(200, 0), ll(200, 150)], lengthM: 150, name: "Elm Street" },
  { id: "lane", startNodeId: "X", endNodeId: "Y", coords: [ll(0, 400), ll(120, 400)], lengthM: 120, name: "Far Lane" },
];
const PARALLEL: RoadEdge = { id: "path", startNodeId: "P", endNodeId: "Q", coords: [ll(0, -3), ll(200, -3)], lengthM: 200, name: "Side Path" };

/** A walk through metre waypoints, a fix every 5 m at 1.25 m/s with 5 m accuracy. */
const walk = (waypoints: [number, number][], opts: { startSeq?: number; startAt?: number } = {}): TrackPoint[] => {
  const dense: [number, number][] = [];
  for (let i = 1; i < waypoints.length; i++) {
    const [ax, ay] = waypoints[i - 1];
    const [bx, by] = waypoints[i];
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 5));
    for (let k = 0; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  dense.push(waypoints[waypoints.length - 1]);
  return dense.map(([x, y], i) => ({ ...offset(x, y), accuracyM: 5, capturedAt: (opts.startAt ?? T0) + i * 4_000, seq: (opts.startSeq ?? 1) + i, segment: 0 }));
};

describe("match lifecycle", () => {
  it("only moves along the allowed transitions", () => {
    expect(canTransition("lobby", "preparing")).toBe(true);
    expect(canTransition("countdown", "active")).toBe(true);
    expect(canTransition("active", "completed")).toBe(false);
    expect(canTransition("completed", "active")).toBe(false);
    expect(canTransition("finalizing", "cancelled")).toBe(false);
  });

  it("switches from active to finalizing exactly at the deadline", () => {
    const m = { startsAt: new Date(T0).toISOString(), endsAt: new Date(T0 + 600_000).toISOString() };
    expect(phaseAt(m, T0 - 1)).toBe("countdown");
    expect(phaseAt(m, T0 + 599_999)).toBe("active");
    expect(phaseAt(m, T0 + 600_000)).toBe("finalizing");
  });

  it("balances teams by join order and needs both teams filled", () => {
    const teams = balanceTeams(["a", "b", "c", "d", "e"].map((id, i) => ({ userId: id, joinedAt: new Date(T0 + i).toISOString() })));
    expect([...teams.values()]).toEqual(["blue", "orange", "blue", "orange", "blue"]);
    expect(teamsReady(["blue", "orange"])).toBe(true);
    expect(teamsReady(["blue", "blue"])).toBe(false);
    expect(teamsReady(["blue", null])).toBe(false);
    expect(MATCH_LIMITS.minPlayers).toBe(2);
  });

  it("calls near-equal areas a tie", () => {
    expect(winnerOf({ blue: 10_000, orange: 10_005 }, "m2")).toBe("tie");
    expect(winnerOf({ blue: 10_000, orange: 10_200 }, "m2")).toBe("orange");
    expect(winnerOf({ blue: 92.04, orange: 92 }, "points")).toBe("tie");
  });
});

describe("road coverage", () => {
  it("does not capture at 69%", () => {
    const c = matchRoads(walk([[0, 0], [138, 0]]), EDGES).get("ab")!;
    expect(c.share).toBeGreaterThan(0.66);
    expect(c.share).toBeLessThan(0.7);
    expect(capturable(c)).toBe(false);
  });

  it("captures at 70% or more", () => {
    const c = matchRoads(walk([[0, 0], [142, 0]]), EDGES).get("ab")!;
    expect(c.share).toBeGreaterThanOrEqual(0.7);
    expect(capturable(c)).toBe(true);
  });

  it("does not capture by touching an endpoint", () => {
    // Walk along Elm Street only: Oak Street's end at B is touched, nothing more.
    const cover = matchRoads(walk([[200, 0], [200, 150]]), EDGES);
    expect(cover.get("ab")!.share).toBeLessThan(0.05);
    expect(capturable(cover.get("bc"))).toBe(true);
  });

  it("does not count a GPS jump as walking the road", () => {
    const start = walk([[0, 0], [20, 0]]);
    const jump = { ...offset(190, 0), accuracyM: 5, capturedAt: start[start.length - 1].capturedAt + 4_000, seq: 100, segment: 0 };
    const end = walk([[190, 0], [200, 0]], { startSeq: 101, startAt: jump.capturedAt + 4_000 });
    const c = matchRoads([...start, jump, ...end], EDGES).get("ab")!;
    expect(c.coveredM).toBeLessThan(40);
  });

  it("leaves points between two parallel paths unassigned", () => {
    const c = matchRoads(walk([[0, -1.5], [200, -1.5]]), [...EDGES, PARALLEL]);
    expect(c.get("ab")!.share).toBe(0);
    expect(c.get("path")!.share).toBe(0);
  });

  it("does not count the same stretch twice", () => {
    const c = matchRoads(walk([[0, 0], [100, 0], [0, 0], [100, 0]]), EDGES).get("ab")!;
    expect(c.coveredM).toBeGreaterThan(95);
    expect(c.coveredM).toBeLessThanOrEqual(101);
  });

  it("follows a walk that turns at a junction and loops back", () => {
    const cover = matchRoads(walk([[0, 0], [200, 0], [200, 150], [200, 0], [60, 0]]), EDGES);
    expect(capturable(cover.get("ab"))).toBe(true);
    expect(capturable(cover.get("bc"))).toBe(true);
    expect(cover.get("lane")!.share).toBe(0);
  });

  it("ignores imprecise fixes", () => {
    const vague = walk([[0, 0], [200, 0]]).map((p) => ({ ...p, accuracyM: 25 }));
    expect(matchRoads(vague, EDGES).get("ab")!.share).toBe(0);
  });

  it("merges covered intervals", () => {
    expect(coveredLength([[0, 10], [5, 20], [30, 40]])).toBe(30);
  });
});

describe("road capture and score", () => {
  const owned = (ids: string[]) =>
    ids.map((id) => {
      const e = [...EDGES, { id: "cd", startNodeId: "C", endNodeId: "D", lengthM: 250 }, { id: "de", startNodeId: "D", endNodeId: "E", lengthM: 200 }].find((x) => x.id === id)!;
      return { id: e.id, startNodeId: e.startNodeId, endNodeId: e.endNodeId, lengthM: e.lengthM };
    });

  it("matches the documented example: 800 m with a 600 m network of 3 roads scores 92", () => {
    const s = roadScore([
      { id: "1", startNodeId: "A", endNodeId: "B", lengthM: 200 },
      { id: "2", startNodeId: "B", endNodeId: "C", lengthM: 200 },
      { id: "3", startNodeId: "C", endNodeId: "D", lengthM: 200 },
      { id: "4", startNodeId: "X", endNodeId: "Y", lengthM: 200 },
    ]);
    expect(s.base).toBe(80);
    expect(s.bonus).toBeCloseTo(12);
    expect(s.total).toBeCloseTo(92);
  });

  it("gives no bonus to two disconnected pieces", () => {
    const s = roadScore(owned(["ab", "lane"]));
    expect(s.components).toBe(2);
    expect(s.bonus).toBe(0);
  });

  it("gives the bonus once three connected roads are held, and takes it away when one is stolen", () => {
    const three = roadScore(owned(["ab", "bc", "cd"]));
    expect(three.largestEdges).toBe(3);
    expect(three.bonus).toBeCloseTo((600 / 10) * 0.2);
    // The other team steals the connecting road B to C.
    const broken = roadScore(owned(["ab", "cd"]));
    expect(broken.components).toBe(2);
    expect(broken.bonus).toBe(0);
  });

  it("enforces the recapture cooldown and refuses re-taking your own road", () => {
    const at = new Date(T0).toISOString();
    expect(canCapture({ team: "blue", capturedAt: at }, "orange", T0 + 60_000)).toEqual({ ok: false, reason: "cooldown" });
    expect(canCapture({ team: "blue", capturedAt: at }, "orange", T0 + ROAD_RULES.cooldownS * 1000)).toEqual({ ok: true });
    expect(canCapture({ team: "blue", capturedAt: at }, "blue", T0 + 999_000)).toEqual({ ok: false, reason: "already_yours" });
    expect(canCapture(null, "orange", T0)).toEqual({ ok: true });
  });
});

describe("importing a road graph", () => {
  it("joins ends within a few metres and flags pieces that need a look", () => {
    const g = buildGraph([
      { coords: [ll(0, 0), ll(200, 0)], name: "Oak" },
      { coords: [ll(201, 1), ll(200, 150)], name: "Elm" },
      { coords: [ll(0, 400), ll(120, 400)], name: "Lane" },
      { coords: [ll(500, 500), ll(504, 500)], name: "Stub" },
    ]);
    expect(g.nodes).toHaveLength(7);
    expect(g.edges[1].startKey).toBe(g.edges[0].endKey);
    const check = checkGraph(g.edges);
    expect(check.components).toBe(3);
    expect(check.isolated).toEqual([2, 3]);
    expect(check.tooShort).toEqual([3]);
  });
});
