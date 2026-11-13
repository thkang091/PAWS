import { GPS_RULES, type TerritoryIssue, type TournamentPhase } from "../../../supabase/functions/tournament/geo";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Square metres up to a hectare-ish, then square kilometres. */
export const formatArea = (m2: number | null | undefined) => {
  if (m2 == null || !Number.isFinite(m2) || m2 <= 0) return "-";
  if (m2 < 100_000) return `${Math.round(m2).toLocaleString()} m²`;
  return `${(m2 / 1_000_000).toFixed(2)} km²`;
};

/** The other unit, shown smaller beside the main one. */
export const formatAreaAlt = (m2: number | null | undefined) => {
  if (m2 == null || m2 <= 0) return null;
  return m2 < 100_000 ? `${(m2 / 1_000_000).toFixed(3)} km²` : `${Math.round(m2).toLocaleString()} m²`;
};

/** A Follow the Shape score, out of 100. */
export const formatPoints = (score: number | null | undefined) => (score == null || !Number.isFinite(score) ? "-" : `${score.toFixed(1)}`);

/** A leaderboard value in its game's unit. */
export const formatBoardValue = (unit: "m2" | "points", value: number) => (unit === "points" ? `${formatPoints(value)} pts` : formatArea(value));

export const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`);

export const formatDuration = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

const day = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

export const formatPeriod = (startsAt: string, endsAt: string) => `${day(startsAt)} to ${day(endsAt)}`;

/** "Ends in 3 days", "Starts tomorrow", relative to the server's clock. */
export const formatCountdown = (iso: string, now: number, verb: "Ends" | "Starts" | "Opens") => {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return null;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return `${verb} within the hour`;
  if (hours < 24) return `${verb} in ${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? `${verb} tomorrow` : `${verb} in ${days} days`;
};

/** The one date that matters for a tournament right now, as a label and a short value. */
export const formatWhen = (t: { phase: TournamentPhase; registrationOpensAt: string; startsAt: string; endsAt: string }, now: number) => {
  const short = (iso: string) => {
    const ms = Date.parse(iso) - now;
    const hours = Math.round(ms / 3_600_000);
    if (ms <= 0) return day(iso);
    if (hours < 1) return "Soon";
    if (hours < 24) return `${hours}h`;
    const days = Math.round(hours / 24);
    return days === 1 ? "Tomorrow" : `${days} days`;
  };
  switch (t.phase) {
    case "active":
      return { label: "Ends in", value: short(t.endsAt) };
    case "registration":
      return { label: "Starts in", value: short(t.startsAt) };
    case "upcoming":
      return { label: "Opens in", value: short(t.registrationOpensAt) };
    default:
      return { label: "Ended", value: day(t.endsAt) };
  }
};

export const PHASE_LABEL: Record<TournamentPhase, string> = {
  upcoming: "Upcoming",
  registration: "Registration open",
  active: "Live now",
  completed: "Finished",
  cancelled: "Cancelled",
};

/** What to tell a player whose walk cannot claim yet, in a line they can act on. */
export const ISSUE_TEXT: Record<TerritoryIssue, string> = {
  not_closed: "Almost there! Return closer to your starting point to complete your territory.",
  too_short: `Walk at least ${GPS_RULES.minDistanceM} m to claim a territory.`,
  too_few_points: "We need a few more GPS readings. Keep walking for a little longer.",
  gps_gap: "GPS dropped out for part of the walk, so the outline has a hole. Try again somewhere more open.",
  suspicious_speed: "Part of the route moved faster than walking pace, so it can't count.",
  too_long: "Walks are limited to three hours.",
  self_intersecting: "Your route crosses itself. Walk one loop without crossing your own path.",
  too_small: "That loop encloses almost no space. Walk a wider loop.",
  too_large: "That territory is bigger than this tournament allows.",
};

/** Why a shape walk can't be scored yet, in a line the player can act on. */
export const SHAPE_ISSUE_TEXT = {
  too_short: "Keep going. The shape needs a little more distance to count.",
  too_few_points: "We need a few more GPS readings. Keep walking for a little longer.",
  gps_gap: "GPS dropped out for part of the walk, so the shape has a hole. Try again somewhere more open.",
  suspicious_speed: "Part of the route moved faster than walking pace, so it can't count.",
  too_long: "Walks are limited to three hours.",
  route_incomplete: "Walk more of your route first. At least half of it has to be covered.",
  route_out_of_order: "The walk didn't follow the route in order. Follow it from the start, either way round.",
} as const;

export const ERROR_TEXT: Record<string, string> = {
  route_required: "Pick a route before you walk.",
  not_your_route: "That route belongs to someone else.",
  route_expired: "Those routes are more than a day old. Find new ones.",
  route_closed: "That route has already been walked or swapped.",
  route_in_use: "That route is linked to another walk.",
  wrong_tournament: "That route was made for a different tournament.",
  not_deployed: "Tournaments aren't set up on the server yet.",
  not_running: "This tournament isn't running right now.",
  not_joined: "Join the tournament first.",
  registration_closed: "Registration for this tournament is closed.",
  window_closed: "This tournament has closed, so the walk can't be handed in.",
  session_closed: "This walk has already ended.",
  location_off: "Location Services are off. Turn them on in Settings to walk.",
  offline_pending: "You're offline. Your walk is saved on this phone. Finish again when you have signal.",
  slow_down: "One moment. Try again in a few seconds.",
  record_failed: "The result couldn't be saved. Try again.",
  no_challenge: "This tournament doesn't have a shape yet.",
  network: "No connection. Try again.",
  timeout: "That took too long. Try again.",
  routing_unavailable: "Walking paths couldn't be loaded right now, so no route can be planned. Try again in a minute.",
  routing_busy: "The map service is busy. Try again in a minute.",
};

export const errorText = (code: string | null | undefined) => (code && ERROR_TEXT[code]) || "Something went wrong. Try again.";
