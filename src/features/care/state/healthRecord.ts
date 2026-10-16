import { useSyncExternalStore } from "react";
import { onWipe, syncedStorage as AsyncStorage } from "@/lib/cloudKv";

import { setField } from "@/features/profile/state/profileDraft";
import type { RecordInsight } from "@/services/recordInsight";

export type RecordKind = "condition" | "allergy";

export type RecordItem = {
  id: string;
  kind: RecordKind;
  name: string;
  note: string;
  addedAt: number;
  updatedAt?: number;
  /** What Gemini made of it; null when it was asked and could not answer. */
  insight?: RecordInsight | null;
};

type State = { hydrated: boolean; items: readonly RecordItem[] };

const KEY = "paws.healthRecord.v1";
const NONE = "None recorded";

let state: State = { hydrated: false, items: [] };

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;

const mirror = () => {
  const names = (kind: RecordKind) =>
    state.items.filter((item) => item.kind === kind).map((item) => item.name).join(", ") || NONE;
  setField("health", "Known conditions", names("condition"));
  setField("health", "Allergies", names("allergy"));
};

const commit = (items: readonly RecordItem[]) => {
  state = { hydrated: true, items };
  listeners.forEach((listener) => listener());
  mirror();
  void AsyncStorage.setItem(KEY, JSON.stringify(items)).catch(() => undefined);
};

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    state = { hydrated: true, items: raw ? (JSON.parse(raw) as RecordItem[]) : [] };
    mirror();
  })
  .catch(() => {
    state = { ...state, hydrated: true };
  })
  .finally(() => listeners.forEach((listener) => listener()));

export const addRecordItem = (kind: RecordKind, name: string, note = "") => {
  const clean = name.trim();
  if (!clean) return null;
  if (state.items.some((item) => item.kind === kind && item.name.toLowerCase() === clean.toLowerCase())) return null;
  const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  commit([...state.items, { id, kind, name: clean, note: note.trim(), addedAt: Date.now() }]);
  return id;
};

export const setRecordInsight = (id: string, insight: RecordInsight | null) =>
  commit(state.items.map((item) => (item.id === id ? { ...item, insight } : item)));

export const updateRecordItem = (id: string, patch: Partial<Pick<RecordItem, "name" | "note">>) =>
  commit(
    state.items.map((item) => {
      if (item.id !== id) return item;
      const name = (patch.name ?? item.name).trim() || item.name;
      // A new name or note means the old explanation may no longer fit; it is looked up again.
      const stale = name !== item.name || (patch.note ?? item.note) !== item.note;
      return { ...item, ...patch, name, updatedAt: Date.now(), insight: stale ? undefined : item.insight };
    }),
  );

export const removeRecordItem = (id: string) => commit(state.items.filter((item) => item.id !== id));

export const useHealthRecord = () => useSyncExternalStore(subscribe, snapshot, snapshot);

export const SUGGESTIONS: Record<RecordKind, readonly string[]> = {
  condition: ["Arthritis", "Hip dysplasia", "Ear infections", "Skin allergies", "Epilepsy", "Diabetes", "Hypothyroidism", "Heart murmur"],
  allergy: ["Chicken", "Beef", "Wheat", "Dairy", "Pollen", "Flea bites", "Dust mites", "Penicillin"],
};

// A reset of the account empties this store too.
onWipe(() => {
  state = { hydrated: true, items: [] };
  listeners.forEach((listener) => listener());
});
