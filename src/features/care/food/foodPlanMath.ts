/**
 * Food Plan maths and label reading. Pure functions, no React, so the numbers can be tested.
 *
 * Energy follows the WSAVA / NRC approach: resting energy (RER = 70 x kg^0.75) times a life-stage and activity
 * factor. Treats get 10% of the day, which is the common vet guideline; the main food gets the other 90%.
 */

export type LifeStage = "puppy" | "adult" | "senior";
export type BodyCondition = "thin" | "ideal" | "heavy";
export type Activity = "low" | "moderate" | "high";
export type WeightGoal = "maintain" | "lose" | "gain";
export type FoodForm = "dry" | "wet" | "mixed" | "any";
export type LabelStage = "all" | "growth" | "adult" | "supplemental";

export type Prefs = {
  form: FoodForm;
  avoid: readonly string[];
  sensitiveStomach: boolean;
  noColors: boolean;
  noFlavors: boolean;
  noPreservatives: boolean;
  natural: boolean;
  other: string;
};

export const EMPTY_PREFS: Prefs = {
  form: "any",
  avoid: [],
  sensitiveStomach: false,
  noColors: false,
  noFlavors: false,
  noPreservatives: false,
  natural: false,
  other: "",
};

export type Basis = {
  name: string;
  ageMonths: number | null;
  stage: LifeStage | null;
  weightKg: number | null;
  bodyCondition: BodyCondition | null;
  activity: Activity | null;
  neutered: boolean | null;
  goal: WeightGoal | null;
  conditions: readonly string[];
  allergies: readonly string[];
  meds: readonly string[];
};

/** What PAWS knows about a product, from its label, the web or the owner. Values per 100 g are "as fed". */
export type Facts = {
  kcalPerCup: number | null;
  kcalPerKg: number | null;
  kcalPerCan: number | null;
  kcalPerPiece: number | null;
  protein: number | null;
  fat: number | null;
  fiber: number | null;
  moisture: number | null;
  stage: LabelStage | null;
  /** Where the life-stage designation came from: the AAFCO statement, or only the product name. */
  stageFrom: "label" | "name" | null;
  form: "dry" | "wet" | null;
  /** Everything read about the product, for display and life-stage reading. */
  text: string;
  /** Only the product name and real ingredient lists. Allergen and additive checks look here, never at loose snippets. */
  ingredients: string;
  ingredientsKnown: boolean;
  /** The label's ingredients in order, when Gemini read the actual label. */
  ingredientList?: readonly string[] | null;
  /** Where that label was read, e.g. "chewy.com". */
  labelSource?: string | null;
  /** The label has been looked up (found or not), so it is not asked again for this product. */
  labelRead?: boolean;
};

export const EMPTY_FACTS: Facts = {
  kcalPerCup: null,
  kcalPerKg: null,
  kcalPerCan: null,
  kcalPerPiece: null,
  protein: null,
  fat: null,
  fiber: null,
  moisture: null,
  stage: null,
  stageFrom: null,
  form: null,
  text: "",
  ingredients: "",
  ingredientsKnown: false,
};

// ---------- Life stage and energy ----------

export const stageOf = (ageMonths: number | null): LifeStage | null =>
  ageMonths == null ? null : ageMonths < 12 ? "puppy" : ageMonths >= 84 ? "senior" : "adult";

export const rer = (kg: number) => 70 * Math.pow(kg, 0.75);

const ADULT_FACTOR: Record<Activity, { neutered: number; intact: number }> = {
  low: { neutered: 1.4, intact: 1.6 },
  moderate: { neutered: 1.6, intact: 1.8 },
  high: { neutered: 2.0, intact: 2.2 },
};
const SENIOR_FACTOR: Record<Activity, number> = { low: 1.2, moderate: 1.4, high: 1.6 };

/**
 * Activity from what was actually walked: the average minutes a day over the last week. Under half an hour is low,
 * up to an hour and a half moderate, more is high. Used once there are walks on at least three days, so a quiet
 * week of not logging does not starve the dog.
 */
