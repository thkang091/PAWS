import {
  CHECKPOINT_RADIUS_M,
  DEFAULT_MAFIA_SETTINGS,
  assignRoles,
  checkpointsFor,
  clampSettings,
  isAhead,
  outcome,
  phaseAt,
  reportWalk,
  roundTimes,
  tally,
  validateSetup,
  visibleClues,
  type Checkpoint,
  type Vote,
} from "../../supabase/functions/rooms/logic";
import { T0, fromMeters, offset } from "./fixtures/gpsWalks";

/** Deterministic stand-in for crypto randomness. */
const rngFrom = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const players = (n: number) => Array.from({ length: n }, (_, i) => `p${String(i + 1).padStart(2, "0")}`);
const vote = (voterId: string, targetId: string, s = 0): Vote => ({ voterId, targetId, castAt: new Date(T0 + s * 1000).toISOString() });

describe("role assignment", () => {
  it("makes exactly one Mafia and everyone else a Civilian", () => {
    const roles = assignRoles(players(7), rngFrom(3));
    expect([...roles.values()].filter((r) => r === "mafia")).toHaveLength(1);
    expect(roles.size).toBe(7);
  });

  it("needs at least four players", () => {
    expect(() => assignRoles(players(3), rngFrom(1))).toThrow("not_enough_players");
  });

  it("is fair: every player is the Mafia about equally often", () => {
    const counts = new Map<string, number>();
    const rng = rngFrom(42);
    for (let i = 0; i < 6000; i++) {
      const mafia = [...assignRoles(players(6), rng)].find(([, r]) => r === "mafia")![0];
      counts.set(mafia, (counts.get(mafia) ?? 0) + 1);
    }
    for (const c of counts.values()) expect(Math.abs(c - 1000)).toBeLessThan(120);
  });

  it("does not depend on the order players joined", () => {
    const a = assignRoles(players(5), rngFrom(9));
    const b = assignRoles([...players(5)].reverse(), rngFrom(9));
    expect([...a].sort()).toEqual([...b].sort());
  });
});

describe("votes and outcome", () => {
  const p = players(5);

  it("catches the Mafia with a clear majority", () => {
    const t = tally([vote("p01", "p03"), vote("p02", "p03"), vote("p04", "p03"), vote("p03", "p01"), vote("p05", "p02")], p, p);
    expect(t.accused).toBe("p03");
    expect(outcome("p03", t.accused)).toEqual({ winner: "civilians", reason: "caught" });
  });

  it("lets the Mafia escape when the wrong player is accused", () => {
    const t = tally([vote("p01", "p02"), vote("p03", "p02"), vote("p04", "p02")], p, p);
    expect(outcome("p05", t.accused)).toEqual({ winner: "mafia", reason: "escaped" });
  });

  it("treats a tie as no accusation", () => {
    const t = tally([vote("p01", "p02"), vote("p02", "p01"), vote("p03", "p04"), vote("p04", "p03")], p, p);
    expect(t.accused).toBeNull();
    expect(outcome("p05", t.accused)).toEqual({ winner: "mafia", reason: "tie" });
  });

  it("counts only the first vote from each player", () => {
    const t = tally([vote("p01", "p02", 1), vote("p01", "p03", 2), vote("p01", "p03", 3), vote("p04", "p02", 4)], p, p);
    expect(t.totals).toEqual({ p02: 2 });
    expect(t.counted).toBe(2);
  });

  it("ignores votes from players who left and votes for strangers", () => {
    const stillHere = p.filter((id) => id !== "p05");
    const t = tally([vote("p05", "p01"), vote("p02", "intruder"), vote("p03", "p01")], stillHere, p);
    expect(t.totals).toEqual({ p01: 1 });
  });

  it("refuses self-votes unless the room allows them", () => {
    expect(tally([vote("p01", "p01")], p, p).counted).toBe(0);
    expect(tally([vote("p01", "p01")], p, p, true).counted).toBe(1);
  });

  it("gives the round to the civilians if the Mafia walks out", () => {
    expect(outcome("p02", null, true)).toEqual({ winner: "civilians", reason: "mafia_left" });
  });
});

