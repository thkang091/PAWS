import { useSyncExternalStore } from "react";

import type { TopicKey } from "@/constants/trainingTopics";

type State = { active: TopicKey; done: Partial<Record<TopicKey, number>> };

let state: State = { active: "social", done: { social: 2 } };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const setActiveTopic = (key: TopicKey) => {
  if (state.active === key) return;
  state = { ...state, active: key };
  emit();
};

export const startWithTopic = (key: TopicKey) => {
  state = { active: key, done: { [key]: 2 } };
  emit();
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