export const activityFromWalking = (minutesPerDay: number): Activity => (minutesPerDay < 30 ? "low" : minutesPerDay <= 90 ? "moderate" : "high");

export type Energy = { kcal: number; mainKcal: number; treatKcal: number; factor: number; targetKg: number };

export const energyFor = (basis: Basis): Energy | null => {
  const kg = basis.weightKg;
  if (!kg || kg <= 0) return null;
  const stage = basis.stage ?? "adult";
  const activity = basis.activity ?? "moderate";
  const goal = stage === "puppy" ? "maintain" : (basis.goal ?? "maintain");

  let factor: number;
  if (stage === "puppy") factor = basis.ageMonths != null && basis.ageMonths < 4 ? 3 : 2;
  else if (stage === "senior") factor = SENIOR_FACTOR[activity];
  else factor = ADULT_FACTOR[activity][basis.neutered === false ? "intact" : "neutered"];

  // Weight loss feeds resting energy at the target weight; gain adds a little on top of maintenance.
  let targetKg = kg;
  if (goal === "lose") {
    targetKg = kg * (basis.bodyCondition === "heavy" ? 0.88 : 0.95);
    factor = 1;
  } else if (goal === "gain") {
    factor *= 1.15;
  }

  const kcal = Math.round((rer(targetKg) * factor) / 10) * 10;
  const treatKcal = Math.round(kcal * 0.1);
  return { kcal, mainKcal: kcal - treatKcal, treatKcal, factor, targetKg };
};

export const goalFrom = (condition: BodyCondition | null): WeightGoal =>
  condition === "heavy" ? "lose" : condition === "thin" ? "gain" : "maintain";

// ---------- Portions ----------

export type Unit = "cups" | "grams" | "cans";

export const unitsFor = (facts: Facts): Unit[] => {
  const units: Unit[] = [];
  if (facts.kcalPerCan) units.push("cans");
  if (facts.kcalPerCup) units.push("cups");
  if (facts.kcalPerKg) units.push("grams");
  return units;
};

export const defaultUnit = (facts: Facts): Unit | null => {
  if (facts.form === "wet" && facts.kcalPerCan) return "cans";
  if (facts.kcalPerCup) return "cups";
  if (facts.kcalPerKg) return "grams";
  if (facts.kcalPerCan) return "cans";
  return null;
};

export const amountIn = (unit: Unit, kcal: number, facts: Facts): number | null => {
  if (unit === "cups" && facts.kcalPerCup) return Math.round((kcal / facts.kcalPerCup) * 10) / 10;
  if (unit === "grams" && facts.kcalPerKg) return Math.round(((kcal / facts.kcalPerKg) * 1000) / 5) * 5;
  if (unit === "cans" && facts.kcalPerCan) return Math.round((kcal / facts.kcalPerCan) * 4) / 4;
  return null;
};

export const gramsFor = (kcal: number, facts: Facts) =>
  facts.kcalPerKg ? Math.round(((kcal / facts.kcalPerKg) * 1000) / 5) * 5 : null;

export const formatAmount = (value: number, unit: Unit) => {
  if (unit === "grams") return `${value} g`;
  const word = unit === "cups" ? "cup" : "can";
  const shown = unit === "cans" ? cansText(value) : String(value);
  return `${shown} ${value === 1 ? word : `${word}s`}`;
};

const cansText = (value: number) => {
  const whole = Math.floor(value);
  const part = value - whole;
  const frac = part === 0.25 ? "¼" : part === 0.5 ? "½" : part === 0.75 ? "¾" : "";
  return whole === 0 && frac ? frac : `${whole}${frac}`;
};

/** Dry matter: labels are "as fed", so take the water out before comparing foods. */
export const dryMatter = (value: number | null, facts: Pick<Facts, "moisture" | "kcalPerKg" | "form">) => {
  if (value == null) return null;
  const moisture = facts.moisture ?? (facts.form === "wet" || (facts.kcalPerKg != null && facts.kcalPerKg < 2000) ? 78 : 10);
  const solids = 100 - moisture;
  return solids > 0 ? (value / solids) * 100 : null;
};

