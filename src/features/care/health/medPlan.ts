import type { Medication } from "@/services/careHealthService";

export type Frequency = "daily" | "weekly" | "monthly" | "as_needed";

export const FREQUENCIES: readonly { key: Frequency; label: string }[] = [
  { key: "daily", label: "Every day" },
  { key: "weekly", label: "Every week" },
  { key: "monthly", label: "Every month" },
  { key: "as_needed", label: "When needed" },
];

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key: string, days: number) => {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
};

export const todayKey = () => dayKey(new Date());

export const shortDay = (key: string) => {
  const d = fromKey(key);
  return `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
};

export const relativeDay = (key: string) => {
  const today = todayKey();
  if (key === today) return "Today";
  if (key === addDays(today, 1)) return "Tomorrow";
  if (key === addDays(today, -1)) return "Yesterday";
  return shortDay(key);
};

export const prettyClock = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

const ordinal = (n: number) => {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${tail}`;
};

const asFrequency = (value: string): Frequency =>
  (["daily", "weekly", "monthly", "as_needed"] as const).includes(value as Frequency) ? (value as Frequency) : "daily";

type Plan = Pick<Medication, "frequency" | "startDate" | "endDate" | "reminderTime">;

export const isFinished = (med: Plan, key = todayKey()) => Boolean(med.endDate && med.endDate < key);

export const dueOn = (med: Plan, key: string) => {
  if (key < med.startDate || isFinished(med, key)) return false;
  const frequency = asFrequency(med.frequency);
  if (frequency === "as_needed") return false;
  if (frequency === "daily") return true;
  const day = fromKey(key);
  const start = fromKey(med.startDate);
  if (frequency === "weekly") return day.getDay() === start.getDay();
  const lastOfMonth = new Date(day.getFullYear(), day.getMonth() + 1, 0).getDate();
  return day.getDate() === Math.min(start.getDate(), lastOfMonth);
};

export const nextDue = (med: Plan, from = todayKey()) => {
  for (let i = 0; i < 400; i++) {
    const key = addDays(from, i);
    if (med.endDate && key > med.endDate) return null;
    if (dueOn(med, key)) return key;
  }
  return null;
};

export const upcomingDoses = (med: Plan, count: number, from = todayKey()) => {
  const out: string[] = [];
  let cursor = from;
  while (out.length < count) {
    const next = nextDue(med, cursor);
    if (!next) break;
    out.push(next);
    cursor = addDays(next, 1);
  }
  return out;
};

export const cadence = (med: Plan) => {
  const frequency = asFrequency(med.frequency);
  const start = fromKey(med.startDate);
  const at = med.reminderTime ? ` at ${prettyClock(med.reminderTime)}` : "";
  if (frequency === "as_needed") return "When needed";
  if (frequency === "daily") return `Every day${at}`;
  if (frequency === "weekly") return `Every ${WEEKDAY[start.getDay()]}${at}`;
  return `On the ${ordinal(start.getDate())} of each month${at}`;
};

export const courseNote = (med: Plan, key = todayKey()) => {
  if (!med.endDate) return "Ongoing";
  if (med.endDate < key) return `Finished ${shortDay(med.endDate)}`;
  const left = Math.round((fromKey(med.endDate).getTime() - fromKey(key).getTime()) / 86_400_000) + 1;
  return left === 1 ? "Last day today" : `${left} days left, until ${shortDay(med.endDate)}`;
};

export const weekdayOf = (key: string) => WEEKDAY[fromKey(key).getDay()];
export const ordinalDay = (key: string) => ordinal(fromKey(key).getDate());
