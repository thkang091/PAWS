/** Number Trail screen states and copy: derived from the canonical state only, nothing invented. */
import { finishView, liveView, lobbyView, resultsView, revealView, screenOf, gpsQuality } from "@/features/numberTrail/raceView";
import { FINISH_REASONS, NUMBER_ERRORS, PHASE_LABELS, LOBBY_BLOCKERS, LAYOUT_LABELS, RESULT_LINES, eventLine, numberErrorText } from "@/features/numberTrail/raceCopy";
import type { RaceState } from "../../supabase/functions/tournament/numberContract";

declare const require: (m: string) => any;
const fs = require("fs");
declare const __dirname: string;

const base = (over: Record<string, unknown> = {}, me: Record<string, unknown> = {}): RaceState =>
  ({
    serverNow: "2026-11-06T09:00:00.000Z",
    match: { id: "m", status: "waiting", number: null, startsAt: null, endsAt: null, preparing: false, prepareError: null, minutes: 25, difficulty: null, winnerUserId: null, outcome: null, finalized: false, result: null, ...over },
    room: { maxPlayers: 10 },
    course: null,
    players: [
      { userId: "h", name: "Ana", isHost: true, ready: true, inRoom: true, status: null },
      { userId: "p", name: "Ben", isHost: false, ready: false, inRoom: true, status: null },
    ],
    me: { userId: "h", isHost: true, progress: null, lastAttempt: null, ...me },
    results: [],
    events: [],
    lastSeq: 0,
  }) as unknown as RaceState;

describe("screens follow the server's status", () => {
  it("lobby, reveal, live, finish, results, cancelled", () => {
    expect(screenOf(base())).toBe("lobby");
    expect(screenOf(base({ status: "preparing_routes", preparing: true }))).toBe("lobby");
    expect(screenOf(base({ status: "ready", number: "07" }))).toBe("reveal");
    expect(screenOf(base({ status: "countdown", number: "07" }))).toBe("reveal");
    expect(screenOf(base({ status: "active" }))).toBe("live");
    expect(screenOf(base({ status: "verifying" }, { lastAttempt: { status: "pending" } }))).toBe("finish");
    expect(screenOf(base({ status: "active" }, { lastAttempt: { status: "rejected", reason: "digit_two_incomplete" } }))).toBe("live");
    expect(screenOf(base({ status: "completed" }))).toBe("results");
    expect(screenOf(base({ status: "cancelled" }))).toBe("cancelled");
  });
  it("the lobby says what blocks the start, differently for host and players", () => {
    expect(lobbyView(base()).blocker).toBe("no_number");
    expect(lobbyView(base({ status: "ready", number: "07" })).blocker).toBe("waiting_ready");
    expect(lobbyView(base({ status: "preparing_routes", preparing: true })).blocker).toBe("preparing");
    for (const b of ["preparing", "no_number", "need_players", "waiting_ready"]) expect(LOBBY_BLOCKERS[b].host && LOBBY_BLOCKERS[b].player).toBeTruthy();
  });
  it("the countdown runs only once the host has started, on the server's clock", () => {
    expect(revealView(base({ status: "ready", number: "07" }), 0, 0).countdownMs).toBeNull();
    const s = base({ status: "countdown", number: "07", startsAt: "2026-11-06T09:00:10.000Z" });
    expect(revealView(s, 0, Date.parse("2026-11-06T09:00:04.000Z")).countdownMs).toBe(6000);
  });
  it("progress bars never move backwards on screen", () => {
    const s = base({ status: "active" }, { progress: { phase: "DIGIT_1_IN_PROGRESS", digits: [{ coverage: 0.4 }, { coverage: 0 }], connector: 0 } });
    expect(liveView(s, 0, 0, { one: 0.5, connector: 0, two: 0 }).one).toBe(0.5);
  });
  it("a refused hand-in shows until the walk moves on, with a retry only when walking on can fix it", () => {
    const s = base({ status: "active" }, { progress: { phase: "INVALID_COMPLETION" }, lastAttempt: { status: "rejected", reason: "digit_two_incomplete" } });
    expect(liveView(s, 0, 0).refusal).toBe("digit_two_incomplete");
    expect(finishView(s)).toMatchObject({ state: "incomplete", retry: true });
    expect(finishView(base({ status: "active" }, { lastAttempt: { status: "rejected", reason: "gps_review" } }))).toMatchObject({ state: "gps_invalid", retry: false });
    expect(finishView(base({ status: "completed" }, { lastAttempt: { status: "pending" } })).state).toBe("already_completed");
    expect(finishView(base({ status: "verifying" }, { lastAttempt: { status: "verified", finishOrder: null } })).state).toBe("waiting_on_earlier");
  });
  it("results come from official placements only", () => {
    const s = base({ status: "completed", winnerUserId: "p", outcome: "winner", finalized: false }, {});
    (s as { results: unknown[] }).results = [{ userId: "p", placement: 1, finished: true, isWinner: true }];
    const r = resultsView(s);
    expect(r.winner?.name).toBe("Ben");
    expect(r.final).toBe(false);
    expect(r.canPlayAgain).toBe(false);
  });
  it("GPS quality never pretends: stale or imprecise fixes are weak or lost", () => {
    expect(gpsQuality(null)).toBe("lost");
    expect(gpsQuality({ accuracyM: 8, ageMs: 2000 })).toBe("good");
    expect(gpsQuality({ accuracyM: 35, ageMs: 2000 })).toBe("weak");
    expect(gpsQuality({ accuracyM: 8, ageMs: 2000 }, { jumps: 1 })).toBe("weak");
  });
});

