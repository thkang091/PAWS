import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { Platform } from "react-native";

export type SavedRoute = {
  name: string;
  note: string;
  polyline: string;
  distanceKm: number;
  start: { latitude: number; longitude: number };
  startLabel: string;
};

export type PlannedWalk = {
  id: string;
  dayKey: string;
  time: string;
  minutes: number;
  route?: SavedRoute;
};

type State = { hydrated: boolean; walks: readonly PlannedWalk[] };

const KEY = "paws.plannedWalks.v1";

let state: State = { hydrated: false, walks: [] };

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;
const emit = () => listeners.forEach((listener) => listener());

export const startOf = (walk: Pick<PlannedWalk, "dayKey" | "time">) => {
  const [y, m, d] = walk.dayKey.split("-").map(Number);
  const [h, min] = walk.time.split(":").map(Number);
  return new Date(y, m - 1, d, h, min);
};

const upcoming = (walks: readonly PlannedWalk[]) =>
  walks
    .filter((walk) => startOf(walk).getTime() > Date.now() - 60 * 60 * 1000)
    .sort((a, b) => startOf(a).getTime() - startOf(b).getTime());

const remind = async (walk: PlannedWalk, dogName: string) => {
  if (Platform.OS === "web") return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;
  const at = startOf(walk);
  if (at.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `walk__${walk.id}`,
    content: {
      title: `Walk time for ${dogName}`,
      body: walk.route
        ? `${walk.route.name}, about ${walk.minutes} minutes. Tap to start it.`
        : `${walk.minutes} minutes planned. Open PAWS to start it.`,
      sound: true,
      data: { plannedWalk: walk.id },
    },
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: at },
  }).catch(() => undefined);
};

const commit = (walks: readonly PlannedWalk[]) => {
  state = { hydrated: true, walks: upcoming(walks) };
  emit();
  void AsyncStorage.setItem(KEY, JSON.stringify(state.walks)).catch(() => undefined);
};

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    state = { hydrated: true, walks: upcoming(raw ? (JSON.parse(raw) as PlannedWalk[]) : []) };
  })
  .catch(() => {
    state = { ...state, hydrated: true };
  })
  .finally(emit);

export const planWalk = (walk: Omit<PlannedWalk, "id">, dogName: string) => {
  const planned: PlannedWalk = { ...walk, id: `${walk.dayKey}-${walk.time}` };
  commit([...state.walks.filter((item) => item.id !== planned.id), planned]);
  void remind(planned, dogName);
  return planned;
};

export const cancelPlannedWalk = (id: string) => {
  commit(state.walks.filter((walk) => walk.id !== id));
  void Notifications.cancelScheduledNotificationAsync(`walk__${id}`).catch(() => undefined);
};

export const getPlannedWalk = (id: string) => state.walks.find((walk) => walk.id === id) ?? null;

export const usePlannedWalks = () => {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  return upcoming(s.walks);
};
