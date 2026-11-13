/**
 * Number Trail matches (Phase N2): the official judgement of a walk (start check, digits in order, connector, GPS
 * rules), progress phases, the completion-order policy, the lifecycle table (kept equal to the database's), and how
 * the service draws and stores a number. Synthetic test grid only; the same service code runs against a real database
 * in numberRaceDb.test.ts.
 */
import { GraphBuilder } from "./fixtures/pedestrianGraphs";
import { planNumberRoutes, planPieces, type NumberPlan, type PlanPiece } from "../../supabase/functions/tournament/numberRoutes";
import {
  MATCH_RULES,
  TRANSITIONS,
  MATCH_STATUSES,
  buildCourse,
  canTransition,
  courseProblem,
  courseView,
  finishOrder,
  playerPhase,
  publicProgress,
  rankRest,
  trackFingerprint,
  verifyRace,
  type Attempt,
  type NumberCourse,
} from "../../supabase/functions/tournament/numberMatch";
import { NUMBER_ACTIONS, networkFingerprint, type NumberDeps } from "../../supabase/functions/tournament/numberService";
import type { TrackPoint } from "../../supabase/functions/tournament/geo";

declare const require: (m: string) => any;
const fs = require("fs");
const path = require("path");
declare const __dirname: string;
const { createHash } = require("crypto") as { createHash: (a: string) => { update: (t: string) => { digest: (e: string) => string } } };

const grid = new GraphBuilder().grid(10, 10, 90);
const GRID = grid.graph();
const START = grid.at(405, 405);
const RESULT = planNumberRoutes(GRID, { start: START, minutes: 25 });
const plans = RESULT.plans;
const T0 = Date.UTC(2026, 10, 6, 9, 0, 0);
const WINDOW = { raceStartMs: T0, nowMs: T0 + 3 * 3600_000 };
const M_LAT = 110_540;
const mLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180);
type LL = { latitude: number; longitude: number };

/** Points every 5 m along coordinates, in order, with seeded noise. */
const walk = (coords: readonly [number, number][], opts: { start?: number; seq?: number; segment?: number; mps?: number; seed?: number } = {}): TrackPoint[] => {
  const pathLL: LL[] = [];
  for (const [lng, lat] of coords) {
    const last = pathLL[pathLL.length - 1];
    if (!last || last.latitude !== lat || last.longitude !== lng) pathLL.push({ latitude: lat, longitude: lng });
  }
  let seed = opts.seed ?? 11;
  const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647) * 2 - 1;
  const out: TrackPoint[] = [];
  let t = opts.start ?? T0 + 1000;
  let seq = opts.seq ?? 1;
  const emit = (p: LL) => {
    out.push({ latitude: p.latitude + (rand() * 3) / M_LAT, longitude: p.longitude + (rand() * 3) / mLng(p.latitude), accuracyM: 8, capturedAt: t, seq: seq++, segment: opts.segment ?? 0 });
    t += (5 / (opts.mps ?? 1.25)) * 1000;
  };
  for (let i = 1; i < pathLL.length; i++) {
    const a = pathLL[i - 1];
    const b = pathLL[i];
    const len = Math.hypot((b.latitude - a.latitude) * M_LAT, (b.longitude - a.longitude) * mLng(a.latitude));
    const n = Math.max(1, Math.round(len / 5));
    for (let k = 0; k < n; k++) emit({ latitude: a.latitude + ((b.latitude - a.latitude) * k) / n, longitude: a.longitude + ((b.longitude - a.longitude) * k) / n });
  }
  emit(pathLL[pathLL.length - 1]);
  return out;
};

const parts = (plan: NumberPlan) => {
  const ps = planPieces(plan, GRID);
  const pick = (f: (p: PlanPiece) => boolean) => ps.filter(f).flatMap((p) => p.coords);
  return {
    approach: pick((p) => p.part === "approach"),
    one: pick((p) => p.part === "digit" && p.digit === 0),
    connector: pick((p) => p.part === "connector"),
    two: pick((p) => p.part === "digit" && p.digit === 1),
    all: ps.flatMap((p) => p.coords),
  };
};
const continueFrom = (pts: TrackPoint[]) => ({ start: pts[pts.length - 1].capturedAt + 4000, seq: pts[pts.length - 1].seq + 1 });

