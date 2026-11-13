import type { MediaChallenge } from "@/services/mediaService";
import type { MediaPhase } from "../../../supabase/functions/media/phase";

const PRIORITY: Record<MediaPhase, number> = { entries: 0, voting: 1, registration: 2, upcoming: 3, completed: 4, cancelled: 5 };

/** The challenge the game screen leads with: one taking photos, then voting, then the next to open, then the latest. */
export const featuredOf = (list: readonly MediaChallenge[]) =>
  [...list]
    .filter((c) => c.phase !== "cancelled")
    .sort((a, b) => PRIORITY[a.phase] - PRIORITY[b.phase] || (a.phase === "completed" ? Date.parse(b.endsAt) - Date.parse(a.endsAt) : Date.parse(a.startsAt) - Date.parse(b.startsAt)))[0] ?? null;

/** "in 2 days", "in 5h", "within the hour", or null once it's passed. */
export const until = (iso: string, now: number) => {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return null;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return "within the hour";
  if (hours < 24) return `in ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "tomorrow" : `in ${days} days`;
};

/** The one line of timing a challenge needs right now. */
export const timingLine = (c: Pick<MediaChallenge, "phase" | "registrationOpensAt" | "startsAt" | "entriesCloseAt" | "endsAt">, now: number) => {
  const at = (iso: string, lead: string) => {
    const u = until(iso, now);
    return u ? `${lead} ${u}` : null;
  };
  switch (c.phase) {
    case "upcoming":
      return at(c.registrationOpensAt, "Opens");
    case "registration":
      return at(c.startsAt, "Photos open");
    case "entries":
      return at(c.entriesCloseAt, "Entries close");
    case "voting":
      return at(c.endsAt, "Voting closes");
    case "completed":
      return "Results are in";
    default:
      return null;
  }
};

export type PoseAction = { label: string; sub?: string; tone: "yellow" | "white"; kind: "enter" | "retake" | "vote" | "results" | "none" };

/** The bottom button on a challenge, from its phase and your entry. */
export const actionFor = (c: MediaChallenge, now: number): PoseAction | null => {
  switch (c.phase) {
    case "entries": {
      const e = c.myEntry;
      if (!e || e.status === "rejected") return { label: "Try this pose", sub: c.joined ? undefined : "Free to enter", tone: "yellow", kind: "enter" };
      if (e.status === "held") return { label: "Retake your photo", tone: "yellow", kind: "retake" };
      return { label: "Change your photo", sub: timingLine(c, now) ?? undefined, tone: "white", kind: "retake" };
    }
    case "voting":
      // Nothing to vote on: a plain fact, not a button into an empty gallery.
      if (c.entries === 0) return { label: "No photos this time", sub: c.private ? undefined : "A new one opens soon", tone: "white", kind: "none" };
      return { label: c.myVote ? "Change your vote" : "Vote for a favourite", sub: timingLine(c, now) ?? undefined, tone: "yellow", kind: "vote" };
    case "completed":
      return { label: "See results", tone: "white", kind: "results" };
    case "registration":
    case "upcoming":
      return { label: "Not open yet", sub: timingLine(c, now) ?? undefined, tone: "white", kind: "none" };
    default:
      return null;
  }
};
