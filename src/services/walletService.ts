import { getClientOrThrow, throwIfError } from "@/services/serviceUtils";
import type { WalletSummary } from "@/types/domain";

export const getWalletSummary = async (dogId: string): Promise<WalletSummary> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("get_wallet_summary", { target_dog_id: dogId });
  throwIfError(error);
  const row = data?.[0];

  return {
    silverBalance: row?.silver_balance ?? 0,
    goldBalance: row?.gold_balance ?? 0,
  };
};

export type WalletEntry = { id: string; currency: "gold" | "silver"; amount: number; reason: string; at: string };

/** The latest coin movements for a dog, newest first. */
export const getWalletEntries = async (dogId: string, limit = 40): Promise<WalletEntry[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("wallet_transactions")
    .select("id, currency, amount, reason, created_at")
    .eq("dog_id", dogId)
    .order("created_at", { ascending: false })
    .limit(limit);
  throwIfError(error);
  return ((data ?? []) as { id: string; currency: string; amount: number; reason: string; created_at: string }[]).map((row) => ({
    id: row.id,
    currency: row.currency === "gold_coin" ? "gold" : "silver",
    amount: row.amount,
    reason: row.reason,
    at: row.created_at,
  }));
};