// A plan whose approach is long enough that skipping the start is a real shortcut.
const longApproach = plans.filter((p) => p.approachM >= 150).sort((a, b) => b.connectorM - a.connectorM)[0];
const plan = longApproach ?? plans[0];
const course = buildCourse(plan, GRID);
const P = parts(plan);

describe("the course", () => {
  it("is built from the plan's own streets, keeps the number as two characters and survives a round trip as JSON", () => {
    expect(plans.length).toBeGreaterThan(5);
    const zero = plans.find((p) => p.number[0] === "0")!;
    const c = buildCourse(zero, GRID);
    expect(c.number).toBe(zero.number);
    expect(c.number).toHaveLength(2);
    expect(c.digits.map((d) => d.digit).join("")).toBe(zero.number);
    const back = JSON.parse(JSON.stringify(c)) as NumberCourse;
    expect(courseProblem(back)).toBeNull();
    expect(back.number).toBe(zero.number);
    // Every stroke, connector and approach edge is a real edge of the network.
    const ids = new Set(GRID.edges.map((e) => e.id));
    for (const e of [...c.digits[0].edges, ...c.digits[1].edges, ...c.connector, ...c.approach]) expect(ids.has(e.edgeId)).toBe(true);
    expect(c.connector.map((e) => e.edgeId)).toEqual(zero.legs.filter((l) => l.part === "connector").map((l) => l.edgeId));
  });

  it("the drawing view carries polylines only, and the same number", () => {
    const v = courseView(course);
    expect(v.number).toBe(course.number);
    expect(v.digits[0].strokes.length).toBe(course.digits[0].edges.length);
    expect(Object.keys(v)).not.toContain("legs");
  });

  it("courseProblem refuses malformed stored courses", () => {
    expect(courseProblem(null)).toBe("no_course");
    expect(courseProblem({ ...course, number: "7a" })).toBe("bad_number");
    // "0" is a real single-digit number since L1; a two-digit course can't claim it.
    expect(courseProblem({ ...course, number: "0" })).toBe("bad_digits");
    expect(courseProblem({ ...course, number: "123" })).toBe("bad_number");
    // "7" is a real single-digit number now; a two-digit course can't claim it.
    expect(courseProblem({ ...course, number: "7" })).toBe("bad_digits");
    expect(courseProblem({ ...course, digits: [course.digits[1], course.digits[0]] })).toBe(course.number[0] === course.number[1] ? null : "digits_mismatch");
    expect(courseProblem({ ...course, digits: [{ ...course.digits[0], edges: [] }, course.digits[1]] })).toBe("empty_digit");
  });

  it("every feasible plan fits its walking time, for 15, 25 and 40 minutes", () => {
    for (const minutes of [15, 25, 40]) {
      const r = planNumberRoutes(GRID, { start: START, minutes });
      const target = minutes * 60 * 1.1;
      for (const p of r.plans) {
        expect(p.raceM).toBeGreaterThanOrEqual(target * 0.45 - 1);
        expect(p.raceM).toBeLessThanOrEqual(target * 1.1 + 1);
      }
      expect(MATCH_RULES.limitMinutes(minutes)).toBe(minutes * 2 + 15);
    }
  });
});

