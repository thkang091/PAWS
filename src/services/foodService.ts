import { getClientOrThrow, throwIfError } from "@/services/serviceUtils";

export type FoodRuleKind = "allergy" | "intolerance" | "never" | "vet";

export type FoodRule = {
  id: string;
  name: string;
  kind: FoodRuleKind;
  note: string | null;
};

export type FoodVerdict = "safe" | "caution" | "avoid" | "unknown";

export type FoodCheck = {
  id: string;
  question: string;
  foodName: string | null;
  verdict: FoodVerdict;
  headline: string;
  answer: string;
  hadPhoto: boolean;
  createdAt: string;
};

export type PetFood = {
  code: string;
  kind: "food" | "treat";
  name: string;
  brand: string | null;
  imageUrl: string | null;
  kcalPer100g: number | null;
};

export type FoodSearch =
  | { state: "ready"; items: readonly PetFood[] }
  | { state: "empty" }
  | { state: "offline" };

const ownerId = async () => {
  const client = getClientOrThrow();
  const { data } = await client.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Authentication required.");
  return id;
};

export const getFoodRules = async (dogId: string): Promise<FoodRule[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_food_rules")
    .select("id, name, kind, note")
    .eq("dog_id", dogId)
    .order("created_at", { ascending: true });
  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    kind: row.kind as FoodRuleKind,
    note: (row.note as string | null) ?? null,
  }));
};

export const addFoodRule = async (
  dogId: string,
  input: { name: string; kind: FoodRuleKind; note?: string | null },
): Promise<FoodRule> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_food_rules")
    .insert({
      dog_id: dogId,
      owner_id: await ownerId(),
      name: input.name.trim(),
      kind: input.kind,
      note: input.note ?? null,
    })
    .select("id, name, kind, note")
    .single();
  throwIfError(error);
  if (!data) throw new Error("Rule was not saved.");
  return {
    id: data.id as string,
    name: data.name as string,
    kind: data.kind as FoodRuleKind,
    note: (data.note as string | null) ?? null,
  };
};

export const removeFoodRule = async (ruleId: string): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client.from("dog_food_rules").delete().eq("id", ruleId);
  throwIfError(error);
};

export const getFoodChecks = async (dogId: string): Promise<FoodCheck[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_food_checks")
    .select("*")
    .eq("dog_id", dogId)
    .order("created_at", { ascending: false })
    .limit(20);
  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    question: row.question as string,
    foodName: (row.food_name as string | null) ?? null,
    verdict: row.verdict as FoodVerdict,
    headline: row.headline as string,
    answer: row.answer as string,
    hadPhoto: Boolean(row.had_photo),
    createdAt: row.created_at as string,
  }));
};

export const saveFoodCheck = async (
  dogId: string,
  check: Omit<FoodCheck, "id" | "createdAt">,
): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client.from("dog_food_checks").insert({
    dog_id: dogId,
    owner_id: await ownerId(),
    question: check.question,
    food_name: check.foodName,
    verdict: check.verdict,
    headline: check.headline,
    answer: check.answer,
    had_photo: check.hadPhoto,
  });
  throwIfError(error);
};

const missingColumn = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  ((error as { code?: string }).code === "PGRST204" ||
    /column/i.test((error as { message?: string }).message ?? ""));

export const setCurrentFood = async (
  dogId: string,
  food: { name: string; imageUrl?: string | null; kcalPer100g?: number | null },
): Promise<void> => {
  const client = getClientOrThrow();
  const full = {
    food_brand: food.name.trim(),
    food_image_url: food.imageUrl ?? null,
    food_kcal_per_100g: food.kcalPer100g ?? null,
    updated_at: new Date().toISOString(),
  };
  const basic = { food_brand: full.food_brand, updated_at: full.updated_at };

  const write = async (fields: Record<string, unknown>) => {
    const updated = await client.from("dog_care_profile").update(fields).eq("dog_id", dogId).select("id");
    if (updated.error) return updated.error;
    if ((updated.data ?? []).length > 0) return null;
    const inserted = await client
      .from("dog_care_profile")
      .insert({ dog_id: dogId, owner_id: await ownerId(), ...fields });
    return inserted.error;
  };

  const error = await write(full);
  if (!error) return;
  if (missingColumn(error)) {
    throwIfError(await write(basic));
    return;
  }
  throwIfError(error);
};

const SEARCH_URL = "https://world.openpetfoodfacts.org/cgi/search.pl";

const TREAT_WORDS =
  /treat|snack|chew|stick|biscuit|dentastix|jerky|bone|friandise|leckerli|bites|strips|greenies|dental|cookie|biscotti|nibble|reward/i;
const CAT_WORDS = /\b(cat|cats|chat|chats|kitten|katze)\b/i;

const clean = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const titleCase = (value: string) =>
  value.length > 0 && value === value.toLowerCase()
    ? value.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : value;