describe("copy", () => {
  const all = () => [
    ...Object.values(NUMBER_ERRORS),
    ...Object.values(FINISH_REASONS).flatMap((r) => [r.title, r.body]),
    ...Object.values(PHASE_LABELS),
    ...Object.values(LOBBY_BLOCKERS).flatMap((b) => [b.host, b.player]),
    ...Object.values(LAYOUT_LABELS),
    ...Object.values(RESULT_LINES).filter((v) => typeof v === "string"),
  ] as string[];
  it("has a line for every API error code and every finish rejection", () => {
    const contract: string = fs.readFileSync(__dirname + "/../../supabase/functions/tournament/numberContract.ts", "utf8");
    const codes = [...contract.slice(contract.indexOf("export type NumberErrorCode"), contract.indexOf("/** Why a finish")).matchAll(/\| "([a-z_]+)"/g)].map((m) => m[1]);
    // Codes a player can't cause through the app fall back to the generic line.
    const internal = new Set(["server_error", "unauthorized", "bad_request", "wrong_game"]);
    for (const c of codes.filter((c) => !internal.has(c))) expect(numberErrorText(c)).not.toBe("Something went wrong. Try again.");
    const reasons = [...contract.slice(contract.indexOf("export type FinishRejection"), contract.indexOf("/** Rejections")).matchAll(/\| "([a-z_]+)"/g)].map((m) => m[1]);
    for (const r of reasons) expect(FINISH_REASONS[r]).toBeTruthy();
  });
  it("the no-routes message is the one in the brief", () => {
    expect(NUMBER_ERRORS.no_number_routes).toBe("No number routes available in this area. Try another location or walking distance.");
  });
  it("no em dashes, no emoji, and nothing that urges speed", () => {
    for (const line of all()) {
      expect(line).not.toMatch(/—/);
      expect(line).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(line).not.toMatch(/\b(sprint|run|rush|hurry|race through|fast)\b/i);
    }
  });
  it("other players' hand-ins read as neutral until the server decides", () => {
    expect(eventLine("FINISH_VERIFYING", "Ana")).toBe("Ana handed in");
    expect(eventLine("PLAYER_FINISHED", "Ana", { placement: 1 })).toBe("Ana won");
  });
});
