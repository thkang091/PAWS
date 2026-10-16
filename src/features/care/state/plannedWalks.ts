import { useSyncExternalStore } from "react";
import { onWipe, syncedStorage as AsyncStorage } from "@/lib/cloudKv";
import * as Notifications from "expo-notifications";
import { SchedulableTriggerInputTypes } from "expo-notifications";
import { Platform } from "react-native";

export type SavedRoute = {
  kind?: "spot" | "block" | "pin" | "free";
  name: string;
  note: string;
  polyline: string;
  distanceKm: number;
  start: { latitude: number; longitude: number };
  startLabel: string;
  via?: { latitude: number; longitude: number } | null;
  steps?: readonly { instruction: string; maneuver: string; end: { latitude: number; longitude: number }; meters: number }[];
};

export type PlannedWalk = {
  id: string;
  /** The first day: the walk itself for a one-off, or the day a routine starts. */
  dayKey: string;
  time: string;
  minutes: number;
  route?: SavedRoute;
  /** A routine repeats on these weekdays (0 is Sunday). Absent or empty for a one-off walk. */
  repeat?: readonly number[] | null;
};

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const keyOfDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const isRoutine = (walk: Pick<PlannedWalk, "repeat">) => Boolean(walk.repeat && walk.repeat.length);

/** "Every day", "Weekdays", "Weekends" or "Mon, Wed, Fri". */
export const repeatLabel = (days: readonly number[]) => {
  const set = [...new Set(days)].sort();
  if (set.length === 7) return "Every day";
  if (set.length === 5 && [1, 2, 3, 4, 5].every((d) => set.includes(d))) return "Weekdays";
  if (set.length === 2 && set.includes(0) && set.includes(6)) return "Weekends";
  return [...set.filter((d) => d !== 0), ...(set.includes(0) ? [0] : [])].map((d) => WEEKDAY_SHORT[d]).join(", ");
};

/** Does this walk happen on that day? */
export const occursOn = (walk: Pick<PlannedWalk, "dayKey" | "repeat">, dayKey: string) => {
  if (!isRoutine(walk)) return walk.dayKey === dayKey;
  if (dayKey < walk.dayKey) return false;
  const [y, m, d] = dayKey.split("-").map(Number);
  return walk.repeat!.includes(new Date(y, m - 1, d).getDay());
};

/** The next time it happens from now (a routine's next day, or a one-off's own time). */
export const nextStart = (walk: PlannedWalk, now = Date.now()) => {
  if (!isRoutine(walk)) return startOf(walk);
  const [h, min] = walk.time.split(":").map(Number);
  const from = new Date(now);
  for (let i = 0; i < 8; i++) {
    const day = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i, h, min);
    if (keyOfDate(day) >= walk.dayKey && walk.repeat!.includes(day.getDay()) && day.getTime() > now - 60 * 60 * 1000) return day;
  }
  return startOf(walk);
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

// Routines never run out; one-off walks drop off an hour after they were due.
const upcoming = (walks: readonly PlannedWalk[]) =>
  walks
    .filter((walk) => isRoutine(walk) || startOf(walk).getTime() > Date.now() - 60 * 60 * 1000)
    .sort((a, b) => nextStart(a).getTime() - nextStart(b).getTime());

const remind = async (walk: PlannedWalk, dogName: string) => {
  if (Platform.OS === "web") return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") return;
  const content = {
    title: `Walk time for ${dogName}`,
    body: walk.route
      ? `${walk.route.name}, about ${walk.minutes} minutes. Tap to start it.`
      : `${walk.minutes} minutes planned. Open PAWS to start it.`,
    sound: true,
    data: { plannedWalk: walk.id },
  };
  if (isRoutine(walk)) {
    // One weekly reminder per chosen weekday (expo counts Sunday as 1).
    const [hour, minute] = walk.time.split(":").map(Number);
    for (const day of walk.repeat!) {
      await Notifications.scheduleNotificationAsync({
        identifier: `walk__${walk.id}__${day}`,
        content,
        trigger: { type: SchedulableTriggerInputTypes.WEEKLY, weekday: day + 1, hour, minute },
      }).catch(() => undefined);
    }
    return;
  }
  const at = startOf(walk);
  if (at.getTime() <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `walk__${walk.id}`,
    content,
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
  const planned: PlannedWalk = {
    ...walk,
    id: isRoutine(walk) ? `routine-${walk.time}-${[...walk.repeat!].sort().join("")}-${Date.now().toString(36)}` : `${walk.dayKey}-${walk.time}`,
  };
  commit([...state.walks.filter((item) => item.id !== planned.id), planned]);
  void remind(planned, dogName);
  return planned;
};

export const cancelPlannedWalk = (id: string) => {
  commit(state.walks.filter((walk) => walk.id !== id));
  void Notifications.cancelScheduledNotificationAsync(`walk__${id}`).catch(() => undefined);
  for (let day = 0; day < 7; day++) void Notifications.cancelScheduledNotificationAsync(`walk__${id}__${day}`).catch(() => undefined);
};

export const getPlannedWalk = (id: string) => state.walks.find((walk) => walk.id === id) ?? null;

export const usePlannedWalks = () => {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  return upcoming(s.walks);
};

// A reset of the account empties this store too.
onWipe(() => {
  state = { hydrated: true, walks: [] };
  emit();
});
