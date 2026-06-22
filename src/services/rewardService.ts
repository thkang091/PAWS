import {
  createIdempotencyKey,
  getClientOrThrow,
  mapRedemption,
  mapReward,
  throwIfError,
} from "@/services/serviceUtils";
import type { RewardDefinition, RewardRedemption, WalletSummary } from "@/types/domain";
import type { Json, RewardRedemptionRow } from "@/types/database";

export const getRewardCatalog = async (): Promise<RewardDefinition[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("reward_catalog").select("*").order("is_active", { ascending: false }).order("gold_cost");
  throwIfError(error);
  return (data ?? []).map(mapReward);
};

export const getRewardRedemptions = async (dogId: string): Promise<RewardRedemption[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client.from("reward_redemptions").select("*").eq("dog_id", dogId).order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapRedemption);
};

type RedeemJson = {
  redemption: RewardRedemptionRow;
  wallet: WalletSummary;
};

export const redeemReward = async (dogId: string, rewardId: string): Promise<{ redemption: RewardRedemption; wallet: WalletSummary }> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("redeem_reward", {
    target_dog_id: dogId,
    target_reward_id: rewardId,
    request_key: createIdempotencyKey("reward"),
  });
  throwIfError(error);
  const result = data as Json as RedeemJson;
  return { redemption: mapRedemption(result.redemption), wallet: result.wallet };
};
