/**
 * Number Trail screen states (contract for Phase N3), derived only from the canonical RaceState and this phone's
 * server-clock offset. Nothing here invents progress, a time or a result: every field traces to the server.
 *
 * Journey: Lobby -> Reveal (number drawn, countdown) -> Live race -> Finish check -> Results.
 * Motion direction (emil-design-eng): rare moments may delight, frequent ones stay still; ease-out for entries,
 * transform and opacity only, reduced motion keeps opacity changes and drops movement.
 */
import type { RaceState, RacePlayer } from "../../../supabase/functions/tournament/numberContract";
import type { CourseView, NumberCourse, ProgressPhase } from "../../../supabase/functions/tournament/numberMatch";
import { countdownLeftMs, raceElapsedMs } from "./raceSync";

export const NUMBER_MOTION = {
  easeOut: [0.23, 1, 0.32, 1] as const,
  easeInOut: [0.77, 0, 0.175, 1] as const,
  /** Once per match: each digit fades in from scale 0.96. */
  revealMs: 260,
  revealStaggerMs: 60,
  revealFromScale: 0.96,
  /** Countdown seconds crossfade with a light blur. */
  countdownCrossfadeMs: 150,
  countdownBlurPx: 2,
  /** Progress bars: scaleX only, never backwards. */
  progressMs: 240,
  phaseChipMs: 200,
  toastInMs: 220,
  toastOutMs: 160,
  verifyCrossfadeMs: 200,
  resultsStaggerMs: 40,
  pressScale: 0.97,
  /** GPS quality and map follow never animate. */
} as const;

export type Screen = "lobby" | "reveal" | "live" | "finish" | "results" | "cancelled";

export const screenOf = (s: Pick<RaceState, "match" | "me">): Screen => {
  const m = s.match;
  if (m.status === "cancelled") return "cancelled";
  if (m.status === "completed") return "results";
  // A drawn number is the reveal: shown as soon as it exists, with the countdown once the host starts.
  if (m.status === "ready" || m.status === "countdown") return "reveal";
  if (m.status === "active" || m.status === "verifying") {
    const a = s.me.lastAttempt;
    return a && (a.status === "pending" || a.status === "verified") ? "finish" : "live";
  }
  return "lobby";
};

/** Lobby: who is here, who is ready, whether the host can start, and why not. */
export const lobbyView = (s: RaceState) => {
  const inRoom = s.players.filter((p) => p.inRoom);
  const notReady = inRoom.filter((p) => !p.ready && !p.isHost);
  const blocker =
    s.match.preparing ? "preparing"
    : s.match.status !== "ready" ? "no_number"
    : inRoom.length < 2 ? "need_players"
    : notReady.length ? "waiting_ready"
    : null;
  return {
    players: inRoom,
    readyCount: inRoom.filter((p) => p.ready || p.isHost).length,
    capacity: s.room.maxPlayers,
    isHost: s.me.isHost,
    preparing: s.match.preparing,
    prepareError: s.match.prepareError,
    number: s.match.number,
    minutes: s.match.minutes,
    difficulty: s.match.difficulty,
    canStart: s.me.isHost && blocker === null,
    blocker,
  };
};

/** Reveal: the number, its distance and time, and the countdown on the server's clock. */
export const revealView = (s: RaceState, offsetMs: number, phoneNowMs: number) => ({
  number: s.match.number,
  distanceKm: s.course ? Math.round(s.course.raceM / 100) / 10 : null,
  estimatedMinutes: s.course?.minutes ?? null,
  difficulty: s.course?.difficulty ?? s.match.difficulty,
  layout: s.course?.layout ?? null,
  headingDeg: s.course?.headingDeg ?? 0,
  /** Null before the host starts: the number is shown, the clock isn't running. */
  countdownMs: s.match.status === "countdown" ? countdownLeftMs(s.match.startsAt, offsetMs, phoneNowMs) : null,
  canStart: s.me.isHost && s.match.status === "ready",
  canRedraw: s.me.isHost && s.match.status === "ready",
});

export type GpsQuality = "good" | "weak" | "lost";
/** From the phone's latest fix (age and accuracy) and the server's last check of this walk. */
export const gpsQuality = (lastFix: { accuracyM: number | null; ageMs: number } | null, serverFlags?: { jumps: number }) => {
  if (!lastFix || lastFix.ageMs > 30_000) return "lost" as GpsQuality;
  if ((serverFlags?.jumps ?? 0) > 0 || lastFix.accuracyM == null || lastFix.accuracyM > 20) return "weak" as GpsQuality;
  return "good" as GpsQuality;
};

