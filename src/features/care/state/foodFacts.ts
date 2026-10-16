import { useSyncExternalStore } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { onWipe } from "@/lib/cloudKv";

/** Label values per 100 g, as printed on the bag (as fed, not dry matter). */
export type Nutrients = {
  kcalPer100g: number | null;
  protein: number | null;
  fat: number | null;
  fiber: number | null;
  carbs: number | null;
  moisture: number | null;
};

export type FoodFacts = Nutrients & { name: string; imageUrl: string | null };

type State = { hydrated: boolean; byName: Readonly<Record<string, FoodFacts>> };

const KEY = "paws.foodFacts.v1";
let state: State = { hydrated: false, byName: {} };

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => state;

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    const saved = raw ? (JSON.parse(raw) as State["byName"]) : {};
    state = { hydrated: true, byName: { ...saved, ...state.byName } };
  })
  .catch(() => {
    state = { ...state, hydrated: true };
  })
  .finally(() => listeners.forEach((listener) => listener()));

const keyOf = (name: string) => name.trim().toLowerCase();

/** Remember what a picked food or treat is made of, so Nutrition can break it down later. */
export const rememberFoodFacts = (facts: FoodFacts) => {
  state = { ...state, byName: { ...state.byName, [keyOf(facts.name)]: facts } };
  listeners.forEach((listener) => listener());
  void AsyncStorage.setItem(KEY, JSON.stringify(state.byName)).catch(() => undefined);
};

export const useFoodFacts = () => {
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  return (name: string | null | undefined): FoodFacts | null => (name ? (s.byName[keyOf(name)] ?? null) : null);
};

/**
 * AAFCO adult maintenance minimums, on a dry-matter basis. Growth (puppies) needs more.
 * Labels print "as fed", so values are converted by removing the water first.
 */
export const MIN_PROTEIN_DM = { adult: 18, puppy: 22.5 } as const;
export const MIN_FAT_DM = { adult: 5.5, puppy: 8.5 } as const;

/** Kibble is about 10% water, wet food about 78%. Guess from calorie density when the label leaves it out. */
export const moistureOf = (n: Nutrients) => n.moisture ?? (n.kcalPer100g != null && n.kcalPer100g < 200 ? 78 : 10);

export const dryMatter = (value: number | null, n: Nutrients) => {
  if (value == null) return null;
  const solids = 100 - moistureOf(n);
  return solids > 0 ? (value / solids) * 100 : null;
};

// A reset of the account empties this store too.
onWipe(() => {
  state = { hydrated: true, byName: {} };
  listeners.forEach((listener) => listener());
});
