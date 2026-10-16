import { serpSearch, type Feed } from "@/services/serpApi";

/**
 * Browsing the pet stores whose gift cards PAWS offers. Items come from Google Shopping (through the serp-search
 * function) filtered to the one store, and each opens on that store's own site.
 */

export type StoreItem = { id: string; title: string; price: string | null; amount: number | null; imageUrl: string | null; url: string };

type StoreRule = { match: RegExp; query: string; search?: (title: string) => string };

/** Keyed by the merchant name the Pet Shop shows. A store without a search page opens Google's listing instead. */
const STORES: Record<string, StoreRule> = {
  Chewy: { match: /chewy/i, query: "Chewy", search: (t) => `https://www.chewy.com/s?query=${encodeURIComponent(t)}` },
  Petco: { match: /petco/i, query: "Petco", search: (t) => `https://www.petco.com/shop/en/petcostore/search?query=${encodeURIComponent(t)}` },
  PetSmart: { match: /petsmart/i, query: "PetSmart", search: (t) => `https://www.petsmart.com/search/?q=${encodeURIComponent(t)}` },
  "1-800-PetSupplies": { match: /1-?800-?pet ?supplies/i, query: "1-800-PetSupplies" },
};

export const browsable = (merchant: string) => Boolean(STORES[merchant]);

export const CATEGORIES = [
  { key: "food", label: "Food", query: "dog food" },
  { key: "treats", label: "Treats", query: "dog treats" },
  { key: "toys", label: "Toys", query: "dog toys" },
  { key: "beds", label: "Beds", query: "dog bed" },
  { key: "grooming", label: "Grooming", query: "dog grooming" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

type Shopping = { product_id?: string; title?: string; price?: string; extracted_price?: number; thumbnail?: string; source?: string; product_link?: string; link?: string };

export const browseStore = async (merchant: string, category: CategoryKey): Promise<Feed<StoreItem>> => {
  const store = STORES[merchant];
  if (!store) return { state: "empty" };
  const what = CATEGORIES.find((c) => c.key === category)?.query ?? "dog";
  return serpSearch<StoreItem>({ engine: "google_shopping", q: `${store.query} ${what}`, hl: "en", gl: "us" }, (body) =>
    ((body.shopping_results as Shopping[] | undefined) ?? [])
      .filter((row) => row.title && row.source && store.match.test(row.source))
      .map((row) => ({
        id: row.product_id ?? row.title!,
        title: row.title!,
        price: row.price ?? null,
        amount: typeof row.extracted_price === "number" ? row.extracted_price : null,
        imageUrl: row.thumbnail ?? null,
        url: store.search?.(row.title!) ?? row.link ?? row.product_link ?? "",
      }))
      .filter((item) => item.url),
  );
};