describe("judging a walk (verifyRace)", () => {
  const honest = walk(P.all);

  it("an honest walk from the start finishes: digit one, connector, digit two", () => {
    const v = verifyRace(honest, course, WINDOW);
    expect(v.reasons).toEqual([]);
    expect(v.eligible).toBe(true);
    expect(v.phase).toBe("DIGIT_2_COMPLETE");
    expect(v.startSeq).toBe(1);
    expect(v.connector.valid).toBe(true);
    expect(v.connector.share).toBeGreaterThanOrEqual(MATCH_RULES.connectorShare);
  });

  it("digit one alone: complete digit one, then the connector, not finished", () => {
    const one = walk([...P.approach, ...P.one]);
    const v = verifyRace(one, course, WINDOW);
    expect(v.progress.digits[0].complete).toBe(true);
    // Digit one completes at 90%; the last metres of its final stroke may already touch the connector's first street.
    expect(["DIGIT_1_COMPLETE", "CONNECTOR_IN_PROGRESS"]).toContain(v.phase);
    expect(v.reasons).toEqual(["digit_two_incomplete"]);
    const onConnector = walk([...P.approach, ...P.one, ...P.connector.slice(0, Math.max(2, Math.floor(P.connector.length / 2)))]);
    expect(["CONNECTOR_IN_PROGRESS", "DIGIT_2_IN_PROGRESS"]).toContain(verifyRace(onConnector, course, WINDOW).phase);
  });

  it("phases follow the walk: pending, digit one, connector, digit two", () => {
    const first = walk(P.approach);
    expect(verifyRace(first, course, WINDOW).phase).toBe("DIGIT_1_PENDING");
    const partOne = walk([...P.approach, ...P.one.slice(0, Math.ceil(P.one.length / 2))]);
    expect(verifyRace(partOne, course, WINDOW).phase).toBe("DIGIT_1_IN_PROGRESS");
    const partTwo = walk([...P.approach, ...P.one, ...P.connector, ...P.two.slice(0, 2)]);
    expect(verifyRace(partTwo, course, WINDOW).phase).toBe("DIGIT_2_IN_PROGRESS");
  });

  it("wrong digit order: digit two first earns nothing for digit two", () => {
    const backwards = walk([...P.approach, ...P.two, ...P.one]);
    const v = verifyRace(backwards, course, WINDOW);
    expect(v.eligible).toBe(false);
    expect(v.progress.digits[1].complete).toBe(false);
  });

  it("a missing segment of digit two is incomplete", () => {
    const strokes = planPieces(plan, GRID).filter((p) => p.part === "digit" && p.digit === 1);
    const lastSeg = strokes[strokes.length - 1].segment;
    const skipped = strokes.filter((p) => p.segment !== lastSeg).flatMap((p) => p.coords);
    const v = verifyRace(walk([...P.approach, ...P.one, ...P.connector, ...skipped]), course, WINDOW);
    expect(v.eligible).toBe(false);
    expect(v.reasons).toContain("digit_two_incomplete");
  });

  it("a walk that never goes to the start counts for nothing (pre-positioning gains nothing)", () => {
    expect(plan.approachM).toBeGreaterThanOrEqual(150);
    const skip = walk([...P.one, ...P.connector, ...P.two]);
    const v = verifyRace(skip, course, WINDOW);
    expect(v.startSeq).toBeNull();
    expect(v.reasons[0]).toBe("not_at_start");
    expect(v.progress.digits[0].coverage).toBe(0);
    expect(publicProgress(v).atStart).toBe(false);
  });

  it("fixes before the start time, or from an old walk, are ignored", () => {
    const replay = walk(P.all, { start: T0 - 3600_000 });
    const v = verifyRace(replay, course, WINDOW);
    expect(v.eligible).toBe(false);
    expect(v.startSeq).toBeNull();
    const waiting = walk(P.all, { start: T0 - 60_000 });
    // Started a minute early: the minute before the start is ignored, the check-in happens after it.
    expect(verifyRace(waiting, course, WINDOW).startSeq).not.toBe(1);
  });

  it("a jump between the digits is an invalid connector and needs review", () => {
    const one = walk([...P.approach, ...P.one]);
    const two = walk(P.two, { start: one[one.length - 1].capturedAt + 5_000, seq: one[one.length - 1].seq + 1 });
    const v = verifyRace([...one, ...two], course, WINDOW);
    expect(v.eligible).toBe(false);
    expect(v.reasons).toEqual(expect.arrayContaining(["gps_review"]));
  });

  it("a pause between the digits never bridges the connector", () => {
    const one = walk([...P.approach, ...P.one]);
    // Paused at the end of digit one, resumed (new segment) at digit two: nothing in between was witnessed.
    const two = walk(P.two, { start: one[one.length - 1].capturedAt + 600_000, seq: one[one.length - 1].seq + 1, segment: 1 });
    const v = verifyRace([...one, ...two], course, WINDOW);
    expect(v.eligible).toBe(false);
    if (course.connectorM >= MATCH_RULES.connectorMinM) expect(v.reasons).toContain("connector_invalid");
  });

  it("impossible speed earns nothing", () => {
    const fast = walk(P.all, { mps: 12 });
    const v = verifyRace(fast, course, WINDOW);
    expect(v.eligible).toBe(false);
    expect(v.progress.digits[0].coverage).toBeLessThan(0.1);
  });

  it("repeated samples change nothing", () => {
    const doubled = [...honest, ...honest.map((p) => ({ ...p }))];
    const a = verifyRace(honest, course, WINDOW);
    const b = verifyRace(doubled, course, WINDOW);
    expect(b.progress.digits.map((d) => d.coverage)).toEqual(a.progress.digits.map((d) => d.coverage));
    expect(b.eligible).toBe(a.eligible);
  });

  it("is deterministic, and judges only what had arrived by the receipt", () => {
    expect(verifyRace(honest, course, WINDOW)).toEqual(verifyRace([...honest].reverse(), course, WINDOW));
    const cut = honest[Math.floor(honest.length / 2)].capturedAt;
    expect(verifyRace(honest, course, { raceStartMs: T0, nowMs: cut - 10_000 }).eligible).toBe(false);
  });

  it("the track fingerprint is the same for a replayed walk and differs for another walk", () => {
    expect(trackFingerprint(honest)).toBe(trackFingerprint(honest.map((p) => ({ ...p, capturedAt: p.capturedAt + 86_400_000 }))));
    expect(trackFingerprint(honest)).not.toBe(trackFingerprint(walk(P.all, { seed: 99 })));
  });
});

