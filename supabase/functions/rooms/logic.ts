import { GPS_RULES, cleanTrack, metersBetween, summarizeTrack, type TrackPoint } from "../tournament/geo.ts";

/**
 * Nearby rooms and Find the Mafia: the rules, pure, so they can be tested without a database. The `rooms` edge
 * function applies them with server time and server randomness; the database enforces what has to be atomic
 * (room capacity, one vote each, host-only actions).
 */

export type RoomGame = "find_mafia" | "steal_territory" | "steal_road";

export const ROOM_LIMITS: Record<RoomGame, { min: number; max: number }> = {
  find_mafia: { min: 4, max: 10 },
  steal_territory: { min: 2, max: 10 },
  steal_road: { min: 2, max: 10 },
};

export type Rng = () => number;

// ---------- Roles ----------

export type MafiaRole = "civilian" | "mafia";

/** Exactly one Mafia, chosen uniformly from the players. Order of the input does not matter. */
export const assignRoles = (players: readonly string[], rng: Rng): Map<string, MafiaRole> => {
  const sorted = [...new Set(players)].sort();
  if (sorted.length < ROOM_LIMITS.find_mafia.min) throw new Error("not_enough_players");
  const pick = Math.min(sorted.length - 1, Math.floor(rng() * sorted.length));
  return new Map(sorted.map((id, i) => [id, i === pick ? "mafia" : "civilian"]));
};

// ---------- Timing ----------

export type MafiaSettings = {
  walkMinutes: number;
  discussionSeconds: number;
  votingSeconds: number;
  startDelaySeconds: number;
  allowSelfVote: boolean;
};

export const DEFAULT_MAFIA_SETTINGS: MafiaSettings = {
  walkMinutes: 15,
  discussionSeconds: 60,
  votingSeconds: 30,
  startDelaySeconds: 10,
  allowSelfVote: false,
};

export const clampSettings = (raw: Partial<MafiaSettings>): MafiaSettings => {
  const n = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
  return {
    walkMinutes: n(raw.walkMinutes, 10, 20, DEFAULT_MAFIA_SETTINGS.walkMinutes),
    discussionSeconds: n(raw.discussionSeconds, 30, 300, DEFAULT_MAFIA_SETTINGS.discussionSeconds),
    votingSeconds: n(raw.votingSeconds, 15, 120, DEFAULT_MAFIA_SETTINGS.votingSeconds),
    startDelaySeconds: n(raw.startDelaySeconds, 0, 120, DEFAULT_MAFIA_SETTINGS.startDelaySeconds),
    allowSelfVote: raw.allowSelfVote === true,
  };
};

export type RoundTimes = { startedAt: string; walkingEndsAt: string; discussionEndsAt: string; votingEndsAt: string };

export const roundTimes = (startedAt: number, s: MafiaSettings): RoundTimes => {
  const walking = startedAt + (s.startDelaySeconds + s.walkMinutes * 60) * 1000;
  const discussion = walking + s.discussionSeconds * 1000;
  const voting = discussion + s.votingSeconds * 1000;
  return {
    startedAt: new Date(startedAt).toISOString(),
    walkingEndsAt: new Date(walking).toISOString(),
    discussionEndsAt: new Date(discussion).toISOString(),
    votingEndsAt: new Date(voting).toISOString(),
  };
};

export type RoundStatus = "walking" | "discussion" | "voting" | "finished" | "cancelled";

/** Where a round should be at `now`. Finished early once everyone eligible has voted. */
export const phaseAt = (t: RoundTimes, now: number, everyoneVoted: boolean): RoundStatus => {
  if (now < Date.parse(t.walkingEndsAt)) return "walking";
  if (now < Date.parse(t.discussionEndsAt)) return "discussion";
  if (now < Date.parse(t.votingEndsAt) && !everyoneVoted) return "voting";
  return "finished";
};

const ORDER: RoundStatus[] = ["walking", "discussion", "voting", "finished"];
/** Rounds only ever move forward. */
export const isAhead = (next: RoundStatus, current: RoundStatus) => current !== "cancelled" && ORDER.indexOf(next) > ORDER.indexOf(current);

// ---------- Votes ----------

export type Vote = { voterId: string; targetId: string; castAt: string };

export type Tally = { totals: Record<string, number>; accused: string | null; counted: number };

/**
 * Counts one vote per eligible voter (the earliest), for players in the round. The single highest total is accused;
 * a tie, or no votes, accuses nobody.
 */
