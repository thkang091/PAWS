import {
  GPS_RULES,
  SUBMIT_GRACE_MS,
  canHandIn,
  canStartWalk,
  cleanTrack,
  evaluateTerritory,
  planAppend,
  planSubmit,
  rankBoard,
  screenFix,
  summarizeTrack,
  tournamentPhase,
  type SessionRow,
  type TournamentTimes,
  type TrackPoint,
} from "../../supabase/functions/tournament/geo";
import { T0, circle, figureEight, fromMeters, goodLoop, offset } from "./fixtures/gpsWalks";

const HOUR = 3_600_000;
const tournament: TournamentTimes = {
  status: "scheduled",
  registrationOpensAt: new Date(T0 - 48 * HOUR).toISOString(),
  startsAt: new Date(T0 - HOUR).toISOString(),
  endsAt: new Date(T0 + 2 * HOUR).toISOString(),
};
const session = (over: Partial<SessionRow> = {}): SessionRow => ({
  id: "s1",
  user_id: "me",
  tournament_id: "t1",
  status: "active",
  started_at: new Date(T0).toISOString(),
  last_seq: 0,
  last_submit_attempt_at: null,
  ...over,
});

describe("territory from a walk", () => {
  it("accepts a closed loop and measures its real area", () => {
    const t = evaluateTerritory(goodLoop());
    expect(t.issues).toEqual([]);
    expect(t.ok).toBe(true);
    expect(t.distanceM).toBeGreaterThan(370);
    // A 60 m circle is 11,310 m²; a 60-sided outline of it is within a fraction of a percent.
    expect(t.areaM2).toBeGreaterThan(11_100);
    expect(t.areaM2).toBeLessThan(11_350);
    // GeoJSON order: longitude first.
    expect(t.ring[0][0]).toBeCloseTo(-122.4862 + 60 / (111_320 * Math.cos((37.7694 * Math.PI) / 180)), 6);
    expect(t.ring[0]).toEqual(t.ring[t.ring.length - 1]);
  });

  it("asks to return to the start when the loop is open", () => {
    const t = evaluateTerritory(fromMeters(circle(60, 60, 0.75)));
    expect(t.ok).toBe(false);
    expect(t.issues).toContain("not_closed");
    expect(t.closureM).toBeGreaterThan(GPS_RULES.closureM);
  });

  it("closes a loop that ends within 25 m of the start", () => {
    const pts = [...goodLoop().slice(0, -1), ...fromMeters([[48, -12]], { startSeq: 61, startAt: T0 + 60 * 4_000 })];
    const t = evaluateTerritory(pts);
    expect(t.closureM).toBeLessThan(25);
    expect(t.issues).not.toContain("not_closed");
  });

  it("rejects a walk shorter than 200 m", () => {
    const t = evaluateTerritory(fromMeters(circle(20, 24)));
    expect(t.issues).toContain("too_short");
  });

  it("needs enough points for an outline", () => {
    const t = evaluateTerritory(fromMeters(circle(60, 8), { stepMs: 40_000 }));
    expect(t.issues).toContain("too_few_points");
  });

  it("rejects a route that crosses itself", () => {
    const t = evaluateTerritory(fromMeters(figureEight(100, 120)));
    expect(t.issues).toContain("self_intersecting");
    expect(t.areaM2).toBe(0);
  });

  it("smooths out a small GPS wobble that crosses itself", () => {
    const xy = circle(60, 60);
    // A two metre back-and-forth on the far side: the raw outline crosses itself there.
    const wobble: [number, number][] = [...xy.slice(0, 30), [xy[30][0], xy[30][1] + 2], [xy[29][0] - 1, xy[29][1] - 2], ...xy.slice(31)];
    const raw = fromMeters(wobble);
    const t = evaluateTerritory(raw);
    expect(t.issues).not.toContain("self_intersecting");
    expect(t.ok).toBe(true);
    expect(t.areaM2).toBeGreaterThan(10_000);
  });

  it("rejects a loop that encloses almost nothing", () => {
    // Out 120 m and straight back along the same line.
    const there = Array.from({ length: 31 }, (_, i) => [i * 4, 0] as [number, number]);
    const back = Array.from({ length: 30 }, (_, i) => [116 - i * 4, 0.5] as [number, number]);
    const t = evaluateTerritory(fromMeters([...there, ...back]));
    expect(t.ok).toBe(false);
    expect(t.issues.some((i) => i === "too_small" || i === "self_intersecting")).toBe(true);
  });

  it("ignores repeated points", () => {
    const doubled = goodLoop().flatMap((p) => [p, { ...p, seq: p.seq + 1000, capturedAt: p.capturedAt + 500 }]);
    const cleaned = cleanTrack(doubled);
    expect(cleaned.length).toBe(goodLoop().length);
    expect(evaluateTerritory(cleaned).areaM2).toBeCloseTo(evaluateTerritory(goodLoop()).areaM2, 0);
  });

  it("drops imprecise fixes", () => {
    const noisy = goodLoop().map((p, i) => (i % 5 === 2 ? { ...p, accuracyM: 80 } : p));
    const cleaned = cleanTrack(noisy);
    expect(cleaned.every((p) => (p.accuracyM ?? 99) <= GPS_RULES.poorAccuracyM)).toBe(true);
    expect(evaluateTerritory(cleaned).ok).toBe(true);
  });

  it("never counts an impossible jump", () => {
    const pts = goodLoop();
    const jumped = [...pts.slice(0, 30), { ...pts[30], ...offset(600, 600) }, ...pts.slice(31)];
    const summary = summarizeTrack(jumped);
    expect(summary.suspiciousM).toBeGreaterThan(1_000);
    expect(summary.distanceM).toBeLessThan(400);
    expect(evaluateTerritory(jumped).issues).toContain("suspicious_speed");
  });

  it("does not draw a straight line across lost signal", () => {
    // Two minutes with no fixes, then 150 m further round the loop.
    const pts = goodLoop();
    const gap = [...pts.slice(0, 20), ...pts.slice(44).map((p) => ({ ...p, capturedAt: p.capturedAt + 120_000 }))];
    const t = evaluateTerritory(gap);
    expect(t.issues).toContain("gps_gap");
  });

  it("leaves paused time out and keeps a short pause valid", () => {
    const first = fromMeters(circle(60, 60).slice(0, 31));
    const resumeAt = first[first.length - 1].capturedAt + 10 * 60_000;
    const second = fromMeters(circle(60, 60).slice(31), { segment: 1, startSeq: 32, startAt: resumeAt });
    const s = summarizeTrack([...first, ...second]);
    // 30 steps before the pause and 29 after, at 4 s each. The ten minutes paused are left out.
    expect(s.activeMs).toBe(59 * 4_000);
    expect(evaluateTerritory([...first, ...second]).ok).toBe(true);
  });

  it("breaks the outline when you moved while paused", () => {
    const first = fromMeters(circle(60, 60).slice(0, 20));
    const second = fromMeters(circle(60, 60).slice(45), { segment: 1, startSeq: 21, startAt: T0 + 30 * 60_000 });
    expect(evaluateTerritory([...first, ...second]).issues).toContain("gps_gap");
  });
});