describe("what a player sees (playerPhase)", () => {
  it("a finish being checked, verified or refused shows over the walk", () => {
    expect(playerPhase("DIGIT_2_COMPLETE", { status: "pending", throughSeq: 10 }, 10)).toBe("FINISH_PENDING_VERIFICATION");
    expect(playerPhase("DIGIT_2_COMPLETE", { status: "verified", throughSeq: 10 }, 10)).toBe("VERIFIED_COMPLETE");
    expect(playerPhase("DIGIT_2_IN_PROGRESS", { status: "rejected", throughSeq: 10 }, 10)).toBe("INVALID_COMPLETION");
    // Walking on after a refusal shows the walk again.
    expect(playerPhase("DIGIT_2_IN_PROGRESS", { status: "rejected", throughSeq: 10 }, 40)).toBe("DIGIT_2_IN_PROGRESS");
    expect(playerPhase("DIGIT_1_PENDING", null, 0)).toBe("DIGIT_1_PENDING");
  });
});

describe("who won (finishOrder): the policy the database applies", () => {
  const a = (userId: string, receiptSeq: number, status: Attempt["status"], receivedAt = receiptSeq * 1000): Attempt => ({ userId, receiptSeq, status, receivedAt });

  it("first verified receipt wins", () => {
    expect(finishOrder([a("b", 2, "verified"), a("a", 1, "verified")]).winner?.userId).toBe("a");
  });
  it("an invalid first attempt does not win", () => {
    expect(finishOrder([a("a", 1, "rejected"), a("b", 2, "verified")]).winner?.userId).toBe("b");
  });
  it("a later verified receipt waits for an earlier one still being checked", () => {
    const r = finishOrder([a("a", 1, "pending"), a("b", 2, "verified")]);
    expect(r.winner).toBeNull();
    expect(r.waitingOn?.userId).toBe("a");
  });
  it("near-simultaneous receipts: strictly ordered, reported as a photo finish", () => {
    const r = finishOrder([a("a", 1, "verified", 10_000), a("b", 2, "verified", 10_400)]);
    expect(r.winner?.userId).toBe("a");
    expect(r.photoFinish).toBe(true);
    expect(finishOrder([a("a", 1, "verified", 10_000), a("b", 2, "verified", 20_000)]).photoFinish).toBe(false);
  });
  it("a player is placed once, by their first verified receipt; expired checks don't count", () => {
    const r = finishOrder([a("a", 1, "expired"), a("a", 3, "verified"), a("b", 2, "verified"), a("a", 4, "verified")]);
    expect(r.order.map((x) => x.userId)).toEqual(["b", "a"]);
  });
  it("non-finishers rank by digits done, then coverage; equal walks share a place", () => {
    expect(rankRest([{ userId: "x", digitsDone: 1, coverage: 0.5 }, { userId: "y", digitsDone: 1, coverage: 0.5 }, { userId: "z", digitsDone: 0, coverage: 0.9 }], 3)).toEqual([
      { userId: "x", placement: 3 },
      { userId: "y", placement: 3 },
      { userId: "z", placement: 5 },
    ]);
  });
});

