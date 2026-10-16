import { mergeFacts, parseLabel, type Facts } from "@/features/care/food/foodPlanMath";
import { readLabel, withLabel } from "@/services/labelReader";
import { serpSearch } from "@/services/serpApi";

/**
 * Finding and identifying dog food and treats. SerpApi (Google Shopping) finds the product the owner means; a SerpApi
 * web search then reads its label (calories, guaranteed analysis, AAFCO statement, ingredients) from the snippets of
 * maker and retailer pages. Open Pet Food Facts fills gaps and answers barcode scans.
 */

export type ProductKind = "food" | "treat";

export type Product = {
  id: string;
  kind: ProductKind;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  store: string | null;
  price: string | null;
  origin: "web" | "database" | "barcode" | "manual";
  /** Whatever the search already knew, e.g. Open Pet Food Facts nutrients. */
  seed?: Partial<Facts>;
};

export type Lookup<T> = { state: "ready"; items: T } | { state: "empty" } | { state: "offline" };

const OPFF = "https://world.openpetfoodfacts.org";
const UA = { "User-Agent": "PAWS/1.0 (dog care app)" };
const TREAT_WORDS = /\b(treats?|chews?|biscuits?|jerky|sticks?|bones?|dental|bites|snacks?|cookies?)\b/i;
const NOT_DOG = /\b(cat|kitten|feline)\b/i;

