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
