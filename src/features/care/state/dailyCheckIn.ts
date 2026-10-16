import { useSyncExternalStore } from "react";
import { onWipe, syncedStorage as AsyncStorage } from "@/lib/cloudKv";

import type { MobilitySign } from "@/features/care/intel/careIntel";
import type { CheckInSupport } from "@/services/checkInSupport";

export type Appetite = "normal" | "less" | "more" | "skipped";
export type EnergyLevel = "normal" | "extra" | "low" | "restless";
export type StoolState = "normal" | "soft" | "diarrhea" | "hard";
export type UrinationState = "normal" | "more" | "less" | "difficulty";
export type DrinkingState = "normal" | "less" | "more" | "unsure";
export type UnusualSign = "vomiting" | "coughing" | "itching" | "limping" | "eye-ear" | "skin" | "other";
/** Whether the dog was walked today: tracked in PAWS, walked without PAWS, or not walked. */
export type WalkAnswer = "paws" | "outside" | "none";

export type DailyCheckIn = {
  date: string;
  appetite: Appetite | null;
  energy: EnergyLevel | null;
  stool: StoolState | null;
  urination: UrinationState | null;
  drinking: DrinkingState | null;
  unusual: readonly UnusualSign[];
  unusualNote: string;
  walk?: WalkAnswer | null;
  /** Movement signs from the check-in; Activity trends them, Health raises them when they persist. */
  mobility?: readonly MobilitySign[] | null;
  walkMinutes?: number | null;
  /** What PAWS suggested about today's unusual signs, kept so Health can show it again. */
  support?: CheckInSupport | null;
  /** Filled in the next day from memory, during a catch-up, rather than on the evening itself. */
  catchUp?: boolean;
};

export const DEFAULT_CHECKIN_TIME = "20:00";

type State = {
  hydrated: boolean;
  enabled: boolean;
  time: string;
  byDate: Readonly<Record<string, DailyCheckIn>>;
  skippedDates: readonly string[];
  /** The first day check-ins were on; missed days are only counted from here. */
  since: string | null;
  /** Missed days up to and including this date are settled (answered, or honestly not remembered) and no longer lock Care. */
  settledThrough: string | null;
};

const KEY = "paws.dailyCheckIn.v1";
const KEEP_DAYS = 60;

let state: State = { hydrated: false, enabled: false, time: DEFAULT_CHECKIN_TIME, byDate: {}, skippedDates: [], since: null, settledThrough: null };

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;
const emit = () => listeners.forEach((listener) => listener());

const commit = (next: State) => {
  state = next;
  emit();
  const { hydrated: _hydrated, ...persisted } = next;
  void AsyncStorage.setItem(KEY, JSON.stringify(persisted)).catch(() => undefined);
};

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    const saved = raw ? (JSON.parse(raw) as Partial<State>) : {};
    const byDate = { ...(saved.byDate ?? {}), ...state.byDate };
    const skippedDates = saved.skippedDates ?? state.skippedDates;
    const enabled = saved.enabled ?? state.enabled;
    // Older saves have no start day: the earliest day anything was answered or skipped is the best record of it.
    const earliest = [...Object.keys(byDate), ...skippedDates].sort()[0] ?? null;
    state = {
      hydrated: true,
      enabled,
      time: saved.time ?? state.time,
      byDate,
      skippedDates,
      since: saved.since ?? state.since ?? earliest ?? (enabled ? todayKey() : null),
      settledThrough: saved.settledThrough ?? state.settledThrough,
    };
  })
  .catch(() => {
    state = { ...state, hydrated: true };
  })
  .finally(emit);

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const trimmed = (byDate: Readonly<Record<string, DailyCheckIn>>) => {
  const keys = Object.keys(byDate).sort().slice(-KEEP_DAYS);
  return Object.fromEntries(keys.map((key) => [key, byDate[key]]));
};

