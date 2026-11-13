/**
 * Number Trail on the phone: broadcasts are hints, the reloaded state is the record. Repeats, late and out-of-order
 * broadcasts, gaps, reconnects, a missed final result and the server-clock countdown.
 */
import { EMPTY_CURSOR, betterOffset, clockOffset, countdownLeftMs, isNewer, nextFinishKey, onBroadcast, raceElapsedMs, takeEvents, winnerToAnnounce, type SyncCursor } from "@/features/numberTrail/raceSync";
import type { NumberEvent, RaceState } from "../../supabase/functions/tournament/numberContract";

const M = "11111111-1111-4111-8111-111111111111";
const ev = (seq: number, kind: NumberEvent["kind"] = "PLAYER_READY"): NumberEvent => ({ seq, kind, userId: null, payload: {}, at: new Date(seq * 1000).toISOString() });
const st = (lastSeq: number, events: NumberEvent[], status: RaceState["match"]["status"] = "active", id = M, winner: string | null = null) =>
  ({ lastSeq, events, match: { id, status, winnerUserId: winner, outcome: winner ? "winner" : null, number: "07" } }) as unknown as RaceState;

describe("broadcasts are only a reason to reload", () => {
  const cursor: SyncCursor = { matchId: M, seen: 5 };
  it("a new event reloads from the last one seen", () => expect(onBroadcast(cursor, { matchId: M, seq: 6 })).toEqual({ kind: "reload", afterSeq: 5 }));
  it("a repeated or late event is ignored", () => {
    expect(onBroadcast(cursor, { matchId: M, seq: 5 })).toEqual({ kind: "ignore" });
    expect(onBroadcast(cursor, { matchId: M, seq: 2 })).toEqual({ kind: "ignore" });
  });
  it("a gap reloads from the last seen, so nothing is skipped", () => expect(onBroadcast(cursor, { matchId: M, seq: 9 })).toEqual({ kind: "reload", afterSeq: 5 }));
  it("another match in the room (play again) reloads from the start", () => expect(onBroadcast(cursor, { matchId: "other", seq: 1 })).toEqual({ kind: "reload", afterSeq: 0 }));
  it("before the first load, anything reloads", () => expect(onBroadcast(EMPTY_CURSOR, { matchId: M, seq: 1 })).toEqual({ kind: "reload", afterSeq: 0 }));
});

describe("events from reloads", () => {
  it("the first load replays no history; later loads give each new event once, in order", () => {
    const first = takeEvents(EMPTY_CURSOR, st(4, [ev(1), ev(2), ev(3), ev(4)]));
    expect(first.fresh).toEqual([]);
    expect(first.cursor).toEqual({ matchId: M, seen: 4 });
    const next = takeEvents(first.cursor, st(7, [ev(7), ev(5), ev(6), ev(6)]));
    expect(next.fresh.map((e) => e.seq)).toEqual([5, 6, 7]);
    const again = takeEvents(next.cursor, st(7, [ev(5), ev(6), ev(7)]));
    expect(again.fresh).toEqual([]);
  });
  it("after a long disconnect the cursor jumps to the match's sequence; the state already shows the result", () => {
    const r = takeEvents({ matchId: M, seen: 3 }, st(120, [ev(70), ev(71)]));
    expect(r.cursor.seen).toBe(120);
  });
  it("a slower, older reply never replaces a newer one", () => {
    expect(isNewer(st(10, []), st(9, []))).toBe(false);
    expect(isNewer(st(10, []), st(10, []))).toBe(true);
    expect(isNewer(st(10, [], "active", "old"), st(1, []))).toBe(true);
  });
});

describe("the winner is announced once, from the record", () => {
  it("not before the match is completed", () => expect(winnerToAnnounce(st(9, [], "verifying"), new Set())).toBeNull());
  it("once per match, however often the phone reconnects", () => {
    const done = st(12, [ev(12, "MATCH_COMPLETED")], "completed", M, "u1");
    const announced = new Set<string>();
    const a = winnerToAnnounce(done, announced);
    expect(a).toEqual({ matchId: M, winnerUserId: "u1", outcome: "winner", number: "07" });
    announced.add(a!.matchId);
    for (let i = 0; i < 3; i++) expect(winnerToAnnounce(done, announced)).toBeNull();
  });
  it("a phone that was offline at the end still gets the final result on its next load", () => {
    const missed = takeEvents({ matchId: M, seen: 8 }, st(15, [ev(9, "FINISH_VERIFYING"), ev(10, "PLAYER_FINISHED"), ev(11, "MATCH_COMPLETED")], "completed", M, "u2"));
    expect(missed.fresh.map((e) => e.kind)).toContain("MATCH_COMPLETED");
    expect(winnerToAnnounce(st(15, [], "completed", M, "u2"), new Set())?.winnerUserId).toBe("u2");
  });
});

describe("countdown on the server's clock", () => {
  it("two phones with clocks minutes apart show the same time left, within half a round trip", () => {
    const server = Date.UTC(2026, 10, 6, 9, 0, 0);
    const startsAt = new Date(server + 10_000).toISOString();
    // Phone A is 3 minutes fast, phone B 2 minutes slow; both asked at server time `server` with 200 ms round trips.
    const a = clockOffset(new Date(server).toISOString(), server + 180_000 - 100, server + 180_000 + 100);
    const b = clockOffset(new Date(server).toISOString(), server - 120_000 - 100, server - 120_000 + 100);
    const leftA = countdownLeftMs(startsAt, a, server + 180_000 + 2_000);
    const leftB = countdownLeftMs(startsAt, b, server - 120_000 + 2_000);
    expect(Math.abs(leftA - leftB)).toBeLessThanOrEqual(100);
    expect(leftA).toBeCloseTo(8_000, -2);
    expect(countdownLeftMs(startsAt, a, server + 180_000 + 60_000)).toBe(0);
    expect(raceElapsedMs(startsAt, a, server + 180_000 + 15_000)).toBeCloseTo(5_000, -2);
  });
  it("keeps the offset from the fastest round trip", () => {
    const best = betterOffset(betterOffset(null, { offsetMs: 10, rttMs: 900 }), { offsetMs: 2, rttMs: 120 });
    expect(betterOffset(best, { offsetMs: 50, rttMs: 400 })).toEqual({ offsetMs: 2, rttMs: 120 });
  });
});

describe("finish request keys", () => {
  it("the same key on every retry; a new one only after a refusal", () => {
    let n = 0;
    const make = () => String(++n);
    const k1 = nextFinishKey(null, make);
    expect(nextFinishKey({ key: k1, refused: false }, make)).toBe(k1);
    const k2 = nextFinishKey({ key: k1, refused: true }, make);
    expect(k2).not.toBe(k1);
    expect(k2.length).toBeGreaterThanOrEqual(8);
  });
});
