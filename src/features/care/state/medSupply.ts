import { useSyncExternalStore } from "react";

import { onWipe, syncedStorage as AsyncStorage } from "@/lib/cloudKv";

/**
 * How many doses of each medicine were left when the owner last counted. With the medicine's schedule that is enough
 * to say when it runs out, so a refill can be asked for a week ahead instead of on the last pill.
 */
type Count = { left: number; at: string };
type State = { hydrated: boolean; counts: Readonly<Record<string, Count>> };

const KEY = "paws.medSupply.v1";
let state: State = { hydrated: false, counts: {} };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    const saved = raw ? (JSON.parse(raw) as Partial<State>) : {};
    state = { hydrated: true, counts: { ...(saved.counts ?? {}), ...state.counts } };
  })
  .catch(() => {
    state = { ...state, hydrated: true };
  })
  .finally(emit);

export const setSupply = (medId: string, left: number) => {
  state = { ...state, counts: { ...state.counts, [medId]: { left: Math.max(0, Math.round(left)), at: new Date().toISOString().slice(0, 10) } } };
  emit();
  void AsyncStorage.setItem(KEY, JSON.stringify({ counts: state.counts })).catch(() => undefined);
};

export const useSupply = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  ).counts;

const PER_DAY: Record<string, number> = { daily: 1, twice_daily: 2, weekly: 1 / 7, monthly: 1 / 30 };

/** Doses left today and the day they run out, or null when the schedule cannot tell (as needed, or never counted). */
export const supplyOf = (count: Count | undefined, frequency: string, today: string) => {
  const perDay = PER_DAY[frequency];
  if (!count || !perDay) return null;
  const [y, m, d] = count.at.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const since = Math.max(0, Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86_400_000));
  const left = Math.max(0, Math.round(count.left - since * perDay));
  const days = Math.floor(left / perDay);
  const out = new Date(Date.UTC(ty, tm - 1, td + days));
  return { left, days, runsOut: out.toISOString().slice(0, 10) };
};

onWipe(() => {
  state = { hydrated: true, counts: {} };
  emit();
});
