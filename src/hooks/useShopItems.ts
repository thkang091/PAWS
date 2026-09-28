import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getShopItems, purchaseShopBasket } from "@/services/shopService";
import { queryKeys } from "@/constants/queryKeys";

export const useShopItems = () =>
  useQuery({
    queryKey: ["shopItems"] as const,
    queryFn: getShopItems,
    staleTime: 5 * 60 * 1000,
  });

export const usePurchaseShopBasket = (dogId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lines: Parameters<typeof purchaseShopBasket>[1]) => purchaseShopBasket(dogId, lines),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.wallet(dogId) });
    },
  });
};
