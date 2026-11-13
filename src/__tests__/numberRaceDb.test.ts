/**
 * Number Trail end to end against a real local PostgreSQL + PostGIS cluster (scripts/test-db-local.sh runs it with
 * PAWS_TEST_PGHOST set; skipped otherwise). The service code the edge function runs (numberService.ts) talks to the
 * migrated database through psql, one session per call, so parallel calls are parallel database sessions. Nothing
 * here touches a Supabase project.
 *
 * The network is a real OpenStreetMap extract when PAWS_OSM_DIR has portland_sellwood.json (© OpenStreetMap
 * contributors, ODbL; not in the repository), otherwise a synthetic test grid.
 *
 * A seven-player race: two honest walkers, one who walks only digit one, one who walks digit two first, one at
 * impossible speed, one who never goes to the start, and one whose finish check is lost and recovered.
 */
import { GraphBuilder } from "./fixtures/pedestrianGraphs";
import { osmToGraph, type OsmData } from "../../supabase/functions/tournament/osm";
import { planNumberRoutes, planPieces, type NumberPlan } from "../../supabase/functions/tournament/numberRoutes";
import type { PedGraph } from "../../supabase/functions/tournament/routes";
import type { TrackPoint } from "../../supabase/functions/tournament/geo";
import { NUMBER_ACTIONS, StoreError, type NumberDeps, type Reply } from "../../supabase/functions/tournament/numberService";
import type { RaceState } from "../../supabase/functions/tournament/numberContract";

declare const require: (m: string) => any;
declare const process: { env: Record<string, string | undefined> };
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { createHash, randomUUID } = require("crypto") as { createHash: (a: string) => { update: (t: string) => { digest: (e: string) => string } }; randomUUID: () => string };

const PGHOST = process.env.PAWS_TEST_PGHOST;
const PSQL = process.env.PAWS_PSQL ?? "/opt/homebrew/opt/postgresql@17/bin/psql";
const maybe = PGHOST ? describe : describe.skip;

/** One SQL statement in its own session; returns the single value printed, parsed as JSON when it is JSON. */
const sql = (text: string): Promise<string> =>
  new Promise((resolve, reject) =>
    execFile(
      PSQL,
      ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", text],
      { env: { PGHOST, PGPORT: process.env.PAWS_TEST_PGPORT ?? "54329", PGUSER: "postgres", PGDATABASE: "paws_test", LC_ALL: "en_US.UTF-8", PATH: "/usr/bin:/bin" }, maxBuffer: 64 * 1024 * 1024 },
      (err: Error | null, stdout: string, stderr: string) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout.trim())),
    ),
  );

const lit = (v: unknown): string => {
  if (v == null) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  const tag = "$q" + Math.random().toString(36).slice(2, 8) + "$";
  return typeof v === "string" ? `${tag}${v}${tag}` : `${tag}${JSON.stringify(v)}${tag}::jsonb`;
};

const SETOF = new Set(["number_stale_attempts"]);
const VOID = new Set(["number_prepare_failed", "number_plan_cache_put"]);

/** The service-role rpc, as the edge function's supabase-js client does it, but over psql. */
const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
  const call = `public.${name}(${Object.entries(args).map(([k, v]) => `${k} => ${lit(v)}`).join(", ")})`;
  const text = SETOF.has(name) ? `select coalesce(jsonb_agg(x), '[]'::jsonb) from ${call} x` : VOID.has(name) ? `select ${call}, 'null'` : `select to_jsonb(${call})`;
  try {
    const out = await sql(text);
    if (VOID.has(name)) return null as T;
    return (out === "" ? null : JSON.parse(out)) as T;
  } catch (e) {
    throw new StoreError((e as Error).message.match(/ERROR:\s+([a-z]+(?:_[a-z]+)+)/)?.[1] ?? "server_error");
  }
};

/** A player's own call (host actions), with their identity, as PostgREST would set it. */
const asUser = (user: string, call: string) =>
  sql(`begin; select set_config('request.jwt.claim.sub', '${user}', true) is null; select ${call}; commit;`).then((out) => {
    const line = out.split("\n").filter((l) => l && l !== "f").pop() ?? "";
    try {
      return JSON.parse(line);
    } catch {
      return line;
    }
  });