// ---------- Ingredients ----------

const INGREDIENT: Record<string, RegExp> = {
  chicken: /\bchicken|poultry\b/i,
  beef: /\bbeef\b/i,
  lamb: /\blamb\b/i,
  fish: /\b(fish|salmon|tuna|whitefish|cod|herring|menhaden|ocean)\b/i,
  pork: /\bpork\b/i,
  turkey: /\bturkey\b/i,
  duck: /\bduck\b/i,
  egg: /\beggs?\b/i,
  dairy: /\b(dairy|milk|cheese|whey|lactose)\b/i,
  wheat: /\bwheat\b/i,
  corn: /\bcorn\b/i,
  soy: /\bsoy/i,
  grain: /\b(wheat|corn|barley|oat|oatmeal|rice|sorghum|millet|grain)s?\b/i,
};

const FREE_OF = (word: string) => new RegExp(`\\b(${word})[- ]free\\b|\\bno ${word}\\b|\\bwithout ${word}\\b`, "i");

const COLORS = /\b(red\s?(no\.?\s?)?40|yellow\s?(no\.?\s?)?[56]|blue\s?(no\.?\s?)?[12]|caramel colou?r|titanium dioxide|artificial colou?rs?|added colou?r)\b/i;
const FLAVORS = /\bartificial flavou?rs?\b/i;
const PRESERVATIVES = /\b(BHA|BHT|ethoxyquin|propyl gallate|TBHQ|propylene glycol)\b/i;

/** Does this product contain something (an allergy or an ingredient to avoid)? */
export const contains = (facts: { ingredients?: string; text?: string }, item: string): boolean => {
  const source = facts.ingredients ?? facts.text ?? "";
  const key = item.trim().toLowerCase();
  if (!key) return false;
  const pattern = INGREDIENT[key] ?? new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
  if (FREE_OF(key === "grain" ? "grain" : key).test(source)) return false;
  return pattern.test(source);
};

export const additives = (facts: Pick<Facts, "ingredients">) => ({
  colors: COLORS.test(facts.ingredients),
  flavors: FLAVORS.test(facts.ingredients),
  preservatives: PRESERVATIVES.test(facts.ingredients),
});

// ---------- Reading labels ----------

const num = (raw: string) => Number(raw.replace(/,/g, ""));

const first = (text: string, pattern: RegExp, min: number, max: number) => {
  for (const match of text.matchAll(pattern)) {
    const value = num(match[1]);
    if (Number.isFinite(value) && value >= min && value <= max) return value;
  }
  return null;
};

const KCAL = String.raw`k?cal(?:ories)?\s*(?:\(?ME\)?\s*)?`;

/**
 * Pull calorie content, guaranteed analysis and the AAFCO statement out of label text or search snippets, e.g.
 * "Calorie Content (calculated): 3,817 kcal/kg, 409 kcal/cup" or "Crude Protein (min) 26.0%".
 */