describe("screening fixes", () => {
  const p0: TrackPoint = { ...offset(0, 0), accuracyM: 5, capturedAt: T0, seq: 1, segment: 0 };
  const fix = (east: number, at: number, accuracyM: number | null = 5) => ({ ...offset(east, 0), accuracyM, capturedAt: at });

  it("accepts a fresh, precise step", () => expect(screenFix(p0, fix(10, T0 + 4_000), T0 + 4_100, 0)).toBe("accept"));
  it("flags poor accuracy", () => expect(screenFix(p0, fix(10, T0 + 4_000, 45), T0 + 4_100, 0)).toBe("poor_accuracy"));
  it("flags a stale fix", () => expect(screenFix(p0, fix(10, T0 + 4_000), T0 + 60_000, 0)).toBe("stale"));
  it("flags out-of-order time", () => expect(screenFix(p0, fix(10, T0 - 1), T0 + 1_000, 0)).toBe("stale"));
  it("flags a repeat of the same place", () => expect(screenFix(p0, fix(1, T0 + 4_000), T0 + 4_100, 0)).toBe("duplicate"));
  it("flags impossible coordinates", () => expect(screenFix(p0, { latitude: 95, longitude: 0, accuracyM: 5, capturedAt: T0 + 1 }, T0 + 10, 0)).toBe("invalid"));
});

