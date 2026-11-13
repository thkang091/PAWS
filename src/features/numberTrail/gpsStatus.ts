/**
 * What to say about GPS during a race, from the tracker's real lifecycle: permission, location services, when the last
 * fix arrived (from the watch or a direct check), its accuracy, and when the walk last moved.
 *
 * Standing still is not a GPS failure. The phone's watch only reports after a few metres of movement, so a walker
 * waiting at a crossing gets no new fixes; the tracker then asks the GPS directly every few seconds, and as long as
 * those answers arrive the status is "still" (waiting for movement), never "lost".
 */
export type GpsStatus = "denied" | "off" | "paused" | "searching" | "lost" | "poor" | "still" | "active";

export const GPS_STATUS_RULES = {
  /** No fix at all this long after starting: lost, not searching. */
  firstFixMs: 30_000,
  /** No fix from the watch or a direct check for this long: lost. Direct checks run every `confirmEveryMs`. */
  lostMs: 45_000,
  confirmEveryMs: 15_000,
  /** Fixes worse than this don't count. */
  poorAccuracyM: 25,
  /** No accepted movement for this long while fixes still arrive: waiting for movement. */
  stillMs: 20_000,
} as const;

export const gpsStatusOf = (s: {
  access: "granted" | "denied" | "blocked" | "unavailable" | null;
  servicesOn: boolean | null;
  paused: boolean;
  startedAt: number | null;
  lastFixAt: number | null;
  lastAccuracyM: number | null;
  lastMovedAt: number | null;
  now: number;
}): GpsStatus => {
  const r = GPS_STATUS_RULES;
  if (s.access === "denied" || s.access === "blocked") return "denied";
  if (s.access === "unavailable" || s.servicesOn === false) return "off";
  if (s.paused) return "paused";
  if (s.lastFixAt == null) return s.startedAt != null && s.now - s.startedAt > r.firstFixMs ? "lost" : "searching";
  if (s.now - s.lastFixAt > r.lostMs) return "lost";
  if (s.lastAccuracyM == null || s.lastAccuracyM > r.poorAccuracyM) return "poor";
  if (s.lastMovedAt == null || s.now - s.lastMovedAt > r.stillMs) return "still";
  return "active";
};

export const GPS_LABELS: Record<GpsStatus, string> = {
  denied: "Location is off for PAWS",
  off: "Location services are off",
  paused: "Paused",
  searching: "Finding GPS",
  lost: "GPS signal lost",
  poor: "GPS is weak here",
  still: "Waiting for you to move",
  active: "GPS on",
};

/** Whether the status is a problem the walker should act on. */
export const gpsNeedsAttention = (s: GpsStatus) => s === "denied" || s === "off" || s === "lost" || s === "poor";