export const parseLabel = (raw: string, name = ""): Facts => {
  const text = raw.replace(/\s+/g, " ");
  // Snippets often mix several products, so a life stage is only taken from a real AAFCO line or the name itself.
  const all = `${name} ${text}`;

  const kcalPerKg = first(text, new RegExp(String.raw`(\d[\d,]{2,5}(?:\.\d+)?)\s*${KCAL}(?:\/|per)\s*kg\b`, "gi"), 500, 6500);
  const kcalPerCup = first(text, new RegExp(String.raw`(\d[\d,]{1,3}(?:\.\d+)?)\s*${KCAL}(?:\/|per)\s*(?:8[- ]?oz\.?\s*|standard\s*|measuring\s*)?cup\b`, "gi"), 120, 750);
  const kcalPerCan = first(text, new RegExp(String.raw`(\d[\d,]{1,3}(?:\.\d+)?)\s*${KCAL}(?:\/|per)\s*(?:\d+(?:\.\d+)?\s*oz\.?\s*)?(?:can|tray|pouch|carton)\b`, "gi"), 30, 1400);
  const kcalPerPiece = first(text, new RegExp(String.raw`(\d{1,3}(?:\.\d+)?)\s*${KCAL}(?:\/|per|each)\s*(?:1\s*)?(?:treat|piece|chew|stick|biscuit|bone|bar|cookie|jerky|strip)s?\b`, "gi"), 0.5, 400);

  const analysis = (label: string) =>
    first(text, new RegExp(String.raw`crude ${label}[^\d%]{0,24}?(\d{1,2}(?:\.\d+)?)\s*%`, "gi"), 0, 90);
  const protein = analysis("protein");
  const fat = analysis("fat");
  const fiber = analysis("fib(?:er|re)");
  const moisture = first(text, /moisture[^\d%]{0,24}?(\d{1,2}(?:\.\d+)?)\s*%/gi, 0, 90);

  let stage: LabelStage | null = null;
  let stageFrom: Facts["stageFrom"] = null;
  if (/intermittent or supplement(al|ary)/i.test(text)) {
    stage = "supplemental";
    stageFrom = "label";
  } else {
    const statement = text.match(/(?:AAFCO|nutrient profiles|feeding (?:tests|trials))[^.]{0,200}?\b(all life stages|growth|adult maintenance|maintenance)\b/i)
      ?? text.match(/\bfor (all life stages|growth|adult maintenance|maintenance)\b[^.]{0,80}?(?:AAFCO)/i);
    if (statement) {
      const word = statement[1].toLowerCase();
      stage = word === "all life stages" ? "all" : word === "growth" ? "growth" : "adult";
      stageFrom = "label";
    } else if (/all life stages/i.test(name)) {
      stage = "all";
      stageFrom = "name";
    } else if (/\bpupp(y|ies)\b/i.test(name)) {
      stage = "growth";
      stageFrom = "name";
    } else if (/\b(adult|senior|mature|7\+|11\+)\b/i.test(name)) {
      stage = "adult";
      stageFrom = "name";
    }
  }

  const wet = /\b(wet|can(ned)?|pâté|pate|stew|loaf|chunks in gravy|in gravy|tray|pouch)\b/i.test(name);
  const dry = /\b(dry|kibble|biscuits?)\b/i.test(name);
  const form = wet ? "wet" : dry ? "dry" : kcalPerCan && !kcalPerCup ? "wet" : kcalPerCup ? "dry" : null;

  return {
    kcalPerCup,
    kcalPerKg,
    kcalPerCan,
    kcalPerPiece,
    protein,
    fat,
    fiber,
    moisture,
    stage,
    stageFrom,
    form,
    text: all,
    ingredients: [name, ...[...text.matchAll(/\bingredients?\s*:\s*([^]{0,600}?)(?=\.\s+[A-Z][a-z]+ [a-z]|guaranteed|calorie|$)/gi)].map((m) => m[1])].join(" · "),
    ingredientsKnown: /\bingredients?\s*:/i.test(text),
  };
};

/** Combine what different sources found; the first source that knows a value wins. */
export const mergeFacts = (...sources: readonly Partial<Facts>[]): Facts => {
  const out: Facts = { ...EMPTY_FACTS };
  for (const source of sources) {
    for (const key of Object.keys(EMPTY_FACTS) as (keyof Facts)[]) {
      if (key === "text") continue;
      if (key === "ingredientsKnown") {
        out.ingredientsKnown = out.ingredientsKnown || Boolean(source.ingredientsKnown);
        continue;
      }
      if (out[key] == null && source[key] != null) (out as Record<string, unknown>)[key] = source[key];
    }
  }
  if (out.stageFrom === "name") {
    const label = sources.find((s) => s.stageFrom === "label");
    if (label) {
      out.stage = label.stage ?? out.stage;
      out.stageFrom = "label";
    }
  }
  out.text = sources.map((s) => s.text ?? "").filter(Boolean).join(" · ");
  out.ingredients = sources.map((s) => s.ingredients ?? "").filter(Boolean).join(" · ");
  if (out.kcalPerKg == null && out.kcalPerCup == null && out.kcalPerCan == null) out.kcalPerKg = null;
  return out;
};

