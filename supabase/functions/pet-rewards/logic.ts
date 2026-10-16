/**
 * Pet Shop gift cards: the rules, kept free of Deno and network code so they run in the edge function and in Jest.
 *
 * Money rules live here and only here. The client sends a product id and a value; everything else (is it a pet
 * merchant, is the value allowed, what does it cost in gold coins) is decided on the server from Tremendous's own
 * catalog and these rules.
 */

// ---------- Which merchants count as pet rewards ----------

/**
 * Verified pet merchants. A Tremendous product is offered only if its name matches one of these keys exactly after
 * normalising (case, punctuation and trademark marks removed), and it is in our campaign. To add a brand, add a line.
 * Matching is exact on purpose: "Walmart Pet" is a Walmart card and stays out.
 */
export const PET_MERCHANTS: Readonly<Record<string, string>> = {
  chewy: "Chewy",
  petco: "Petco",
  petsmart: "PetSmart",
  "1800petsupplies": "1-800-PetSupplies",
  petsuppliesplus: "Pet Supplies Plus",
  petland: "Petland",
  barkbox: "BarkBox",
  bark: "BARK",
  rover: "Rover",
  wag: "Wag!",
  petfoodexpress: "Pet Food Express",
  petsense: "Petsense",
};

export const normaliseName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/\b(us|usa|gift card|egift|e-gift)\b/g, "")
    .replace(/[^a-z0-9]/g, "");

/** The display name for a pet merchant, or null if the product is not one. Explicit product ids win. */
export const petMerchantFor = (product: { id: string; name: string }, extraIds: readonly string[] = []): string | null => {
  const known = PET_MERCHANTS[normaliseName(product.name)];
  if (known) return known;
  if (extraIds.includes(product.id)) return product.name.replace(/[®™]/g, "").trim();
  return null;
};

// ---------- Tremendous shapes we read ----------

export type Sku = { min: number; max: number; currency_code?: string };
export type TremendousProduct = {
  id: string;
  name: string;
  category?: string;
  currency_codes?: string[];
  skus?: Sku[];
  images?: { src: string; type: string }[];
  countries?: { abbr: string }[];
};

// ---------- What the app sees ----------

export type PetReward = {
  productId: string;
  merchant: string;
  imageUrl: string | null;
  logoUrl: string | null;
  currency: "USD";
  /** Every value the app may offer, in cents, already checked against Tremendous's limits and ours. */
  valuesCents: number[];
  minCents: number;
  maxCents: number;
  /** Gold coins for each entry in valuesCents, same order. */
  goldCosts: number[];
};

export type Pricing = {
  /** Gold coins for one US dollar of gift card. */
  goldPerUsd: number;
  /** The largest single redemption we allow, in dollars, whatever Tremendous would accept. */
  maxUsd: number;
};

export const DEFAULT_PRICING: Pricing = { goldPerUsd: 100, maxUsd: 100 };

/** The values offered on a range card. Only those inside a Tremendous sku (and our cap) are shown. */
const LADDER_USD = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 250, 500];

const usdSkus = (product: TremendousProduct) => (product.skus ?? []).filter((s) => !s.currency_code || s.currency_code === "USD");

const fitsSku = (usd: number, skus: readonly Sku[]) => skus.some((s) => usd >= s.min - 1e-9 && usd <= s.max + 1e-9);

export const allowedValuesUsd = (product: TremendousProduct, pricing: Pricing = DEFAULT_PRICING): number[] => {
  const skus = usdSkus(product);
  if (!skus.length) return [];
  const values = new Set<number>();
  for (const sku of skus) {
    // Fixed denominations (min equals max) are offered as they are; ranges get the ladder steps that fall inside.
    if (Math.abs(sku.max - sku.min) < 1e-9) values.add(sku.min);
    else {
      for (const step of LADDER_USD) if (step >= sku.min && step <= sku.max) values.add(step);
      if (!LADDER_USD.some((step) => step >= sku.min && step <= sku.max)) values.add(sku.min);
    }
  }
  return [...values].filter((usd) => usd > 0 && usd <= pricing.maxUsd && Number.isInteger(usd * 100)).sort((a, b) => a - b);
};

export const goldCostFor = (valueCents: number, pricing: Pricing = DEFAULT_PRICING) => Math.round((valueCents / 100) * pricing.goldPerUsd);

/** Turn Tremendous's catalog into the pet rewards we offer: pet merchants, in our campaign, USD, with a usable value. */
export const petCatalog = (
  products: readonly TremendousProduct[],
  campaignProductIds: readonly string[] | null,
  pricing: Pricing = DEFAULT_PRICING,
  extraIds: readonly string[] = [],
): PetReward[] => {
  const inCampaign = campaignProductIds ? new Set(campaignProductIds) : null;
  const rewards: PetReward[] = [];
  for (const product of products) {
    const merchant = petMerchantFor(product, extraIds);
    if (!merchant) continue;
    if (inCampaign && !inCampaign.has(product.id)) continue;
    if (product.currency_codes && !product.currency_codes.includes("USD")) continue;
    const values = allowedValuesUsd(product, pricing);
    if (!values.length) continue;
    const cents = values.map((usd) => Math.round(usd * 100));
    rewards.push({
      productId: product.id,
      merchant,
      imageUrl: product.images?.find((i) => i.type === "card")?.src ?? null,
      logoUrl: product.images?.find((i) => i.type === "logo")?.src ?? null,
      currency: "USD",
      valuesCents: cents,
      minCents: cents[0],
      maxCents: cents[cents.length - 1],
      goldCosts: cents.map((c) => goldCostFor(c, pricing)),
    });
  }
  return rewards.sort((a, b) => a.merchant.localeCompare(b.merchant));
};

