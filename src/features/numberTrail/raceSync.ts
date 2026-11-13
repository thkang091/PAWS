/**
 * Keeping a phone in step with a Number Trail match, as pure functions. Broadcasts on the room's private channel say
 * "event N happened"; the canonical record is number_race_state (via the `tournament` edge function). These rules
 * decide when to reload and what to announce, so a repeated, late, out-of-order or missed broadcast can never change
 * what the player sees, and a winner is announced once per match however often the phone reconnects.
 */
import type { NumberBroadcast, NumberEvent, RaceState } from "../../../supabase/functions/tournament/numberContract";

export type SyncCursor = { matchId: string | null; seen: number };

/** Nothing seen yet: the first load sets the cursor without replaying history as news. */
export const EMPTY_CURSOR: SyncCursor = { matchId: null, seen: -1 };

export type BroadcastDecision =
  /** Already reflected on screen (repeat or late). */
  | { kind: "ignore" }
  /** Reload the canonical state, asking for events after `afterSeq`. */
  | { kind: "reload"; afterSeq: number };

/**
 * What to do with a broadcast. Every new one leads to a reload (the broadcast is a hint, not the record); repeats,
 * stale ones and other matches' are ignored. A gap (seq jumped) reloads from the last seen event, so nothing is
 * skipped.
 */
export const onBroadcast = (cursor: SyncCursor, msg: Pick<NumberBroadcast, "matchId" | "seq">): BroadcastDecision => {
  if (cursor.matchId && msg.matchId !== cursor.matchId) return { kind: "reload", afterSeq: 0 };
  if (!Number.isInteger(msg.seq) || msg.seq <= cursor.seen) return { kind: "ignore" };
  return { kind: "reload", afterSeq: Math.max(0, cursor.seen) };
};

/** Whether a reply is newer than what is on screen. A slow reply finishing after a faster, later one is dropped. */
export const isNewer = (current: Pick<RaceState, "lastSeq" | "match"> | null | undefined, next: Pick<RaceState, "lastSeq" | "match">) =>
  !current || current.match.id !== next.match.id || next.lastSeq >= current.lastSeq;

/**
 * Events from a reload that are news: newer than the cursor, each once, oldest first. On the first load of a match
 * nothing is news (history is not replayed as toasts), and the cursor jumps to the match's sequence number.
 */
export const takeEvents = (cursor: SyncCursor, state: Pick<RaceState, "lastSeq" | "events" | "match">): { fresh: NumberEvent[]; cursor: SyncCursor } => {
  const sameMatch = cursor.matchId === state.match.id;
  const seen = sameMatch ? cursor.seen : -1;
  const unique = new Map<number, NumberEvent>();
  for (const e of state.events) if (e.seq > seen && !unique.has(e.seq)) unique.set(e.seq, e);
  const fresh = seen < 0 ? [] : [...unique.values()].sort((a, b) => a.seq - b.seq);
  return { fresh, cursor: { matchId: state.match.id, seen: Math.max(seen, state.lastSeq, ...state.events.map((e) => e.seq)) } };
};

/**
 * The winner to announce, once. `announced` holds match ids already announced on this phone (kept across
 * reconnects). Decided only by the canonical state, never by a broadcast alone: a broadcast may be fake-proof but it
 * is still not the record.
 */
export const winnerToAnnounce = (state: Pick<RaceState, "match">, announced: ReadonlySet<string>) => {
  const m = state.match;
  if (m.status !== "completed" || announced.has(m.id)) return null;
  return { matchId: m.id, winnerUserId: m.winnerUserId, outcome: m.outcome, number: m.number };
};

// ---------- Server clock ----------

/**
 * The server's clock minus this phone's, from one request: the server's time is taken as the midpoint of the round
 * trip. Phones with very different clocks agree on the countdown to within half a round trip.
 */
export const clockOffset = (serverNowIso: string, sentAtMs: number, receivedAtMs: number) => Date.parse(serverNowIso) - (sentAtMs + receivedAtMs) / 2;

/** Keeps the offset from the fastest round trip seen: the least uncertain one. */
export const betterOffset = (best: { offsetMs: number; rttMs: number } | null, sample: { offsetMs: number; rttMs: number }) =>
  !best || sample.rttMs < best.rttMs ? sample : best;

/** Milliseconds until the official start, on the server's clock. Never negative. */
export const countdownLeftMs = (startsAt: string | null, offsetMs: number, phoneNowMs: number) => (startsAt ? Math.max(0, Date.parse(startsAt) - (phoneNowMs + offsetMs)) : 0);

/** Race time elapsed on the server's clock. */
export const raceElapsedMs = (startsAt: string | null, offsetMs: number, phoneNowMs: number) => (startsAt ? Math.max(0, phoneNowMs + offsetMs - Date.parse(startsAt)) : 0);

// ---------- Finish requests ----------

/**
 * One key per finish attempt, reused on every retry of that attempt (a lost reply never makes a second attempt).
 * A new key only after the server refused the attempt.
 */
export const nextFinishKey = (current: { key: string; refused: boolean } | null, makeId: () => string) =>
  // At least 8 characters, as the server requires, whatever `makeId` returns.
  current && !current.refused ? current.key : `nt-${Date.now().toString(36)}-${makeId()}`.slice(0, 80);
