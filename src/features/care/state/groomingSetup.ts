import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NUDGE_AFTER_MS = 21 * 24 * 60 * 60 * 1000;

type State = {
  setUp: boolean;
  missedOnboardingAt: number | null;
  deferredUntil: number;
};

let state: State = { setUp: false, missedOnboardingAt: null, deferredUntil: 0 };

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;
const KEY = "paws.groomingSetup.v1";
const emit = () => {
  listeners.forEach((listener) => listener());
  void AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => undefined);
};

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (!raw) return;
    state = { ...state, ...(JSON.parse(raw) as Partial<State>) };
    listeners.forEach((listener) => listener());
  })
  .catch(() => undefined);

export const markGroomingMissedOnboarding = () => {
  if (state.setUp || state.missedOnboardingAt != null) return;
  state = { ...state, missedOnboardingAt: Date.now() };
  emit();
};

export const completeGroomingSetup = () => {
  state = { setUp: true, missedOnboardingAt: null, deferredUntil: 0 };
  emit();
};

export const deferGroomingPrompt = () => {
  state = { ...state, deferredUntil: Date.now() + NUDGE_AFTER_MS };
  emit();
};

export const useGroomingPrompt = () => {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  const dueSince = s.deferredUntil || (s.missedOnboardingAt != null ? s.missedOnboardingAt + NUDGE_AFTER_MS : null);
  const due = !s.setUp && dueSince != null && Date.now() >= dueSince;
  return { due, setUp: s.setUp };
};