/** Server-side check of what the client asked for. Returns the reward and its true cost, or why it is refused. */
export const checkRequest = (
  catalog: readonly PetReward[],
  productId: unknown,
  valueCents: unknown,
): { ok: true; reward: PetReward; valueCents: number; goldCost: number } | { ok: false; error: "reward_unavailable" | "invalid_denomination" } => {
  if (typeof productId !== "string") return { ok: false, error: "reward_unavailable" };
  const reward = catalog.find((r) => r.productId === productId);
  if (!reward) return { ok: false, error: "reward_unavailable" };
  if (typeof valueCents !== "number" || !Number.isInteger(valueCents)) return { ok: false, error: "invalid_denomination" };
  const index = reward.valuesCents.indexOf(valueCents);
  if (index < 0) return { ok: false, error: "invalid_denomination" };
  return { ok: true, reward, valueCents, goldCost: reward.goldCosts[index] };
};

// ---------- Redemption, with the database and Tremendous passed in so it can be tested ----------

export type RedemptionRow = {
  id: string;
  status: "pending" | "issued" | "failed" | "cancelled";
  external_id: string;
  product_id: string;
  merchant: string;
  value_cents: number;
  gold_cost: number;
  provider_reward_id: string | null;
};

export type OrderOutcome =
  /** Tremendous accepted the order. link is present for LINK delivery once the reward exists. */
  | { kind: "issued"; orderId: string; rewardId: string | null; link: string | null }
  /** Tremendous refused it (bad product, value, funds): nothing was issued, so coins go back. */
  | { kind: "rejected"; code: string }
  /** We could not tell (timeout, 5xx, network): leave it pending; retrying with the same external_id is safe. */
  | { kind: "unknown"; code: string };

export type RedeemDeps = {
  /** Creates the pending row and takes the coins in one database transaction, or returns the row for this request key. */
  begin: (input: { requestKey: string; productId: string; merchant: string; valueCents: number; goldCost: number }) => Promise<RedemptionRow>;
  complete: (id: string, orderId: string, rewardId: string | null) => Promise<void>;
  /** Marks it failed and gives the coins back. */
  fail: (id: string, code: string) => Promise<void>;
  order: (row: RedemptionRow) => Promise<OrderOutcome>;
  log: (event: string, detail: Record<string, unknown>) => void;
};

export type RedeemResult =
  | { ok: true; status: "issued"; redemptionId: string; link: string | null }
  | { ok: true; status: "pending"; redemptionId: string }
  | { ok: false; error: string; redemptionId?: string };

/** Map database errors raised by begin_pet_reward_redemption to codes the app understands. */
export const beginErrorCode = (message: string) =>
  /insufficient_gold_balance/.test(message)
    ? "insufficient_balance"
    : /redemption_in_progress/.test(message)
      ? "redemption_in_progress"
      : /dog_not_found|Dog not found/.test(message)
        ? "unauthorized"
        : "server_error";

export const redeem = async (
  deps: RedeemDeps,
  request: { requestKey: string; reward: PetReward; valueCents: number; goldCost: number },
): Promise<RedeemResult> => {
  let row: RedemptionRow;
  try {
    row = await deps.begin({
      requestKey: request.requestKey,
      productId: request.reward.productId,
      merchant: request.reward.merchant,
      valueCents: request.valueCents,
      goldCost: request.goldCost,
    });
  } catch (error) {
    const code = beginErrorCode(error instanceof Error ? error.message : String(error));
    deps.log("begin_failed", { code });
    return { ok: false, error: code };
  }

  // A replay of a request we already settled: report what happened, never order again.
  if (row.status === "issued") return { ok: true, status: "issued", redemptionId: row.id, link: null };
  if (row.status === "failed" || row.status === "cancelled") return { ok: false, error: "issue_failed", redemptionId: row.id };

  return settle(deps, row);
};

/** Push a pending redemption to a final state. Safe to call again: Tremendous dedupes on external_id. */
export const settle = async (deps: Pick<RedeemDeps, "complete" | "fail" | "order" | "log">, row: RedemptionRow): Promise<RedeemResult> => {
  let outcome: OrderOutcome;
  try {
    outcome = await deps.order(row);
  } catch {
    outcome = { kind: "unknown", code: "network" };
  }

  if (outcome.kind === "issued") {
    await deps.complete(row.id, outcome.orderId, outcome.rewardId);
    return { ok: true, status: "issued", redemptionId: row.id, link: outcome.link };
  }
  if (outcome.kind === "rejected") {
    deps.log("order_rejected", { redemptionId: row.id, code: outcome.code });
    await deps.fail(row.id, outcome.code);
    return { ok: false, error: "issue_failed", redemptionId: row.id };
  }
  deps.log("order_unknown", { redemptionId: row.id, code: outcome.code });
  return { ok: true, status: "pending", redemptionId: row.id };
};

/** Tremendous's base URL from config, with or without the /api/v2 suffix. */
export const apiBase = (configured: string | undefined) => {
  const base = (configured ?? "").trim().replace(/\/+$/, "");
  if (!base) return null;
  return /\/api\/v2$/.test(base) ? base : `${base}/api/v2`;
};