describe("tournament windows", () => {
  it("moves through its phases on the server clock", () => {
    expect(tournamentPhase(tournament, T0 - 72 * HOUR)).toBe("upcoming");
    expect(tournamentPhase(tournament, T0 - 2 * HOUR)).toBe("registration");
    expect(tournamentPhase(tournament, T0)).toBe("active");
    expect(tournamentPhase(tournament, T0 + 3 * HOUR)).toBe("completed");
    expect(tournamentPhase({ ...tournament, status: "cancelled" }, T0)).toBe("cancelled");
  });

  it("lets a walk that was running when the tournament closed be handed in during the grace period", () => {
    const end = Date.parse(tournament.endsAt);
    const started = new Date(end - 20 * 60_000).toISOString();
    expect(canStartWalk(tournament, end + 1)).toBe(false);
    expect(canHandIn(tournament, started, end + 10 * 60_000)).toBe(true);
    expect(canHandIn(tournament, started, end + SUBMIT_GRACE_MS + 1)).toBe(false);
    const late = planAppend({ session: session({ started_at: started }), userId: "me", tournament, incoming: [], receivedLastMinute: 0, now: end + SUBMIT_GRACE_MS + 1 });
    expect(late).toEqual({ kind: "reject", error: "window_closed" });
  });
});

describe("server planning", () => {
  it("keeps other people's walks private", () => {
    expect(planAppend({ session: session(), userId: "someone-else", tournament, incoming: [], receivedLastMinute: 0, now: T0 + 1_000 })).toEqual({ kind: "reject", error: "not_found" });
    expect(planSubmit({ session: session(), userId: "someone-else", tournament, existingSubmissionId: null, points: goodLoop(), now: T0 + HOUR })).toEqual({ kind: "reject", error: "not_found" });
  });

  it("answers a repeated hand-in with the first result", () => {
    const plan = planSubmit({ session: session({ status: "submitted" }), userId: "me", tournament, existingSubmissionId: "sub-1", points: [], now: T0 + HOUR });
    expect(plan).toEqual({ kind: "existing", submissionId: "sub-1" });
  });

  it("scores a good loop and keeps an open one going", () => {
    expect(planSubmit({ session: session(), userId: "me", tournament, existingSubmissionId: null, points: goodLoop(), now: T0 + HOUR }).kind).toBe("record");
    const open = planSubmit({ session: session(), userId: "me", tournament, existingSubmissionId: null, points: fromMeters(circle(60, 60, 0.6)), now: T0 + HOUR });
    expect(open.kind).toBe("retry");
  });

  it("rate limits hand-ins and point batches", () => {
    const recent = new Date(T0 + HOUR - 2_000).toISOString();
    expect(planSubmit({ session: session({ last_submit_attempt_at: recent }), userId: "me", tournament, existingSubmissionId: null, points: goodLoop(), now: T0 + HOUR })).toEqual({ kind: "reject", error: "slow_down" });
    expect(planAppend({ session: session(), userId: "me", tournament, incoming: new Array(10).fill({}), receivedLastMinute: 395, now: T0 + 1_000 })).toEqual({ kind: "reject", error: "too_many" });
  });

  it("stores only well-formed points", () => {
    const plan = planAppend({
      session: session(),
      userId: "me",
      tournament,
      incoming: [
        { seq: 1, segment: 0, latitude: 37.77, longitude: -122.48, accuracyM: 6, capturedAt: T0 + 1_000 },
        { seq: 0, segment: 0, latitude: 37.77, longitude: -122.48, accuracyM: 6, capturedAt: T0 + 2_000 },
        { seq: 2, segment: 0, latitude: 137, longitude: -122.48, accuracyM: 6, capturedAt: T0 + 3_000 },
        { seq: 3, segment: 0, latitude: 37.77, longitude: -122.48, accuracyM: 6, capturedAt: T0 + 60 * HOUR },
      ],
      receivedLastMinute: 0,
      now: T0 + 5_000,
    });
    expect(plan.kind).toBe("insert");
    if (plan.kind === "insert") {
      expect(plan.rows.map((r) => r.seq)).toEqual([1]);
      expect(plan.dropped).toBe(3);
    }
  });
});

describe("leaderboard order", () => {
  it("ranks by area, then earliest hand-in, keeping each player's best", () => {
    const board = rankBoard([
      { userId: "a", value: 5_000, submittedAt: "2026-11-05T10:00:00Z", submissionId: "1" },
      { userId: "b", value: 9_000, submittedAt: "2026-11-05T12:00:00Z", submissionId: "2" },
      { userId: "c", value: 9_000, submittedAt: "2026-11-05T11:00:00Z", submissionId: "3" },
      { userId: "a", value: 7_500, submittedAt: "2026-11-05T13:00:00Z", submissionId: "4" },
      { userId: "d", value: 7_500, submittedAt: "2026-11-05T13:00:00Z", submissionId: "0" },
    ]);
    expect(board.map((r) => [r.rank, r.userId])).toEqual([
      [1, "c"],
      [2, "b"],
      [3, "d"],
      [4, "a"],
    ]);
    expect(board.find((r) => r.userId === "a")?.value).toBe(7_500);
  });
});