/** Live race: this walk as the server last checked it. Bars only ever move forward on screen. */
export const liveView = (s: RaceState, offsetMs: number, phoneNowMs: number, shown?: { one: number; connector: number; two: number }) => {
  const p = s.me.progress;
  const one = p?.digits?.[0]?.coverage ?? 0;
  const two = p?.digits?.[1]?.coverage ?? 0;
  const connector = p?.connector ?? 0;
  return {
    phase: (p?.phase ?? "DIGIT_1_PENDING") as ProgressPhase,
    atStart: p?.atStart ?? false,
    one: Math.max(shown?.one ?? 0, one),
    connector: Math.max(shown?.connector ?? 0, connector),
    two: Math.max(shown?.two ?? 0, two),
    edges: p?.edges ?? [{}, {}],
    elapsedMs: raceElapsedMs(s.match.startsAt, offsetMs, phoneNowMs),
    endsAt: s.match.endsAt,
    others: s.players.filter((x: RacePlayer) => x.userId !== s.me.userId && x.status),
    checkedAt: p?.verifiedAt ?? null,
    /** A refused hand-in stays on screen until the walk moves on (the server shows INVALID_COMPLETION until then). */
    refusal: p?.phase === "INVALID_COMPLETION" && s.me.lastAttempt?.status === "rejected" ? s.me.lastAttempt.reason : null,
    canHandIn: handInPhase((p?.phase ?? "DIGIT_1_PENDING") as ProgressPhase),
  };
};

/** Every part of the course walked: the player may hand in (the server decides whether it counts). */
export const handInPhase = (phase: ProgressPhase) => phase === "DIGIT_2_COMPLETE" || phase === "NUMBER_COMPLETE" || phase === "INVALID_COMPLETION";

export type CourseRowKey = "one" | "link" | "two" | "finish";
/** The parts of a course in walking order, as progress rows: one or two digits, the link between, the finish stretch. */
export const courseRows = (course: { number: string; digits: unknown[]; finish?: unknown[] | null }) => {
  const rows: { key: CourseRowKey; label: string; thin: boolean }[] = [{ key: "one", label: course.digits.length > 1 ? `Digit ${course.number[0]}` : `Digit ${course.number}`, thin: false }];
  if (course.digits.length > 1) rows.push({ key: "link", label: "Link", thin: true }, { key: "two", label: `Digit ${course.number[1]}`, thin: false });
  if (course.finish?.length) rows.push({ key: "finish", label: "Finish", thin: true });
  return rows;
};

/** Which part of the course the walker is on, from the server's phase. `focus` is the digit to frame. */
export const stageOf = (phase: ProgressPhase, digits: number): { label: string; focus: 0 | 1 } => {
  if (phase === "FINISH_IN_PROGRESS") return { label: "Finish stretch", focus: digits > 1 ? 1 : 0 };
  if (digits === 1) return phase === "DIGIT_1_PENDING" || phase === "DIGIT_1_IN_PROGRESS" ? { label: "Your digit", focus: 0 } : { label: "Number complete", focus: 0 };
  if (phase === "DIGIT_1_PENDING" || phase === "DIGIT_1_IN_PROGRESS") return { label: "Digit 1 of 2", focus: 0 };
  if (phase === "DIGIT_1_COMPLETE" || phase === "CONNECTOR_IN_PROGRESS") return { label: "On the link", focus: 1 };
  if (phase === "DIGIT_2_IN_PROGRESS") return { label: "Digit 2 of 2", focus: 1 };
  return { label: "Number complete", focus: 1 };
};

/**
 * What to announce to screen readers (and haptics) when the phase changes; null when nothing changed. Phase labels
 * come from raceCopy.PHASE_LABELS so the announcement matches what is on screen.
 */
export const phaseChanged = (before: ProgressPhase | null, after: ProgressPhase) => (before !== after ? after : null);

export type FinishState = "verifying" | "accepted" | "waiting_on_earlier" | "incomplete" | "gps_invalid" | "already_completed";

/** Finish check, from the last attempt as stored. */
export const finishView = (s: RaceState): { state: FinishState; reason: string | null; retry: boolean; placement: number | null } => {
  const a = s.me.lastAttempt;
  if (s.match.status === "completed" && (!a || a.status !== "verified")) return { state: "already_completed", reason: null, retry: false, placement: null };
  if (!a || a.status === "pending") return { state: "verifying", reason: null, retry: false, placement: null };
  if (a.status === "verified") return a.finishOrder ? { state: "accepted", reason: null, retry: false, placement: a.finishOrder } : { state: "waiting_on_earlier", reason: null, retry: false, placement: null };
  const gps = a.reason === "gps_review" || a.reason === "replayed_walk";
  return { state: gps ? "gps_invalid" : "incomplete", reason: a.reason, retry: !gps && a.reason !== "connector_invalid", placement: null };
};

