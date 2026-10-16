import {
  allowedValuesUsd,
  apiBase,
  beginErrorCode,
  checkRequest,
  petCatalog,
  petMerchantFor,
  redeem,
  settle,
  type OrderOutcome,
  type RedeemDeps,
  type RedemptionRow,
  type TremendousProduct,
} from "../../supabase/functions/pet-rewards/logic";

// Shapes copied from the Tremendous sandbox catalog for the PAWS campaign.
const CATALOG: TremendousProduct[] = [
  { id: "GYRR4ES7O0IL", name: "Chewy®", currency_codes: ["USD"], skus: [{ min: 5, max: 500, currency_code: "USD" }], images: [{ src: "https://img/chewy-card", type: "card" }] },
  { id: "RSQA1YHR6MW0", name: "Petco US", currency_codes: ["USD"], skus: [{ min: 10, max: 200, currency_code: "USD" }] },
  { id: "EIPF8Q00EMM1", name: "1-800-PetSupplies", currency_codes: ["USD"], skus: [{ min: 25, max: 25, currency_code: "USD" }, { min: 50, max: 50, currency_code: "USD" }] },
  { id: "F68HD9KO8YFR", name: "PetSmart", currency_codes: ["USD"], skus: [{ min: 5, max: 500, currency_code: "USD" }] },
  { id: "PH7JYS2ZZ5MV", name: "Walmart® Pet", currency_codes: ["USD"], skus: [{ min: 5, max: 500, currency_code: "USD" }] },
  { id: "AMZN", name: "Amazon.com", currency_codes: ["USD"], skus: [{ min: 1, max: 2000, currency_code: "USD" }] },
  { id: "SBUX", name: "Starbucks", currency_codes: ["USD"], skus: [{ min: 5, max: 100, currency_code: "USD" }] },
  { id: "VISA", name: "Visa Prepaid Card", currency_codes: ["USD"], skus: [{ min: 5, max: 1000, currency_code: "USD" }] },
];
const CAMPAIGN = ["GYRR4ES7O0IL", "RSQA1YHR6MW0", "EIPF8Q00EMM1", "F68HD9KO8YFR", "PH7JYS2ZZ5MV", "AMZN", "SBUX", "VISA"];

describe("pet product filtering", () => {
  it("keeps only verified pet merchants", () => {
    const merchants = petCatalog(CATALOG, CAMPAIGN).map((r) => r.merchant);
    expect(merchants).toEqual(["1-800-PetSupplies", "Chewy", "Petco", "PetSmart"]);
  });

  it("drops general retailers even with pet in the name", () => {
    expect(petMerchantFor({ id: "PH7JYS2ZZ5MV", name: "Walmart® Pet" })).toBeNull();
    expect(petMerchantFor({ id: "AMZN", name: "Amazon.com" })).toBeNull();
  });

  it("drops pet merchants that are not in our campaign", () => {
    expect(petCatalog(CATALOG, ["GYRR4ES7O0IL"]).map((r) => r.productId)).toEqual(["GYRR4ES7O0IL"]);
  });

  it("accepts extra product ids from configuration", () => {
    expect(petMerchantFor({ id: "NEWPET", name: "Paws & Co" }, ["NEWPET"])).toBe("Paws & Co");
  });
});

describe("denominations", () => {
  it("offers fixed denominations exactly as Tremendous lists them", () => {
    expect(allowedValuesUsd(CATALOG[2])).toEqual([25, 50]);
  });

  it("respects a range minimum and our cap", () => {
    expect(allowedValuesUsd(CATALOG[1])).toEqual([10, 15, 20, 25, 30, 40, 50, 75, 100]);
    expect(allowedValuesUsd(CATALOG[0])[0]).toBe(5);
  });

  it("prices in gold server-side", () => {
    const chewy = petCatalog(CATALOG, CAMPAIGN).find((r) => r.merchant === "Chewy")!;
    expect(chewy.goldCosts[chewy.valuesCents.indexOf(1000)]).toBe(1000);
  });

  it("refuses values and products the catalog does not allow", () => {
    const catalog = petCatalog(CATALOG, CAMPAIGN);
    expect(checkRequest(catalog, "RSQA1YHR6MW0", 500)).toEqual({ ok: false, error: "invalid_denomination" });
    expect(checkRequest(catalog, "EIPF8Q00EMM1", 3000)).toEqual({ ok: false, error: "invalid_denomination" });
    expect(checkRequest(catalog, "AMZN", 1000)).toEqual({ ok: false, error: "reward_unavailable" });
    expect(checkRequest(catalog, "GYRR4ES7O0IL", "1000")).toEqual({ ok: false, error: "invalid_denomination" });
    const ok = checkRequest(catalog, "GYRR4ES7O0IL", 2500);
    expect(ok.ok && ok.goldCost).toBe(2500);
  });
});

describe("configuration", () => {
  it("works with or without the /api/v2 suffix", () => {
    expect(apiBase("https://testflight.tremendous.com")).toBe("https://testflight.tremendous.com/api/v2");
    expect(apiBase("https://www.tremendous.com/api/v2/")).toBe("https://www.tremendous.com/api/v2");
    expect(apiBase("")).toBeNull();
  });
});

/**
 * A stand-in for the database functions with the same guarantees: one row per request key, coins taken with the row,
 * one pending redemption per dog, refunds once.
 */
