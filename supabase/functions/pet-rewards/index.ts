import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

import {
  DEFAULT_PRICING,
  apiBase,
  checkRequest,
  petCatalog,
  redeem,
  settle,
  type OrderOutcome,
  type PetReward,
  type Pricing,
  type RedemptionRow,
  type TremendousProduct,
} from "./logic.ts";

/**
 * Pet Shop gift cards. The only place that talks to Tremendous; the app never sees the key.
 *
 * POST { action: "catalog", dogId }                                  pet gift cards, prices, balance, eligibility
 * POST { action: "redeem", dogId, productId, valueCents, requestKey } redeem coins for a card, idempotent per requestKey
 * POST { action: "resume", redemptionId }                            settle a redemption left pending by a timeout
 * POST { action: "claim", redemptionId }                             a fresh claim link for an issued card
 */

const API_KEY = Deno.env.get("GIFT_CARD_API_KEY");
const BASE = apiBase(Deno.env.get("GIFT_CARD_BASE_URL"));
const CAMPAIGN_ID = Deno.env.get("GIFT_CARD_CAMPAIGN_ID");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const PRICING: Pricing = {
  goldPerUsd: Number(Deno.env.get("PET_REWARD_GOLD_PER_USD")) || DEFAULT_PRICING.goldPerUsd,
  maxUsd: Number(Deno.env.get("PET_REWARD_MAX_USD")) || DEFAULT_PRICING.maxUsd,
};
/** Extra Tremendous product ids to treat as pet rewards, comma separated, for brands the name list does not cover. */
const EXTRA_IDS = (Deno.env.get("PET_REWARD_PRODUCT_IDS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const FUNDING_SOURCE = Deno.env.get("GIFT_CARD_FUNDING_SOURCE_ID") ?? "balance";
const TIMEOUT_MS = 20000;
// Gift card brands change rarely; a warm function reuses the list for hours instead of asking Tremendous each time.
const CATALOG_TTL_MS = 6 * 60 * 60 * 1000;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

/** Never log the key, claim links or anything a person could redeem. */
const log = (event: string, detail: Record<string, unknown> = {}) => console.error(`[pet-rewards] ${event}`, JSON.stringify(detail));

// ---------- Tremendous ----------

const tremendous = async (path: string, init: RequestInit = {}) => {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: abort.signal,
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json", Accept: "application/json", ...(init.headers ?? {}) },
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body: body as Record<string, any> };
  } finally {
    clearTimeout(timer);
  }
};

let cached: { at: number; rewards: PetReward[] } | null = null;

const loadCatalog = async (): Promise<PetReward[]> => {
  if (cached && Date.now() - cached.at < CATALOG_TTL_MS) return cached.rewards;
  const [products, campaign] = await Promise.all([
    tremendous("/products?country=US"),
    CAMPAIGN_ID ? tremendous(`/campaigns/${CAMPAIGN_ID}`) : Promise.resolve(null),
  ]);
  if (products.status !== 200) throw new Error(`products_${products.status}`);
  if (campaign && campaign.status !== 200) throw new Error(`campaign_${campaign.status}`);
  const campaignIds: string[] | null = campaign ? (campaign.body.campaign?.products ?? []) : null;
  const rewards = petCatalog((products.body.products ?? []) as TremendousProduct[], campaignIds, PRICING, EXTRA_IDS);
  cached = { at: Date.now(), rewards };
  return rewards;
};

const createOrder = (recipient: { name: string; email: string }) => async (row: RedemptionRow): Promise<OrderOutcome> => {
  let res: { status: number; body: Record<string, any> };
  try {
    res = await tremendous("/orders", {
      method: "POST",
      body: JSON.stringify({
        // The same external_id always returns the first order instead of creating another one.
        external_id: row.external_id,
        payment: { funding_source_id: FUNDING_SOURCE },
        reward: {
          campaign_id: CAMPAIGN_ID,
          products: [row.product_id],
          value: { denomination: row.value_cents / 100, currency_code: "USD" },
          recipient,
          delivery: { method: "LINK" },
        },
      }),
    });
  } catch {
    return { kind: "unknown", code: "network" };
  }
  if (res.status === 200 || res.status === 201) {
    const order = res.body.order ?? {};
    const reward = (order.rewards ?? [])[0] ?? {};
    if (String(order.status ?? "").toUpperCase() === "FAILED") return { kind: "rejected", code: "order_failed" };
    return { kind: "issued", orderId: String(order.id), rewardId: reward.id ? String(reward.id) : null, link: reward.delivery?.link ?? null };
  }
  if (res.status === 429 || res.status >= 500) return { kind: "unknown", code: `http_${res.status}` };
  return { kind: "rejected", code: `http_${res.status}` };
};

// ---------- Database (service role; the RPCs are not callable by users) ----------

