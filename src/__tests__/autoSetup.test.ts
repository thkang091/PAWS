/**
 * Nearby games set up from the streets around the players: Steal Your Road's road area and Find the Mafia's route.
 * Synthetic networks (test geometry only, never production data) check the rules.
 */
import { GraphBuilder } from "./fixtures/pedestrianGraphs";
import { AREA_RULES, areaName, areaRadiusM, buildRoadArea, proposeMafiaRoute } from "../../supabase/functions/rooms/autoSetup";
import { validateSetup } from "../../supabase/functions/rooms/logic";
import { metersBetween } from "../../supabase/functions/tournament/geo";

const seeded = (seed: number) => () => {
  seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
  return seed / 2_147_483_648;
};

/** A 10 x 10 grid of 100 m blocks, with a busy road along row 9 and a private lane on column 0. */
const town = () => {
  const b = new GraphBuilder().grid(10, 10);
  b.edges = b.edges.map((e) => (e.id.startsWith("h") && e.id.endsWith("_9") ? { ...e, warnings: ["busy_road"] } : e.id.startsWith("v0_") ? { ...e, access: "private" } : e));
  b.edges = b.edges.map((e) => ({ ...e, name: e.id.startsWith("h") ? `Row ${e.id.split("_")[1]}` : `Col ${e.id.slice(1).split("_")[0]}` }) as typeof e);
  return b;
};

describe("Steal Your Road: a road area from the streets around the players", () => {
  const b = town();
  const center = b.at(450, 450);
  const area = buildRoadArea(b.graph(), center, 450);

  it("builds enough playable roads, every one a real street inside the circle", () => {
    if ("error" in area) throw new Error(area.error);
    expect(area.roads.length).toBeGreaterThanOrEqual(AREA_RULES.minRoads);
    expect(area.roads.length).toBeLessThanOrEqual(AREA_RULES.maxRoads);
    for (const r of area.roads) {
      expect(r.lengthM).toBeGreaterThanOrEqual(AREA_RULES.minRoadM);
      for (const [lng, lat] of r.coords) expect(metersBetween({ latitude: lat, longitude: lng }, center)).toBeLessThanOrEqual(451);
      expect(area.nodes.some((n) => n.key === r.startKey)).toBe(true);
      expect(area.nodes.some((n) => n.key === r.endKey)).toBe(true);
    }
  });

  it("never plays a busy road or a private lane", () => {
    const wide = buildRoadArea(b.graph(), b.at(300, 700), 650);
    if ("error" in wide) throw new Error(wide.error);
    expect(wide.roads.some((r) => r.name === "Row 9")).toBe(false);
    expect(wide.roads.some((r) => r.startKey.startsWith("g0_") && r.endKey.startsWith("g0_"))).toBe(false);
  });

  it("joins streets through plain corners so a road runs junction to junction", () => {
    // One long street bent through three corners, with side streets only at its two ends.
    const g = new GraphBuilder();
    g.node("a", 0, 0).node("b", 60, 0).node("c", 120, 20).node("d", 180, 20).node("x", 0, 80).node("y", 180, 100);
    g.edge("ab", "a", "b").edge("bc", "b", "c").edge("cd", "c", "d").edge("ax", "a", "x").edge("dy", "d", "y");
    // Spurs make a and d junctions, where a road ends.
    g.node("a2", -60, 0).node("d2", 240, 20).edge("aa2", "a", "a2").edge("dd2", "d", "d2");
    for (let i = 0; i < 6; i++) g.node(`p${i}`, 0, 80 + (i + 1) * 60).edge(`s${i}`, i ? `p${i - 1}` : "x", `p${i}`, { name: `Side ${i}` } as never);
    g.edge("xy", "x", "y");
    const r = buildRoadArea(g.graph(), g.at(90, 40), 600, { ...AREA_RULES, minRoads: 3 });
    if ("error" in r) throw new Error(r.error);
    const main = r.roads.find((x) => [x.startKey, x.endKey].sort().join() === "a,d");
    expect(main).toBeDefined();
    expect(Math.round(main!.lengthM)).toBe(Math.round(60 + Math.hypot(60, 20) + 60));
  });

  it("says so when there are too few streets, instead of making any up", () => {
    const g = new GraphBuilder().grid(2, 2);
    expect(buildRoadArea(g.graph(), g.at(50, 50), 500)).toEqual({ error: "no_roads_here" });
    expect(buildRoadArea({ nodes: [], edges: [] }, center, 500)).toEqual({ error: "no_roads_here" });
  });

  it("grows with the match length, within limits, and is named after its main street", () => {
    expect(areaRadiusM(10)).toBe(350);
    expect(areaRadiusM(20)).toBe(500);
    expect(areaRadiusM(90)).toBe(650);
    if ("error" in area) throw new Error(area.error);
    expect(areaName(area)).toMatch(/^Streets around (Row|Col) \d$/);
  });
});

