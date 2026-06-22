import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getWalletSummary } from "@/services/walletService";

export const useWallet = (dogId?: string) =>
  useQuery({
    queryKey: dogId ? queryKeys.wallet(dogId) : ["wallet", "missing"],
    queryFn: () => getWalletSummary(dogId ?? ""),
    enabled: Boolean(dogId),
  });
