import { useLocalSearchParams } from "expo-router";

import { FoodPlanFlow } from "@/features/care/food/FoodPlanFlow";
import { FoodPlanReview } from "@/features/care/food/FoodPlanReview";

/** Nutrition → Food Plan. `?review=1` recalculates a saved plan; `?edit=<step>` reopens it at a step. */
export default function FoodPlanScreen() {
  const params = useLocalSearchParams<{ review?: string; edit?: string }>();
  if (params.review) return <FoodPlanReview />;
  return <FoodPlanFlow edit={params.edit} />;
}
