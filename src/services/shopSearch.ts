import { serpSearch, type Feed } from "@/services/serpApi";

export type Offer = {
  id: string;
  title: string;
  price: string;
  wasPrice: string | null;
  tag: string | null;
  merchant: string;
  merchantIcon: string | null;
  delivery: string | null;
  rating: number | null;
  reviews: number | null;
  thumbnail: string;
  fallbackThumbnail: string | null;
  link: string;
};

export const KIT_QUERY: Record<string, { term: string; broad: string }> = {
  bath: { term: "dog oatmeal shampoo", broad: "dog shampoo" },
  nail_trim: { term: "dog nail clippers", broad: "dog nail clippers" },
  ear_clean: { term: "dog ear cleaner", broad: "dog ear cleaner" },
  teeth_brush: { term: "dog toothpaste", broad: "dog toothbrush" },
  haircut: { term: "dog grooming clippers", broad: "dog clippers" },
  flea_tick: { term: "flea comb dog", broad: "flea comb" },
};

const PREFERRED = ["chewy", "petco", "petsmart", "walmart", "target"];

const cleanMerchant = (raw: string) =>
  raw
    .split(" - ")[0]
    .replace(/\.(com|co\.uk|eus|net|org)$/i, "")
    .trim();

const rankOf = (merchant: string) => {
  const index = PREFERRED.indexOf(merchant.toLowerCase());
  return index === -1 ? PREFERRED.length : index;
};

type Raw = {
  product_id?: string;
  position?: number;
  title?: string;
  price?: string;
  old_price?: string;
  tag?: string;
  source?: string;
  source_icon?: string;
  delivery?: string;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
  thumbnails?: string[];
  serpapi_thumbnail?: string;
  product_link?: string;
};

const toOffers = (body: Record<string, unknown>): readonly Offer[] => {
  const rows = (body.shopping_results as Raw[] | undefined) ?? [];

  const mapped = rows
    .filter((row) => (row.thumbnail || row.serpapi_thumbnail) && row.price && row.title)
    .map((row, index) => ({
      id: row.product_id ?? `${index}`,
      title: row.title as string,
      price: row.price as string,
      wasPrice: row.old_price ?? null,
      tag: row.tag ?? null,
      merchant: cleanMerchant(row.source ?? ""),
      merchantIcon: row.source_icon ?? null,
      delivery: row.delivery ?? null,
      rating: typeof row.rating === "number" ? row.rating : null,
      reviews: typeof row.reviews === "number" ? row.reviews : null,
      thumbnail: (row.thumbnail ?? row.serpapi_thumbnail) as string,
      fallbackThumbnail:
        row.serpapi_thumbnail && row.serpapi_thumbnail !== row.thumbnail
          ? row.serpapi_thumbnail
          : (row.thumbnails?.find((url) => url !== row.thumbnail) ?? null),
      link: row.product_link ?? "",
      position: row.position ?? index,
    }));

  const seen = new Set<string>();
  const unique = mapped.filter((offer) => {
    const signature = `${offer.title.toLowerCase()}|${offer.price}`;
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });

  return unique
    .sort(
      (left, right) =>
        rankOf(left.merchant) - rankOf(right.merchant) || left.position - right.position,
    )
    .slice(0, 12)
    .map(({ position: _position, ...offer }) => offer);
};

const search = (query: string) =>
  serpSearch<Offer>(
    { engine: "google_shopping", q: query, hl: "en", gl: "us" },
    toOffers,
  );

export const findKit = async (jobKey: string): Promise<Feed<Offer>> => {
  const query = KIT_QUERY[jobKey];
  if (!query) return { state: "empty" };

  const first = await search(query.term);
  if (first.state !== "empty" || query.broad === query.term) return first;
  return search(query.broad);
};