const db = (admin: SupabaseClient, ownerId: string, dogId: string) => ({
  begin: async (input: { requestKey: string; productId: string; merchant: string; valueCents: number; goldCost: number }) => {
    const { data, error } = await admin.rpc("begin_pet_reward_redemption", {
      p_owner_id: ownerId,
      p_dog_id: dogId,
      p_request_key: input.requestKey,
      p_product_id: input.productId,
      p_merchant: input.merchant,
      p_value_cents: input.valueCents,
      p_gold_cost: input.goldCost,
    });
    if (error) throw new Error(error.message);
    return data as RedemptionRow;
  },
  complete: async (id: string, orderId: string, rewardId: string | null) => {
    const { error } = await admin.rpc("complete_pet_reward_redemption", { p_id: id, p_order_id: orderId, p_reward_id: rewardId });
    if (error) log("complete_failed", { redemptionId: id, message: error.message });
  },
  fail: async (id: string, code: string) => {
    const { error } = await admin.rpc("fail_pet_reward_redemption", { p_id: id, p_code: code });
    if (error) log("refund_failed", { redemptionId: id, message: error.message });
  },
});

// ---------- Handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!API_KEY || !BASE || !CAMPAIGN_ID) {
    log("unconfigured", { base: Boolean(BASE), campaign: Boolean(CAMPAIGN_ID), key: Boolean(API_KEY) });
    return json({ ok: false, error: "unconfigured" });
  }

  // Who is asking, from their own token.
  const auth = req.headers.get("Authorization") ?? "";
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data: who } = await asUser.auth.getUser();
  const user = who?.user;
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  const ownDog = async (dogId: unknown) => {
    if (typeof dogId !== "string") return false;
    const { data } = await admin.from("dogs").select("id").eq("id", dogId).eq("owner_id", user.id).maybeSingle();
    return Boolean(data);
  };
  // Real money needs a real account: anonymous sessions can browse but not redeem.
  const eligible = Boolean(user.email) && !user.is_anonymous;
  const recipient = { name: (user.user_metadata?.full_name as string) || (user.user_metadata?.name as string) || "PAWS member", email: user.email ?? "" };

  try {
    if (body.action === "catalog") {
      if (!(await ownDog(body.dogId))) return json({ ok: false, error: "unauthorized" }, 403);
      const rewards = await loadCatalog();
      const { data: wallet } = await admin.from("dog_wallets").select("gold_balance").eq("dog_id", body.dogId as string).maybeSingle();
      return json({ ok: true, rewards, goldBalance: wallet?.gold_balance ?? 0, goldPerUsd: PRICING.goldPerUsd, eligible });
    }

    if (body.action === "redeem") {
      if (!eligible) return json({ ok: false, error: "account_required" });
      if (!(await ownDog(body.dogId))) return json({ ok: false, error: "unauthorized" }, 403);
      const requestKey = typeof body.requestKey === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(body.requestKey) ? body.requestKey : null;
      if (!requestKey) return json({ ok: false, error: "bad_request" }, 400);
      const checked = checkRequest(await loadCatalog(), body.productId, body.valueCents);
      if (!checked.ok) return json({ ok: false, error: checked.error });
      const result = await redeem(
        { ...db(admin, user.id, body.dogId as string), order: createOrder(recipient), log },
        { requestKey, reward: checked.reward, valueCents: checked.valueCents, goldCost: checked.goldCost },
      );
      return json(result);
    }

    if (body.action === "resume" || body.action === "claim") {
      const { data: row } = await admin
        .from("pet_reward_redemptions")
        .select("id, status, external_id, product_id, merchant, value_cents, gold_cost, provider_reward_id, owner_id, dog_id")
        .eq("id", String(body.redemptionId ?? ""))
        .eq("owner_id", user.id)
        .maybeSingle();
      if (!row) return json({ ok: false, error: "not_found" }, 404);

      if (body.action === "resume") {
        if (row.status !== "pending") return json({ ok: true, status: row.status, redemptionId: row.id, link: null });
        return json(await settle({ ...db(admin, user.id, row.dog_id), order: createOrder(recipient), log }, row as RedemptionRow));
      }

      // A fresh link each time, so nothing claimable is stored with us.
      if (row.status !== "issued" || !row.provider_reward_id) return json({ ok: false, error: "claim_unavailable" });
      const res = await tremendous(`/rewards/${row.provider_reward_id}/generate_link`, { method: "POST", body: "{}" });
      const link = res.body.reward?.link;
      if ((res.status === 200 || res.status === 201) && typeof link === "string") return json({ ok: true, link });
      log("claim_failed", { redemptionId: row.id, status: res.status });
      return json({ ok: false, error: "claim_unavailable" });
    }

    return json({ ok: false, error: "bad_request" }, 400);
  } catch (error) {
    log("unexpected", { action: body.action, message: error instanceof Error ? error.message : "unknown" });
    return json({ ok: false, error: "provider_unavailable" });
  }
});
