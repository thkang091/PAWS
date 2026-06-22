import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getCouponPurchases, getCoupons, purchaseCoupon } from "@/services/couponService";

export const useCoupons = () =>
  useQuery({
    queryKey: queryKeys.coupons,
    queryFn: getCoupons,
  });

export const useCouponPurchases = (dogId?: string) =>
  useQuery({
    queryKey: dogId ? queryKeys.couponPurchases(dogId) : ["couponPurchases", "missing"],
    queryFn: () => getCouponPurchases(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const usePurchaseCoupon = (dogId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (couponId: string) => purchaseCoupon(dogId, couponId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.couponPurchases(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(dogId) });
    },
  });
};