const fakeWorld = (balance: number, outcomes: OrderOutcome[]) => {
  const rows = new Map<string, RedemptionRow & { requestKey: string }>();
  const orders: string[] = [];
  const world = { balance, rows, orders, logs: [] as string[] };
  const deps: RedeemDeps = {
    begin: async (input) => {
      const existing = [...rows.values()].find((r) => r.requestKey === input.requestKey);
      if (existing) return existing;
      if ([...rows.values()].some((r) => r.status === "pending")) throw new Error("redemption_in_progress");
      if (world.balance < input.goldCost) throw new Error("insufficient_gold_balance");
      world.balance -= input.goldCost;
      const id = `r${rows.size + 1}`;
      const row = { id, requestKey: input.requestKey, status: "pending" as const, external_id: `paws-pet-${id}`, product_id: input.productId, merchant: input.merchant, value_cents: input.valueCents, gold_cost: input.goldCost, provider_reward_id: null };
      rows.set(id, row);
      return row;
    },
    complete: async (id, _orderId, rewardId) => {
      const row = rows.get(id)!;
      rows.set(id, { ...row, status: "issued", provider_reward_id: rewardId });
    },
    fail: async (id) => {
      const row = rows.get(id)!;
      if (row.status !== "pending") return;
      rows.set(id, { ...row, status: "failed" });
      world.balance += row.gold_cost;
    },
    order: async (row) => {
      orders.push(row.external_id);
      return outcomes.shift() ?? { kind: "unknown", code: "none" };
    },
    log: (event) => world.logs.push(event),
  };
  return { world, deps };
};

const chewy = () => {
  const checked = checkRequest(petCatalog(CATALOG, CAMPAIGN), "GYRR4ES7O0IL", 1000);
  if (!checked.ok) throw new Error("setup");
  return checked;
};

describe("redemption", () => {
  it("issues a card and takes the coins", async () => {
    const { world, deps } = fakeWorld(5000, [{ kind: "issued", orderId: "O1", rewardId: "R1", link: "https://claim" }]);
    const result = await redeem(deps, { requestKey: "key-aaaaaaaa", ...chewy() });
    expect(result).toEqual({ ok: true, status: "issued", redemptionId: "r1", link: "https://claim" });
    expect(world.balance).toBe(4000);
  });

  it("refuses when the balance is short and takes nothing", async () => {
    const { world, deps } = fakeWorld(500, []);
    const result = await redeem(deps, { requestKey: "key-bbbbbbbb", ...chewy() });
    expect(result).toEqual({ ok: false, error: "insufficient_balance" });
    expect(world.balance).toBe(500);
    expect(world.orders).toHaveLength(0);
  });

  it("never orders twice for a repeated request", async () => {
    const { world, deps } = fakeWorld(5000, [{ kind: "issued", orderId: "O1", rewardId: "R1", link: null }]);
    await redeem(deps, { requestKey: "key-cccccccc", ...chewy() });
    const again = await redeem(deps, { requestKey: "key-cccccccc", ...chewy() });
    expect(again).toEqual({ ok: true, status: "issued", redemptionId: "r1", link: null });
    expect(world.orders).toHaveLength(1);
    expect(world.balance).toBe(4000);
  });

  it("blocks a second redemption while one is in flight", async () => {
    const { deps } = fakeWorld(5000, [{ kind: "unknown", code: "timeout" }]);
    await redeem(deps, { requestKey: "key-dddddddd", ...chewy() });
    const second = await redeem(deps, { requestKey: "key-eeeeeeee", ...chewy() });
    expect(second).toEqual({ ok: false, error: "redemption_in_progress" });
  });

  it("gives the coins back when Tremendous refuses", async () => {
    const { world, deps } = fakeWorld(5000, [{ kind: "rejected", code: "http_422" }]);
    const result = await redeem(deps, { requestKey: "key-ffffffff", ...chewy() });
    expect(result).toEqual({ ok: false, error: "issue_failed", redemptionId: "r1" });
    expect(world.balance).toBe(5000);
    expect(world.rows.get("r1")!.status).toBe("failed");
  });

  it("keeps the coins held when the outcome is unknown, then settles with the same external id", async () => {
    const { world, deps } = fakeWorld(5000, [{ kind: "unknown", code: "timeout" }, { kind: "issued", orderId: "O1", rewardId: "R1", link: null }]);
    const first = await redeem(deps, { requestKey: "key-gggggggg", ...chewy() });
    expect(first).toEqual({ ok: true, status: "pending", redemptionId: "r1" });
    expect(world.balance).toBe(4000);
    const resumed = await settle(deps, world.rows.get("r1")!);
    expect(resumed.ok && resumed.status).toBe("issued");
    expect(world.orders).toEqual(["paws-pet-r1", "paws-pet-r1"]);
  });

  it("treats a thrown network error as unknown, not as a failure", async () => {
    const { world, deps } = fakeWorld(5000, []);
    deps.order = async () => {
      throw new Error("socket hang up");
    };
    const result = await redeem(deps, { requestKey: "key-hhhhhhhh", ...chewy() });
    expect(result.ok && result.status).toBe("pending");
    expect(world.balance).toBe(4000);
  });

  it("maps database refusals to app errors", () => {
    expect(beginErrorCode("insufficient_gold_balance")).toBe("insufficient_balance");
    expect(beginErrorCode("dog_not_found")).toBe("unauthorized");
    expect(beginErrorCode("something else")).toBe("server_error");
  });
});
