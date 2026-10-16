import { useSyncExternalStore } from "react";
import type { MuscleCondition } from "@/features/care/intel/careIntel";
import { onWipe, syncedStorage as AsyncStorage } from "@/lib/cloudKv";

import {
  EMPTY_PREFS,
  type Activity,
  type Basis,
  type BodyCondition,
  type Facts,
  type LifeStage,
  type Mark,
  type Prefs,
  type Unit,
  type WeightGoal,
} from "@/features/care/food/foodPlanMath";
import type { Product } from "@/services/productLookup";

/** Answers PAWS keeps about the dog for feeding. Asked once, shown again only to confirm. */
export type FeedingProfile = {
  bodyCondition: BodyCondition | null;
  activity: Activity | null;
  neutered: boolean | null;
  goal: WeightGoal | null;
  /** Only when the dog record has no birthday or age. */
  stage: LifeStage | null;
  /** The 9-point body condition score, when the owner has scored it; bodyCondition follows it. */
  bcs?: number | null;
  /** Muscle condition score: normal, or how much muscle has been lost. */
  mcs?: MuscleCondition | null;
};

/** A product in the plan. Treats carry a role so the lineup can say "Training Treat" or "Dental Chew". */
export type PlanItem = { product: Product; facts: Facts; role?: "training" | "dental" | "topper" | "snack" };

export type SavedPlan = {
  food: PlanItem;
  unit: Unit;
  treats: readonly PlanItem[];
  basis: Basis;
  prefs: Prefs;
  result: {
    kcal: number;
    mainKcal: number;
    treatKcal: number;
    amount: number | null;
    foodMark: Mark;
    treatMarks: Readonly<Record<string, Mark>>;
    overall: Mark;
  };
  savedAt: number;
};

type State = {
  hydrated: boolean;
  profile: FeedingProfile;
  prefs: Prefs;
  plan: SavedPlan | null;
  /** A change the owner chose not to act on yet, so the prompt does not nag about the same thing. */
  dismissed: string | null;
};

const KEY = "paws.foodPlan.v1";

const EMPTY_PROFILE: FeedingProfile = { bodyCondition: null, activity: null, neutered: null, goal: null, stage: null };

let state: State = { hydrated: false, profile: EMPTY_PROFILE, prefs: EMPTY_PREFS, plan: null, dismissed: null };

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;

const commit = (next: State) => {
  state = next;
  listeners.forEach((listener) => listener());
  const { hydrated: _h, ...saved } = next;
  void AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => undefined);
};

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    const saved = raw ? (JSON.parse(raw) as Partial<State>) : {};
    state = {
      hydrated: true,
      profile: { ...EMPTY_PROFILE, ...saved.profile },
      prefs: { ...EMPTY_PREFS, ...saved.prefs },
      plan: saved.plan ?? null,
      dismissed: saved.dismissed ?? null,
    };
  })
  .catch(() => {
    state = { ...state, hydrated: true };
  })
  .finally(() => listeners.forEach((listener) => listener()));

export const saveFeedingProfile = (profile: FeedingProfile) => commit({ ...state, profile });
export const saveFoodPrefs = (prefs: Prefs) => commit({ ...state, prefs });
export const saveFoodPlan = (plan: SavedPlan) => commit({ ...state, plan, dismissed: null });
export const dismissPlanReview = (signature: string) => commit({ ...state, dismissed: signature });

export const useFoodPlan = () => useSyncExternalStore(subscribe, snapshot, snapshot);

// A reset of the account empties this store too.
onWipe(() => {
  state = { hydrated: true, profile: EMPTY_PROFILE, prefs: EMPTY_PREFS, plan: null, dismissed: null };
  listeners.forEach((listener) => listener());
});
