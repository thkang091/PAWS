/**
 * Number Trail practice and online races (phases P1 to P3) end to end against a real local PostgreSQL + PostGIS
 * cluster (scripts/test-db-local.sh runs it with PAWS_TEST_PGHOST set; skipped otherwise). The edge function's
 * service code (numberPlayService.ts, numberService.ts) talks to the migrated database through psql, one session per
 * call. Nothing here touches a Supabase project.
 *
 * Networks are synthetic test grids (tests only), one per "city", 40 km apart, with blocks of slightly different
 * sizes. Real-street fairness is numberCrossCity.test.ts.
 */
import { GraphBuilder } from "./fixtures/pedestrianGraphs";
import { planPieces, findNumberRoutes, type NumberPlan } from "../../supabase/functions/tournament/numberRoutes";
import type { PedGraph } from "../../supabase/functions/tournament/routes";
import type { TrackPoint } from "../../supabase/functions/tournament/geo";
import { NUMBER_ACTIONS, StoreError, type NumberDeps, type Reply } from "../../supabase/functions/tournament/numberService";
import { PLAY_ACTIONS } from "../../supabase/functions/tournament/numberPlayService";
import { DISCOVERY_ACTIONS } from "../../supabase/functions/tournament/numberDiscoveryService";
import type { NumberCourse } from "../../supabase/functions/tournament/numberMatch";

declare const require: (m: string) => any;
declare const process: { env: Record<string, string | undefined> };
const { execFile } = require("child_process");
const { createHash, randomUUID } = require("crypto") as { createHash: (a: string) => { update: (t: string) => { digest: (e: string) => string } }; randomUUID: () => string };

const PGHOST = process.env.PAWS_TEST_PGHOST;
const PSQL = process.env.PAWS_PSQL ?? "/opt/homebrew/opt/postgresql@17/bin/psql";
const maybe = PGHOST ? describe : describe.skip;

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
const VOID = new Set(["number_prepare_failed", "number_plan_cache_put", "number_online_search_failed", "number_discovery_put"]);
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
const asUser = (user: string, call: string) =>
  sql(`begin; select set_config('request.jwt.claim.sub', '${user}', true) is null; select ${call}; commit;`).then((out) => {
    const line = out.split("\n").filter((l) => l && l !== "f").pop() ?? "";
    try {
      return JSON.parse(line);
    } catch {
      return line;
    }
  });

const walkAlong = (coords: [number, number][], t0: number, seed = 5): TrackPoint[] => {
  let s = seed;
  const rand = () => ((s = (s * 48271) % 2147483647) / 2147483647) * 2 - 1;
  const out: TrackPoint[] = [];
  let t = t0;
  for (let i = 1; i < coords.length; i++) {
    const [lo1, la1] = coords[i - 1];
    const [lo2, la2] = coords[i];
    const k = 111_320 * Math.cos((la1 * Math.PI) / 180);
    const n = Math.max(1, Math.round(Math.hypot((lo2 - lo1) * k, (la2 - la1) * 110_540) / 5));
    for (let j = 0; j < n; j++) {
      out.push({ latitude: la1 + ((la2 - la1) * j) / n + (rand() * 3) / 110_540, longitude: lo1 + ((lo2 - lo1) * j) / n + (rand() * 3) / k, accuracyM: 8, capturedAt: t, seq: out.length + 1, segment: 0 });
      t += 4000;
    }
  }
  const [lo, la] = coords[coords.length - 1];
  out.push({ latitude: la, longitude: lo, accuracyM: 8, capturedAt: t, seq: out.length + 1, segment: 0 });
  return out;
};

