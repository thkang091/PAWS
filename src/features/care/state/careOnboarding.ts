import { useSyncExternalStore } from "react";
import { onWipe, syncedStorage as AsyncStorage } from "@/lib/cloudKv";

import type { AreaKey } from "@/features/care/components/careSetupAnswers";

export type CareAppointment = {
  clinic: string;
  day: string;
  dayKey: string;
  time: string;
  phone: string | null;
  address: string | null;
};

export type CarePlanChoice = {
  areas?: readonly AreaKey[];
  exerciseMinutes: number;
  mealsPerDay: number;
  portionGrams: number;
  mealPortions?: readonly number[];
  routineKeys: readonly string[];
  walkTimes?: readonly string[];
  mealTimes?: readonly string[];
  grooming?: readonly string[];
  medName?: string;
  medTimes?: readonly string[];
  vaccines?: readonly string[];
  kitNeeded?: readonly string[];
  kitHowTo?: readonly string[];
  appointment?: CareAppointment | null;
  pendingVaccines?: readonly string[];
};

type State = {
  hydrated: boolean;
  completed: boolean;
  choice: CarePlanChoice | null;
  deferredUntil: number;
  mutedReminders: readonly string[];
};

const KEY = "paws.careOnboarding.v1";

/** Older builds saved route names from the retired demo map here; they are not real places. */
const stripRoutes = (choice: CarePlanChoice): CarePlanChoice => {
  const { walkRoutes: _old, ...rest } = choice as CarePlanChoice & { walkRoutes?: unknown };
  return rest;
};

let state: State = { hydrated: false, completed: false, choice: null, deferredUntil: 0, mutedReminders: [] };

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

const persist = () => {
  const { hydrated: _hydrated, ...saved } = state;
  void AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => undefined);
};

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (state.completed) return;
    const saved = raw ? (JSON.parse(raw) as Partial<State>) : {};
    state = {
      hydrated: true,
      completed: saved.completed ?? false,
      choice: saved.choice ? stripRoutes(saved.choice) : null,
      deferredUntil: saved.deferredUntil ?? 0,
      mutedReminders: saved.mutedReminders ?? [],
    };
  })
  .catch(() => undefined)
  .finally(() => {
    state = { ...state, hydrated: true };
    notify();
  });


const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const snapshot = () => state;

export const completeCareOnboarding = (choice: CarePlanChoice) => {
  state = { hydrated: true, completed: true, choice, deferredUntil: 0, mutedReminders: [] };
  persist();
  notify();
};

export const extendCarePlan = (area: AreaKey, patch: Partial<CarePlanChoice>) => {
  if (!state.choice) return;
  const areas = state.choice.areas ?? [];
  const routineKeys = [
    ...new Set([...(state.choice.routineKeys ?? []), ...(patch.routineKeys ?? [])]),
  ];
  state = {
    ...state,
    choice: {
      ...state.choice,
      ...patch,
      routineKeys,
      areas: areas.includes(area) ? areas : [...areas, area],
    },
  };
  persist();
  notify();
};

export const toggleReminder = (key: string) => {
  const muted = state.mutedReminders.includes(key);
  state = {
    ...state,
    mutedReminders: muted
      ? state.mutedReminders.filter((item) => item !== key)
      : [...state.mutedReminders, key],
  };
  persist();
  notify();
};

export const resetCareOnboarding = () => {
  state = { hydrated: true, completed: false, choice: null, deferredUntil: 0, mutedReminders: [] };
  persist();
  notify();
};

export const useCareOnboarding = () => useSyncExternalStore(subscribe, snapshot, snapshot);

export type PlannedRoutine = {
  key: string;
  time: string;
  title: string;
  detail: string;
};

export const useCarePlan = (): readonly PlannedRoutine[] => {
  const { choice } = useCareOnboarding();
  if (!choice) return [];

  const meals = choice.mealTimes ?? [];
  const walks = choice.walkTimes ?? [];
  const medTimes = choice.medTimes ?? [];

  return [
    ...walks.map((time, index) => ({
      key: `walk-${time}`,
      time,
      title: walks.length > 1 && index === 0 ? "Morning walk" : walks.length > 1 ? "Evening walk" : "Walk",
      detail: `${Math.round(choice.exerciseMinutes / Math.max(1, walks.length))} min`,
    })),
    ...meals.map((time, index) => ({
      key: `meal-${time}`,
      time,
      title: meals.length > 1 && index === 0 ? "Breakfast" : meals.length > 1 ? "Dinner" : "Meal",
      detail: `${choice.portionGrams} g`,
    })),
    ...medTimes.map((time) => ({
      key: `med-${time}`,
      time,
      title: choice.medName?.trim() || "Medication",
      detail: "As prescribed",
    })),
  ].sort((a, b) => a.time.localeCompare(b.time));
};

export const useCareAreas = (): readonly AreaKey[] =>
  useCareOnboarding().choice?.areas ?? [];

export const useMutedReminders = (): readonly string[] => useCareOnboarding().mutedReminders;

export const useCareAppointment = (): CareAppointment | null =>
  useCareOnboarding().choice?.appointment ?? null;

const DEFER_MS = 24 * 60 * 60 * 1000;

export const deferVaccineBooking = () => {
  state = { ...state, deferredUntil: Date.now() + DEFER_MS };
  persist();
  notify();
};

export const recordVaccineBooking = (appointment: CareAppointment) => {
  if (!state.choice) return;
  state = {
    ...state,
    choice: { ...state.choice, appointment, pendingVaccines: [] },
  };
  persist();
  notify();
};

export type VaccineDuty = {
  label: string;
  count: number;
  deferred: boolean;
};

export const useVaccineDuty = (): VaccineDuty | null => {
  const { completed, choice, deferredUntil } = useCareOnboarding();
  const pending = choice?.pendingVaccines ?? [];

  if (!completed || choice?.appointment || pending.length === 0) return null;

  return {
    label: pending.length === 1 ? pending[0] : `${pending.length} core shots`,
    count: pending.length,
    deferred: Date.now() < deferredUntil,
  };
};

// A reset of the account empties this store too.
onWipe(() => {
  state = { hydrated: true, completed: false, choice: null, deferredUntil: 0, mutedReminders: [] };
  notify();
});