/** Results: official placements only; placements after the winner may still be settling until `final`. */
export const resultsView = (s: RaceState) => ({
  number: s.match.number,
  outcome: s.match.outcome,
  winner: s.players.find((p) => p.userId === s.match.winnerUserId) ?? null,
  final: s.match.finalized,
  photoFinish: s.match.result?.photoFinish ?? false,
  rows: s.results.map((r) => ({ ...r, name: s.players.find((p) => p.userId === r.userId)?.name ?? "A PAWS dog", isMe: r.userId === s.me.userId })),
  canPlayAgain: s.me.isHost && s.match.finalized,
});

/**
 * A course the server sent as a view (street polylines only, digits as strokes) in the shape the map draws. Only for
 * drawing: nothing is judged from it.
 */
export const drawableCourse = (v: CourseView): NumberCourse =>
  ({ ...v, start: { ...v.start, nodeId: "" }, end: v.end ?? undefined, digits: v.digits.map((d) => ({ ...d, edges: d.strokes })) }) as unknown as NumberCourse;

// ---------------------------------------------------------------------------------------------------------------
// Online races (phase P4): one number, everyone on their own streets
// ---------------------------------------------------------------------------------------------------------------

export type OnlineStage = "choosing" | "setup" | "searching" | "matching" | "matched" | "unmatched" | "countdown";
export type OnlinePlayerRow = {
  userId: string;
  name: string;
  isMe: boolean;
  isHost: boolean;
  search: "not_started" | "searching" | "found" | "none" | "error";
  officialM: number | null;
  atStart: boolean;
};

/**
 * The online lobby from the canonical state only. Nobody's route or position is in it: per player only how their
 * search went, their official course length and whether they are at their own start.
 */
export const onlineView = (s: RaceState) => {
  const o = s.online!;
  const status = s.match.status;
  const eq = o.equivalence;
  const rows: OnlinePlayerRow[] = s.players
    .filter((p) => p.inRoom)
    .map((p) => {
      const x = o.players.find((q) => q.userId === p.userId);
      return {
        userId: p.userId,
        name: p.name,
        isMe: p.userId === s.me.userId,
        isHost: p.isHost,
        search: (x?.search?.status ?? "not_started") as OnlinePlayerRow["search"],
        officialM: x?.officialM ?? null,
        atStart: Boolean(x?.atStart),
      };
    });
  const me = rows.find((r) => r.isMe) ?? null;
  // An unmatched try sends the race back to searching with the verdict kept.
  const unmatched = status === "course_search" && eq != null && eq.status !== "matched" && eq.status !== "unranked";
  const stage: OnlineStage =
    status === "countdown" ? "countdown"
    : status === "ready" ? "matched"
    : status === "course_matching" ? "matching"
    : unmatched ? "unmatched"
    : status === "course_search" ? "searching"
    : o.requestedNumber ? "setup"
    : "choosing";
  const searchedAll = rows.length >= 2 && rows.every((r) => r.search === "found" || r.search === "none" || r.search === "error");
  const allFound = rows.length >= 2 && rows.every((r) => r.search === "found");
  const allAtStart = rows.length >= 2 && rows.every((r) => r.atStart);
  const host = s.me.isHost;
  const hostAction: "start_search" | "match" | "start" | null =
    !host ? null
    : stage === "setup" ? (rows.length >= 2 ? "start_search" : null)
    : (stage === "searching" || stage === "unmatched") && searchedAll ? "match"
    : stage === "matched" && allAtStart ? "start"
    : null;
  const myStep: "search" | "searching" | "wait" | "checkin" | "at_start" | null =
    !me ? null
    : stage === "searching" || stage === "unmatched" ? (me.search === "found" ? "wait" : me.search === "searching" ? "searching" : "search")
    : stage === "matched" ? (me.atStart ? "at_start" : "checkin")
    : null;
  const lengths = rows.map((r) => r.officialM).filter((m): m is number => m != null);
  return {
    stage,
    rows,
    me,
    ranked: o.ranked,
    number: o.requestedNumber,
    category: o.category,
    targetM: o.targetM,
    toleranceM: Math.round(o.spreadShare * o.targetM),
    verdict: eq ? { status: eq.status, spreadM: Math.round(eq.spread_m * 10) / 10, toleranceM: Math.round(eq.tolerance_m), failed: (eq.checks ?? []).filter((c) => !c.ok).map((c) => c.name), unknown: eq.unknown ?? [] } : null,
    spreadM: lengths.length >= 2 ? Math.round((Math.max(...lengths) - Math.min(...lengths)) * 10) / 10 : null,
    allFound,
    searchedAll,
    allAtStart,
    hostAction,
    myStep,
    waitingFor: stage === "matched" ? rows.filter((r) => !r.atStart).length : rows.filter((r) => r.search === "not_started" || r.search === "searching").length,
  };
};