/** A grid whose blocks vary between 78 m and 104 m, scaled and moved: one "city". */
const city = (dx: number, scale: number) => {
  const xs = [0, 84, 170, 248, 352, 438, 520, 611, 697, 790, 872, 961].map((x) => x * scale);
  const ys = [0, 91, 172, 266, 349, 437, 531, 612, 703, 789, 880, 963].map((y) => y * scale);
  const b = new GraphBuilder();
  const id = (c: number, r: number) => `c${dx}_${c}_${r}`;
  xs.forEach((x, c) => ys.forEach((y, r) => b.node(id(c, r), dx + x, y)));
  xs.forEach((_, c) =>
    ys.forEach((_, r) => {
      if (c + 1 < xs.length) b.edge(`h${dx}_${c}_${r}`, id(c, r), id(c + 1, r));
      if (r + 1 < ys.length) b.edge(`v${dx}_${c}_${r}`, id(c, r), id(c, r + 1));
    }),
  );
  return { graph: b.graph(), start: b.at(dx + 438 * scale, 437 * scale) };
};

maybe("Number Trail practice and online races against the local database", () => {
  jest.setTimeout(300_000);
  const A = city(0, 1);
  const B = city(40_000, 1.004);
  const nearest = (lat: number, lng: number) => (Math.hypot(lat - A.start.latitude, lng - A.start.longitude) < Math.hypot(lat - B.start.latitude, lng - B.start.longitude) ? A : B);
  const logs: { event: string; detail?: Record<string, unknown> }[] = [];
  const deps: NumberDeps = {
    rpc,
    loadNetwork: async (lat, lng) => ({ graph: nearest(lat, lng).graph, source: "osm", sources: [{ source: "test grid" }] }),
    now: Date.now,
    planBudgetMs: 30_000,
    random: () => Math.random(),
    sha256: async (t) => createHash("sha256").update(t).digest("hex"),
    log: (event, detail) => logs.push({ event, detail }),
  };
  const play = (name: keyof typeof PLAY_ACTIONS, user: string, body: Record<string, unknown>): Promise<Reply> => PLAY_ACTIONS[name](deps, user, body);
  const act = (name: keyof typeof NUMBER_ACTIONS, user: string, body: Record<string, unknown>): Promise<Reply> => NUMBER_ACTIONS[name](deps, user, body);
  const find = (name: keyof typeof DISCOVERY_ACTIONS, user: string, body: Record<string, unknown>): Promise<Reply> => DISCOVERY_ACTIONS[name](deps, user, body);

  const walker = randomUUID();
  const scout = randomUUID();
  const friend = randomUUID();
  const other = randomUUID();
  const host = randomUUID();
  const guest = randomUUID();
  beforeAll(async () => {
    await sql(`delete from public.number_discovery_cache`);
    await sql(`insert into auth.users (id, email) values ${[walker, other, host, guest, scout, friend].map((u) => `('${u}', 'play-${u.slice(0, 8)}@test.paws')`).join(", ")}`);
  });

  /** The plan a stored course came from, found again from the same request (the finder is deterministic). */
  const planFor = (graph: PedGraph, course: NumberCourse, plans: NumberPlan[]) => plans.find((p) => p.digits.every((d, k) => d.strokeEdgeIds.join() === course.digits[k].edges.map((e) => e.edgeId).sort().filter((x, i, a) => a.indexOf(x) === i).join()) && p.raceM === course.raceM) ?? null;

  describe("practice", () => {
    let candidateId = "";
    let course: NumberCourse;
    let plan: NumberPlan;
    let practiceId = "";

    it("refuses what isn't a whole number from 1 to 99, and a 3 km search without consent", async () => {
      expect((await play("number_find", walker, { number: "042", ...A.start, radiusM: 1_000 })).body).toMatchObject({ ok: false, numberError: "leading_zero" });
      expect((await play("number_find", walker, { number: "100", ...A.start, radiusM: 1_000 })).body).toMatchObject({ ok: false, numberError: "too_big" });
      expect((await play("number_find", walker, { number: "42", ...A.start, radiusM: 3_000 })).body).toEqual({ ok: false, error: "bad_request" });
      expect((await play("number_find", walker, { number: "42", ...A.start, radiusM: 750 })).body).toEqual({ ok: false, error: "bad_request" });
    });

    it("finds exactly the number asked, stored with PostGIS lengths, nearest on foot first", async () => {
      const r = await play("number_find", walker, { number: "42", ...A.start, radiusM: 1_000 });
      expect(r.status).toBe(200);
      expect(r.body.found).toBe(true);
      const cands = r.body.candidates as { id: string; officialM: number; approachM: number; course: { number: string } }[];
      expect(cands.length).toBeGreaterThan(0);
      for (const c of cands) expect(c.course.number).toBe("42");
      for (let i = 1; i < cands.length; i++) expect(cands[i].approachM).toBeGreaterThanOrEqual(cands[i - 1].approachM);
      const stored = await sql(`select count(*) from public.number_course_candidates where user_id = '${walker}' and purpose = 'practice' and number = '42'`);
      expect(Number(stored)).toBe(cands.length);
      // The official length is the database's own, close to the engine's.
      const off = JSON.parse(await sql(`select jsonb_build_object('official', official_total_m, 'engine', engine_race_m) from public.number_course_candidates where id = '${cands[0].id}'`));
      expect(Math.abs(off.official - off.engine)).toBeLessThanOrEqual(Math.max(3, off.engine * 0.01));
      candidateId = cands[0].id;
      course = JSON.parse(await sql(`select course from public.number_course_candidates where id = '${candidateId}'`));
      plan = planFor(A.graph, course, findNumberRoutes(A.graph, { start: A.start, number: "42", radiusM: 1_000, alternatives: 5 }).plans)!;
      expect(plan).toBeTruthy();
    });

    it("a number these streets can't draw: an honest no, never another number", async () => {
      const r = await play("number_find", walker, { number: "1", ...A.start, radiusM: 500 });
      expect(r.status).toBe(200);
      if (!r.body.found) {
        expect(r.body.candidates).toEqual([]);
        expect(["no_number_routes", "timeout"]).toContain(r.body.reason);
      } else for (const c of r.body.candidates as { course: { number: string } }[]) expect(c.course.number).toBe("1");
    });

    it("only your own candidate starts a practice walk", async () => {
      expect((await play("number_practice_begin", other, { candidateId })).body).toEqual({ ok: false, error: "not_found" });
      const r = await play("number_practice_begin", walker, { candidateId });
      expect(r.status).toBe(200);
      practiceId = r.body.practiceId as string;
      // Test only: the walk began 40 minutes ago, so a half-hour track fits before now.
      await sql(`update public.number_practice_sessions set started_at = started_at - interval '40 minutes' where id = '${practiceId}';
        update public.gps_sessions set started_at = started_at - interval '40 minutes' where number_practice_id = '${practiceId}';`);
    });

    it("walks it: progress, then a finish checked by the same rules as a race, kept once", async () => {
      const t0 = Date.parse(await sql(`select started_at from public.number_practice_sessions where id = '${practiceId}'`)) + 5_000;
      const pts = walkAlong(planPieces(plan, A.graph).flatMap((p) => p.coords), t0, 7 + (Date.now() % 100_000));
      const firstHalf = pts.slice(0, Math.floor(pts.length / 3));
      const p1 = await play("number_practice_progress", walker, { practiceId, points: firstHalf });
      expect(p1.status).toBe(200);
      expect(["DIGIT_1_IN_PROGRESS", "DIGIT_1_COMPLETE", "CONNECTOR_IN_PROGRESS", "DIGIT_1_PENDING"]).toContain(p1.body.phase);
      expect((await play("number_practice_progress", other, { practiceId, points: firstHalf })).body).toEqual({ ok: false, error: "not_found" });
      // The reply was lost and the phone sends the same batch again: nothing is stored twice.
      const count = () => sql(`select count(*) from public.gps_points p join public.gps_sessions s on s.id = p.session_id where s.number_practice_id = '${practiceId}'`);
      const before = await count();
      await sql(`update public.gps_points p set received_at = received_at - interval '61 seconds' from public.gps_sessions s where s.id = p.session_id and s.number_practice_id = '${practiceId}'`);
      const resent = await play("number_practice_progress", walker, { practiceId, points: firstHalf });
      expect(resent.status).toBe(200);
      expect(resent.body.storedThrough).toBe(p1.body.storedThrough);
      expect(await count()).toBe(before);
      await sql(`update public.gps_points p set received_at = received_at - interval '61 seconds' from public.gps_sessions s where s.id = p.session_id and s.number_practice_id = '${practiceId}'`);
      const rest = pts.slice(firstHalf.length);
      for (let i = 0; i < rest.length; i += 110) {
        const r = await play("number_practice_progress", walker, { practiceId, points: rest.slice(i, i + 110) });
        expect(r.status).toBe(200);
        await sql(`update public.gps_points p set received_at = received_at - interval '61 seconds' from public.gps_sessions s where s.id = p.session_id and s.number_practice_id = '${practiceId}'`);
      }
      const f = await play("number_practice_finish", walker, { practiceId });
      expect(f.status).toBe(200);
      expect(f.body.repeated).toBe(false);
      expect((f.body.result as { eligible: boolean }).eligible).toBe(true);
      expect((f.body.result as { missing: unknown[] }).missing).toEqual([]);
      expect(await sql(`select status || ':' || verified from public.number_practice_sessions where id = '${practiceId}'`)).toBe("finished:true");
      const again = await play("number_practice_finish", walker, { practiceId });
      expect(again.body.repeated).toBe(true);
      // Practice never touches races or standings.
      expect(await sql(`select count(*) from public.number_trail_results r join public.number_trail_matches m on m.id = r.match_id where r.user_id = '${walker}'`)).toBe("0");
    });
  });

  describe("online, two cities", () => {
    let roomId = "";
    let matchId = "";

    beforeAll(async () => {
      const room = await asUser(host, `public.create_room('number_trail', 'Online', 10, false, 5, true, null, 'Host')`);
      roomId = room.roomId;
      await asUser(guest, `public.join_room('${room.code}', null, null, 'Guest')`);
      await asUser(guest, `public.set_room_ready('${roomId}', true)`);
    });

    it("host creates the race: a canonical number and a distance category", async () => {
      await expect(asUser(host, `public.number_create_online_match('${roomId}', '07', 'standard', true, 10)`)).rejects.toThrow(/bad_number/);
      await expect(asUser(host, `public.number_create_online_match('${roomId}', '12', 'marathon', true, 10)`)).rejects.toThrow(/bad_category/);
      await expect(asUser(guest, `public.number_create_online_match('${roomId}', '12', 'standard', true, 10)`)).rejects.toThrow(/not_your_turn_to_start/);
      matchId = (await asUser(host, `public.number_create_online_match('${roomId}', '12', 'standard', true, 10)`)).matchId;
      expect(await sql(`select mode || ':' || target_number || ':' || target_distance_m from public.number_trail_matches where id = '${matchId}'`)).toBe("online:12:1500");
    });

    it("each player searches their own streets for the same number at 1.5 km", async () => {
      expect((await play("number_online_prepare", host, { matchId, ...A.start, radiusM: 1_000 })).body).toEqual({ ok: false, error: "match_not_editable" });
      await asUser(host, `public.number_online_start_search('${matchId}')`);
      const [a, b] = await Promise.all([play("number_online_prepare", host, { matchId, ...A.start, radiusM: 1_000 }), play("number_online_prepare", guest, { matchId, ...B.start, radiusM: 1_000 })]);
      expect(a.body.found).toBe(true);
      expect(b.body.found).toBe(true);
      const lens = JSON.parse(await sql(`select jsonb_agg(official_total_m) from public.number_course_candidates where match_id = '${matchId}'`)) as number[];
      for (const m of lens) expect(Math.abs(m - 1_500)).toBeLessThanOrEqual(30);
    });

    it("only the host matches; the database re-checks the distances; players see no one else's route", async () => {
      expect((await play("number_online_match", guest, { matchId })).body).toEqual({ ok: false, error: "not_the_host" });
      const m = await play("number_online_match", host, { matchId });
      expect(m.status).toBe(200);
      expect(m.body.matched).toBe(true);
      // The race starts at digit one's first corner, not at the junction each player walked from: the walk there is
      // nobody's race time.
      const c = JSON.parse(await sql(`select course from public.number_trail_player_courses where match_id = '${matchId}' and user_id = '${host}'`)) as NumberCourse;
      const d1 = c.digits[0].start;
      expect(Math.abs(c.start.latitude - d1.latitude) + Math.abs(c.start.longitude - d1.longitude)).toBeLessThan(1e-9);
      expect(m.body.spreadM as number).toBeLessThanOrEqual(30);
      const st = await act("number_state", guest, { matchId });
      const body = st.body as { match: { status: string }; course: NumberCourse; online: Record<string, unknown> };
      expect(body.match.status).toBe("ready");
      // Your own course only: guest's course is in city B.
      expect(Math.abs(body.course.start.longitude - B.start.longitude)).toBeLessThan(0.05);
      expect(JSON.stringify(body.online)).not.toContain("coords");
      expect(JSON.stringify(st.body)).not.toContain(String(A.start.longitude).slice(0, 8));
    });

    it("everyone checks in at their own start before one server start", async () => {
      await expect(asUser(host, `public.number_start('${matchId}')`)).rejects.toThrow(/not_everyone_at_start/);
      const hostCourse = JSON.parse(await sql(`select course from public.number_trail_player_courses where match_id = '${matchId}' and user_id = '${host}'`)) as NumberCourse;
      const guestCourse = JSON.parse(await sql(`select course from public.number_trail_player_courses where match_id = '${matchId}' and user_id = '${guest}'`)) as NumberCourse;
      const far = await play("number_online_checkin", host, { matchId, latitude: hostCourse.start.latitude + 0.01, longitude: hostCourse.start.longitude, accuracyM: 8 });
      expect(far.body.atStart).toBe(false);
      const blurry = await play("number_online_checkin", host, { matchId, ...hostCourse.start, accuracyM: 80 });
      expect(blurry.body.atStart).toBe(false);
      expect((await play("number_online_checkin", host, { matchId, ...hostCourse.start, accuracyM: 8 })).body.atStart).toBe(true);
      expect((await play("number_online_checkin", guest, { matchId, ...guestCourse.start, accuracyM: 8 })).body.atStart).toBe(true);
      // Positions are checked, never stored.
      expect(await sql(`select count(*) from information_schema.columns where table_name = 'number_trail_player_courses' and column_name ilike '%checkin%point%'`)).toBe("0");
      const started = await asUser(host, `public.number_start('${matchId}')`);
      expect(Date.parse(started.startsAt)).toBeGreaterThan(Date.parse(started.serverNow));
    });

    it("each walks their own course from its first corner, finish stretch included; one winner", async () => {
      await sql(`alter table public.number_trail_matches disable trigger number_trail_matches_guard;
        update public.number_trail_matches set countdown_at = countdown_at - interval '40 minutes', starts_at = starts_at - interval '40 minutes', ends_at = ends_at - interval '40 minutes' where id = '${matchId}';
        alter table public.number_trail_matches enable trigger number_trail_matches_guard;`);
      for (const u of [host, guest]) expect((await act("number_walk", u, { matchId })).status).toBe(200);
      await sql(`update public.gps_sessions s set started_at = m.countdown_at from public.number_trail_matches m where s.number_match_id = m.id and m.id = '${matchId}'`);
      const t0 = Date.parse(await sql(`select starts_at from public.number_trail_matches where id = '${matchId}'`)) + 5_000;
      const walkOf = async (u: string, net: typeof A, seed: number) => {
        const course = JSON.parse(await sql(`select course from public.number_trail_player_courses where match_id = '${matchId}' and user_id = '${u}'`)) as NumberCourse;
        // The walk the course asks for, from its own stored geometry: every digit stroke in order, the connector, the
        // repeats where the plan walks them, and the finish stretch.
        const plans = findNumberRoutes(net.graph, { start: net.start, number: "12", radiusM: 1_000, targetM: 1_500, bandShare: 0.02, exact: true, alternatives: 12 }).plans;
        const plan = plans.find((p) => p.raceM === course.raceM && p.finishNodeId && course.end && p.legs.filter((l) => l.part === "finish").length === (course.finish ?? []).length)!;
        expect(plan).toBeTruthy();
        const pieces = planPieces(plan, net.graph).filter((p) => p.part !== "approach");
        const full = walkAlong(pieces.flatMap((p) => p.coords), t0, seed);
        // The same walk stopped where the finish stretch begins (same fixes: the noise follows the same sequence).
        const digitsOnly = walkAlong(pieces.filter((p) => p.part !== "finish").flatMap((p) => p.coords), t0, seed).length - 1;
        return { full, digitsOnly, hasFinish: pieces.some((p) => p.part === "finish") };
      };
      const send = async (u: string, pts: TrackPoint[]) => {
        let last: Reply | null = null;
        for (let i = 0; i < pts.length; i += 110) {
          last = await act("number_progress", u, { matchId, points: pts.slice(i, i + 110) });
          expect(last.status).toBe(200);
          await sql(`update public.gps_points p set received_at = received_at - interval '61 seconds' from public.gps_sessions s where s.id = p.session_id and s.number_match_id = '${matchId}' and s.user_id = '${u}';
            update public.number_trail_progress set verified_at = verified_at - interval '10 seconds' where match_id = '${matchId}' and user_id = '${u}';`);
        }
        return last!;
      };
      // Fresh noise each run: the same recorded walk handed in twice is refused as a replay (the kept test cluster
      // remembers earlier runs).
      const run = Date.now() % 100_000;
      const hp = await walkOf(host, A, 7 + run);
      const gp = await walkOf(guest, B, 11 + run);
      await send(host, hp.full);
      if (gp.hasFinish) {
        // The guest hands in at the last digit, before the finish stretch: not a finish, and they can walk on.
        await send(guest, gp.full.slice(0, gp.digitsOnly));
        const early = await act("number_finish", guest, { matchId, requestKey: "online-g-0" });
        expect(early.body).toMatchObject({ ok: true, status: "rejected", reason: "finish_incomplete", recoverable: true });
        await sql(`update public.number_trail_finish_attempts set received_at = received_at - interval '10 seconds' where match_id = '${matchId}' and user_id = '${guest}'`);
        await send(guest, gp.full.slice(gp.digitsOnly));
      } else await send(guest, gp.full);
      const h = await act("number_finish", host, { matchId, requestKey: "online-h-1" });
      expect(h.body).toMatchObject({ ok: true, status: "finished", placement: 1, won: true });
      // As in nearby races, the race is over at the first verified finish: a later hand-in is told so.
      const g = await act("number_finish", guest, { matchId, requestKey: "online-g-1" });
      expect(g.body).toEqual({ ok: false, error: "match_completed" });
      expect(await sql(`select count(*) from public.number_trail_results where match_id = '${matchId}' and is_winner`)).toBe("1");
    });
  });

  describe("location first: discover, choose a route, walk it, race on one course", () => {
    let available: string[] = [];
    it("discovers which numbers from 0 to 99 are walkable here, then serves the same answer from the cache", async () => {
      const r = await find("number_discover", scout, { ...A.start, radiusM: 1_000 });
      expect(r.status).toBe(200);
      const numbers = r.body.numbers as { number: string; status: string }[];
      expect(numbers).toHaveLength(100);
      available = r.body.available as string[];
      expect(available.length).toBeGreaterThan(0);
      expect(r.body.cached).toBe(false);
      const again = await find("number_discover", friend, { ...A.start, radiusM: 1_000 });
      expect(again.body.cached).toBe(true);
      expect(again.body.available).toEqual(available);
      // The cache key is public network data: no coordinates stored.
      expect(await sql(`select count(*) from public.number_discovery_cache where key ~ '[0-9]+\\.[0-9]+'`)).toBe("0");
      expect((await find("number_discover", scout, { ...A.start, radiusM: 3_000 })).body).toEqual({ ok: false, error: "bad_request" });
    });

    it("every route for a chosen number, stored with PostGIS lengths and a stable key; a walk starts on the one picked", async () => {
      const number = available.includes("7") ? "7" : available[0];
      const r = await find("number_routes", scout, { ...A.start, radiusM: 1_000, number });
      expect(r.status).toBe(200);
      const routes = r.body.routes as { id: string; routeKey: string; officialM: number; approachM: number; course: { number: string } }[];
      expect(routes.length).toBeGreaterThan(0);
      for (const x of routes) expect(x.course.number).toBe(number);
      expect(new Set(routes.map((x) => x.routeKey)).size).toBe(routes.length);
      const again = await find("number_routes", scout, { ...A.start, radiusM: 1_000, number });
      expect((again.body.routes as { routeKey: string }[]).map((x) => x.routeKey)).toEqual(routes.map((x) => x.routeKey));
      const pick = routes[routes.length - 1];
      const begin = await play("number_practice_begin", scout, { candidateId: pick.id });
      expect(begin.status).toBe(200);
      // The walk is on the route picked, not the nearest one.
      expect(await sql(`select course ->> 'number' || ':' || (official_total_m = (select official_total_m from public.number_course_candidates where id = '${pick.id}'))::text from public.number_practice_sessions where id = '${begin.body.practiceId}'`)).toBe(`${number}:true`);
      expect(await sql(`select route_key from public.number_course_candidates where id = '${pick.id}'`)).toBe(pick.routeKey);
      const none = await find("number_routes", scout, { ...A.start, radiusM: 1_000, number: "100" });
      expect(none.body).toEqual({ ok: false, error: "bad_request" });
    });

    it("online: each player checks their streets, the host picks a common number and shares one course", async () => {
      const room = await asUser(scout, `public.create_room('number_trail', 'Same street', 10, false, 5, true, null, 'Scout')`);
      await asUser(friend, `public.join_room('${room.code}', null, null, 'Friend')`);
      const matchId = (await asUser(scout, `public.number_create_online_match('${room.roomId}', null, 'standard', true, 10)`)).matchId;
      for (const u of [scout, friend]) expect((await find("number_discover", u, { ...A.start, radiusM: 1_000, matchId })).status).toBe(200);
      const common = await asUser(friend, `public.number_online_common('${matchId}')`);
      expect(common.common).toEqual(available);
      const number = available.includes("7") ? "7" : available[0];
      await asUser(scout, `public.number_online_choose_number('${matchId}', '${number}')`);
      const routes = (await find("number_routes", scout, { ...A.start, radiusM: 1_000, number })).body.routes as { id: string }[];
      await asUser(scout, `public.number_online_share_course('${matchId}', '${routes[0].id}')`);
      const st = await act("number_state", friend, { matchId });
      const body = st.body as { match: { status: string }; course: NumberCourse; online: { equivalence: { status: string; version: string } } };
      expect(body.match.status).toBe("ready");
      expect(body.online.equivalence.status).toBe("matched");
      expect(body.online.equivalence.version).toBe("shared-course-v1");
      const mine = JSON.parse(await sql(`select course from public.number_trail_player_courses where match_id = '${matchId}' and user_id = '${scout}'`)) as NumberCourse;
      expect(JSON.stringify(body.course)).toBe(JSON.stringify(mine));
    });
  });
});