export const submitDailyCheckIn = (entry: Omit<DailyCheckIn, "date">) => {
  const date = todayKey();
  commit({
    ...state,
    byDate: trimmed({ ...state.byDate, [date]: { ...entry, date } }),
    skippedDates: state.skippedDates.filter((day) => day !== date),
  });
};

export const skipDailyCheckInToday = () => {
  const date = todayKey();
  if (state.skippedDates.includes(date)) return;
  commit({ ...state, skippedDates: [...state.skippedDates.slice(-30), date] });
};

/** Turning check-ins on (or back on after a pause) starts the count fresh, so paused days never read as missed. */
export const enableDailyCheckIn = (time: string) =>
  commit({ ...state, enabled: true, time, since: state.enabled && state.since ? state.since : todayKey() });

/** Save a missed day from memory during a catch-up. Never overwrites a real evening check-in. */
export const submitCatchUp = (date: string, entry: Omit<DailyCheckIn, "date" | "catchUp">) => {
  if (state.byDate[date]) return;
  commit({ ...state, byDate: trimmed({ ...state.byDate, [date]: { ...entry, date, catchUp: true } }) });
};

/** Missed days up to this date have been dealt with (filled in or let go). */
export const settleMissedThrough = (through: string) => {
  if (state.settledThrough && state.settledThrough >= through) return;
  commit({ ...state, settledThrough: through });
};

/** Stop the evening check-in (and its lock) until it is turned back on. */
export const pauseDailyCheckIn = () => commit({ ...state, enabled: false });

/** Add answers to today's saved check-in, such as the walk question that comes after the health ones. */
export const updateTodayCheckIn = (patch: Partial<Omit<DailyCheckIn, "date">>) => {
  const date = todayKey();
  const current = state.byDate[date];
  if (!current) return;
  commit({ ...state, byDate: { ...state.byDate, [date]: { ...current, ...patch } } });
};

/** Change a saved check-in on any day it exists, from the edit screen. */
export const updateCheckIn = (date: string, patch: Partial<Omit<DailyCheckIn, "date">>) => {
  const current = state.byDate[date];
  if (!current) return;
  commit({ ...state, byDate: { ...state.byDate, [date]: { ...current, ...patch } } });
};

export const setCheckInTime = (time: string) => commit({ ...state, time });

export const afterDinner = (mealTimes: readonly string[]) => {
  const dinner = [...mealTimes].sort().at(-1);
  if (!dinner) return DEFAULT_CHECKIN_TIME;
  const [h, m] = dinner.split(":").map(Number);
  const minutes = Math.min(22 * 60, Math.max(17 * 60, h * 60 + m + 60));
  const rounded = Math.round(minutes / 30) * 30;
  return `${String(Math.floor(rounded / 60)).padStart(2, "0")}:${rounded % 60 ? "30" : "00"}`;
};

const useStore = () => useSyncExternalStore(subscribe, snapshot, snapshot);

export const useCheckInSettings = () => {
  const s = useStore();
  return { hydrated: s.hydrated, enabled: s.enabled, time: s.time, since: s.since, settledThrough: s.settledThrough };
};

export const useSkippedDates = (): readonly string[] => useStore().skippedDates;

export const useTodayCheckIn = () => {
  const s = useStore();
  const date = todayKey();
  return {
    date,
    entry: s.byDate[date] ?? null,
    skippedToday: s.skippedDates.includes(date),
  };
};

export const useCheckInHistory = (): readonly DailyCheckIn[] => {
  const s = useStore();
  return Object.values(s.byDate).sort((a, b) => (a.date < b.date ? 1 : -1));
};

export const useCheckInByDate = (): Readonly<Record<string, DailyCheckIn>> => useStore().byDate;

// A reset of the account empties this store too.
onWipe(() => {
  state = { hydrated: true, enabled: false, time: DEFAULT_CHECKIN_TIME, byDate: {}, skippedDates: [], since: null, settledThrough: null };
  emit();
});
