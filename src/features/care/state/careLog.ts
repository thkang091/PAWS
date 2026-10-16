import { useSyncExternalStore } from "react";
import { onWipe, syncedStorage as AsyncStorage } from "@/lib/cloudKv";

import type { CareKind, LogEntry } from "@/features/care/intel/careIntel";

/**
 * What was done and when: parasite doses, tooth brushing, dental cleanings, exams and tests, and other records.
 * Care plan reads it for what is due; Health records shows it as history.
 */
type State = { hydrated: boolean; entries: readonly LogEntry[] };

const KEY = "paws.careLog.v1";
let state: State = { hydrated: false, entries: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const commit = (entries: readonly LogEntry[]) => {
  state = { ...state, entries };
  emit();
  void AsyncStorage.setItem(KEY, JSON.stringify(entries)).catch(() => undefined);
};

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    const saved = raw ? (JSON.parse(raw) as LogEntry[]) : [];
    state = { hydrated: true, entries: [...saved, ...state.entries] };
  })
  .catch(() => {
    state = { ...state, hydrated: true };
  })
  .finally(emit);

export const logCare = (kind: CareKind, date: string, extra: Omit<LogEntry, "id" | "kind" | "date"> = {}) => {
  const id = `${kind}-${date}-${Date.now().toString(36)}`;
  commit([...state.entries, { id, kind, date, ...extra }]);
  return id;
};

export const removeCareEntry = (id: string) => commit(state.entries.filter((e) => e.id !== id));

export const useCareLog = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );

export const updateCareEntry = (id: string, patch: Partial<Omit<LogEntry, "id">>) =>
  commit(state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));

// A reset of the account empties this store too.
onWipe(() => {
  state = { hydrated: true, entries: [] };
  emit();
});
