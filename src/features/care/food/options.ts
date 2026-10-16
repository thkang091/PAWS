import type { Activity, BodyCondition, FoodForm, LifeStage, Unit, WeightGoal } from "@/features/care/food/foodPlanMath";
import type { PlanItem } from "@/features/care/state/foodPlan";

export const BODY: readonly { value: BodyCondition; label: string; hint: string }[] = [
  { value: "thin", label: "Thin", hint: "Ribs, spine and hip bones easy to see" },
  { value: "ideal", label: "Just right", hint: "Ribs easy to feel, a clear waist from above" },
  { value: "heavy", label: "Heavy", hint: "Ribs hard to feel, little or no waist" },
];
export const ACTIVITY: readonly { value: Activity; label: string; hint: string }[] = [
  { value: "low", label: "Easygoing", hint: "Short strolls and plenty of naps" },
  { value: "moderate", label: "Active", hint: "About an hour of walks and play a day" },
  { value: "high", label: "Very active", hint: "Runs, hikes or working most days" },
];
export const GOAL: readonly { value: WeightGoal; label: string; hint: string }[] = [
  { value: "maintain", label: "Keep weight", hint: "Hold steady where they are" },
  { value: "lose", label: "Lose weight", hint: "Slowly, about 1 to 2% a week" },
  { value: "gain", label: "Gain weight", hint: "Build back up gradually" },
];
export const STAGE: readonly { value: LifeStage; label: string; hint: string }[] = [
  { value: "puppy", label: "Puppy", hint: "Under a year old" },
  { value: "adult", label: "Adult", hint: "1 to 7 years" },
  { value: "senior", label: "Senior", hint: "7 years and older" },
];
export const FORMS: readonly { value: FoodForm; label: string }[] = [
  { value: "dry", label: "Dry" },
  { value: "wet", label: "Wet" },
  { value: "mixed", label: "Mixed" },
  { value: "any", label: "No preference" },
];
export const AVOID = ["Chicken", "Beef", "Lamb", "Fish", "Grain", "Wheat", "Corn", "Soy", "Dairy"];
export const UNIT_LABEL: Record<Unit, string> = { cups: "Cups", grams: "Grams", cans: "Cans" };

export const labelOf = <T extends string>(list: readonly { value: T; label: string }[], value: T | null) =>
  list.find((o) => o.value === value)?.label ?? null;

export type TreatRole = "training" | "dental" | "topper" | "snack";

export const ROLE_LABEL: Record<TreatRole, string> = {
  training: "Training Treat",
  dental: "Dental Chew",
  topper: "Topper",
  snack: "Treat",
};

/** What a treat is for, from what the owner picked or, failing that, its name. */
export const roleOf = (item: PlanItem): TreatRole => {
  if (item.role) return item.role;
  const name = item.product.name;
  if (/dental|greenies|dentastix|dentalife|whimzees|teeth|chew/i.test(name)) return "dental";
  if (/topper|broth|gravy|sprinkle|meal mixer/i.test(name)) return "topper";
  if (/training|mini|bits|bites|nibs/i.test(name)) return "training";
  return "snack";
};
