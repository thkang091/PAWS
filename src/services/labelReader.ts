import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Facts, LabelStage } from "@/features/care/food/foodPlanMath";
import { askGeminiJson, tidy } from "@/services/gemini";

/**
 * Reading a dog food or treat label with Gemini and Google Search: the real ingredient list in label order, the AAFCO
 * statement, calories and the guaranteed analysis. Search snippets alone mixed in other products (a salmon recipe was
 * flagged for chicken), so when Gemini finds the label, its ingredient list is the one allergen checks read.
 */
export type Label = {
  ingredients: string[];
  aafco: LabelStage | null;
  aafcoText: string | null;
  kcalPerCup: number | null;
  kcalPerKg: number | null;
  kcalPerCan: number | null;
  kcalPerPiece: number | null;
  protein: number | null;
  fat: number | null;
  fiber: number | null;
  moisture: number | null;
  form: "dry" | "wet" | null;
  /** Where the label was read, e.g. "chewy.com". */
  source: string | null;
};

const CACHE = "paws.label.v1.";
const TTL = 30 * 86_400_000;

const SYSTEM = [
  "You read pet food labels for PAWS, a dog care app. Use Google Search to find the exact product's label on the maker's site or a large retailer.",
  "Only report what the label for this exact product says. Never mix in another flavor, size or line. If you cannot find this exact product, return found: false.",
  "Reply with one JSON object and nothing else:",
  '{"found": boolean, "ingredients": string[] (full list in label order, each item as written), "aafco": "growth" | "adult" | "all" | "supplemental" | null, "aafcoText": string | null (the nutritional adequacy statement), "kcalPerCup": number | null, "kcalPerKg": number | null, "kcalPerCan": number | null, "kcalPerPiece": number | null, "protein": number | null, "fat": number | null, "fiber": number | null, "moisture": number | null (guaranteed analysis percents), "form": "dry" | "wet" | null}',
  "Numbers are plain numbers without units. Use null for anything the label does not state.",
].join("\n");

type Reply = Partial<Label> & { found?: boolean };

const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null);
const STAGES: readonly LabelStage[] = ["growth", "adult", "all", "supplemental"];

/** The label, or `missing` when Gemini looked and could not find this exact product; null when it could not be asked. */
export const readLabel = async (product: { name: string; brand?: string | null; kind: "food" | "treat" }): Promise<Label | "missing" | null> => {
  const key = `${CACHE}${product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}`;
  try {
    const saved = await AsyncStorage.getItem(key);
    if (saved) {
      const { at, label } = JSON.parse(saved) as { at: number; label: Label };
      if (Date.now() - at < TTL) return label;
    }
  } catch {
    // A missing or unreadable cache just means asking again.
  }

  const reply = await askGeminiJson<Reply>({
    system: SYSTEM,
    prompt: `Dog ${product.kind === "treat" ? "treat or chew" : "food"}: ${product.name}${product.brand && !product.name.includes(product.brand) ? ` by ${product.brand}` : ""}`,
    search: true,
    maxTokens: 1400,
    timeoutMs: 40000,
  });
  if (reply.state !== "ready") return null;
  if (!reply.value.found) return "missing";

  const v = reply.value;
  const ingredients = (Array.isArray(v.ingredients) ? v.ingredients : []).map((i) => tidy(String(i))).filter((i) => i.length > 1 && i.length < 80);
  const label: Label = {
    ingredients,
    aafco: STAGES.includes(v.aafco as LabelStage) ? (v.aafco as LabelStage) : null,
    aafcoText: typeof v.aafcoText === "string" && v.aafcoText.trim() ? tidy(v.aafcoText) : null,
    kcalPerCup: num(v.kcalPerCup),
    kcalPerKg: num(v.kcalPerKg),
    kcalPerCan: num(v.kcalPerCan),
    kcalPerPiece: num(v.kcalPerPiece),
    protein: num(v.protein),
    fat: num(v.fat),
    fiber: num(v.fiber),
    moisture: num(v.moisture),
    form: v.form === "dry" || v.form === "wet" ? v.form : null,
    source: reply.sources[0] ?? null,
  };
  if (!label.ingredients.length && !label.aafco && !label.kcalPerCup && !label.kcalPerKg && !label.kcalPerPiece) return "missing";
  void AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), label })).catch(() => undefined);
  return label;
};

/** What a label adds to the facts. Its ingredient list replaces snippet guesses; numbers fill what was missing. */
export const withLabel = (facts: Facts, label: Label, productName: string): Facts => {
  const known = label.ingredients.length >= 3;
  return {
    ...facts,
    kcalPerCup: label.kcalPerCup ?? facts.kcalPerCup,
    kcalPerKg: label.kcalPerKg ?? facts.kcalPerKg,
    kcalPerCan: label.kcalPerCan ?? facts.kcalPerCan,
    kcalPerPiece: label.kcalPerPiece ?? facts.kcalPerPiece,
    protein: label.protein ?? facts.protein,
    fat: label.fat ?? facts.fat,
    fiber: label.fiber ?? facts.fiber,
    moisture: label.moisture ?? facts.moisture,
    stage: label.aafco ?? facts.stage,
    stageFrom: label.aafco ? "label" : facts.stageFrom,
    form: label.form ?? facts.form,
    ingredients: known ? [productName, ...label.ingredients].join(", ") : facts.ingredients,
    ingredientsKnown: known || facts.ingredientsKnown,
    ingredientList: known ? label.ingredients : facts.ingredientList,
    labelSource: label.source ?? facts.labelSource ?? null,
    labelRead: true,
  };
};
