import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Appetite = "normal" | "less" | "more" | "skipped";
export type EnergyLevel = "normal" | "extra" | "low" | "restless";
export type StoolState = "normal" | "soft" | "diarrhea" | "hard";
export type UrinationState = "normal" | "more" | "less" | "difficulty";
export type DrinkingState = "normal" | "less" | "more" | "unsure";
export type UnusualSign = "vomiting" | "coughing" | "itching" | "limping" | "eye-ear" | "skin" | "other";

export type DailyCheckIn = {
  date: string;
  appetite: Appetite | null;
  energy: EnergyLevel | null;
  stool: StoolState | null;
  urination: UrinationState | null;
  drinking: DrinkingState | null;
  unusual: readonly UnusualSign[];
  unusualNote: string;
};

export const DEFAULT_CHECKIN_TIME = "20:00";

type State = {
  hydrated: boolean;
  enabled: boolean;
  time: string;
  byDate: Readonly<Record<string, DailyCheckIn>>;
  skippedDates: readonly string[];
};

const KEY = "paws.dailyCheckIn.v1";
const KEEP_DAYS = 60;

let state: State = { hydrated: false, enabled: false, time: DEFAULT_CHECKIN_TIME, byDate: {}, skippedDates: [] };

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
    state = {
      hydrated: true,
      enabled: saved.enabled ?? state.enabled,
      time: saved.time ?? state.time,
      byDate: { ...(saved.byDate ?? {}), ...state.byDate },
      skippedDates: saved.skippedDates ?? state.skippedDates,
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
  commit({ ...state, skippedDates: [...state.skippedDates.slice(-6), date] });
};

export const enableDailyCheckIn = (time: string) => commit({ ...state, enabled: true, time });

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
  return { hydrated: s.hydrated, enabled: s.enabled, time: s.time };
};

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