export const tally = (votes: readonly Vote[], eligibleVoters: readonly string[], players: readonly string[], allowSelfVote = false): Tally => {
  const eligible = new Set(eligibleVoters);
  const inRound = new Set(players);
  const seen = new Set<string>();
  const totals: Record<string, number> = {};
  let counted = 0;
  for (const v of [...votes].sort((a, b) => Date.parse(a.castAt) - Date.parse(b.castAt) || a.voterId.localeCompare(b.voterId))) {
    if (!eligible.has(v.voterId) || seen.has(v.voterId) || !inRound.has(v.targetId)) continue;
    if (!allowSelfVote && v.voterId === v.targetId) continue;
    seen.add(v.voterId);
    totals[v.targetId] = (totals[v.targetId] ?? 0) + 1;
    counted++;
  }
  const top = Math.max(0, ...Object.values(totals));
  const leaders = Object.keys(totals).filter((id) => totals[id] === top);
  return { totals, accused: top > 0 && leaders.length === 1 ? leaders[0] : null, counted };
};

export type Outcome = { winner: "civilians" | "mafia"; reason: "caught" | "escaped" | "tie" | "mafia_left" };

export const outcome = (mafiaId: string, accused: string | null, mafiaLeft = false): Outcome => {
  if (mafiaLeft) return { winner: "civilians", reason: "mafia_left" };
  if (accused === mafiaId) return { winner: "civilians", reason: "caught" };
  return { winner: "mafia", reason: accused == null ? "tie" : "escaped" };
};

// ---------- Walks and checkpoints ----------

export type Checkpoint = { id: string; number: number; label: string; latitude: number; longitude: number; audience: "all" | "civilian" | "mafia" };

export const CHECKPOINT_RADIUS_M = 30;
const GRACE_MS = 2 * 60 * 1000;

/** The checkpoints a role may see: shared ones plus their own branch. */
export const checkpointsFor = (all: readonly Checkpoint[], role: MafiaRole) => all.filter((c) => c.audience === "all" || c.audience === role);

export type WalkReport =
  | { ok: true; reached: number[]; distanceM: number }
  | { ok: false; error: "no_points" | "outside_round" | "suspicious_speed" | "gps_gap" };

/**
 * Which of a player's checkpoints their walk really reached. Points must fall inside the walking window, move at a
 * walking pace and have no long holes. The route itself is not kept, only the result.
 */
export const reportWalk = (points: readonly TrackPoint[], visible: readonly Checkpoint[], window: { startsAt: number; endsAt: number }): WalkReport => {
  const inWindow = points.filter((p) => p.capturedAt >= window.startsAt - 60_000 && p.capturedAt <= window.endsAt + GRACE_MS);
  if (!points.length) return { ok: false, error: "no_points" };
  if (inWindow.length < points.length * 0.9) return { ok: false, error: "outside_round" };
  const track = cleanTrack(inWindow);
  if (!track.length) return { ok: false, error: "no_points" };
  const summary = summarizeTrack(track);
  const moved = summary.distanceM + summary.suspiciousM;
  if (moved > 0 && summary.suspiciousM / moved > GPS_RULES.maxSuspiciousShare) return { ok: false, error: "suspicious_speed" };
  const reached = visible
    .filter((c) => track.some((p) => metersBetween(p, c) <= CHECKPOINT_RADIUS_M))
    .map((c) => c.number)
    .sort((a, b) => a - b);
  return { ok: true, reached, distanceM: Math.round(summary.distanceM) };
};

/** A host's setup must branch: at least one checkpoint only civilians get and one only the Mafia gets. */
export const validateSetup = (checkpoints: readonly Pick<Checkpoint, "audience" | "latitude" | "longitude">[]) => {
  if (checkpoints.length < 2) return "too_few_checkpoints";
  if (!checkpoints.some((c) => c.audience === "civilian")) return "no_civilian_branch";
  if (!checkpoints.some((c) => c.audience === "mafia")) return "no_mafia_branch";
  if (checkpoints.length > 8) return "too_many_checkpoints";
  const far = checkpoints.some((a) => checkpoints.some((b) => metersBetween(a, b) > 2_000));
  if (far) return "checkpoints_too_far";
  return null;
};

// ---------- What a player may see ----------

export type Clue = { userId: string; reached: number[] };

/**
 * Route clues: only from players who chose to share (before or after the end), and only checkpoints everyone
 * knows about. The Mafia's secret checkpoint appears in a clue only once the round is over.
 */
export const visibleClues = (
  reports: readonly { userId: string; reached: number[]; shared: boolean }[],
  checkpoints: readonly Checkpoint[],
  finished: boolean,
): Clue[] => {
  const publicNumbers = new Set(checkpoints.filter((c) => finished || c.audience !== "mafia").map((c) => c.number));
  return reports.filter((r) => r.shared).map((r) => ({ userId: r.userId, reached: r.reached.filter((n) => publicNumbers.has(n)) }));
};
