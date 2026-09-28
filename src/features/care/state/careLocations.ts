import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type SavedPlace = {
  query: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type SavedClinic = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
};

export type Visit = {
  id: string;
  clinic: SavedClinic;
  dayKey: string;
  time: string;
  reason: string;
  createdAt: number;
};

type State = {
  hydrated: boolean;
  home: SavedPlace | null;
  clinics: readonly SavedClinic[];
  visits: readonly Visit[];
};

const KEY = "paws.careLocations.v1";
const MAX_CLINICS = 6;

let state: State = { hydrated: false, home: null, clinics: [], visits: [] };

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;

const commit = (next: State) => {
  state = next;
  listeners.forEach((listener) => listener());
  const { hydrated: _hydrated, ...persisted } = next;
  void AsyncStorage.setItem(KEY, JSON.stringify(persisted)).catch(() => undefined);
};

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    const saved = raw ? (JSON.parse(raw) as Partial<State>) : {};
    state = {
      hydrated: true,
      home: saved.home ?? state.home,
      clinics: saved.clinics ?? state.clinics,
      visits: saved.visits ?? state.visits,
    };
  })
  .catch(() => {
    state = { ...state, hydrated: true };
  })
  .finally(() => listeners.forEach((listener) => listener()));

export const saveHome = (place: SavedPlace) => commit({ ...state, home: place });

const rememberClinic = (clinics: readonly SavedClinic[], clinic: SavedClinic) =>
  [clinic, ...clinics.filter((item) => item.id !== clinic.id)].slice(0, MAX_CLINICS);

export const bookVisit = (visit: Omit<Visit, "id" | "createdAt">): Visit => {
  const saved: Visit = { ...visit, id: `${visit.dayKey}-${visit.time}-${visit.clinic.id}`, createdAt: Date.now() };
  commit({
    ...state,
    clinics: rememberClinic(state.clinics, visit.clinic),
    visits: [saved, ...state.visits.filter((item) => item.id !== saved.id)],
  });
  return saved;
};

export const cancelVisit = (id: string) =>
  commit({ ...state, visits: state.visits.filter((visit) => visit.id !== id) });

export const useCareLocations = () => useSyncExternalStore(subscribe, snapshot, snapshot);