describe("Find the Mafia: a route proposed from the meeting point", () => {
  const b = town();
  const here = b.at(452, 448);

  it("gives two shared corners and one branch for each role, which the server accepts", () => {
    const p = proposeMafiaRoute(b.graph(), here, 15, seeded(7));
    if ("error" in p) throw new Error(p.error);
    expect(p.checkpoints.map((c) => c.audience).sort()).toEqual(["all", "all", "civilian", "mafia"]);
    expect(validateSetup(p.checkpoints)).toBeNull();
    // The meeting point snaps to the corner the host is standing at (68 m away here).
    expect(metersBetween(p.meet, b.at(500, 400))).toBeLessThan(0.5);
    // Too far from any corner, it stays where the host stands.
    const open = proposeMafiaRoute(b.graph(), b.at(450, 450), 15, seeded(7), { walkMps: 1.1, snapM: 50, minGapM: 90 });
    if ("error" in open) throw new Error(open.error);
    expect(metersBetween(open.meet, b.at(450, 450))).toBeLessThan(0.5);
  });

  it("puts every checkpoint on a real corner, apart from the others, within the walking time", () => {
    const g = b.graph();
    for (const seed of [1, 2, 3, 4, 5]) {
      const p = proposeMafiaRoute(g, here, 15, seeded(seed));
      if ("error" in p) throw new Error(p.error);
      for (const c of p.checkpoints) expect(g.nodes.some((n) => metersBetween(n, c) < 0.5)).toBe(true);
      for (const a of p.checkpoints) for (const c of p.checkpoints) if (a !== c) expect(metersBetween(a, c)).toBeGreaterThanOrEqual(90);
      // Straight-line legs are a floor for the walk; the streets add some, the budget (990 m) covers a grid.
      expect(Math.max(p.walkM.civilian, p.walkM.mafia)).toBeLessThan(15 * 60 * 1.1);
    }
  });

  it("names corners after the streets that meet there", () => {
    const p = proposeMafiaRoute(b.graph(), here, 15, seeded(3));
    if ("error" in p) throw new Error(p.error);
    for (const c of p.checkpoints) expect(c.label).toMatch(/^(Col|Row) \d and (Col|Row) \d$/);
  });

  it("shuffles to a different route, and the same seed gives the same one", () => {
    const g = b.graph();
    const key = (s: number) => {
      const p = proposeMafiaRoute(g, here, 15, seeded(s));
      return "error" in p ? p.error : p.checkpoints.map((c) => c.label).join("|");
    };
    expect(key(11)).toBe(key(11));
    expect(new Set([11, 12, 13, 14, 15].map(key)).size).toBeGreaterThan(1);
  });

  it("refuses where there are no streets to walk", () => {
    expect(proposeMafiaRoute(new GraphBuilder().grid(2, 1).graph(), here, 15, seeded(1))).toEqual({ error: "no_route_here" });
  });
});
