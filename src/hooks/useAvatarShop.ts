import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { equipAvatarItem, getAvatarCatalog, getAvatarInventory, purchaseAvatarItem } from "@/services/avatarService";

export const useAvatarCatalog = () =>
  useQuery({ queryKey: queryKeys.avatarCatalog, queryFn: getAvatarCatalog });

export const useAvatarInventory = (dogId?: string) =>
  useQuery({
    queryKey: dogId ? queryKeys.avatarInventory(dogId) : ["avatarInventory", "missing"],
    queryFn: () => getAvatarInventory(dogId ?? ""),
    enabled: Boolean(dogId),
  });

export const usePurchaseAvatarItem = (dogId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (avatarItemId: string) => purchaseAvatarItem(dogId, avatarItemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.avatarInventory(dogId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.wallet(dogId) });
    },
  });
};

export const useEquipAvatarItem = (dogId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (avatarItemId: string) => equipAvatarItem(dogId, avatarItemId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.avatarInventory(dogId) });
    },
  });
};
