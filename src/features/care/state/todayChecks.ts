import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onWipe } from "@/lib/cloudKv";

/**
 * What the guardian ticked off today, per item (each walk and meal on its own), plus walks logged
 * from the walk screen. It resets itself when the day changes.
 */
type State = { day: string; keys: readonly string[]; walks: readonly string[] };

const KEY = "paws.todayChecks.v1";

const dayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

let state: State = { day: dayKey(), keys: [], walks: [] };

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const fresh = (): State => (state.day === dayKey() ? state : (state = { day: dayKey(), keys: [], walks: [] }));
const snapshot = () => fresh();

const commit = (next: State) => {
  state = next;
  listeners.forEach((listener) => listener());
  void AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
};

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    const saved = raw ? (JSON.parse(raw) as Partial<State>) : null;
    if (saved?.day === dayKey()) state = { day: saved.day, keys: saved.keys ?? [], walks: saved.walks ?? [] };
  })
  .catch(() => undefined)
  .finally(() => listeners.forEach((listener) => listener()));

export const toggleCheck = (key: string) => {
  const current = fresh();
  commit({
    ...current,
    keys: current.keys.includes(key) ? current.keys.filter((item) => item !== key) : [...current.keys, key],
  });
};

/** A finished walk ticks off the walk closest to when it happened. */
export const logWalkDone = (at = new Date()) => {
  const current = fresh();
  const time = `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
  commit({ ...current, walks: [...current.walks, time] });
};

export const useTodayChecks = () => useSyncExternalStore(subscribe, snapshot, snapshot);

// A reset of the account empties this store too.
onWipe(() => {
  state = { day: dayKey(), keys: [], walks: [] };
  listeners.forEach((listener) => listener());
});
