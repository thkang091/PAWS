import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { setField } from "@/features/profile/state/profileDraft";

export type RecordKind = "condition" | "allergy";

export type RecordItem = {
  id: string;
  kind: RecordKind;
  name: string;
  note: string;
  addedAt: number;
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
  if (!clean) return;
  if (state.items.some((item) => item.kind === kind && item.name.toLowerCase() === clean.toLowerCase())) return;
  commit([...state.items, { id: `${kind}-${Date.now()}`, kind, name: clean, note: note.trim(), addedAt: Date.now() }]);
};

export const removeRecordItem = (id: string) => commit(state.items.filter((item) => item.id !== id));

export const useHealthRecord = () => useSyncExternalStore(subscribe, snapshot, snapshot);

export const SUGGESTIONS: Record<RecordKind, readonly string[]> = {
  condition: ["Arthritis", "Hip dysplasia", "Ear infections", "Skin allergies", "Epilepsy", "Diabetes", "Hypothyroidism", "Heart murmur"],
  allergy: ["Chicken", "Beef", "Wheat", "Dairy", "Pollen", "Flea bites", "Dust mites", "Penicillin"],
};
