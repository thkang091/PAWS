import { useSyncExternalStore } from "react";
import { onWipe, syncedStorage as AsyncStorage } from "@/lib/cloudKv";

import type { PlaceHit } from "@/services/placeSearch";

/** What the walk planner remembers so tomorrow's walk is one tap: the last length and the places you use. */
type State = {
  hydrated: boolean;
  lastMinutes: number | null;
  destinations: readonly PlaceHit[];
  starts: readonly PlaceHit[];
};

const KEY = "paws.walkPlaces.v1";
const MAX_DESTINATIONS = 6;
const MAX_STARTS = 4;

let state: State = { hydrated: false, lastMinutes: null, destinations: [], starts: [] };

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
      lastMinutes: saved.lastMinutes ?? state.lastMinutes,
      destinations: saved.destinations ?? state.destinations,
      starts: saved.starts ?? state.starts,
    };
  })
  .catch(() => {
    state = { ...state, hydrated: true };
  })
  .finally(() => listeners.forEach((listener) => listener()));

const near = (a: PlaceHit, b: PlaceHit) =>
  a.id === b.id || (Math.abs(a.latitude - b.latitude) < 0.0003 && Math.abs(a.longitude - b.longitude) < 0.0003);

const remember = (list: readonly PlaceHit[], place: PlaceHit, max: number) =>
  [place, ...list.filter((item) => !near(item, place))].slice(0, max);

export const rememberWalk = ({ minutes, destination, start }: { minutes: number; destination: PlaceHit | null; start: PlaceHit | null }) =>
  commit({
    ...state,
    lastMinutes: minutes,
    destinations: destination ? remember(state.destinations, destination, MAX_DESTINATIONS) : state.destinations,
    starts: start ? remember(state.starts, start, MAX_STARTS) : state.starts,
  });

export const lastWalkMinutes = () => state.lastMinutes;

export const useWalkPlaces = () => useSyncExternalStore(subscribe, snapshot, snapshot);

// A reset of the account empties this store too.
onWipe(() => {
  state = { hydrated: true, lastMinutes: null, destinations: [], starts: [] };
  listeners.forEach((listener) => listener());
});