// ---------- Fit ----------

export type Mark = "good" | "note" | "bad";
export type Check = { key: string; mark: Mark; text: string };
export type Verdict = { mark: Mark; checks: Check[] };

const MEDICAL_FAT_LIMIT: Record<string, number> = { pancreatitis: 15 };

const pronoun = (basis: Basis) => basis.name;

const rank: Record<Mark, number> = { bad: 0, note: 1, good: 2 };
const verdictOf = (checks: Check[]): Verdict => ({
  mark: checks.reduce<Mark>((worst, check) => (rank[check.mark] < rank[worst] ? check.mark : worst), "good"),
  checks: [...checks].sort((a, b) => rank[a.mark] - rank[b.mark]),
});

const restrictionChecks = (facts: Facts, basis: Basis, prefs: Prefs): Check[] => {
  const checks: Check[] = [];
  const allergyHits = basis.allergies.filter((item) => contains(facts, item));
  const avoidHits = prefs.avoid.filter((item) => !basis.allergies.includes(item) && contains(facts, item));
  if (allergyHits.length) {
    // With the real label, name the ingredient that matched: "poultry fat" is not the same claim as "chicken".
    const exact = allergyHits.flatMap((allergy) => {
      const hit = facts.ingredientList?.find((ingredient) => contains({ ingredients: ingredient }, allergy));
      return hit && !new RegExp(`\\b${allergy}`, "i").test(hit) ? [{ allergy, hit: hit.replace(/\s*\(.*\)\s*/g, "").toLowerCase() }] : [];
    });
    checks.push({
      key: "allergy",
      mark: "bad",
      text: exact.length
        ? `Has ${list(exact.map((e) => e.hit))}, which can be ${list(exact.map((e) => e.allergy))}. ${pronoun(basis)} is allergic to ${list(exact.map((e) => e.allergy))}.`
        : `Contains ${list(allergyHits)}, which ${pronoun(basis)} is allergic to.`,
    });
  } else if (basis.allergies.length && !facts.ingredientsKnown) {
    checks.push({ key: "allergy", mark: "note", text: `PAWS could not read the full ingredients. Check the bag for ${list(basis.allergies)}.` });
  } else if (basis.allergies.length) {
    checks.push({ key: "allergy", mark: "good", text: `No ${list(basis.allergies)}, so it suits ${pronoun(basis)}'s allergies.` });
  }
  if (avoidHits.length) checks.push({ key: "avoid", mark: "bad", text: `Contains ${list(avoidHits)}, which you asked to avoid.` });

  const found = additives(facts);
  const style: string[] = [];
  if (prefs.noColors && found.colors) style.push("artificial colors");
  if (prefs.noFlavors && found.flavors) style.push("artificial flavors");
  if ((prefs.noPreservatives || prefs.natural) && found.preservatives) style.push("artificial preservatives");
  if (style.length) checks.push({ key: "additives", mark: "note", text: `Has ${list(style)}, which you prefer to skip.` });
  return checks;
};