describe("round timing", () => {
  const times = roundTimes(T0, DEFAULT_MAFIA_SETTINGS);

  it("walks, discusses, votes, then finishes on the server clock", () => {
    expect(phaseAt(times, T0 + 60_000, false)).toBe("walking");
    expect(phaseAt(times, Date.parse(times.walkingEndsAt) + 1, false)).toBe("discussion");
    expect(phaseAt(times, Date.parse(times.discussionEndsAt) + 1, false)).toBe("voting");
    expect(phaseAt(times, Date.parse(times.votingEndsAt) + 1, false)).toBe("finished");
  });

  it("finishes voting early once everyone has voted", () => {
    expect(phaseAt(times, Date.parse(times.discussionEndsAt) + 1, true)).toBe("finished");
  });

  it("only moves forward, so a late or repeated request changes nothing", () => {
    expect(isAhead("discussion", "walking")).toBe(true);
    expect(isAhead("walking", "discussion")).toBe(false);
    expect(isAhead("finished", "finished")).toBe(false);
    expect(isAhead("voting", "cancelled")).toBe(false);
  });

  it("keeps settings inside safe limits", () => {
    expect(clampSettings({ walkMinutes: 90, votingSeconds: 1 })).toMatchObject({ walkMinutes: 20, votingSeconds: 15 });
  });
});

describe("checkpoints and walks", () => {
  const cps: Checkpoint[] = [
    { id: "a", number: 1, label: "Gate", ...offset(0, 0), audience: "all" },
    { id: "b", number: 2, label: "Fountain", ...offset(200, 0), audience: "all" },
    { id: "c", number: 3, label: "Bench", ...offset(200, 150), audience: "civilian" },
    { id: "d", number: 4, label: "Oak tree", ...offset(200, -150), audience: "mafia" },
  ];
  const window = { startsAt: T0, endsAt: T0 + 20 * 60_000 };
  const walkTo = (path: [number, number][]) => {
    const dense: [number, number][] = [];
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1];
      const [bx, by] = path[i];
      const n = Math.round(Math.hypot(bx - ax, by - ay) / 5);
      for (let k = 0; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
    }
    dense.push(path[path.length - 1]);
    return fromMeters(dense);
  };

  it("shows each role only shared checkpoints and its own branch", () => {
    expect(checkpointsFor(cps, "civilian").map((c) => c.number)).toEqual([1, 2, 3]);
    expect(checkpointsFor(cps, "mafia").map((c) => c.number)).toEqual([1, 2, 4]);
  });

  it("credits checkpoints the walk really passed", () => {
    const r = reportWalk(walkTo([[0, 0], [200, 0], [200, 150]]), checkpointsFor(cps, "civilian"), window);
    expect(r).toEqual({ ok: true, reached: [1, 2, 3], distanceM: expect.any(Number) });
  });

  it(`does not credit a checkpoint passed more than ${CHECKPOINT_RADIUS_M} m away`, () => {
    const r = reportWalk(walkTo([[0, 0], [200, 0], [260, 150]]), checkpointsFor(cps, "civilian"), window);
    expect(r.ok && r.reached).toEqual([1, 2]);
  });

  it("rejects an invalid walk that jumps to a checkpoint", () => {
    const pts = walkTo([[0, 0], [40, 0]]);
    const teleport = [...pts, { ...pts[pts.length - 1], ...offset(200, 150), seq: 99, capturedAt: pts[pts.length - 1].capturedAt + 4_000 }];
    expect(reportWalk(teleport, checkpointsFor(cps, "civilian"), window)).toEqual({ ok: false, error: "suspicious_speed" });
  });

  it("rejects a walk recorded outside the round", () => {
    const old = walkTo([[0, 0], [200, 0]]).map((p) => ({ ...p, capturedAt: p.capturedAt - 3 * 60 * 60_000 }));
    expect(reportWalk(old, cps, window)).toEqual({ ok: false, error: "outside_round" });
  });

  it("needs the host's setup to branch", () => {
    expect(validateSetup(cps)).toBeNull();
    expect(validateSetup(cps.filter((c) => c.audience !== "mafia"))).toBe("no_mafia_branch");
    expect(validateSetup(cps.slice(0, 1))).toBe("too_few_checkpoints");
  });

  it("never reveals the Mafia's secret checkpoint, or unshared walks, in clues", () => {
    const reports = [
      { userId: "p01", reached: [1, 2, 3], shared: true },
      { userId: "p02", reached: [1, 2, 4], shared: true },
      { userId: "p03", reached: [1], shared: false },
    ];
    expect(visibleClues(reports, cps, false)).toEqual([
      { userId: "p01", reached: [1, 2, 3] },
      { userId: "p02", reached: [1, 2] },
    ]);
    expect(visibleClues(reports, cps, true).find((c) => c.userId === "p02")?.reached).toEqual([1, 2, 4]);
    expect(visibleClues(reports, cps, true).some((c) => c.userId === "p03")).toBe(false);
  });
});
