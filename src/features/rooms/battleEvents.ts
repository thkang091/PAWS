/**
 * How the battle screen turns server state into feedback, as pure functions. Realtime broadcasts only say "something
 * changed"; the phone then reloads battle_state, which is the canonical record (scores, ownership and the last 20
 * events, all from the database). These functions decide what to show from that reload, so a missed, repeated or
 * out-of-order broadcast can never change what the player sees.
 */
import type { BattleEvent, Team } from "@/services/roomService";

export type EventCursor = { seen: number };

/** Before the first load nothing has been seen; history from before you opened the screen is never toasted. */
export const START: EventCursor = { seen: -1 };

/**
 * New events since the cursor, oldest first, each once. `matchSeq` moves the cursor past changes whose events have
 * fallen out of the 20-event window during a long disconnect: those are not replayed, because the scoreboard
 * already shows their result.
 */
export const takeFresh = (cursor: EventCursor, events: readonly BattleEvent[], matchSeq: number): { fresh: BattleEvent[]; cursor: EventCursor } => {
  const unique = new Map<number, BattleEvent>();
  for (const e of events) if (e.seq > cursor.seen && !unique.has(e.seq)) unique.set(e.seq, e);
  const fresh = cursor.seen < 0 ? [] : [...unique.values()].sort((a, b) => a.seq - b.seq);
  const seen = Math.max(cursor.seen, matchSeq, ...events.map((e) => e.seq));
  return { fresh, cursor: { seen } };
};

/** Only the other team's captures become alerts; your own team's are confirmed by your own claim's reply. */
export const opponentCaptures = (fresh: readonly BattleEvent[], myTeam: Team | null) =>
  fresh.filter((e) => e.team && e.team !== myTeam && (e.kind === "road" || (e.kind === "territory" && Number(e.payload.capturedM2) > 1)));

/** Whether a reload is newer than what is on screen. Older replies (a slow request finishing late) are ignored. */
export const isNewer = (current: { match: { seq: number } } | undefined, next: { match: { seq: number } }) => !current || next.match.seq >= current.match.seq;
