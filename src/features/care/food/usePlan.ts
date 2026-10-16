import { useMemo } from "react";

import { useDogBasis } from "@/features/care/food/useDogBasis";
import { mealTimesIn, planResult, portionsFor } from "@/features/care/food/planResult";
import type { Basis, Prefs, Unit } from "@/features/care/food/foodPlanMath";
import { extendCarePlan, useCareOnboarding } from "@/features/care/state/careOnboarding";
import { rememberFoodFacts } from "@/features/care/state/foodFacts";
import { saveFoodPlan, useFoodPlan, type PlanItem } from "@/features/care/state/foodPlan";
import { keyOf } from "@/services/productLookup";
import { useCareProfile } from "@/hooks/useCareHealth";
import { useCurrentDog } from "@/hooks/useCurrentDog";
import { useSaveMealPlan, useSaveTreat, useSavedTreats, useSetCurrentFood } from "@/hooks/useFood";

/** The saved plan worked out for the dog as it is right now, so every Food Plan screen shows the same numbers. */
export const useLivePlan = () => {
  const store = useFoodPlan();
  const dogBasis = useDogBasis();
  const dog = useCurrentDog();
  const careProfile = useCareProfile(dog.data?.id);
  const { choice } = useCareOnboarding();
  const mealTimes = mealTimesIn(careProfile.data?.mealTimes, choice?.mealTimes);
  const mealsPerDay = mealTimes.length;
  const plan = store.plan;
  const result = useMemo(
    () =>
      plan
        ? planResult({ basis: dogBasis.basis, prefs: store.prefs, food: plan.food, unit: plan.unit, treats: plan.treats, mealsPerDay })
        : null,
    [plan, dogBasis.basis, store.prefs, mealsPerDay],
  );
  return { plan, result, prefs: store.prefs, mealTimes, mealsPerDay, ...dogBasis };
};

/**
 * Save a Food Plan everywhere it shows up: the plan itself, the current food on the care profile, meal portions,
 * and the saved treats list. Onboarding, switching a product, preferences and life-change reviews all use this.
 */
export const useCommitPlan = () => {
  const dog = useCurrentDog();
  const dogId = dog.data?.id ?? "";
  const careProfile = useCareProfile(dogId);
  const { choice } = useCareOnboarding();
  const setCurrentFood = useSetCurrentFood(dogId);
  const saveMealPlan = useSaveMealPlan(dogId);
  const saveTreat = useSaveTreat(dogId);
  const savedTreats = useSavedTreats(dogId);

  return ({ food, unit, treats, basis, prefs }: { food: PlanItem; unit: Unit; treats: readonly PlanItem[]; basis: Basis; prefs: Prefs }) => {
    const mealTimes = mealTimesIn(careProfile.data?.mealTimes, choice?.mealTimes);
    const result = planResult({ basis, prefs, food, unit, treats, mealsPerDay: mealTimes.length });
    if (!result.energy) return null;

    const kcalPer100g = food.facts.kcalPerKg ? Math.round(food.facts.kcalPerKg / 10) : null;
    rememberFoodFacts({
      name: food.product.name,
      imageUrl: food.product.imageUrl,
      kcalPer100g,
      protein: food.facts.protein,
      fat: food.facts.fat,
      fiber: food.facts.fiber,
      carbs: null,
      moisture: food.facts.moisture,
    });
    setCurrentFood.mutate({ name: food.product.name, imageUrl: food.product.imageUrl, kcalPer100g });

    const treatsPerDay = Math.max(1, result.treats.reduce((sum, t) => sum + (t.share?.count ?? 0), 0));
    if (result.gramsPerDay) {
      const portions = portionsFor(result.gramsPerDay, mealTimes.length);
      extendCarePlan("meals", { mealTimes, mealPortions: portions, mealsPerDay: mealTimes.length, portionGrams: portions[0] });
      saveMealPlan.mutate({ mealTimes, mealPortions: portions, treatsPerDay });
    }
    const known = new Set((savedTreats.data ?? []).map((t) => keyOf(t.name)));
    treats.forEach((t) => {
      if (!known.has(keyOf(t.product.name))) saveTreat.mutate({ name: t.product.name, imageUrl: t.product.imageUrl });
    });

    saveFoodPlan({
      food,
      unit,
      treats,
      basis,
      prefs,
      result: {
        kcal: result.energy.kcal,
        mainKcal: result.energy.mainKcal,
        treatKcal: result.energy.treatKcal,
        amount: result.amount,
        foodMark: result.food?.mark ?? "good",
        treatMarks: Object.fromEntries(result.treats.map((t) => [t.item.product.id, t.verdict.mark])),
        overall: result.overall,
      },
      savedAt: Date.now(),
    });
    return result;
  };
};
