import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/constants/queryKeys";
import { getDogReferenceAssets } from "@/services/curriculumService";
import type { ReferenceAssetType } from "@/types/domain";

export const useReferenceAssets = (dogId: string | undefined) => {
  const query = useQuery({
    queryKey: dogId ? queryKeys.referenceAssets(dogId) : ["referenceAssets", "missing"],
    queryFn: () => getDogReferenceAssets(dogId ?? ""),
    enabled: Boolean(dogId),
  });

  const assets = query.data ?? [];

  const hasAsset = (type: ReferenceAssetType): boolean =>
    assets.some((a) => a.assetType === type);

  return {
    ...query,
    assets,
    hasAsset,
  };
};