export const evaluateFood = (facts: Facts, basis: Basis, prefs: Prefs, energy: Energy | null): Verdict => {
  const checks: Check[] = [];
  const name = pronoun(basis);
  const stage = basis.stage ?? "adult";

  // Complete and balanced
  if (facts.stage === "supplemental") {
    checks.push({ key: "complete", mark: "bad", text: "Labelled for intermittent or supplemental feeding only, so it cannot be the main food." });
  } else if (facts.stageFrom === "label") {
    checks.push({ key: "complete", mark: "good", text: `Complete and balanced (AAFCO) for ${facts.stage === "all" ? "all life stages" : facts.stage === "growth" ? "growth" : "adult maintenance"}.` });
  } else {
    checks.push({ key: "complete", mark: "note", text: "PAWS could not confirm the AAFCO complete and balanced statement. It is on the back of the bag." });
  }

  // Life stage
  if (facts.stage && facts.stage !== "supplemental") {
    if (stage === "puppy" && facts.stage === "adult") {
      checks.push({ key: "stage", mark: "bad", text: `Made for adult dogs. ${name} is still growing and needs a growth or all life stages food.` });
    } else if (stage !== "puppy" && facts.stage === "growth") {
      checks.push({ key: "stage", mark: "note", text: `A puppy food is richer than an adult like ${name} needs.` });
    } else {
      checks.push({ key: "stage", mark: "good", text: `Matches ${name}'s life stage (${stage}).` });
    }
  }

  // Weight goal and calorie density
  const goal = basis.goal ?? "maintain";
  const fatDM = dryMatter(facts.fat, facts);
  if (goal === "lose" && ((facts.kcalPerCup ?? 0) > 420 || (fatDM ?? 0) > 18)) {
    checks.push({
      key: "goal",
      mark: "note",
      text: `Calorie dense${facts.kcalPerCup ? ` at ${facts.kcalPerCup} kcal a cup` : ""}. A weight-management food would let ${name} eat more for the same calories.`,
    });
  } else if (goal === "gain" && facts.kcalPerCup != null && facts.kcalPerCup < 330) {
    checks.push({ key: "goal", mark: "note", text: `Fairly light at ${facts.kcalPerCup} kcal a cup, so gaining will mean big portions.` });
  } else if (facts.kcalPerCup || facts.kcalPerKg || facts.kcalPerCan) {
    checks.push({ key: "goal", mark: "good", text: `Works with ${name}'s goal to ${goal === "lose" ? "lose" : goal === "gain" ? "gain" : "keep"} weight.` });
  }

  // Serving size the calorie density leads to
  if (energy && facts.kcalPerCup) {
    const cups = energy.mainKcal / facts.kcalPerCup;
    if (cups < 0.25) checks.push({ key: "serving", mark: "note", text: "Very calorie dense for a dog this size. The daily portion is tiny and easy to overfeed." });
  }

  checks.push(...restrictionChecks(facts, basis, prefs));

  // Form preference
  if (prefs.form !== "any" && prefs.form !== "mixed" && facts.form && facts.form !== prefs.form) {
    checks.push({ key: "form", mark: "note", text: `It is ${facts.form} food, and you prefer ${prefs.form}.` });
  }

  // Health conditions
  const conditions = basis.conditions.map((c) => c.toLowerCase());
  for (const [condition, limit] of Object.entries(MEDICAL_FAT_LIMIT)) {
    if (conditions.some((c) => c.includes(condition)) && fatDM != null && fatDM > limit) {
      checks.push({ key: `health-${condition}`, mark: "bad", text: `About ${Math.round(fatDM)}% fat (dry matter). With pancreatitis, vets usually keep fat under ${limit}%.` });
    }
  }
  if (conditions.some((c) => c.includes("kidney"))) {
    checks.push({ key: "health-kidney", mark: "note", text: "Kidney disease usually calls for a vet diet. Check this food with your vet." });
  }
  if (prefs.sensitiveStomach && fatDM != null && fatDM > 20) {
    checks.push({ key: "stomach", mark: "note", text: `Rich at about ${Math.round(fatDM)}% fat, which can upset a sensitive stomach.` });
  }

  return verdictOf(checks);
};

