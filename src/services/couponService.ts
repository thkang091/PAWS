import {
  createIdempotencyKey,
  getClientOrThrow,
  mapCoupon,
  mapCouponPurchase,
  throwIfError,
} from "@/services/serviceUtils";
import type { Coupon, CouponPurchase, WalletSummary } from "@/types/domain";
import type { CouponPurchaseRow, Json } from "@/types/database";

export const getCoupons = async (): Promise<Coupon[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("coupons")
    .select("*")
    .eq("status", "active")
    .order("gold_coin_cost");
  throwIfError(error);
  return (data ?? []).map(mapCoupon);
};

export const getCouponPurchases = async (dogId: string): Promise<CouponPurchase[]> => {
  const client = getClientOrThrow();
  const { data, error } = await client
    .from("coupon_purchases")
    .select("*")
    .eq("dog_id", dogId)
    .order("created_at", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapCouponPurchase);
};

type PurchaseCouponJson = {
  purchase: CouponPurchaseRow;
  wallet: WalletSummary;
};

export const purchaseCoupon = async (dogId: string, couponId: string): Promise<{ purchase: CouponPurchase; wallet: WalletSummary }> => {
  const client = getClientOrThrow();
  const { data, error } = await client.rpc("purchase_coupon", {
    target_dog_id: dogId,
    target_coupon_id: couponId,
    request_key: createIdempotencyKey("coupon"),
  });
  throwIfError(error);
  const result = data as Json as PurchaseCouponJson;
  return { purchase: mapCouponPurchase(result.purchase), wallet: result.wallet };
};
