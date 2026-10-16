import {
  EMPTY_PREFS,
  amountIn,
  basisChanges,
  contains,
  energyFor,
  evaluateFood,
  evaluateTreat,
  formatAmount,
  parseLabel,
  shareAllowance,
  stageOf,
  type Basis,
} from "@/features/care/food/foodPlanMath";

const bori: Basis = {
  name: "Bori",
  ageMonths: 36,
  stage: "adult",
  weightKg: 12,
  bodyCondition: "ideal",
  activity: "moderate",
  neutered: true,
  goal: "maintain",
  conditions: [],
  allergies: [],
  meds: [],
};

const PRO_PLAN =
  "Calorie Content (calculated): 3,817 kcal/kg, 409 kcal/cup. Guaranteed Analysis: Crude Protein (min) 26.0%, Crude Fat (min) 16.0%, " +
  "Crude Fiber (max) 3.0%, Moisture (max) 12.0%. Purina Pro Plan Adult Chicken & Rice is formulated to meet the nutritional levels " +
  "established by the AAFCO Dog Food Nutrient Profiles for adult maintenance. Ingredients: Chicken, rice, whole grain wheat, poultry by-product meal.";

describe("life stage and energy", () => {
  it("places dogs in a life stage by age", () => {
    expect(stageOf(5)).toBe("puppy");
    expect(stageOf(36)).toBe("adult");
    expect(stageOf(96)).toBe("senior");
    expect(stageOf(null)).toBeNull();
  });

  it("works out a neutered adult's day from RER x 1.6, 10% for treats", () => {
    const energy = energyFor(bori)!;
    // RER = 70 x 12^0.75 = 451.6; x 1.6 = 722.5, rounded to 720
    expect(energy.kcal).toBe(720);
    expect(energy.treatKcal).toBe(72);
    expect(energy.mainKcal).toBe(648);
  });

  it("feeds resting energy at a lower target weight when losing", () => {
    const energy = energyFor({ ...bori, bodyCondition: "heavy", goal: "lose" })!;
    expect(energy.factor).toBe(1);
    expect(energy.kcal).toBeLessThan(energyFor(bori)!.kcal);
  });

  it("needs a weight", () => {
    expect(energyFor({ ...bori, weightKg: null })).toBeNull();
  });
});

describe("reading labels", () => {
  const facts = parseLabel(PRO_PLAN, "Purina Pro Plan Adult Chicken & Rice Dry Dog Food");

  it("finds calorie content", () => {
    expect(facts.kcalPerKg).toBe(3817);
    expect(facts.kcalPerCup).toBe(409);
  });

  it("finds the guaranteed analysis", () => {
    expect(facts.protein).toBe(26);
    expect(facts.fat).toBe(16);
    expect(facts.fiber).toBe(3);
    expect(facts.moisture).toBe(12);
  });

  it("reads the AAFCO statement and the form", () => {
    expect(facts.stage).toBe("adult");
    expect(facts.stageFrom).toBe("label");
    expect(facts.form).toBe("dry");
    expect(facts.ingredientsKnown).toBe(true);
  });

  it("spots supplemental-only foods and treat calories", () => {
    expect(parseLabel("This product is intended for intermittent or supplemental feeding only.").stage).toBe("supplemental");
    expect(parseLabel("Zuke's Mini Naturals: 2 calories per treat").kcalPerPiece).toBe(2);
    expect(parseLabel("Each chew 90 kcal/chew").kcalPerPiece).toBe(90);
  });

  it("reads wet food per can", () => {
    expect(parseLabel("Calorie content: 1,045 kcal/kg, 397 kcal/13 oz can", "Classic Pate Wet Dog Food").kcalPerCan).toBe(397);
  });
});

