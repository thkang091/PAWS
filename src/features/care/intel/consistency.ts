/**
 * How steadily the evening check-in is kept. A day is kept when it was answered (on the evening or caught up the
 * next day), rest when it was skipped on purpose, and missed when neither happened. Rest days never break a streak,
 * missed ones do. Only days from when check-ins were turned on count.
 */
export type DayMark = "kept" | "rest" | "missed" | "today" | "off";

export type ConsistencyDay = { date: string; mark: DayMark; catchUp: boolean };

export type Consistency = {
  /** The last seven days, oldest first, ending today. */
  week: ConsistencyDay[];
  /** Kept days in a row, counting today once it is answered. */
  streak: number;
  /** Missed days in a row, ending yesterday. */
  missedRun: number;
  missedThisWeek: number;
  /** Recent missed days (up to three, oldest first) that have not been offered as a catch-up yet. */
  catchUp: string[];
  /** steady: nothing missed lately. gap: yesterday was missed. slipping: two in a row, or three in a week. */
  level: "steady" | "gap" | "slipping";
};

export const CATCH_UP_DAYS = 3;
const LOOKBACK = 60;

export const shiftDay = (date: string, days: number) => {
  const [y, m, d] = date.split("-").map(Number);
  const at = new Date(y, m - 1, d + days);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`;
};

export const consistencyOf = ({
  today,
  since,
  entries,
  skipped,
  settledThrough,
}: {
  today: string;
  since: string | null;
  entries: Readonly<Record<string, { catchUp?: boolean }>>;
  skipped: readonly string[];
  settledThrough: string | null;
}): Consistency => {
  const rest = new Set(skipped);
  const markOf = (date: string): DayMark =>
    entries[date] ? "kept" : date === today ? "today" : !since || date < since ? "off" : rest.has(date) ? "rest" : "missed";

  const week = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDay(today, i - 6);
    return { date, mark: markOf(date), catchUp: Boolean(entries[date]?.catchUp) };
  });

  let streak = markOf(today) === "kept" ? 1 : 0;
  for (let i = 1; i <= LOOKBACK; i++) {
    const mark = markOf(shiftDay(today, -i));
    if (mark === "kept") streak += 1;
    else if (mark !== "rest") break;
  }

  let missedRun = 0;
  for (let i = 1; i <= LOOKBACK && markOf(shiftDay(today, -i)) === "missed"; i++) missedRun += 1;

  const missedThisWeek = week.filter((d) => d.mark === "missed").length;
  const catchUp = Array.from({ length: CATCH_UP_DAYS }, (_, i) => shiftDay(today, i - CATCH_UP_DAYS))
    .filter((date) => markOf(date) === "missed" && (!settledThrough || date > settledThrough));

  const level = missedRun >= 2 || missedThisWeek >= 3 ? "slipping" : missedRun === 1 ? "gap" : "steady";
  return { week, streak, missedRun, missedThisWeek, catchUp, level };
};