describe("the lifecycle", () => {
  it("matches number_can_transition in the migration, move for move", () => {
    // The newest migration that defines it wins.
    const sqlText: string = fs.readFileSync(path.join(__dirname, "../../supabase/migrations/20270114120000_number_trail_practice_online.sql"), "utf8");
    const body = sqlText.slice(sqlText.indexOf("function public.number_can_transition"), sqlText.indexOf("trg_number_match_guard"));
    const fromSql: Record<string, string[]> = {};
    for (const m of body.matchAll(/when '([a-z_]+)' then p_to in \(([^)]*)\)/g)) fromSql[m[1]] = [...m[2].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    for (const s of MATCH_STATUSES) expect(fromSql[s] ?? []).toEqual([...TRANSITIONS[s]].sort());
  });
  it("completed and cancelled are final; nothing skips the countdown", () => {
    for (const s of MATCH_STATUSES) {
      expect(canTransition("completed", s)).toBe(false);
      expect(canTransition("cancelled", s)).toBe(false);
    }
    expect(canTransition("ready", "active")).toBe(false);
    expect(canTransition("waiting", "countdown")).toBe(false);
  });
});

/** The service's prepare step with an in-memory stand-in for the database functions it calls. */
const fakeDb = (difficulty: "easy" | "medium" | "hard" | null = null, previousNumber: string | null = null) => {
  const db = { cache: new Map<string, unknown>(), course: null as null | { course: NumberCourse; feasible: number }, failed: [] as string[], calls: [] as string[] };
  const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    db.calls.push(name);
    switch (name) {
      case "number_begin_prepare":
        return { token: "t", minutes: 25, difficulty, previousNumber } as T;
      case "number_plan_cache_get":
        return (db.cache.get(args.p_key as string) ?? null) as T;
      case "number_plan_cache_put":
        db.cache.set(args.p_key as string, { outcome: args.p_outcome, plans: JSON.parse(JSON.stringify(args.p_plans)) });
        return null as T;
      case "number_prepare_failed":
        db.failed.push(args.p_reason as string);
        return null as T;
      case "number_record_course":
        db.course = { course: args.p_course as NumberCourse, feasible: args.p_feasible as number };
        return { number: (args.p_course as NumberCourse).number } as T;
      default:
        throw new Error(`unexpected ${name}`);
    }
  };
  return { db, rpc };
};
const depsWith = (rpc: NumberDeps["rpc"], random: () => number, graph = GRID): NumberDeps & { loads: number } => {
  const d = {
    rpc,
    loads: 0,
    loadNetwork: async () => {
      d.loads++;
      return { graph, source: "osm" as const, sources: [] };
    },
    now: Date.now,
    random,
    sha256: async (t: string) => createHash("sha256").update(t).digest("hex"),
    log: () => undefined,
    planBudgetMs: 60_000,
  };
  return d;
};
const body = { matchId: "00000000-0000-4000-8000-000000000001", ...START };