describe("portions", () => {
  const facts = parseLabel(PRO_PLAN, "Pro Plan Adult");
  it("converts the main-food calories into cups and grams", () => {
    expect(amountIn("cups", 648, facts)).toBe(1.6);
    expect(amountIn("grams", 648, facts)).toBe(170);
    expect(formatAmount(1.6, "cups")).toBe("1.6 cups");
  });
});

describe("fit", () => {
  const facts = parseLabel(PRO_PLAN, "Purina Pro Plan Adult Chicken & Rice");

  it("is a good fit for a healthy adult", () => {
    expect(evaluateFood(facts, bori, EMPTY_PREFS, energyFor(bori)).mark).toBe("good");
  });

  it("is not a fit when it contains an allergy", () => {
    const verdict = evaluateFood(facts, { ...bori, allergies: ["Chicken"] }, EMPTY_PREFS, energyFor(bori));
    expect(verdict.mark).toBe("bad");
    expect(verdict.checks[0].text).toMatch(/chicken/i);
  });

  it("flags an adult food for a puppy", () => {
    const puppy = { ...bori, ageMonths: 6, stage: "puppy" as const };
    expect(evaluateFood(facts, puppy, EMPTY_PREFS, energyFor(puppy)).mark).toBe("bad");
  });

  it("respects chicken-free products", () => {
    expect(contains({ text: "Natural Balance Chicken-Free Lamb formula" }, "chicken")).toBe(false);
  });

  it("flags a chew bigger than the allowance", () => {
    expect(evaluateTreat({ ...facts, kcalPerPiece: 200 }, bori, EMPTY_PREFS, 72).mark).toBe("bad");
    expect(evaluateTreat({ ...facts, kcalPerPiece: 90 }, bori, EMPTY_PREFS, 72).mark).toBe("note");
  });
});

describe("treat allowance", () => {
  it("gives the solo count and shares across treats", () => {
    const shares = shareAllowance(72, [
      { key: "zukes", kcal: 2 },
      { key: "dental", kcal: 30 },
    ]);
    const zukes = shares.find((s) => s.key === "zukes")!;
    const dental = shares.find((s) => s.key === "dental")!;
    expect(zukes.solo).toBe(36);
    expect(dental.count).toBe(1);
    expect(zukes.count * 2 + dental.count * 30).toBeLessThanOrEqual(72);
    expect(zukes.count).toBe(21);
  });
});

describe("changes", () => {
  it("ignores small weight wobbles and reports real changes", () => {
    expect(basisChanges(bori, { ...bori, weightKg: 12.2 })).toHaveLength(0);
    const changes = basisChanges(bori, { ...bori, weightKg: 13.4, allergies: ["Beef"] });
    expect(changes.map((c) => c.key)).toEqual(["weight", "allergies"]);
  });
});

describe("allergen checks use only real ingredients", () => {
  it("ignores an allergen mentioned in a snippet about another formula", () => {
    const facts = parseLabel(
      "Try our Beef & Barley recipe too! Ingredients: Deboned lamb, chicken meal, brown rice.",
      "Blue Buffalo Wilderness Lamb Adult",
    );
    expect(contains(facts, "beef")).toBe(false);
    expect(contains(facts, "chicken")).toBe(true);
  });
});

describe("activity from walking", () => {
  it("turns a week's average walking into the activity level that sets calories", () => {
    const { activityFromWalking, energyFor } = jest.requireActual("@/features/care/food/foodPlanMath") as typeof import("@/features/care/food/foodPlanMath");
    expect([15, 45, 120].map(activityFromWalking)).toEqual(["low", "moderate", "high"]);
    const base = { name: "23", ageMonths: 48, stage: "adult" as const, weightKg: 12, bodyCondition: "ideal" as const, neutered: true, goal: "maintain" as const, conditions: [], allergies: [], meds: [] };
    const quiet = energyFor({ ...base, activity: activityFromWalking(20) })!.kcal;
    const busy = energyFor({ ...base, activity: activityFromWalking(100) })!.kcal;
    expect(busy).toBeGreaterThan(quiet);
  });
});
