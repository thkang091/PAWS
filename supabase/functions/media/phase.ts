/**
 * The media challenge timeline, the same as public.media_phase() in SQL: registration, entries, voting, completed.
 * Shared by the app (labels and countdowns) and the edge function.
 */

export type MediaPhase = "upcoming" | "registration" | "entries" | "voting" | "completed" | "cancelled";

export type MediaTimes = {
  status?: string;
  registrationOpensAt: string;
  startsAt: string;
  entriesCloseAt: string;
  endsAt: string;
};

export const mediaPhase = (t: MediaTimes, now: number): MediaPhase => {
  if (t.status === "cancelled") return "cancelled";
  if (now < Date.parse(t.registrationOpensAt)) return "upcoming";
  if (now < Date.parse(t.startsAt)) return "registration";
  if (now < Date.parse(t.entriesCloseAt)) return "entries";
  if (now < Date.parse(t.endsAt)) return "voting";
  return "completed";
};

/** When the current phase ends, or null once it's over. */
export const phaseEndsAt = (t: MediaTimes, phase: MediaPhase): string | null =>
  phase === "upcoming" ? t.registrationOpensAt : phase === "registration" ? t.startsAt : phase === "entries" ? t.entriesCloseAt : phase === "voting" ? t.endsAt : null;

export type EntryStatus = "checking" | "approved" | "held" | "pending_review" | "rejected" | "withdrawn";

/** Whether another player can see this entry in the gallery. */
export const isVisible = (s: { status: EntryStatus; hiddenByReports?: boolean }) => s.status === "approved" && !s.hiddenByReports;

/** Results: most votes first, earlier entry first on a tie. The same order as public.media_results(). */
export const rankEntries = <T extends { votes: number; submittedAt: string }>(rows: readonly T[]) =>
  [...rows]
    .sort((a, b) => b.votes - a.votes || Date.parse(a.submittedAt) - Date.parse(b.submittedAt))
    .map((r, i) => ({ ...r, rank: i + 1 }));
