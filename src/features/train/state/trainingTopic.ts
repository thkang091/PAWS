import { useSyncExternalStore } from "react";

import type { TopicKey } from "@/constants/trainingTopics";
import { onWipe, syncedStorage as AsyncStorage } from "@/lib/cloudKv";

/**
 * Which training topic is open on the Train tab. It starts from the goal picked in onboarding and is remembered (and
 * synced) after that. Progress is never stored here: it comes from the server's lesson progress, or starts at zero.
 */
type State = { hydrated: boolean; active: TopicKey | null; done: Partial<Record<TopicKey, number>> };

const KEY = "paws.trainingTopic.v2";
let state: State = { hydrated: false, active: null, done: {} };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const persist = () => void AsyncStorage.setItem(KEY, JSON.stringify({ active: state.active, done: state.done })).catch(() => undefined);

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    const saved = raw ? (JSON.parse(raw) as Partial<State>) : {};
    state = { hydrated: true, active: state.active ?? saved.active ?? null, done: { ...(saved.done ?? {}), ...state.done } };
  })
  .catch(() => {
    state = { ...state, hydrated: true };
  })
  .finally(emit);

export const setActiveTopic = (key: TopicKey) => {
  if (state.active === key) return;
  state = { ...state, active: key };
  emit();
  persist();
};

/** The topic onboarding chose; it opens first on the Train tab. */
export const startWithTopic = (key: TopicKey) => {
  state = { ...state, active: key };
  emit();
  persist();
};

/** A lesson finished in a topic that has no server curriculum yet. */
export const markTopicLessonDone = (key: TopicKey, index: number) => {
  const done = Math.max(state.done[key] ?? 0, index + 1);
  state = { ...state, done: { ...state.done, [key]: done } };
  emit();
  persist();
};

export const useTrainingTopic = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );

onWipe(() => {
  state = { hydrated: true, active: null, done: {} };
  emit();
});