export const evaluateTreat = (facts: Facts, basis: Basis, prefs: Prefs, allowanceKcal: number | null): Verdict => {
  const checks: Check[] = [];
  if (facts.kcalPerPiece == null) {
    checks.push({ key: "kcal", mark: "note", text: "Add the calories per treat from the pack." });
  } else if (allowanceKcal != null && facts.kcalPerPiece > allowanceKcal * 2) {
    checks.push({ key: "kcal", mark: "bad", text: `One is ${facts.kcalPerPiece} kcal, far more than the whole day's treat allowance.` });
  } else if (allowanceKcal != null && facts.kcalPerPiece > allowanceKcal) {
    checks.push({
      key: "kcal",
      mark: "note",
      text: `One is ${facts.kcalPerPiece} kcal, a little over the ${allowanceKcal} kcal treat allowance. Give it every other day, or take about ${Math.round(facts.kcalPerPiece - allowanceKcal)} kcal off the main food on chew days.`,
    });
  } else if (allowanceKcal != null && facts.kcalPerPiece > allowanceKcal * 0.5) {
    checks.push({ key: "kcal", mark: "note", text: `One uses ${Math.round((facts.kcalPerPiece / allowanceKcal) * 100)}% of the day's treat allowance.` });
  } else {
    checks.push({ key: "kcal", mark: "good", text: `${facts.kcalPerPiece} kcal each, easy to fit in.` });
  }
  checks.push(...restrictionChecks(facts, basis, prefs).filter((check) => check.mark !== "good"));
  return verdictOf(checks);
};

// ---------- Treat allowance ----------

export type Share = { key: string; kcal: number; solo: number; count: number };

/**
 * Share the treat allowance across the treats the dog gets. Bigger treats are placed first so a chew still fits,
 * then the rest is split evenly and any leftover goes to the smallest treat.
 */
export const shareAllowance = (allowanceKcal: number, treats: readonly { key: string; kcal: number | null }[]): Share[] => {
  const known = treats.filter((t): t is { key: string; kcal: number } => t.kcal != null && t.kcal > 0);
  const order = [...known].sort((a, b) => b.kcal - a.kcal);
  let remaining = allowanceKcal;
  const counts = new Map<string, number>();
  order.forEach((treat, i) => {
    const share = remaining / (order.length - i);
    let count = Math.floor(share / treat.kcal);
    if (count === 0 && treat.kcal <= remaining) count = 1;
    counts.set(treat.key, count);
    remaining -= count * treat.kcal;
  });
  const smallest = order[order.length - 1];
  if (smallest && remaining >= smallest.kcal) counts.set(smallest.key, (counts.get(smallest.key) ?? 0) + Math.floor(remaining / smallest.kcal));
  return known.map((t) => ({ key: t.key, kcal: t.kcal, solo: Math.floor(allowanceKcal / t.kcal), count: counts.get(t.key) ?? 0 }));
};

// ---------- Alternatives ----------

export const alternativesQuery = (basis: Basis, prefs: Prefs, kind: "food" | "treat") => {
  const parts: string[] = [];
  const stage = basis.stage ?? "adult";
  if (kind === "food") parts.push(stage === "puppy" ? "puppy" : stage === "senior" ? "senior" : "adult");
  if (kind === "food" && prefs.form !== "any" && prefs.form !== "mixed") parts.push(prefs.form);
  if (kind === "food" && basis.goal === "lose") parts.push("healthy weight");
  if (prefs.sensitiveStomach) parts.push("sensitive stomach");
  const free = [...new Set([...basis.allergies, ...prefs.avoid].map((a) => a.toLowerCase()))].slice(0, 2);
  free.forEach((item) => parts.push(`${item} free`));
  if (prefs.natural || prefs.noColors || prefs.noPreservatives) parts.push("natural");
  if (basis.conditions.some((c) => /pancreatitis/i.test(c))) parts.push("low fat");
  parts.push(kind === "treat" ? "low calorie dog treats" : "dog food");
  return parts.join(" ");
};

