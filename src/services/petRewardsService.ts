import { createIdempotencyKey, getClientOrThrow, throwIfError } from "@/services/serviceUtils";

/**
 * Pet Shop gift cards. Every call goes through the pet-rewards edge function, which holds the Tremendous key and
 * decides prices and allowed values. The app only ever says which card and which value it would like.
 */

export type PetReward = {
  productId: string;
  merchant: string;
  imageUrl: string | null;
  logoUrl: string | null;
  currency: "USD";
  valuesCents: number[];
  minCents: number;
  maxCents: number;
  goldCosts: number[];
};

export type PetCatalog = { rewards: PetReward[]; goldBalance: number; goldPerUsd: number; eligible: boolean };

export type RedemptionStatus = "pending" | "issued" | "failed" | "cancelled";

export type Redemption = {
  id: string;
  merchant: string;
  productId: string;
  valueCents: number;
  goldCost: number;
  status: RedemptionStatus;
  createdAt: string;
};

export type RedeemOutcome =
  | { status: "issued"; redemptionId: string; link: string | null }
  | { status: "pending"; redemptionId: string };

/** The codes the server can answer with. The screen turns each into plain words. */
export type PetRewardErrorCode =
  | "unauthorized"
  | "account_required"
  | "reward_unavailable"
  | "invalid_denomination"
  | "insufficient_balance"
  | "redemption_in_progress"
  | "issue_failed"
  | "claim_unavailable"
  | "provider_unavailable"
  | "unconfigured"
  | "not_found"
  | "network";

export class PetRewardError extends Error {
  constructor(public code: PetRewardErrorCode) {
    super(code);
  }
}

/** Long enough for a cold start and the gift card provider; past this the screen says so instead of spinning. */
const TIMEOUT_MS = 15000;

const call = async <T>(body: Record<string, unknown>): Promise<T> => {
  const client = getClientOrThrow();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  const { data, error } = await client.functions.invoke("pet-rewards", { body, signal: abort.signal }).finally(() => clearTimeout(timer));
  if (error) {
    // Non-2xx replies still carry the reason in their body.
    const context = (error as { context?: Response }).context;
    const payload = context && typeof context.json === "function" ? await context.json().catch(() => null) : null;
    // A reply from the server (any status) is a server problem; only a request that never got an answer is "network".
    throw new PetRewardError(context ? ((payload?.error as PetRewardErrorCode) ?? "provider_unavailable") : "network");
  }
  if (!data?.ok) throw new PetRewardError((data?.error as PetRewardErrorCode) ?? "provider_unavailable");
  return data as T;
};

export const getPetCatalog = (dogId: string) => call<PetCatalog & { ok: true }>({ action: "catalog", dogId });

/** One key per confirmed redemption: reuse it for retries so a card can never be issued twice. */
export const newRedeemKey = () => createIdempotencyKey("pet-reward").replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80);

export const redeemPetReward = (input: { dogId: string; productId: string; valueCents: number; requestKey: string }) =>
  call<RedeemOutcome & { ok: true }>({ action: "redeem", ...input });

export const resumeRedemption = (redemptionId: string) => call<RedeemOutcome & { ok: true }>({ action: "resume", redemptionId });

export const claimLink = async (redemptionId: string) => (await call<{ ok: true; link: string }>({ action: "claim", redemptionId })).link;

export const getRedemptions = async (): Promise<Redemption[]> => {
  const client = getClientOrThrow() as unknown as {
    from: (table: string) => {
      select: (columns: string) => { order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown[] | null; error: unknown }> };
    };
  };
  const { data, error } = await client
    .from("pet_reward_redemptions")
    .select("id, merchant, product_id, value_cents, gold_cost, status, created_at")
    .order("created_at", { ascending: false });
  throwIfError(error as never);
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    merchant: String(row.merchant),
    productId: String(row.product_id),
    valueCents: Number(row.value_cents),
    goldCost: Number(row.gold_cost),
    status: row.status as RedemptionStatus,
    createdAt: String(row.created_at),
  }));
};