/** An honest walk along pieces: a fix every 5 m at ~1.25 m/s with up to 3 m of seeded noise. */
const walkAlong = (coords: [number, number][], t0: number, opts: { stepS?: number; seq0?: number; segment?: number; seed?: number } = {}): TrackPoint[] => {
  let seed = opts.seed ?? 5;
  const rand = () => ((seed = (seed * 48271) % 2147483647) / 2147483647) * 2 - 1;
  const out: TrackPoint[] = [];
  let t = t0;
  for (let i = 1; i < coords.length; i++) {
    const [lo1, la1] = coords[i - 1];
    const [lo2, la2] = coords[i];
    const k = 111_320 * Math.cos((la1 * Math.PI) / 180);
    const len = Math.hypot((lo2 - lo1) * k, (la2 - la1) * 110_540);
    const n = Math.max(1, Math.round(len / 5));
    for (let j = 0; j < n; j++) {
      out.push({ latitude: la1 + ((la2 - la1) * j) / n + (rand() * 3) / 110_540, longitude: lo1 + ((lo2 - lo1) * j) / n + (rand() * 3) / k, accuracyM: 8, capturedAt: t, seq: (opts.seq0 ?? 1) + out.length, segment: opts.segment ?? 0 });
      t += (opts.stepS ?? 4) * 1000;
    }
  }
  return out;
};

const networkFor = (): { graph: PedGraph; start: { latitude: number; longitude: number }; real: boolean } => {
  const dir = process.env.PAWS_OSM_DIR;
  if (dir && fs.existsSync(path.join(dir, "portland_sellwood.json"))) {
    const start = { latitude: 45.466, longitude: -122.653 };
    const data: OsmData = JSON.parse(fs.readFileSync(path.join(dir, "portland_sellwood.json"), "utf8"));
    return { graph: osmToGraph(data, start), start, real: true };
  }
  const b = new GraphBuilder().grid(10, 10, 90);
  return { graph: b.graph(), start: b.at(400, 400), real: false };
};