const withTimeout = async (url: string, ms = 12000) => {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), ms);
  try {
    const response = await fetch(url, { headers: UA, signal: abort.signal });
    return response.ok ? ((await response.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

type OpffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  image_front_small_url?: string;
  image_front_url?: string;
  nutriments?: Record<string, unknown>;
  ingredients_text?: string;
  ingredients_text_en?: string;
  categories_tags?: string[];
};

const opffFacts = (p: OpffProduct, name: string): Partial<Facts> => {
  const n = p.nutriments ?? {};
  const per100 = (field: string) => {
    const v = Number(n[`${field}_100g`]);
    return Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v * 10) / 10 : null;
  };
  const kcal100 = Number(n["energy-kcal_100g"]);
  const ingredients = p.ingredients_text_en ?? p.ingredients_text ?? "";
  const parsed = parseLabel(ingredients ? `Ingredients: ${ingredients}` : "", name);
  return {
    ...parsed,
    kcalPerKg: Number.isFinite(kcal100) && kcal100 >= 50 && kcal100 <= 650 ? Math.round(kcal100 * 10) : null,
    protein: per100("proteins"),
    fat: per100("fat"),
    fiber: per100("fiber"),
    moisture: per100("moisture") ?? per100("water"),
    ingredientsKnown: ingredients.length > 0,
  };
};

const fromOpff = (p: OpffProduct, origin: Product["origin"], kind?: ProductKind): Product | null => {
  const name = p.product_name?.trim();
  if (!name) return null;
  const brand = p.brands?.split(",")[0]?.trim() || null;
  const full = brand && !name.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${name}` : name;
  const tags = p.categories_tags ?? [];
  return {
    id: `opff-${p.code ?? full}`,
    kind: kind ?? (tags.includes("en:dog-treats") || TREAT_WORDS.test(full) ? "treat" : "food"),
    name: full,
    brand,
    imageUrl: p.image_front_small_url ?? p.image_front_url ?? null,
    store: null,
    price: null,
    origin,
    seed: opffFacts(p, full),
  };
};

const FIELDS = "code,product_name,brands,image_front_small_url,nutriments,ingredients_text,ingredients_text_en,categories_tags";

export const searchDatabase = async (query: string, kind: ProductKind): Promise<Product[]> => {
  const params = new URLSearchParams({ search_terms: query, search_simple: "1", json: "1", page_size: "20", fields: FIELDS });
  const body = await withTimeout(`${OPFF}/cgi/search.pl?${params.toString()}`);
  const products = (body?.products as OpffProduct[] | undefined) ?? [];
  return products
    .map((p) => fromOpff(p, "database"))
    .filter((p): p is Product => p !== null && !NOT_DOG.test(p.name) && p.kind === kind);
};

type Shopping = { product_id?: string; title?: string; thumbnail?: string; source?: string; price?: string };

export const searchWeb = async (query: string, kind: ProductKind): Promise<Product[] | "offline"> => {
  const feed = await serpSearch<Product>(
    { engine: "google_shopping", q: `${query} ${kind === "treat" ? "dog treats" : "dog food"}`, hl: "en", gl: "us" },
    (body) =>
      ((body.shopping_results as Shopping[] | undefined) ?? [])
        .filter((row) => row.title && !NOT_DOG.test(row.title))
        .map((row) => ({
          id: `web-${row.product_id ?? row.title}`,
          kind,
          name: cleanTitle(row.title!),
          brand: null,
          imageUrl: row.thumbnail ?? null,
          store: row.source ?? null,
          price: row.price ?? null,
          origin: "web" as const,
        })),
  );
  if (feed.state === "ready") return [...feed.items];
  return feed.state === "empty" ? [] : "offline";
};

/** Shop titles carry pack sizes and counts; the label search works better without them. */
const cleanTitle = (title: string) =>
  title
    .replace(/[,|-]\s*\d+(\.\d+)?\s*(lb|lbs|oz|kg|g|ct|count|pack|bag)\b.*$/i, "")
    .replace(/\s+\(\d+.*?\)\s*$/, "")
    .trim();

export const keyOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Search shops and the open database together; shop results lead because they have photos owners recognise. */
export const searchProducts = async (query: string, kind: ProductKind): Promise<Lookup<Product[]>> => {
  const terms = query.trim();
  if (terms.length < 2) return { state: "empty" };
  const [web, database] = await Promise.all([searchWeb(terms, kind), searchDatabase(terms, kind).catch(() => [])]);
  const seen = new Set<string>();
  const items = [...(web === "offline" ? [] : web), ...database].filter((item) => {
    const key = keyOf(item.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (items.length) return { state: "ready", items: items.slice(0, 12) };
  return web === "offline" ? { state: "offline" } : { state: "empty" };
};

type Organic = { snippet?: string; title?: string; rich_snippet?: unknown; snippet_highlighted_words?: string[] };

/** Read the label off the web: calories, guaranteed analysis, the AAFCO statement and ingredients. */
export const identifyProduct = async (product: Product): Promise<Facts> => {
  const ask =
    product.kind === "treat"
      ? `${product.name} calories per treat ingredients`
      : `${product.name} calorie content kcal/cup kcal/kg guaranteed analysis AAFCO ingredients`;
  // Gemini reads the real label in parallel; it is the trusted source for ingredients when it finds the product.
  const label = readLabel(product).catch(() => null);
  const feed = await serpSearch<string>({ engine: "google", q: ask, hl: "en", gl: "us", num: "10" }, (body) => {
    const parts: string[] = [];
    const box = body.answer_box as { snippet?: string; answer?: string; list?: string[] } | undefined;
    if (box) parts.push(box.answer ?? "", box.snippet ?? "", ...(box.list ?? []));
    ((body.organic_results as Organic[] | undefined) ?? []).forEach((row) => {
      parts.push(row.snippet ?? "");
      if (row.rich_snippet) parts.push(JSON.stringify(row.rich_snippet));
    });
    return parts.filter(Boolean);
  });
  const web = feed.state === "ready" ? parseLabel(feed.items.join(" . "), product.name) : parseLabel("", product.name);

  let database: Partial<Facts> = {};
  if (!product.seed) {
    const matches = await searchDatabase(product.name, product.kind).catch(() => []);
    const match = matches.find((m) => keyOf(m.name).includes(keyOf(product.name).split(" ").slice(0, 3).join(" ")));
    database = match?.seed ?? {};
  }
  const merged = mergeFacts(product.seed ?? {}, web, database);
  const read = await label;
  return read === null ? merged : read === "missing" ? { ...merged, labelRead: true } : withLabel(merged, read, product.name);
};

/** A barcode scan: the open database first, then a shop search on the number. */
export const lookupBarcode = async (code: string, kind: ProductKind): Promise<Product | null> => {
  const body = await withTimeout(`${OPFF}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  const found = body?.product ? fromOpff({ code, ...(body.product as OpffProduct) }, "barcode", kind) : null;
  if (found) return found;
  const web = await searchWeb(code, kind);
  return web !== "offline" && web[0] ? { ...web[0], origin: "barcode" } : null;
};

/** Products that suit the dog, for when the current one does not. */
export const findAlternatives = async (query: string, kind: ProductKind, exclude: string, limit = 4): Promise<Lookup<Product[]>> => {
  const web = await searchWeb(query, kind);
  if (web === "offline") return { state: "offline" };
  const items = web.filter((p) => keyOf(p.name) !== keyOf(exclude)).slice(0, limit);
  return items.length ? { state: "ready", items } : { state: "empty" };
};

export const manualProduct = (name: string, kind: ProductKind): Product => ({
  id: `manual-${Date.now()}`,
  kind,
  name: name.trim(),
  brand: null,
  imageUrl: null,
  store: null,
  price: null,
  origin: "manual",
});