export const searchPetFoods = async (query: string): Promise<FoodSearch> => {
  const terms = query.trim();
  if (terms.length < 2) return { state: "empty" };

  const params = new URLSearchParams({
    search_terms: terms,
    search_simple: "1",
    json: "1",
    page_size: "40",
    fields: "code,product_name,brands,image_front_small_url,nutriments,categories_tags",
  });

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15000);
  try {
    const response = await fetch(`${SEARCH_URL}?${params.toString()}`, {
      headers: { "User-Agent": "PAWS/1.0 (dog care app)" },
      signal: abort.signal,
    });
    if (!response.ok) return { state: "offline" };
    const body = (await response.json()) as {
      products?: {
        code?: string;
        product_name?: string;
        brands?: string;
        image_front_small_url?: string;
        nutriments?: Record<string, unknown>;
        categories_tags?: string[];
      }[];
    };

    const seen = new Set<string>();
    const items: PetFood[] = [];
    for (const product of body.products ?? []) {
      const name = clean(product.product_name);
      const code = clean(product.code);
      if (!name || !code) continue;
      const tags = product.categories_tags ?? [];
      const dogTagged = tags.some((tag) => tag.includes("dog"));
      const catTagged = tags.some((tag) => /(^|:)cat-|kitten/.test(tag));
      if ((catTagged && !dogTagged) || (!dogTagged && CAT_WORDS.test(name))) continue;
      const kind: PetFood["kind"] =
        tags.includes("en:dog-treats") || TREAT_WORDS.test(`${name} ${product.brands ?? ""}`) ? "treat" : "food";
      const brand = clean(product.brands?.split(",")[0]);
      const bare =
        brand && name.toLowerCase().startsWith(brand.toLowerCase())
          ? name.slice(brand.length).replace(/^[\s\-–:,]+/, "").trim() || name
          : name;
      const key = `${brand ?? ""}|${bare}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const kcal = Number(product.nutriments?.["energy-kcal_100g"]);
      items.push({
        code,
        kind,
        name: titleCase(bare),
        brand: brand ? titleCase(brand) : null,
        imageUrl: clean(product.image_front_small_url),
        kcalPer100g: Number.isFinite(kcal) && kcal >= 50 && kcal <= 650 ? Math.round(kcal) : null,
      });
    }

    return items.length > 0 ? { state: "ready", items } : { state: "empty" };
  } catch {
    return { state: "offline" };
  } finally {
    clearTimeout(timer);
  }
};

export type SavedTreat = { id: string; name: string; imageUrl: string | null };

export const getSavedTreats = async (dogId: string): Promise<SavedTreat[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("dog_treats")
    .select("id, name, image_url")
    .eq("dog_id", dogId)
    .order("created_at", { ascending: true });
  throwIfError(error);
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    imageUrl: (row.image_url as string | null) ?? null,
  }));
};

export const saveTreat = async (
  dogId: string,
  treat: { name: string; imageUrl?: string | null },
): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client.from("dog_treats").insert({
    dog_id: dogId,
    owner_id: await ownerId(),
    name: treat.name.trim(),
    image_url: treat.imageUrl ?? null,
  });
  if (error && error.code === "23505") return;
  throwIfError(error);
};

export const removeSavedTreat = async (treatId: string): Promise<void> => {
  const client = getClientOrThrow();
  const { error } = await client.from("dog_treats").delete().eq("id", treatId);
  throwIfError(error);
};

export const getRecentTreatNames = async (dogId: string): Promise<string[]> => {
  const client = getClientOrThrow();
  const since = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data, error } = await client
    .from("dog_feeding_logs")
    .select("meal_name, created_at")
    .eq("dog_id", dogId)
    .eq("log_type", "treat")
    .gte("log_date", since)
    .not("meal_name", "is", null)
    .order("created_at", { ascending: false })
    .limit(80);
  throwIfError(error);
  const seen = new Set<string>();
  const names: string[] = [];
  for (const row of data ?? []) {
    const name = (row.meal_name as string | null)?.trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    names.push(name);
  }
  return names.slice(0, 12);
};

export type MealPlan = {
  mealTimes: readonly string[];
  mealPortions: readonly number[];
  treatsPerDay: number;
};

export const saveMealPlan = async (dogId: string, plan: MealPlan): Promise<void> => {
  const client = getClientOrThrow();
  const average = Math.round(
    plan.mealPortions.reduce((total, grams) => total + grams, 0) / Math.max(1, plan.mealPortions.length),
  );
  const base = {
    meals_per_day: plan.mealTimes.length,
    portion_grams_per_meal: average,
    treats_per_day: plan.treatsPerDay,
    updated_at: new Date().toISOString(),
  };
  const full = { ...base, meal_times: [...plan.mealTimes], meal_portions: [...plan.mealPortions] };

  const write = async (fields: Record<string, unknown>) => {
    const updated = await client.from("dog_care_profile").update(fields).eq("dog_id", dogId).select("id");
    if (updated.error) return updated.error;
    if ((updated.data ?? []).length > 0) return null;
    const inserted = await client
      .from("dog_care_profile")
      .insert({ dog_id: dogId, owner_id: await ownerId(), ...fields });
    return inserted.error;
  };

  const error = await write(full);
  if (!error) return;
  if (missingColumn(error)) {
    throwIfError(await write(base));
    return;
  }
  throwIfError(error);
};