/** The same filters as `alternativesQuery`, as short labels the owner can read ("Adult", "Chicken free"). */
export const dietTags = (basis: Basis, prefs: Prefs): string[] => {
  const tags: string[] = [];
  const stage = basis.stage ?? "adult";
  tags.push(stage === "puppy" ? "Puppy" : stage === "senior" ? "Senior" : "Adult");
  if (prefs.form === "dry" || prefs.form === "wet") tags.push(prefs.form === "dry" ? "Dry" : "Wet");
  if (basis.goal === "lose") tags.push("Healthy weight");
  if (prefs.sensitiveStomach) tags.push("Sensitive stomach");
  const free = [...new Set([...basis.allergies, ...prefs.avoid].map((a) => a.toLowerCase()))].slice(0, 2);
  free.forEach((item) => tags.push(`${item.charAt(0).toUpperCase()}${item.slice(1)} free`));
  if (prefs.natural || prefs.noColors || prefs.noPreservatives) tags.push("Natural");
  if (basis.conditions.some((c) => /pancreatitis/i.test(c))) tags.push("Low fat");
  return tags;
};

// ---------- Change detection ----------

export type BasisChange = { key: string; text: string };

const sameList = (a: readonly string[], b: readonly string[]) =>
  [...a].map((x) => x.toLowerCase()).sort().join("|") === [...b].map((x) => x.toLowerCase()).sort().join("|");

/** What moved between the basis a plan was saved on and the dog as it is now. Small weight wobbles are ignored. */
export const basisChanges = (saved: Basis, now: Basis): BasisChange[] => {
  const out: BasisChange[] = [];
  if (saved.weightKg != null && now.weightKg != null) {
    const diff = now.weightKg - saved.weightKg;
    if (Math.abs(diff) >= 0.5 && Math.abs(diff) / saved.weightKg >= 0.03) {
      out.push({ key: "weight", text: `Weight ${saved.weightKg} kg → ${now.weightKg} kg` });
    }
  }
  if (saved.stage && now.stage && saved.stage !== now.stage) out.push({ key: "stage", text: `Life stage ${saved.stage} → ${now.stage}` });
  const scalar = (key: "bodyCondition" | "activity" | "goal", label: string) => {
    if (saved[key] && now[key] && saved[key] !== now[key]) out.push({ key, text: `${label} ${saved[key]} → ${now[key]}` });
  };
  scalar("bodyCondition", "Body condition");
  scalar("activity", "Activity");
  scalar("goal", "Weight goal");
  if (saved.neutered != null && now.neutered != null && saved.neutered !== now.neutered) {
    out.push({ key: "neutered", text: now.neutered ? "Now neutered" : "No longer marked neutered" });
  }
  const added = (key: "conditions" | "allergies" | "meds", label: string) => {
    if (sameList(saved[key], now[key])) return;
    const fresh = now[key].filter((x) => !saved[key].some((y) => y.toLowerCase() === x.toLowerCase()));
    const gone = saved[key].filter((x) => !now[key].some((y) => y.toLowerCase() === x.toLowerCase()));
    if (fresh.length) out.push({ key, text: `New ${label}: ${list(fresh)}` });
    if (gone.length) out.push({ key: `${key}-gone`, text: `No longer listed: ${list(gone)}` });
  };
  added("conditions", "health condition");
  added("allergies", "allergy");
  added("meds", "medication");
  return out;
};

/** Medications that change how a dog should be fed, with the one thing to know. */
export const DIET_MEDS: readonly { match: RegExp; note: string }[] = [
  { match: /predniso(lone|ne)|dexamethasone|steroid/i, note: "Steroids raise appetite. Hold the portion steady and watch weight." },
  { match: /phenobarbital|potassium bromide|keppra|levetiracetam/i, note: "Keep salt and meals consistent, and watch weight." },
  { match: /insulin|vetsulin|caninsulin/i, note: "Feed the same amount at the same times, matched to insulin." },
  { match: /levothyroxine|soloxine|thyro/i, note: "Recheck the portion as weight settles on treatment." },
];

export const dietMedNotes = (meds: readonly string[]) =>
  meds.flatMap((med) => DIET_MEDS.filter((d) => d.match.test(med)).map((d) => ({ med, note: d.note })));

const list = (items: readonly string[]) =>
  items.length <= 1 ? (items[0] ?? "").toLowerCase() : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`.toLowerCase();
