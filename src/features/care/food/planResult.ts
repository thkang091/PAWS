import {
  amountIn,
  dietMedNotes,
  energyFor,
  evaluateFood,
  evaluateTreat,
  gramsFor,
  shareAllowance,
  type Basis,
  type Check,
  type Energy,
  type Mark,
  type Prefs,
  type Share,
  type Unit,
  type Verdict,
} from "@/features/care/food/foodPlanMath";
import type { PlanItem } from "@/features/care/state/foodPlan";

export type PlanResult = {
  energy: Energy | null;
  amount: number | null;
  gramsPerDay: number | null;
  perMeal: number | null;
  food: Verdict | null;
  treats: readonly { item: PlanItem; verdict: Verdict; share: Share | null }[];
  overall: Mark;
  issues: readonly Check[];
};

const worst = (marks: readonly Mark[]): Mark => (marks.includes("bad") ? "bad" : marks.includes("note") ? "note" : "good");

/** Owner-typed "anything else" becomes extra things to avoid, split on commas. */
export const effectivePrefs = (prefs: Prefs): Prefs => ({
  ...prefs,
  avoid: [
    ...prefs.avoid,
    ...prefs.other
      .split(/[,;\n]/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3),
  ],
});

export const planResult = ({
  basis,
  prefs,
  food,
  unit,
  treats,
  mealsPerDay,
}: {
  basis: Basis;
  prefs: Prefs;
  food: PlanItem | null;
  unit: Unit | null;
  treats: readonly PlanItem[];
  mealsPerDay: number;
}): PlanResult => {
  const rules = effectivePrefs(prefs);
  const energy = energyFor(basis);
  const amount = energy && food && unit ? amountIn(unit, energy.mainKcal, food.facts) : null;
  const gramsPerDay = energy && food ? gramsFor(energy.mainKcal, food.facts) : null;
  const perMeal =
    amount != null && mealsPerDay > 1
      ? unit === "grams"
        ? Math.round(amount / mealsPerDay / 5) * 5
        : unit === "cans"
          ? Math.round((amount / mealsPerDay) * 4) / 4
          : Math.round((amount / mealsPerDay) * 10) / 10
      : null;

  const foodVerdict = food ? evaluateFood(food.facts, basis, rules, energy) : null;
  const shares = energy
    ? shareAllowance(
        energy.treatKcal,
        treats.map((t) => ({ key: t.product.id, kcal: t.facts.kcalPerPiece })),
      )
    : [];
  const treatRows = treats.map((item) => ({
    item,
    verdict: evaluateTreat(item.facts, basis, rules, energy?.treatKcal ?? null),
    share: shares.find((s) => s.key === item.product.id) ?? null,
  }));

  const medIssues: Check[] = dietMedNotes(basis.meds).map(({ med, note }) => ({ key: `med-${med}`, mark: "note", text: `${med}: ${note}` }));
  const issues: Check[] = [
    ...(foodVerdict?.checks ?? []).filter((c) => c.mark !== "good"),
    ...treatRows.flatMap(({ item, verdict }) =>
      verdict.checks.filter((c) => c.mark !== "good").map((c) => ({ ...c, key: `${item.product.id}-${c.key}`, text: `${item.product.name}: ${c.text}` })),
    ),
    ...medIssues,
  ];

  return {
    energy,
    amount,
    gramsPerDay,
    perMeal,
    food: foodVerdict,
    treats: treatRows,
    overall: worst([foodVerdict?.mark ?? "good", ...treatRows.map((t) => t.verdict.mark), ...medIssues.map((m) => m.mark)]),
    issues,
  };
};

/** The meal times the Nutrition page uses: saved on the profile, else from Care setup, else a sensible two-meal day. */
export const mealTimesIn = (profileTimes: readonly string[] | null | undefined, setupTimes: readonly string[] | null | undefined) =>
  profileTimes?.length ? [...profileTimes].sort() : setupTimes?.length ? [...setupTimes].sort() : ["08:00", "18:30"];

/** Split the day's grams evenly across meals, rounded to 5 g. */
export const portionsFor = (gramsPerDay: number, meals: number) =>
  Array.from({ length: meals }, () => Math.round(gramsPerDay / Math.max(1, meals) / 5) * 5);
