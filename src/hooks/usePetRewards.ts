import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { readCache, writeCache } from "@/lib/diskCache";

import { queryKeys } from "@/constants/queryKeys";
import { claimLink, getPetCatalog, getRedemptions, redeemPetReward, resumeRedemption } from "@/services/petRewardsService";

// The last catalog, kept on the phone, so the Pet Shop opens with its cards at once and refreshes behind them.
const CATALOG_KEEP_MS = 7 * 24 * 60 * 60 * 1000;
const kept = new Map<string, { value: PetCatalogReply; at: number }>();
type PetCatalogReply = Awaited<ReturnType<typeof getPetCatalog>>;

/** Load the kept catalog into memory early (the Game tab calls this), so the first render can use it. */
export const warmPetCatalog = async (dogId: string) => {
  if (kept.has(dogId)) return;
  const saved = await readCache<PetCatalogReply>(`petCatalog:${dogId}`, CATALOG_KEEP_MS);
  if (saved) kept.set(dogId, saved);
};

const fetchCatalog = async (dogId: string) => {
  const value = await getPetCatalog(dogId);
  kept.set(dogId, { value, at: Date.now() });
  writeCache(`petCatalog:${dogId}`, value);
  return value;
};

export const petCatalogKey = (dogId: string) => ["petRewards", "catalog", dogId] as const;

export const usePetCatalog = (dogId?: string) =>
  useQuery({
    queryKey: petCatalogKey(dogId ?? ""),
    queryFn: () => fetchCatalog(dogId ?? ""),
    enabled: Boolean(dogId),
    staleTime: 60_000,
    retry: 1,
    initialData: () => (dogId ? kept.get(dogId)?.value : undefined),
    initialDataUpdatedAt: () => (dogId ? kept.get(dogId)?.at : undefined),
  });

/** Start loading the shop before it is opened. */
export const usePrefetchPetCatalog = (dogId?: string) => {
  const qc = useQueryClient();
  useEffect(() => {
    if (!dogId) return;
    void warmPetCatalog(dogId).then(() => {
      const saved = kept.get(dogId);
      // Show the kept cards right away if nothing newer has arrived, then refresh in the background.
      if (saved && !qc.getQueryData(petCatalogKey(dogId))) qc.setQueryData(petCatalogKey(dogId), saved.value, { updatedAt: saved.at });
      return qc.prefetchQuery({ queryKey: petCatalogKey(dogId), queryFn: () => fetchCatalog(dogId), staleTime: 60_000 }).catch(() => undefined);
    });
  }, [dogId, qc]);
};

export const useRedemptions = () => useQuery({ queryKey: ["petRewards", "history"], queryFn: getRedemptions });

const useRefresh = (dogId?: string) => {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["petRewards"] });
    if (dogId) void qc.invalidateQueries({ queryKey: queryKeys.wallet(dogId) });
  };
};

export const useRedeemPetReward = (dogId?: string) => {
  const refresh = useRefresh(dogId);
  return useMutation({ mutationFn: redeemPetReward, onSettled: refresh });
};

export const useResumeRedemption = (dogId?: string) => {
  const refresh = useRefresh(dogId);
  return useMutation({ mutationFn: resumeRedemption, onSettled: refresh });
};

export const useClaimLink = () => useMutation({ mutationFn: claimLink });