maybe("Number Trail race against the local database", () => {
  jest.setTimeout(300_000);
  const net = networkFor();
  const logs: { event: string; detail?: Record<string, unknown> }[] = [];
  const deps: NumberDeps = {
    rpc,
    loadNetwork: async () => ({ graph: net.graph, source: "osm", sources: [{ source: "OpenStreetMap", license: "ODbL", attribution: "© OpenStreetMap contributors" }] }),
    now: Date.now,
    // ts-jest runs the planner several times slower than Deno or Node; the budget itself is tested below.
    planBudgetMs: 30_000,
    random: () => Math.random(),
    sha256: async (t) => createHash("sha256").update(t).digest("hex"),
    log: (event, detail) => logs.push({ event, detail }),
  };
  const act = (name: keyof typeof NUMBER_ACTIONS, user: string, body: Record<string, unknown>): Promise<Reply> => NUMBER_ACTIONS[name](deps, user, body);
  const stateOf = async (user: string, matchId: string) => {
    const r = await act("number_state", user, { matchId });
    expect(r.status).toBe(200);
    return r.body as unknown as RaceState & { ok: true };
  };

  const names = ["host", "rival", "half", "backwards", "speedy", "nostart", "lost"] as const;
  const id: Record<(typeof names)[number], string> = Object.fromEntries(names.map((n) => [n, randomUUID()])) as never;
  const outsider = randomUUID();
  let roomId = "";
  let matchId = "";
  let plan: NumberPlan;
  let feasible: Set<string>;
  let skipsStart = false;

  beforeAll(async () => {
    // The throwaway cluster may hold plans from an earlier run of this file.
    await sql(`delete from public.number_trail_plan_cache`);
    await sql(`insert into auth.users (id, email) values ${[...Object.values(id), outsider].map((u) => `('${u}', 'e2e-${u.slice(0, 8)}@test.paws')`).join(", ")}`);
    const room = await asUser(id.host, `public.create_room('number_trail', 'E2E race', 10, false, 5, true, null, 'Host')`);
    roomId = room.roomId;
    for (const n of names.slice(1)) {
      await asUser(id[n], `public.join_room('${room.code}', null, null, '${n}')`);
      await asUser(id[n], `public.set_room_ready('${roomId}', true)`);
    }
    matchId = (await asUser(id.host, `public.number_create_match('${roomId}', 25, null)`)).matchId;
    const all = planNumberRoutes(net.graph, { start: net.start, minutes: 25 });
    feasible = new Set(all.plans.map((p) => p.number));
    expect(feasible.size).toBeGreaterThan(1);
    plan = all.plans[0];
  });

  it("planning that runs out of time is a recoverable state, never a partial or invented number", async () => {
    const r = await NUMBER_ACTIONS.number_prepare({ ...deps, planBudgetMs: 1 }, id.host, { matchId, ...net.start });
    expect(r).toEqual({ status: 503, body: { ok: false, error: "preparation_timeout" } });
    expect(await sql(`select status || ':' || coalesce(target_number, '-') || ':' || prepare_error from public.number_trail_matches where id = '${matchId}'`)).toBe("waiting:-:preparation_timeout");
    // A timeout is not an answer about these streets: nothing was cached.
    expect(await sql(`select count(*) from public.number_trail_plan_cache`)).toBe("0");
  });

  it("only the host can prepare; the number drawn is feasible, stored as two characters, the same for everyone", async () => {
    const refused = await act("number_prepare", id.rival, { matchId, ...net.start });
    expect(refused.body).toEqual({ ok: false, error: "not_the_host" });

    const first = await act("number_prepare", id.host, { matchId, ...net.start });
    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);
    expect(feasible.has(first.body.number as string)).toBe(true);
    expect(first.body.number).toMatch(/^[0-9]{2}$/);
    expect(logs.find((l) => l.event === "number_planned")).toBeTruthy();

    // "New number": the cached plans are reused, and a different feasible number is drawn.
    const again = await act("number_prepare", id.host, { matchId, ...net.start });
    expect(again.body.cached).toBe(true);
    expect(again.body.number).not.toBe(first.body.number);
    expect(feasible.has(again.body.number as string)).toBe(true);
    expect(logs.filter((l) => l.event === "number_planned" && l.detail?.outcome !== "timeout")).toHaveLength(1);

    const views = await Promise.all(names.map((n) => stateOf(id[n], matchId)));
    for (const v of views) {
      expect(v.match.status).toBe("ready");
      expect(v.match.number).toBe(again.body.number);
      expect(v.course?.number).toBe(again.body.number);
    }
    plan = planNumberRoutes(net.graph, { start: net.start, minutes: 25 }).plans.find((p) => p.number === again.body.number)!;
    expect(plan).toBeTruthy();
  });

  it("outsiders get nothing; reconnecting never plans again", async () => {
    expect((await act("number_state", outsider, { matchId })).body).toEqual({ ok: false, error: "not_in_match" });
    const before = logs.filter((l) => l.event === "number_planned").length;
    for (let i = 0; i < 3; i++) await stateOf(id.rival, matchId);
    expect(logs.filter((l) => l.event === "number_planned").length).toBe(before);
  });

  it("starts on the server clock with one course for all; nobody walks before the start", async () => {
    const started = await asUser(id.host, `public.number_start('${matchId}')`);
    expect(Date.parse(started.startsAt) - Date.parse(started.serverNow)).toBeGreaterThan(4_000);
    const early = await act("number_finish", id.rival, { matchId, requestKey: "early-finish-1" });
    expect(early.body).toEqual({ ok: false, error: "match_not_active" });
    // Thirty minutes of race in a moment: the whole match clock moves back (test only), and so do the walks.
    await sql(`alter table public.number_trail_matches disable trigger number_trail_matches_guard;
      update public.number_trail_matches set countdown_at = countdown_at - interval '40 minutes', starts_at = starts_at - interval '40 minutes', ends_at = ends_at - interval '40 minutes' where id = '${matchId}';
      alter table public.number_trail_matches enable trigger number_trail_matches_guard;`);
    for (const n of names) {
      const w = await act("number_walk", id[n], { matchId });
      expect(w.status).toBe(200);
    }
    await sql(`update public.gps_sessions s set started_at = m.countdown_at from public.number_trail_matches m where s.number_match_id = m.id and m.id = '${matchId}'`);
    const digests = await sql(`select count(distinct course_digest) from public.number_trail_assignments where match_id = '${matchId}'`);
    expect(digests).toBe("1");
    expect((await act("number_walk", outsider, { matchId })).body).toEqual({ ok: false, error: "not_in_match" });
  });

  const raceStart = async () => Date.parse(await sql(`select starts_at from public.number_trail_matches where id = '${matchId}'`));
  // A phone streams a fix every few seconds over half an hour; here the batches arrive in a moment, so after each one
  // its points are dated a minute earlier (test only) to stay inside the per-minute rate limit, as a real phone would.
  const send = async (user: string, points: TrackPoint[]) => {
    let last: Reply | null = null;
    for (let i = 0; i < points.length; i += 120) {
      last = await act("number_progress", user, { matchId, points: points.slice(i, i + 120) });
      expect(last.status).toBe(200);
      await sql(`update public.gps_points p set received_at = received_at - interval '61 seconds' from public.gps_sessions s where s.id = p.session_id and s.number_match_id = '${matchId}' and s.user_id = '${user}';
        update public.number_trail_progress set verified_at = verified_at - interval '10 seconds' where match_id = '${matchId}' and user_id = '${user}';`);
    }
    return last!;
  };

  it("checks every walk on the server: order, connector, start, speed", async () => {
    const t0 = (await raceStart()) + 5_000;
    const pieces = planPieces(plan, net.graph);
    const course = pieces.filter((p) => p.part !== "approach");
    const fromStart = pieces;
    const coords = (ps: typeof pieces) => ps.flatMap((p) => p.coords);

    // Honest walkers, from the start junction, digit one, connector, digit two.
    const honest = walkAlong(coords(fromStart), t0, { seed: 7 });
    const rival = walkAlong(coords(fromStart), t0 + 20_000, { seed: 11 });
    const r1 = await send(id.host, honest);
    expect(r1.body.verified).toBe(true);
    expect(r1.body.phase).toBe("DIGIT_2_COMPLETE");
    await send(id.rival, rival);

    // Digit one only.
    const half = walkAlong(coords(pieces.filter((p) => p.part === "approach" || (p.part === "digit" && p.digit === 0))), t0, { seed: 3 });
    const h = await send(id.half, half);
    expect(["DIGIT_1_COMPLETE", "CONNECTOR_IN_PROGRESS"]).toContain(h.body.phase);

    // Digit two first, then digit one: digit two earns nothing until digit one is done.
    const backwards = walkAlong(coords([...pieces.filter((p) => p.part === "approach"), ...pieces.filter((p) => p.part === "digit" && p.digit === 1), ...pieces.filter((p) => p.part === "digit" && p.digit === 0)]), t0, { seed: 9 });
    const b = await send(id.backwards, backwards);
    expect(b.body.phase).not.toBe("DIGIT_2_COMPLETE");

    // The whole course at 12 m/s.
    const speedy = walkAlong(coords(fromStart), t0, { stepS: 0.4, seed: 13 });
    const s = await send(id.speedy, speedy);
    expect(s.body.phase).toBe("DIGIT_1_PENDING");

    // The course without the walk from the start: straight onto digit one. Where digit one begins right by the start
    // there is nothing to skip, so the start check can only fail when the walk really stays away from it.
    const nostart = walkAlong(coords(course), t0, { seed: 17 });
    const ns = await send(id.nostart, nostart);
    const startNode = net.graph.nodes.find((n) => n.id === plan.approachFromNodeId)!;
    const nearest = Math.min(...nostart.map((p) => Math.hypot((p.longitude - startNode.longitude) * 111_320 * Math.cos((startNode.latitude * Math.PI) / 180), (p.latitude - startNode.latitude) * 110_540)));
    skipsStart = nearest > 50;
    expect((ns.body.progress as { atStart: boolean }).atStart).toBe(!skipsStart);

    // A complete walk for the player whose check will be lost.
    await send(id.lost, walkAlong(coords(fromStart), t0 + 40_000, { seed: 19 }));

    const events = await sql(`select string_agg(kind, ',' order by seq) from public.number_trail_events where match_id = '${matchId}' and kind like 'DIGIT_%'`);
    expect(events.split(",").filter((k) => k === "DIGIT_1_COMPLETED").length).toBeGreaterThanOrEqual(4);
  });

  it("finishes: wrong or incomplete walks are refused with a reason; one lost check is recovered; one winner by receipt order", async () => {
    // A player names someone else in the body: ignored. Their own walk is judged, and nothing is filed for the other.
    const half = await act("number_finish", id.half, { matchId, requestKey: "half-finish-0001", userId: id.host, user_id: id.host });
    expect(half.body).toMatchObject({ ok: true, status: "rejected", reason: "digit_two_incomplete", recoverable: true });
    expect(await sql(`select count(*) from public.number_trail_finish_attempts where match_id = '${matchId}' and user_id = '${id.host}'`)).toBe("0");
    const speedy = await act("number_finish", id.speedy, { matchId, requestKey: "speedy-finish-01" });
    expect(speedy.body).toMatchObject({ ok: true, status: "rejected" });
    expect(["gps_review", "digit_one_incomplete"]).toContain(speedy.body.reason);
    const nostart = await act("number_finish", id.nostart, { matchId, requestKey: "nostart-finish1" });
    if (skipsStart) expect(nostart.body).toMatchObject({ ok: true, status: "rejected", reason: "not_at_start" });
    const backwards = await act("number_finish", id.backwards, { matchId, requestKey: "backward-finish" });
    expect(backwards.body).toMatchObject({ ok: true, status: "rejected" });

    // Handing in again straight away is refused.
    expect((await act("number_finish", id.half, { matchId, requestKey: "half-finish-0002" })).body).toEqual({ ok: false, error: "slow_down" });

    // The lost check: received, then the function "stops" before reporting back.
    const lost = await rpc<{ id: string }>("number_receive_finish", { p_match_id: matchId, p_user_id: id.lost, p_request_key: "lost-finish-0001" });
    // A retry while the first check might still be running is told to wait.
    expect((await act("number_finish", id.lost, { matchId, requestKey: "lost-finish-0001" })).body).toEqual({ ok: true, status: "verifying" });

    // The two honest walkers hand in at the same moment.
    const [a, b] = await Promise.all([
      act("number_finish", id.host, { matchId, requestKey: "host-finish-0001" }),
      act("number_finish", id.rival, { matchId, requestKey: "rival-finish-001" }),
    ]);
    // Both verified, but the lost receipt is earlier and still unsettled: nobody is placed yet.
    for (const r of [a, b]) expect(r.body).toMatchObject({ ok: true, status: "verified_waiting" });
    expect(await sql(`select status from public.number_trail_matches where id = '${matchId}'`)).toBe("verifying");

    // A minute later anyone's state request finishes the lost check, and the order is decided.
    await sql(`update public.number_trail_finish_attempts set verify_started_at = verify_started_at - interval '61 seconds' where id = '${lost.id}'`);
    const after = await stateOf(id.half, matchId);
    expect(after.match.status).toBe("completed");
    expect(after.match.winnerUserId).toBe(id.lost);
    const order = await sql(`select string_agg(user_id::text, ',' order by finish_order) from public.number_trail_results where match_id = '${matchId}' and finished`);
    const receipts = await sql(`select string_agg(user_id::text, ',' order by receipt_seq) from public.number_trail_finish_attempts where match_id = '${matchId}' and status = 'verified'`);
    expect(order).toBe(receipts);
    expect(order.split(",").slice(0, 1)).toEqual([id.lost]);
    expect(order.split(",")).toEqual(expect.arrayContaining([id.host, id.rival]));
  });

  it("everyone sees the same final result on reconnect, with no one else's coordinates; retries return the result", async () => {
    const views = await Promise.all(names.map((n) => stateOf(id[n], matchId)));
    for (const v of views) {
      expect(v.match.status).toBe("completed");
      expect(v.match.finalized).toBe(true);
      expect(v.match.winnerUserId).toBe(id.lost);
      expect(v.results).toHaveLength(names.length);
      expect(v.results.filter((r) => r.isWinner)).toHaveLength(1);
      expect(JSON.stringify(v.players)).not.toMatch(/latitude|longitude|coords/);
      expect(v.events.filter((e) => e.kind === "MATCH_COMPLETED")).toHaveLength(1);
    }
    const retry = await act("number_finish", id.host, { matchId, requestKey: "host-finish-0001" });
    expect(retry.body).toMatchObject({ ok: true, status: "finished", repeated: true, won: false });
    const late = await act("number_finish", id.half, { matchId, requestKey: "half-finish-late" });
    expect(late.body).toEqual({ ok: false, error: "match_completed" });
    const results = await sql(`select count(*) from public.number_trail_results where match_id = '${matchId}' and is_winner`);
    expect(results).toBe("1");
  });

  it("no routes: the host is told, no number is invented, the match stays recoverable", async () => {
    const empty = new GraphBuilder().grid(2, 2, 60).graph();
    const host = randomUUID();
    const guest = randomUUID();
    await sql(`insert into auth.users (id, email) values ('${host}', 'e2e-empty-h@test.paws'), ('${guest}', 'e2e-empty-g@test.paws')`);
    const room = await asUser(host, `public.create_room('number_trail', 'Empty', 10, false, 5, true, null, 'H')`);
    const m = (await asUser(host, `public.number_create_match('${room.roomId}', 15, null)`)).matchId;
    const emptyDeps = { ...deps, loadNetwork: async () => ({ graph: empty, source: "osm" as const, sources: [] }) };
    const r = await NUMBER_ACTIONS.number_prepare(emptyDeps, host, { matchId: m, latitude: 37.77, longitude: -122.42 });
    expect(r.body.ok).toBe(false);
    expect(["no_number_routes", "no_public_start"]).toContain(r.body.error);
    const st = await sql(`select status || ':' || coalesce(target_number, '-') from public.number_trail_matches where id = '${m}'`);
    expect(st).toBe("waiting:-");
    // Routing down: also recoverable, no number.
    const down = await NUMBER_ACTIONS.number_prepare({ ...deps, loadNetwork: async () => ({ error: "routing_unavailable" }) }, host, { matchId: m, latitude: 37.77, longitude: -122.42 });
    expect(down).toEqual({ status: 503, body: { ok: false, error: "routing_unavailable" } });
  });
});
