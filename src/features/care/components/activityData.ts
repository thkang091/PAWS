import type { ExerciseLog } from "@/services/careHealthService";

export type Walk = {
  key: string;
  label: string;
  startedAt: string;
  duration: string;
  distance: string;
  note: string | null;
};

export type ActivityHour = {
  label?: string;
  value: number;
};

export type ActivityDay = {
  key: string;
  label: string;
  date: Date;
  minutes: number;
  km: number | null;
  pace: string | null;
  walks: readonly Walk[];
  hours: readonly ActivityHour[];
  bands: Record<WalkBand, number>;
};

export type ScheduleEntry = {
  time: string;
  title: string;
  detail?: string;
  kind: "walk" | "routine";
  done: boolean;
};

export const WALK_BANDS = [
  { key: "morning", label: "Morning" },
  { key: "midday", label: "Midday" },
  { key: "evening", label: "Evening" },
] as const;

export type WalkBand = (typeof WALK_BANDS)[number]["key"];

export type DayStack = {
  key: string;
  label: string;
  dayIndex: number;
  bands: Record<WalkBand, number>;
  total: number;
  today: boolean;
};

export type ActivityWeek = {
  days: readonly ActivityDay[];
  stacks: readonly DayStack[];
  totals: { minutes: number; km: number | null; walks: number; activeDays: number };
};

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

const BUCKET_START = 0;
const BUCKET_SIZE = 120;
const BUCKETS = 12;
const BUCKET_LABELS = ["12 am", "4 am", "8 am", "12 pm", "4 pm", "8 pm"];

export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const asDuration = (minutes: number) => {
  const whole = Math.round(minutes);
  if (whole < 60) return `${whole} min`;
  const rest = whole % 60;
  return rest === 0 ? `${whole / 60}h` : `${Math.floor(whole / 60)}h ${String(rest).padStart(2, "0")}m`;
};

export const asKm = (km: number) => (km < 1 ? km.toFixed(2) : km < 10 ? km.toFixed(1) : String(Math.round(km)));

const kmOf = (log: ExerciseLog) => (log.distanceMiles == null ? null : log.distanceMiles * 1.609344);

const startOf = (log: ExerciseLog) => {
  const end = new Date(log.createdAt);
  return new Date(end.getTime() - log.durationMinutes * 60 * 1000);
};

const clock = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

const bandOf = (d: Date): WalkBand => {
  const hour = d.getHours();
  return hour < 12 ? "morning" : hour < 17 ? "midday" : "evening";
};

export const paceOf = (minutes: number, km: number | null) => {
  if (km == null || km < 0.05 || minutes <= 0) return null;
  const perKm = Math.round((minutes * 60) / km);
  return `${Math.floor(perKm / 60)}:${String(perKm % 60).padStart(2, "0")}`;
};

const buildDay = (date: Date, logs: readonly ExerciseLog[]): ActivityDay => {
  const sorted = [...logs].sort((a, b) => startOf(a).getTime() - startOf(b).getTime());
  const minutes = sorted.reduce((total, log) => total + log.durationMinutes, 0);
  const kms = sorted.map(kmOf).filter((km): km is number => km != null);
  const km = kms.length > 0 ? Math.round(kms.reduce((a, b) => a + b, 0) * 100) / 100 : null;

  const bands: Record<WalkBand, number> = { morning: 0, midday: 0, evening: 0 };
  const buckets = Array.from({ length: BUCKETS }, () => 0);

  sorted.forEach((log) => {
    const start = startOf(log);
    bands[bandOf(start)] += log.durationMinutes;
    const minuteOfDay = start.getHours() * 60 + start.getMinutes();
    const index = Math.floor((minuteOfDay - BUCKET_START) / BUCKET_SIZE);
    buckets[Math.min(BUCKETS - 1, Math.max(0, index))] += log.durationMinutes;
  });

  const peak = Math.max(...buckets, 1);

  return {
    key: isoDay(date),
    label: DAY_LABEL[date.getDay()],
    date,
    minutes,
    km,
    pace: paceOf(minutes, km),
    bands,
    hours: buckets.map((value, index) => ({
      value: value / peak,
      label: index % 2 === 0 ? BUCKET_LABELS[index / 2] : undefined,
    })),
    walks: sorted.map((log, index) => {
      const logKm = kmOf(log);
      return {
        key: log.id,
        label: `${ORDINAL[index] ?? `${index + 1}th`} walk`,
        startedAt: clock(startOf(log)),
        duration: asDuration(log.durationMinutes),
        distance: logKm == null ? "No distance" : `${logKm.toFixed(logKm < 10 ? 2 : 1)} km`,
        note: log.notes,
      };
    }),
  };
};

export const buildActivityWeek = (
  week: readonly Date[],
  logs: readonly ExerciseLog[],
  today: Date,
): ActivityWeek => {
  const byDay = new Map<string, ExerciseLog[]>();
  logs.forEach((log) => {
    const list = byDay.get(log.logDate) ?? [];
    list.push(log);
    byDay.set(log.logDate, list);
  });

  const days = week.map((date) => buildDay(date, byDay.get(isoDay(date)) ?? []));
  const kms = days.map((day) => day.km).filter((km): km is number => km != null);

  return {
    days,
    stacks: days.map((day) => ({
      key: day.key,
      label: day.label,
      dayIndex: day.date.getDay(),
      bands: day.bands,
      total: day.minutes,
      today: isoDay(day.date) === isoDay(today),
    })),
    totals: {
      minutes: days.reduce((total, day) => total + day.minutes, 0),
      km: kms.length > 0 ? Math.round(kms.reduce((a, b) => a + b, 0) * 100) / 100 : null,
      walks: days.reduce((total, day) => total + day.walks.length, 0),
      activeDays: days.filter((day) => day.minutes > 0).length,
    },
  };
};
