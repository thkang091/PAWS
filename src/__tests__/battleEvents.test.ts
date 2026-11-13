import { START, isNewer, opponentCaptures, takeFresh } from "@/features/rooms/battleEvents";
import { battleView } from "@/features/rooms/lobbyRules";
import type { BattleEvent } from "@/services/roomService";

const ev = (seq: number, kind = "road", team: "blue" | "orange" | null = "orange", payload: Record<string, unknown> = { edgeId: `e${seq}` }): BattleEvent => ({
  seq,
  kind,
  team,
  userId: null,
  payload,
  at: new Date(1_000 * seq).toISOString(),
});

describe("realtime reconciliation", () => {
  it("never replays history on first load", () => {
    const { fresh, cursor } = takeFresh(START, [ev(3), ev(2), ev(1)], 3);
    expect(fresh).toEqual([]);
    expect(cursor.seen).toBe(3);
  });

  it("shows each new event once, oldest first, whatever order the reload lists them", () => {
    const { fresh, cursor } = takeFresh({ seen: 3 }, [ev(6), ev(4), ev(5), ev(3)], 6);
    expect(fresh.map((e) => e.seq)).toEqual([4, 5, 6]);
    expect(cursor.seen).toBe(6);
  });

  it("ignores duplicate events in the same reload and across reloads", () => {
    const first = takeFresh({ seen: 3 }, [ev(4), ev(4), ev(5)], 5);
    expect(first.fresh.map((e) => e.seq)).toEqual([4, 5]);
    const again = takeFresh(first.cursor, [ev(5), ev(4)], 5);
    expect(again.fresh).toEqual([]);
  });

  it("catches up after a disconnect from the stored events, not the missed broadcasts", () => {
    // Offline from seq 3 to 9: the reload carries events 4..9 from the database.
    const { fresh } = takeFresh({ seen: 3 }, [9, 8, 7, 6, 5, 4].map((s) => ev(s)), 9);
    expect(fresh.map((e) => e.seq)).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it("skips events that fell out of the 20-event window instead of replaying them late", () => {
    const window = Array.from({ length: 20 }, (_, i) => ev(40 - i));
    const { fresh, cursor } = takeFresh({ seen: 3 }, window, 40);
    expect(fresh[0].seq).toBe(21);
    expect(cursor.seen).toBe(40);
  });

  it("moves past status changes that have no capture event", () => {
    const { cursor } = takeFresh({ seen: 5 }, [ev(5)], 7);
    expect(cursor.seen).toBe(7);
  });

  it("alerts only on the other team's captures", () => {
    const fresh = [ev(1, "road", "orange"), ev(2, "road", "blue"), ev(3, "territory", "orange", { capturedM2: 0.4 }), ev(4, "territory", "orange", { capturedM2: 320 }), ev(5, "status", null, { status: "active" })];
    expect(opponentCaptures(fresh, "blue").map((e) => e.seq)).toEqual([1, 4]);
  });

  it("ignores a slow reload that is older than what is on screen", () => {
    expect(isNewer({ match: { seq: 9 } }, { match: { seq: 7 } })).toBe(false);
    expect(isNewer({ match: { seq: 9 } }, { match: { seq: 9 } })).toBe(true);
    expect(isNewer(undefined, { match: { seq: 1 } })).toBe(true);
  });

  it("shows the result when the match completed while the phone was offline", () => {
    expect(battleView("completed", Date.parse("2026-11-06T10:00:00Z"), "2026-11-06T09:00:00Z")).toBe("result");
  });
});