describe("drawing the number (service prepare)", () => {
  const feasible = new Set(plans.map((p) => p.number));

  it("draws uniformly from feasible numbers only, plans once, then reuses the cache", async () => {
    const { db, rpc } = fakeDb();
    let k = 0;
    const deps = depsWith(rpc, () => ((k += 0.137) % 1));
    const drawn = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const r = await NUMBER_ACTIONS.number_prepare(deps, "host", body);
      expect(r.status).toBe(200);
      expect(feasible.has(r.body.number as string)).toBe(true);
      expect(db.course!.course.number).toBe(r.body.number);
      drawn.add(r.body.number as string);
      expect(r.body.cached).toBe(i > 0);
    }
    expect(drawn.size).toBeGreaterThan(3);
    expect(db.cache.size).toBe(1);
    expect(db.course!.feasible).toBe(feasible.size);
  });

  it("a leading zero stays: '0x' is drawn and stored as two characters", async () => {
    const { db, rpc } = fakeDb();
    const zeros = [...feasible].sort();
    expect(zeros[0][0]).toBe("0");
    const r = await NUMBER_ACTIONS.number_prepare(depsWith(rpc, () => 0), "host", body);
    expect(r.body.number).toBe(zeros[0]);
    expect(db.course!.course.number).toBe(zeros[0]);
    expect(typeof db.course!.course.number).toBe("string");
  });

  it("only the chosen difficulty, and a clear error when there is none", async () => {
    for (const d of ["easy", "medium", "hard"] as const) {
      const { db, rpc } = fakeDb(d);
      const r = await NUMBER_ACTIONS.number_prepare(depsWith(rpc, () => 0.5), "host", body);
      if (plans.some((p) => p.difficulty === d)) expect(db.course!.course.difficulty).toBe(d);
      else {
        expect(r.body).toEqual({ ok: false, error: "no_routes_for_difficulty" });
        expect(db.failed).toEqual(["no_routes_for_difficulty"]);
      }
    }
  });

  it("'new number' never redraws the same number when another is feasible", async () => {
    for (let i = 0; i < 6; i++) {
      const prev = plans[i].number;
      const { rpc } = fakeDb(null, prev);
      const r = await NUMBER_ACTIONS.number_prepare(depsWith(rpc, () => (i * 0.17) % 1), "host", body);
      expect(r.body.number).not.toBe(prev);
    }
  });

  it("a cached plan that no longer fits the network is never used", async () => {
    const { db, rpc } = fakeDb();
    const deps = depsWith(rpc, () => 0);
    await NUMBER_ACTIONS.number_prepare(deps, "host", body);
    const first = db.course!.course.number;
    // The network changes under the cache: the first plan's first stroke street is gone, same fingerprint forced.
    const firstPlan = plans.find((p) => p.number === first)!;
    const gone = firstPlan.digits[0].strokeEdgeIds[0];
    const changed = { nodes: GRID.nodes, edges: GRID.edges.filter((e) => e.id !== gone) };
    const fp = await networkFingerprint(GRID, deps.sha256);
    const key = [...db.cache.keys()][0];
    expect(key).toContain(fp);
    const r = await NUMBER_ACTIONS.number_prepare({ ...depsWith(rpc, () => 0, changed), sha256: async (t) => (t.includes(gone) ? fp : fp) }, "host", body);
    expect(r.status).toBe(200);
    expect(r.body.number).not.toBe(first);
  });

  it("no streets for numbers: a clear, recoverable error and no number", async () => {
    const { db, rpc } = fakeDb();
    const tiny = new GraphBuilder().grid(3, 3, 40).graph();
    const r = await NUMBER_ACTIONS.number_prepare(depsWith(rpc, () => 0, tiny), "host", { ...body, ...new GraphBuilder().at(40, 40) });
    expect(r.body.ok).toBe(false);
    expect(["no_number_routes", "no_public_start"]).toContain(r.body.error);
    expect(db.course).toBeNull();
    expect(db.failed).toHaveLength(1);
  });

  it("bad requests never reach the database", async () => {
    const { db, rpc } = fakeDb();
    const deps = depsWith(rpc, () => 0);
    expect((await NUMBER_ACTIONS.number_prepare(deps, "host", { ...body, latitude: 200 })).body).toEqual({ ok: false, error: "bad_request" });
    expect((await NUMBER_ACTIONS.number_prepare(deps, "host", { ...body, matchId: "x" })).body).toEqual({ ok: false, error: "bad_request" });
    expect((await NUMBER_ACTIONS.number_finish(deps, "host", { matchId: body.matchId, requestKey: "short" })).body).toEqual({ ok: false, error: "bad_request" });
    expect(db.calls).toEqual([]);
  });

  it("state reads never plan or load a network (reconnects are cheap)", async () => {
    const calls: string[] = [];
    const deps = depsWith(async <T>(name: string) => {
      calls.push(name);
      return (name === "number_stale_attempts" ? [] : {}) as T;
    }, () => 0);
    for (let i = 0; i < 5; i++) await NUMBER_ACTIONS.number_state(deps, "u", { matchId: body.matchId });
    expect(deps.loads).toBe(0);
    expect(calls.every((c) => ["number_race_state", "number_advance", "number_stale_attempts"].includes(c))).toBe(true);
  });
});
